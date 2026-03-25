/**
 * GET /api/cron/props
 *
 * Ingest Layer — MLB player props refresh.
 * Fetches prop markets from The Odds API (event-level endpoint) for the next
 * 3 upcoming MLB games and upserts them into api.player_props_markets so the
 * card generator can read from cache instead of hitting the API on every request.
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

const MLB_PROP_MARKETS = [
  'player_home_runs',
  'player_hits',
  'player_total_bases',
  'player_rbis',
  'player_runs',
  'player_stolen_bases',
  'player_hits_runs_rbis',
  'player_singles',
  'player_doubles',
  'player_walks',
  'player_strikeouts',
  'pitcher_strikeouts',
  'pitcher_hits_allowed',
  'pitcher_walks',
  'pitcher_earned_runs',
  'pitcher_outs',
];

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

  const startedAt = Date.now();
  const apiKey = process.env.ODDS_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'ODDS_API_KEY not set' }, { status: 500 });
  }

  try {
    const baseUrl = 'https://api.the-odds-api.com/v4';
    const sport = 'baseball_mlb';

    // Step 1 — fetch upcoming events to get event IDs
    const eventsResp = await fetch(`${baseUrl}/sports/${sport}/events?apiKey=${apiKey}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!eventsResp.ok) {
      const msg = `Events fetch failed: HTTP ${eventsResp.status}`;
      console.warn(`[v0] [cron/props] ${msg}`);
      return NextResponse.json({ ok: false, error: msg }, { status: 502 });
    }

    const events: any[] = await eventsResp.json();
    if (!events.length) {
      console.log('[v0] [cron/props] No upcoming MLB events');
      return NextResponse.json({ ok: true, inserted: 0, note: 'No upcoming events' });
    }

    const marketsParam = MLB_PROP_MARKETS.join(',');
    // Limit to first 3 events to stay within Odds API quota
    const eventsToFetch = events.slice(0, 3);
    const allRows: Record<string, object> = {};

    await Promise.allSettled(
      eventsToFetch.map(async (event: any) => {
        const url = `${baseUrl}/sports/${sport}/events/${event.id}/odds?apiKey=${apiKey}&regions=us&markets=${marketsParam}&oddsFormat=american`;
        try {
          const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
          if (!resp.ok) return; // 422 = no props yet, 429 = rate limit — skip silently

          const data = await resp.json();
          if (!data.bookmakers?.length) return;

          for (const bookmaker of data.bookmakers) {
            for (const market of bookmaker.markets ?? []) {
              // Group outcomes by player name
              const byPlayer: Record<string, { line: number | null; over: number | null; under: number | null }> = {};
              for (const outcome of market.outcomes ?? []) {
                const name = outcome.description || outcome.name;
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
                const id = `${event.id}-${playerName}-${market.key}`;
                allRows[id] = {
                  id,
                  sport,
                  game_id: event.id,
                  player_name: playerName,
                  stat_type: market.key.replace(/^player_/, ''),
                  line: pd.line,
                  over_odds: pd.over,
                  under_odds: pd.under,
                  bookmaker: bookmaker.title,
                  game_time: event.commence_time,
                  home_team: event.home_team,
                  away_team: event.away_team,
                  fetched_at: new Date().toISOString(),
                };
              }
            }
          }
        } catch {
          // Per-event error — skip and continue
        }
      }),
    );

    const rows = Object.values(allRows);
    let inserted = 0;

    if (rows.length > 0) {
      const supabase = getServiceClient();
      const { error } = await supabase
        .from('player_props_markets')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error('[v0] [cron/props] Upsert error:', error);
        return NextResponse.json(
          { ok: false, error: error.message, durationMs: Date.now() - startedAt },
          { status: 500 },
        );
      }
      inserted = rows.length;
    }

    console.log(`[v0] [cron/props] Upserted ${inserted} MLB props in ${Date.now() - startedAt}ms`);

    return NextResponse.json({
      ok: true,
      inserted,
      events: eventsToFetch.length,
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
