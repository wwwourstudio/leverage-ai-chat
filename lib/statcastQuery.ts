/**
 * Statcast Query Layer
 *
 * Server-side only. Uses the existing lib/supabase/server.ts createClient
 * pattern (dynamic import) to avoid the browser/server boundary.
 *
 * Tables (schema: api):
 *   statcast_pitches_raw  — pitch-level Statcast data
 *   hitter_splits         — pre-computed hitter splits (vs LHP/RHP, home/away)
 *
 * All functions return { data, error } pairs — callers should check error
 * before using data.  If the Statcast tables have not yet been migrated,
 * queries return { data: [], error: 'Statcast tables not yet migrated' }
 * rather than throwing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatcastFilters {
  batter?: number;        // MLB player id
  pitcher?: number;       // MLB player id
  start?: string;         // ISO date 'YYYY-MM-DD'
  end?: string;           // ISO date 'YYYY-MM-DD'
  pitch_type?: string;    // e.g. 'FF', 'SL', 'CH'
  /** Max rows to return. Server-side cap: 5 000 */
  limit?: number;
}

export interface StatcastPitch {
  id: number;
  batter: number;
  pitcher: number;
  game_date: string;
  pitch_type: string | null;
  release_speed: number | null;
  release_spin_rate: number | null;
  pfx_x: number | null;
  pfx_z: number | null;
  vx0: number | null;
  vy0: number | null;
  vz0: number | null;
  ax: number | null;
  ay: number | null;
  az: number | null;
  launch_speed: number | null;
  launch_angle: number | null;
  hit_distance_sc: number | null;
  events: string | null;
  description: string | null;
  stand: string | null;
  p_throws: string | null;
  home_team: string | null;
  away_team: string | null;
  created_at: string;
}

export interface HitterSplit {
  id: number;
  batter: number;
  player_name: string | null;
  season: number;
  split_type: string;
  pa: number;
  hr: number;
  hr_rate: number | null;
  barrel_rate: number | null;
  avg_exit_velocity: number | null;
  air_pull_rate: number | null;
  hard_hit_rate: number | null;
  updated_at: string;
}

export interface QueryResult<T> {
  data: T[];
  error: string | null;
  count?: number;
}

// ---------------------------------------------------------------------------
// Supabase client (dynamic import — server-side only)
// ---------------------------------------------------------------------------

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/** Wrap a Supabase query to detect missing-table errors and degrade gracefully */
function handleSupabaseError(error: { message?: string } | null): string | null {
  if (!error) return null;
  const msg = error.message ?? String(error);
  if (
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('statcast')
  ) {
    return 'Statcast tables not yet migrated — run scripts/statcast-schema.sql in Supabase';
  }
  return msg;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch all hitter split rows for a given batter (all split types, all seasons).
 */
export async function getHitterSplits(batterId: number): Promise<QueryResult<HitterSplit>> {
  try {
    const supabase = await getSupabase();
    const { data, error, count } = await supabase
      .from('hitter_splits')
      .select('*', { count: 'exact' })
      .eq('batter', batterId)
      .order('season', { ascending: false });

    return {
      data: (data as HitterSplit[]) ?? [],
      error: handleSupabaseError(error),
      count: count ?? 0,
    };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Statcast query failed' };
  }
}

/**
 * Fetch raw Statcast pitch rows matching the given filters.
 * Server-side row cap: 5 000.
 */
export async function getRawStatcast(filters: StatcastFilters): Promise<QueryResult<StatcastPitch>> {
  const MAX_LIMIT = 5_000;
  const rowLimit = Math.min(filters.limit ?? MAX_LIMIT, MAX_LIMIT);

  try {
    const supabase = await getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('statcast_pitches_raw')
      .select('*', { count: 'exact' })
      .limit(rowLimit)
      .order('game_date', { ascending: false });

    if (filters.batter)     query = query.eq('batter',     filters.batter);
    if (filters.pitcher)    query = query.eq('pitcher',    filters.pitcher);
    if (filters.pitch_type) query = query.eq('pitch_type', filters.pitch_type);
    if (filters.start)      query = query.gte('game_date', filters.start);
    if (filters.end)        query = query.lte('game_date', filters.end);

    const { data, error, count } = await query;

    return {
      data: (data as StatcastPitch[]) ?? [],
      error: handleSupabaseError(error),
      count: count ?? 0,
    };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Statcast query failed' };
  }
}

/**
 * Fetch pitch pairs for tunneling analysis for a given pitcher.
 * Returns the most recent 200 pitches per pitch type (≤ 1 000 rows total).
 */
export async function getPitcherTunneling(
  pitcherId: number,
  start?: string,
): Promise<QueryResult<StatcastPitch>> {
  try {
    const supabase = await getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('statcast_pitches_raw')
      .select('pitch_type, vx0, vy0, vz0, ax, ay, az, release_speed, release_spin_rate')
      .eq('pitcher', pitcherId)
      .not('vx0', 'is', null)
      .not('vy0', 'is', null)
      .not('vz0', 'is', null)
      .order('game_date', { ascending: false })
      .limit(1_000);

    if (start) query = query.gte('game_date', start);

    const { data, error, count } = await query;

    return {
      data: (data as StatcastPitch[]) ?? [],
      error: handleSupabaseError(error),
      count: count ?? 0,
    };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Statcast query failed' };
  }
}

/**
 * Fetch hitter leaderboard for a given metric and season.
 * Valid metrics: 'hr_rate' | 'barrel_rate' | 'avg_exit_velocity' | 'air_pull_rate' | 'hard_hit_rate'
 */
export async function getLeaderboard(
  metric: 'hr_rate' | 'barrel_rate' | 'avg_exit_velocity' | 'air_pull_rate' | 'hard_hit_rate',
  season: number,
  limit = 10,
): Promise<QueryResult<HitterSplit>> {
  const safeCols = ['hr_rate', 'barrel_rate', 'avg_exit_velocity', 'air_pull_rate', 'hard_hit_rate'];
  if (!safeCols.includes(metric)) {
    return { data: [], error: `Invalid metric: ${metric}. Valid: ${safeCols.join(', ')}` };
  }

  try {
    const supabase = await getSupabase();
    const { data, error, count } = await supabase
      .from('hitter_splits')
      .select('*', { count: 'exact' })
      .eq('season', season)
      .eq('split_type', 'overall')
      .not(metric, 'is', null)
      .gte('pa', 50)                   // minimum PA for leaderboard eligibility
      .order(metric, { ascending: false })
      .limit(Math.min(limit, 50));

    return {
      data: (data as HitterSplit[]) ?? [],
      error: handleSupabaseError(error),
      count: count ?? 0,
    };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Statcast query failed' };
  }
}
