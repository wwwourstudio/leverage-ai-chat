/**
 * Fantasy Projections Cache
 *
 * Fetches player projection data from the Supabase `fantasy_projections` table,
 * falls back to hardcoded arrays when the table is empty or unreachable.
 *
 * Follows the same pattern as lib/adp-data.ts:
 *   1. In-memory cache (4-hour TTL)
 *   2. Supabase `fantasy_projections` table
 *   3. Hardcoded fallback arrays (from fantasy-card-generator.ts)
 *
 * The `fantasy_projections` table is populated via POST /api/fantasy/projections.
 * Admins can push updated projection data there any time without a code deploy.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** Minimal shape used by VBD/cliff/waiver math in fantasy-card-generator.ts */
export interface GenericProjection {
  name: string;
  team: string;
  pos: string;
  /** Fantasy points (PPR for NFL, 5×5 roto for MLB, 9-cat for NBA) */
  pts: number;
  /** Average Draft Position */
  adp: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// ── Module-level in-memory cache ──────────────────────────────────────────────

const cache: Record<string, { data: GenericProjection[]; fetchedAt: number }> = {};

// ── Season helpers ─────────────────────────────────────────────────────────────

/**
 * MLB regular season: April (month 4) through November = current calendar year.
 * December through March (off-season/spring training) = previous year.
 */
export function currentMLBSeason(): number {
  const month = new Date().getMonth() + 1; // 1-12
  return month >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1;
}

/**
 * NFBC drafts happen in pre-season (Jan-Mar), so the draft year is always
 * the current calendar year regardless of whether the season has started.
 */
export function currentNFBCDraftYear(): number {
  return new Date().getFullYear();
}

/**
 * Current NBA season year (NBA season: Oct of year N to Jun of year N+1).
 * Return the starting year of the current season.
 */
export function currentNBASeason(): number {
  const month = new Date().getMonth() + 1;
  return month >= 10 ? new Date().getFullYear() : new Date().getFullYear() - 1;
}

/** Return the appropriate season year for a given sport */
export function currentSeasonFor(sport: 'nfl' | 'mlb' | 'nba'): number {
  if (sport === 'mlb') return currentMLBSeason();
  if (sport === 'nba') return currentNBASeason();
  // NFL: season year is the calendar year the season STARTS (Sep-Jan = same year)
  const month = new Date().getMonth() + 1;
  return month >= 9 ? new Date().getFullYear() : new Date().getFullYear() - 1;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Returns player projections for the given sport and season year.
 *
 * Priority:
 *   1. In-memory cache (fastest; survives warm serverless invocations)
 *   2. Supabase `api.fantasy_projections` table (refreshed by admins or imports)
 *   3. Hardcoded fallback arrays (guaranteed non-empty safety net)
 *
 * @param sport  - 'nfl' | 'mlb' | 'nba'
 * @param season - Four-digit season year (e.g. 2026)
 * @param getFallback - Function returning the hardcoded fallback for this sport
 */
export async function getProjections(
  sport: 'nfl' | 'mlb' | 'nba',
  season: number,
  getFallback: () => GenericProjection[],
): Promise<GenericProjection[]> {
  const key = `${sport}:${season}`;
  const cached = cache[key];

  // 1. In-memory cache hit
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // 2. Supabase lookup
  try {
    // Dynamic import avoids pulling Supabase into client bundles
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase
      .schema('api')
      .from('fantasy_projections')
      .select('player_name, position, stats, fantasy_points, adp')
      .eq('sport', sport)
      .eq('season_year', season)
      .order('fantasy_points', { ascending: false })
      .limit(250);

    if (!error && data && data.length > 0) {
      const players: GenericProjection[] = data.map(row => ({
        name: row.player_name,
        team: (row.stats as Record<string, string> | null)?.team ?? '',
        pos: row.position,
        pts: Number(row.fantasy_points) || 0,
        adp: Number(row.adp) || 999,
      }));

      cache[key] = { data: players, fetchedAt: Date.now() };
      console.log(`[v0] [ProjectionsCache] Loaded ${players.length} ${sport.toUpperCase()} ${season} projections from Supabase`);
      return players;
    }
  } catch (err) {
    console.warn('[v0] [ProjectionsCache] Supabase lookup failed, using fallback:', err instanceof Error ? err.message : String(err));
  }

  // 3. Hardcoded fallback
  const fallback = getFallback();
  console.log(`[v0] [ProjectionsCache] Using hardcoded fallback: ${fallback.length} ${sport.toUpperCase()} ${season} players`);
  // Cache the fallback too (shorter TTL would be ideal, but keep simple)
  cache[key] = { data: fallback, fetchedAt: Date.now() };
  return fallback;
}

/** Invalidate cache for a sport/season (call after an admin uploads new projections) */
export function invalidateProjectionsCache(sport?: 'nfl' | 'mlb' | 'nba', season?: number): void {
  if (sport && season) {
    delete cache[`${sport}:${season}`];
  } else {
    Object.keys(cache).forEach(k => delete cache[k]);
  }
}
