/**
 * Fantasy Projections Cache
 *
 * Provides an in-memory cache for player projection data, falling back to
 * hardcoded arrays when the cache is empty.
 *
 * NOTE: Supabase is intentionally NOT imported here because this module is
 * transitively bundled with page-client.tsx (a Client Component). Any import
 * of lib/supabase/server (which uses next/headers) would break the build.
 * Supabase projections can be fetched and seeded via seedProjectionsCache()
 * from server-only code (API routes, server components).
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
 *   2. Hardcoded fallback arrays (guaranteed non-empty safety net)
 *
 * To use live Supabase data, call seedProjectionsCache() from a server-only
 * context (API route, server component) before generateFantasyCards() runs.
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

  // 2. Hardcoded fallback
  const fallback = getFallback();
  cache[key] = { data: fallback, fetchedAt: Date.now() };
  return fallback;
}

/**
 * Seeds the in-memory cache with externally-fetched data.
 * Call this from server-only code (API routes) after fetching from Supabase.
 */
export function seedProjectionsCache(
  sport: 'nfl' | 'mlb' | 'nba',
  season: number,
  players: GenericProjection[],
): void {
  cache[`${sport}:${season}`] = { data: players, fetchedAt: Date.now() };
}

/** Invalidate cache for a sport/season (call after an admin uploads new projections) */
export function invalidateProjectionsCache(sport?: 'nfl' | 'mlb' | 'nba', season?: number): void {
  if (sport && season) {
    delete cache[`${sport}:${season}`];
  } else {
    Object.keys(cache).forEach(k => delete cache[k]);
  }
}
