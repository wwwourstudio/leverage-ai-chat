/**
 * GET /api/cron/odds
 *
 * Ingest Layer A — Odds refresh.
 * Fetches live odds for all active sport markets from The Odds API and
 * persists them to the `live_odds_cache` Supabase table.
 *
 * Vercel Cron schedule: every minute  (* * * * *)
 * Auth: CRON_SECRET header (set in Vercel environment variables)
 *
 * The odds ingest is intentionally lightweight — it delegates all heavy
 * lifting to the existing unified-odds-fetcher + odds-persistence modules
 * so there's a single source of truth for odds data.
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

  try {
    // Fetch live odds for the primary sport markets
    const { fetchLiveOdds } = await import('@/lib/unified-odds-fetcher');
    const oddsResult = await fetchLiveOdds();

    console.log(
      `[v0] [cron/odds] Fetched ${oddsResult?.length ?? 0} markets in ${Date.now() - startedAt}ms`,
    );

    return NextResponse.json({
      success: true,
      meta: {
        marketsIngested: oddsResult?.length ?? 0,
        durationMs: Date.now() - startedAt,
        runAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[v0] [cron/odds] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Odds ingest failed',
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
