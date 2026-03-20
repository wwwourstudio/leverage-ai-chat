/**
 * GET /api/roi
 *
 * Returns profitability and accuracy metrics from the pick_results +
 * model_metrics tables.
 *
 * Query params:
 *   days      number  Rolling window in days (default: 30)
 *   tier      string  Filter by tier: ELITE | STRONG | LEAN (default: all)
 *   kelly     boolean Include Kelly-sized ROI alongside flat-unit (default: false)
 *   bankroll  number  Starting bankroll for Kelly simulation (default: 10000)
 *
 * Returns:
 *   {
 *     accuracy: AccuracyMetrics,
 *     roi: ROIResult,
 *     kellyRoi?: KellyROIResult,
 *     tiers: TierBreakdown,
 *     latestModelMetrics: ModelMetricsRow | null,
 *     meta: { days, tier, sampleSize, since }
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateAccuracy, calculateTierBreakdown } from '@/lib/tracking/metrics';
import { calculateROI, calculateKellyROI } from '@/lib/tracking/roi';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const days      = Math.min(365, Math.max(1, parseInt(searchParams.get('days') ?? '30', 10)));
  const tier      = searchParams.get('tier')?.toUpperCase() ?? null;
  const withKelly = searchParams.get('kelly') === 'true';
  const bankroll  = parseFloat(searchParams.get('bankroll') ?? '10000');

  try {
    const supabase = await createClient();

    // ── Fetch settled pick_results for the rolling window ──────────────────
    const since = daysAgoUTC(days);

    let query = supabase
      .from('pick_results')
      .select('predicted_prob, actual_result, odds, kelly_stake, tier, pnl, pick_date')
      .gte('pick_date', since)
      .not('actual_result', 'is', null);

    if (tier) {
      query = query.eq('tier', tier);
    }

    const { data: resultsRaw, error: fetchErr } = await query;

    if (fetchErr) {
      return NextResponse.json(
        { success: false, error: `pick_results fetch failed: ${fetchErr.message}` },
        { status: 500 },
      );
    }

    const results = (resultsRaw ?? []) as Array<{
      predicted_prob: number;
      actual_result: boolean;
      odds: number | null;
      kelly_stake: number | null;
      tier: string | null;
      pnl: number | null;
      pick_date: string;
    }>;

    // ── Compute metrics ────────────────────────────────────────────────────
    const accuracy = calculateAccuracy(results);
    const roi      = calculateROI(results);
    const tiers    = calculateTierBreakdown(results);

    const kellyRoi = withKelly ? calculateKellyROI(results, bankroll) : undefined;

    // ── Fetch latest model_metrics row ────────────────────────────────────
    const { data: metricsRaw } = await supabase
      .from('model_metrics')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        accuracy,
        roi,
        ...(kellyRoi ? { kellyRoi } : {}),
        tiers,
        latestModelMetrics: metricsRaw ?? null,
      },
      meta: {
        days,
        tier: tier ?? 'all',
        sampleSize: results.length,
        since,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[v0] [API/roi] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'ROI calculation failed' },
      { status: 500 },
    );
  }
}

function daysAgoUTC(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
