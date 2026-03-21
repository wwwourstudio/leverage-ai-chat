/**
 * HR Prediction Bridge — connects the chat tool layer to the v3 prediction engine.
 *
 * Problem: predictHR() requires Supabase UUIDs (playerId, pitcherId) that don't
 * exist in the chat context — only a player name and a date string are available.
 *
 * Solution: resolve everything from MLB Stats API (fetchTodaysGames already returns
 * probable pitchers + handedness) and the existing projectSinglePlayer pipeline
 * (barrel%, hard-hit%, exit velo, platoon split). No Supabase UUIDs required.
 *
 * Flow:
 *   player name + date
 *   → fetchTodaysGames()         (probable pitcher, venue, handedness)
 *   → projectSinglePlayer()      (batter Statcast stats)
 *   → LineupContext assembly      (all v3 fields)
 *   → calculateMatchupFactor()   (platoon scores + pitch mix vuln)
 *   → calculateHRProb()          (rule-based baseline)
 *   → live odds edge             (from hr-prop-market.ts)
 *   → HRPredictionOutput
 */

import { fetchTodaysGames } from '@/lib/mlb-projections/mlb-stats-api';
import type { MLBGame, MLBPitcher, MLBBatter } from '@/lib/mlb-projections/mlb-stats-api';
import { projectSinglePlayer } from '@/lib/mlb-projections/projection-pipeline';
import { getParkFactor, getWeatherFactor } from '@/lib/engine/context';
import {
  calculateMatchupFactor,
  calculatePlatoonEdge,
  normalizePlatoonDelta,
} from '@/lib/engine/matchup';
import type { LineupContext } from '@/lib/engine/matchup';
import { fetchHRPropMarketLines } from '@/lib/mlb-projections/hr-prop-market';
import type { HRPredictionOutput } from '@/lib/engine/predictHR';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Fuzzy match: does the schedule name contain the search term (case-insensitive)? */
function nameFuzzyMatch(scheduleName: string, search: string): boolean {
  const s = scheduleName.toLowerCase();
  const q = search.toLowerCase().trim();
  // Try last name match first (most common: "Judge" → "Aaron Judge")
  const parts = q.split(/\s+/);
  if (parts.length === 1) return s.includes(q);
  // Full name: all parts must appear
  return parts.every(p => s.includes(p));
}

/**
 * Find the game containing this batter (by checking both lineups + team names).
 * Returns the game + the pitcher they face + the batter entry (for slot/hand).
 */
function resolvePlayerGame(
  games: MLBGame[],
  playerName: string,
): {
  game: MLBGame;
  pitcher: MLBPitcher;
  batterEntry: MLBBatter | null;
  isHome: boolean;
} | null {
  for (const game of games) {
    // Check home lineup
    const homeBatter = game.homeLineup?.find(b => nameFuzzyMatch(b.fullName, playerName));
    if (homeBatter) {
      const pitcher = game.probableAwayPitcher;
      if (!pitcher) continue;
      return { game, pitcher, batterEntry: homeBatter, isHome: true };
    }
    // Check away lineup
    const awayBatter = game.awayLineup?.find(b => nameFuzzyMatch(b.fullName, playerName));
    if (awayBatter) {
      const pitcher = game.probablePitcherHome ?? game.probableHomePitcher;
      if (!pitcher) continue;
      return { game, pitcher, batterEntry: awayBatter, isHome: false };
    }
    // Lineups not posted yet — match by team name in player's known team
    // (projectSinglePlayer will fill stats; we just need the pitcher)
    if (
      nameFuzzyMatch(game.homeTeam, playerName) ||
      nameFuzzyMatch(game.awayTeam, playerName)
    ) continue; // ambiguous — skip
  }
  return null;
}

/** Map a venue name to a stadium slug for getParkFactor(). */
const VENUE_SLUG: Record<string, string> = {
  'Yankee Stadium':               'yankee_stadium',
  'Fenway Park':                  'fenway_park',
  'Dodger Stadium':               'dodger_stadium',
  'Wrigley Field':                'wrigley_field',
  'Coors Field':                  'coors_field',
  'Great American Ball Park':     'great_american_ball_park',
  'Oracle Park':                  'oracle_park',
  'Petco Park':                   'petco_park',
  'American Family Field':        'american_family_field',
  'Globe Life Field':             'globe_life_field',
  'T-Mobile Park':                't_mobile_park',
  'Tropicana Field':              'tropicana_field',
  'Kauffman Stadium':             'kauffman_stadium',
  'PNC Park':                     'pnc_park',
  'Busch Stadium':                'busch_stadium',
  'Camden Yards':                 'camden_yards',
  'Target Field':                 'target_field',
  'Chase Field':                  'chase_field',
  'loanDepot park':               'loanDepot_park',
  'Truist Park':                  'truist_park',
  'Citizens Bank Park':           'citizens_bank_park',
  'Progressive Field':            'progressive_field',
  'Guaranteed Rate Field':        'guaranteed_rate_field',
  'Angel Stadium':                'angel_stadium',
  'Minute Maid Park':             'minute_maid_park',
  'Rogers Centre':                'rogers_centre',
  'Comerica Park':                'comerica_park',
  'Nationals Park':               'nationals_park',
};

function venueToSlug(venueName: string): string {
  return VENUE_SLUG[venueName] ?? venueName.toLowerCase().replace(/\s+/g, '_');
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface HRPredictionBridgeInput {
  playerName: string;
  /** YYYY-MM-DD — defaults to today */
  date?: string;
}

export interface HRPredictionBridgeOutput extends HRPredictionOutput {
  /** Resolved pitcher name */
  pitcherName: string;
  /** Resolved venue */
  venue: string;
  /** Game time (ISO string) */
  gameTime: string;
  /** True when Supabase Statcast data was used; false = MLB Stats API fallback */
  dataSource: 'statcast_db' | 'mlb_api_fallback';
}

/**
 * Resolve a player name to a full v3 HR prediction without requiring Supabase UUIDs.
 *
 * Uses:
 *   - MLB Stats API (schedule + probable pitchers + lineups) for game context
 *   - projectSinglePlayer() for batter Statcast stats
 *   - v3 calculateMatchupFactor() for matchup quality
 *   - hr-prop-market.ts for live market edge
 *
 * @throws if the player has no game today or stats cannot be found
 */
export async function predictHRForPlayer(
  input: HRPredictionBridgeInput,
): Promise<HRPredictionBridgeOutput> {
  const { playerName } = input;
  const date = input.date ?? new Date().toISOString().slice(0, 10);
  const warnings: string[] = [];

  // ── 1. Fetch today's schedule + player projection in parallel ─────────────
  const oddsApiKey = process.env.ODDS_API_KEY ?? process.env.NEXT_PUBLIC_ODDS_API_KEY;

  const [games, projection, propLines] = await Promise.all([
    fetchTodaysGames(date),
    projectSinglePlayer(playerName, 'hitter').catch(() => null),
    oddsApiKey
      ? fetchHRPropMarketLines(oddsApiKey).catch(() => new Map())
      : Promise.resolve(new Map()),
  ]);

  if (games.length === 0) {
    throw new Error(`No MLB games found for ${date} — check if it's an off-day`);
  }

  // ── 2. Resolve player's game and probable pitcher ─────────────────────────
  const resolved = resolvePlayerGame(games, playerName);

  if (!resolved) {
    // No lineup posted yet — try to match by projection team
    // Best-effort: use first game with a probable pitcher and warn
    const fallbackGame = games.find(g => g.probableHomePitcher || g.probableAwayPitcher);
    if (!fallbackGame) {
      throw new Error(
        `Could not find ${playerName} in today's lineups. ` +
        `Lineups may not be posted yet — check back after ~1pm ET.`,
      );
    }
    warnings.push(
      `Lineup not yet posted for ${playerName} — using best-available game context. ` +
      `Prediction accuracy improves once lineups are confirmed.`,
    );
  }

  const game    = resolved?.game ?? games[0];
  const pitcher = resolved?.pitcher ?? game.probableHomePitcher ?? game.probableAwayPitcher;

  if (!pitcher) {
    throw new Error(
      `No probable pitcher announced for ${playerName}'s game yet. Try again closer to game time.`,
    );
  }

  const batterEntry   = resolved?.batterEntry ?? null;
  const lineupSlot    = batterEntry?.battingOrder ?? 6;
  const batterHand    = (batterEntry?.bats ?? 'R') as 'L' | 'R' | 'S';
  const pitcherHand   = pitcher.throws as 'L' | 'R';
  const stadiumSlug   = venueToSlug(game.venue);

  // ── 3. Extract batter stats from projection (projectSinglePlayer output) ──
  // The projection card's `data` object has: barrel_rate, hard_hit_rate, exit_velo,
  // platoon_split, hr_proj, etc. Field names are camelCase in the pipeline output.
  const projData = (projection as any)?.data ?? {};

  const barrelRate   = projData.barrel_rate   ?? projData.barrelRate   ?? 0.08;
  const hardHitRate  = projData.hard_hit_rate  ?? projData.hardHitRate  ?? 0.40;
  const avgExitVelo  = projData.exit_velo      ?? projData.avgExitVelo  ?? 88.0;
  const bipCount     = projData.bip_count      ?? projData.bipCount     ?? 0;

  if (bipCount > 0 && bipCount < 30) {
    warnings.push(`Limited sample size (${bipCount} BIP) — projection may be unstable early in the season`);
  }
  if (!projection) {
    warnings.push(`No Statcast data found for "${playerName}" — using league-average estimates`);
  }

  // ── 4. Estimate platoon scores ────────────────────────────────────────────
  // Use projection platoon data if available; otherwise use hand-based estimate.
  // projData.platoon_woba_vs_lhp / platoon_woba_vs_rhp (FanGraphs-style splits)
  let batterPlatoonScore = 0;
  if (projData.platoon_woba_vs_rhp != null && projData.platoon_woba_vs_lhp != null) {
    const delta = batterHand === 'L'
      ? projData.platoon_woba_vs_rhp - projData.platoon_woba_vs_lhp   // LHB: vs opposite (RHP) − vs same (LHP)
      : projData.platoon_woba_vs_lhp - projData.platoon_woba_vs_rhp;  // RHB: vs opposite (LHP) − vs same (RHP)
    batterPlatoonScore = normalizePlatoonDelta(delta);
  } else {
    // League-average platoon assumption when no split data available:
    // Typical batter has ~0.030–0.040 wOBA advantage vs opposite hand
    // normalizePlatoonDelta(0.035) ≈ +0.40 → encode a modest normal platoon
    batterPlatoonScore = 0.35;
    warnings.push('Using estimated platoon score — no wOBA split data in projection cache');
  }

  // Pitcher platoon score: estimate from pitcher stats (HR/9 vs hand, whiff% by split)
  // Use projection's pitcher-side data if available; default to modest normal split
  const pitcherPlatoonScore: number = projData.pitcher_platoon_score ?? 0.30;

  // ── 5. Pitcher arsenal stats ──────────────────────────────────────────────
  // These come from the MLB Stats API player object or Statcast cache.
  // projData may have pitcher_* fields if projectSinglePlayer hydrated them.
  const fourSeamPct    = projData.pitcher_four_seam_pct   ?? 35;
  const breakingUsage  = projData.pitcher_breaking_usage   ?? 28;
  const offspeedUsage  = projData.pitcher_offspeed_usage   ?? 18;
  const pitcherVelo    = projData.pitcher_avg_velo         ?? 93.5;
  const hrAllowedPerFb = projData.pitcher_hr_allowed_per_fb ?? 0.11;
  const pitcherHr9     = projData.pitcher_hr9_vs_hand      ?? projData.hr9_vs_hand ?? 1.1;
  const pitcherFbPct   = projData.pitcher_flyball_pct      ?? 40;

  // ── 6. Build Layer 0 LineupContext ───────────────────────────────────────
  const lineupCtx: LineupContext = {
    lineup_slot:               lineupSlot,
    batter_hand:               batterHand,
    pitcher_hand:              pitcherHand,
    pitcher_flyball_pct:       pitcherFbPct,
    pitcher_hr9_vs_hand:       pitcherHr9,
    protection_score:          0.5,   // neutral default until lineup depth is computed
    team_power_rank:           12,    // neutral default
    opposing_bullpen_hr9:      1.2,   // league-average default
    batter_platoon_score:      batterPlatoonScore,
    pitcher_platoon_score:     pitcherPlatoonScore,
    pitcher_four_seam_pct:     fourSeamPct,
    pitcher_breaking_usage:    breakingUsage,
    pitcher_offspeed_usage:    offspeedUsage,
    pitcher_fastball_velo:     pitcherVelo,
    pitcher_hr_allowed_per_fb: hrAllowedPerFb,
  };

  const matchupFactor = calculateMatchupFactor(lineupCtx);
  const platoonEdge   = calculatePlatoonEdge(lineupCtx);

  if (Math.abs(matchupFactor - 1) > 0.40) {
    warnings.push(`Extreme matchup factor (${matchupFactor.toFixed(2)}) — verify pitcher arsenal inputs`);
  }

  // ── 7. Layer 1: park + weather ────────────────────────────────────────────
  const parkFactor = getParkFactor(stadiumSlug);

  // Weather: MLB Stats API doesn't expose real-time weather — use seasonal estimate
  // TODO: wire Open-Meteo call here using game.venueLat / game.venueLon
  const weatherFactor = getWeatherFactor({
    stadium:        stadiumSlug,
    temperature:    72,   // default until weather fetch is added
    wind_speed:     5,
    wind_direction: 'none',
    humidity:       50,
  });

  // ── 8. Rule-based HR probability ─────────────────────────────────────────
  const pitcherHrPerPa = pitcherHr9 / 36; // HR/9 → per-PA rate (~36 AB/9 innings)

  const baseRate =
    barrelRate      * 0.35 +
    hardHitRate     * 0.20 +
    pitcherHrPerPa  * 0.25 +
    Math.max(0, (avgExitVelo - 88) / 100) * 0.10;

  const finalProb = Math.max(0, Math.min(1, baseRate * parkFactor * weatherFactor * matchupFactor));

  // ── 9. Market edge ────────────────────────────────────────────────────────
  // propLines is keyed by lowercase player name (fuzzy match in hr-prop-market)
  const oddsLine = (propLines as Map<string, any>).get(playerName.toLowerCase())
    ?? (propLines as Map<string, any>).get(playerName.split(' ').pop()?.toLowerCase() ?? '');

  const marketImpliedProb: number | null =
    oddsLine?.impliedProbability ?? oddsLine?.implied_prob ?? null;

  const bestAmericanOdds: number | null = oddsLine?.bestOdds ?? oddsLine?.american_odds ?? null;

  const edge = marketImpliedProb != null ? finalProb - marketImpliedProb : 0;

  // ── 10. Confidence ────────────────────────────────────────────────────────
  const probInRange  = finalProb >= 0.04 && finalProb <= 0.45;
  const dataAdequate = bipCount >= 30 && projection != null;

  const confidence: 'low' | 'medium' | 'high' =
    dataAdequate && probInRange                     ? 'medium' :   // rule-based only → cap at medium
    !dataAdequate && !probInRange                   ? 'low'    : 'medium';

  // ── 11. Assemble output ──────────────────────────────────────────────────
  return {
    probability:  Number(finalProb.toFixed(4)),
    impliedOdds:  bestAmericanOdds,
    edge:         Number(edge.toFixed(4)),
    components: {
      baseRate:      Number(baseRate.toFixed(4)),
      parkFactor:    Number(parkFactor.toFixed(4)),
      weatherFactor: Number(weatherFactor.toFixed(4)),
      matchupFactor: Number(matchupFactor.toFixed(4)),
    },
    confidence,
    warnings: warnings.length > 0 ? warnings : undefined,
    // Bridge-specific fields
    pitcherName:  pitcher.fullName,
    venue:        game.venue,
    gameTime:     game.gameDate,
    dataSource:   projection ? 'statcast_db' : 'mlb_api_fallback',
  };
}
