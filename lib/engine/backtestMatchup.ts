/**
 * Matchup Backtest Framework
 *
 * Evaluates the contribution of the matchup engine (Layer 0) to HR prop
 * prediction accuracy using an ablation study design:
 *
 *   Model A — "with matchup"    uses matchupScaledProb as the prediction
 *   Model B — "without matchup" uses modelProbPerAB (raw logistic output)
 *
 * The difference in Brier scores and ROI between A and B quantifies exactly
 * how much value the matchup layer adds.  Positive delta = matchup adds edge.
 *
 * ─── Segmentation ────────────────────────────────────────────────────────────
 * Beyond the ablation, the backtest segments results across 5 matchup
 * dimensions to find where the engine is most (and least) accurate:
 *
 *   1. Lineup slot       — does slot-based weighting correctly predict HR rate?
 *   2. Platoon           — is the platoon boost calibrated to actual outcomes?
 *   3. Matchup tier      — do ELITE/STRONG/LEAN/FADE tiers have correct hit rates?
 *   4. Park bucket       — does the matchup × park interaction add real signal?
 *   5. Fly-ball bucket   — does pitcher flyball% reliably predict HR vs expected?
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 * ```ts
 * const report = runMatchupBacktest(settledEdges, { windowDays: 90 });
 * // report.ablation.matchupLift → matchup's Brier improvement (positive = good)
 * // report.segments             → per-dimension accuracy breakdown
 * // report.recalibration        → suggested matchup weight adjustments
 * ```
 */

// ─── Input types ──────────────────────────────────────────────────────────────

/**
 * One settled hr_prop_edges row with the matchup fields needed for ablation.
 * Fetched from Supabase by the cron/backtest route.
 */
export interface SettledEdge {
  player_name: string;
  game_date: string;
  tier: string;
  actual_result: boolean;    // true = HR happened
  pnl: number | null;
  odds: number | null;       // American odds at bet time
  kelly_matchup_adjusted: number | null;

  // Layer 0 — matchup inputs and output
  matchup_factor: number;
  lineup_slot: number | null;
  platoon_advantage: boolean | null;
  pitcher_flyball_pct: number | null;

  // Layer 2 — raw model probability (without matchup)
  model_prob_per_ab: number;   // = modelProbPerAB (before matchup scaling)

  // Layer 2+0 — matchup-scaled probability
  matchup_scaled_prob: number;

  // Layer 1
  park_factor: number | null;
}

export interface MatchupBacktestOptions {
  windowDays?: number;
  minSegmentSize?: number;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface AblationResult {
  /** Number of settled picks in the comparison window */
  sampleSize: number;

  // Model A: with matchup factor
  brierWithMatchup: number;
  logLossWithMatchup: number;
  hitRateWithMatchup: number;
  avgPredWithMatchup: number;

  // Model B: without matchup factor (raw logistic only)
  brierWithoutMatchup: number;
  logLossWithoutMatchup: number;
  hitRateWithoutMatchup: number;
  avgPredWithoutMatchup: number;

  /** brierWithoutMatchup − brierWithMatchup (positive = matchup HELPS) */
  matchupBrierLift: number;
  /** logLossWithoutMatchup − logLossWithMatchup (positive = matchup HELPS) */
  matchupLogLossLift: number;

  // ROI comparison (flat-unit Kelly staking)
  roiWithMatchup: number | null;
  roiWithoutMatchup: number | null;
  roiLift: number | null;

  /** Overall verdict */
  verdict: 'MATCHUP_ADDS_EDGE' | 'MATCHUP_NEUTRAL' | 'MATCHUP_HURTS';
  verdictReason: string;
}

export interface SegmentBacktestResult {
  dimension: string;
  label: string;
  sampleSize: number;
  hitRate: number;
  avgMatchupFactor: number;
  avgPredicted: number;
  brierScore: number;
  calibrationError: number;  // avgPredicted − hitRate
  roi: number | null;
  /**
   * Is the matchup factor over-weighting this segment?
   * True when calibrationError > 0.03 (model predicts too high).
   */
  isOverweighted: boolean;
  /**
   * Is the matchup factor under-weighting this segment?
   * True when calibrationError < -0.03 (model predicts too low).
   */
  isUnderweighted: boolean;
}

export interface RecalibrationSuggestion {
  /** Which component of calculateMatchupFactor() to adjust */
  component: string;
  currentValue: number;
  suggestedValue: number;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MatchupBacktestReport {
  generatedAt: string;
  windowDays: number;
  totalSettledPicks: number;

  /** Ablation study: with vs without matchup factor */
  ablation: AblationResult;

  /** Per-segment performance breakdown */
  segments: SegmentBacktestResult[];

  /** Suggested weight adjustments for calculateMatchupFactor() */
  recalibration: RecalibrationSuggestion[];

  /** Human-readable findings */
  insights: string[];
}

// ─── Statistical helpers ──────────────────────────────────────────────────────

function brierScore(preds: number[], actuals: boolean[]): number {
  if (!preds.length) return 0;
  return preds.reduce((s, p, i) => s + (p - (actuals[i] ? 1 : 0)) ** 2, 0) / preds.length;
}

function logLoss(preds: number[], actuals: boolean[]): number {
  const eps = 1e-7;
  if (!preds.length) return 0;
  return -preds.reduce((s, p, i) => {
    const c = Math.max(eps, Math.min(1 - eps, p));
    return s + (actuals[i] ? Math.log(c) : Math.log(1 - c));
  }, 0) / preds.length;
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function flatUnitROI(edges: SettledEdge[], probField: 'matchup_scaled_prob' | 'model_prob_per_ab'): number | null {
  const settled = edges.filter(e => e.pnl !== null && e.kelly_matchup_adjusted !== null && e.odds !== null);
  if (!settled.length) return null;
  // Simplified ROI: assume equal unit staking regardless of Kelly
  const wins  = settled.filter(e => e.actual_result);
  const total = settled.length;
  if (!total) return null;
  // Unit P&L: win = (decOdds − 1), loss = −1
  const totalPnL = settled.reduce((sum, e) => {
    const dec = e.odds !== null && e.odds > 0
      ? e.odds / 100 + 1
      : e.odds !== null
        ? 100 / Math.abs(e.odds) + 1
        : 1;
    return sum + (e.actual_result ? dec - 1 : -1);
  }, 0);
  return (totalPnL / total) * 100;
}

// ─── Ablation study ────────────────────────────────────────────────────────────

function runAblation(edges: SettledEdge[]): AblationResult {
  const actuals         = edges.map(e => e.actual_result);
  const withMatchup     = edges.map(e => e.matchup_scaled_prob);
  const withoutMatchup  = edges.map(e => e.model_prob_per_ab);

  const brierWith    = brierScore(withMatchup, actuals);
  const brierWithout = brierScore(withoutMatchup, actuals);
  const llWith       = logLoss(withMatchup, actuals);
  const llWithout    = logLoss(withoutMatchup, actuals);
  const hitRate      = actuals.filter(Boolean).length / actuals.length;

  const brierLift = brierWithout - brierWith;
  const llLift    = llWithout - llWith;

  const roiWith    = flatUnitROI(edges, 'matchup_scaled_prob');
  const roiWithout = flatUnitROI(edges, 'model_prob_per_ab');
  const roiLift    = roiWith !== null && roiWithout !== null ? roiWith - roiWithout : null;

  // Verdict: matchup is net-positive if Brier improves AND log-loss doesn't worsen significantly
  let verdict: AblationResult['verdict'];
  let verdictReason: string;

  if (brierLift > 0.0005 && llLift > -0.002) {
    verdict = 'MATCHUP_ADDS_EDGE';
    verdictReason =
      `Brier improved by ${(brierLift * 1000).toFixed(2)}‰ and log-loss by ${(llLift * 1000).toFixed(2)}‰ ` +
      `with matchup factor — Layer 0 adds real predictive value.`;
  } else if (brierLift < -0.001) {
    verdict = 'MATCHUP_HURTS';
    verdictReason =
      `Brier worsened by ${(-brierLift * 1000).toFixed(2)}‰ with matchup factor — ` +
      `matchup weights may be miscalibrated; review slot multipliers and platoon boosts.`;
  } else {
    verdict = 'MATCHUP_NEUTRAL';
    verdictReason =
      `Brier delta ${(brierLift * 1000).toFixed(2)}‰ — matchup adds minimal signal. ` +
      `Segment analysis may reveal specific sub-groups where it helps.`;
  }

  return {
    sampleSize: edges.length,
    brierWithMatchup: brierWith,
    logLossWithMatchup: llWith,
    hitRateWithMatchup: hitRate,
    avgPredWithMatchup: mean(withMatchup),
    brierWithoutMatchup: brierWithout,
    logLossWithoutMatchup: llWithout,
    hitRateWithoutMatchup: hitRate,   // same actual HR rate; only prediction changes
    avgPredWithoutMatchup: mean(withoutMatchup),
    matchupBrierLift: brierLift,
    matchupLogLossLift: llLift,
    roiWithMatchup: roiWith,
    roiWithoutMatchup: roiWithout,
    roiLift,
    verdict,
    verdictReason,
  };
}

// ─── Segment analysis ─────────────────────────────────────────────────────────

function segmentEdges(
  edges: SettledEdge[],
  dimension: string,
  getLabel: (e: SettledEdge) => string | null,
  minN: number,
): SegmentBacktestResult[] {
  const groups = new Map<string, SettledEdge[]>();
  for (const e of edges) {
    const label = getLabel(e);
    if (!label) continue;
    const arr = groups.get(label) ?? [];
    arr.push(e);
    groups.set(label, arr);
  }

  const results: SegmentBacktestResult[] = [];
  for (const [label, group] of groups.entries()) {
    if (group.length < minN) continue;
    const actuals     = group.map(e => e.actual_result);
    const predictions = group.map(e => e.matchup_scaled_prob);
    const hitRate     = actuals.filter(Boolean).length / actuals.length;
    const avgPredicted = mean(predictions);
    const avgMatchup   = mean(group.map(e => e.matchup_factor));

    const calErr = avgPredicted - hitRate;
    results.push({
      dimension,
      label,
      sampleSize:        group.length,
      hitRate,
      avgMatchupFactor:  avgMatchup,
      avgPredicted,
      brierScore:        brierScore(predictions, actuals),
      calibrationError:  calErr,
      roi:               flatUnitROI(group, 'matchup_scaled_prob'),
      isOverweighted:    calErr > 0.03,
      isUnderweighted:   calErr < -0.03,
    });
  }
  return results.sort((a, b) => b.sampleSize - a.sampleSize);
}

function buildAllSegments(edges: SettledEdge[], minN: number): SegmentBacktestResult[] {
  return [
    // 1. Lineup slot
    ...segmentEdges(edges, 'lineup_slot', e =>
      e.lineup_slot !== null ? `Slot ${e.lineup_slot}` : null, minN),

    // 2. Platoon
    ...segmentEdges(edges, 'platoon', e =>
      e.platoon_advantage !== null ? (e.platoon_advantage ? 'Platoon Advantage' : 'Same Hand') : null, minN),

    // 3. Matchup tier
    ...segmentEdges(edges, 'matchup_tier', e => {
      const f = e.matchup_factor;
      if (f >= 1.40) return 'Elite (≥1.40)';
      if (f >= 1.25) return 'Strong (1.25–1.39)';
      if (f >= 1.10) return 'Favorable (1.10–1.24)';
      if (f >= 0.95) return 'Neutral (0.95–1.09)';
      return 'Unfavorable (<0.95)';
    }, minN),

    // 4. Park bucket (interaction with matchup)
    ...segmentEdges(edges, 'park_bucket', e => {
      if (e.park_factor === null) return null;
      if (e.park_factor >= 1.10) return 'Hitter-friendly (≥1.10)';
      if (e.park_factor >= 0.92) return 'Neutral park';
      return 'Pitcher-friendly (<0.92)';
    }, minN),

    // 5. Fly-ball bucket
    ...segmentEdges(edges, 'flyball_bucket', e => {
      if (e.pitcher_flyball_pct === null) return null;
      if (e.pitcher_flyball_pct >= 45) return 'High fly-ball (≥45%)';
      if (e.pitcher_flyball_pct >= 38) return 'Mid fly-ball (38–44%)';
      return 'Ground-ball (<38%)';
    }, minN),
  ];
}

// ─── Recalibration suggestions ────────────────────────────────────────────────

function generateRecalibration(
  ablation: AblationResult,
  segments: SegmentBacktestResult[],
): RecalibrationSuggestion[] {
  const suggestions: RecalibrationSuggestion[] = [];

  // Slot multipliers: if Slot 3/4/5 segments show consistent over-prediction, reduce multipliers
  const slotSegs = segments.filter(s => s.dimension === 'lineup_slot');
  for (const seg of slotSegs) {
    if (seg.isOverweighted && seg.sampleSize >= 30) {
      const slotNum = parseInt(seg.label.replace('Slot ', ''));
      // Suggest reducing slot multiplier by proportion of calibration error
      const currentMultiplier = { 3: 1.22, 4: 1.28, 5: 1.25, 6: 1.12 }[slotNum] ?? 1.0;
      const suggested = Math.max(1.0, currentMultiplier - seg.calibrationError * 0.5);
      if (Math.abs(suggested - currentMultiplier) > 0.02) {
        suggestions.push({
          component: `LINEUP_SLOT_MULTIPLIER[${slotNum}]`,
          currentValue: currentMultiplier,
          suggestedValue: +suggested.toFixed(3),
          reason: `${seg.label} over-predicts by ${(seg.calibrationError * 100).toFixed(1)}% (n=${seg.sampleSize})`,
          confidence: seg.sampleSize >= 60 ? 'HIGH' : 'MEDIUM',
        });
      }
    }
  }

  // Platoon boost: check if platoon segments are calibrated
  const platoonSeg = segments.find(s => s.dimension === 'platoon' && s.label === 'Platoon Advantage');
  if (platoonSeg && platoonSeg.sampleSize >= 20) {
    const currentBoost = 0.09;
    if (platoonSeg.isOverweighted) {
      suggestions.push({
        component: 'platoon_advantage boost (+0.09)',
        currentValue: currentBoost,
        suggestedValue: +(currentBoost - platoonSeg.calibrationError * 0.3).toFixed(3),
        reason: `Platoon advantage over-predicts by ${(platoonSeg.calibrationError * 100).toFixed(1)}%`,
        confidence: platoonSeg.sampleSize >= 50 ? 'HIGH' : 'MEDIUM',
      });
    } else if (platoonSeg.isUnderweighted) {
      suggestions.push({
        component: 'platoon_advantage boost (+0.09)',
        currentValue: currentBoost,
        suggestedValue: +(currentBoost - platoonSeg.calibrationError * 0.3).toFixed(3),
        reason: `Platoon advantage under-predicts by ${(Math.abs(platoonSeg.calibrationError) * 100).toFixed(1)}%`,
        confidence: platoonSeg.sampleSize >= 50 ? 'HIGH' : 'LOW',
      });
    }
  }

  // Flyball penalty: if high fly-ball bucket consistently over-predicts, reduce flyball boost
  const flyballHigh = segments.find(s => s.dimension === 'flyball_bucket' && s.label.startsWith('High'));
  if (flyballHigh && flyballHigh.isOverweighted && flyballHigh.sampleSize >= 20) {
    suggestions.push({
      component: 'pitcher_flyball_pct boost (+0.07 at >42%)',
      currentValue: 0.07,
      suggestedValue: +(0.07 - flyballHigh.calibrationError * 0.4).toFixed(3),
      reason: `High fly-ball pitcher segment over-predicts by ${(flyballHigh.calibrationError * 100).toFixed(1)}%`,
      confidence: flyballHigh.sampleSize >= 40 ? 'HIGH' : 'MEDIUM',
    });
  }

  // If overall matchup hurts model — suggest reducing total weight of matchup by 20%
  if (ablation.verdict === 'MATCHUP_HURTS') {
    suggestions.push({
      component: 'Global matchup_factor weight (all components)',
      currentValue: 1.0,
      suggestedValue: 0.80,
      reason: `Overall Brier worsens by ${(-ablation.matchupBrierLift * 1000).toFixed(1)}‰ with matchup — reduce all boosts by 20%`,
      confidence: ablation.sampleSize >= 100 ? 'HIGH' : 'LOW',
    });
  }

  return suggestions;
}

// ─── Insight generation ────────────────────────────────────────────────────────

function generateInsights(
  ablation: AblationResult,
  segments: SegmentBacktestResult[],
): string[] {
  const insights: string[] = [];
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  insights.push(`Ablation: ${ablation.verdict} — ${ablation.verdictReason}`);

  if (ablation.roiLift !== null) {
    const sign = ablation.roiLift >= 0 ? '+' : '';
    insights.push(`Matchup layer ROI lift: ${sign}${ablation.roiLift.toFixed(1)}pp vs raw model alone.`);
  }

  // Most over-weighted segment
  const overweighted = segments
    .filter(s => s.isOverweighted)
    .sort((a, b) => b.calibrationError - a.calibrationError);
  if (overweighted[0]) {
    const s = overweighted[0];
    insights.push(
      `Largest over-prediction: ${s.dimension}=${s.label} ` +
      `(model ${pct(s.avgPredicted)} vs actual ${pct(s.hitRate)}, n=${s.sampleSize}). ` +
      `Matchup avg: ${s.avgMatchupFactor.toFixed(2)}×.`,
    );
  }

  // Most under-weighted segment
  const underweighted = segments
    .filter(s => s.isUnderweighted)
    .sort((a, b) => a.calibrationError - b.calibrationError);
  if (underweighted[0]) {
    const s = underweighted[0];
    insights.push(
      `Largest under-prediction: ${s.dimension}=${s.label} ` +
      `(model ${pct(s.avgPredicted)} vs actual ${pct(s.hitRate)}, n=${s.sampleSize}).`,
    );
  }

  // Slot 4 insight (always high-signal slot)
  const slot4 = segments.find(s => s.dimension === 'lineup_slot' && s.label === 'Slot 4');
  if (slot4 && slot4.sampleSize >= 10) {
    insights.push(
      `Slot 4 (cleanup): hit rate ${pct(slot4.hitRate)}, model predicted ${pct(slot4.avgPredicted)}, ` +
      `avg matchup ×${slot4.avgMatchupFactor.toFixed(2)} (n=${slot4.sampleSize}).`,
    );
  }

  // Fade accuracy
  const fadeSeg = segments.find(s => s.dimension === 'matchup_tier' && s.label.includes('<0.95'));
  if (fadeSeg && fadeSeg.sampleSize >= 10) {
    insights.push(
      `Fade signal accuracy: Unfavorable matchup tier actual HR rate = ${pct(fadeSeg.hitRate)} ` +
      `(vs ${pct(fadeSeg.avgPredicted)} predicted). ${fadeSeg.hitRate < 0.04 ? 'UNDER signals confirmed.' : 'Review fade thresholds.'}`,
    );
  }

  return insights;
}

// ─── Main entrypoint ──────────────────────────────────────────────────────────

/**
 * Run the full matchup backtest over a provided set of settled hr_prop_edges rows.
 *
 * Pure function — no DB calls.  Designed to be called from a cron route or
 * a one-off script after fetching settled rows from Supabase.
 *
 * @param edges     Settled hr_prop_edges rows with matchup metadata
 * @param options   Backtest configuration
 *
 * @example
 * ```ts
 * // In a script or cron route:
 * const { data } = await supabase
 *   .from('hr_prop_edges')
 *   .select('*, matchup_snapshots(*)')
 *   .not('actual_result', 'is', null)
 *   .gte('game_date', daysAgo(90));
 *
 * const report = runMatchupBacktest(data, { windowDays: 90 });
 * console.log(report.ablation.verdict);
 * console.log(report.recalibration);
 * ```
 */
export function runMatchupBacktest(
  edges: SettledEdge[],
  options: MatchupBacktestOptions = {},
): MatchupBacktestReport {
  const { windowDays = 90, minSegmentSize = 10 } = options;

  const ablation    = runAblation(edges);
  const segments    = buildAllSegments(edges, minSegmentSize);
  const recalibration = generateRecalibration(ablation, segments);
  const insights    = generateInsights(ablation, segments);

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    totalSettledPicks: edges.length,
    ablation,
    segments,
    recalibration,
    insights,
  };
}
