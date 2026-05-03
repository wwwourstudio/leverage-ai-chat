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
import { getSupabaseUrl, getSupabaseServiceKey, verifyCronSecret } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 30;

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) throw new Error('Supabase service role not configured');
  return createClient(url, key, { db: { schema: 'api' } });
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ODDS_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'ODDS_API_KEY not set' }, { status: 500 });
  }

  const startedAt = Date.now();
  const sport = 'baseball_mlb';

  try {
    // p-retry is ESM-only; dynamic import keeps the module compatible with
    // Next.js Node.js serverless runtime bundling.
    const { default: pRetry } = await import('p-retry');

    // Game-level endpoint — batter_* and pitcher_* markets are available here
    const url =
      `https://api.the-odds-api.com/v4/sports/${sport}/odds/` +
      `?apiKey=${apiKey}&regions=us` +
      `&markets=batter_hits,batter_total_bases,batter_home_runs,pitcher_strikeouts` +
      `&oddsFormat=american`;

    // Retry once on 5xx (transient upstream errors); bail immediately on 4xx.
    // 10 s per attempt keeps worst-case total (10 + 2 + 10 = 22 s) under the 30 s limit.
    let resp: Response;
    try {
      resp = await pRetry(
        async () => {
          const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
          // 422 = no active markets — not retryable, surface immediately
          if (r.status === 422) return r;
          if (!r.ok) {
            const err = Object.assign(new Error(`Odds API returned HTTP ${r.status}`), { status: r.status });
            throw err;
          }
          return r;
        },
        {
          retries: 1,
          minTimeout: 2000,
          shouldRetry: (err: any) => {
            const status = err?.status ?? err?.response?.status;
            return !status || status >= 500;
          },
          onFailedAttempt: (err) => {
            console.warn(`[v0] [cron/props] attempt ${err.attemptNumber} failed: ${err.message}`);
          },
        }
      );
    } catch (err: any) {
      console.warn(`[v0] [cron/props] ${err.message}`);
      return NextResponse.json({ ok: false, error: err.message }, { status: 502 });
    }

    if (!resp.ok) {
      // 422 = no active prop markets for this sport/date; not an error
      if (resp.status === 422) {
        console.log(`[v0] [cron/props] No active ${sport} prop markets (422) — skipping`);
        return NextResponse.json({ ok: true, inserted: 0, note: 'No active prop markets' });
      }
      // Any other non-ok status that slipped through (shouldn't happen)
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
