/**
 * GET /api/cron/train
 *
 * Training Layer — Model calibration & performance tracking.
 * Runs after games complete each day (3 AM UTC / ~10 PM ET previous evening).
 *
 * Vercel Cron schedule: daily at 3 AM UTC  (0 3 * * *)
 * Auth: CRON_SECRET header
 *
 * Flow:
 *   1. recordPickResults()     — settle yesterday's picks against MLB outcomes
 *   2. Load 30-day pick_results window
 *   3. calculateAccuracy()     — Brier score, log-loss, calibration alpha
 *   4. calculateROI()          — flat-unit P&L and ROI %
 *   5. calculateTierBreakdown()— per-tier accuracy
 *   6. Persist metrics to model_metrics table
 *
 * The calibration_alpha stored in model_metrics can be read by picks-engine.ts
 * on the next generation run to correct systematic over/under-confidence.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided =
      req.headers.get('authorization')?.replace('Bearer ', '') ??
      req.headers.get('x-cron-secret') ??
      '';
    if (provided !== cronSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const errors: string[] = [];

  // ── Step 1: Settle yesterday's picks ─────────────────────────────────────
  let settleResult = { picksScanned: 0, picksSettled: 0, errors: [] as string[] };
  try {
    const { recordPickResults } = await import('@/lib/tracking/recordResults');
    settleResult = await recordPickResults();
    errors.push(...settleResult.errors);
    console.log(
      `[v0] [cron/train] Settled ${settleResult.picksSettled}/${settleResult.picksScanned} picks`,
    );
  } catch (err) {
    const msg = `recordPickResults failed: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    console.error('[v0] [cron/train]', msg);
  }

  // ── Step 2: Load 30-day settled window ───────────────────────────────────
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const windowStart = daysAgoUTC(30);
  const { data: resultsRaw, error: fetchErr } = await supabase
    .from('pick_outcomes')
    .select('edge, hit, best_odds, units_wagered, tier, units_profit')
    .gte('pick_date', windowStart)
    .not('hit', 'is', null);

  if (fetchErr) {
    errors.push(`pick_outcomes fetch failed: ${fetchErr.message}`);
  }

  // Remap pick_outcomes columns to the shape calculateAccuracy/calculateROI expect
  const results = (resultsRaw ?? []).map((r: any) => ({
    predicted_prob: r.edge,
    actual_result:  r.hit ?? false,
    odds:           r.best_odds,
    kelly_stake:    r.units_wagered,
    tier:           r.tier,
    pnl:            r.units_profit,
  }));

  // ── Step 3: Compute metrics ───────────────────────────────────────────────
  const {
    calculateAccuracy,
    calculateTierBreakdown,
  } = await import('@/lib/tracking/metrics');
  const { calculateROI } = await import('@/lib/tracking/roi');

  const accuracy = calculateAccuracy(results);
  const roi = calculateROI(results);
  const tiers = calculateTierBreakdown(results);

  // ── Step 4: Persist to model_metrics ─────────────────────────────────────
  const { error: insertErr } = await supabase.from('model_metrics').insert({
    window_days: 30,
    sample_size: accuracy.sampleSize,

    accuracy: accuracy.accuracy,
    brier_score: accuracy.brierScore,
    calibration_alpha: accuracy.calibrationAlpha,

    total_bet: roi.totalBet,
    total_return: roi.totalReturn,
    roi: roi.roi,

    elite_accuracy: tiers.elite.accuracy,
    strong_accuracy: tiers.strong.accuracy,
    lean_accuracy: tiers.lean.accuracy,

    notes: errors.length > 0 ? errors.join('; ') : null,
  });

  if (insertErr) {
    errors.push(`model_metrics insert failed: ${insertErr.message}`);
  }

  const summary = {
    settled: settleResult,
    accuracy: {
      sampleSize: accuracy.sampleSize,
      accuracy: accuracy.accuracy,
      brierScore: accuracy.brierScore,
      calibrationAlpha: accuracy.calibrationAlpha,
    },
    roi: {
      totalBet: roi.totalBet,
      totalReturn: roi.totalReturn,
      profit: roi.profit,
      roi: roi.roi,
      winRate: roi.winRate,
    },
    tiers,
    errors,
    durationMs: Date.now() - startedAt,
    ranAt: new Date().toISOString(),
  };

  console.log('[v0] [cron/train] Complete:', JSON.stringify(summary, null, 2));

  return NextResponse.json({ success: errors.length === 0, data: summary });
}

function daysAgoUTC(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
