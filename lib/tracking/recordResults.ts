/**
 * Record Pick Results
 *
 * Reads yesterday's unsettled picks from `pick_results`, queries the MLB Stats
 * API for actual home-run outcomes, writes the settled rows back, and computes
 * per-bet P&L.
 *
 * Called daily by /api/cron/train (after games finish, ~3 AM ET / 8 AM UTC).
 *
 * Kelly stake sizing uses the existing lib/kelly module so sizing is consistent
 * with what the trading engine would recommend.
 */

import { createClient } from '@/lib/supabase/server';
import { calculateKelly } from '@/lib/engine/runTradingEngine';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GameResult {
  player_id: number | string;
  player_name: string;
  hit_hr: boolean; // true if player hit a HR in that game
  game_date: string; // YYYY-MM-DD
}

export interface RecordResultsOutput {
  date: string;
  picksScanned: number;
  picksSettled: number;
  errors: string[];
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Settle all unsettled pick_results rows for `date` (default: yesterday).
 * Fetches actual game outcomes from the MLB Stats API.
 */
export async function recordPickResults(
  date?: string,
): Promise<RecordResultsOutput> {
  const targetDate = date ?? yesterdayUTC();
  const errors: string[] = [];
  const supabase = await createClient();

  // 1. Load unsettled pick_results for the target date
  const { data: unsettledRaw, error: fetchErr } = await supabase
    .from('pick_results')
    .select('id, pick_id, player_id, predicted_prob, odds, kelly_stake, tier')
    .eq('pick_date', targetDate)
    .is('actual_result', null);

  if (fetchErr) {
    throw new Error(`Failed to load unsettled picks: ${fetchErr.message}`);
  }

  const unsettled = unsettledRaw ?? [];
  if (unsettled.length === 0) {
    return { date: targetDate, picksScanned: 0, picksSettled: 0, errors };
  }

  // 2. Fetch actual HR outcomes from MLB Stats API
  const gameResults = await fetchMLBResults(targetDate, errors);

  // 3. Match and settle
  const now = new Date().toISOString();
  const updates: Array<{
    id: string;
    actual_result: boolean;
    pnl: number;
    settled_at: string;
  }> = [];

  for (const row of unsettled) {
    const result = gameResults.find(
      (r) => String(r.player_id) === String(row.player_id),
    );

    if (!result) continue; // game not in results yet — skip

    const hit = result.hit_hr;
    const pnl = computePnL(hit, row.odds ?? null);

    updates.push({
      id: row.id,
      actual_result: hit,
      pnl,
      settled_at: now,
    });
  }

  // 4. Batch-upsert settlements
  const BATCH = 50;
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error: upErr } = await supabase
      .from('pick_results')
      .upsert(updates.slice(i, i + BATCH), { onConflict: 'id' });

    if (upErr) {
      errors.push(`batch ${Math.floor(i / BATCH) + 1} upsert failed: ${upErr.message}`);
    }
  }

  return {
    date: targetDate,
    picksScanned: unsettled.length,
    picksSettled: updates.length,
    errors,
  };
}

/**
 * Insert fresh pick_results rows for all daily_picks on `date` that don't
 * already have a record. Called from /api/cron/picks each run so new picks
 * are immediately enrolled for tracking.
 */
export async function enrolPicksForTracking(date?: string): Promise<number> {
  const targetDate = date ?? todayUTC();
  const supabase = await createClient();

  // Load today's non-PASS picks
  const { data: picksRaw, error: picksErr } = await supabase
    .from('daily_picks')
    .select(
      'id, player_id, model_probability, edge, score, tier, best_odds, best_book, sharp_boosted',
    )
    .eq('pick_date', targetDate)
    .not('tier', 'eq', 'PASS');

  if (picksErr || !picksRaw?.length) return 0;

  // Load already-enrolled pick_ids for today
  const { data: existingRaw } = await supabase
    .from('pick_results')
    .select('pick_id')
    .eq('pick_date', targetDate);

  const existingIds = new Set((existingRaw ?? []).map((r) => r.pick_id));

  const newRows = picksRaw
    .filter((p) => !existingIds.has(p.id))
    .map((p) => {
      const kellyStake = computeKellyStake(p.model_probability, p.best_odds ?? 100);
      return {
        pick_id: p.id,
        player_id: p.player_id,
        pick_date: targetDate,
        predicted_prob: p.model_probability,
        edge: p.edge,
        score: p.score,
        tier: p.tier,
        odds: p.best_odds,
        best_book: p.best_book,
        kelly_stake: kellyStake,
        sharp_boosted: p.sharp_boosted,
      };
    });

  if (newRows.length === 0) return 0;

  const { error: insertErr } = await supabase
    .from('pick_results')
    .insert(newRows);

  if (insertErr) {
    console.error('[tracking] enrolPicksForTracking insert failed:', insertErr.message);
    return 0;
  }

  return newRows.length;
}

// ── MLB Stats API ─────────────────────────────────────────────────────────────

async function fetchMLBResults(
  date: string,
  errors: string[],
): Promise<GameResult[]> {
  try {
    // MLB Stats API game-log endpoint (public, no auth required)
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,boxscore`;
    const resp = await fetch(url, { next: { revalidate: 0 } });

    if (!resp.ok) {
      errors.push(`MLB Stats API returned ${resp.status} for ${date}`);
      return [];
    }

    const json = await resp.json();
    const results: GameResult[] = [];

    for (const dateEntry of json?.dates ?? []) {
      for (const game of dateEntry?.games ?? []) {
        const gamePk: number = game.gamePk;
        const boxRows = await fetchBoxscoreHRs(gamePk, date, errors);
        results.push(...boxRows);
      }
    }

    return results;
  } catch (err) {
    errors.push(`fetchMLBResults error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

async function fetchBoxscoreHRs(
  gamePk: number,
  gameDate: string,
  errors: string[],
): Promise<GameResult[]> {
  try {
    const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`;
    const resp = await fetch(url, { next: { revalidate: 0 } });
    if (!resp.ok) return [];

    const json = await resp.json();
    const results: GameResult[] = [];

    for (const side of ['home', 'away'] as const) {
      const players = json?.teams?.[side]?.players ?? {};
      for (const playerEntry of Object.values(players) as Record<string, unknown>[]) {
        const person = (playerEntry as { person?: { id?: number; fullName?: string } }).person;
        const stats = (playerEntry as { stats?: { batting?: { homeRuns?: number } } }).stats;
        if (!person?.id) continue;
        results.push({
          player_id: person.id,
          player_name: person.fullName ?? String(person.id),
          hit_hr: (stats?.batting?.homeRuns ?? 0) > 0,
          game_date: gameDate,
        });
      }
    }

    return results;
  } catch (err) {
    errors.push(`boxscore ${gamePk} error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computePnL(hit: boolean, americanOdds: number | null): number {
  const UNIT = 100;
  if (!hit) return -UNIT;
  const odds = americanOdds ?? 100;
  const profit = odds >= 0 ? UNIT * (odds / 100) : UNIT * (100 / Math.abs(odds));
  return parseFloat(profit.toFixed(2));
}

function computeKellyStake(modelProb: number, americanOdds: number): number {
  try {
    const decOdds =
      americanOdds >= 0 ? 1 + americanOdds / 100 : 1 + 100 / Math.abs(americanOdds);

    // Use a normalised bankroll of 1 so the result is directly a fraction
    const result = calculateKelly({
      probability: modelProb,
      decimalOdds: decOdds,
      bankroll: 1,
      fraction: 0.25, // quarter-Kelly
    });

    // Cap at 5% of bankroll
    const raw = result.fractionalKellyStake ?? result.recommendedStake ?? 0;
    return parseFloat(Math.min(0.05, Math.max(0, raw)).toFixed(6));
  } catch {
    return 0.02; // default 2% if Kelly fails
  }
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
