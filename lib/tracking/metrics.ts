/**
 * Model Accuracy Metrics
 *
 * Computes calibration quality metrics over a set of settled pick_results rows.
 * These metrics drive the daily training / calibration loop.
 */

export interface PickResultRow {
  predicted_prob: number;
  actual_result: boolean | null; // null = unsettled (excluded from calculations)
  odds?: number | null;          // American odds
  tier?: string | null;
  pnl?: number | null;
}

export interface AccuracyMetrics {
  sampleSize: number;
  accuracy: number;       // fraction of correct directional predictions
  brierScore: number;     // mean squared error of probability calibration (lower = better)
  logLoss: number;        // log-loss (cross-entropy) — lower = better
  calibrationAlpha: number; // ratio of mean predicted prob to hit rate (1.0 = perfect)
}

export interface TierBreakdown {
  elite: { count: number; hits: number; accuracy: number };
  strong: { count: number; hits: number; accuracy: number };
  lean: { count: number; hits: number; accuracy: number };
}

/**
 * Compute accuracy, Brier score, log-loss and calibration factor.
 * Ignores rows where actual_result is null (unsettled picks).
 */
export function calculateAccuracy(results: PickResultRow[]): AccuracyMetrics {
  const settled = results.filter((r) => r.actual_result !== null && r.actual_result !== undefined);

  if (settled.length === 0) {
    return { sampleSize: 0, accuracy: 0, brierScore: 0, logLoss: 0, calibrationAlpha: 1 };
  }

  const correct = settled.filter((r) => r.actual_result === true).length;
  const accuracy = correct / settled.length;

  // Brier score: MSE of probability forecasts vs binary outcomes
  const brierScore =
    settled.reduce((sum, r) => {
      const outcome = r.actual_result ? 1 : 0;
      return sum + Math.pow(r.predicted_prob - outcome, 2);
    }, 0) / settled.length;

  // Log-loss (cross-entropy) — penalises overconfident wrong predictions heavily
  const EPS = 1e-7; // avoid log(0)
  const logLoss =
    -settled.reduce((sum, r) => {
      const p = Math.max(EPS, Math.min(1 - EPS, r.predicted_prob));
      const outcome = r.actual_result ? 1 : 0;
      return sum + (outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p));
    }, 0) / settled.length;

  // Calibration alpha: mean predicted prob / empirical hit rate
  // alpha > 1 → model is over-confident; alpha < 1 → under-confident
  const meanPredicted = settled.reduce((s, r) => s + r.predicted_prob, 0) / settled.length;
  const hitRate = accuracy; // same as empirical hit rate for binary
  const calibrationAlpha = hitRate > 0 ? meanPredicted / hitRate : 1;

  return {
    sampleSize: settled.length,
    accuracy: parseFloat(accuracy.toFixed(4)),
    brierScore: parseFloat(brierScore.toFixed(6)),
    logLoss: parseFloat(logLoss.toFixed(6)),
    calibrationAlpha: parseFloat(calibrationAlpha.toFixed(6)),
  };
}

/**
 * Brier score only (kept as standalone for quick checks).
 */
export function calculateBrierScore(results: PickResultRow[]): number {
  const settled = results.filter((r) => r.actual_result !== null);
  if (settled.length === 0) return 0;

  return (
    settled.reduce((sum, r) => {
      const outcome = r.actual_result ? 1 : 0;
      return sum + Math.pow(r.predicted_prob - outcome, 2);
    }, 0) / settled.length
  );
}

/**
 * Break down accuracy per betting tier (ELITE / STRONG / LEAN).
 */
export function calculateTierBreakdown(results: PickResultRow[]): TierBreakdown {
  const settled = results.filter((r) => r.actual_result !== null);

  const byTier = (tierName: string) => {
    const rows = settled.filter(
      (r) => (r.tier ?? '').toUpperCase() === tierName,
    );
    const hits = rows.filter((r) => r.actual_result === true).length;
    return {
      count: rows.length,
      hits,
      accuracy: rows.length > 0 ? parseFloat((hits / rows.length).toFixed(4)) : 0,
    };
  };

  return {
    elite: byTier('ELITE'),
    strong: byTier('STRONG'),
    lean: byTier('LEAN'),
  };
}
