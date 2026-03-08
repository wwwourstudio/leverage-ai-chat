/**
 * VPE 3.0 — Hitter Breakout Detection
 * ======================================
 * EV50-driven power breakout prediction, sleeper scoring,
 * swing efficiency analysis, and MVP scoring.
 */

import { LEAGUE_AVG, type HitterStats, type BreakoutResult, type BreakoutTier } from './types';
import { computeHitterZScores, powerCore, ageFactor } from './core';

// ── Helpers ─────────────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function round(val: number, d: number = 3): number {
  const f = 10 ** d;
  return Math.round(val * f) / f;
}

function breakoutTier(index: number): BreakoutTier {
  if (index >= 3.0) return 'Confirmed Breakout';
  if (index >= 1.5) return 'Trending';
  if (index >= 0.5) return 'Watch';
  return 'No Signal';
}

// ── Power Breakout Index ────────────────────────────────────────────────────

/**
 * PowerBreakoutIndex = 0.55*BatSpeed_z + 0.35*AttackAngle_z
 *                    + 0.25*PullAirPercent_z + 0.20*BlastRate_z
 */
export function powerBreakoutIndex(h: HitterStats): number {
  const hz = computeHitterZScores(h);
  const pullAirZ = (h.pullAirPct - LEAGUE_AVG.PULL_AIR_PCT) / 4.0;
  const blastZ = (h.blastRate - LEAGUE_AVG.BLAST_RATE) / 2.0;
  return round(0.55 * hz.batSpeedZ + 0.35 * hz.attackAngleZ + 0.25 * pullAirZ + 0.20 * blastZ);
}

// ── Swing Efficiency ────────────────────────────────────────────────────────

/**
 * SwingEfficiency = 1.8*BatSpeed + 1.2*ContactRate + 1.5*AttackAngleAlignment - 0.8*SwingLength
 * (normalized to league average ratios)
 */
export function swingEfficiency(h: HitterStats): number {
  const L = LEAGUE_AVG;
  return round(
    1.8 * (h.batSpeed / L.BAT_SPEED) +
    1.2 * (h.contactPct / L.CONTACT_PCT) +
    1.5 * (h.attackAngle / L.ATTACK_ANGLE) -
    0.8 * (h.swingLength / L.SWING_LENGTH),
  );
}

// ── Sleeper Score ───────────────────────────────────────────────────────────

/**
 * SleeperScore = 2.2*ΔEV50 + 1.8*ΔBlastRate + 1.5*ΔContact% - 1.3*ΔChaseRate + 1.0*PlayingTimeOpportunity
 *
 * Requires prior-season metrics for delta calculations.
 */
export function sleeperScore(
  current: HitterStats,
  prior: { ev50: number; blastRate: number; contactPct: number; chaseRate: number },
  playingTimeOpp: number = 0.5,
): number {
  const sd = LEAGUE_AVG.SD;
  const deltaEV50 = (current.ev50 - prior.ev50) / sd.EV50;
  const deltaBlast = (current.blastRate - prior.blastRate) / 2.0;
  const deltaContact = (current.contactPct - prior.contactPct) / 5.0;
  const deltaChase = (current.chaseRate - prior.chaseRate) / 3.0; // increase = bad

  return round(
    2.2 * deltaEV50 +
    1.8 * deltaBlast +
    1.5 * deltaContact -
    1.3 * deltaChase +
    1.0 * playingTimeOpp,
  );
}

// ── MVP Score ───────────────────────────────────────────────────────────────

/**
 * MVPScore = 0.35*PowerScore + 0.25*ContactScore + 0.20*DiscScore
 *          + 0.10*AthleticScore + (0.10*Defense × AgeFactor)
 */
export function mvpScore(
  h: HitterStats,
  sprintSpeed: number = 27.0,
  outsAboveAvg: number = 0.0,
): number {
  const L = LEAGUE_AVG;
  const power = powerCore(h);
  const contact = (h.contactPct - L.CONTACT_PCT) / 5.0;
  const discipline = (h.bbPct - L.BB_PCT_HITTER) / 3.0 - (h.chaseRate - L.CHASE_RATE) / 5.0;
  const athletic = (sprintSpeed - 27.0) / 2.0;
  const defense = outsAboveAvg / 10.0;

  return round(
    0.35 * power +
    0.25 * contact +
    0.20 * discipline +
    0.10 * athletic +
    0.10 * defense * ageFactor(h.age),
  );
}

// ── Full Breakout Analysis ──────────────────────────────────────────────────

/**
 * Complete breakout analysis for a hitter, combining all sub-metrics.
 */
export function analyzeBreakout(
  hitter: HitterStats,
  prior?: { ev50: number; blastRate: number; contactPct: number; chaseRate: number },
  playingTimeOpp: number = 0.5,
): BreakoutResult {
  const pbi = powerBreakoutIndex(hitter);
  const swingEff = swingEfficiency(hitter);

  const priorData = prior ?? {
    ev50: hitter.ev50,
    blastRate: hitter.blastRate,
    contactPct: hitter.contactPct,
    chaseRate: hitter.chaseRate,
  };
  const sleeper = sleeperScore(hitter, priorData, playingTimeOpp);
  const mvp = mvpScore(hitter);

  // Breakout probability (sigmoid of PBI)
  const breakoutProb = sigmoid(-1.5 * (pbi - 1.0));
  // Invert: higher PBI = higher prob
  const correctedProb = 1.0 - breakoutProb;

  // Signal detection
  const signals: string[] = [];
  const hz = computeHitterZScores(hitter);
  if (hz.ev50Z >= 1.0)
    signals.push(`EV50 elite (${hitter.ev50.toFixed(1)} mph, +${hz.ev50Z.toFixed(1)}σ)`);
  if (hz.batSpeedZ >= 1.0)
    signals.push(`Bat speed elite (${hitter.batSpeed.toFixed(1)} mph)`);
  if (hitter.barrelPct >= 12.0)
    signals.push(`High barrel rate (${hitter.barrelPct.toFixed(1)}%)`);
  if (hitter.pullAirPct >= 16.0)
    signals.push(`Pull-air authority (${hitter.pullAirPct.toFixed(1)}%)`);
  if (prior && (hitter.ev50 - prior.ev50) / LEAGUE_AVG.SD.EV50 > 0.5) {
    const delta = (hitter.ev50 - prior.ev50) / LEAGUE_AVG.SD.EV50;
    signals.push(`EV50 surge (+${delta.toFixed(2)}σ YoY)`);
  }
  if (hitter.blastRate >= 6.0)
    signals.push(`Blast rate elevated (${hitter.blastRate.toFixed(1)}%)`);
  if (hitter.hardHitPct >= 45.0)
    signals.push(`Hard-hit% elite (${hitter.hardHitPct.toFixed(1)}%)`);

  return {
    powerBreakoutIndex: pbi,
    swingEfficiency: swingEff,
    sleeperScore: sleeper,
    mvpScore: mvp,
    breakoutProbability: round(correctedProb),
    tier: breakoutTier(pbi),
    signals,
  };
}
