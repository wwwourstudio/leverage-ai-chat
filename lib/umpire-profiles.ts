/**
 * Umpire Strike Zone Profiles
 *
 * HP umpires vary significantly in zone size, directly affecting:
 *   - Strikeout rates (expanded zone → more Ks → fewer balls in play → fewer HRs)
 *   - Walk rates (tight zone → more BBs → more plate appearances)
 *   - HR probability (net additive effect captured in hrBoost)
 *
 * hrBoost > 0 → tight zone, more walks, marginally more HRs
 * hrBoost < 0 → expanded zone, more Ks on hittable pitches, fewer HRs
 *
 * Data sources: Stathead Umpire Database, Umpire Scorecards (umpscorecards.com),
 * Baseball Prospectus PITCHf/x-era reports (career averages).
 *
 * HP umpire assignment is fetched daily from:
 *   statsapi.mlb.com/api/v1/schedule?gamePk={id}&hydrate=officials
 */

const REQUEST_TIMEOUT = 5_000;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UmpireProfile {
  name:    string;
  /** Strikeout rate multiplier (1.10 = 10% more Ks called) */
  soBoost: number;
  /** Walk rate multiplier */
  bbBoost: number;
  /**
   * Net HR probability adjustment — additive pp (e.g. +0.03 = +3 percentage points).
   * Applied as (1 + hrBoost) multiplier on the base HR probability.
   */
  hrBoost: number;
}

// ── Static career profiles ─────────────────────────────────────────────────────
// Sorted by descending |hrBoost| so the most impactful umpires are first.

const UMPIRE_PROFILES: UmpireProfile[] = [
  // Expanded zones (more called strikes → fewer HRs)
  { name: 'CB Bucknor',          soBoost: 1.12, bbBoost: 0.88, hrBoost: -0.04 },
  { name: 'Laz Diaz',            soBoost: 1.08, bbBoost: 0.91, hrBoost: -0.03 },
  { name: 'James Hoye',          soBoost: 1.09, bbBoost: 0.90, hrBoost: -0.03 },
  { name: 'Angel Hernandez',     soBoost: 1.06, bbBoost: 0.91, hrBoost: -0.03 },
  { name: 'Quinn Wolcott',       soBoost: 1.07, bbBoost: 0.92, hrBoost: -0.02 },
  { name: 'Mark Carlson',        soBoost: 1.05, bbBoost: 0.93, hrBoost: -0.02 },
  { name: 'Stu Scheurwater',     soBoost: 1.05, bbBoost: 0.93, hrBoost: -0.02 },
  { name: 'Chris Guccione',      soBoost: 1.04, bbBoost: 0.94, hrBoost: -0.02 },
  { name: 'Ed Hickox',           soBoost: 1.04, bbBoost: 0.94, hrBoost: -0.01 },
  { name: 'Mike DiMuro',         soBoost: 1.03, bbBoost: 0.95, hrBoost: -0.01 },
  { name: 'Tripp Gibson',        soBoost: 1.03, bbBoost: 0.95, hrBoost: -0.01 },

  // Tight zones (fewer called strikes → more walks → more HRs)
  { name: 'Marty Foster',        soBoost: 0.91, bbBoost: 1.12, hrBoost:  0.04 },
  { name: 'Jerry Layne',         soBoost: 0.94, bbBoost: 1.09, hrBoost:  0.03 },
  { name: 'Bill Miller',         soBoost: 0.93, bbBoost: 1.08, hrBoost:  0.03 },
  { name: 'Mike Winters',        soBoost: 0.94, bbBoost: 1.07, hrBoost:  0.03 },
  { name: 'Hunter Wendelstedt',  soBoost: 0.96, bbBoost: 1.06, hrBoost:  0.02 },
  { name: 'Paul Emmel',          soBoost: 0.95, bbBoost: 1.05, hrBoost:  0.02 },
  { name: 'Ted Barrett',         soBoost: 0.96, bbBoost: 1.05, hrBoost:  0.02 },
  { name: 'Jim Joyce',           soBoost: 0.97, bbBoost: 1.04, hrBoost:  0.01 },
  { name: 'Dana DeMuth',         soBoost: 0.97, bbBoost: 1.04, hrBoost:  0.01 },
  { name: 'Tim Tschida',         soBoost: 0.98, bbBoost: 1.03, hrBoost:  0.01 },
];

export const NEUTRAL_UMPIRE: UmpireProfile = {
  name: 'Unknown', soBoost: 1.0, bbBoost: 1.0, hrBoost: 0,
};

// O(1) index by lowercase name
const PROFILE_INDEX = new Map<string, UmpireProfile>(
  UMPIRE_PROFILES.map(u => [u.name.toLowerCase(), u]),
);

// ── Lookup ─────────────────────────────────────────────────────────────────────

/**
 * Look up an umpire's profile by name (case-insensitive, partial-match).
 * Accepts "CB Bucknor", "Bucknor", "cb bucknor", etc.
 * Returns NEUTRAL_UMPIRE when not found (no effect on projection).
 */
export function getUmpireProfile(name: string): UmpireProfile {
  if (!name) return NEUTRAL_UMPIRE;
  const lower = name.toLowerCase().trim();

  // Exact match
  const exact = PROFILE_INDEX.get(lower);
  if (exact) return exact;

  // Last-name or full-substring match
  for (const [key, profile] of PROFILE_INDEX) {
    const lastName = key.split(' ').at(-1)!;
    if (lower === lastName || lower.includes(lastName) || key.includes(lower)) {
      return profile;
    }
  }

  return NEUTRAL_UMPIRE;
}

// ── MLB Stats API ──────────────────────────────────────────────────────────────

/**
 * Fetch the HP umpire name for a given MLB gamePk.
 * Returns null when not yet assigned (early AM) or on network error.
 *
 * MLB Stats API:
 *   /api/v1/schedule?gamePk={id}&hydrate=officials
 */
export async function fetchGameHPUmpire(gamePk: number): Promise<string | null> {
  try {
    const url = `https://statsapi.mlb.com/api/v1/schedule?gamePk=${gamePk}&hydrate=officials`;
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
    if (!res.ok) return null;

    const json = await res.json() as {
      dates?: Array<{
        games?: Array<{
          officials?: Array<{
            official:     { id: number; fullName: string };
            officialType: string;
          }>;
        }>;
      }>;
    };

    const officials = json.dates?.[0]?.games?.[0]?.officials ?? [];
    const hp = officials.find(o =>
      o.officialType === 'Home Plate' ||
      o.officialType.toLowerCase().includes('home'),
    );

    return hp?.official.fullName ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch HP umpire for a game and return their career profile.
 * Non-throwing — returns NEUTRAL_UMPIRE on any failure.
 */
export async function getGameUmpireProfile(gamePk: number): Promise<UmpireProfile & { umpireName: string | null }> {
  const name = await fetchGameHPUmpire(gamePk).catch(() => null);
  const profile = name ? getUmpireProfile(name) : NEUTRAL_UMPIRE;
  return { ...profile, umpireName: name };
}

export { UMPIRE_PROFILES };
