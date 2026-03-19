/**
 * Update Picks
 *
 * Utility called by the daily-picks cron (or on-demand) to:
 *   1. Re-score existing `daily_picks` rows with the latest sharp-money signals
 *      from `line_movement`
 *   2. Optionally recalculate HR model probability using the stored factor fields
 *      (park_factor, umpire_boost, bullpen_factor, weather_factor, matchup_factor)
 *   3. Persist updated score / tier / sharp_boosted back to Supabase
 *
 * This is NOT the initial pick generation — that lives in lib/picks-engine.ts.
 * This is the incremental refresh that runs whenever sharp signals arrive.
 *
 * Usage (e.g. from a Next.js API route or Supabase Edge Function):
 *   import { refreshPicksWithSharpSignals } from '@/lib/update-picks';
 *   const result = await refreshPicksWithSharpSignals({ date: '2026-03-20' });
 */

import { createClient as createServerClient } from '@/lib/supabase/server';
import { scoreAllGames, type LineMovementRow } from '@/lib/sharp-money';

// line_movement table includes home_team/away_team columns not in LineMovementRow
type LineMovementDbRow = LineMovementRow & { home_team?: string; away_team?: string };

// ── Types ──────────────────────────────────────────────────────────────────────

interface DailyPickRow {
  id: number;
  pick_date: string;
  player_name: string;
  home_team: string | null;
  away_team: string | null;
  model_probability: number;
  score: number;
  tier: string;
  sharp_boosted: boolean;
  weather_factor: number;
  matchup_factor: number;
  park_factor: number;
  umpire_boost: number;
  bullpen_factor: number;
}

export interface RefreshOptions {
  /** ISO date string YYYY-MM-DD. Defaults to today UTC. */
  date?: string;
  /**
   * Sharp boost applied per unit of SharpScore.score.
   * E.g. 0.1 means a STEAM signal (score=0.8) adds +8% to pick score.
   * Default: 0.10
   */
  sharpMultiplier?: number;
  /** If true, also recompute model_probability from stored factor columns */
  recomputeModelProb?: boolean;
}

export interface RefreshResult {
  date: string;
  picksProcessed: number;
  picksUpdated: number;
  sharplyBoosted: number;
  errors: string[];
}

// ── Score thresholds (mirror daily_picks CHECK constraint) ─────────────────────

type Tier = 'ELITE' | 'STRONG' | 'LEAN' | 'PASS';

function getTier(score: number): Tier {
  if (score >= 8.0)  return 'ELITE';
  if (score >= 5.5)  return 'STRONG';
  if (score >= 3.0)  return 'LEAN';
  return 'PASS';
}

// ── Main function ──────────────────────────────────────────────────────────────

export async function refreshPicksWithSharpSignals(
  options: RefreshOptions = {},
): Promise<RefreshResult> {
  const date = options.date ?? todayUTC();
  const sharpMultiplier  = options.sharpMultiplier ?? 0.10;
  const errors: string[] = [];

  const supabase = await createServerClient();

  // 1. Load today's picks
  const { data: picksRaw, error: picksErr } = await supabase
    .from('daily_picks')
    .select('id, pick_date, player_name, home_team, away_team, model_probability, score, tier, sharp_boosted, weather_factor, matchup_factor, park_factor, umpire_boost, bullpen_factor')
    .eq('pick_date', date)
    .not('tier', 'eq', 'PASS');

  if (picksErr) throw new Error(`daily_picks fetch failed: ${picksErr.message}`);
  const picks: DailyPickRow[] = (picksRaw ?? []) as DailyPickRow[];
  if (picks.length === 0) {
    return { date, picksProcessed: 0, picksUpdated: 0, sharplyBoosted: 0, errors };
  }

  // 2. Load recent line movements (last 6 hours) for the teams in today's picks
  const sharpWindowStart = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: movRaw, error: movErr } = await supabase
    .from('line_movement')
    .select('game_id, bookmaker, market_type, old_line, new_line, line_change, old_odds, new_odds, timestamp, home_team, away_team')
    .gte('timestamp', sharpWindowStart)
    .order('timestamp', { ascending: false })
    .limit(500);

  if (movErr) {
    errors.push(`line_movement fetch failed: ${movErr.message}`);
  }

  const movRows: LineMovementDbRow[] = (movRaw ?? []) as unknown as LineMovementDbRow[];

  // 3. Score movements per game using sharp-money module
  const sharpScores = scoreAllGames(movRows as LineMovementRow[]);

  // Build team-name → sharp score map (since picks join by team name, not game_id)
  const teamSharpMap = new Map<string, number>();
  for (const [, signal] of sharpScores) {
    // Key: "away @ home" (lower-case) → sharp score
    // We'll match picks by checking if home_team or away_team appears in movement rows
    for (const row of movRows.filter(r => r.game_id === signal.gameId)) {
      const key = (row.home_team ?? '').toLowerCase();
      teamSharpMap.set(key, Math.max(teamSharpMap.get(key) ?? 0, signal.score));
    }
  }

  // 4. Compute updated scores and batch the writes
  const updates: Array<{
    id: number;
    score: number;
    tier: Tier;
    sharp_boosted: boolean;
    model_probability?: number;
  }> = [];

  let sharplyBoosted = 0;

  for (const pick of picks) {
    const teamKey = (pick.home_team ?? '').toLowerCase();
    const sharpScore = teamSharpMap.get(teamKey) ?? 0;
    const boost = sharpScore * sharpMultiplier * 10; // convert to score-point scale

    // Optional: recalculate model_probability from stored factors
    let modelProb = pick.model_probability;
    if (options.recomputeModelProb) {
      modelProb = recalcModelProb(pick);
    }

    // Replicate the picks-engine 5-factor combination from stored column values
    const combinedFactor =
      pick.weather_factor *
      pick.matchup_factor *
      pick.park_factor *
      (1 + pick.umpire_boost) *
      pick.bullpen_factor;

    // Base score: model probability × factors → percentage points edge proxy
    const baseScore  = modelProb * combinedFactor * 100 - 50; // centred around 0
    const newScore   = Math.min(20, Math.max(0, baseScore + boost));
    const newTier    = getTier(newScore);
    const wasBoosted = boost > 0.1;

    // Only write rows where something materially changed
    const scoreChanged = Math.abs(newScore - pick.score) > 0.05;
    const tierChanged  = newTier !== pick.tier;
    const boostChanged = wasBoosted !== pick.sharp_boosted;

    if (scoreChanged || tierChanged || boostChanged || options.recomputeModelProb) {
      const update: typeof updates[number] = {
        id:           pick.id,
        score:        parseFloat(newScore.toFixed(2)),
        tier:         newTier,
        sharp_boosted: wasBoosted,
      };
      if (options.recomputeModelProb) {
        update.model_probability = parseFloat(modelProb.toFixed(4));
      }
      updates.push(update);
      if (wasBoosted) sharplyBoosted++;
    }
  }

  if (updates.length === 0) {
    return { date, picksProcessed: picks.length, picksUpdated: 0, sharplyBoosted, errors };
  }

  // 5. Write updates in batches of 50 (Supabase upsert limit)
  const BATCH = 50;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const { error: upErr } = await supabase
      .from('daily_picks')
      .upsert(batch, { onConflict: 'id' });

    if (upErr) {
      errors.push(`batch ${i / BATCH + 1} upsert failed: ${upErr.message}`);
    }
  }

  return {
    date,
    picksProcessed: picks.length,
    picksUpdated:   updates.length,
    sharplyBoosted,
    errors,
  };
}

// ── Optional: re-derive model_probability from stored factor columns ────────────
//   Uses the same simplified formula as picks-engine.ts (5-factor product).
//   Only called when recomputeModelProb: true.

function recalcModelProb(pick: DailyPickRow): number {
  // Reconstruct the final_projection from the stored model_probability + factors.
  // The engine stores the ADJUSTED probability in model_probability, so we don't
  // need to re-run the full Bayesian model here — just re-apply current factors.
  const adjusted =
    pick.model_probability *
    pick.weather_factor *
    pick.matchup_factor *
    pick.park_factor *
    (1 + pick.umpire_boost) *
    pick.bullpen_factor;

  return Math.max(0.001, Math.min(0.90, adjusted));
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
