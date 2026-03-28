/**
 * Catcher Framing Model
 *
 * Quantifies the effect of a catcher's pitch framing ability on:
 *  - strikeout props
 *  - walk props
 *  - pitcher ERA
 *
 * Source metric: Statcast "Framing Runs Above Average" (fRAA)
 * Positive fRAA = good framer (helps pitcher); negative = hurts pitcher.
 *
 * A great framer converts borderline pitches into strikes, effectively
 * expanding the zone for the pitcher — leading to more Ks and fewer BBs.
 *
 * Betting implications:
 *  - elite framer behind plate → lean Over on pitcher K prop
 *  - poor framer → lean Under on pitcher K prop
 */

export interface CatcherFramingInput {
  /**
   * Framing Runs Above Average per 1,000 pitches caught.
   * League average ≈ 0; range roughly -25 to +25.
   * Source: Baseball Savant catcher framing leaderboard.
   */
  framingRunsAboveAverage: number;
  /**
   * Delta in called-strike conversion rate vs league average.
   * e.g. +0.02 = catcher frames 2 percentage points more strikes.
   * Optional — used alongside framingRuns when available.
   */
  calledStrikeConversionDelta?: number;
}

export interface CatcherFramingResult {
  framingTier: 'elite' | 'above-avg' | 'average' | 'below-avg';
  /**
   * Expected delta on a pitcher's K prop as a fraction.
   * Positive → more Ks than baseline.
   */
  koPropImpact: number;
  /**
   * Expected delta on pitcher walk prop (fraction).
   * Negative → fewer walks with an elite framer.
   */
  walkPropImpact: number;
  /**
   * Expected ERA impact on the pitcher (runs/9 innings).
   * Negative = catcher suppresses runs.
   */
  pitcherEraImpact: number;
  signal: string;
}

/** fRAA thresholds (per 1,000 pitches) */
const ELITE_THRESHOLD     =  12;
const ABOVE_AVG_THRESHOLD =   4;
const BELOW_AVG_THRESHOLD =  -4;

export function computeCatcherFraming(input: CatcherFramingInput): CatcherFramingResult {
  const { framingRunsAboveAverage, calledStrikeConversionDelta = 0 } = input;

  // ── Tier classification ────────────────────────────────────────────────────
  const framingTier: CatcherFramingResult['framingTier'] =
    framingRunsAboveAverage >= ELITE_THRESHOLD     ? 'elite'
    : framingRunsAboveAverage >= ABOVE_AVG_THRESHOLD ? 'above-avg'
    : framingRunsAboveAverage <= BELOW_AVG_THRESHOLD ? 'below-avg'
    : 'average';

  // ── K prop impact ──────────────────────────────────────────────────────────
  // Calibrated so elite framer (~+15 fRAA) ≈ +8% on K rate
  const framingFactor = framingRunsAboveAverage / 15;
  const koPropImpact = Math.round(
    (framingFactor * 0.08 + calledStrikeConversionDelta * 2) * 100
  ) / 100;

  // ── Walk prop impact ───────────────────────────────────────────────────────
  // Fewer calls outside zone → fewer walks with elite framer
  const walkPropImpact = Math.round(-framingFactor * 0.05 * 100) / 100;

  // ── ERA impact ─────────────────────────────────────────────────────────────
  // +1 framing run ≈ -0.04 ERA (empirically calibrated)
  const pitcherEraImpact = Math.round(-framingRunsAboveAverage * 0.04 * 100) / 100;

  // ── Signal string ──────────────────────────────────────────────────────────
  const fRAAStr = framingRunsAboveAverage >= 0
    ? `+${framingRunsAboveAverage.toFixed(1)}`
    : framingRunsAboveAverage.toFixed(1);

  let signal: string;
  if (framingTier === 'elite') {
    signal = `Elite framer behind plate (fRAA: ${fRAAStr}/1k) — lean Over on pitcher K prop, Under on walk prop`;
  } else if (framingTier === 'above-avg') {
    signal = `Above-average framing (fRAA: ${fRAAStr}/1k) — slight K prop boost for tonight's starter`;
  } else if (framingTier === 'below-avg') {
    signal = `Poor framer (fRAA: ${fRAAStr}/1k) — borderline pitches not getting called. Lean Under on K prop`;
  } else {
    signal = `Average catcher framing — no significant adjustment`;
  }

  return { framingTier, koPropImpact, walkPropImpact, pitcherEraImpact, signal };
}
