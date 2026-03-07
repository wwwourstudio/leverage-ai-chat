/**
 * LeverageMetrics MLB Prediction Models
 *
 * HR Super Model (12 variables) — P(HR | at-bat)
 * Strikeout Model (7 variables) — P(K | at-bat)
 * Pitcher Breakout Score (8 biomechanics variables) — 0–100
 *
 * Coefficients derived from published baseball research:
 * - Barrel rate → HR correlation: r ≈ 0.82 (Baseball Prospectus 2023)
 * - EV → HR correlation: r ≈ 0.70
 * - xwOBA → run production: r ≈ 0.91
 */

import type { HitterFeatures, PitcherFeatures, BiomechanicsFeatures } from './feature-engineering';

// ─── Sigmoid helper ───────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ─── HR Super Model ───────────────────────────────────────────────────────────

/**
 * Compute P(HR) per at-bat using the 12-variable logistic model.
 *
 * MLB average HR/AB ≈ 0.035 (roughly 1 HR per 28 AB).
 * Elite sluggers at 0.065–0.090.
 */
export function hrProbabilityPerAB(f: HitterFeatures): number {
  // Normalize EV: league avg ~88 mph → z-score ≈ (ev - 88) / 4
  const evZ = (f.exitVelocity - 88) / 4;
  // Normalize xwOBA: league avg ~0.315 → z-score
  const xwOBAZ = (f.xwOBA - 0.315) / 0.060;

  const logit =
    -4.20 +
    0.080 * f.barrelPct +          // Barrel rate (most predictive, r=0.82)
    0.035 * evZ * 4 +              // Exit velocity (de-normalized for coefficient fit)
    0.015 * f.launchAngle +        // Launch angle (optimal ~15–30°)
    1.200 * f.iso +                // Isolated power
    0.900 * f.hrFbRatio * 10 +    // HR/FB ratio (scaled ×10)
    0.400 * (f.parkFactor - 1.0) * 10 + // Park factor deviation from neutral
    0.300 * f.weatherAdjustment * 10 +  // Weather (scaled)
    0.200 * f.platoonAdvantage * 10 +   // Platoon advantage
    0.015 * xwOBAZ * 4 +          // xwOBA z-score
    0.100 * f.umpireZoneTendency * 10 + // Umpire zone (future enrichment)
    0.060 * f.pullPowerScore / 10;      // Pull power composite

  const prob = sigmoid(logit);

  // Bayesian shrinkage toward MLB avg (0.035) — already applied in feature engineering
  // Clamp to reasonable range [0.01, 0.12]
  return Math.max(0.01, Math.min(0.12, prob));
}

// ─── Strikeout Model ─────────────────────────────────────────────────────────

/**
 * Compute P(K) per at-bat for a pitcher using 7-variable logistic model.
 * MLB average K/AB ≈ 0.225.
 */
export function kProbabilityPerAB(f: PitcherFeatures): number {
  // Normalize velocity: avg starter ~93.5 mph
  const veloZ = (f.velocity - 93.5) / 3.5;

  const logit =
    -1.10 +
    0.050 * f.kPct +               // Pitcher K rate (most direct predictor)
    0.030 * veloZ * 3.5 +          // Fastball velocity
    0.010 * f.spinRate / 100 +     // Spin rate (scaled)
    -0.030 * f.bbPct +             // BB rate (correlation with K rate)
    -0.800 * f.hrPer9 / 10 +       // HR suppression (better pitchers)
    0.040 * f.pitchMixEntropy * 10 + // Pitch mix deception
    0.030 * f.releaseExtension;    // Extension (closer release = harder to time)

  const prob = sigmoid(logit);
  return Math.max(0.10, Math.min(0.45, prob));
}

// ─── Pitcher Breakout Score ───────────────────────────────────────────────────

/**
 * Compute a 0–100 breakout score for a pitcher based on 8 biomechanics variables.
 * Score > 70 = strong breakout candidate for current/upcoming season.
 * Score 50–70 = moderate upside.
 * Score < 50 = stable / no breakout signal.
 */
export function pitcherBreakoutScore(bio: BiomechanicsFeatures): number {
  const score =
    10 * normalizeToRange(bio.velocityTrend, -1, 1) +      // Velocity trend (0–10)
    12 * bio.spinEfficiency / 100 +                          // Spin efficiency (0–12)
    15 * bio.kineticChainScore +                             // Kinetic chain (0–15)
    10 * bio.armSlotConsistency +                            // Arm slot (0–10)
    8  * bio.strideLength +                                  // Stride (0–8)
    12 * bio.hipShoulderSeparation +                         // Hip-shoulder sep (0–12)
    8  * bio.releaseHeight +                                 // Release height (0–8)
    15 * bio.movementScore;                                  // Movement (0–15)

  return Math.round(Math.max(0, Math.min(100, score)));
}

function normalizeToRange(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// ─── Projected counting stats ─────────────────────────────────────────────────

export interface HitterProjectedStats {
  hrPerAB: number;
  hrPerGame: number;   // 1 - (1 - hrPerAB)^4
  hitProb: number;     // P(hit) per AB (xBA-derived)
  rbiProb: number;     // P(RBI) per AB
  runProb: number;     // P(run scored) per AB
  sbProb: number;      // P(SB) per game (estimated)
  kProb: number;       // P(K) per AB (hitter's K rate)
  bbProb: number;      // P(BB) per PA
}

/** Convert hitter Statcast stats + park/weather to per-AB probabilities for Monte Carlo */
export function computeHitterProbs(f: HitterFeatures): HitterProjectedStats {
  const hrPerAB = hrProbabilityPerAB(f);
  return {
    hrPerAB,
    hrPerGame:   1 - Math.pow(1 - hrPerAB, 4),  // Binomial: at least 1 HR in 4 AB
    hitProb:     Math.min(0.38, f.xwOBA * 0.85), // xwOBA → hit probability proxy
    rbiProb:     hrPerAB * 1.8 + 0.04,           // HRs plus RISP situations
    runProb:     hrPerAB * 0.9 + f.xwOBA * 0.15,
    sbProb:      Math.min(0.15, f.pullPct / 400), // Speed proxy from pull% (low correlation)
    kProb:       Math.min(0.40, f.barrelPct < 12 ? 0.26 : 0.22), // High barrel = lower K rate
    bbProb:      0.085,                           // MLB avg ~8.5%
  };
}

export interface PitcherProjectedStats {
  kPerAB: number;
  kPerInning: number;  // kPerAB × 3
  ksPer9: number;
  whip: number;        // Derived from K%, BB%, HR/9
  eraPitched: number;  // Estimated ERA
  winProbAbove500: number; // P(quality start → win)
}

/** Convert pitcher features to per-inning projected stats */
export function computePitcherProbs(f: PitcherFeatures): PitcherProjectedStats {
  const kPerAB = kProbabilityPerAB(f);
  const ksPer9 = kPerAB * 27;
  // Simplified WHIP: (BB_rate × 0.3 + H_rate × 0.7) per inning
  const walksPer9 = (f.bbPct / 100) * 27;
  const hitsPer9  = Math.max(5, 9 - ksPer9 * 0.6);
  const whip = (walksPer9 + hitsPer9) / 9;
  const eraPitched = f.hrPer9 * 1.4 + walksPer9 * 0.32 + hitsPer9 * 0.26;
  const winProbAbove500 = Math.max(0.1, Math.min(0.8, 0.5 + (ksPer9 - 8.5) * 0.04 - (eraPitched - 4.0) * 0.05));

  return {
    kPerAB,
    kPerInning: kPerAB * 3,
    ksPer9,
    whip,
    eraPitched,
    winProbAbove500,
  };
}
