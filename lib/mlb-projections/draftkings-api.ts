/**
 * DraftKings public lobby + draftables fetcher.
 *
 * Uses the unofficial-but-public DraftKings endpoints that power their lobby UI:
 *   - https://www.draftkings.com/lobby/getcontests?sport=MLB
 *   - https://api.draftkings.com/draftgroups/v1/draftgroups/{id}/draftables
 *
 * No auth is required for read access. These endpoints are status-of-the-world —
 * if they're unavailable we fall through to degraded mode rather than retry.
 */
import { Result, Ok, Err, tryAsync } from '@/lib/types';

const LOG = '[v0] [DFS]';

/** DK showdown contest type ids — single-game head-to-head formats. */
const SHOWDOWN_CONTEST_TYPE_IDS = new Set([96, 97, 98, 114, 115]);
/** Minimum game count to be treated as a classic multi-game slate. */
const CLASSIC_MIN_GAMES = 2;

const LOBBY_URL = 'https://www.draftkings.com/lobby/getcontests?sport=MLB';
const DRAFTABLES_URL = (id: number) => `https://api.draftkings.com/draftgroups/v1/draftgroups/${id}/draftables`;

// Browser-ish UA so DK doesn't 403 us behind their bot filter.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** A DraftKings draft group corresponds to one contest slate (Main, Afternoon, Showdown, etc.). */
export interface DKDraftGroup {
  draftGroupId: number;
  startDate: string;        // ISO
  gameCount: number;
  slateLabel: string;       // 'Main', 'Afternoon', 'Showdown — LAD@SF', etc.
  contestType: 'classic' | 'showdown';
  games: DKGameRef[];
}

export interface DKGameRef {
  gameId: number;
  awayTeamAbbr: string;
  homeTeamAbbr: string;
  startTime: string;        // ISO
}

/** A single draftable player in a DK slate. */
export interface DKDraftable {
  draftableId: number;
  playerId: number;
  firstName: string;
  lastName: string;
  displayName: string;
  team: string;             // abbr
  teamId: number;
  position: string;         // SP/RP/C/1B/2B/3B/SS/OF
  salary: number;
  /** Projected DK fantasy points (DK's own projection from `draftStatAttributes`). */
  projectedFpts: number;
  /** Roster availability per DK: 'Available' | 'OUT' | 'Questionable'. */
  status: 'Available' | 'OUT' | 'Questionable';
  /** True when DK has marked the player as in the confirmed starting lineup. */
  isStartingLineup: boolean;
  /** ISO start time of the player's game in this slate. */
  gameStartTime: string;
  competitionName: string;  // 'MIA @ ATL'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDKDate(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // DK sometimes returns ".NET dates" like /Date(1715380200000)/ — convert.
  const dotnet = raw.match(/^\/Date\((\d+)\)\/?$/);
  if (dotnet) return new Date(Number(dotnet[1])).toISOString();
  return raw;
}

function classifyStatus(rawStatus: unknown): DKDraftable['status'] {
  const s = String(rawStatus ?? '').toUpperCase();
  if (s === 'OUT' || s === 'INJ' || s === 'D' || s === 'IL') return 'OUT';
  if (s === 'Q' || s === 'QUESTIONABLE' || s === 'P' || s === 'PROBABLE') return 'Questionable';
  return 'Available';
}

/** Pull the projected fantasy points from `draftStatAttributes`. id 90 is the standard "proj fpts" key. */
function extractProjectedFpts(attrs: any[] | undefined): number {
  if (!Array.isArray(attrs)) return 0;
  const proj = attrs.find(a => a?.id === 90 || /proj/i.test(String(a?.name ?? '')));
  if (!proj) return 0;
  const n = parseFloat(String(proj.sortValue ?? proj.value ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

/** Pull the "starting lineup confirmed" flag from `playerGameAttributes`. id 1 means "is in confirmed lineup". */
function extractIsStartingLineup(attrs: any[] | undefined): boolean {
  if (!Array.isArray(attrs)) return false;
  const start = attrs.find(a => a?.id === 1);
  if (!start) return false;
  return String(start.value ?? '').toLowerCase() === 'true';
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<Result<T, Error>> {
  return tryAsync(async () => {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return (await res.json()) as T;
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch all currently-listed MLB DK draft groups (slates).
 * Returns the list sorted ascending by `startDate`.
 */
export async function fetchDKContests(): Promise<Result<DKDraftGroup[], Error>> {
  const fetched = await fetchJson<{ DraftGroups?: any[] }>(LOBBY_URL, 4000);
  if (!fetched.ok) {
    console.warn(`${LOG} fetchDKContests failed: ${fetched.error.message}`);
    return fetched;
  }

  const raw = fetched.value.DraftGroups ?? [];
  const groups: DKDraftGroup[] = raw
    .filter(g => g && typeof g.DraftGroupId === 'number')
    .map(g => {
      // Classify as showdown if DK explicitly marks it as a single-game format,
      // OR if it has only 1 game (showdown slates always have gameCount === 1).
      // Classic multi-game slates are everything else.
      const gameCount = Number(g.GameCount ?? (Array.isArray(g.Games) ? g.Games.length : 0));
      const isShowdownByTypeId = SHOWDOWN_CONTEST_TYPE_IDS.has(Number(g.ContestTypeId));
      const isShowdownByGameCount = gameCount < CLASSIC_MIN_GAMES;
      const contestType: DKDraftGroup['contestType'] =
        (isShowdownByTypeId || isShowdownByGameCount) ? 'showdown' : 'classic';
      const games: DKGameRef[] = Array.isArray(g.Games)
        ? g.Games.map((gm: any) => ({
            gameId: Number(gm.GameId ?? gm.gameId ?? 0),
            awayTeamAbbr: String(gm.AwayTeamCity ?? gm.awayTeam ?? gm.AwayTeam ?? '').toUpperCase(),
            homeTeamAbbr: String(gm.HomeTeamCity ?? gm.homeTeam ?? gm.HomeTeam ?? '').toUpperCase(),
            startTime: parseDKDate(gm.StartDate ?? gm.startTime),
          }))
        : [];

      const tag = String(g.DraftGroupTag ?? g.ContestStartTimeSuffix ?? '').trim();
      const slateLabel = tag || (contestType === 'showdown' ? 'Showdown' : `${gameCount}-game slate`);

      return {
        draftGroupId: Number(g.DraftGroupId),
        startDate: parseDKDate(g.StartDate),
        gameCount,
        slateLabel,
        contestType,
        games,
        _rawContestTypeId: Number(g.ContestTypeId ?? -1),
      } as DKDraftGroup & { _rawContestTypeId: number };
    })
    .filter(g => g.draftGroupId > 0)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return Ok(groups);
}

/**
 * Fetch the authoritative draftable-player pool for a slate.
 * Players not in this list are NOT eligible for any DK contest on that slate.
 */
export async function fetchDKDraftables(draftGroupId: number): Promise<Result<DKDraftable[], Error>> {
  const fetched = await fetchJson<{ draftables?: any[] }>(DRAFTABLES_URL(draftGroupId), 6000);
  if (!fetched.ok) {
    console.warn(`${LOG} fetchDKDraftables(${draftGroupId}) failed: ${fetched.error.message}`);
    return fetched;
  }

  const raw = fetched.value.draftables ?? [];
  const seen = new Set<number>(); // dedupe — DK lists each player once per eligible roster slot

  const players: DKDraftable[] = [];
  for (const d of raw) {
    if (!d || typeof d.playerId !== 'number') continue;
    if (seen.has(d.playerId)) continue;
    seen.add(d.playerId);

    players.push({
      draftableId: Number(d.draftableId ?? d.playerId),
      playerId: Number(d.playerId),
      firstName: String(d.firstName ?? ''),
      lastName: String(d.lastName ?? ''),
      displayName: String(d.displayName ?? `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim()),
      team: String(d.teamAbbreviation ?? d.team ?? '').toUpperCase(),
      teamId: Number(d.teamId ?? 0),
      position: String(d.position ?? d.rosterSlotId ?? '').toUpperCase(),
      salary: Number(d.salary ?? 0),
      projectedFpts: extractProjectedFpts(d.draftStatAttributes),
      status: classifyStatus(d.status ?? d.newsStatus),
      isStartingLineup: extractIsStartingLineup(d.playerGameAttributes),
      gameStartTime: parseDKDate(d.competition?.startTime),
      competitionName: String(d.competition?.name ?? ''),
    });
  }

  return Ok(players);
}

/**
 * Convert a UTC ISO string to "YYYY-MM-DD" in America/New_York.
 * Late-evening games (e.g. 9 PM ET = 01:00 UTC next day) must be bucketed
 * by their ET date, not their UTC date.
 */
function toETDate(isoUtc: string): string {
  try {
    const d = new Date(isoUtc);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
    // en-CA locale formats as YYYY-MM-DD which matches our target format
  } catch {
    return isoUtc.slice(0, 10);
  }
}

/**
 * Pick the "Main" classic slate for a given date — the largest classic slate
 * starting at or after 4:00 pm ET. Falls back to the largest classic slate of
 * the day if no evening slate exists. Returns Err if nothing matches.
 */
export async function getMainSlate(date?: Date): Promise<Result<DKDraftGroup, Error>> {
  const contests = await fetchDKContests();
  if (!contests.ok) return contests;

  // Compare in ET — a 9 PM ET game has a UTC date of the next day, so we must
  // bucket slates by their Eastern date rather than their UTC date.
  const targetET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date ?? new Date());
  const allToday = contests.value.filter(g => toETDate(g.startDate) === targetET);
  const sameDay = allToday.filter(g => g.contestType === 'classic');
  console.log(
    `${LOG} getMainSlate(${targetET}): total=${contests.value.length} today=${allToday.length} ` +
    `classic=${sameDay.length} typeIds=${[...new Set(contests.value.map(g => (g as any)._rawContestTypeId))].join(',')}`,
  );
  if (sameDay.length === 0) {
    return Err(new Error(`No classic DK MLB slates found for ${targetET} (${allToday.length} total today, ${contests.value.length} total returned)`));
  }

  // Prefer slates starting at or after 4 pm ET. ET 4 pm = UTC 20:00 (EDT) or 21:00 (EST).
  // Check by converting the slate start time to ET hours.
  const evening = sameDay.filter(g => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        hour12: false,
      }).formatToParts(new Date(g.startDate));
      const hourET = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
      return hourET >= 16; // 4 pm ET or later
    } catch {
      return false;
    }
  });
  const pool = evening.length > 0 ? evening : sameDay;

  // Largest game count wins; ties broken by latest start time (the "true" main slate).
  const main = pool.slice().sort((a, b) => {
    if (b.gameCount !== a.gameCount) return b.gameCount - a.gameCount;
    return b.startDate.localeCompare(a.startDate);
  })[0];

  return Ok(main);
}
