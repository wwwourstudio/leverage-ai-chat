/**
 * GET /api/cron/props
 *
 * Ingest Layer — MLB player props refresh.
 * Fetches batter/pitcher prop markets from The Odds API game-level endpoint
 * and upserts into api.player_props_markets so the card generator reads from
 * cache instead of hitting the live API on every request.
 *
 * Vercel Cron schedule: every 10 minutes  (*\/10 * * * *)
 * Auth: CRON_SECRET query param or header
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 30;

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) throw new Error('Supabase service role not configured');
  return createClient(url, key, { db: { schema: 'api' } });
}

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
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const apiKey = process.env.ODDS_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'ODDS_API_KEY not set' }, { status: 500 });
  }

  const startedAt = Date.now();
  const sport = 'baseball_mlb';

  try {
    // Game-level endpoint — batter_* and pitcher_* markets are available here
    const url =
      `https://api.the-odds-api.com/v4/sports/${sport}/odds/` +
      `?apiKey=${apiKey}&regions=us` +
      `&markets=batter_hits,batter_total_bases,batter_home_runs,pitcher_strikeouts` +
      `&oddsFormat=american`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });

    if (!resp.ok) {
      // 422 = no active prop markets for this sport/date; not an error
      if (resp.status === 422) {
        console.log(`[v0] [cron/props] No active ${sport} prop markets (422) — skipping`);
        return NextResponse.json({ ok: true, inserted: 0, note: 'No active prop markets' });
      }
      const msg = `Odds API returned HTTP ${resp.status}`;
      console.warn(`[v0] [cron/props] ${msg}`);
      return NextResponse.json({ ok: false, error: msg }, { status: 502 });
    }

    const games: any[] = await resp.json();
    if (!games.length) {
      return NextResponse.json({ ok: true, inserted: 0, note: 'No upcoming games' });
    }

    // Deduplicate by (player_name, stat_type, bookmaker, game_id) — the unique
    // constraint that exists in the live DB as player_props_unique_prop
    const seen = new Map<string, object>();

    for (const game of games) {
      for (const bookmaker of game.bookmakers ?? []) {
        for (const market of bookmaker.markets ?? []) {
          // Group outcomes by player name
          const byPlayer: Record<string, { line: number | null; over: number | null; under: number | null }> = {};

          for (const outcome of market.outcomes ?? []) {
            const name: string = outcome.description || outcome.name;
            if (!byPlayer[name]) byPlayer[name] = { line: null, over: null, under: null };
            if (outcome.name === 'Over') {
              byPlayer[name].over = outcome.price;
              byPlayer[name].line = outcome.point ?? byPlayer[name].line;
            } else if (outcome.name === 'Under') {
              byPlayer[name].under = outcome.price;
              byPlayer[name].line = outcome.point ?? byPlayer[name].line;
            }
          }

          for (const [playerName, pd] of Object.entries(byPlayer)) {
            if (pd.over == null || pd.under == null) continue;

            // Dedup key matches the unique constraint columns
            const dedupeKey = `${game.id}||${playerName}||${market.key}||${bookmaker.title}`;
            seen.set(dedupeKey, {
              id: `${game.id}-${playerName}-${market.key}`,
              sport,
              game_id: game.id,
              player_name: playerName,
              stat_type: market.key,
              line: pd.line,
              over_odds: pd.over,
              under_odds: pd.under,
              bookmaker: bookmaker.title,
              game_time: game.commence_time,
              home_team: game.home_team,
              away_team: game.away_team,
              fetched_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    const rows = Array.from(seen.values());
    let inserted = 0;

    if (rows.length > 0) {
      const supabase = getServiceClient();
      // player_props_unique_prop covers (player_name, stat_type, bookmaker, game_id)
      const { error } = await supabase
        .from('player_props_markets')
        .upsert(rows, { onConflict: 'player_props_unique_prop' });

      if (error) {
        console.error('[v0] [cron/props] Upsert error:', error);
        return NextResponse.json(
          { ok: false, error: error.message, durationMs: Date.now() - startedAt },
          { status: 500 },
        );
      }
      inserted = rows.length;
    }

    console.log(`[v0] [cron/props] Upserted ${inserted} MLB props from ${games.length} games in ${Date.now() - startedAt}ms`);

    return NextResponse.json({
      ok: true,
      inserted,
      sport,
      games: games.length,
      durationMs: Date.now() - startedAt,
      runAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[v0] [cron/props] Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Props ingest failed', durationMs: Date.now() - startedAt },
      { status: 500 },
    );
  }
}
