import { NextRequest, NextResponse } from 'next/server';
import { getOddsApiKey } from '@/lib/config';
import { EXTERNAL_APIS } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlayerPropResult {
  name: string;
  team: string;
  opponent: string;
  market: string;
  line: number;
  overOdds: number;
  underOdds: number;
  bestOverBook: string;
  bestUnderBook: string;
}

interface OddsApiBookmaker {
  title: string;
  markets: Array<{
    key: string;
    outcomes: Array<{
      name: string;
      description?: string;
      price: number;
      point?: number;
    }>;
  }>;
}

// ── Module-level 15-minute cache ───────────────────────────────────────────────

const propCache = new Map<string, { data: PlayerPropResult[]; ts: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// ── Sport-specific player prop markets ────────────────────────────────────────

const PROP_MARKETS: Record<string, string> = {
  baseball_mlb:
    'batter_hits,batter_home_runs,batter_rbis,pitcher_strikeouts,batter_total_bases',
  basketball_nba:
    'player_points,player_rebounds,player_assists,player_threes',
  americanfootball_nfl:
    'player_receptions,player_reception_yards,player_pass_tds,player_rush_yards',
  basketball_ncaab:
    'player_points,player_rebounds,player_assists',
};

const BASE_URL = EXTERNAL_APIS.ODDS_API.BASE_URL;
const MARKET_BATCH_SIZE = 4; // Odds API returns HTTP 422 when >4 markets per request

// ── GET /api/props?sport=baseball_mlb ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get('sport') ?? 'baseball_mlb';
  const apiKey = getOddsApiKey();

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'ODDS_API_KEY not configured',
      players: [],
      props: [],
      timestamp: new Date().toISOString(),
    });
  }

  // Return cached data if fresh
  const cached = propCache.get(sport);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({
      success: true,
      players: cached.data,
      props: toCompatProps(cached.data, sport),
      timestamp: new Date(cached.ts).toISOString(),
    });
  }

  try {
    // Step 1: Fetch today's event IDs — short timeout to leave budget for Step 2
    const eventsRes = await fetch(
      `${BASE_URL}/sports/${sport}/events?apiKey=${apiKey}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!eventsRes.ok) {
      throw new Error(`Events fetch failed: ${eventsRes.status}`);
    }
    const events: Array<{ id: string; home_team: string; away_team: string }> =
      await eventsRes.json();

    if (!Array.isArray(events) || events.length === 0) {
      // Cache the empty result only when events genuinely don't exist
      propCache.set(sport, { data: [], ts: Date.now() });
      return NextResponse.json({
        success: true,
        players: [],
        props: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Step 2: For each of up to 4 events, fetch prop markets in batches of ≤4.
    // The Odds API returns HTTP 422 when more than 4 markets are passed in one
    // request. Split into chunks of 4, fetch in parallel, then merge bookmakers.
    // Budget: 5s (events) + 5s (props) = 10s total, well within 30s maxDuration.
    const markets = PROP_MARKETS[sport] ?? PROP_MARKETS.baseball_mlb;
    const marketChunks = chunkArray(markets.split(','), MARKET_BATCH_SIZE);
    const top5 = events.slice(0, 4);
    const playerMap = new Map<string, PlayerPropResult>();

    await Promise.allSettled(
      top5.map(async event => {
        // Fetch each market chunk in parallel for this event
        const chunkResults = await Promise.all(
          marketChunks.map(async (chunk, ci) => {
            const marketsParam = chunk.join(',');
            const res = await fetch(
              `${BASE_URL}/sports/${sport}/events/${event.id}/odds` +
                `?apiKey=${apiKey}&regions=us&markets=${marketsParam}&oddsFormat=american`,
              { signal: AbortSignal.timeout(5_000) },
            );
            if (!res.ok) {
              console.warn(
                `[API/props] Chunk ${ci + 1}/${marketChunks.length} failed` +
                  ` for event ${event.id} (${marketsParam}): HTTP ${res.status}`,
              );
              return null;
            }
            return res.json() as Promise<{ bookmakers: OddsApiBookmaker[] }>;
          }),
        );

        // Merge bookmakers from all chunks — deduplicate by title, concat markets
        const bkMap = new Map<string, OddsApiBookmaker>();
        for (const result of chunkResults) {
          if (!result) continue;
          for (const bk of result.bookmakers ?? []) {
            if (bkMap.has(bk.title)) {
              bkMap.get(bk.title)!.markets.push(...bk.markets);
            } else {
              bkMap.set(bk.title, { ...bk, markets: [...bk.markets] });
            }
          }
        }

        if (bkMap.size === 0) return; // all chunks failed for this event

        // Process merged bookmakers into best-odds playerMap
        for (const bk of bkMap.values()) {
          for (const mkt of bk.markets ?? []) {
            const overs  = mkt.outcomes.filter(o => o.name === 'Over');
            const unders = mkt.outcomes.filter(o => o.name === 'Under');

            for (const over of overs) {
              const playerName = over.description ?? '';
              if (!playerName) continue;
              const line = over.point ?? 0;
              const under = unders.find(
                u => u.description === playerName && u.point === line,
              );
              if (!under) continue;

              const key = `${playerName}::${mkt.key}::${line}`;
              const existing = playerMap.get(key);

              if (!existing) {
                playerMap.set(key, {
                  name:          playerName,
                  homeTeam:      event.home_team,
                  awayTeam:      event.away_team,
                  team:          undefined,
                  market:        mkt.key,
                  line,
                  overOdds:      over.price,
                  underOdds:     under.price,
                  bestOverBook:  bk.title,
                  bestUnderBook: bk.title,
                });
              } else {
                // Keep best odds (highest = most favorable for bettor)
                if (over.price > existing.overOdds) {
                  existing.overOdds     = over.price;
                  existing.bestOverBook = bk.title;
                }
                if (under.price > existing.underOdds) {
                  existing.underOdds     = under.price;
                  existing.bestUnderBook = bk.title;
                }
              }
            }
          }
        }
      }),
    );

    const players = Array.from(playerMap.values());
    // Only cache non-empty results — a 0-player result from transient API
    // failures (e.g. 422, 429) should not lock out fresh data for 15 minutes.
    if (players.length > 0) {
      propCache.set(sport, { data: players, ts: Date.now() });
    }

    return NextResponse.json({
      success: true,
      players,
      props: toCompatProps(players, sport),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[API/props] Error:', err);
    return NextResponse.json({
      success: false,
      players: [],
      props: [],
      error: err instanceof Error ? err.message : 'Failed to fetch player props',
      timestamp: new Date().toISOString(),
    });
  }
}

// ── Backward-compat shape for OpportunitiesFeed (checks propsData.props) ──────
function toCompatProps(players: PlayerPropResult[], sport: string) {
  return players.map(p => ({
    player_name: p.name,
    stat_type:   p.market,
    line:        p.line,
    bookmaker:   p.bestOverBook,
    over_price:  p.overOdds,
    sport,
    game:        `${p.team} vs ${p.opponent}`,
    game_time:   new Date().toISOString(),
  }));
}
