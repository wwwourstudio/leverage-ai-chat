/**
 * MLB Stats API Client
 * Free public API — no key required
 * https://statsapi.mlb.com/api/v1
 */

export interface MLBGame {
  gamePk: number;
  gameDate: string;         // ISO datetime
  status: string;           // 'Preview', 'Live', 'Final'
  homeTeam: string;         // Full name e.g. 'New York Yankees'
  awayTeam: string;
  homeTeamAbbr: string;     // e.g. 'NYY'
  awayTeamAbbr: string;
  venue: string;            // Ballpark name
  venueLat: number;
  venueLon: number;
  probableHomePitcher?: MLBPitcher;
  probableAwayPitcher?: MLBPitcher;
  homeLineup?: MLBBatter[];
  awayLineup?: MLBBatter[];
}

export interface MLBPitcher {
  id: number;
  fullName: string;
  team: string;
  teamAbbr: string;
  throws: 'R' | 'L' | 'S';
  jerseyNumber?: string;
}

export interface MLBBatter {
  id: number;
  fullName: string;
  team: string;
  teamAbbr: string;
  battingOrder: number;     // 1–9
  position: string;         // 'C', '1B', '2B', etc.
  bats: 'R' | 'L' | 'S';
}

/** Simple in-memory cache with 10-minute TTL */
interface CacheEntry<T> {
  data: T;
  ts: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCached<T>(key: string, data: T) {
  cache.set(key, { data, ts: Date.now() });
}

const MLB_API = 'https://statsapi.mlb.com/api/v1';

/** Format date as YYYY-MM-DD */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Extract team abbreviation from schedule API team object */
function extractAbbr(teamObj: any): string {
  return teamObj?.teamCode?.toUpperCase() || teamObj?.abbreviation?.toUpperCase() || '';
}

/**
 * Fetch today's (or given date's) MLB schedule including probable pitchers.
 * Returns games sorted by game time.
 */
export async function fetchTodaysGames(date?: string): Promise<MLBGame[]> {
  const dateStr = date ?? formatDate(new Date());
  const cacheKey = `schedule:${dateStr}`;
  const cached = getCached<MLBGame[]>(cacheKey);
  if (cached) return cached;

  try {
    const url =
      `${MLB_API}/schedule?sportId=1&date=${dateStr}` +
      `&hydrate=probablePitcher(note),lineups,team,venue(location)` +
      `&fields=dates,games,gamePk,gameDate,status,statusCode,teams,team,name,abbreviation,` +
      `teamCode,probablePitcher,id,fullName,pitchHand,strikeZoneTop,lineups,homePlayers,awayPlayers,` +
      `person,primaryPosition,batSide,jerseyNumber,venue,name,location,defaultCoordinates,latitude,longitude`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'LeverageAI/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`MLB API ${res.status}`);

    const json = await res.json();
    const games: MLBGame[] = [];

    for (const dateObj of json.dates ?? []) {
      for (const game of dateObj.games ?? []) {
        const home = game.teams?.home;
        const away = game.teams?.away;
        if (!home || !away) continue;

        const homeAbbr = extractAbbr(home.team);
        const awayAbbr = extractAbbr(away.team);

        const homePitcher = home.probablePitcher
          ? {
              id: home.probablePitcher.id,
              fullName: home.probablePitcher.fullName ?? '',
              team: home.team?.name ?? '',
              teamAbbr: homeAbbr,
              throws: (home.probablePitcher.pitchHand?.code ?? 'R') as 'R' | 'L' | 'S',
            }
          : undefined;

        const awayPitcher = away.probablePitcher
          ? {
              id: away.probablePitcher.id,
              fullName: away.probablePitcher.fullName ?? '',
              team: away.team?.name ?? '',
              teamAbbr: awayAbbr,
              throws: (away.probablePitcher.pitchHand?.code ?? 'R') as 'R' | 'L' | 'S',
            }
          : undefined;

        // Lineups (may not be posted until closer to game time)
        const homeLineup = extractLineup(game.lineups?.homePlayers, home.team?.name ?? '', homeAbbr);
        const awayLineup = extractLineup(game.lineups?.awayPlayers, away.team?.name ?? '', awayAbbr);

        games.push({
          gamePk: game.gamePk,
          gameDate: game.gameDate,
          status: game.status?.statusCode ?? 'P',
          homeTeam: home.team?.name ?? '',
          awayTeam: away.team?.name ?? '',
          homeTeamAbbr: homeAbbr,
          awayTeamAbbr: awayAbbr,
          venue: game.venue?.name ?? '',
          venueLat: game.venue?.location?.defaultCoordinates?.latitude ?? 0,
          venueLon: game.venue?.location?.defaultCoordinates?.longitude ?? 0,
          probableHomePitcher: homePitcher,
          probableAwayPitcher: awayPitcher,
          homeLineup,
          awayLineup,
        });
      }
    }

    setCached(cacheKey, games);
    return games;
  } catch (err) {
    console.error('[MLBStatsAPI] fetchTodaysGames error:', err);
    return [];
  }
}

function extractLineup(players: any[], teamName: string, teamAbbr: string): MLBBatter[] {
  if (!Array.isArray(players) || players.length === 0) return [];
  return players
    .map((p: any) => ({
      id: p.person?.id ?? 0,
      fullName: p.person?.fullName ?? '',
      team: teamName,
      teamAbbr,
      battingOrder: Math.round((p.battingOrder ?? 0) / 100) || 0,
      position: p.primaryPosition?.abbreviation ?? 'DH',
      bats: (p.batSide?.code ?? 'R') as 'R' | 'L' | 'S',
    }))
    .filter(b => b.id > 0)
    .sort((a, b) => a.battingOrder - b.battingOrder);
}

/**
 * Get remaining games in the current MLB season (for ROS projections).
 * Season window: Opening Day (≈ last week of March) → last Sunday of September.
 * During the off-season / Spring Training the full 162 is returned so that
 * ROS projections still produce meaningful numbers before the season starts.
 */
export function getRemainingGames(gamesPerTeamPerSeason = 162): number {
  const today = new Date();
  const year  = today.getFullYear();
  // Approximate season boundaries — good enough for ROS scaling
  const seasonStart = new Date(`${year}-03-27`);
  const seasonEnd   = new Date(`${year}-09-28`);

  if (today < seasonStart) return gamesPerTeamPerSeason; // Pre-season: full slate
  if (today > seasonEnd)   return 0;                      // Post-season: done

  const totalDays  = (seasonEnd.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24);
  const daysLeft   = (seasonEnd.getTime() - today.getTime())       / (1000 * 60 * 60 * 24);
  return Math.round((daysLeft / totalDays) * gamesPerTeamPerSeason);
}
