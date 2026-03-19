/**
 * MLBAM Player ID Mapping
 *
 * Resolves MLB player names to their canonical MLBAM (Baseball Reference) numeric IDs
 * via the official MLB Stats API people-search endpoint. MLBAM IDs are the only
 * reliable key for cross-referencing Statcast, Baseball Savant, and prop markets —
 * name strings vary wildly across data sources ("Ozzie Albies" vs "Albies, Ozzie"
 * vs "O. Albies").
 *
 * Cache TTL: 24 hours. Player IDs never change; team/position may change mid-season
 * but 24h staleness is acceptable for betting analysis.
 */

const MLB_PEOPLE_SEARCH = 'https://statsapi.mlb.com/api/v1/people/search';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REQUEST_TIMEOUT_MS = 5_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlayerMap {
  /** MLBAM numeric player ID — use this as the universal key */
  id: number;
  /** Canonical full name from MLB Stats API */
  fullName: string;
  /** Current team name, if available */
  team?: string;
  /** Primary position abbreviation (SP, RP, C, 1B, SS, CF, etc.) */
  position?: string;
  /** Batting hand: L, R, or S (switch) */
  batSide?: string;
  /** Pitching hand: L or R */
  pitchHand?: string;
}

// ── Module-level cache ────────────────────────────────────────────────────────
// Keyed by normalised name (trimmed, lowercase). The cache is per-process-instance
// (Vercel serverless warm invocations reuse it); cold starts re-fetch on first call.

const nameCache = new Map<string, { data: PlayerMap | null; expiry: number }>();
const idCache   = new Map<number, { data: PlayerMap | null; expiry: number }>();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise a player name for cache key generation.
 * Strips punctuation, lowercases, collapses whitespace.
 * "Judge, Aaron" → "judge aaron"; "Aaron Judge" → "aaron judge"
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up a player's MLBAM ID and profile by name.
 *
 * Tries the name as provided, then a "Last, First" variant if the first attempt
 * returns no results. Returns null on any network failure or if the player is
 * not found (minor leaguers, historical players not in the search index, etc.).
 *
 * Example:
 * ```ts
 * const p = await getPlayerByName('Aaron Judge');
 * // { id: 592450, fullName: 'Aaron Judge', team: 'New York Yankees', position: 'RF' }
 * ```
 */
export async function getPlayerByName(name: string): Promise<PlayerMap | null> {
  const key = normalizeName(name);
  const now = Date.now();

  const hit = nameCache.get(key);
  if (hit && hit.expiry > now) return hit.data;

  // Build name variants to try: "Aaron Judge" → also try "Judge, Aaron"
  const variants = [name];
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    variants.push(`${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`);
  }

  for (const variant of variants) {
    try {
      const url = `${MLB_PEOPLE_SEARCH}?names=${encodeURIComponent(variant)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) continue;

      const json = await res.json() as {
        people?: Array<{
          id: number;
          fullName: string;
          currentTeam?: { name: string };
          primaryPosition?: { abbreviation: string };
          batSide?: { code: string };
          pitchHand?: { code: string };
        }>;
      };

      const person = json.people?.[0];
      if (!person) continue;

      const player: PlayerMap = {
        id:        person.id,
        fullName:  person.fullName,
        team:      person.currentTeam?.name,
        position:  person.primaryPosition?.abbreviation,
        batSide:   person.batSide?.code,
        pitchHand: person.pitchHand?.code,
      };

      const expiry = now + CACHE_TTL_MS;
      nameCache.set(key, { data: player, expiry });
      idCache.set(player.id, { data: player, expiry });
      return player;
    } catch {
      // Try next variant
    }
  }

  // Cache null to avoid hammering the API for unknown players
  nameCache.set(key, { data: null, expiry: now + CACHE_TTL_MS });
  return null;
}

/**
 * Look up a player's profile by MLBAM ID.
 *
 * Uses the `/people/{id}` endpoint which is more stable than the search endpoint.
 * Useful when you already have an ID from Statcast data and need the display name.
 */
export async function getPlayerById(id: number): Promise<PlayerMap | null> {
  const now = Date.now();

  const hit = idCache.get(id);
  if (hit && hit.expiry > now) return hit.data;

  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${id}`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
    if (!res.ok) return null;

    const json = await res.json() as {
      people?: Array<{
        id: number;
        fullName: string;
        currentTeam?: { name: string };
        primaryPosition?: { abbreviation: string };
        batSide?: { code: string };
        pitchHand?: { code: string };
      }>;
    };

    const person = json.people?.[0];
    if (!person) return null;

    const player: PlayerMap = {
      id:        person.id,
      fullName:  person.fullName,
      team:      person.currentTeam?.name,
      position:  person.primaryPosition?.abbreviation,
      batSide:   person.batSide?.code,
      pitchHand: person.pitchHand?.code,
    };

    const expiry = now + CACHE_TTL_MS;
    idCache.set(id, { data: player, expiry });
    nameCache.set(normalizeName(player.fullName), { data: player, expiry });
    return player;
  } catch {
    return null;
  }
}

/**
 * Clear the in-memory cache (e.g. after a roster move or in tests).
 */
export function clearPlayerMapCache(): void {
  nameCache.clear();
  idCache.clear();
}
