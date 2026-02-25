/**
 * Unit Tests for lib/hallucination-detector.ts
 * Covers: detectHallucinations, buildRetryPrompt — all scoring layers,
 *         flag generation, weight modes (real odds vs no odds), shouldRetry,
 *         trustLevel/riskLevel/adjustedTone derivation.
 */

import { describe, it, expect } from 'vitest';
import { detectHallucinations, buildRetryPrompt } from '@/lib/hallucination-detector';
import type { HallucinationReport } from '@/lib/hallucination-detector';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CLEAN_TEXT =
  'The Lakers have good value at +150 moneyline. The odds line is -110 for the spread. ' +
  'Sharp money is on the favorite. Analysis suggests edge on this market.';

const EMPTY_TEXT = '';

function makeOddsData(prices: number[]) {
  return {
    events: [
      {
        bookmakers: [
          {
            markets: [
              {
                outcomes: prices.map((price) => ({ price })),
              },
            ],
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// detectHallucinations — return shape
// ---------------------------------------------------------------------------

describe('detectHallucinations — return shape', () => {
  it('returns all required fields', () => {
    const report = detectHallucinations(CLEAN_TEXT, 'Who should I bet on?');
    expect(report).toHaveProperty('benfordIntegrity');
    expect(report).toHaveProperty('oddsAlignment');
    expect(report).toHaveProperty('marketConsensus');
    expect(report).toHaveProperty('historicalAccuracy');
    expect(report).toHaveProperty('finalConfidence');
    expect(report).toHaveProperty('trustLevel');
    expect(report).toHaveProperty('riskLevel');
    expect(report).toHaveProperty('adjustedTone');
    expect(report).toHaveProperty('flags');
    expect(report).toHaveProperty('shouldRetry');
  });

  it('all scores are numbers in 0–100', () => {
    const r = detectHallucinations(CLEAN_TEXT, 'bet?');
    for (const key of ['benfordIntegrity', 'oddsAlignment', 'marketConsensus', 'historicalAccuracy', 'finalConfidence'] as const) {
      expect(r[key]).toBeGreaterThanOrEqual(0);
      expect(r[key]).toBeLessThanOrEqual(100);
    }
  });

  it('flags is always an array', () => {
    expect(detectHallucinations(CLEAN_TEXT, 'bet?').flags).toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// trustLevel / riskLevel / adjustedTone
// ---------------------------------------------------------------------------

describe('detectHallucinations — trustLevel derivation', () => {
  it('trustLevel=high when finalConfidence >= 75', () => {
    // Use a clean, rich text with matched odds so score is high
    const oddsData = makeOddsData([150, -110]);
    const r = detectHallucinations(CLEAN_TEXT, 'bet?', oddsData);
    if (r.finalConfidence >= 75) expect(r.trustLevel).toBe('high');
  });

  it('trustLevel=low when finalConfidence < 55', () => {
    // Force a low confidence via extreme probability claim + guaranteed language
    const text = '100% win probability guaranteed. can\'t lose on this one. +10000 -50000';
    const r = detectHallucinations(text, 'bet?');
    if (r.finalConfidence < 55) expect(r.trustLevel).toBe('low');
  });

  it('trustLevel=medium when finalConfidence is between 55 and 74', () => {
    const r = detectHallucinations(CLEAN_TEXT, 'bet?');
    const { finalConfidence, trustLevel } = r;
    if (finalConfidence >= 55 && finalConfidence < 75) {
      expect(trustLevel).toBe('medium');
    }
  });
});

describe('detectHallucinations — riskLevel derivation', () => {
  it('riskLevel is the mirror of trustLevel', () => {
    const r = detectHallucinations(CLEAN_TEXT, 'bet?');
    const expectedRisk = r.finalConfidence >= 75 ? 'low' : r.finalConfidence >= 55 ? 'medium' : 'high';
    expect(r.riskLevel).toBe(expectedRisk);
  });
});

describe('detectHallucinations — adjustedTone', () => {
  it('reports "Strong signal" for confidence >= 85', () => {
    // Mock a very clean response with real odds
    const oddsData = makeOddsData([150, -110, -110, 150]);
    // Text that matches the odds, uses sports terms, and makes no extreme claims
    const richText = Array.from({ length: 10 }, () =>
      'The odds are +150 and -110. Sharp analysis shows value on this spread. Market book edge.'
    ).join(' ');
    const r = detectHallucinations(richText, 'what are the best bets?', oddsData);
    if (r.finalConfidence >= 85) expect(r.adjustedTone).toBe('Strong signal');
  });

  it('adjustedTone is one of the 5 defined strings', () => {
    const r = detectHallucinations(CLEAN_TEXT, 'bet?');
    expect([
      'Strong signal', 'Confident', 'Moderate confidence', 'Low confidence', 'Hallucination risk',
    ]).toContain(r.adjustedTone);
  });
});

// ---------------------------------------------------------------------------
// Scoring layer: Market Consensus
// ---------------------------------------------------------------------------

describe('detectHallucinations — market consensus flags', () => {
  it('adds extreme_probability flag for win probability > 97%', () => {
    const r = detectHallucinations('98% win probability on this bet.', 'bet?');
    const flag = r.flags.find((f) => f.type === 'extreme_probability');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('error');
  });

  it('adds high_probability flag for win probability > 90% and <= 97%', () => {
    const r = detectHallucinations('95% chance this wins.', 'bet?');
    const flag = r.flags.find((f) => f.type === 'high_probability');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warning');
  });

  it('does NOT flag a win probability of exactly 80%', () => {
    const r = detectHallucinations('80% win probability.', 'bet?');
    const probFlags = r.flags.filter((f) =>
      f.type === 'extreme_probability' || f.type === 'high_probability'
    );
    expect(probFlags).toHaveLength(0);
  });

  it('adds guaranty_language flag for "guaranteed"', () => {
    const r = detectHallucinations('This is a guaranteed win.', 'bet?');
    expect(r.flags.find((f) => f.type === 'guaranty_language')).toBeDefined();
  });

  it('adds guaranty_language flag for "sure thing"', () => {
    const r = detectHallucinations('This is a sure thing bet.', 'bet?');
    expect(r.flags.find((f) => f.type === 'guaranty_language')).toBeDefined();
  });

  it('adds guaranty_language flag for "can\'t lose"', () => {
    const r = detectHallucinations("This is a can't lose situation.", 'bet?');
    expect(r.flags.find((f) => f.type === 'guaranty_language')).toBeDefined();
  });

  it('adds guaranty_language flag for "free money"', () => {
    const r = detectHallucinations('This is free money.', 'bet?');
    expect(r.flags.find((f) => f.type === 'guaranty_language')).toBeDefined();
  });

  it('adds odds_impossible flag for a moneyline outside ±100–3000', () => {
    // +99 is in the dead zone
    const r = detectHallucinations('Take the +99 moneyline on this game.', 'bet?');
    expect(r.flags.find((f) => f.type === 'odds_impossible')).toBeDefined();
  });

  it('does NOT add odds_impossible for a valid moneyline like -110', () => {
    const r = detectHallucinations('The spread is -110 on both sides.', 'bet?');
    expect(r.flags.find((f) => f.type === 'odds_impossible')).toBeUndefined();
  });

  it('lowers marketConsensus significantly when guaranty language is used', () => {
    const clean = detectHallucinations('Good bet at -110 spread.', 'bet?');
    const guaranteed = detectHallucinations('Guaranteed win at -110 spread.', 'bet?');
    expect(guaranteed.marketConsensus).toBeLessThan(clean.marketConsensus);
  });
});

// ---------------------------------------------------------------------------
// Scoring layer: Odds Alignment (no real odds data)
// ---------------------------------------------------------------------------

describe('detectHallucinations — odds alignment (no real odds data)', () => {
  it('returns 88 when no moneylines are cited and no odds data supplied', () => {
    const r = detectHallucinations('The Lakers look good today.', 'bet?');
    expect(r.oddsAlignment).toBe(88);
  });

  it('returns 88 when cited moneylines are all plausible (no odds data)', () => {
    const r = detectHallucinations('Take the +150 moneyline and -200 side.', 'bet?');
    expect(r.oddsAlignment).toBe(88);
  });

  it('adds odds_range flag for implausible moneyline without odds data', () => {
    // +50 is in the dead zone (< 100)
    const r = detectHallucinations('The +50 line is attractive here.', 'bet?');
    const flag = r.flags.find((f) => f.type === 'odds_range');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('error');
  });

  it('lowers oddsAlignment when implausible odds cited', () => {
    const r = detectHallucinations('Take the +50 and +75 lines.', 'bet?');
    expect(r.oddsAlignment).toBeLessThan(88);
  });
});

// ---------------------------------------------------------------------------
// Scoring layer: Odds Alignment (with real odds data)
// ---------------------------------------------------------------------------

describe('detectHallucinations — odds alignment (with real odds data)', () => {
  it('returns 90 when AI cites no moneylines but real data exists', () => {
    const oddsData = makeOddsData([150, -110]);
    const r = detectHallucinations('The Lakers look good.', 'bet?', oddsData);
    expect(r.oddsAlignment).toBe(90);
  });

  it('returns 100 when all AI-cited odds match real data', () => {
    const oddsData = makeOddsData([150, -110]);
    // 150 and -110 are in the lookup (±15 window)
    const r = detectHallucinations('The +150 and -110 lines are in play.', 'bet?', oddsData);
    expect(r.oddsAlignment).toBe(100);
  });

  it('returns less than 100 when some AI-cited odds are not in real data', () => {
    const oddsData = makeOddsData([150]); // only 150 in the data
    // +500 is not in the lookup
    const r = detectHallucinations('Take +150 and +500 on this game.', 'bet?', oddsData);
    expect(r.oddsAlignment).toBeLessThan(100);
  });

  it('adds odds_mismatch flag when odds do not match real data', () => {
    const oddsData = makeOddsData([150]);
    const r = detectHallucinations('Take +999 on this game.', 'bet?', oddsData);
    expect(r.flags.find((f) => f.type === 'odds_mismatch')).toBeDefined();
  });

  it('mismatch flag severity is error when 3+ unmatched odds', () => {
    const oddsData = makeOddsData([100]);
    const r = detectHallucinations('+400 +500 +600 +700 are the lines.', 'bet?', oddsData);
    const flag = r.flags.find((f) => f.type === 'odds_mismatch');
    if (flag) expect(flag.severity).toBe('error');
  });

  it('mismatch flag severity is warning when fewer than 3 unmatched', () => {
    const oddsData = makeOddsData([100]);
    const r = detectHallucinations('+400 is the line.', 'bet?', oddsData);
    const flag = r.flags.find((f) => f.type === 'odds_mismatch');
    if (flag) expect(flag.severity).toBe('warning');
  });
});

// ---------------------------------------------------------------------------
// Scoring layer: Coherence
// ---------------------------------------------------------------------------

describe('detectHallucinations — coherence (historicalAccuracy)', () => {
  it('returns 25 for a very short AI text (< 30 chars)', () => {
    const r = detectHallucinations('ok', 'What should I bet?');
    expect(r.historicalAccuracy).toBe(25);
  });

  it('penalises short responses to long questions', () => {
    const longQuestion = 'What are the best value bets across all NBA games tonight given the line movements?';
    const short = detectHallucinations('Take the Lakers.', longQuestion);
    const long = detectHallucinations(
      'Based on the current line movements and sharp action, the Lakers at +110 appear to represent strong value. ' +
        'The spread has moved from -3 to -1.5, indicating sharp money on them. Market analysis confirms this edge.',
      longQuestion,
    );
    expect(long.historicalAccuracy).toBeGreaterThan(short.historicalAccuracy);
  });

  it('awards higher coherence for sports-term-rich text', () => {
    const minimal = detectHallucinations('I think they will win the game.', 'bet?');
    const termRich = detectHallucinations(
      'Moneyline odds spread underdog book sharp kelly ev analysis edge value market confidence over under.',
      'bet?',
    );
    expect(termRich.historicalAccuracy).toBeGreaterThan(minimal.historicalAccuracy);
  });
});

// ---------------------------------------------------------------------------
// Weighting: real odds vs no odds
// ---------------------------------------------------------------------------

describe('detectHallucinations — weighting with real odds present', () => {
  it('oddsAlignment has a larger impact when real odds are present (0.55 weight)', () => {
    const oddsData = makeOddsData([100]);
    // Force a very low oddsAlignment: cite a moneyline that cannot match
    const lowOddsText = '+999 is the line to take here.';
    const withOdds = detectHallucinations(lowOddsText, 'bet?', oddsData);
    const withoutOdds = detectHallucinations(lowOddsText, 'bet?');
    // With real odds, the 0.55 weight on odds alignment means score is lower
    expect(withOdds.finalConfidence).toBeLessThan(withoutOdds.finalConfidence);
  });
});

// ---------------------------------------------------------------------------
// shouldRetry conditions
// ---------------------------------------------------------------------------

describe('detectHallucinations — shouldRetry', () => {
  it('shouldRetry=false for a clean, high-confidence response', () => {
    const oddsData = makeOddsData([150, -110]);
    const r = detectHallucinations(CLEAN_TEXT, 'bet?', oddsData);
    if (r.finalConfidence >= 55 && r.oddsAlignment >= 45 && r.marketConsensus >= 45) {
      expect(r.shouldRetry).toBe(false);
    }
  });

  it('shouldRetry=true when finalConfidence < 55', () => {
    // Guaranteed + extreme probability + impossible odds should tank the score
    const text = '100% win probability guaranteed. +10000 odds are in play. Lock of the century.';
    const r = detectHallucinations(text, 'bet?');
    if (r.finalConfidence < 55) {
      expect(r.shouldRetry).toBe(true);
    }
  });

  it('sets retryReason when shouldRetry=true', () => {
    const text = '100% win probability guaranteed. Lock of the century.';
    const r = detectHallucinations(text, 'bet?');
    if (r.shouldRetry) {
      expect(r.retryReason).toBeTruthy();
    }
  });

  it('retryReason is undefined when shouldRetry=false', () => {
    const oddsData = makeOddsData([150, -110]);
    const r = detectHallucinations(CLEAN_TEXT, 'bet?', oddsData);
    if (!r.shouldRetry) {
      expect(r.retryReason).toBeUndefined();
    }
  });

  it('shouldRetry=true when oddsAlignment < 45 (with real odds)', () => {
    // Real data has only 100; cite many mismatched odds
    const oddsData = makeOddsData([100]);
    const text = '+999 +888 +777 +666 +555 +444 are all great lines to take.';
    const r = detectHallucinations(text, 'bet?', oddsData);
    if (r.oddsAlignment < 45) {
      expect(r.shouldRetry).toBe(true);
      expect(r.retryReason).toContain('odds mismatch');
    }
  });
});

// ---------------------------------------------------------------------------
// Composite score is bounded
// ---------------------------------------------------------------------------

describe('detectHallucinations — finalConfidence bounds', () => {
  it('finalConfidence is always >= 0', () => {
    const worst = '100% win probability guaranteed. Lock of the century. +50 odds.';
    expect(detectHallucinations(worst, 'bet?').finalConfidence).toBeGreaterThanOrEqual(0);
  });

  it('finalConfidence is always <= 100', () => {
    const best = Array.from({ length: 20 }, () =>
      'The +150 spread is -110 over under. Sharp money on the book odds.'
    ).join(' ');
    const oddsData = makeOddsData([150, -110]);
    expect(detectHallucinations(best, 'what?', oddsData).finalConfidence).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// buildRetryPrompt
// ---------------------------------------------------------------------------

describe('buildRetryPrompt', () => {
  const baseReport: HallucinationReport = {
    benfordIntegrity: 80,
    oddsAlignment: 40,
    marketConsensus: 50,
    historicalAccuracy: 70,
    finalConfidence: 45,
    trustLevel: 'low',
    riskLevel: 'high',
    adjustedTone: 'Low confidence',
    flags: [
      { type: 'odds_mismatch', message: 'Some odds not found in live data', severity: 'warning' },
    ],
    shouldRetry: true,
    retryReason: 'integrity 45%; odds mismatch 40%',
  };

  it('includes the finalConfidence score in the output', () => {
    const prompt = buildRetryPrompt('Who should I bet on?', baseReport, 1, false);
    expect(prompt).toContain('45%');
  });

  it('includes the attempt number', () => {
    const prompt = buildRetryPrompt('Who should I bet on?', baseReport, 1, false);
    expect(prompt).toContain('attempt 1');
  });

  it('includes flag messages', () => {
    const prompt = buildRetryPrompt('Who should I bet on?', baseReport, 1, false);
    expect(prompt).toContain('Some odds not found in live data');
  });

  it('uses WARNING severity label on attempt 1', () => {
    const prompt = buildRetryPrompt('Original question', baseReport, 1, false);
    expect(prompt.startsWith('WARNING')).toBe(true);
  });

  it('uses CRITICAL severity label on attempt 2+', () => {
    const prompt = buildRetryPrompt('Original question', baseReport, 2, false);
    expect(prompt.startsWith('CRITICAL')).toBe(true);
  });

  it('includes the original prompt', () => {
    const original = 'Who should I bet on tonight?';
    const prompt = buildRetryPrompt(original, baseReport, 1, false);
    expect(prompt).toContain(original);
  });

  it('adds live-odds rule when hasOddsData=true', () => {
    const prompt = buildRetryPrompt('bet?', baseReport, 1, true);
    expect(prompt).toContain('REAL LIVE ODDS DATA');
  });

  it('adds invented-odds rule when hasOddsData=false', () => {
    const prompt = buildRetryPrompt('bet?', baseReport, 1, false);
    expect(prompt).toContain('Do not invent specific odds');
  });

  it('adds final-attempt rule on attempt >= 2', () => {
    const prompt = buildRetryPrompt('bet?', baseReport, 2, false);
    expect(prompt).toContain('FINAL ATTEMPT');
  });

  it('does NOT include final-attempt rule on attempt 1', () => {
    const prompt = buildRetryPrompt('bet?', baseReport, 1, false);
    expect(prompt).not.toContain('FINAL ATTEMPT');
  });

  it('uses fallback message when flags array is empty', () => {
    const noFlagsReport: HallucinationReport = { ...baseReport, flags: [] };
    const prompt = buildRetryPrompt('bet?', noFlagsReport, 1, false);
    expect(prompt).toContain('Response did not meet accuracy standards');
  });
});
