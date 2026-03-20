/**
 * GET /api/cron/picks
 *
 * Model Layer — Picks refresh.
 * Re-scores today's picks with the latest sharp-money signals from
 * `line_movement` and enrolls any new picks into the `pick_results`
 * tracking table.
 *
 * Vercel Cron schedule: every 5 minutes  (*\/5 * * * *)
 * Auth: CRON_SECRET header
 *
 * Flow:
 *   1. refreshPicksWithSharpSignals() — re-score today's picks
 *   2. enrolPicksForTracking()        — insert new pick_results rows
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 20;

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
  const date = todayUTC();

  try {
    // 1. Re-score picks with latest sharp signals
    const { refreshPicksWithSharpSignals } = await import('@/lib/update-picks');
    const refreshResult = await refreshPicksWithSharpSignals({ date });

    // 2. Enrol any newly generated picks into pick_results for tracking
    const { enrolPicksForTracking } = await import('@/lib/tracking/recordResults');
    const enrolled = await enrolPicksForTracking(date);

    console.log(
      `[v0] [cron/picks] Refreshed ${refreshResult.picksUpdated}/${refreshResult.picksProcessed} picks, enrolled ${enrolled} new — ${Date.now() - startedAt}ms`,
    );

    return NextResponse.json({
      success: true,
      data: {
        refresh: refreshResult,
        enrolled,
      },
      meta: {
        date,
        durationMs: Date.now() - startedAt,
        runAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[v0] [cron/picks] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Picks refresh failed',
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
