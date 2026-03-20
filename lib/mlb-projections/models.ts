/**
 * LeverageMetrics MLB Prediction Models
 *
 * HR Super Model (12 variables) — P(HR | at-bat)
 * Strikeout Model (7 variables) — P(K | at-bat)
 * Pitcher Breakout Score (8 biomechanics variables) — 0–100
 *
 * ─── Architecture ────────────────────────────────────────────────────────────
 * All coefficients live in model-config.ts as the `DEFAULT_MODEL_CONFIG` object.
 * Every public function accepts an optional `config` parameter so the backtester
 * and picks-engine can inject a calibrated weight vector without touching this file.
 *
 * Calibration is applied via Platt scaling in logit space:
 *   calibratedLogit = config.hrCalibration.alpha × rawLogit + config.hrCalibration.beta
 *
 * At alpha=1.0 / beta=0.0 (the defaults) the behaviour is identical to the
 * original hard-coded implementation — no breaking changes.
 *
 * ─── Sources ─────────────────────────────────────────────────────────────────
 * Barrel rate → HR correlation: r ≈ 0.82 (Baseball Prospectus 2023)
 * EV → HR correlation: r ≈ 0.70
 * xwOBA → run production: r ≈ 0.91
 */

import type { HitterFeatures, PitcherFeatures, BiomechanicsFeatures } from './feature-engineering';
import { DEFAULT_MODEL_CONFIG } from './model-config';
import type { ModelConfig } from './model-config';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeToRange(value: number, min: number, max: number): number {
  return clamp((value - min) / (max - min), 0, 1);
}

// ─── HR Super Model ───────────────────────────────────────────────────────────

/**
 * Compute P(HR) per at-bat using the 12-variable logistic model.
 *
 * MLB average HR/AB ≈ 0.035 (≈1 HR per 28 AB).
 * Elite sluggers land at 0.065–0.090.
 *
 * @param f    Hitter feature vector (from buildHitterFeatures)
 * @param config  Optional calibrated weight vector — defaults to research-derived baseline
 */
export function hrProbabilityPerAB(
  f: HitterFeatures,
  config: ModelConfig = DEFAULT_MODEL_CONFIG,
): number {
  const w = config.hr;

  // Normalised inputs (z-scores and scaled deviations)
  const evZ     = (f.exitVelocity - 88) / 4;        // league avg ≈ 88 mph, σ ≈ 4
  const xwOBAZ  = (f.xwOBA - 0.315) / 0.060;        // league avg ≈ 0.315, σ ≈ 0.060

  const rawLogit =
    w.intercept +
    w.barrelPct          * f.barrelPct +
    w.exitVelocityNorm   * evZ * 4 +
    w.launchAngle        * f.launchAngle +
    w.iso                * f.iso +
    w.hrFbRatio          * f.hrFbRatio * 10 +
    w.parkFactor         * (f.parkFactor - 1.0) * 10 +
    w.weatherAdjustment  * f.weatherAdjustment * 10 +
    w.platoonAdvantage   * f.platoonAdvantage * 10 +
    w.xwOBANorm          * xwOBAZ * 4 +
    w.umpireZone         * f.umpireZoneTendency * 10 +
    w.pullPowerScore     * f.pullPowerScore / 10;

  // Platt scaling in logit space
  const cal = config.hrCalibration;
  const calibratedLogit = cal.alpha * rawLogit + cal.beta;

  return clamp(sigmoid(calibratedLogit), config.clamps.hrMin, config.clamps.hrMax);
}

// ─── Strikeout Model ─────────────────────────────────────────────────────────

/**
 * Compute P(K) per at-bat for a pitcher using the 7-variable logistic model.
 * MLB average K/AB ≈ 0.225.
 *
 * @param f    Pitcher feature vector (from buildPitcherFeatures)
 * @param config  Optional calibrated weight vector
 */
export function kProbabilityPerAB(
  f: PitcherFeatures,
  config: ModelConfig = DEFAULT_MODEL_CONFIG,
): number {
  const w = config.k;

  const veloZ = (f.velocity - 93.5) / 3.5;  // league avg starter ≈ 93.5 mph

  const rawLogit =
    w.intercept +
    w.kPct               * f.kPct +
    w.velocityNorm       * veloZ * 3.5 +
    w.spinRate           * f.spinRate / 100 +
    w.bbPct              * f.bbPct +
    w.hrPer9             * f.hrPer9 / 10 +
    w.pitchMixEntropy    * f.pitchMixEntropy * 10 +
    w.releaseExtension   * f.releaseExtension;

  const cal = config.kCalibration;
  const calibratedLogit = cal.alpha * rawLogit + cal.beta;

  return clamp(sigmoid(calibratedLogit), config.clamps.kMin, config.clamps.kMax);
}

// ─── Pitcher Breakout Score ───────────────────────────────────────────────────

/**
 * Compute a 0–100 breakout score for a pitcher based on 8 biomechanics variables.
 *
 * Interpretation:
 *   >70 — strong breakout candidate (velocity spike, elite spin, clean mechanics)
 *   50–70 — moderate upside signal
 *   <50 — stable / no notable breakout indicator
 *
 * This score is intentionally NOT subject to Platt calibration because it is
 * an ordinal index, not a probability estimate.
 */
export function pitcherBreakoutScore(bio: BiomechanicsFeatures): number {
  const score =
    10 * normalizeToRange(bio.velocityTrend, -1, 1) +
    12 * bio.spinEfficiency / 100 +
    15 * bio.kineticChainScore +
    10 * bio.armSlotConsistency +
    8  * bio.strideLength +
    12 * bio.hipShoulderSeparation +
    8  * bio.releaseHeight +
    15 * bio.movementScore;

  return Math.round(clamp(score, 0, 100));
}

// ─── Projected counting stats ─────────────────────────────────────────────────

export interface HitterProjectedStats {
  /** P(HR) per at-bat from the 12-variable model. */
  hrPerAB: number;
  /** P(at least 1 HR in 4 AB) = 1 − (1 − hrPerAB)^4 */
  hrPerGame: number;
  /** P(hit) per AB — xBA-derived proxy. */
  hitProb: number;
  /** P(RBI) per AB — HR-driven plus runners-in-scoring-position estimate. */
  rbiProb: number;
  /** P(run scored) per AB. */
  runProb: number;
  /** P(SB) per game — speed proxy from pull% (low correlation; placeholder). */
  sbProb: number;
  /** P(K) per AB — batter's strikeout rate from barrel bucket. */
  kProb: number;
  /** P(BB) per PA — league average used when no batter walk-rate feature available. */
  bbProb: number;
}

/**
 * Convert hitter features into per-AB / per-game probabilities for the Monte Carlo engine.
 *
 * @param f       Hitter feature vector
 * @param config  Optional calibrated model config
 */
export function computeHitterProbs(
  f: HitterFeatures,
  config: ModelConfig = DEFAULT_MODEL_CONFIG,
): HitterProjectedStats {
  const hrPerAB = hrProbabilityPerAB(f, config);
  return {
    hrPerAB,
    hrPerGame:  1 - Math.pow(1 - hrPerAB, 4),
    hitProb:    Math.min(0.38, f.xwOBA * 0.85),
    rbiProb:    hrPerAB * 1.8 + 0.04,
    runProb:    hrPerAB * 0.9 + f.xwOBA * 0.15,
    sbProb:     Math.min(0.15, f.pullPct / 400),
    // High-barrel hitters make harder contact → fewer Ks on average
    kProb:      Math.min(0.40, f.barrelPct < 12 ? 0.26 : 0.22),
    bbProb:     0.085,
  };
}

export interface PitcherProjectedStats {
  /** P(K) per at-bat from the 7-variable model. */
  kPerAB: number;
  /** Strikeouts per inning = kPerAB × 3. */
  kPerInning: number;
  /** Strikeouts per 9 innings. */
  ksPer9: number;
  /** Derived WHIP from K%, BB%, HR/9. */
  whip: number;
  /** Estimated ERA for the start. */
  eraPitched: number;
  /** P(quality start → win) above 0.500 baseline. */
  winProbAbove500: number;
}

/**
 * Convert pitcher features into per-inning projected stats for Monte Carlo.
 *
 * @param f       Pitcher feature vector
 * @param config  Optional calibrated model config
 */
export function computePitcherProbs(
  f: PitcherFeatures,
  config: ModelConfig = DEFAULT_MODEL_CONFIG,
): PitcherProjectedStats {
  const kPerAB   = kProbabilityPerAB(f, config);
  const ksPer9   = kPerAB * 27;
  const walksPer9 = (f.bbPct / 100) * 27;
  const hitsPer9  = Math.max(5, 9 - ksPer9 * 0.6);
  const whip      = (walksPer9 + hitsPer9) / 9;
  const eraPitched = f.hrPer9 * 1.4 + walksPer9 * 0.32 + hitsPer9 * 0.26;
  const winProbAbove500 = clamp(
    0.5 + (ksPer9 - 8.5) * 0.04 - (eraPitched - 4.0) * 0.05,
    0.1,
    0.8,
  );

  return {
    kPerAB,
    kPerInning: kPerAB * 3,
    ksPer9,
    whip,
    eraPitched,
    winProbAbove500,
  };
}
