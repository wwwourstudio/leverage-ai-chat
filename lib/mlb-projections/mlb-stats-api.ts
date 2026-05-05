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

// ── Player lookup + stats helpers ─────────────────────────────────────────────

export interface PlayerSeasonStats {
  avg: string;        // e.g. ".311"
  hr: number;
  rbi: number;
  ops: string;        // e.g. ".952"
  slg: string;
  obp: string;
  hits: number;
  atBats: number;
  gamesPlayed: number;
  sb?: number;
  era?: string;       // pitchers
  k?: number;
  bb?: number;
}

export interface PlayerGameLog {
  date: string;       // "Mar 28"
  rawDate?: string;   // ISO yyyy-mm-dd from MLB API
  opp: string;        // "@BOS"
  result: string;     // "W 5-2" | "L 3-8"
  ab?: number;
  h?: number;
  hr?: number;
  rbi?: number;
  k?: number;         // pitchers
  er?: number;
  bb?: number;
  ip?: string;
  numberOfPitches?: number;  // pitchers
}

/** Search for an MLB player ID by name. Returns null on failure. */
export async function findPlayerIdByName(name: string): Promise<number | null> {
  const cacheKey = `pid:${name.toLowerCase()}`;
  const cached = getCached<number | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const url = `${MLB_API}/people/search?names=${encodeURIComponent(name)}&sportIds=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const json = await res.json();
    const people: any[] = json.people ?? [];
    if (!people.length) return null;
    const id = people[0].id as number;
    setCached(cacheKey, id);
    return id;
  } catch {
    return null;
  }
}

/** Fetch season stats for a player. Returns null on failure. */
export async function fetchPlayerSeasonStats(playerId: number, group: 'hitting' | 'pitching' = 'hitting'): Promise<PlayerSeasonStats | null> {
  const season = new Date().getFullYear();
  const cacheKey = `stats:${playerId}:${group}:${season}`;
  const cached = getCached<PlayerSeasonStats | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const url = `${MLB_API}/people/${playerId}/stats?stats=season&season=${season}&group=${group}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = await res.json();
    const splits: any[] = json.stats?.[0]?.splits ?? [];
    if (!splits.length) return null;
    const s = splits[0].stat;

    let result: PlayerSeasonStats;
    if (group === 'hitting') {
      result = {
        avg: s.avg ?? '.---',
        hr: s.homeRuns ?? 0,
        rbi: s.rbi ?? 0,
        ops: s.ops ?? '.---',
        slg: s.slg ?? '.---',
        obp: s.obp ?? '.---',
        hits: s.hits ?? 0,
        atBats: s.atBats ?? 0,
        gamesPlayed: s.gamesPlayed ?? 0,
        sb: s.stolenBases ?? 0,
      };
    } else {
      result = {
        avg: s.avg ?? '.---',
        era: s.era ?? '--',
        hr: 0,
        rbi: 0,
        ops: '.---',
        slg: '.---',
        obp: '.---',
        hits: s.hits ?? 0,
        atBats: 0,
        gamesPlayed: s.gamesPlayed ?? s.gamesPitched ?? 0,
        k: s.strikeOuts ?? 0,
        bb: s.baseOnBalls ?? 0,
      };
    }
    setCached(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

/** Fetch last N games from a player's game log. */
export async function fetchPlayerGameLog(playerId: number, group: 'hitting' | 'pitching' = 'hitting', limit = 5): Promise<PlayerGameLog[]> {
  const season = new Date().getFullYear();
  const cacheKey = `gamelog:${playerId}:${group}:${season}`;
  const cached = getCached<PlayerGameLog[]>(cacheKey);
  if (cached) return cached.slice(0, limit);

  try {
    const url = `${MLB_API}/people/${playerId}/stats?stats=gameLog&season=${season}&group=${group}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const json = await res.json();
    const splits: any[] = json.stats?.[0]?.splits ?? [];

    const logs: PlayerGameLog[] = splits
      .slice(-15)
      .reverse()
      .slice(0, limit)
      .map((sp: any) => {
        const s = sp.stat;
        const dateStr = sp.date ?? '';
        const dateLabel = dateStr
          ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        const opponent = sp.opponent?.abbreviation ?? sp.opponent?.name ?? '???';
        const isHome = sp.isHome ?? true;
        return group === 'hitting'
          ? {
              date: dateLabel,
              rawDate: dateStr,
              opp: `${isHome ? 'vs' : '@'}${opponent}`,
              result: sp.team?.wins != null ? '' : '',
              ab: s.atBats ?? 0,
              h: s.hits ?? 0,
              hr: s.homeRuns ?? 0,
              rbi: s.rbi ?? 0,
            }
          : {
              date: dateLabel,
              rawDate: dateStr,
              opp: `${isHome ? 'vs' : '@'}${opponent}`,
              result: '',
              ip: s.inningsPitched ?? '0',
              k: s.strikeOuts ?? 0,
              er: s.earnedRuns ?? 0,
              bb: s.baseOnBalls ?? 0,
              numberOfPitches: typeof s.numberOfPitches === 'number' ? s.numberOfPitches : (typeof s.pitchesThrown === 'number' ? s.pitchesThrown : undefined),
            };
      });

    setCached(cacheKey, logs);
    return logs.slice(0, limit);
  } catch {
    return [];
  }
}

// ─── DraftKings scoring weights (mirrors monte-carlo.ts) ─────────────────────
const DK_HIT_SCORING = { single: 3, double: 5, triple: 8, hr: 10, rbi: 2, run: 2, bb: 2, sb: 5, k: -0.5 };
const DK_PITCH_SCORING = { out: 0.75, k: 2, win: 4, er: -2 };

function seasonStatsToDKPts(stats: any, group: 'hitting' | 'pitching', games: number): number {
  if (games === 0) return 0;
  if (group === 'hitting') {
    const singles = (stats.hits ?? 0) - (stats.doubles ?? 0) - (stats.triples ?? 0) - (stats.homeRuns ?? 0);
    const total = singles * DK_HIT_SCORING.single
      + (stats.doubles ?? 0) * DK_HIT_SCORING.double
      + (stats.triples ?? 0) * DK_HIT_SCORING.triple
      + (stats.homeRuns ?? 0) * DK_HIT_SCORING.hr
      + (stats.rbi ?? 0) * DK_HIT_SCORING.rbi
      + (stats.runs ?? 0) * DK_HIT_SCORING.run
      + (stats.baseOnBalls ?? 0) * DK_HIT_SCORING.bb
      + (stats.stolenBases ?? 0) * DK_HIT_SCORING.sb
      + (stats.strikeOuts ?? 0) * DK_HIT_SCORING.k;
    return total / games;
  } else {
    const outs = Math.round(parseFloat(String(stats.inningsPitched ?? '0')) * 3);
    const total = outs * DK_PITCH_SCORING.out
      + (stats.strikeOuts ?? 0) * DK_PITCH_SCORING.k
      + (stats.wins ?? 0) * DK_PITCH_SCORING.win
      + (stats.earnedRuns ?? 0) * DK_PITCH_SCORING.er;
    return total / games;
  }
}

export interface PlayerSplits {
  homeAvgDKPts: number;
  roadAvgDKPts: number;
  homeGames:    number;
  roadGames:    number;
}

/** Fetch home/road DK point averages for a player this season. */
export async function fetchPlayerHomeSplits(
  playerId: number,
  playerType: 'hitting' | 'pitching'
): Promise<PlayerSplits> {
  const season = new Date().getFullYear();
  const cacheKey = `splits:${playerId}:${playerType}:${season}`;
  const cached = getCached<PlayerSplits>(cacheKey);
  if (cached) return cached;

  const zero: PlayerSplits = { homeAvgDKPts: 0, roadAvgDKPts: 0, homeGames: 0, roadGames: 0 };

  try {
    const [homeRes, roadRes] = await Promise.all([
      fetch(`${MLB_API}/people/${playerId}/stats?stats=season&group=${playerType}&sitCodes=h&season=${season}`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${MLB_API}/people/${playerId}/stats?stats=season&group=${playerType}&sitCodes=a&season=${season}`, { signal: AbortSignal.timeout(5000) }),
    ]);

    if (!homeRes.ok || !roadRes.ok) return zero;

    const [homeJson, roadJson] = await Promise.all([homeRes.json(), roadRes.json()]);

    const homeSplit = homeJson.stats?.[0]?.splits?.[0];
    const roadSplit = roadJson.stats?.[0]?.splits?.[0];

    const homeGames = homeSplit?.stat?.gamesPlayed ?? 0;
    const roadGames = roadSplit?.stat?.gamesPlayed ?? 0;

    const result: PlayerSplits = {
      homeAvgDKPts: homeSplit ? seasonStatsToDKPts(homeSplit.stat, playerType, homeGames) : 0,
      roadAvgDKPts: roadSplit ? seasonStatsToDKPts(roadSplit.stat, playerType, roadGames) : 0,
      homeGames,
      roadGames,
    };

    setCached(cacheKey, result);
    return result;
  } catch {
    return zero;
  }
}

/** Convert a PlayerGameLog entry to DraftKings fantasy points. */
export function gameLogToDKPts(log: PlayerGameLog): number {
  if ('ab' in log) {
    // hitter
    const h = log.h ?? 0;
    const hr = log.hr ?? 0;
    const rbi = log.rbi ?? 0;
    // approximate: singles = hits - HR (no doubles/triples in game log)
    const singles = Math.max(0, h - hr);
    return singles * DK_HIT_SCORING.single + hr * DK_HIT_SCORING.hr + rbi * DK_HIT_SCORING.rbi;
  } else {
    // pitcher
    const ip = parseFloat(String(log.ip ?? '0'));
    const outs = Math.round(ip * 3);
    const k = log.k ?? 0;
    const er = log.er ?? 0;
    return outs * DK_PITCH_SCORING.out + k * DK_PITCH_SCORING.k + er * DK_PITCH_SCORING.er;
  }
}

// ─── Roster status / scratches / confirmed lineups ───────────────────────────

export type RosterStatus = 'active' | 'IL' | 'minors' | 'unknown';

export interface RosterEntry {
  personId: number;
  fullName: string;
  position: string;       // 'SP', 'OF', etc.
  status: RosterStatus;
  statusCode: string;     // raw MLB status code: 'A', 'IL', 'D7', 'D10', 'D60', etc.
}

/**
 * Fetch a team's active roster (excludes IL, minors, suspended).
 * Backed by /api/v1/teams/{teamId}/roster?rosterType=active.
 * Returns [] on failure rather than throwing — callers degrade to "unknown" status.
 */
export async function fetchActiveRoster(teamId: number): Promise<RosterEntry[]> {
  const cacheKey = `roster:active:${teamId}`;
  const cached = getCached<RosterEntry[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${MLB_API}/teams/${teamId}/roster?rosterType=active`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const json = await res.json();
    const entries: RosterEntry[] = (json.roster ?? []).map((r: any) => ({
      personId: Number(r.person?.id ?? 0),
      fullName: String(r.person?.fullName ?? ''),
      position: String(r.position?.abbreviation ?? ''),
      status: 'active' as const,
      statusCode: String(r.status?.code ?? 'A'),
    })).filter((r: RosterEntry) => r.personId > 0);
    setCached(cacheKey, entries);
    return entries;
  } catch {
    return [];
  }
}

/**
 * Build a Set of personIds that are scratched from today's lineups.
 * Hydrates schedule with `scratches`; missing field → empty set.
 */
export async function fetchScratchedPlayerIds(date?: string): Promise<Set<number>> {
  const dateStr = date ?? formatDate(new Date());
  const cacheKey = `scratches:${dateStr}`;
  const cached = getCached<number[]>(cacheKey);
  if (cached) return new Set(cached);

  try {
    const url = `${MLB_API}/schedule?sportId=1&date=${dateStr}&hydrate=scratches`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return new Set();
    const json = await res.json();

    const ids: number[] = [];
    for (const dateObj of json.dates ?? []) {
      for (const game of dateObj.games ?? []) {
        for (const scratch of game.scratches ?? []) {
          const id = Number(scratch?.playerId ?? scratch?.id ?? 0);
          if (id > 0) ids.push(id);
        }
      }
    }
    setCached(cacheKey, ids);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

/**
 * Fetch the confirmed batting lineup for a single game from the boxscore.
 * Only batters with `battingOrder` set are considered confirmed starters.
 * Returns isOfficial=false when the lineup hasn't been posted yet.
 */
export async function fetchConfirmedLineup(
  gamePk: number,
): Promise<{ homeBatters: number[]; awayBatters: number[]; isOfficial: boolean }> {
  const cacheKey = `boxscore:${gamePk}`;
  type Result = { homeBatters: number[]; awayBatters: number[]; isOfficial: boolean };
  const cached = getCached<Result>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live?fields=liveData,boxscore,teams,home,away,batters,battingOrder,players`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { homeBatters: [], awayBatters: [], isOfficial: false };
    const json = await res.json();
    const home = json.liveData?.boxscore?.teams?.home;
    const away = json.liveData?.boxscore?.teams?.away;
    const homeBatters: number[] = Array.isArray(home?.batters) ? home.batters : [];
    const awayBatters: number[] = Array.isArray(away?.batters) ? away.batters : [];
    // The feed populates `batters[]` only after the lineup card is posted.
    const isOfficial = homeBatters.length >= 9 && awayBatters.length >= 9;
    const result: Result = { homeBatters, awayBatters, isOfficial };
    if (isOfficial) setCached(cacheKey, result); // only cache once it's stable
    return result;
  } catch {
    return { homeBatters: [], awayBatters: [], isOfficial: false };
  }
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
