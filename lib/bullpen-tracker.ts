/**
 * Bullpen Fatigue Tracker
 *
 * Tired bullpens (many pitchers used, short rest) surrender more HRs.
 * This module fetches a team's last 3 completed games via the MLB Stats API
 * and counts how many pitchers the team used per game.  Higher usage =
 * higher fatigue factor (applied as a multiplier to the HR projection).
 *
 * DATA FLOW
 * ─────────
 *   team name → MLBAM team ID
 *     → last 3 completed game IDs  (schedule endpoint)
 *     → per-game pitcher count     (boxscore endpoint)
 *     → avgPitchersPerGame         → fatigueFactor [0.98, 1.15]
 *
 * Cache TTL: 4 hours (bullpen usage won't change between morning runs).
 *
 * FATIGUE SCALE (pitchers per game, including starter):
 *   ≤ 3.0 → 0.98  starter went 7+ innings, pen fully rested
 *   ≤ 4.0 → 1.00  normal (4 pitchers/game is MLB average)
 *   ≤ 5.0 → 1.05  slightly elevated — short starts or close games
 *   ≤ 6.0 → 1.10  heavy usage — high-leverage or extras
 *   > 6.0 → 1.15  taxed pen — likely tired relievers
 */

const MLB_SCHEDULE_BASE = 'https://statsapi.mlb.com/api/v1/schedule';
const MLB_GAME_BASE     = 'https://statsapi.mlb.com/api/v1/game';
const REQUEST_TIMEOUT   = 7_000;
const CACHE_TTL_MS      = 4 * 60 * 60 * 1000; // 4 hours
const GAMES_TO_SAMPLE   = 3;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BullpenStatus {
  team:                string;
  /** Average total pitchers (starter + relievers) per game over last N games */
  avgPitchersPerGame:  number;
  /** Total bullpen pitches thrown across sampled games */
  totalBullpenPitches: number;
  /** Estimated average rest hours for key relievers */
  avgRest:             number;
  /** HR projection multiplier: 1.0 = normal, >1.0 = fatigued pen (more HRs) */
  fatigueFactor:       number;
}

export const NEUTRAL_BULLPEN: BullpenStatus = {
  team:                'Unknown',
  avgPitchersPerGame:  4,
  totalBullpenPitches: 200,
  avgRest:             48,
  fatigueFactor:       1.0,
};

// ── Team ID lookup ─────────────────────────────────────────────────────────────

// MLBAM canonical team IDs (stable — do not change year to year)
const TEAM_IDS: Record<string, number> = {
  'Arizona Diamondbacks':   109,
  'Atlanta Braves':         144,
  'Baltimore Orioles':      110,
  'Boston Red Sox':         111,
  'Chicago Cubs':           112,
  'Chicago White Sox':      145,
  'Cincinnati Reds':        113,
  'Cleveland Guardians':    114,
  'Colorado Rockies':       115,
  'Detroit Tigers':         116,
  'Houston Astros':         117,
  'Kansas City Royals':     118,
  'Los Angeles Angels':     108,
  'Los Angeles Dodgers':    119,
  'Miami Marlins':          146,
  'Milwaukee Brewers':      158,
  'Minnesota Twins':        142,
  'New York Mets':          121,
  'New York Yankees':       147,
  'Oakland Athletics':      133,
  'Philadelphia Phillies':  143,
  'Pittsburgh Pirates':     134,
  'San Diego Padres':       135,
  'San Francisco Giants':   137,
  'Seattle Mariners':       136,
  'St. Louis Cardinals':    138,
  'Tampa Bay Rays':         139,
  'Texas Rangers':          140,
  'Toronto Blue Jays':      141,
  'Washington Nationals':   120,
};

function resolveTeamId(teamName: string): number | null {
  const lower = teamName.toLowerCase().trim();
  for (const [name, id] of Object.entries(TEAM_IDS)) {
    if (name.toLowerCase() === lower) return id;
    // Last word match: 'Yankees' → 'New York Yankees'
    const lastName = name.toLowerCase().split(' ').at(-1)!;
    if (lower === lastName || lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)) {
      return id;
    }
  }
  return null;
}

// ── Module-level cache ─────────────────────────────────────────────────────────

const cache = new Map<string, { data: BullpenStatus; ts: number }>();

// ── MLB Stats API helpers ──────────────────────────────────────────────────────

/** Fetch the gamePks of the last N completed regular-season games for a team. */
async function fetchRecentGamePks(teamId: number, n = GAMES_TO_SAMPLE): Promise<number[]> {
  // Query last 10 calendar days to handle off-days
  const end   = new Date();
  end.setDate(end.getDate() - 1);             // yesterday (completed)
  const start = new Date(end);
  start.setDate(start.getDate() - 10);        // 10-day window

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url  = `${MLB_SCHEDULE_BASE}?sportId=1&teamId=${teamId}` +
               `&startDate=${fmt(start)}&endDate=${fmt(end)}&gameType=R`;

  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!res.ok) return [];

  const json = await res.json() as {
    dates?: Array<{
      games?: Array<{
        gamePk:  number;
        status?: { detailedState?: string };
      }>;
    }>;
  };

  const pks: number[] = [];
  // Dates are ascending — reverse to get most-recent first
  for (const date of [...(json.dates ?? [])].reverse()) {
    for (const game of (date.games ?? [])) {
      const state = game.status?.detailedState ?? '';
      if (state === 'Final' || state === 'Game Over') {
        pks.push(game.gamePk);
        if (pks.length >= n) return pks;
      }
    }
  }
  return pks;
}

/** Count pitchers a team used in one game from the MLB boxscore. */
async function countPitchersInGame(
  gamePk: number,
  teamId: number,
): Promise<{ pitcherCount: number; pitchesThrown: number }> {
  try {
    const res = await fetch(`${MLB_GAME_BASE}/${gamePk}/boxscore`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    if (!res.ok) return { pitcherCount: 4, pitchesThrown: 80 };

    const box = await res.json() as {
      teams?: {
        home?: {
          team?:      { id: number };
          pitchers?:  number[];
          teamStats?: { pitching?: { pitchesThrown?: number } };
        };
        away?: {
          team?:      { id: number };
          pitchers?:  number[];
          teamStats?: { pitching?: { pitchesThrown?: number } };
        };
      };
    };

    const side = box.teams?.home?.team?.id === teamId
      ? box.teams?.home
      : box.teams?.away;

    return {
      pitcherCount:  side?.pitchers?.length  ?? 4,
      pitchesThrown: side?.teamStats?.pitching?.pitchesThrown ?? 80,
    };
  } catch {
    return { pitcherCount: 4, pitchesThrown: 80 };
  }
}

// ── Fatigue calculation ────────────────────────────────────────────────────────

function fatigueFactor(avgPitchers: number): number {
  if (avgPitchers <= 3.0) return 0.98; // pen well-rested, starter dominant
  if (avgPitchers <= 4.0) return 1.00; // normal MLB usage
  if (avgPitchers <= 5.0) return 1.05; // slightly elevated
  if (avgPitchers <= 6.0) return 1.10; // heavy usage
  return 1.15;                          // taxed bullpen
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Get bullpen fatigue status for the team whose pitchers will face our batter.
 * (Pass the opposing team — the team that will throw the pitches.)
 *
 * Cached 4 hours. Returns NEUTRAL_BULLPEN on any failure.
 */
export async function getBullpenStatus(teamName: string): Promise<BullpenStatus> {
  const hit = cache.get(teamName);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  const teamId = resolveTeamId(teamName);
  if (!teamId) return NEUTRAL_BULLPEN;

  try {
    const gamePks = await fetchRecentGamePks(teamId, GAMES_TO_SAMPLE);
    if (gamePks.length === 0) return NEUTRAL_BULLPEN;

    const results = await Promise.all(
      gamePks.map(pk => countPitchersInGame(pk, teamId)),
    );

    const avgPitchers   = results.reduce((s, r) => s + r.pitcherCount, 0) / results.length;
    const totalPitches  = results.reduce((s, r) => s + r.pitchesThrown, 0);
    // Estimate rest: heavy recent use → shorter avg rest
    const mostRecentCnt = results[0]?.pitcherCount ?? 4;
    const avgRest = mostRecentCnt >= 5 ? 24 : mostRecentCnt >= 4 ? 36 : 48;

    const status: BullpenStatus = {
      team:                teamName,
      avgPitchersPerGame:  Math.round(avgPitchers * 10) / 10,
      totalBullpenPitches: totalPitches,
      avgRest,
      fatigueFactor:       fatigueFactor(avgPitchers),
    };

    cache.set(teamName, { data: status, ts: Date.now() });
    return status;
  } catch {
    return NEUTRAL_BULLPEN;
  }
}

/** Clear the cache (for tests or forced refresh). */
export function clearBullpenCache(): void {
  cache.clear();
}
