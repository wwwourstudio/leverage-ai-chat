/**
 * GET /api/cron/projections
 *
 * Ingest Layer B — MLB projections refresh.
 * Runs the full MLB projection pipeline (Statcast features → HR model →
 * park/matchup/weather adjustments) and stores results so picks can
 * reference fresh projections.
 *
 * Vercel Cron schedule: every 15 minutes  (*\/15 * * * *)
 * Auth: CRON_SECRET header
 *
 * This is a heavier job than odds ingest — it runs the full multi-step
 * projection pipeline and may take 15–20s on a cold start.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const startedAt = Date.now();

  try {
    const { runProjectionPipeline } = await import('@/lib/mlb-projections');

    // Run the projection pipeline for today's slate
    // The pipeline fetches today's games internally from the MLB Stats API
    const result = await runProjectionPipeline({
      date: todayET(),
    });

    const playerCount = Array.isArray(result) ? result.length : 0;

    console.log(
      `[v0] [cron/projections] Projected ${playerCount} players in ${Date.now() - startedAt}ms`,
    );

    return NextResponse.json({
      success: true,
      meta: {
        playersProjected: playerCount,
        date: todayET(),
        durationMs: Date.now() - startedAt,
        runAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[v0] [cron/projections] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Projections failed',
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

function todayET(): string {
  // Use Eastern Time for baseball schedule alignment
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}
