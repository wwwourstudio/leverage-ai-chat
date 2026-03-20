/**
 * Projection Store
 *
 * Persists LeverageMetrics projection output to the `projections` table.
 * Called fire-and-forget from projection-pipeline.ts after each run.
 *
 * The `projections` table is the model-output cache: once a player × game
 * row exists, the picks engine and /api/picks route can read directly from
 * the DB rather than re-running the full ML pipeline on every request.
 *
 * Upsert key: (player_id, game_id, player_type) — one row per player per game.
 *
 * Also exports `getProjectionsFromDB()` for DB-first reads in the picks engine.
 */

import { getIngestClient } from './ingest-client.server';
import type { MLBProjectionCardData } from '@/lib/mlb-projections/projection-pipeline';

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Batch-upsert projection cards into the `projections` table.
 * Non-throwing — all errors are logged and swallowed.
 */
export async function persistProjections(
  cards: MLBProjectionCardData[],
): Promise<void> {
  if (!cards.length) return;

  const db = await getIngestClient();
  if (!db) return;

  const gameDate = new Date().toISOString().slice(0, 10);

  const rows = cards.map(c => ({
    player_id:      String(c.player_id),
    player_name:    c.player_name,
    // game_id comes from the card's title context — fall back to 'unknown' if absent
    game_id:        (c as any).game_id ? String((c as any).game_id) : `${gameDate}-${c.player_id}`,
    game_date:      gameDate,
    player_type:    c.subcategory === 'K Projection' ? 'pitcher' : 'hitter',
    hr_probability: c.projections.hr_proj  ?? null,
    k_projection:   c.projections.k_proj   ?? null,
    breakout_score: c.projections.breakout_score ?? null,
    dk_pts_mean:    parseFloat(c.summary_metrics.find(m => m.label === 'DK Proj Pts')?.value ?? '0') || null,
    matchup_score:  c.matchup_score ?? null,
    p10:            c.percentiles.p10 ?? null,
    p50:            c.percentiles.p50 ?? null,
    p90:            c.percentiles.p90 ?? null,
    park_factor:    parseFloat(c.summary_metrics.find(m => m.label === 'Park Factor')?.value ?? '1') || null,
    weather_adj:    null, // enriched separately via updateGameWeather
    status:         c.status,
    model_version:  '1.0',
    created_at:     new Date().toISOString(),
  }));

  const { error } = await db
    .from('projections')
    .upsert(rows, { onConflict: 'player_id,game_id,player_type' });

  if (error) {
    console.warn('[projection-store] upsert failed:', error.message);
    return;
  }

  console.log(`[projection-store] Upserted ${rows.length} projections for ${gameDate}`);
}

// ── Read ──────────────────────────────────────────────────────────────────────

export interface DBProjection {
  player_id:      string;
  player_name:    string;
  game_id:        string;
  game_date:      string;
  player_type:    'hitter' | 'pitcher';
  hr_probability: number | null;
  k_projection:   number | null;
  breakout_score: number | null;
  dk_pts_mean:    number | null;
  matchup_score:  number | null;
  p10:            number | null;
  p50:            number | null;
  p90:            number | null;
  park_factor:    number | null;
  status:         string;
}

/**
 * Retrieve today's projections for a set of player names.
 * Returns an empty array when the DB is unavailable or no rows found.
 *
 * Used by the picks engine as a DB-first layer: when projections exist for
 * today the expensive MLB model run is skipped.
 */
export async function getProjectionsFromDB(
  playerNames: string[],
  gameDate?: string,
): Promise<DBProjection[]> {
  if (!playerNames.length) return [];

  const db = await getIngestClient();
  if (!db) return [];

  const date = gameDate ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await db
    .from('projections')
    .select('*')
    .eq('game_date', date)
    .in('player_name', playerNames);

  if (error) {
    console.warn('[projection-store] read failed:', error.message);
    return [];
  }

  return (data ?? []) as DBProjection[];
}

/**
 * Retrieve today's top HR projections ranked by hr_probability.
 * Used by /api/picks as a fast alternative to re-running the pipeline.
 */
export async function getTopHRProjectionsFromDB(
  limit = 15,
  gameDate?: string,
): Promise<DBProjection[]> {
  const db = await getIngestClient();
  if (!db) return [];

  const date = gameDate ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await db
    .from('projections')
    .select('*')
    .eq('game_date', date)
    .eq('player_type', 'hitter')
    .not('hr_probability', 'is', null)
    .order('hr_probability', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[projection-store] top HR read failed:', error.message);
    return [];
  }

  return (data ?? []) as DBProjection[];
}
