/**
 * predictHR — Production HR Prediction Entry Point
 *
 * Orchestrates the full v3 intelligence stack for a single batter-game:
 *   Supabase data fetch (parallel)
 *   → Layer 0: calculateMatchupFactor (platoon score + pitch mix vuln)
 *   → Layer 1: park factor × weather factor
 *   → Layer 2: ML model (with rule-based fallback)
 *   → Layer 3: edge vs live market odds
 *
 * All Supabase column names are canonical per the v3 schema:
 *   player_game_stats, pitcher_game_stats, games, stadiums, live_odds_cache
 *
 * Caller must supply pitcherId (probable starter UUID) — do not query by
 * game_id alone because pitcher_game_stats has one row per pitcher per game.
 */

import { createClient } from '@/lib/supabase/server';
import { getParkFactor, getWeatherFactor } from '@/lib/engine/context';
import type { GameContext } from '@/lib/engine/context';
import { calculateMatchupFactor } from '@/lib/engine/matchup';
import type { LineupContext } from '@/lib/engine/matchup';
import { predictHRFromFeatures } from '@/lib/ml/predict';
import { americanToImpliedProb } from '@/lib/utils/odds-math';

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface PlayerPredictionInput {
  /** UUID from the `players` table */
  playerId: string;
  /** UUID from the `pitchers` table (probable starter — required) */
  pitcherId: string;
  /** MLB game_pk or our internal game_id */
  gameId: string;
  /** YYYY-MM-DD */
  date: string;
}

export interface HRPredictionOutput {
  /** Final HR probability 0–1 */
  probability: number;
  /** American odds equivalent (null when no market data) */
  impliedOdds: number | null;
  /** model prob − market implied prob (0 when no market data) */
  edge: number;
  components: {
    baseRate: number;
    parkFactor: number;
    weatherFactor: number;
    matchupFactor: number;
    /** Set when ML model was used instead of rule-based fallback */
    mlAdjusted?: number;
  };
  confidence: 'low' | 'medium' | 'high';
  warnings?: string[];
}

// ─── Internal row shapes (typed to match Supabase column names exactly) ───────

interface PlayerStatRow {
  barrel_rate: number | null;
  hard_hit_rate: number | null;
  avg_exit_velo: number | null;
  bip_count: number | null;
  platoon_score: number | null;         // batter_platoon_score in LineupContext
  iso: number | null;
  woba: number | null;
  // Joined from players reference table
  players: {
    hand: 'L' | 'R' | 'S' | null;
    team_id: string | null;
  } | null;
}

interface PitcherStatRow {
  flyball_pct: number | null;
  hr_per_fb: number | null;
  hr_allowed_per_fb: number | null;
  hr9_vs_hand: number | null;
  four_seam_pct: number | null;
  breaking_usage: number | null;
  offspeed_usage: number | null;
  avg_velo: number | null;              // pitcher_fastball_velo in LineupContext
  platoon_score: number | null;         // pitcher_platoon_score in LineupContext
  pitches_thrown: number | null;
  // Joined from pitchers reference table
  pitchers: {
    hand: 'L' | 'R' | null;
  } | null;
}

interface GameRow {
  stadium_id: string | null;
  temperature: number | null;
  wind_speed: number | null;
  wind_direction: 'out' | 'in' | 'cross' | 'none' | null;
  humidity: number | null;
  // Joined from stadiums
  stadiums: {
    park_factor: number | null;
  } | null;
}

interface OddsRow {
  implied_prob: number | null;
  american_odds: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a team power rank stub from team_id until we have a proper lookup. */
function teamPowerRankFromId(_teamId: string | null | undefined): number {
  // TODO: replace with a real lookup table or Supabase join once team_rankings is added
  return 15; // neutral default
}

const americanToImplied = americanToImpliedProb;

/** Clamp a number to [0, 1]. */
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function predictHR({
  playerId,
  pitcherId,
  gameId,
  date,
}: PlayerPredictionInput): Promise<HRPredictionOutput> {
  const warnings: string[] = [];
  const supabase = await createClient();

  // ── 1. Parallel data fetch ───────────────────────────────────────────────
  // All four queries run concurrently — no sequential waterfalls.
  const [playerResult, pitcherResult, gameResult, oddsResult] = await Promise.all([
    supabase
      .from('player_game_stats')
      .select(`
        barrel_rate,
        hard_hit_rate,
        avg_exit_velo,
        bip_count,
        platoon_score,
        iso,
        woba,
        players ( hand, team_id )
      `)
      .eq('player_id', playerId)
      .eq('game_date', date)
      .single<PlayerStatRow>(),

    supabase
      .from('pitcher_game_stats')
      .select(`
        flyball_pct,
        hr_per_fb,
        hr_allowed_per_fb,
        hr9_vs_hand,
        four_seam_pct,
        breaking_usage,
        offspeed_usage,
        avg_velo,
        platoon_score,
        pitches_thrown,
        pitchers ( hand )
      `)
      .eq('pitcher_id', pitcherId)
      .eq('game_date', date)
      .single<PitcherStatRow>(),

    supabase
      .from('games')
      .select(`
        stadium_id,
        temperature,
        wind_speed,
        wind_direction,
        humidity,
        stadiums ( park_factor )
      `)
      .eq('game_id', gameId)
      .single<GameRow>(),

    // live_odds_cache stores game-level bookmaker JSONB, not player-level props.
    // Resolve immediately to null so Layer 3 edge calculation falls back to 0.
    Promise.resolve({ data: null as OddsRow | null, error: null }),
  ]);

  // Fail fast on required data
  if (playerResult.error || !playerResult.data) {
    throw new Error(
      `No player stats for player=${playerId} date=${date}: ${playerResult.error?.message ?? 'not found'}`,
    );
  }
  if (pitcherResult.error || !pitcherResult.data) {
    throw new Error(
      `No pitcher stats for pitcher=${pitcherId} date=${date}: ${pitcherResult.error?.message ?? 'not found'}`,
    );
  }
  if (gameResult.error || !gameResult.data) {
    throw new Error(
      `No game context for game_id=${gameId}: ${gameResult.error?.message ?? 'not found'}`,
    );
  }

  const ps   = playerResult.data;
  const pit  = pitcherResult.data;
  const game = gameResult.data;
  const odds = oddsResult.data ?? null;

  // ── 2. Data quality checks ───────────────────────────────────────────────
  const bipCount = ps.bip_count ?? 0;
  if (bipCount < 20) {
    warnings.push(`Limited batter contact data (${bipCount} BIP) — estimates may be unstable`);
  }
  const pitchCount = pit.pitches_thrown ?? 0;
  if (pitchCount < 50) {
    warnings.push(`Limited pitcher data (${pitchCount} pitches) — pitch mix estimates may be unstable`);
  }

  // ── 3. Resolve handedness (from joined reference rows) ───────────────────
  const batterHand: 'L' | 'R' | 'S' = ps.players?.hand ?? 'R';
  const pitcherHand: 'L' | 'R'       = pit.pitchers?.hand ?? 'R';

  if (!ps.players?.hand) {
    warnings.push('Batter handedness not found — defaulting to R; fetch from players table');
  }
  if (!pit.pitchers?.hand) {
    warnings.push('Pitcher handedness not found — defaulting to R; fetch from pitchers table');
  }

  // ── 4. Build Layer 1 context ─────────────────────────────────────────────
  const stadiumId   = game.stadium_id ?? 'generic';
  const dbParkFactor = game.stadiums?.park_factor ?? 1.0;
  // getParkFactor() uses our hardcoded park table; multiply by Supabase override if set
  const parkFactor   = getParkFactor(stadiumId) * (dbParkFactor !== 1.0 ? dbParkFactor : 1.0);

  const weatherCtx: GameContext = {
    stadium:        stadiumId,
    temperature:    game.temperature    ?? 72,
    wind_speed:     game.wind_speed     ?? 5,
    wind_direction: game.wind_direction ?? 'none',
    humidity:       game.humidity       ?? 50,
  };
  const weatherFactor = getWeatherFactor(weatherCtx);

  // ── 5. Build Layer 0 LineupContext ───────────────────────────────────────
  // All field names match the current LineupContext interface exactly.
  // platoon_advantage and opposing_bullpen_depth are removed from the interface.
  const lineupCtx: LineupContext = {
    // Positional
    lineup_slot:               6,     // TODO: fetch from game_lineups table once added
    batter_hand:               batterHand,
    pitcher_hand:              pitcherHand,
    // Pitcher structural
    pitcher_flyball_pct:       pit.flyball_pct          ?? 40,
    pitcher_hr9_vs_hand:       pit.hr9_vs_hand          ?? 1.1,
    protection_score:          0.5,   // TODO: derive from adjacent lineup slots
    team_power_rank:           teamPowerRankFromId(ps.players?.team_id),
    opposing_bullpen_hr9:      1.2,   // TODO: fetch from bullpen_stats table
    // Platoon split scores [-1, +1]
    batter_platoon_score:      ps.platoon_score          ?? 0,
    pitcher_platoon_score:     pit.platoon_score         ?? 0,
    // Pitch mix arsenal
    pitcher_four_seam_pct:     pit.four_seam_pct         ?? 35,
    pitcher_breaking_usage:    pit.breaking_usage         ?? 25,
    pitcher_offspeed_usage:    pit.offspeed_usage         ?? 15,
    pitcher_fastball_velo:     pit.avg_velo               ?? 93.5,
    pitcher_hr_allowed_per_fb: pit.hr_allowed_per_fb ?? pit.hr_per_fb ?? 0.11,
  };

  const matchupFactor = calculateMatchupFactor(lineupCtx);

  if (Math.abs(matchupFactor - 1) > 0.4) {
    warnings.push(
      `Extreme matchup adjustment (${matchupFactor.toFixed(2)}) — verify platoon/arsenal inputs`,
    );
  }

  // ── 6. Rule-based base projection (Layer 0 + 1) ──────────────────────────
  // Each term is dimensionally consistent — all rates are 0–1 fractions.
  // pitcher_hr9 is divided by 9*27 (≈ AB/game) to approximate per-AB rate.
  const barrelRate   = ps.barrel_rate   ?? 0.08;
  const hardHitRate  = ps.hard_hit_rate ?? 0.40;
  const hr9VsHand    = pit.hr9_vs_hand  ?? 1.1;
  const exitVelo     = ps.avg_exit_velo ?? 88.0;

  // hr9 / (9 innings × ~4 AB/inning) ≈ per-PA HR rate for this pitcher
  const pitcherHrPerPa = hr9VsHand / 36;

  const baseRate =
    barrelRate      * 0.35 +
    hardHitRate     * 0.20 +
    pitcherHrPerPa  * 0.25 +
    Math.max(0, (exitVelo - 88) / 100) * 0.10;  // normalized: 0 at 88mph, +0.10 at 98mph

  // Apply context multipliers; clamp strictly to [0, 1]
  const ruleBasedProb = clamp01(baseRate * parkFactor * weatherFactor * matchupFactor);

  // ── 7. ML adjustment (Layer 2) — falls back to rule-based gracefully ─────
  let finalProb = ruleBasedProb;
  let mlUsed    = false;

  try {
    const mlFeatures: number[] = [
      barrelRate,
      hardHitRate,
      hr9VsHand,
      parkFactor,
      weatherFactor,
      matchupFactor,
      ps.platoon_score  ?? 0,
      pit.platoon_score ?? 0,
    ];

    const mlRaw = await predictHRFromFeatures(mlFeatures);
    finalProb   = clamp01(mlRaw);
    mlUsed      = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`ML model unavailable (${msg}) — using rule-based fallback`);
  }

  // ── 8. Edge vs live market (Layer 3) ────────────────────────────────────
  let edge: number        = 0;
  let impliedOdds: number | null = null;

  if (odds) {
    // implied_prob is stored directly; fall back to computing from american_odds
    const marketProb =
      odds.implied_prob != null
        ? odds.implied_prob
        : odds.american_odds != null
        ? americanToImplied(odds.american_odds)
        : null;

    if (marketProb != null) {
      edge        = Number((finalProb - marketProb).toFixed(4));
      impliedOdds = odds.american_odds ?? null;
    }
  }

  // ── 9. Confidence scoring ────────────────────────────────────────────────
  // high:   ML used + adequate data + prob in reasonable range
  // medium: one condition missing
  // low:    ML absent, or extreme probability, or very thin data
  const probInRange = finalProb >= 0.04 && finalProb <= 0.45;
  const dataAdequate = bipCount >= 50 && pitchCount >= 100;

  let confidence: 'low' | 'medium' | 'high';
  if (mlUsed && dataAdequate && probInRange) {
    confidence = 'high';
  } else if (mlUsed || dataAdequate) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // ── 10. Return ────────────────────────────────────────────────────────────
  return {
    probability: Number(finalProb.toFixed(4)),
    impliedOdds,
    edge,
    components: {
      baseRate:      Number(baseRate.toFixed(4)),
      parkFactor:    Number(parkFactor.toFixed(4)),
      weatherFactor: Number(weatherFactor.toFixed(4)),
      matchupFactor: Number(matchupFactor.toFixed(4)),
      ...(mlUsed ? { mlAdjusted: Number(finalProb.toFixed(4)) } : {}),
    },
    confidence,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
