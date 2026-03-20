/**
 * Game Ingest Service
 *
 * Persists MLB Stats API game schedule data to `teams`, `players`, and
 * `mlb_games` tables so downstream queries can join by stable IDs rather than
 * fuzzy names.  Uses mlb_games (not games) to avoid conflict with the existing
 * api.games table used by the odds / arbitrage infrastructure.
 *
 * Called fire-and-forget from projection-pipeline.ts after each successful
 * `fetchTodaysGames()` call.  All errors are swallowed — ingest failures must
 * never block the pick-generation pipeline.
 *
 * Upsert keys:
 *   teams     → id (abbreviation)
 *   players   → id (MLBAM ID as text)
 *   mlb_games → id (gamePk as text)
 */

import { getIngestClient } from './ingest-client.server';
import type { MLBGame, MLBBatter, MLBPitcher } from '@/lib/mlb-projections/mlb-stats-api';

// ── Teams ─────────────────────────────────────────────────────────────────────

/**
 * Upsert a minimal team record from a game's home/away team fields.
 * Park coordinates are not available from the schedule endpoint — they remain
 * null until enriched by a separate task.
 */
async function upsertTeams(db: any, games: MLBGame[]): Promise<void> {
  const teamMap = new Map<string, { id: string; name: string }>();

  for (const g of games) {
    if (g.homeTeamAbbr) teamMap.set(g.homeTeamAbbr, { id: g.homeTeamAbbr, name: g.homeTeam });
    if (g.awayTeamAbbr) teamMap.set(g.awayTeamAbbr, { id: g.awayTeamAbbr, name: g.awayTeam });
  }

  if (teamMap.size === 0) return;

  const rows = [...teamMap.values()].map(t => ({
    id:         t.id,
    name:       t.name,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db
    .from('teams')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });

  if (error) console.warn('[game-ingest] teams upsert failed:', error.message);
}

// ── Players ───────────────────────────────────────────────────────────────────

function pitcherToRow(p: MLBPitcher): object {
  return {
    id:         String(p.id),
    name:       p.fullName,
    team_id:    p.teamAbbr || null,
    position:   'P',
    throws:     p.throws ?? null,
    is_active:  true,
    updated_at: new Date().toISOString(),
  };
}

function batterToRow(b: MLBBatter): object {
  return {
    id:         String(b.id),
    name:       b.fullName,
    team_id:    b.teamAbbr || null,
    position:   b.position ?? null,
    bats:       b.bats ?? null,
    is_active:  true,
    updated_at: new Date().toISOString(),
  };
}

async function upsertPlayers(db: any, games: MLBGame[]): Promise<void> {
  const playerRows: object[] = [];

  for (const g of games) {
    if (g.probableHomePitcher) playerRows.push(pitcherToRow(g.probableHomePitcher));
    if (g.probableAwayPitcher) playerRows.push(pitcherToRow(g.probableAwayPitcher));
    for (const b of g.homeLineup ?? []) playerRows.push(batterToRow(b));
    for (const b of g.awayLineup ?? []) playerRows.push(batterToRow(b));
  }

  if (playerRows.length === 0) return;

  // Deduplicate by id (same player can appear in multiple games' lineups)
  const seen = new Set<string>();
  const unique = playerRows.filter((r: any) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  const CHUNK = 100;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const { error } = await db
      .from('players')
      .upsert(unique.slice(i, i + CHUNK), { onConflict: 'id', ignoreDuplicates: false });
    if (error) console.warn('[game-ingest] players upsert failed:', error.message);
  }
}

// ── Games ─────────────────────────────────────────────────────────────────────

async function upsertGames(db: any, games: MLBGame[]): Promise<void> {
  if (games.length === 0) return;

  const rows = games.map(g => ({
    id:           String(g.gamePk),
    game_date:    g.gameDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    start_time:   g.gameDate ?? null,
    home_team_id: g.homeTeamAbbr || null,
    away_team_id: g.awayTeamAbbr || null,
    home_team:    g.homeTeam,
    away_team:    g.awayTeam,
    venue:        g.venue ?? null,
    status:       'scheduled',
    updated_at:   new Date().toISOString(),
  }));

  const { error } = await db
    .from('mlb_games')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });

  if (error) console.warn('[game-ingest] mlb_games upsert failed:', error.message);
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Persist today's game schedule (teams → players → games) in dependency order.
 * Non-throwing — safe to call fire-and-forget from the projection pipeline.
 */
export async function persistGames(games: MLBGame[]): Promise<void> {
  if (!games.length) return;

  const db = await getIngestClient();
  if (!db) return;

  try {
    // Order matters: games FK → teams, players FK → teams
    await upsertTeams(db, games);
    await upsertPlayers(db, games);
    await upsertGames(db, games);
    console.log(`[game-ingest] Persisted ${games.length} mlb_games, teams, and lineup players`);
  } catch (err) {
    console.warn('[game-ingest] Unexpected error:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Update a game's weather payload after the projection pipeline resolves
 * weather conditions for a specific venue.
 * Non-throwing — best-effort enrichment.
 */
export async function updateGameWeather(
  gamePk: number,
  weather: Record<string, unknown>,
): Promise<void> {
  const db = await getIngestClient();
  if (!db) return;

  const { error } = await db
    .from('mlb_games')
    .update({ weather, updated_at: new Date().toISOString() })
    .eq('id', String(gamePk));

  if (error) console.warn('[game-ingest] mlb_games weather update failed:', error.message);
}
