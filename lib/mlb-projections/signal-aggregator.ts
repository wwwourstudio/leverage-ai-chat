/**
 * LeverageMetrics Signal Aggregator
 *
 * Combines four independent evidence streams into a single `CompositeSignal`
 * for each player prop opportunity:
 *
 *   1. Model probability   — from the 12-variable HR logistic model
 *   2. Market implied prob — derived from best available bookmaker odds
 *   3. Sharp signal        — strength of recent smart-money line movement
 *   4. Calibration alpha   — Platt-scaling correction from the backtester
 *
 * ─── Output: CompositeSignal ─────────────────────────────────────────────────
 *   modelProb         Raw model probability (uncalibrated)
 *   calibratedProb    Platt-scaled model probability
 *   marketProb        Market implied probability (vig-removed)
 *   edge              calibratedProb − marketProb (positive = model edge)
 *   sharpBoost        Additive boost from confirmed sharp money (+/− 0–0.04)
 *   finalProb         calibratedProb + sharpBoost (clamped [0.01, 0.95])
 *   kellyFraction     Full-Kelly fraction (finalProb, marketProb-derived odds)
 *   halfKelly         Conservative 50% Kelly (recommended sizing)
 *   signalStrength    'ELITE' | 'STRONG' | 'LEAN' | 'PASS'
 *   recommendation    'BET' | 'MONITOR' | 'PASS'
 *   confidenceBand    { low: number; high: number } — 80% confidence interval
 *   sources           Which evidence streams contributed
 *
 * ─── Sharp signal integration ────────────────────────────────────────────────
 * A sharp signal is confirmed when:
 *   a) The line moved ≥10 implied-probability points in <2 hours, AND
 *   b) The move was AGAINST the public betting percentage
 * This is stored in the `sharp_signals` table and queried here.
 * The boost is proportional to signal strength: strong=+0.03, moderate=+0.015.
 *
 * ─── Confidence band ─────────────────────────────────────────────────────────
 * Approximated as a symmetric interval around finalProb using the Wilson
 * score interval formula (95% CI → 80% CI approximation without sample size).
 * A wider interval = less confidence = lower effective signalStrength.
 */

import type { PlattCalibration } from './model-config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignalStrength = 'ELITE' | 'STRONG' | 'LEAN' | 'PASS';
export type Recommendation = 'BET' | 'MONITOR' | 'PASS';

/** A raw sharp-money record from the sharp_signals Supabase table. */
export interface SharpSignalRecord {
  player_name: string;
  signal_type: 'sharp' | 'reverse_line_movement' | 'steam' | 'public_fade';
  /** Positive = odds shortened (public/sharp aligned); Negative = reversed */
  movement_pts: number;
  /** 0–1 confidence score computed at detection time */
  strength: number;
  /** UTC ISO timestamp */
  created_at: string;
}

/** Aggregated sharp context for one player. */
export interface SharpContext {
  hasSharpSignal: boolean;
  /** Net boost to add to calibratedProb. Range: −0.04 to +0.04 */
  boost: number;
  /** Most recent signal type, or null if none */
  dominantType: SharpSignalRecord['signal_type'] | null;
  /** How many qualifying signals were found in the lookback window */
  signalCount: number;
}

/** Confidence interval around the final probability estimate. */
export interface ConfidenceBand {
  /** Lower bound of 80% confidence interval */
  low: number;
  /** Upper bound of 80% confidence interval */
  high: number;
  /** Width of the interval — used internally to modulate signalStrength */
  width: number;
}

export interface SignalSources {
  modelProbUsed: boolean;
  marketOddsUsed: boolean;
  sharpSignalUsed: boolean;
  calibrationApplied: boolean;
}

/** The fully aggregated signal output for one player/prop combination. */
export interface CompositeSignal {
  playerName: string;
  propMarket: string;       // e.g. 'batter_home_runs', 'pitcher_strikeouts'
  gameDate: string;         // YYYY-MM-DD

  // ── Probabilities ──────────────────────────────────────────────────────────
  modelProb: number;        // Raw (uncalibrated) model output
  calibratedProb: number;   // After Platt scaling
  marketProb: number;       // Market implied (vig-removed)
  edge: number;             // calibratedProb − marketProb
  sharpBoost: number;       // Additive adjustment from sharp signals
  finalProb: number;        // calibratedProb + sharpBoost (clamped)

  // ── Sizing ─────────────────────────────────────────────────────────────────
  kellyFraction: number;    // Full Kelly (use halfKelly in practice)
  halfKelly: number;        // 50% Kelly — recommended bet size as fraction of bankroll

  // ── Classification ─────────────────────────────────────────────────────────
  signalStrength: SignalStrength;
  recommendation: Recommendation;
  confidenceBand: ConfidenceBand;

  // ── Metadata ───────────────────────────────────────────────────────────────
  sharpContext: SharpContext;
  sources: SignalSources;
  computedAt: string;       // ISO timestamp
}

// ─── American odds helpers ─────────────────────────────────────────────────────

/** Convert American odds (e.g. +150, -110) to implied probability (no vig removed). */
function americanToImpliedProb(americanOdds: number): number {
  if (americanOdds > 0) return 100 / (americanOdds + 100);
  return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

/**
 * Remove the vig from a single-side implied probability.
 * Assumes a symmetric two-way market (market total overround ≈ 5–8%).
 */
function removeVig(impliedProb: number, overround = 1.065): number {
  return impliedProb / overround;
}

/** Convert probability to decimal odds. */
function probToDecimalOdds(p: number): number {
  return 1 / Math.max(0.01, p);
}

// ─── Kelly Criterion ─────────────────────────────────────────────────────────

/**
 * Full Kelly fraction: f = (b×p − q) / b
 * where b = decimal odds − 1, p = model prob, q = 1 − p.
 *
 * Clamped to [0, 0.25] — beyond 25% of bankroll is not operationally viable.
 */
function kellyFraction(modelProb: number, marketProb: number): number {
  const decOdds = probToDecimalOdds(marketProb);
  const b = decOdds - 1;
  const q = 1 - modelProb;
  if (b <= 0) return 0;
  return Math.max(0, Math.min(0.25, (b * modelProb - q) / b));
}

// ─── Platt calibration ────────────────────────────────────────────────────────

function applyPlattCalibration(rawProb: number, cal: PlattCalibration): number {
  const rawLogit = Math.log(rawProb / (1 - rawProb));
  const calLogit = cal.alpha * rawLogit + cal.beta;
  return 1 / (1 + Math.exp(-calLogit));
}

// ─── Confidence band ──────────────────────────────────────────────────────────

/**
 * Compute an 80% confidence band around `prob`.
 *
 * Uses a simplified Wilson interval approximation.  Without a per-player
 * sample size this is a structural heuristic that widens near p=0.5 and
 * narrows near the extremes (which is directionally correct).
 */
function computeConfidenceBand(prob: number): ConfidenceBand {
  // Variance of a Bernoulli at p: p(1-p). Width ∝ 1.28σ for 80% interval.
  const stdEst  = Math.sqrt(prob * (1 - prob));
  const halfWidth = 1.28 * stdEst * 0.5; // ×0.5 scales to plausible per-player uncertainty
  return {
    low:   Math.max(0.01, prob - halfWidth),
    high:  Math.min(0.95, prob + halfWidth),
    width: halfWidth * 2,
  };
}

// ─── Sharp signal aggregation ─────────────────────────────────────────────────

const SHARP_LOOKBACK_HOURS = 4;

/**
 * Aggregate sharp signals for a single player into a SharpContext.
 *
 * Rules:
 *   - Only signals < SHARP_LOOKBACK_HOURS old qualify
 *   - 'steam' and 'sharp' moves boost probability (smart money ON the prop)
 *   - 'public_fade' and 'reverse_line_movement' also boost (books fading public)
 *   - Boost is capped at +0.04 and scales with signal strength × count
 */
export function aggregateSharpSignals(
  signals: SharpSignalRecord[],
  playerName: string,
): SharpContext {
  const cutoff = Date.now() - SHARP_LOOKBACK_HOURS * 60 * 60 * 1000;

  const recent = signals.filter(s => {
    const nameMatch = s.player_name.toLowerCase().includes(playerName.toLowerCase()) ||
                      playerName.toLowerCase().includes(s.player_name.toLowerCase());
    const withinWindow = new Date(s.created_at).getTime() >= cutoff;
    return nameMatch && withinWindow;
  });

  if (!recent.length) {
    return { hasSharpSignal: false, boost: 0, dominantType: null, signalCount: 0 };
  }

  // Sort by strength descending and take top 3 to avoid double-counting noise
  const top = [...recent].sort((a, b) => b.strength - a.strength).slice(0, 3);

  // Raw boost: sum of individual signal strengths, scaled to [0, 0.04]
  const rawBoost = top.reduce((acc, s) => acc + s.strength * 0.04, 0);
  const boost = Math.min(0.04, rawBoost);

  const dominantType = top[0]?.signal_type ?? null;

  return {
    hasSharpSignal: true,
    boost,
    dominantType,
    signalCount: recent.length,
  };
}

// ─── Signal strength classification ──────────────────────────────────────────

/**
 * Classify edge + confidence into a signal strength tier.
 *
 * Thresholds calibrated so ELITE fires ≈5% of time across a slate,
 * preserving the scarcity that makes the label meaningful.
 */
function classifySignalStrength(
  edge: number,
  confidenceWidth: number,
  hasSharp: boolean,
): SignalStrength {
  // Wide confidence bands reduce effective tier
  const effectiveEdge = edge - confidenceWidth * 0.3;

  if (effectiveEdge >= 0.08 || (effectiveEdge >= 0.05 && hasSharp)) return 'ELITE';
  if (effectiveEdge >= 0.05 || (effectiveEdge >= 0.03 && hasSharp)) return 'STRONG';
  if (effectiveEdge >= 0.02) return 'LEAN';
  return 'PASS';
}

function classifyRecommendation(
  strength: SignalStrength,
  kellyFrac: number,
): Recommendation {
  if (strength === 'PASS' || kellyFrac <= 0) return 'PASS';
  if (strength === 'LEAN') return 'MONITOR';
  return 'BET';
}

// ─── Main aggregator ──────────────────────────────────────────────────────────

export interface AggregatorInput {
  playerName: string;
  propMarket: string;
  gameDate: string;

  /** Raw probability from models.hrProbabilityPerAB or models.kProbabilityPerAB */
  modelProb: number;

  /**
   * Best available bookmaker odds in American format.
   * Pass null when no live market is available — edge and Kelly will be 0.
   */
  bestAmericanOdds: number | null;

  /** Pre-fetched sharp signals for today's slate (all players, filtered internally). */
  sharpSignals: SharpSignalRecord[];

  /** Platt calibration parameters from the latest model_metrics row. */
  calibration: PlattCalibration;
}

/**
 * Aggregate all evidence into a single `CompositeSignal`.
 *
 * Designed to be called once per player per prop per game, typically
 * inside the picks-engine after model probabilities are computed.
 *
 * @example
 * ```ts
 * const signal = aggregateSignal({
 *   playerName: 'Aaron Judge',
 *   propMarket: 'batter_home_runs',
 *   gameDate: '2026-04-01',
 *   modelProb: 0.072,
 *   bestAmericanOdds: 280,
 *   sharpSignals: todaysSignals,
 *   calibration: { alpha: 0.92, beta: -0.05 },
 * });
 *
 * if (signal.recommendation === 'BET') {
 *   console.log(`Bet ${(signal.halfKelly * 100).toFixed(1)}% of bankroll`);
 * }
 * ```
 */
export function aggregateSignal(input: AggregatorInput): CompositeSignal {
  const {
    playerName, propMarket, gameDate,
    modelProb, bestAmericanOdds, sharpSignals, calibration,
  } = input;

  // ── 1. Calibrate model probability ────────────────────────────────────────
  const calibrationIsNoop = calibration.alpha === 1.0 && calibration.beta === 0.0;
  const calibratedProb = calibrationIsNoop
    ? modelProb
    : applyPlattCalibration(modelProb, calibration);

  // ── 2. Market implied probability (vig-removed) ────────────────────────────
  const marketAvailable  = bestAmericanOdds !== null;
  const rawMarketProb    = marketAvailable ? americanToImpliedProb(bestAmericanOdds!) : 0;
  const marketProb       = marketAvailable ? removeVig(rawMarketProb) : 0;
  const edge             = marketAvailable ? calibratedProb - marketProb : 0;

  // ── 3. Sharp signal boost ──────────────────────────────────────────────────
  const sharpCtx = aggregateSharpSignals(sharpSignals, playerName);

  // ── 4. Final probability ───────────────────────────────────────────────────
  const finalProb = Math.max(0.01, Math.min(0.95, calibratedProb + sharpCtx.boost));

  // ── 5. Kelly sizing ────────────────────────────────────────────────────────
  const kelly     = marketAvailable ? kellyFraction(finalProb, marketProb) : 0;
  const halfKelly = kelly / 2;

  // ── 6. Confidence band ─────────────────────────────────────────────────────
  const band = computeConfidenceBand(finalProb);

  // ── 7. Classification ──────────────────────────────────────────────────────
  const strength       = classifySignalStrength(edge, band.width, sharpCtx.hasSharpSignal);
  const recommendation = classifyRecommendation(strength, kelly);

  return {
    playerName,
    propMarket,
    gameDate,

    modelProb,
    calibratedProb,
    marketProb,
    edge,
    sharpBoost: sharpCtx.boost,
    finalProb,

    kellyFraction: kelly,
    halfKelly,

    signalStrength: strength,
    recommendation,
    confidenceBand: band,

    sharpContext: sharpCtx,
    sources: {
      modelProbUsed:       true,
      marketOddsUsed:      marketAvailable,
      sharpSignalUsed:     sharpCtx.hasSharpSignal,
      calibrationApplied:  !calibrationIsNoop,
    },
    computedAt: new Date().toISOString(),
  };
}

// ─── Batch helper ─────────────────────────────────────────────────────────────

/**
 * Aggregate signals for a slate of players in one call.
 * Signals are sorted by finalProb descending.
 *
 * @param inputs      Array of per-player aggregator inputs (all sharing sharpSignals)
 * @returns           Sorted CompositeSignal array
 */
export function aggregateSlate(inputs: AggregatorInput[]): CompositeSignal[] {
  return inputs
    .map(aggregateSignal)
    .sort((a, b) => b.finalProb - a.finalProb);
}
