/**
 * MLB Schedule Service
 *
 * Fetches today's MLB games and probable pitchers from the official MLB Stats API
 * (statsapi.mlb.com — no API key required, public endpoint).
 *
 * Used by the picks engine to:
 *   - Match player props to specific games (for weather + pitcher context)
 *   - Get probable pitcher names so we can look up their Statcast data
 *   - Identify dome vs outdoor games (dome → weather factor = 1.0)
 *
 * Cache TTL: 2 hours — schedule and pitchers are stable once posted day-of.
 */

const MLB_SCHEDULE_BASE = 'https://statsapi.mlb.com/api/v1/schedule';
const MLB_PEOPLE_BASE   = 'https://statsapi.mlb.com/api/v1/people';
const CACHE_TTL_MS      = 2 * 60 * 60 * 1000; // 2 hours
const REQUEST_TIMEOUT   = 8_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProbablePitcher {
  /** MLBAM player ID */
  id:       number;
  fullName: string;
  /** Pitching hand: 'L' | 'R' | null (unknown) */
  hand:     'L' | 'R' | null;
}

export interface ScheduledGame {
  /** MLB gamePk — unique game identifier */
  gameId:       number;
  /** ISO date-time string (UTC) */
  gameDate:     string;
  homeTeam:     string;
  homeTeamId:   number;
  awayTeam:     string;
  awayTeamId:   number;
  venueName:    string;
  /** Probable starter for the home team (may be null when not announced) */
  homePitcher:  ProbablePitcher | null;
  /** Probable starter for the away team */
  awayPitcher:  ProbablePitcher | null;
  /** true when the venue has a permanent or retractable roof (weather irrelevant) */
  isDome:       boolean;
}

// ── Dome detection ─────────────────────────────────────────────────────────────

const DOME_VENUE_KEYWORDS = [
  'minute maid', 'tropicana', 'rogers centre', 'loandepot',
  't-mobile', 'chase field', 'american family field', 'toyota dome',
];

function isDomeVenue(venueName: string): boolean {
  const lower = venueName.toLowerCase();
  return DOME_VENUE_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Module-level cache ─────────────────────────────────────────────────────────

const scheduleCache = new Map<string, { data: ScheduledGame[]; expiry: number }>();

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch scheduled MLB games for a given date (default: today in ET).
 *
 * @param date - YYYY-MM-DD string. Defaults to today in Eastern Time.
 * @returns Array of scheduled games. Returns [] on network failure.
 */
export async function getTodayGames(date?: string): Promise<ScheduledGame[]> {
  const gameDate = date ?? getTodayDateET();
  const now      = Date.now();

  const cached = scheduleCache.get(gameDate);
  if (cached && cached.expiry > now) return cached.data;

  const url = `${MLB_SCHEDULE_BASE}?sportId=1&date=${gameDate}&hydrate=probablePitcher`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
    if (!res.ok) return [];

    const json = await res.json() as {
      dates?: Array<{
        games?: Array<{
          gamePk: number;
          gameDate: string;
          teams: {
            home: { team: { id: number; name: string } };
            away: { team: { id: number; name: string } };
          };
          venue: { name: string };
          probablePitchers?: {
            home?: { id: number; fullName: string };
            away?: { id: number; fullName: string };
          };
        }>;
      }>;
    };

    const rawGames = json.dates?.[0]?.games ?? [];

    // Fetch pitcher handedness in parallel (one request per pitcher, small batch)
    const pitcherIds = new Set<number>();
    for (const g of rawGames) {
      if (g.probablePitchers?.home?.id) pitcherIds.add(g.probablePitchers.home.id);
      if (g.probablePitchers?.away?.id) pitcherIds.add(g.probablePitchers.away.id);
    }
    const handMap = await fetchPitcherHands([...pitcherIds]);

    const games: ScheduledGame[] = rawGames.map(g => ({
      gameId:     g.gamePk,
      gameDate:   g.gameDate,
      homeTeam:   g.teams.home.team.name,
      homeTeamId: g.teams.home.team.id,
      awayTeam:   g.teams.away.team.name,
      awayTeamId: g.teams.away.team.id,
      venueName:  g.venue.name,
      isDome:     isDomeVenue(g.venue.name),
      homePitcher: g.probablePitchers?.home
        ? { id: g.probablePitchers.home.id, fullName: g.probablePitchers.home.fullName, hand: handMap.get(g.probablePitchers.home.id) ?? null }
        : null,
      awayPitcher: g.probablePitchers?.away
        ? { id: g.probablePitchers.away.id, fullName: g.probablePitchers.away.fullName, hand: handMap.get(g.probablePitchers.away.id) ?? null }
        : null,
    }));

    scheduleCache.set(gameDate, { data: games, expiry: now + CACHE_TTL_MS });
    return games;
  } catch {
    return [];
  }
}

/**
 * Find the game a player's team is playing today.
 * Matches on partial team name (case-insensitive).
 * Returns null when the team has no game scheduled.
 */
export function findGameForTeam(games: ScheduledGame[], teamName: string): ScheduledGame | null {
  const lower = teamName.toLowerCase();
  return games.find(g =>
    g.homeTeam.toLowerCase().includes(lower) ||
    g.awayTeam.toLowerCase().includes(lower) ||
    lower.includes(g.homeTeam.toLowerCase()) ||
    lower.includes(g.awayTeam.toLowerCase())
  ) ?? null;
}

/**
 * Get the opposing pitcher for a team in a game.
 * (If the batter plays for the home team, they face the away pitcher, and vice versa.)
 */
export function getOpposingPitcher(
  game:     ScheduledGame,
  teamName: string,
): ProbablePitcher | null {
  const lower = teamName.toLowerCase();
  const isHome = game.homeTeam.toLowerCase().includes(lower)
    || lower.includes(game.homeTeam.toLowerCase());
  return isHome ? game.awayPitcher : game.homePitcher;
}

/**
 * Clear the schedule cache (e.g. after midnight).
 */
export function clearScheduleCache(): void {
  scheduleCache.clear();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns today's date in Eastern Time as YYYY-MM-DD */
function getTodayDateET(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // 'en-CA' → YYYY-MM-DD
}

/**
 * Batch-fetch pitcher throwing hands from the MLB Stats API.
 * Returns a Map<playerId, 'L'|'R'>.
 * Silently ignores failures — hand will be null for unknown pitchers.
 */
async function fetchPitcherHands(ids: number[]): Promise<Map<number, 'L' | 'R'>> {
  const map = new Map<number, 'L' | 'R'>();
  if (ids.length === 0) return map;

  // Fetch in a single bulk call: /api/v1/people?personIds=1,2,3
  try {
    const url = `${MLB_PEOPLE_BASE}?personIds=${ids.join(',')}&hydrate=currentTeam`;
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
    if (!res.ok) return map;

    const json = await res.json() as {
      people?: Array<{ id: number; pitchHand?: { code: string } }>;
    };

    for (const p of (json.people ?? [])) {
      const hand = p.pitchHand?.code;
      if (hand === 'L' || hand === 'R') map.set(p.id, hand);
    }
  } catch {
    // Non-fatal — hand will be null
  }

  return map;
}
