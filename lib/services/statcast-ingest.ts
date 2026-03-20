/**
 * Statcast Ingest Service
 *
 * Persists Baseball Savant leaderboard data to the `statcast_daily` table.
 * Called fire-and-forget after every successful `getStatcastData()` call so
 * that subsequent pipeline runs can query the DB instead of re-fetching from
 * Baseball Savant (saves 1–2s per request on warm Lambda instances).
 *
 * Upsert key: (player_id, season, player_type) — one row per player per season.
 * Rows are refreshed each time new data is fetched (TTL-based at the app level).
 */

import { getIngestClient } from './ingest-client.server';
import type { StatcastPlayer } from '@/lib/baseball-savant';

/**
 * Batch-upsert a Baseball Savant leaderboard snapshot into `statcast_daily`.
 *
 * Non-throwing: all errors are logged and swallowed so ingest failures never
 * block the calling pipeline.
 */
export async function persistStatcastLeaders(players: StatcastPlayer[]): Promise<void> {
  if (!players.length) return;

  const db = await getIngestClient();
  if (!db) return;

  // Map StatcastPlayer → DB row
  const rows = players.map(p => ({
    player_id:          String(p.playerId),
    player_name:        p.name,
    player_type:        p.playerType,
    season:             p.year,
    pa:                 p.pa ?? null,
    barrel_rate:        p.barrelRate       ?? null,
    hard_hit_pct:       p.hardHitPct       ?? null,
    avg_exit_velocity:  p.exitVelocity     ?? null,
    launch_angle:       p.launchAngle      ?? null,
    sweet_spot_pct:     p.sweetSpotPct     ?? null,
    xba:                p.xba              ?? null,
    xslg:               p.xslg             ?? null,
    woba:               p.woba             ?? null,
    xwoba:              p.xwoba            ?? null,
    data_source:        'savant_season',
    fetched_at:         new Date().toISOString(),
  }));

  // Batch in chunks of 200 to stay within Supabase request size limits
  const CHUNK = 200;
  let totalUpserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const chunkNum = Math.floor(i / CHUNK) + 1;

    const { error } = await db
      .from('statcast_daily')
      .upsert(chunk, { onConflict: 'player_id,season,player_type' });

    if (error) {
      // Surface sequence-permission errors with a clear remediation hint.
      // These occur when the service_role lacks USAGE on the BIGSERIAL
      // sequence (e.g. first-ever INSERT for a player/season pair).
      // Fix: run scripts/fix-sequence-permissions.sql in Supabase SQL Editor.
      if (
        error.message.includes('permission denied for sequence') ||
        error.code === '42501'
      ) {
        console.error(
          '[statcast-ingest] SEQUENCE PERMISSION ERROR — ' +
          'run scripts/fix-sequence-permissions.sql in the Supabase SQL Editor ' +
          'to grant USAGE on api schema sequences to service_role.',
          { code: error.code, detail: error.message },
        );
      } else {
        console.warn(
          `[statcast-ingest] upsert failed (chunk ${chunkNum}):`,
          error.message,
        );
      }
    } else {
      totalUpserted += chunk.length;
    }
  }

  console.log(
    `[statcast-ingest] Upserted ${totalUpserted} / ${rows.length} Statcast rows`,
  );
}

/**
 * Query the DB for a single player's current-season Statcast data.
 * Returns null when the player is not found or the DB is unavailable.
 *
 * Used by picks-engine and analyze route as a DB-first lookup before
 * falling back to a live Baseball Savant fetch.
 */
export async function getStatcastFromDB(
  playerName: string,
  season: number,
  playerType: 'batter' | 'pitcher' = 'batter',
): Promise<StatcastPlayer | null> {
  const db = await getIngestClient();
  if (!db) return null;

  const { data, error } = await db
    .from('statcast_daily')
    .select('*')
    .ilike('player_name', playerName)
    .eq('season', season)
    .eq('player_type', playerType)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Map DB row back to StatcastPlayer shape
  return {
    playerId:     Number(data.player_id) || 0,
    name:         data.player_name,
    playerType:   data.player_type as 'batter' | 'pitcher',
    year:         data.season,
    pa:           data.pa           ?? 0,
    barrelRate:   data.barrel_rate  ?? 0,
    hardHitPct:   data.hard_hit_pct ?? 0,
    exitVelocity: data.avg_exit_velocity ?? 0,
    launchAngle:  data.launch_angle ?? 0,
    sweetSpotPct: data.sweet_spot_pct ?? 0,
    xba:          data.xba   ?? 0,
    xslg:         data.xslg  ?? 0,
    woba:         data.woba  ?? 0,
    xwoba:        data.xwoba ?? 0,
  };
}

/**
 * Pull the top N batters (by barrel rate) for today's AI prompt enrichment.
 * Queries the DB rather than re-fetching Baseball Savant — instant when warm.
 * Falls back to empty array on any error.
 */
export async function getTopStatcastLeadersFromDB(
  season: number,
  limit = 5,
): Promise<{ batters: any[]; pitchers: any[] }> {
  const db = await getIngestClient();
  if (!db) return { batters: [], pitchers: [] };

  const [{ data: batters }, { data: pitchers }] = await Promise.all([
    db
      .from('statcast_daily')
      .select('player_name, barrel_rate, hard_hit_pct, avg_exit_velocity, xwoba')
      .eq('player_type', 'batter')
      .eq('season', season)
      .not('barrel_rate', 'is', null)
      .order('barrel_rate', { ascending: false })
      .limit(limit),
    db
      .from('statcast_daily')
      .select('player_name, xslg, barrel_rate, xwoba')
      .eq('player_type', 'pitcher')
      .eq('season', season)
      .not('xslg', 'is', null)
      .order('xslg', { ascending: true })
      .limit(limit),
  ]);

  return {
    batters: batters ?? [],
    pitchers: pitchers ?? [],
  };
}
