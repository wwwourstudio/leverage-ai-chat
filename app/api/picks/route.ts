/**
 * GET /api/picks
 *
 * Unified picks pipeline:
 *   1. Pull today's picks from daily_picks (Supabase)
 *   2. Enrich with live market odds from live_odds_cache (team-name join)
 *   3. Overlay sharp-money signals from line_movement (game_id join)
 *   4. Re-score with sharp boost → re-evaluate tier
 *   5. Return UI-ready JSON
 *
 * Query params:
 *   sport   – mlb | nba | nfl | nhl  (default: mlb)
 *   date    – YYYY-MM-DD             (default: today)
 *   limit   – 1-50                   (default: 25)
 *   tier    – ELITE | STRONG | LEAN  (optional filter)
 *   team    – partial team name      (optional filter, case-insensitive)
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tier = 'ELITE' | 'STRONG' | 'LEAN' | 'PASS';

interface DailyPick {
  id: number;
  pick_date: string;
  game_id: string | null;
  player_name: string;
  player_id: number | null;
  home_team: string | null;
  away_team: string | null;
  opposing_pitcher: string | null;
  pitcher_hand: string | null;
  home_umpire: string | null;
  model_probability: number;
  implied_probability: number;
  edge: number;
  adjusted_edge: number;
  score: number;
  tier: Tier;
  best_odds: number;
  best_book: string;
  prop_line: number | null;
  all_lines: BookLine[] | null;
  weather_factor: number;
  matchup_factor: number;
  park_factor: number;
  umpire_boost: number;
  bullpen_factor: number;
  sharp_boosted: boolean;
  data_source: string | null;
}

interface BookLine {
  bookmaker: string;
  overOdds: number;
  impliedProbability: number;
}

interface OddsCache {
  game_id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  sport_key: string;
  bookmakers: BookmakerEntry[];
  markets: unknown;
}

interface BookmakerEntry {
  key: string;
  title: string;
  markets?: MarketEntry[];
}

interface MarketEntry {
  key: string;
  outcomes?: OutcomeEntry[];
}

interface OutcomeEntry {
  name: string;
  price: number;
  point?: number;
}

interface LineMovement {
  game_id: string;
  bookmaker: string;
  market_type: string;
  old_line: number | null;
  new_line: number | null;
  line_change: number | null;
  old_odds: number | null;
  new_odds: number | null;
  timestamp: string;
}

interface EnrichedPick extends DailyPick {
  // Live market context
  game_commence: string | null;
  best_ml_home: number | null;
  best_ml_away: number | null;
  spread_home: number | null;
  total: number | null;
  // Sharp money
  movement_count: number;
  sharp_boost_applied: number;  // how much we added to score
  final_score: number;
  final_tier: Tier;
  // Composite context for UI
  game_label: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

/** Maps user-facing sport slug → Odds API sport_key */
const SPORT_KEY_MAP: Record<string, string> = {
  mlb:  'baseball_mlb',
  nba:  'basketball_nba',
  nfl:  'americanfootball_nfl',
  nhl:  'icehockey_nhl',
  ncaab: 'basketball_ncaab',
  ncaaf: 'americanfootball_ncaaf',
};

/** Score thresholds for tier assignment */
function getTier(score: number): Tier {
  if (score >= 8.0)  return 'ELITE';
  if (score >= 5.5)  return 'STRONG';
  if (score >= 3.0)  return 'LEAN';
  return 'PASS';
}

/** Sharp-money boost: each distinct line-movement record = +0.3 score points, capped at +2.0 */
const SHARP_BOOST_PER_MOVE = 0.3;
const SHARP_BOOST_CAP      = 2.0;

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const sportSlug = (searchParams.get('sport') || 'mlb').toLowerCase();
  const dateParam = searchParams.get('date') || todayUTC();
  const limitRaw  = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 25)));
  const tierFilter = searchParams.get('tier')?.toUpperCase() as Tier | undefined;
  const teamFilter = searchParams.get('team')?.toLowerCase();

  const sportKey = SPORT_KEY_MAP[sportSlug] ?? 'baseball_mlb';

  try {
    const supabase = await createClient();

    // ── STEP 1: Fetch today's picks (filtered by date) ─────────────────────
    let picksQuery = supabase
      .from('daily_picks')
      .select('*')
      .eq('pick_date', dateParam)
      .not('tier', 'eq', 'PASS')          // exclude PASS by default
      .order('score', { ascending: false })
      .limit(limitRaw * 3);               // over-fetch before tier/team filter

    if (tierFilter) {
      picksQuery = picksQuery.eq('tier', tierFilter);
    }

    const { data: picks, error: picksErr } = await picksQuery;
    if (picksErr) throw picksErr;

    const safePicks: DailyPick[] = (picks ?? []) as DailyPick[];

    // ── STEP 2: Pull live odds for this sport ─────────────────────────────
    const { data: oddsRows, error: oddsErr } = await supabase
      .from('live_odds_cache')
      .select('game_id, home_team, away_team, commence_time, sport_key, bookmakers, markets')
      .eq('sport_key', sportKey)
      .gt('expires_at', new Date().toISOString())  // non-expired cache entries only
      .order('commence_time', { ascending: true })
      .limit(30);

    if (oddsErr) {
      console.warn('[API/picks] live_odds_cache query failed:', oddsErr.message);
    }

    const safeOdds: OddsCache[] = (oddsRows ?? []) as OddsCache[];

    // Build lookup: "<home>|<away>" → odds row (lower-cased for fuzzy join)
    const oddsIndex = new Map<string, OddsCache>();
    for (const row of safeOdds) {
      const key = `${row.home_team.toLowerCase()}|${row.away_team.toLowerCase()}`;
      oddsIndex.set(key, row);
    }

    // ── STEP 3: Pull line-movement for these games ─────────────────────────
    const oddsGameIds = safeOdds.map(r => r.game_id).filter(Boolean);

    // Line-movement records within the last 4 hours = "live sharp activity"
    const sharpWindowStart = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    let movements: LineMovement[] = [];
    if (oddsGameIds.length > 0) {
      const { data: movData, error: movErr } = await supabase
        .from('line_movement')
        .select('game_id, bookmaker, market_type, old_line, new_line, line_change, old_odds, new_odds, timestamp')
        .in('game_id', oddsGameIds)
        .gte('timestamp', sharpWindowStart)
        .order('timestamp', { ascending: false })
        .limit(200);

      if (movErr) {
        console.warn('[API/picks] line_movement query failed:', movErr.message);
      } else {
        movements = (movData ?? []) as LineMovement[];
      }
    }

    // Build lookup: game_id → movement records
    const movIndex = new Map<string, LineMovement[]>();
    for (const m of movements) {
      const arr = movIndex.get(m.game_id) ?? [];
      arr.push(m);
      movIndex.set(m.game_id, arr);
    }

    // ── STEP 4: Enrich picks with odds + sharp signals ─────────────────────
    const enriched: EnrichedPick[] = [];

    for (const pick of safePicks) {
      // Optional team filter
      if (teamFilter) {
        const homeMatch = pick.home_team?.toLowerCase().includes(teamFilter);
        const awayMatch = pick.away_team?.toLowerCase().includes(teamFilter);
        if (!homeMatch && !awayMatch) continue;
      }

      // Find matching odds row by team name pair
      const oddsKey = `${(pick.home_team ?? '').toLowerCase()}|${(pick.away_team ?? '').toLowerCase()}`;
      const odds = oddsIndex.get(oddsKey) ?? null;

      // Extract headline ML odds from first two bookmakers
      let bestMlHome: number | null = null;
      let bestMlAway: number | null = null;
      let spreadHome: number | null = null;
      let total: number | null = null;

      if (odds) {
        for (const book of (odds.bookmakers ?? []).slice(0, 3)) {
          for (const mkt of (book.markets ?? [])) {
            if (mkt.key === 'h2h' && bestMlHome === null) {
              const home = mkt.outcomes?.find(o => o.name === odds.home_team);
              const away = mkt.outcomes?.find(o => o.name === odds.away_team);
              if (home) bestMlHome = home.price;
              if (away) bestMlAway = away.price;
            }
            if (mkt.key === 'spreads' && spreadHome === null) {
              const home = mkt.outcomes?.find(o => o.name === odds.home_team);
              if (home) spreadHome = home.point ?? null;
            }
            if (mkt.key === 'totals' && total === null) {
              const over = mkt.outcomes?.find(o => o.name === 'Over');
              if (over) total = over.point ?? null;
            }
          }
        }
      }

      // Sharp boost from line movement
      const gameId = odds?.game_id ?? pick.game_id ?? null;
      const gameMoves = gameId ? (movIndex.get(gameId) ?? []) : [];
      const rawBoost = Math.min(gameMoves.length * SHARP_BOOST_PER_MOVE, SHARP_BOOST_CAP);
      const sharpBoost = gameMoves.length > 0 ? rawBoost : 0;

      const finalScore = Math.min(pick.score + sharpBoost, 20); // cap at 20
      const finalTier  = getTier(finalScore);

      enriched.push({
        ...pick,
        game_commence:      odds?.commence_time ?? null,
        best_ml_home:       bestMlHome,
        best_ml_away:       bestMlAway,
        spread_home:        spreadHome,
        total,
        movement_count:     gameMoves.length,
        sharp_boost_applied: sharpBoost,
        final_score:        finalScore,
        final_tier:         finalTier,
        game_label: [pick.away_team, '@', pick.home_team]
          .filter(Boolean)
          .join(' ') || 'TBD',
      });

      if (enriched.length >= limitRaw) break;
    }

    // Re-sort by final_score after boost
    enriched.sort((a, b) => b.final_score - a.final_score);

    // ── STEP 5: Build game-level summary ───────────────────────────────────
    //   Group picks by game so the UI can render per-game cards
    const gamesMap = new Map<string, {
      game_label: string;
      home_team: string | null;
      away_team: string | null;
      commence_time: string | null;
      best_ml_home: number | null;
      best_ml_away: number | null;
      spread_home: number | null;
      total: number | null;
      sharp_activity: boolean;
      picks: EnrichedPick[];
    }>();

    for (const pick of enriched) {
      const key = pick.game_label;
      if (!gamesMap.has(key)) {
        gamesMap.set(key, {
          game_label:    pick.game_label,
          home_team:     pick.home_team,
          away_team:     pick.away_team,
          commence_time: pick.game_commence,
          best_ml_home:  pick.best_ml_home,
          best_ml_away:  pick.best_ml_away,
          spread_home:   pick.spread_home,
          total:         pick.total,
          sharp_activity: pick.movement_count > 2,
          picks: [],
        });
      }
      gamesMap.get(key)!.picks.push(pick);
    }

    const games = [...gamesMap.values()];

    // ── STEP 6: Summary stats ──────────────────────────────────────────────
    const tierCounts = enriched.reduce<Record<string, number>>((acc, p) => {
      acc[p.final_tier] = (acc[p.final_tier] ?? 0) + 1;
      return acc;
    }, {});

    const sharpCount = enriched.filter(p => p.movement_count > 0).length;
    const avgEdge    = enriched.length
      ? enriched.reduce((s, p) => s + p.adjusted_edge, 0) / enriched.length
      : 0;

    return Response.json({
      success:    true,
      sport:      sportSlug,
      date:       dateParam,
      generated:  new Date().toISOString(),
      summary: {
        total_picks:   enriched.length,
        total_games:   games.length,
        tier_counts:   tierCounts,
        sharp_picks:   sharpCount,
        avg_edge_pp:   Number(avgEdge.toFixed(2)),
        live_odds_available: safeOdds.length > 0,
        line_movements_today: movements.length,
      },
      games,
      top_picks: enriched.slice(0, 15),
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API/picks] Pipeline error:', msg);
    return Response.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
