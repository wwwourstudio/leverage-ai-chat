/**
 * LeverageMetrics MLB Model Configuration
 *
 * Centralises every model coefficient and threshold in one typed object.
 * This separation from inference code (models.ts) enables:
 *
 *   1. Calibration without redeployment — the backtester writes corrections
 *      to Supabase; picks-engine reads them at runtime and passes an
 *      overridden config to hrProbabilityPerAB / kProbabilityPerAB.
 *
 *   2. A/B testing — swap a full ModelConfig object to run two weight
 *      vectors side-by-side and compare Brier scores.
 *
 *   3. Readable documentation — every coefficient lives next to its note
 *      explaining the source, scale, and expected contribution.
 *
 * ─── Platt scaling ───────────────────────────────────────────────────────────
 * Both logistic models output raw sigmoid probabilities that may be
 * systematically over- or under-confident.  After calibration the backtester
 * stores two correction parameters per model:
 *
 *   calibratedLogit = alpha × rawLogit + beta
 *
 * where alpha and beta are estimated by regressing predicted vs. actual on
 * the 30–60 day pick_results window.  Defaults are 1.0 / 0.0 (no-op).
 */

// ─── HR Super Model (12 variables) ──────────────────────────────────────────

/**
 * Coefficients for the HR-per-AB logistic model.
 * All inputs are described in their natural scale; scaling notes indicate
 * the transform applied inside models.ts before multiplying the coefficient.
 */
export interface HRModelWeights {
  /** Logit intercept — sets the baseline HR/AB at league-average inputs (~0.035). */
  intercept: number;

  /** Barrel rate (%) — most predictive single factor (r ≈ 0.82, Baseball Prospectus 2023). Input in raw %. */
  barrelPct: number;

  /** Exit velocity — applied to z-score = (EV − 88) / 4; coefficient then scaled ×4. MLB avg ≈ 88 mph. */
  exitVelocityNorm: number;

  /** Launch angle (°) — optimal HR window 15–30°. Linear term; steeper angles reduce carry. */
  launchAngle: number;

  /** Isolated Power (SLG − AVG) — captures extra-base hit power directly. */
  iso: number;

  /**
   * HR/FB ratio — fraction of fly balls that become HRs.
   * Input scaled ×10 before applying coefficient (typical range 0.05–0.25 → 0.5–2.5).
   */
  hrFbRatio: number;

  /**
   * Park factor deviation from neutral (1.0).
   * Applied as (parkFactor − 1.0) × 10 so Coors (+0.22) → +2.2, Petco (−0.15) → −1.5.
   */
  parkFactor: number;

  /**
   * Weather adjustment composite (temp + wind).
   * Computed by feature-engineering.ts; scaled ×10 before coefficient.
   * Typical range: −0.10 (cold/wind-in) to +0.15 (hot/wind-out).
   */
  weatherAdjustment: number;

  /**
   * Platoon advantage: L-vs-R = +0.08, same-hand = −0.03, switch = +0.04.
   * Scaled ×10 before coefficient.
   */
  platoonAdvantage: number;

  /** xwOBA — expected weighted on-base average; z-score = (xwOBA − 0.315) / 0.060 × 4. */
  xwOBANorm: number;

  /**
   * Umpire zone tendency: fraction of called strikes outside zone (strike-zone expansion).
   * Scaled ×10. Placeholder pending umpire dataset enrichment.
   */
  umpireZone: number;

  /**
   * Pull-power composite score (pull% × EV). High pull% + high EV → short porch advantage.
   * Input divided by 10 before coefficient.
   */
  pullPowerScore: number;
}

// ─── Strikeout Model (7 variables) ──────────────────────────────────────────

export interface KModelWeights {
  /** Logit intercept — baseline K/AB at MLB average pitcher inputs (~0.225). */
  intercept: number;

  /** Pitcher K% (% of batters struck out) — most direct predictor. Input in raw %. */
  kPct: number;

  /** Fastball velocity — z-score = (velo − 93.5) / 3.5; coefficient ×3.5. */
  velocityNorm: number;

  /** Spin rate (RPM) — higher spin = more movement. Input divided by 100. */
  spinRate: number;

  /** BB% — negative coefficient: high-walk pitchers tend to nibble, suppressing Ks. */
  bbPct: number;

  /**
   * HR/9 — negative coefficient: HR-prone pitchers give up solid contact,
   * which correlates with fewer Ks. Input divided by 10.
   */
  hrPer9: number;

  /**
   * Pitch-mix entropy — Shannon entropy of pitch usage fractions.
   * Higher entropy = harder to time. Input scaled ×10.
   */
  pitchMixEntropy: number;

  /**
   * Release extension (ft from rubber) — longer extension shortens batter's
   * reaction time; ~5.5–7.5 ft range. No scaling.
   */
  releaseExtension: number;
}

// ─── Calibration (Platt scaling) ────────────────────────────────────────────

/**
 * Platt-scaling parameters for one model.
 *
 * Applied in logit space: calibratedLogit = alpha × rawLogit + beta
 * then re-passed through sigmoid.
 *
 * alpha > 1 → spreads probabilities (confidence amplifier)
 * alpha < 1 → compresses probabilities toward 0.5 (confidence deflator)
 * beta > 0  → shifts all probs upward (useful when model is systematically low)
 */
export interface PlattCalibration {
  alpha: number;  // default 1.0
  beta: number;   // default 0.0
}

// ─── Probability clamps ──────────────────────────────────────────────────────

export interface ProbabilityClamps {
  /** Minimum allowed HR/AB probability. Below this the model is unreliable. */
  hrMin: number;   // 0.01
  /** Maximum allowed HR/AB probability. Even elite sluggers rarely exceed 9–10%. */
  hrMax: number;   // 0.12
  /** Minimum allowed K/AB probability (below 10% is not observed in modern MLB). */
  kMin: number;    // 0.10
  /** Maximum allowed K/AB probability (above 45% is superhuman). */
  kMax: number;    // 0.45
}

// ─── Full config ─────────────────────────────────────────────────────────────

export interface ModelConfig {
  hr: HRModelWeights;
  k: KModelWeights;
  hrCalibration: PlattCalibration;
  kCalibration: PlattCalibration;
  clamps: ProbabilityClamps;
}

// ─── Default coefficients ────────────────────────────────────────────────────

/**
 * Baseline coefficients derived from published baseball research and
 * manually tuned to reproduce known MLB outcomes (season 2022–2024).
 *
 * These values are intentionally conservative — the Platt calibration
 * layer handles the last mile of accuracy once real pick_results accumulate.
 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  hr: {
    intercept:           -4.20,
    barrelPct:            0.080,
    exitVelocityNorm:     0.035,   // × z-score × 4
    launchAngle:          0.015,
    iso:                  1.200,
    hrFbRatio:            0.900,   // × ratio × 10
    parkFactor:           0.400,   // × (factor − 1) × 10
    weatherAdjustment:    0.300,   // × adj × 10
    platoonAdvantage:     0.200,   // × advantage × 10
    xwOBANorm:            0.015,   // × z-score × 4
    umpireZone:           0.100,   // × tendency × 10
    pullPowerScore:       0.060,   // × score / 10
  },

  k: {
    intercept:           -1.10,
    kPct:                 0.050,
    velocityNorm:         0.030,   // × z-score × 3.5
    spinRate:             0.010,   // × rpm / 100
    bbPct:               -0.030,
    hrPer9:              -0.800,   // × hr9 / 10
    pitchMixEntropy:      0.040,   // × entropy × 10
    releaseExtension:     0.030,
  },

  hrCalibration:  { alpha: 1.0, beta: 0.0 },
  kCalibration:   { alpha: 1.0, beta: 0.0 },

  clamps: {
    hrMin: 0.01,
    hrMax: 0.12,
    kMin:  0.10,
    kMax:  0.45,
  },
};
