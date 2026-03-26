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

    // ── Persist: upsert games → get UUIDs → upsert live_odds_cache ───────────
    // live_odds_cache.game_id_uuid is a NOT NULL FK to api.games(id).
    // Step 1: upsert api.games (unique on external_id) to get stable UUIDs.
    // Step 2: upsert api.live_odds_cache (unique on sport_key,home_team,away_team).
    let cached = 0;
    if (oddsResult.length > 0) {
      try {
        const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const validGames = oddsResult.filter((g: any) => g?.id && g?.home_team && g?.away_team);

        if (validGames.length > 0) {
          const supabase = getServiceClient();

          // Step 1 — upsert games, get UUIDs back
          // Deduplicate by external_id to avoid ON CONFLICT duplicates within the batch
          const seenExternal = new Set<string>();
          const gameRows = validGames
            .filter((g: any) => { if (seenExternal.has(g.id)) return false; seenExternal.add(g.id); return true; })
            .map((g: any) => ({
              external_id: g.id,
              sport: g.sport_key ?? '',
              home_team: g.home_team,
              away_team: g.away_team,
              commence_time: g.commence_time,
            }));
          const { data: upsertedGames, error: gamesErr } = await supabase
            .from('games')
            .upsert(gameRows, { onConflict: 'external_id' })
            .select('id, external_id');
          if (gamesErr) {
            console.error('[v0] [cron/odds] games upsert error:', gamesErr.message);
          }

          // Build external_id → uuid map
          const gameIdMap: Record<string, string> = {};
          for (const row of (upsertedGames ?? [])) {
            if (row.external_id) gameIdMap[row.external_id] = row.id;
          }

          // Step 2 — upsert live_odds_cache with resolved game_id_uuid
          // Deduplicate by (sport_key, home_team, away_team) — doubleheaders would otherwise
          // produce duplicate rows and trigger "ON CONFLICT DO UPDATE command cannot affect
          // row a second time".
          const seenCache = new Set<string>();
          const cacheRows = validGames
            .filter((g: any) => {
              if (!gameIdMap[g.id]) return false;
              const key = `${g.sport_key}|${g.home_team}|${g.away_team}`;
              if (seenCache.has(key)) return false;
              seenCache.add(key);
              return true;
            })
            .map((g: any) => ({
              sport: SPORT_KEY_TO_LABEL[g.sport_key as string] ?? g.sport_key ?? 'Unknown',
              sport_key: g.sport_key ?? '',
              home_team: g.home_team,
              away_team: g.away_team,
              commence_time: g.commence_time,
              bookmakers: g.bookmakers ?? [],
              markets: (g.bookmakers ?? []).flatMap((b: any) => b.markets ?? []),
              expires_at: expires,
              game_id_uuid: gameIdMap[g.id],
            }));

          if (cacheRows.length > 0) {
            const { error: cacheErr } = await supabase
              .from('live_odds_cache')
              .upsert(cacheRows, { onConflict: 'sport_key,home_team,away_team' });
            if (cacheErr) {
              console.error('[v0] [cron/odds] live_odds_cache upsert error:', cacheErr.message);
            } else {
              cached = cacheRows.length;
              console.log(`[v0] [cron/odds] Cached ${cached} games`);
            }
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
