/**
 * Hallucination Detector — multi-layer AI response validation
 *
 * Layers (in order of weight when real odds data is present):
 *  1. Odds Cross-Reference  (55%) – AI-cited moneylines vs. live bookmaker data
 *  2. Market Consensus      (20%) – plausibility of claims, probability bounds
 *  3. Benford Integrity     (15%) – digit-distribution anomaly check
 *  4. Response Coherence    (10%) – length / terminology sanity
 *
 * When no real odds data is available, weights redistribute:
 *  Benford (25%) · Odds-plausibility (25%) · Consensus (30%) · Coherence (20%)
 *
 * shouldRetry = true when finalConfidence < 55 OR oddsAlignment < 45 OR consensus < 45
 */

import { validateBenford } from './benford-validator';

// ── Public types ────────────────────────────────────────────────────────────

export interface HallucinationFlag {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface HallucinationReport {
  /** Benford's Law digit-distribution score (0–100) */
  benfordIntegrity: number;
  /** AI-cited odds vs. live bookmaker data match rate (0–100) */
  oddsAlignment: number;
  /** Plausibility of probability claims and odds ranges (0–100) */
  marketConsensus: number;
  /** Response coherence and sports-terminology density (0–100) */
  historicalAccuracy: number;
  /** Weighted composite integrity score (0–100) */
  finalConfidence: number;
  trustLevel: 'high' | 'medium' | 'low';
  riskLevel: 'low' | 'medium' | 'high';
  adjustedTone: string;
  flags: HallucinationFlag[];
  /** True when score is low enough that caller should retry with stricter prompt */
  shouldRetry: boolean;
  retryReason?: string;
}

// ── Number extraction ────────────────────────────────────────────────────────

const MAX_NUMBERS_FOR_BENFORD = 500; // prevent excessive processing on large responses

function extractAllNumbers(text: string): number[] {
  const tokens = text.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return tokens
    .slice(0, MAX_NUMBERS_FOR_BENFORD)
    .map(Number)
    .filter((n) => !isNaN(n) && n !== 0 && Math.abs(n) < 1_000_000);
}

/** Extract US-style moneylines: +125, -110, +2200, -350, etc. */
function extractMoneylines(text: string): number[] {
  const tokens = text.match(/[+\-]\d{2,4}(?!\d)/g) ?? [];
  return tokens.map(Number).filter((n) => !isNaN(n));
}

/** Valid US moneyline: ±100 to ±3000, never in the -99…+99 dead zone */
function isPlausibleMoneyline(n: number): boolean {
  return Math.abs(n) >= 100 && Math.abs(n) <= 3000;
}

// ── Check 1: Benford Integrity ────────────────────────────────────────────────

function scoreBenford(aiText: string): number {
  const nums = extractAllNumbers(aiText);
  if (nums.length === 0) return 88; // Nothing to check — neutral

  const result = validateBenford(nums);
  if (result.confidence === 'low') {
    // Insufficient sample — give benefit of the doubt
    return Math.round(80 + result.score * 15);
  }
  return Math.round(result.score * 100);
}

// ── Check 2: Odds Alignment ───────────────────────────────────────────────────

/**
 * Build a lookup Set of every real odds value in the bookmaker data,
 * expanded by ±15 points to account for normal line movement between
 * when data was fetched and when the AI was prompted.
 */
function buildRealOddsLookup(oddsData: any): Set<number> | null {
  if (!oddsData?.events?.length) return null;

  const lookup = new Set<number>();
  for (const event of oddsData.events) {
    for (const book of event.bookmakers ?? []) {
      for (const market of book.markets ?? []) {
        for (const outcome of market.outcomes ?? []) {
          if (typeof outcome.price === 'number') {
            for (let d = -15; d <= 15; d += 5) lookup.add(outcome.price + d);
          }
          if (typeof outcome.point === 'number') {
            for (let d = -2; d <= 2; d++) lookup.add(outcome.point + d);
          }
        }
      }
    }
  }
  return lookup;
}

function scoreOddsAlignment(
  aiText: string,
  oddsData: any,
  flags: HallucinationFlag[],
): number {
  const moneylines = extractMoneylines(aiText);
  const realLookup = buildRealOddsLookup(oddsData);

  if (!realLookup) {
    // No real data — plausibility-only check
    if (moneylines.length === 0) return 88;
    const bad = moneylines.filter((ml) => !isPlausibleMoneyline(ml));
    if (bad.length > 0) {
      flags.push({
        type: 'odds_range',
        message: `Implausible odds cited: ${bad.slice(0, 3).map((n) => (n > 0 ? '+' : '') + n).join(', ')}`,
        severity: 'error',
      });
      return Math.max(0, 75 - bad.length * 10);
    }
    return 88;
  }

  // Cross-reference every AI-cited moneyline against real bookmaker data
  if (moneylines.length === 0) return 90; // AI made no specific odds claims — clean

  let matchCount = 0;
  const unmatched: number[] = [];

  for (const ml of moneylines) {
    if (realLookup.has(ml)) {
      matchCount++;
    } else {
      unmatched.push(ml);
    }
  }

  const score = Math.round((matchCount / moneylines.length) * 100);

  if (unmatched.length > 0) {
    const examples = unmatched
      .slice(0, 3)
      .map((n) => (n > 0 ? '+' : '') + n)
      .join(', ');
    flags.push({
      type: 'odds_mismatch',
      message: `${unmatched.length} AI-cited odds not found in live bookmaker data: ${examples}`,
      severity: unmatched.length >= 3 ? 'error' : 'warning',
    });
  }

  return score;
}

// ── Check 3: Market Consensus / Plausibility ──────────────────────────────────

function scoreMarketConsensus(
  aiText: string,
  flags: HallucinationFlag[],
): number {
  let score = 92;

  // Extreme win-probability claims
  const probMatches = [
    ...aiText.matchAll(/(\d{1,3})\s*%\s*(?:win|chance|probability|likely|confident)/gi),
  ];
  for (const m of probMatches) {
    const pct = parseInt(m[1], 10);
    if (pct > 97) {
      score -= 25;
      flags.push({
        type: 'extreme_probability',
        message: `Extreme win probability claimed (${pct}%) — strong hallucination signal`,
        severity: 'error',
      });
    } else if (pct > 90) {
      score -= 8;
      flags.push({
        type: 'high_probability',
        message: `High confidence claim (${pct}%) — verify against base rates`,
        severity: 'warning',
      });
    }
  }

  // "Guaranteed win" language — never valid in sports betting
  if (
    /\b(guaranteed|sure thing|can't lose|cant lose|lock of the century|free money|no-brainer lock)\b/i.test(
      aiText,
    )
  ) {
    score -= 30;
    flags.push({
      type: 'guaranty_language',
      message: 'Response uses "guaranteed" language — impossible in sports betting',
      severity: 'error',
    });
  }

  // Odds outside any known bookmaker range
  const moneylines = extractMoneylines(aiText);
  for (const ml of moneylines) {
    if (!isPlausibleMoneyline(ml)) {
      score -= 15;
      flags.push({
        type: 'odds_impossible',
        message: `Moneyline ${ml > 0 ? '+' : ''}${ml} is outside all known bookmaker ranges`,
        severity: 'error',
      });
    }
  }

  return Math.max(0, Math.min(100, score));
}

// ── Check 4: Response Coherence ───────────────────────────────────────────────

function scoreCoherence(aiText: string, userMessage: string): number {
  if (!aiText || aiText.length < 30) return 25;

  let score = 78;

  // Suspiciously short for a complex query
  if (aiText.length < 100 && userMessage.length > 60) score -= 15;
  if (aiText.length > 200) score += 5;

  // Sports / betting terminology density
  const terms = [
    'odds', 'line', 'spread', 'moneyline', 'over', 'under', 'total',
    'favorite', 'underdog', 'pick', 'bet', 'value', 'market', 'book',
    'kelly', 'ev', 'analysis', 'edge', 'sharp', 'confidence',
  ];
  const termHits = terms.filter((t) => aiText.toLowerCase().includes(t)).length;
  score += Math.min(15, termHits * 2);

  return Math.min(100, score);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface DetectOptions {
  /** Query category — 'dfs' and 'fantasy' skip live-odds alignment weighting */
  category?: string;
  /** False when the query has no betting intent (e.g. pure DFS/fantasy) */
  hasBettingIntent?: boolean;
}

export function detectHallucinations(
  aiText: string,
  userMessage: string,
  oddsData?: any,
  options?: DetectOptions,
): HallucinationReport {
  const flags: HallucinationFlag[] = [];

  // DFS/fantasy queries don't cite live moneylines — force no-odds weights even
  // when oddsData is present in context to avoid false-positive retry triggers.
  const isDfsOrFantasy =
    options?.category === 'dfs' ||
    options?.category === 'fantasy' ||
    options?.hasBettingIntent === false;
  const hasRealOdds = (oddsData?.events?.length ?? 0) > 0 && !isDfsOrFantasy;

  const benfordIntegrity = scoreBenford(aiText);
  const oddsAlignment = scoreOddsAlignment(aiText, oddsData, flags);
  const marketConsensus = scoreMarketConsensus(aiText, flags);
  const historicalAccuracy = scoreCoherence(aiText, userMessage);

  // Weighted composite
  const rawConfidence = hasRealOdds
    ? Math.round(
        benfordIntegrity * 0.15 +
        oddsAlignment    * 0.55 +
        marketConsensus  * 0.20 +
        historicalAccuracy * 0.10,
      )
    : Math.round(
        benfordIntegrity * 0.25 +
        oddsAlignment    * 0.25 +
        marketConsensus  * 0.30 +
        historicalAccuracy * 0.20,
      );
  // When any sub-score is critically low, cap the composite to avoid "Excellent"
  // appearing alongside a failing metric (e.g. 47% Benford / 95% overall).
  const minSubScore = Math.min(benfordIntegrity, oddsAlignment, marketConsensus, historicalAccuracy);
  const finalConfidence = minSubScore < 50 ? Math.min(rawConfidence, 80) : rawConfidence;

  const trustLevel: 'high' | 'medium' | 'low' =
    finalConfidence >= 75 ? 'high' : finalConfidence >= 55 ? 'medium' : 'low';
  const riskLevel: 'low' | 'medium' | 'high' =
    finalConfidence >= 75 ? 'low' : finalConfidence >= 55 ? 'medium' : 'high';
  const adjustedTone =
    finalConfidence >= 85 ? 'Strong signal' :
    finalConfidence >= 75 ? 'Confident' :
    finalConfidence >= 60 ? 'Moderate confidence' :
    finalConfidence >= 45 ? 'Low confidence' :
    'Hallucination risk';

  const shouldRetry =
    finalConfidence < 55 ||
    oddsAlignment   < 45 ||
    marketConsensus < 45;

  const retryReasons: string[] = [];
  if (finalConfidence < 55) retryReasons.push(`integrity ${finalConfidence}%`);
  if (oddsAlignment   < 45) retryReasons.push(`odds mismatch ${oddsAlignment}%`);
  if (marketConsensus < 45) retryReasons.push(`implausible claims`);

  return {
    benfordIntegrity,
    oddsAlignment,
    marketConsensus,
    historicalAccuracy,
    finalConfidence,
    trustLevel,
    riskLevel,
    adjustedTone,
    flags,
    shouldRetry,
    retryReason: retryReasons.length ? retryReasons.join('; ') : undefined,
  };
}

/**
 * Build an escalating retry prompt that instructs the model to correct the
 * specific issues found in the previous response.
 */
export function buildRetryPrompt(
  originalPrompt: string,
  report: HallucinationReport,
  attempt: number,
  hasOddsData: boolean,
): string {
  const severity = attempt >= 2 ? 'CRITICAL' : 'WARNING';
  const issueLines = report.flags.length
    ? report.flags.map((f) => `  • [${f.severity.toUpperCase()}] ${f.message}`).join('\n')
    : '  • Response did not meet accuracy standards';

  return `${severity} — Integrity validation failed (score: ${report.finalConfidence}%, attempt ${attempt}).

Issues detected in previous response:
${issueLines}

MANDATORY CORRECTION RULES FOR THIS ATTEMPT:
1. ${hasOddsData ? 'ONLY cite odds that appear verbatim in the REAL LIVE ODDS DATA section' : 'Do not invent specific odds or statistics you are not certain about'}
2. Never claim any win probability above 80% unless the moneyline clearly implies it
3. Never use words like "guaranteed", "certain", "sure thing", or "can't lose"
4. If uncertain about a specific number, write "approximately" or omit it entirely${attempt >= 2 ? '\n5. FINAL ATTEMPT — extreme factual accuracy required. Fewer claims, higher accuracy.' : ''}

Original question:
${originalPrompt}`;
}
