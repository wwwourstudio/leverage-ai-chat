/**
 * Statcast Query Layer
 *
 * Server-side only. Queries the api.statcast_events table populated by the
 * Baseball Savant scraper (scripts/scrape-statcast.ts → GitHub Actions daily).
 *
 * Tables (schema: api):
 *   statcast_events      — normalized pitch/play rows (typed columns)
 *   statcast_raw_events  — verbatim JSONB from Savant CSV (source of truth)
 *
 * All functions return { data, error } pairs — callers should check error
 * before using data. If the tables are empty or the scraper hasn't run yet,
 * queries return { data: [], error: null } (empty is not an error).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatcastFilters {
  batter?: number;        // MLB player id (batter_id column)
  pitcher?: number;       // MLB player id (pitcher_id column)
  start?: string;         // ISO date 'YYYY-MM-DD'
  end?: string;           // ISO date 'YYYY-MM-DD'
  pitch_type?: string;    // e.g. 'FF', 'SL', 'CH'
  /** Max rows to return. Server-side cap: 5 000 */
  limit?: number;
}

/** Maps to api.statcast_events columns */
export interface StatcastPitch {
  id: number;
  event_id: string;
  game_date: string;
  game_pk: number | null;
  batter_id: number | null;
  pitcher_id: number | null;
  batter_name: string | null;
  pitcher_name: string | null;
  pitch_type: string | null;
  release_speed: number | null;
  release_spin_rate: number | null;
  pfx_x: number | null;
  pfx_z: number | null;
  launch_speed: number | null;    // exit velocity mph
  launch_angle: number | null;
  hit_distance_sc: number | null;
  events: string | null;
  description: string | null;
  batter_stand: string | null;
  pitcher_throws: string | null;
  home_team: string | null;
  away_team: string | null;
  bb_type: string | null;
  estimated_ba_using_speedangle: number | null;
  estimated_woba_using_speedangle: number | null;
  woba_value: number | null;
  inserted_at: string;
}

/** Aggregated Statcast metrics computed from pitch-level data */
export interface StatcastAggregate {
  playerName: string;
  playerType: 'batter' | 'pitcher';
  samplePitches: number;
  sampleBIP: number;          // balls in play with exit velo recorded
  avgExitVelo: number | null;
  barrelRate: number | null;  // % (EV ≥ 98 + angle 26-30)
  hardHitRate: number | null; // % (EV ≥ 95)
  sweetSpotRate: number | null; // % (angle 8-32)
  avgLaunchAngle: number | null;
  avgReleaseSpeed: number | null; // pitchers only
  avgSpinRate: number | null;     // pitchers only
  dateRange: { min: string; max: string } | null;
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

/** Wrap a Supabase error to a readable string, or null if no error */
function handleSupabaseError(error: { message?: string } | null): string | null {
  if (!error) return null;
  const msg = error.message ?? String(error);
  if (msg.includes('does not exist') || msg.includes('relation')) {
    return 'statcast_events table not found — run migrations/0001_create_statcast_tables.sql in Supabase';
  }
  return msg;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch raw Statcast pitch rows from api.statcast_events matching the given filters.
 * Server-side row cap: 5 000.
 */
export async function getRawStatcast(filters: StatcastFilters): Promise<QueryResult<StatcastPitch>> {
  const MAX_LIMIT = 5_000;
  const rowLimit = Math.min(filters.limit ?? MAX_LIMIT, MAX_LIMIT);

  try {
    const supabase = await getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('statcast_events')
      .select('*', { count: 'exact' })
      .limit(rowLimit)
      .order('game_date', { ascending: false });

    if (filters.batter)     query = query.eq('batter_id',   filters.batter);
    if (filters.pitcher)    query = query.eq('pitcher_id',  filters.pitcher);
    if (filters.pitch_type) query = query.eq('pitch_type',  filters.pitch_type);
    if (filters.start)      query = query.gte('game_date',  filters.start);
    if (filters.end)        query = query.lte('game_date',  filters.end);

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
 * Fetch pitches for tunneling analysis for a given pitcher.
 * Returns the most recent 1 000 pitches with movement data.
 */
export async function getPitcherTunneling(
  pitcherId: number,
  start?: string,
): Promise<QueryResult<StatcastPitch>> {
  try {
    const supabase = await getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('statcast_events')
      .select('pitch_type, release_speed, release_spin_rate, pfx_x, pfx_z, plate_x, plate_z')
      .eq('pitcher_id', pitcherId)
      .not('pfx_x', 'is', null)
      .not('pfx_z', 'is', null)
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
 * Compute aggregated Statcast metrics for a player by name from api.statcast_events.
 * Searches batter_name (playerType='batter') or pitcher_name (playerType='pitcher').
 * Returns null if no matching rows found.
 */
export async function getPlayerAggregate(
  playerName: string,
  playerType: 'batter' | 'pitcher' = 'batter',
  days = 30,
): Promise<StatcastAggregate | null> {
  try {
    const supabase = await getSupabase();
    const nameCol = playerType === 'batter' ? 'batter_name' : 'pitcher_name';
    const needle = playerName.trim().toLowerCase();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    // Fetch recent pitches for this player (up to 2 000 rows is plenty to aggregate)
    const { data, error } = await supabase
      .from('statcast_events')
      .select(`game_date, launch_speed, launch_angle, release_speed, release_spin_rate, ${nameCol}`)
      .ilike(nameCol, `%${needle}%`)
      .gte('game_date', cutoffStr)
      .order('game_date', { ascending: false })
      .limit(2_000);

    if (error) return null;
    if (!data || data.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = data as any[];

    // Resolve actual player name from first matching row
    const resolvedName: string = rows[0]?.[nameCol] ?? playerName;

    let totalEV = 0, evCount = 0;
    let barrels = 0, hardHit = 0, sweetSpot = 0, bip = 0;
    let totalAngle = 0, angleCount = 0;
    let totalSpeed = 0, speedCount = 0;
    let totalSpin = 0, spinCount = 0;
    let dateMin = '', dateMax = '';

    for (const row of rows) {
      const d: string = row.game_date ?? '';
      if (d) {
        if (!dateMin || d < dateMin) dateMin = d;
        if (!dateMax || d > dateMax) dateMax = d;
      }

      const ev  = typeof row.launch_speed  === 'number' ? row.launch_speed  : null;
      const ang = typeof row.launch_angle  === 'number' ? row.launch_angle  : null;
      const spd = typeof row.release_speed === 'number' ? row.release_speed : null;
      const spn = typeof row.release_spin_rate === 'number' ? row.release_spin_rate : null;

      if (ev !== null && ev > 0) {
        totalEV += ev;
        evCount++;
        bip++;
        if (ev >= 95) hardHit++;
        if (ang !== null && ev >= 98 && ang >= 26 && ang <= 30) barrels++;
        if (ang !== null && ang >= 8 && ang <= 32) sweetSpot++;
      }
      if (ang !== null) { totalAngle += ang; angleCount++; }
      if (spd !== null && spd > 0) { totalSpeed += spd; speedCount++; }
      if (spn !== null && spn > 0) { totalSpin  += spn; spinCount++; }
    }

    return {
      playerName: resolvedName,
      playerType,
      samplePitches: rows.length,
      sampleBIP: bip,
      avgExitVelo:    evCount    > 0 ? Math.round((totalEV    / evCount)    * 10) / 10 : null,
      barrelRate:     bip        > 0 ? Math.round((barrels    / bip)  * 1000) / 10 : null,
      hardHitRate:    bip        > 0 ? Math.round((hardHit    / bip)  * 1000) / 10 : null,
      sweetSpotRate:  bip        > 0 ? Math.round((sweetSpot  / bip)  * 1000) / 10 : null,
      avgLaunchAngle: angleCount > 0 ? Math.round((totalAngle / angleCount)  * 10) / 10 : null,
      avgReleaseSpeed: speedCount > 0 ? Math.round((totalSpeed / speedCount)  * 10) / 10 : null,
      avgSpinRate:    spinCount  > 0 ? Math.round(totalSpin   / spinCount) : null,
      dateRange: dateMin ? { min: dateMin, max: dateMax } : null,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch top hitters from statcast_events ranked by avg exit velocity (last 30 days).
 * Returns up to `limit` rows (max 50).
 */
export async function getExitVeloLeaderboard(
  limit = 10,
  days = 30,
): Promise<{ playerName: string; avgExitVelo: number; sampleBIP: number }[]> {
  try {
    const supabase = await getSupabase();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Use Supabase RPC or raw query — fall back to JS aggregation
    const { data, error } = await supabase
      .from('statcast_events')
      .select('batter_name, launch_speed')
      .gte('game_date', cutoff.toISOString().slice(0, 10))
      .not('launch_speed', 'is', null)
      .gt('launch_speed', 0)
      .limit(50_000); // fetch enough to aggregate

    if (error || !data) return [];

    // JS-side aggregation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, { total: number; count: number }>();
    for (const row of data as any[]) {
      const name: string = row.batter_name ?? 'Unknown';
      const ev: number = row.launch_speed ?? 0;
      const entry = map.get(name) ?? { total: 0, count: 0 };
      entry.total += ev;
      entry.count += 1;
      map.set(name, entry);
    }

    return Array.from(map.entries())
      .filter(([, v]) => v.count >= 20) // min 20 BIP
      .map(([name, v]) => ({
        playerName: name,
        avgExitVelo: Math.round((v.total / v.count) * 10) / 10,
        sampleBIP: v.count,
      }))
      .sort((a, b) => b.avgExitVelo - a.avgExitVelo)
      .slice(0, Math.min(limit, 50));
  } catch {
    return [];
  }
}
