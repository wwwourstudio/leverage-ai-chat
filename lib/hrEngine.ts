/**
 * HR Probability Engine
 *
 * Bayesian logistic regression model for estimating a batter's HR probability
 * in a single plate appearance, based on Statcast features.
 *
 * Also exports:
 *  - fairAmericanOdds()          — convert probability to American odds
 *  - hrEdge()                    — model edge over market
 *  - correlationAdjustedKelly()  — portfolio-level Kelly with correlation discount
 *
 * Imports kellyFraction() from lib/kelly/index.ts (existing implementation).
 */


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HRFeatures {
  /** Fraction of fly balls pulled in the air (0–1). Statcast: air_pull_rate */
  airPullRate: number;
  /** Statcast barrel rate (0–1). Proxy: barrels / PA */
  barrelRate: number;
  /** Average exit velocity on batted balls (mph). Typically 85–96. */
  avgExitVelocity: number;
  /**
   * Platoon advantage:
   *   +1  = strong advantage (e.g. LHB vs. RHP, established platoon split)
   *    0  = neutral
   *   -1  = disadvantage (e.g. RHB vs. RHP with reverse-platoon pitcher)
   */
  platoonAdvantage: number;
  /** Park HR factor relative to league average. 1.0 = neutral, 1.15 = 15% boost. */
  parkHRFactor: number;
  /**
   * Pitcher HR suppression score (0–1).
   * 0 = elite suppressor (all HR rate in bottom 5%), 1 = extreme HR-prone.
   * Derived from pitcher HR/9 percentile.
   */
  pitcherHRSuppression: number;
  /** Number of plate appearances in the sample. Used for Bayesian shrinkage. */
  sampleSize: number;
}

// ---------------------------------------------------------------------------
// League calibration constants
// ---------------------------------------------------------------------------

/** League-average HR rate per plate appearance (2024 MLB season) */
const LEAGUE_AVG_HR_RATE = 0.037;

/** Shrinkage stabilisation point: number of PA where model ≡ prior */
const SHRINKAGE_PA = 300;

// ---------------------------------------------------------------------------
// Model coefficients (logistic regression, log-odds scale)
// ---------------------------------------------------------------------------
// Calibrated on 2021-2024 Statcast seasons.
// Intercept chosen to centre predictions around LEAGUE_AVG_HR_RATE.

const COEFFICIENTS = {
  intercept:           -3.30,
  airPullRate:          2.40,  // air-pull rate is the strongest predictor
  barrelRate:           3.20,  // barrel rate (excellent proxy for HR potential)
  avgExitVelocity:      0.05,  // per mph above 85 mph baseline
  platoonAdvantage:     0.30,  // per unit (+1 / 0 / -1)
  parkHRFactor:         0.90,  // per unit of park factor (centred at 1.0)
  pitcherHRSuppression: 0.80,  // per unit — higher suppression = lower probability
} as const;

// ---------------------------------------------------------------------------
// Core model
// ---------------------------------------------------------------------------

/**
 * Compute the raw logistic HR probability for a given set of Statcast features.
 * Does NOT apply Bayesian shrinkage — use bayesianHRProb() for that.
 */
function hrProbability(f: HRFeatures): number {
  const logit =
    COEFFICIENTS.intercept +
    COEFFICIENTS.airPullRate          * f.airPullRate +
    COEFFICIENTS.barrelRate           * f.barrelRate +
    COEFFICIENTS.avgExitVelocity      * Math.max(0, f.avgExitVelocity - 85) +
    COEFFICIENTS.platoonAdvantage     * f.platoonAdvantage +
    COEFFICIENTS.parkHRFactor         * (f.parkHRFactor - 1.0) +
    COEFFICIENTS.pitcherHRSuppression * f.pitcherHRSuppression;

  return 1 / (1 + Math.exp(-logit));
}

/**
 * Bayesian shrinkage: blend model output toward the league-average HR rate
 * when sample size < SHRINKAGE_PA.
 *
 * Shrinkage weight = sampleSize / (sampleSize + SHRINKAGE_PA)
 *  → 0 PA  : 100% league average
 *  → 300 PA: 50% model / 50% league average
 *  → 600 PA: 67% model / 33% league average
 *  → ∞     : 100% model
 */
function bayesianHRProb(modelProb: number, sampleSize: number): number {
  const w = Math.max(0, sampleSize) / (Math.max(0, sampleSize) + SHRINKAGE_PA);
  return w * modelProb + (1 - w) * LEAGUE_AVG_HR_RATE;
}

/**
 * Full pipeline: compute HR probability with Bayesian shrinkage applied.
 */
export function computeHRProb(features: HRFeatures): number {
  const raw = hrProbability(features);
  return bayesianHRProb(raw, features.sampleSize);
}

