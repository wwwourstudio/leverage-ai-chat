/**
 * GET /api/cron/backtest
 *
 * Backtesting & Calibration Cron — runs daily after the training step
 * (recommended schedule: 03:30 UTC, 30 min after /api/cron/train).
 *
 * Scheduled via GitHub Actions (automation-cron.yml) because the Hobby
 * plan's 2-cron limit is already used by daily-picks + adp/refresh.
 * Auth: Bearer CRON_SECRET header (same secret as all other cron routes).
 *
 * ─── Flow ────────────────────────────────────────────────────────────────────
 *   1. Fetch settled pick_results for the configured window (default 60 days)
 *      — includes segmentation metadata (park_factor, platoon, ev_bucket, weather_bucket)
 *   2. Run runBacktest() — pure TS, no external deps
 *   3. Persist BacktestReport summary to `backtest_results` table
 *   4. Update `model_metrics` with the new Platt calibration (alpha, beta)
 *      so the next picks-engine run picks up corrected weights automatically
 *
 * ─── Supabase tables used ─────────────────────────────────────────────────────
 *   READ:  api.pick_outcomes       — settled picks (segmentation cols mapped to null)
 *   WRITE: api.backtest_results    — stores full per-segment BacktestReport
 *   WRITE: api.model_metrics       — updates calibration_alpha + calibration_beta
 *
 * ─── Environment variables ────────────────────────────────────────────────────
 *   CRON_SECRET              — bearer token for request authentication
 *   BACKTEST_WINDOW_DAYS     — override default 60-day window (optional)
 *   BACKTEST_MIN_SAMPLE      — override min segment size of 10 (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { PickResult } from '@/lib/mlb-projections/backtester';
import { verifyCronSecret } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const startedAt = Date.now();
  const errors: string[] = [];

  const windowDays  = Number(process.env.BACKTEST_WINDOW_DAYS ?? '60');
  const minSample   = Number(process.env.BACKTEST_MIN_SAMPLE  ?? '10');

  // ── Step 1: Fetch settled picks with segmentation metadata ────────────────
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const windowStart = daysAgoUTC(windowDays);

  const { data: picksRaw, error: fetchErr } = await supabase
    .from('pick_outcomes')
    .select('edge, hit, best_odds, units_wagered, tier, units_profit')
    .gte('pick_date', windowStart)
    .not('hit', 'is', null);

  if (fetchErr) {
    const msg = `pick_outcomes fetch failed: ${fetchErr.message}`;
    errors.push(msg);
    console.error('[v0] [cron/backtest]', msg);
    return NextResponse.json({ success: false, errors }, { status: 500 });
  }

  // Remap pick_outcomes columns to PickResult shape; segmentation cols not yet stored
  const picks = (picksRaw ?? []).map((r: any): PickResult => ({
    predicted_prob:       r.edge,
    actual_result:        r.hit ?? false,
    odds:                 r.best_odds,
    kelly_stake:          r.units_wagered,
    tier:                 r.tier,
    pnl:                  r.units_profit,
    park_factor:          null,
    platoon:              null,
    exit_velocity_bucket: null,
    weather_bucket:       null,
  }));

  if (picks.length < 5) {
    const msg = `Insufficient picks for backtesting: ${picks.length} (need ≥5 settled)`;
    console.warn('[v0] [cron/backtest]', msg);
    return NextResponse.json({
      success: true,
      data: { skipped: true, reason: msg, picks: picks.length },
    });
  }

  // ── Step 2: Run backtest ───────────────────────────────────────────────────
  const { runBacktest } = await import('@/lib/mlb-projections/backtester');

  const report = runBacktest(picks, {
    windowDays,
    minSampleSize: minSample,
    estimateCalibration: true,
  });

  console.log('[v0] [cron/backtest] Report generated:', {
    totalPicks:  report.totalPicks,
    brierScore:  report.overall.brierScore.toFixed(4),
    calibAlpha:  report.calibration.alpha.toFixed(3),
    calibBeta:   report.calibration.beta.toFixed(3),
    segments:    report.segments.length,
  });

  // ── Step 3: Persist BacktestReport to backtest_results ────────────────────
  const { error: insertErr } = await supabase.from('backtest_results').insert({
    window_days:          report.windowDays,
    total_picks:          report.totalPicks,
    hit_rate:             report.overall.hitRate,
    avg_predicted:        report.overall.avgPredicted,
    brier_score:          report.overall.brierScore,
    log_loss:             report.overall.logLoss,
    calibration_error:    report.overall.calibrationError,
    roi:                  report.overall.roi,
    calibration_alpha:    report.calibration.alpha,
    calibration_beta:     report.calibration.beta,
    calibration_log_loss: report.calibration.logLoss,
    calibration_n:        report.calibration.sampleSize,
    segments:             report.segments,   // stored as JSONB
    diagnostics:          report.diagnostics,
    generated_at:         report.generatedAt,
  });

  if (insertErr) {
    const msg = `backtest_results insert failed: ${insertErr.message}`;
    errors.push(msg);
    console.error('[v0] [cron/backtest]', msg);
    // Non-fatal: continue to update model_metrics
  }

  // ── Step 4: Update model_metrics with new calibration ─────────────────────
  // Upsert a sentinel row keyed by window_days=0 to mark the live calibration.
  // The picks-engine reads this row at startup to load corrected weights.
  const { error: calibErr } = await supabase.from('model_metrics').insert({
    window_days:          0,   // sentinel: "active calibration" row
    sample_size:          report.calibration.sampleSize,
    brier_score:          report.overall.brierScore,
    calibration_alpha:    report.calibration.alpha,
    calibration_beta:     report.calibration.beta,
    notes: [
      `Backtest ${report.generatedAt.slice(0, 10)} — ${report.windowDays}d window`,
      ...report.diagnostics,
    ].join(' | '),
  });

  if (calibErr) {
    const msg = `model_metrics calibration update failed: ${calibErr.message}`;
    errors.push(msg);
    console.error('[v0] [cron/backtest]', msg);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = {
    windowDays,
    totalPicks:       report.totalPicks,
    overall: {
      hitRate:          report.overall.hitRate,
      avgPredicted:     report.overall.avgPredicted,
      brierScore:       report.overall.brierScore,
      calibrationError: report.overall.calibrationError,
      roi:              report.overall.roi,
    },
    calibration: report.calibration,
    segmentsComputed: report.segments.length,
    diagnostics:      report.diagnostics,
    errors,
    durationMs:       Date.now() - startedAt,
    ranAt:            new Date().toISOString(),
  };

  console.log('[v0] [cron/backtest] Complete:', JSON.stringify(summary, null, 2));

  return NextResponse.json({ success: errors.length === 0, data: summary });
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function daysAgoUTC(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
