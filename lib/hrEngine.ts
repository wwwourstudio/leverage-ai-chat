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

import { kellyFraction } from '@/lib/kelly/index';

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

export interface HRBetOpportunity {
  prob: number;
  odds: number;
  correlationGroup: string;  // e.g. 'NYY-vs-BOS' — same-game props share a group
}

export interface KellyBetResult {
  rawKellyFraction: number;  // full Kelly output (0–1)
  stake: number;             // dollars at recommended bankroll fraction
  cappedAt2Pct: boolean;     // true if Kelly was capped at 2% max position
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
export function hrProbability(f: HRFeatures): number {
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
export function bayesianHRProb(modelProb: number, sampleSize: number): number {
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

// ---------------------------------------------------------------------------
// Odds + edge
// ---------------------------------------------------------------------------

/**
 * Convert a probability to fair American moneyline odds.
 *  p ≥ 0.5 → negative (favourite)
 *  p < 0.5 → positive (underdog)
 */
export function fairAmericanOdds(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  if (p >= 0.5) {
    return -Math.round((p / (1 - p)) * 100);
  }
  return Math.round(((1 - p) / p) * 100);
}

/**
 * Convert American odds to implied probability (no vig).
 */
export function impliedProbability(americanOdds: number): number {
  if (americanOdds > 0) return 100 / (americanOdds + 100);
  return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

/**
 * Model edge = model probability − market implied probability.
 * Positive edge = model believes the bet has positive expected value.
 */
export function hrEdge(modelProb: number, marketOdds: number): number {
  return modelProb - impliedProbability(marketOdds);
}

// ---------------------------------------------------------------------------
// Correlation-adjusted Kelly allocator
// ---------------------------------------------------------------------------

/**
 * Compute Kelly fractions for a portfolio of HR prop bets, discounted by
 * pairwise correlation among same-game bets.
 *
 * Algorithm:
 *  1. Compute raw Kelly for each bet via kellyFraction() (lib/kelly/index.ts).
 *  2. For each bet i, subtract a correlation penalty:
 *       penalty_i = Σ_j (rawKelly_j * correlation_ij)  for j ≠ i
 *  3. Clamp each adjusted fraction to [0, 0.02] (max 2% bankroll per bet).
 *
 * @param bets               Array of betting opportunities
 * @param correlationMatrix  Square matrix where entry [i][j] ∈ [0,1]
 *                           represents correlation between bets i and j.
 *                           Same-game props typically use 0.25–0.45.
 * @param bankroll           Total bankroll in dollars
 */
export function correlationAdjustedKelly(
  bets: HRBetOpportunity[],
  correlationMatrix: number[][],
  bankroll: number,
): Array<{ bet: HRBetOpportunity; rawKellyFraction: number; stake: number; cappedAt2Pct: boolean }> {
  const MAX_FRACTION = 0.02; // 2% bankroll cap per bet

  const raw = bets.map(b => Math.max(0, kellyFraction(b.prob, b.odds)));

  return bets.map((bet, i) => {
    let penalty = 0;
    for (let j = 0; j < bets.length; j++) {
      if (j === i) continue;
      const corr = correlationMatrix[i]?.[j] ?? 0;
      penalty += raw[j] * corr;
    }

    const adjusted   = Math.max(0, raw[i] - penalty);
    const capped     = Math.min(adjusted, MAX_FRACTION);
    const stake      = Math.round(bankroll * capped * 100) / 100;

    return {
      bet,
      rawKellyFraction: parseFloat(raw[i].toFixed(4)),
      stake,
      cappedAt2Pct: adjusted > MAX_FRACTION,
    };
  });
}

// ---------------------------------------------------------------------------
// Convenience: build a default correlation matrix for a set of bets
// ---------------------------------------------------------------------------

/**
 * Build a correlation matrix using same-group correlation for pairs of bets
 * sharing a correlationGroup (e.g. same game), and near-zero correlation for
 * bets from different groups.
 *
 * @param bets             Bet array
 * @param intraCorrelation Correlation for bets in the same group (default 0.35)
 * @param interCorrelation Correlation for bets in different groups (default 0.05)
 */
export function buildCorrelationMatrix(
  bets: HRBetOpportunity[],
  intraCorrelation = 0.35,
  interCorrelation = 0.05,
): number[][] {
  return bets.map((b1, i) =>
    bets.map((b2, j) => {
      if (i === j) return 1;
      return b1.correlationGroup === b2.correlationGroup
        ? intraCorrelation
        : interCorrelation;
    })
  );
}
