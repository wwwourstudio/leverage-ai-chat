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

          // Step 2 — refresh live_odds_cache using delete + insert.
          // Avoids "ON CONFLICT DO UPDATE command cannot affect row a second time" which
          // occurs with batch upserts when doubleheaders produce multiple games for the
          // same (sport_key, home_team, away_team) unique key. By deleting first there
          // is no existing row to conflict with, so a plain insert always succeeds.
          // Deduplicate by (sport_key, home_team, away_team) — keep first game per matchup.
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
            // Delete existing rows for the sports we're about to refresh
            const sportsInBatch = [...new Set(cacheRows.map((r: any) => r.sport_key).filter(Boolean))];
            const { error: deleteErr } = await supabase
              .from('live_odds_cache')
              .delete()
              .in('sport_key', sportsInBatch);
            if (deleteErr) {
              console.error('[v0] [cron/odds] live_odds_cache delete error:', deleteErr.message);
            }

            // Fresh insert — no conflict possible since we just cleared the rows
            const { error: cacheErr } = await supabase
              .from('live_odds_cache')
              .insert(cacheRows);
            if (cacheErr) {
              console.error('[v0] [cron/odds] live_odds_cache insert error:', cacheErr.message);
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

    // ── Persist: odds_snapshots + closing_lines ───────────────────────────────
    // odds_snapshots: insert one row per bookmaker/market/outcome across all games.
    // closing_lines: when a game has started (commence_time <= now), upsert the
    //   most recent price as the closing line for CLV tracking.
    let snapshotsInserted = 0;
    let closingLinesWritten = 0;
    if (oddsResult.length > 0) {
      try {
        const supabase = getServiceClient();
        const capturedAt = new Date().toISOString();
        const nowMs = Date.now();

        const snapshotRows: Record<string, unknown>[] = [];
        const closingRows: Record<string, unknown>[] = [];

        for (const game of oddsResult as any[]) {
          if (!game?.id || !Array.isArray(game.bookmakers)) continue;
          const gameStarted = game.commence_time && new Date(game.commence_time).getTime() <= nowMs;

          for (const book of game.bookmakers) {
            if (!Array.isArray(book.markets)) continue;
            for (const market of book.markets) {
              if (!Array.isArray(market.outcomes)) continue;
              for (const outcome of market.outcomes) {
                if (outcome.price == null) continue;

                snapshotRows.push({
                  game_id: game.id,
                  bookmaker: book.key,
                  market: market.key,
                  outcome: outcome.name,
                  price: outcome.price,
                  point: outcome.point ?? null,
                  captured_at: capturedAt,
                });

                // Record closing line when game has started (last price before tip-off)
                if (gameStarted) {
                  closingRows.push({
                    game_id: game.id,
                    market: market.key,
                    outcome: outcome.name,
                    closing_price: outcome.price,
                    bookmaker: book.key,
                    captured_at: capturedAt,
                  });
                }
              }
            }
          }
        }

        // Insert snapshots in batches of 500 to stay within Supabase row limits
        const BATCH = 500;
        for (let i = 0; i < snapshotRows.length; i += BATCH) {
          const { error: snapErr } = await supabase
            .from('odds_snapshots')
            .insert(snapshotRows.slice(i, i + BATCH));
          if (snapErr) {
            console.error('[v0] [cron/odds] odds_snapshots insert error:', snapErr.message);
          } else {
            snapshotsInserted += Math.min(BATCH, snapshotRows.length - i);
          }
        }

        // Upsert closing lines (one per game/market/outcome/book)
        if (closingRows.length > 0) {
          const { error: clvErr } = await supabase
            .from('closing_lines')
            .upsert(closingRows, { onConflict: 'game_id,market,outcome,bookmaker' });
          if (clvErr) {
            console.error('[v0] [cron/odds] closing_lines upsert error:', clvErr.message);
          } else {
            closingLinesWritten = closingRows.length;
          }
        }

        if (snapshotsInserted > 0) {
          console.log(`[v0] [cron/odds] Inserted ${snapshotsInserted} odds snapshots, ${closingLinesWritten} closing lines`);
        }
      } catch (snapErr) {
        console.error('[v0] [cron/odds] Snapshot write exception:', snapErr);
      }
    }

    return NextResponse.json({
      success: true,
      meta: {
        gamesFetched: oddsResult?.length ?? 0,
        gamesCached: cached,
        snapshotsInserted,
        closingLinesWritten,
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
