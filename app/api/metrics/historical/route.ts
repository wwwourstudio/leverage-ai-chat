import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/metrics/historical?days=30
 *
 * Returns historical performance metrics from stored AI predictions.
 * Used by InsightsDashboard to render win-rate / ROI charts.
 * Falls back gracefully with empty-but-valid data when Supabase is unconfigured.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30', 10), 1), 90);

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    // Query AI predictions from the configured window
    const { data: predictions, error } = await supabase
      .from('ai_predictions')
      .select('id, sport, confidence_score, outcome, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      // Schema mismatch or table missing — return safe empty metrics rather than crashing
      console.warn('[API/metrics/historical] Supabase query error:', error.message);
      return NextResponse.json({ success: true, metrics: null });
    }

    if (!predictions || predictions.length === 0) {
      return NextResponse.json({ success: true, metrics: null });
    }

    // Aggregate by day for charting
    const byDay: Record<string, { correct: number; total: number }> = {};
    for (const p of predictions) {
      const day = (p.created_at as string).slice(0, 10);
      if (!byDay[day]) byDay[day] = { correct: 0, total: 0 };
      byDay[day].total += 1;
      if (p.outcome === 'correct') byDay[day].correct += 1;
    }

    const resolved = predictions.filter((p: any) => p.outcome !== null && p.outcome !== 'pending');
    const correct = resolved.filter((p: any) => p.outcome === 'correct').length;
    const winRate = resolved.length > 0 ? correct / resolved.length : 0;
    const avgConf =
      predictions.length > 0
        ? predictions.reduce((s: number, p: any) => s + (p.confidence_score ?? 0), 0) /
          predictions.length
        : 0;

    return NextResponse.json({
      success: true,
      metrics: {
        days,
        totalPredictions: predictions.length,
        resolvedPredictions: resolved.length,
        correctPredictions: correct,
        winRate: Math.round(winRate * 100) / 100,
        averageConfidence: Math.round(avgConf * 100) / 100,
        dailyBreakdown: Object.entries(byDay)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, stats]) => ({
            date,
            total: stats.total,
            correct: stats.correct,
            winRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) / 100 : 0,
          })),
      },
    });
  } catch (err) {
    console.error('[API/metrics/historical] Error:', err);
    // Always return valid JSON so the dashboard can degrade gracefully
    return NextResponse.json({ success: true, metrics: null });
  }
}
