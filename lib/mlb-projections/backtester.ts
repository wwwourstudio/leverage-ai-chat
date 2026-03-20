/**
 * LeverageMetrics Backtesting Framework
 *
 * Evaluates the HR prop model's historical performance by segmenting
 * settled pick_results across five dimensions and computing per-segment
 * accuracy metrics.  The output is a BacktestReport that the cron/backtest
 * route persists to Supabase and the picks-engine uses to load calibrated
 * Platt-scaling parameters at runtime.
 *
 * ─── Segmentation dimensions ─────────────────────────────────────────────────
 *   1. Tier          ELITE / STRONG / LEAN — does the model's confidence tiers
 *                    correspond to actual hit rates?
 *   2. Park bucket   High (≥1.10) / Neutral (0.92–1.09) / Suppressed (≤0.91)
 *   3. Platoon       L-vs-R / Same / Switch — are platoon adjustments accurate?
 *   4. EV bucket     High EV (≥92 mph) / Mid EV (88–91.9) / Low EV (<88)
 *   5. Weather       Hot+Wind-Out / Neutral / Cold+Wind-In
 *
 * ─── Metrics per segment ─────────────────────────────────────────────────────
 *   • sampleSize    Number of settled picks in segment
 *   • hitRate       Actual frequency of outcome = true
 *   • avgPredicted  Mean predicted probability in segment
 *   • brierScore    Mean squared error between predicted and actual
 *   • logLoss       Cross-entropy loss (punishes confident wrong predictions)
 *   • calibrationError  |avgPredicted − hitRate| — positive = overconfident
 *   • roi           Flat-unit P&L as % of total wagered (requires odds column)
 *
 * ─── Platt calibration estimation ────────────────────────────────────────────
 * After segmentation, the framework runs isotonic regression on the full
 * 30–90 day window to estimate the Platt-scaling (alpha, beta) that minimises
 * log-loss on the training set.  These are stored and applied by the model
 * on the next inference run.
 *
 * A pure TypeScript implementation is used (no external ML library) via
 * gradient descent on the log-loss objective over the logit space.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 * ```ts
 * const report = await runBacktest({ windowDays: 60, minSampleSize: 20 });
 * // report.calibration → { alpha, beta } to pass to aggregateSignal()
 * // report.segments    → per-segment diagnostics for the dashboard
 * ```
 */

// ─── Input types ─────────────────────────────────────────────────────────────

/** One settled pick as stored in the pick_results table. */
export interface PickResult {
  predicted_prob: number;     // Model probability at pick time (0–1)
  actual_result: boolean;     // true = HR happened, false = did not
  odds: number | null;        // Best American odds at pick time
  kelly_stake: number | null; // Fraction of bankroll wagered (Kelly-sized)
  tier: string | null;        // 'ELITE' | 'STRONG' | 'LEAN'
  pnl: number | null;         // Actual P&L in units (positive = profit)

  // ── Segmentation metadata (may be null for older picks) ───────────────────
  park_factor: number | null;         // Park factor at the venue
  platoon: string | null;             // 'L-vs-R' | 'Same' | 'Switch' | null
  exit_velocity_bucket: string | null; // 'High' | 'Mid' | 'Low' | null
  weather_bucket: string | null;      // 'Favorable' | 'Neutral' | 'Unfavorable' | null
}

export interface BacktestOptions {
  /** Number of calendar days to look back from today. Default: 60 */
  windowDays?: number;
  /** Minimum picks per segment to include in the report. Default: 10 */
  minSampleSize?: number;
  /** Whether to run Platt calibration estimation. Default: true */
  estimateCalibration?: boolean;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface SegmentMetrics {
  sampleSize: number;
  hitRate: number;
  avgPredicted: number;
  brierScore: number;
  logLoss: number;
  /** Positive = model overestimates; Negative = model underestimates */
  calibrationError: number;
  roi: number | null;   // null when odds/pnl data is incomplete
}

export interface SegmentReport {
  dimension: string;
  label: string;
  metrics: SegmentMetrics;
}

export interface PlattEstimate {
  /** Scaling factor in logit space. >1 = spread, <1 = compress */
  alpha: number;
  /** Additive offset in logit space. Positive = inflate, negative = deflate */
  beta: number;
  /** Final log-loss after calibration (lower = better) */
  logLoss: number;
  /** Number of picks used to estimate calibration */
  sampleSize: number;
}

export interface BacktestReport {
  /** ISO timestamp when this report was generated */
  generatedAt: string;
  /** Number of calendar days in the training window */
  windowDays: number;
  /** Total settled picks available in window */
  totalPicks: number;
  /** Overall metrics across all picks */
  overall: SegmentMetrics;
  /** Per-segment breakdown */
  segments: SegmentReport[];
  /** Platt calibration estimate (alpha, beta) from gradient descent */
  calibration: PlattEstimate;
  /** Human-readable summary of the most significant biases found */
  diagnostics: string[];
}

// ─── Statistical helpers ──────────────────────────────────────────────────────

function brierScore(predictions: number[], actuals: boolean[]): number {
  if (!predictions.length) return 0;
  const sum = predictions.reduce((acc, p, i) => acc + Math.pow(p - (actuals[i] ? 1 : 0), 2), 0);
  return sum / predictions.length;
}

function logLoss(predictions: number[], actuals: boolean[]): number {
  if (!predictions.length) return 0;
  const eps = 1e-7;
  const sum = predictions.reduce((acc, p, i) => {
    const clipped = Math.max(eps, Math.min(1 - eps, p));
    return acc + (actuals[i] ? -Math.log(clipped) : -Math.log(1 - clipped));
  }, 0);
  return sum / predictions.length;
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function computeROI(picks: PickResult[]): number | null {
  const withPnl = picks.filter(p => p.pnl !== null && p.kelly_stake !== null);
  if (!withPnl.length) return null;
  const totalStaked = withPnl.reduce((a, p) => a + (p.kelly_stake ?? 0), 0);
  const totalPnl    = withPnl.reduce((a, p) => a + (p.pnl ?? 0), 0);
  return totalStaked > 0 ? (totalPnl / totalStaked) * 100 : null;
}

function computeMetrics(picks: PickResult[]): SegmentMetrics {
  if (!picks.length) {
    return { sampleSize: 0, hitRate: 0, avgPredicted: 0, brierScore: 0, logLoss: 0, calibrationError: 0, roi: null };
  }
  const predictions = picks.map(p => p.predicted_prob);
  const actuals     = picks.map(p => p.actual_result);
  const hitRate     = actuals.filter(Boolean).length / actuals.length;
  const avgPredicted = mean(predictions);

  return {
    sampleSize:        picks.length,
    hitRate,
    avgPredicted,
    brierScore:        brierScore(predictions, actuals),
    logLoss:           logLoss(predictions, actuals),
    calibrationError:  avgPredicted - hitRate,
    roi:               computeROI(picks),
  };
}

// ─── Platt calibration via gradient descent ───────────────────────────────────

/**
 * Estimate Platt scaling parameters (alpha, beta) that minimise log-loss
 * on the pick_results dataset.
 *
 * Objective: minimise Σ log-loss(sigmoid(alpha × logit(p_i) + beta), y_i)
 * Solver: gradient descent with adaptive learning rate and early stopping.
 */
function estimatePlattCalibration(picks: PickResult[]): PlattEstimate {
  const eps = 1e-7;

  // Convert predicted probabilities to logits
  const logits = picks.map(p => {
    const clipped = Math.max(eps, Math.min(1 - eps, p.predicted_prob));
    return Math.log(clipped / (1 - clipped));
  });
  const actuals = picks.map(p => p.actual_result ? 1 : 0);

  let alpha = 1.0;
  let beta  = 0.0;
  let lr    = 0.1;
  let prevLoss = Infinity;

  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

  for (let iter = 0; iter < 500; iter++) {
    // Forward pass
    const calibrated = logits.map(l => sigmoid(alpha * l + beta));
    const loss = logLoss(calibrated, picks.map(p => p.actual_result));

    // Early stopping
    if (Math.abs(prevLoss - loss) < 1e-6) break;
    prevLoss = loss;

    // Gradient computation
    let dAlpha = 0;
    let dBeta  = 0;
    for (let i = 0; i < logits.length; i++) {
      const err = calibrated[i] - actuals[i];
      dAlpha += err * logits[i];
      dBeta  += err;
    }
    dAlpha /= logits.length;
    dBeta  /= logits.length;

    // Parameter update
    alpha -= lr * dAlpha;
    beta  -= lr * dBeta;

    // Reduce learning rate every 100 iterations
    if ((iter + 1) % 100 === 0) lr *= 0.5;
  }

  // Final loss with calibrated params
  const calibrated = logits.map(l => sigmoid(alpha * l + beta));
  const finalLoss  = logLoss(calibrated, picks.map(p => p.actual_result));

  return {
    alpha: Math.max(0.3, Math.min(2.5, alpha)),  // guard against degenerate values
    beta:  Math.max(-2.0, Math.min(2.0, beta)),
    logLoss: finalLoss,
    sampleSize: picks.length,
  };
}

// ─── Segmentation ─────────────────────────────────────────────────────────────

function segmentByTier(picks: PickResult[], minN: number): SegmentReport[] {
  const tiers = ['ELITE', 'STRONG', 'LEAN'];
  return tiers
    .map(t => ({
      dimension: 'tier',
      label: t,
      metrics: computeMetrics(picks.filter(p => p.tier?.toUpperCase() === t)),
    }))
    .filter(s => s.metrics.sampleSize >= minN);
}

function segmentByPark(picks: PickResult[], minN: number): SegmentReport[] {
  const buckets: Array<{ label: string; filter: (pf: number) => boolean }> = [
    { label: 'High (≥1.10)',            filter: pf => pf >= 1.10 },
    { label: 'Neutral (0.92–1.09)',     filter: pf => pf >= 0.92 && pf < 1.10 },
    { label: 'Suppressed (≤0.91)',      filter: pf => pf < 0.92 },
  ];
  return buckets
    .map(b => ({
      dimension: 'park',
      label: b.label,
      metrics: computeMetrics(
        picks.filter(p => p.park_factor !== null && b.filter(p.park_factor!)),
      ),
    }))
    .filter(s => s.metrics.sampleSize >= minN);
}

function segmentByPlatoon(picks: PickResult[], minN: number): SegmentReport[] {
  const labels = ['L-vs-R', 'Same', 'Switch'];
  return labels
    .map(l => ({
      dimension: 'platoon',
      label: l,
      metrics: computeMetrics(picks.filter(p => p.platoon === l)),
    }))
    .filter(s => s.metrics.sampleSize >= minN);
}

function segmentByEV(picks: PickResult[], minN: number): SegmentReport[] {
  const labels = ['High', 'Mid', 'Low'];
  return labels
    .map(l => ({
      dimension: 'exit_velocity',
      label: l,
      metrics: computeMetrics(picks.filter(p => p.exit_velocity_bucket === l)),
    }))
    .filter(s => s.metrics.sampleSize >= minN);
}

function segmentByWeather(picks: PickResult[], minN: number): SegmentReport[] {
  const labels = ['Favorable', 'Neutral', 'Unfavorable'];
  return labels
    .map(l => ({
      dimension: 'weather',
      label: l,
      metrics: computeMetrics(picks.filter(p => p.weather_bucket === l)),
    }))
    .filter(s => s.metrics.sampleSize >= minN);
}

// ─── Diagnostic generation ────────────────────────────────────────────────────

/**
 * Produce a human-readable list of the most significant bias patterns found.
 * Used in the backtest dashboard and Slack/email alerts.
 */
function generateDiagnostics(
  overall: SegmentMetrics,
  segments: SegmentReport[],
  calibration: PlattEstimate,
): string[] {
  const diags: string[] = [];
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  // Overall calibration
  const absErr = Math.abs(overall.calibrationError);
  if (absErr > 0.03) {
    const dir = overall.calibrationError > 0 ? 'overconfident' : 'underconfident';
    diags.push(
      `Overall model is ${dir} by ${pct(absErr)} ` +
      `(predicted ${pct(overall.avgPredicted)} vs actual ${pct(overall.hitRate)}).`,
    );
  }

  // Segment biases
  const biasedSegments = segments
    .filter(s => Math.abs(s.metrics.calibrationError) > 0.04)
    .sort((a, b) => Math.abs(b.metrics.calibrationError) - Math.abs(a.metrics.calibrationError));

  for (const seg of biasedSegments.slice(0, 3)) {
    const dir = seg.metrics.calibrationError > 0 ? 'over' : 'under';
    diags.push(
      `${seg.dimension}=${seg.label}: ${dir}predicts by ${pct(Math.abs(seg.metrics.calibrationError))} ` +
      `(n=${seg.metrics.sampleSize}, Brier=${seg.metrics.brierScore.toFixed(4)}).`,
    );
  }

  // Platt calibration quality
  if (Math.abs(calibration.alpha - 1.0) > 0.1 || Math.abs(calibration.beta) > 0.1) {
    diags.push(
      `Platt scaling applied: α=${calibration.alpha.toFixed(3)}, β=${calibration.beta.toFixed(3)} ` +
      `(log-loss ${calibration.logLoss.toFixed(4)}, n=${calibration.sampleSize}).`,
    );
  } else {
    diags.push(
      `Model is well-calibrated — Platt correction is minimal ` +
      `(α≈${calibration.alpha.toFixed(2)}, β≈${calibration.beta.toFixed(2)}).`,
    );
  }

  // ROI diagnostics
  if (overall.roi !== null) {
    const roiSign = overall.roi >= 0 ? '+' : '';
    diags.push(`30/60-day ROI: ${roiSign}${overall.roi.toFixed(1)}% flat-unit.`);
  }

  return diags;
}

// ─── Main entrypoint ──────────────────────────────────────────────────────────

/**
 * Run the full backtesting pipeline over a provided set of settled picks.
 *
 * Designed to be called from `app/api/cron/backtest/route.ts` which handles
 * database I/O (fetching pick_results, persisting the report).
 *
 * @param picks    Array of settled PickResult rows from Supabase
 * @param options  Backtest configuration
 * @returns        Full BacktestReport
 *
 * @example
 * ```ts
 * const report = runBacktest(settledPicks, { windowDays: 60, minSampleSize: 15 });
 * await supabase.from('backtest_results').insert({ ... report });
 * ```
 */
export function runBacktest(
  picks: PickResult[],
  options: BacktestOptions = {},
): BacktestReport {
  const {
    windowDays        = 60,
    minSampleSize     = 10,
    estimateCalibration = true,
  } = options;

  // ── Overall metrics ────────────────────────────────────────────────────────
  const overall = computeMetrics(picks);

  // ── Segmented metrics ──────────────────────────────────────────────────────
  const segments: SegmentReport[] = [
    ...segmentByTier(picks, minSampleSize),
    ...segmentByPark(picks, minSampleSize),
    ...segmentByPlatoon(picks, minSampleSize),
    ...segmentByEV(picks, minSampleSize),
    ...segmentByWeather(picks, minSampleSize),
  ];

  // ── Platt calibration ──────────────────────────────────────────────────────
  const calibration = estimateCalibration && picks.length >= 20
    ? estimatePlattCalibration(picks)
    : { alpha: 1.0, beta: 0.0, logLoss: overall.logLoss, sampleSize: picks.length };

  // ── Diagnostics ────────────────────────────────────────────────────────────
  const diagnostics = generateDiagnostics(overall, segments, calibration);

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    totalPicks: picks.length,
    overall,
    segments,
    calibration,
    diagnostics,
  };
}

// ─── Segment metadata enrichment ─────────────────────────────────────────────

/**
 * Map raw park factor to a string bucket for segmentation.
 * Call this when inserting a new pick_result row.
 */
export function parkFactorBucket(parkFactor: number): 'High' | 'Neutral' | 'Suppressed' {
  if (parkFactor >= 1.10) return 'High';
  if (parkFactor >= 0.92) return 'Neutral';
  return 'Suppressed';
}

/**
 * Map average exit velocity to a string bucket.
 * Typical MLB range: 82–96 mph.
 */
export function exitVelocityBucket(avgEV: number): 'High' | 'Mid' | 'Low' {
  if (avgEV >= 92) return 'High';
  if (avgEV >= 88) return 'Mid';
  return 'Low';
}

/**
 * Map a weather adjustment (from feature-engineering) to a bucket.
 * Positive = favorable (hot/wind-out); negative = unfavorable (cold/wind-in).
 */
export function weatherBucket(adjustment: number): 'Favorable' | 'Neutral' | 'Unfavorable' {
  if (adjustment >= 0.05)  return 'Favorable';
  if (adjustment <= -0.05) return 'Unfavorable';
  return 'Neutral';
}
