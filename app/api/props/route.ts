import { NextRequest, NextResponse } from 'next/server';
import { getOddsApiKey } from '@/lib/config';
import { EXTERNAL_APIS } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ── Module-level 15-minute cache ───────────────────────────────────────────────
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
    // Step 1: Fetch today's event IDs
    const eventsRes = await fetch(
      `${BASE_URL}/sports/${sport}/events?apiKey=${apiKey}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!eventsRes.ok) {
      throw new Error(`Events fetch failed: ${eventsRes.status}`);
    }
    const events: Array<{ id: string; home_team: string; away_team: string }> =
      await eventsRes.json();

    if (!Array.isArray(events) || events.length === 0) {
      propCache.set(sport, { data: [], ts: Date.now() });
      return NextResponse.json({
        success: true,
        players: [],
        props: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Step 2: Fetch player prop odds for up to 5 events in parallel
    const markets = PROP_MARKETS[sport] ?? PROP_MARKETS.baseball_mlb;
    const top5 = events.slice(0, 5);
    const playerMap = new Map<string, PlayerPropResult>();

    await Promise.allSettled(
      top5.map(async event => {
        const res = await fetch(
          `${BASE_URL}/sports/${sport}/events/${event.id}/odds` +
            `?apiKey=${apiKey}&regions=us&markets=${markets}&oddsFormat=american`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (!res.ok) return;

        const eventOdds: {
          home_team: string;
          away_team: string;
          bookmakers: Array<{
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
          }>;
        } = await res.json();

        for (const bk of eventOdds.bookmakers ?? []) {
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
                  team:          event.home_team,
                  opponent:      event.away_team,
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
    propCache.set(sport, { data: players, ts: Date.now() });

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
