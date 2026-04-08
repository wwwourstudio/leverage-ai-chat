/**
 * Record Pick Results
 *
 * Reads yesterday's unsettled picks from `pick_outcomes`, queries the MLB Stats
 * API for actual home-run outcomes, writes the settled rows back, and computes
 * per-bet P&L.
 *
 * Called daily by /api/cron/settle (after games finish, ~4 AM UTC).
 */

import { americanToDecimal } from '@/lib/utils/odds-math';

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
  const { getIngestClient } = await import('@/lib/services/ingest-client.server');
  const supabase = await getIngestClient();
  if (!supabase) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — settlement requires service role access');

  // 1. Load unsettled pick_outcomes for the target date
  const { data: unsettledRaw, error: fetchErr } = await supabase
    .from('pick_outcomes')
    .select('id, pick_id, player_id, best_odds, tier')
    .eq('pick_date', targetDate)
    .is('hit', null);

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
    id: number;
    hit: boolean;
    units_profit: number;
    result_recorded_at: string;
    result_source: string;
  }> = [];

  for (const row of unsettled) {
    const result = gameResults.find(
      (r) => String(r.player_id) === String(row.player_id),
    );

    if (!result) continue; // game not in results yet — skip

    const hit = result.hit_hr;
    const pnl = computePnL(hit, row.best_odds ?? null);

    updates.push({
      id: row.id,
      hit,
      units_profit: pnl,
      result_recorded_at: now,
      result_source: 'mlb-stats-api',
    });
  }

  // 4. Batch-upsert settlements
  const BATCH = 50;
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error: upErr } = await supabase
      .from('pick_outcomes')
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
  const { getIngestClient } = await import('@/lib/services/ingest-client.server');
  const supabase = await getIngestClient();
  if (!supabase) return 0;

  // Load today's non-PASS picks
  const { data: picksRaw, error: picksErr } = await supabase
    .from('daily_picks')
    .select('id, player_id, player_name, edge, tier, best_odds')
    .eq('pick_date', targetDate)
    .not('tier', 'eq', 'PASS');

  if (picksErr || !picksRaw?.length) return 0;

  // Load already-enrolled pick_ids for today
  const { data: existingRaw } = await supabase
    .from('pick_outcomes')
    .select('pick_id')
    .eq('pick_date', targetDate);

  const existingIds = new Set(
    (existingRaw ?? []).map((r: { pick_id: number }) => String(r.pick_id)),
  );

  type PickRow = { id: number; player_id: number | null; player_name: string; edge: number; tier: string; best_odds: number | null };
  const newRows = (picksRaw as PickRow[])
    .filter((p) => !existingIds.has(String(p.id)))
    .map((p) => ({
      pick_id: p.id,
      player_id: p.player_id,
      player_name: p.player_name,
      pick_date: targetDate,
      edge: p.edge,
      tier: p.tier,
      best_odds: p.best_odds,
    }));

  if (newRows.length === 0) return 0;

  const { error: insertErr } = await supabase
    .from('pick_outcomes')
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
  const profit = (americanToDecimal(odds) - 1) * UNIT;
  return parseFloat(profit.toFixed(2));
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
