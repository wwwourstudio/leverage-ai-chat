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
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 20;

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) throw new Error('Supabase service role not configured');
  return createClient(url, key, { db: { schema: 'api' } });
}

const SPORT_KEY_TO_LABEL: Record<string, string> = {
  baseball_mlb: 'MLB',
  basketball_nba: 'NBA',
  americanfootball_nfl: 'NFL',
  icehockey_nhl: 'NHL',
};

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const querySecret = req.nextUrl.searchParams.get('secret');
    const headerSecret =
      req.headers.get('authorization')?.replace('Bearer ', '') ??
      req.headers.get('x-cron-secret') ??
      '';
    if (querySecret !== cronSecret && headerSecret !== cronSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startedAt = Date.now();

  try {
    // Fetch live odds for all primary sport markets in parallel.
    // fetchLiveOdds requires a sportKey; the cron loops through all active sports.
    const { fetchLiveOdds } = await import('@/lib/unified-odds-fetcher');
    const apiKey = process.env.ODDS_API_KEY ?? '';
    const activeSports = [
      'basketball_nba',
      'americanfootball_nfl',
      'baseball_mlb',
      'icehockey_nhl',
    ];
    const settled = await Promise.allSettled(
      activeSports.map(sk => fetchLiveOdds(sk, { apiKey })),
    );
    const oddsResult = settled.flatMap(r =>
      r.status === 'fulfilled' ? (Array.isArray(r.value) ? r.value : []) : [],
    );

    console.log(
      `[v0] [cron/odds] Fetched ${oddsResult?.length ?? 0} games in ${Date.now() - startedAt}ms`,
    );

    // ── Persist to live_odds_cache via SECURITY DEFINER RPC ───────────────
    // Direct .upsert() fails because the live constraint is named uq_live_odds_game,
    // not just the game_id column. The RPC uses the correct constraint + bypasses RLS.
    let cached = 0;
    if (oddsResult.length > 0) {
      try {
        const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const rpcRows = oddsResult
          .filter((g: any) => g?.id && g?.home_team && g?.away_team)
          .map((game: any) => ({
            sport: SPORT_KEY_TO_LABEL[game.sport_key as string] ?? game.sport_key ?? 'Unknown',
            sport_key: game.sport_key ?? '',
            game_id: game.id,
            home_team: game.home_team,
            away_team: game.away_team,
            commence_time: game.commence_time,
            bookmakers: game.bookmakers ?? [],
            markets: (game.bookmakers ?? []).flatMap((b: any) => b.markets ?? []),
            expires_at: expires,
          }));

        if (rpcRows.length > 0) {
          const supabase = getServiceClient();
          const { error } = await supabase
            .from('live_odds_cache')
            .upsert(rpcRows, { onConflict: 'game_id' });
          if (error) {
            console.error('[v0] [cron/odds] live_odds_cache upsert error:', error.message);
          } else {
            cached = rpcRows.length;
            console.log(`[v0] [cron/odds] Cached ${cached} games`);
          }
        }
      } catch (cacheErr) {
        console.error('[v0] [cron/odds] Cache write exception:', cacheErr);
      }
    }

    return NextResponse.json({
      success: true,
      meta: {
        gamesFetched: oddsResult?.length ?? 0,
        gamesCached: cached,
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
