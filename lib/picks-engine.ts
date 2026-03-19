/**
 * Daily Picks Engine
 *
 * Automated MLB HR prop analysis pipeline. Runs daily (via cron) to surface
 * ELITE / STRONG / LEAN bets ranked by model edge over the market.
 *
 * DATA FLOW
 * ─────────
 *   HR Prop Markets (Odds API)
 *     → Players with active props today
 *     → MLBAM ID + team (player-map.ts)
 *     → Game schedule (mlb-schedule.ts) — pitcher + venue
 *     → Statcast features (baseball-savant.ts) — 14-day or season
 *     → Weather (weather/index.ts) — Open-Meteo at stadium lat/lon
 *     → Pitcher HR susceptibility (baseball-savant.ts — pitcher data)
 *     → HR model (hrEngine.ts) — Bayesian logistic [0,1]
 *     → rankBet() (card-pipeline.ts) — edge + ELITE/STRONG/LEAN/PASS
 *     → Supabase daily_picks table
 *
 * Only players with PASS-or-better edge AND at least one book line are saved.
 * PASS-tier picks are excluded from the default API response but kept for audit.
 */

import { getOddsApiKey } from '@/lib/config';
import { logger, LogCategory } from '@/lib/logger';
import type { BetTier } from '@/lib/card-pipeline';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PickResult {
  pickDate:           string;   // YYYY-MM-DD
  gameId:             number | null;
  playerName:         string;
  canonicalName:      string;
  mlbamId:            number | null;
  homeTeam:           string;
  awayTeam:           string;
  opposingPitcher:    string | null;
  pitcherHand:        'L' | 'R' | null;
  /** Model probability per PA [0,1] */
  modelProbability:   number;
  /** Best market-implied probability [0,1] */
  impliedProbability: number;
  /** Base edge (no adjustments) pp */
  edge:               number;
  /** Weather + matchup adjusted edge pp */
  adjustedEdge:       number;
  /** Final score = adjustedEdge + sharp bonus */
  score:              number;
  tier:               BetTier;
  bestOdds:           number;
  bestBook:           string;
  line:               number;
  allLines:           Array<{ bookmaker: string; overOdds: number; impliedProbability: number }>;
  weatherFactor:      number;
  matchupFactor:      number;
  sharpBoosted:       boolean;
  dataSource:         string;
  /** ISO timestamp of generation */
  generatedAt:        string;
}

export interface GeneratePicksOptions {
  /** YYYY-MM-DD. Defaults to today ET. */
  date?:     string;
  /** Skip tiers below this. Default: 'LEAN' (excludes PASS) */
  minTier?:  BetTier;
  /** Max concurrent player analyses. Default: 5 */
  concurrency?: number;
}

// Tier ordering for minimum threshold comparisons
const TIER_ORDER: Record<BetTier, number> = { ELITE: 4, STRONG: 3, LEAN: 2, PASS: 1 };

/** League-average pitcher stats for HR susceptibility estimation */
const LEAGUE_AVG_PITCHER_EV     = 88.0; // mph exit velocity allowed
const LEAGUE_AVG_PITCHER_BARREL = 7.0;  // barrel % allowed

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Run the full daily picks pipeline for MLB HR props.
 *
 * 1. Fetch all active HR prop markets from The Odds API
 * 2. For each player with a market:
 *    a. Resolve MLBAM ID + team
 *    b. Find today's game (for pitcher + weather context)
 *    c. Compute Statcast-based model probability
 *    d. Rank with weather + matchup adjustments
 * 3. Filter to minTier and above
 * 4. Sort: ELITE → STRONG → LEAN, then by score desc
 *
 * Returns [] when ODDS_API_KEY is not configured.
 */
export async function generateDailyPicks(
  opts: GeneratePicksOptions = {},
): Promise<PickResult[]> {
  const { date, minTier = 'LEAN', concurrency = 5 } = opts;

  const oddsApiKey = getOddsApiKey();
  if (!oddsApiKey) {
    logger.warn(LogCategory.API, 'picks_engine_no_key', {});
    return [];
  }

  const pickDate = date ?? getTodayDateET();
  const t0 = Date.now();
  logger.info(LogCategory.API, 'picks_engine_start', { metadata: { pickDate, minTier } });

  // ── Step 1: Get all HR prop markets ────────────────────────────────────────
  const { getAllHRLines } = await import('@/lib/card-pipeline');
  const allLines = await fetchAllHRPropPlayers(oddsApiKey);
  if (allLines.size === 0) {
    logger.info(LogCategory.API, 'picks_engine_no_markets', { metadata: { pickDate } });
    return [];
  }

  // ── Step 2: Get today's MLB schedule ──────────────────────────────────────
  const { getTodayGames } = await import('@/lib/mlb-schedule');
  const games = await getTodayGames(pickDate);

  // ── Step 3: Analyse each player (bounded concurrency) ─────────────────────
  const playerNames = [...allLines.keys()];
  const picks: PickResult[] = [];

  for (let i = 0; i < playerNames.length; i += concurrency) {
    const batch = playerNames.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(name => analyzePlayer(name, allLines.get(name)!, games, pickDate, oddsApiKey)),
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) picks.push(r.value);
    }
  }

  // ── Step 4: Filter + sort ─────────────────────────────────────────────────
  const minOrder = TIER_ORDER[minTier];
  const filtered = picks
    .filter(p => TIER_ORDER[p.tier] >= minOrder)
    .sort((a, b) => {
      const tierDiff = TIER_ORDER[b.tier] - TIER_ORDER[a.tier];
      return tierDiff !== 0 ? tierDiff : b.score - a.score;
    });

  const elapsed = Date.now() - t0;
  logger.info(LogCategory.API, 'picks_engine_done', {
    metadata: { pickDate, total: picks.length, filtered: filtered.length, elapsedMs: elapsed },
  });

  return filtered;
}

/**
 * Save a set of picks to Supabase `daily_picks` table.
 * Uses upsert on (pick_date, mlbam_id, game_id) to be idempotent.
 * Non-throwing — logs warning on failure.
 */
export async function savePicks(picks: PickResult[]): Promise<void> {
  if (picks.length === 0) return;
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const rows = picks.map(p => ({
      pick_date:            p.pickDate,
      game_id:              p.gameId ? String(p.gameId) : null,
      player_name:          p.canonicalName,
      player_id:            p.mlbamId,
      home_team:            p.homeTeam,
      away_team:            p.awayTeam,
      opposing_pitcher:     p.opposingPitcher,
      pitcher_hand:         p.pitcherHand,
      model_probability:    p.modelProbability,
      implied_probability:  p.impliedProbability,
      edge:                 p.edge,
      adjusted_edge:        p.adjustedEdge,
      score:                p.score,
      tier:                 p.tier,
      best_odds:            p.bestOdds,
      best_book:            p.bestBook,
      prop_line:            p.line,
      all_lines:            p.allLines,
      weather_factor:       p.weatherFactor,
      matchup_factor:       p.matchupFactor,
      sharp_boosted:        p.sharpBoosted,
      data_source:          p.dataSource,
      generated_at:         p.generatedAt,
    }));

    const { error } = await supabase
      .from('daily_picks')
      .upsert(rows, { onConflict: 'pick_date,player_id,game_id' });

    if (error) {
      logger.warn(LogCategory.API, 'picks_save_failed', { metadata: { error: error.message } });
    }
  } catch (err) {
    logger.warn(LogCategory.API, 'picks_save_error', {
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Retrieve saved picks from Supabase for a given date.
 * Falls back to [] when the table doesn't exist or on error.
 */
export async function getSavedPicks(
  date?: string,
  minTier: BetTier = 'LEAN',
): Promise<PickResult[]> {
  const pickDate = date ?? getTodayDateET();
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const tiers: BetTier[] = [];
    for (const [t, order] of Object.entries(TIER_ORDER) as [BetTier, number][]) {
      if (order >= TIER_ORDER[minTier]) tiers.push(t);
    }

    const { data, error } = await supabase
      .from('daily_picks')
      .select('*')
      .eq('pick_date', pickDate)
      .in('tier', tiers)
      .order('score', { ascending: false });

    if (error) return [];

    return (data ?? []).map(row => ({
      pickDate:           row.pick_date,
      gameId:             row.game_id ? Number(row.game_id) : null,
      playerName:         row.player_name,
      canonicalName:      row.player_name,
      mlbamId:            row.player_id,
      homeTeam:           row.home_team ?? '',
      awayTeam:           row.away_team ?? '',
      opposingPitcher:    row.opposing_pitcher,
      pitcherHand:        row.pitcher_hand,
      modelProbability:   row.model_probability,
      impliedProbability: row.implied_probability,
      edge:               row.edge,
      adjustedEdge:       row.adjusted_edge,
      score:              row.score,
      tier:               row.tier as BetTier,
      bestOdds:           row.best_odds,
      bestBook:           row.best_book,
      line:               row.prop_line,
      allLines:           row.all_lines ?? [],
      weatherFactor:      row.weather_factor ?? 1,
      matchupFactor:      row.matchup_factor ?? 1,
      sharpBoosted:       row.sharp_boosted ?? false,
      dataSource:         row.data_source ?? 'unknown',
      generatedAt:        row.generated_at,
    }));
  } catch {
    return [];
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/** Fetch all HR prop lines from Odds API and return a Map<playerName, lines[]> */
async function fetchAllHRPropPlayers(
  apiKey: string,
): Promise<Map<string, Array<{ bookmaker: string; overOdds: number; line: number; impliedProbability: number }>>> {
  const map = new Map<string, Array<{ bookmaker: string; overOdds: number; line: number; impliedProbability: number }>>();
  try {
    const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=${apiKey}&regions=us&markets=player_home_runs&oddsFormat=american`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return map;

    const games = await res.json() as Array<{
      bookmakers?: Array<{
        title: string;
        markets?: Array<{
          key: string;
          outcomes?: Array<{ name: string; price: number; point?: number }>;
        }>;
      }>;
    }>;

    const americanToProb = (odds: number) =>
      odds > 0 ? 100 / (odds + 100) : (-odds) / (-odds + 100);

    for (const game of games) {
      for (const book of (game.bookmakers ?? [])) {
        for (const market of (book.markets ?? [])) {
          if (market.key !== 'player_home_runs') continue;
          for (const outcome of (market.outcomes ?? [])) {
            const name  = outcome.name;
            const entry = {
              bookmaker:          book.title,
              overOdds:           outcome.price,
              line:               outcome.point ?? 0.5,
              impliedProbability: americanToProb(outcome.price),
            };
            const existing = map.get(name) ?? [];
            existing.push(entry);
            map.set(name, existing);
          }
        }
      }
    }

    // Sort each player's lines best → worst
    for (const [name, lines] of map) {
      map.set(name, lines.sort((a, b) => b.overOdds - a.overOdds));
    }
  } catch (err) {
    logger.warn(LogCategory.API, 'picks_odds_fetch_failed', {
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
  }
  return map;
}

type PropLines = Array<{ bookmaker: string; overOdds: number; line: number; impliedProbability: number }>;

/** Analyse a single player and produce a PickResult (or null when data is insufficient) */
async function analyzePlayer(
  playerName:  string,
  propLines:   PropLines,
  games:       import('@/lib/mlb-schedule').ScheduledGame[],
  pickDate:    string,
  _oddsApiKey: string,
): Promise<PickResult | null> {
  try {
    // 1. MLBAM ID + team ───────────────────────────────────────────────────────
    const { getPlayerByName } = await import('@/lib/player-map');
    const profile = await getPlayerByName(playerName).catch(() => null);
    const mlbamId      = profile?.id ?? null;
    const canonicalName = profile?.fullName ?? playerName;
    const teamName     = profile?.team ?? '';
    const batterHand   = (profile?.batSide as 'L' | 'R' | undefined) ?? undefined;

    // 2. Match game ────────────────────────────────────────────────────────────
    const { findGameForTeam, getOpposingPitcher } = await import('@/lib/mlb-schedule');
    const game    = teamName ? findGameForTeam(games, teamName) : null;
    const pitcher = game ? getOpposingPitcher(game, teamName) : null;

    // 3. Statcast features ─────────────────────────────────────────────────────
    const { getRecentStatcast, getStatcastData, queryStatcast } = await import('@/lib/baseball-savant');

    let barrelRate  = 0; // fraction 0–1
    let avgExitVelo = 0;
    let sampleSize  = 0;
    let dataSource  = 'fallback';

    const recent = await getRecentStatcast(canonicalName, 14, mlbamId ?? undefined).catch(() => null);
    if (recent && recent.sampleSize >= 10) {
      barrelRate  = recent.barrelRate  / 100;
      avgExitVelo = recent.avgExitVelo;
      sampleSize  = recent.sampleSize;
      dataSource  = 'recent_14d';
    } else {
      const { players } = await getStatcastData().catch(() => ({ players: [] as import('@/lib/baseball-savant').StatcastPlayer[] }));
      const match = queryStatcast(players, { player: canonicalName, playerType: 'batter', limit: 1 });
      if (match.length > 0) {
        barrelRate  = match[0].barrelRate  / 100;
        avgExitVelo = match[0].exitVelocity;
        sampleSize  = match[0].pa;
        dataSource  = 'season';
      }
    }

    if (sampleSize === 0) return null; // no Statcast data

    // 4. Model probability ────────────────────────────────────────────────────
    const { computeHRProb, fairAmericanOdds } = await import('@/lib/hrEngine');
    const airPullRate   = Math.min(0.60, barrelRate * 2.2);
    const modelProbability = computeHRProb({
      airPullRate,
      barrelRate,
      avgExitVelocity:      avgExitVelo,
      platoonAdvantage:     0,
      parkHRFactor:         1.0,
      pitcherHRSuppression: 0.5,
      sampleSize,
    });

    // 5. Pitcher HR susceptibility from Statcast pitcher data ─────────────────
    let pitcherHR9 = 1.2; // league average default
    if (pitcher?.fullName) {
      const { players: pitchers } = await getStatcastData().catch(() => ({ players: [] as import('@/lib/baseball-savant').StatcastPlayer[] }));
      const pitcherData = queryStatcast(pitchers, { player: pitcher.fullName, playerType: 'pitcher', limit: 1 });
      if (pitcherData.length > 0) {
        const pd = pitcherData[0];
        // HR susceptibility: high EV allowed + high barrel% allowed = HR-prone pitcher
        pitcherHR9 = 1.2 * (pd.exitVelocity / LEAGUE_AVG_PITCHER_EV) * (pd.barrelRate / LEAGUE_AVG_PITCHER_BARREL);
        pitcherHR9 = Math.max(0.4, Math.min(3.0, pitcherHR9));
      }
    }

    // 6. Weather factor ───────────────────────────────────────────────────────
    let weatherFactor = 1.0;
    if (game && !game.isDome) {
      try {
        const { fetchWeatherForLocation, weatherHRFactor } = await import('@/lib/weather/index');
        const { resolveHomeTeamCoords } = await import('@/lib/picks-engine-helpers');
        const coords = resolveHomeTeamCoords(game.homeTeam);
        if (coords) {
          const weather = await fetchWeatherForLocation(coords.lat, coords.lon);
          if (weather) {
            weatherFactor = weatherHRFactor({
              temp:      weather.temperature,
              windSpeed: weather.windSpeed,
              windDeg:   0, // wind direction not in WeatherData top-level
              homeTeam:  game.homeTeam,
            });
          }
        }
      } catch {
        // Non-fatal — weather stays 1.0
      }
    }

    // 7. Matchup factor ───────────────────────────────────────────────────────
    let matchupFactor = 1.0;
    if (pitcherHR9 !== 1.2) {
      matchupFactor = Math.max(0.5, Math.min(2.0, pitcherHR9 / 1.2));
      if (pitcher?.hand && batterHand && pitcher.hand !== batterHand) {
        matchupFactor *= 1.08; // platoon advantage
      }
    }

    // 8. Rank bet ─────────────────────────────────────────────────────────────
    const { rankBet, calculateEdge } = await import('@/lib/card-pipeline');
    const best   = propLines[0];
    const edge   = calculateEdge(modelProbability, best.impliedProbability);
    const rank   = rankBet({
      projection:    modelProbability,
      implied:       best.impliedProbability,
      weatherFactor,
      matchupFactor,
      isSharp:       false, // line movement requires historical data — not available on first run
    });

    return {
      pickDate,
      gameId:             game?.gameId ?? null,
      playerName,
      canonicalName,
      mlbamId,
      homeTeam:           game?.homeTeam ?? '',
      awayTeam:           game?.awayTeam ?? '',
      opposingPitcher:    pitcher?.fullName ?? null,
      pitcherHand:        pitcher?.hand ?? null,
      modelProbability,
      impliedProbability: best.impliedProbability,
      edge,
      adjustedEdge:       rank.adjustedEdge,
      score:              rank.score,
      tier:               rank.tier,
      bestOdds:           best.overOdds,
      bestBook:           best.bookmaker,
      line:               best.line,
      allLines:           propLines.map(l => ({
        bookmaker:          l.bookmaker,
        overOdds:           l.overOdds,
        impliedProbability: l.impliedProbability,
      })),
      weatherFactor,
      matchupFactor,
      sharpBoosted:       false,
      dataSource,
      generatedAt:        new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function getTodayDateET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}
