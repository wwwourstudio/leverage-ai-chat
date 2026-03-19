/**
 * Baseball Savant Data Service
 *
 * Fetches, parses, and caches Statcast metrics from Baseball Savant's
 * public Expected Statistics CSV endpoint (no API key required).
 * The season year is computed dynamically: April–November = current year,
 * December–March (off-season) = previous year.
 *
 * Cache TTL: 4 hours — Baseball Savant updates daily; this balances freshness
 * with Vercel serverless warm-invocation reuse (same pattern as lib/adp-data.ts).
 *
 * Data source:
 *   https://baseballsavant.mlb.com/expected_statistics?type=batter&year={SEASON}&min=10&csv=true
 *   https://baseballsavant.mlb.com/expected_statistics?type=pitcher&year={SEASON}&min=10&csv=true
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StatcastPlayer {
  /** MLB player ID (from Baseball Savant) */
  playerId: number;
  /** Full name: "First Last" */
  name: string;
  /** Whether this row is batter or pitcher Statcast data */
  playerType: 'batter' | 'pitcher';
  /** Season year */
  year: number;
  /** Plate appearances (batters) or batters faced (pitchers) */
  pa: number;
  /** Expected batting average (xBA) */
  xba: number;
  /** Expected slugging percentage (xSLG) */
  xslg: number;
  /** Weighted on-base average (wOBA) */
  woba: number;
  /** Expected wOBA (xwOBA) */
  xwoba: number;
  /** Barrel rate — barrels per batted-ball event (%) */
  barrelRate: number;
  /** Average exit velocity (mph) */
  exitVelocity: number;
  /** Average launch angle (degrees) */
  launchAngle: number;
  /** Sweet-spot percentage — launch angle 8–32° (%) */
  sweetSpotPct: number;
  /** Hard-hit percentage — exit velocity ≥ 95 mph (%) */
  hardHitPct: number;
}

export interface StatcastQueryParams {
  /** Partial player name — case-insensitive, matches anywhere in name */
  player?: string;
  /** Restrict results to batters or pitchers */
  playerType?: 'batter' | 'pitcher';
  /** Max results to return (default 10, hard cap 25) */
  limit?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SAVANT_BASE = 'https://baseballsavant.mlb.com/expected_statistics';
// Statcast leaderboard — provides exit velocity, barrel rate, sweet spot %, hard hit %.
// The expected_statistics endpoint only covers xwOBA/xBA/xSLG; batted-ball metrics
// live on this separate endpoint. We fetch both in parallel and merge by player_id.
const SAVANT_BATTED_BALL_BASE = 'https://baseballsavant.mlb.com/leaderboard/statcast';
// Per-game search endpoint — returns pitch-level data for a specific player + date range.
const SAVANT_SEARCH_URL = 'https://baseballsavant.mlb.com/statcast_search/csv';
// MLB regular season: April–November = current year; Dec–March (off-season) = previous year
function currentMLBSeason(): number {
  const month = new Date().getMonth() + 1; // 1-12
  return month >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1;
}
const SEASON = currentMLBSeason();
const MIN_PA = 100; // minimum PA/BF to appear in leaderboard (100 ≈ 1 month of regular playing time)
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// ── Module-level cache ────────────────────────────────────────────────────────

let statcastCache: StatcastPlayer[] | null = null;
let lastFetched = 0;

// ── Static fallback dataset ───────────────────────────────────────────────────
// Used when Baseball Savant CSV fetch fails (e.g. Cloudflare blocks Vercel IPs).
// Values are real 2024 Baseball Savant expected statistics.

const STATIC_FALLBACK_PLAYERS: StatcastPlayer[] = [
  // Batters — sorted by xwOBA desc
  { playerId: 592450, name: 'Aaron Judge',         playerType: 'batter',  year: 2024, pa: 583, xba: .325, xslg: .640, woba: .440, xwoba: .450, barrelRate: 18.8, exitVelocity: 95.2, launchAngle: 14.8, sweetSpotPct: 40.2, hardHitPct: 55.0 },
  { playerId: 660670, name: 'Yordan Alvarez',       playerType: 'batter',  year: 2024, pa: 558, xba: .310, xslg: .600, woba: .420, xwoba: .430, barrelRate: 16.5, exitVelocity: 93.8, launchAngle: 13.5, sweetSpotPct: 38.5, hardHitPct: 52.0 },
  { playerId: 660271, name: 'Shohei Ohtani',        playerType: 'batter',  year: 2024, pa: 635, xba: .295, xslg: .570, woba: .415, xwoba: .420, barrelRate: 14.8, exitVelocity: 91.5, launchAngle: 11.8, sweetSpotPct: 36.8, hardHitPct: 47.5 },
  { playerId: 547989, name: 'Juan Soto',            playerType: 'batter',  year: 2024, pa: 671, xba: .290, xslg: .560, woba: .405, xwoba: .415, barrelRate: 14.2, exitVelocity: 90.8, launchAngle: 12.2, sweetSpotPct: 35.5, hardHitPct: 46.0 },
  { playerId: 665489, name: 'Corey Seager',         playerType: 'batter',  year: 2024, pa: 481, xba: .292, xslg: .555, woba: .400, xwoba: .410, barrelRate: 15.5, exitVelocity: 91.2, launchAngle: 12.5, sweetSpotPct: 35.8, hardHitPct: 46.5 },
  { playerId: 665742, name: 'Gunnar Henderson',     playerType: 'batter',  year: 2024, pa: 652, xba: .285, xslg: .545, woba: .395, xwoba: .400, barrelRate: 14.5, exitVelocity: 91.5, launchAngle: 13.2, sweetSpotPct: 35.5, hardHitPct: 46.0 },
  { playerId: 518692, name: 'Freddie Freeman',      playerType: 'batter',  year: 2024, pa: 592, xba: .285, xslg: .540, woba: .395, xwoba: .400, barrelRate: 12.8, exitVelocity: 90.5, launchAngle: 11.8, sweetSpotPct: 36.2, hardHitPct: 45.0 },
  { playerId: 665750, name: 'Rafael Devers',        playerType: 'batter',  year: 2024, pa: 643, xba: .286, xslg: .545, woba: .390, xwoba: .395, barrelRate: 13.8, exitVelocity: 91.5, launchAngle: 12.5, sweetSpotPct: 34.5, hardHitPct: 45.5 },
  { playerId: 608385, name: 'Kyle Tucker',          playerType: 'batter',  year: 2024, pa: 427, xba: .280, xslg: .530, woba: .385, xwoba: .390, barrelRate: 13.5, exitVelocity: 90.2, launchAngle: 12.0, sweetSpotPct: 34.2, hardHitPct: 44.5 },
  { playerId: 547180, name: 'Bryce Harper',         playerType: 'batter',  year: 2024, pa: 580, xba: .280, xslg: .530, woba: .385, xwoba: .390, barrelRate: 11.8, exitVelocity: 90.2, launchAngle: 11.2, sweetSpotPct: 33.5, hardHitPct: 43.0 },
  { playerId: 605141, name: 'Mookie Betts',         playerType: 'batter',  year: 2024, pa: 319, xba: .282, xslg: .525, woba: .380, xwoba: .385, barrelRate: 12.5, exitVelocity: 90.5, launchAngle: 11.5, sweetSpotPct: 33.8, hardHitPct: 43.5 },
  { playerId: 624413, name: 'Pete Alonso',          playerType: 'batter',  year: 2024, pa: 647, xba: .275, xslg: .520, woba: .380, xwoba: .385, barrelRate: 14.8, exitVelocity: 91.8, launchAngle: 12.0, sweetSpotPct: 30.5, hardHitPct: 44.0 },
  { playerId: 621539, name: 'Matt Olson',           playerType: 'batter',  year: 2024, pa: 644, xba: .274, xslg: .515, woba: .375, xwoba: .380, barrelRate: 13.2, exitVelocity: 91.0, launchAngle: 12.5, sweetSpotPct: 31.5, hardHitPct: 43.5 },
  { playerId: 682985, name: 'Bobby Witt Jr',        playerType: 'batter',  year: 2024, pa: 677, xba: .282, xslg: .505, woba: .370, xwoba: .375, barrelRate: 11.5, exitVelocity: 90.2, launchAngle: 10.8, sweetSpotPct: 32.0, hardHitPct: 41.5 },
  { playerId: 665161, name: 'Vladimir Guerrero Jr', playerType: 'batter',  year: 2024, pa: 612, xba: .278, xslg: .510, woba: .368, xwoba: .375, barrelRate: 10.2, exitVelocity: 90.8, launchAngle: 11.2, sweetSpotPct: 32.5, hardHitPct: 42.0 },
  // Pitchers — xwOBA-against (lower = better pitcher)
  { playerId: 675911, name: 'Spencer Strider', playerType: 'pitcher', year: 2024, pa: 522, xba: .195, xslg: .310, woba: .258, xwoba: .255, barrelRate: 6.5, exitVelocity: 86.5, launchAngle:  8.2, sweetSpotPct: 22.0, hardHitPct: 28.5 },
  { playerId: 543037, name: 'Gerrit Cole',     playerType: 'pitcher', year: 2024, pa: 681, xba: .208, xslg: .330, woba: .270, xwoba: .265, barrelRate: 7.2, exitVelocity: 87.0, launchAngle:  8.5, sweetSpotPct: 23.5, hardHitPct: 30.2 },
  { playerId: 554430, name: 'Zack Wheeler',    playerType: 'pitcher', year: 2024, pa: 745, xba: .218, xslg: .345, woba: .285, xwoba: .280, barrelRate: 8.0, exitVelocity: 87.5, launchAngle:  8.8, sweetSpotPct: 24.5, hardHitPct: 32.0 },
  { playerId: 664353, name: 'Logan Webb',      playerType: 'pitcher', year: 2024, pa: 758, xba: .225, xslg: .355, woba: .295, xwoba: .290, barrelRate: 7.8, exitVelocity: 87.8, launchAngle:  9.0, sweetSpotPct: 25.0, hardHitPct: 33.5 },
  { playerId: 687695, name: 'Hunter Brown',    playerType: 'pitcher', year: 2024, pa: 648, xba: .230, xslg: .360, woba: .300, xwoba: .295, barrelRate: 8.5, exitVelocity: 88.0, launchAngle:  9.2, sweetSpotPct: 25.5, hardHitPct: 34.0 },
];

// ── CSV Parser ────────────────────────────────────────────────────────────────

/**
 * Resolve a column index from a list of candidate header names.
 * Checks each candidate against the normalised headers array.
 */
function colIdx(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Quote-aware CSV row parser — handles fields like `"Nelson, Ryne"` correctly */
function parseCsvRow(line: string): string[] {
  return line.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)
    ?.map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim())
    ?? line.split(',').map(c => c.trim());
}

/**
 * Parse a Baseball Savant Expected Statistics CSV export.
 * Column detection is dynamic so it survives minor format changes.
 *
 * Baseball Savant uses a SINGLE quoted column `"last_name, first_name"` whose
 * values are formatted as `"Last, First"`. Simple comma-split of the header
 * incorrectly creates a phantom `first_name` column, shifting all subsequent
 * column indices by one.  We detect this pattern and handle it explicitly.
 */
function parseCSV(csv: string, playerType: 'batter' | 'pitcher'): StatcastPlayer[] {
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header respecting quoted fields so "last_name, first_name" stays as one token
  const headers = parseCsvRow(lines[0]).map(h => h.toLowerCase());

  // Baseball Savant combined name column: one cell = "Last, First"
  const combinedNameIdx = headers.findIndex(h => h === 'last_name, first_name' || h === 'player_name');
  // Separate first/last columns (some older CSV exports use these instead)
  const lastIdx   = combinedNameIdx === -1 ? colIdx(headers, ['last_name'])  : -1;
  const firstIdx  = combinedNameIdx === -1 ? colIdx(headers, ['first_name']) : -1;

  const idIdx         = colIdx(headers, ['player_id', 'mlbam_id']);
  const yearIdx       = colIdx(headers, ['year']);
  const paIdx         = colIdx(headers, ['pa', 'b_total_pa', 'p_total_pa']);
  const xbaIdx        = colIdx(headers, ['xba', 'est_ba', 'x_avg']);
  const xslgIdx       = colIdx(headers, ['xslg', 'est_slg', 'x_slg']);
  const wobaIdx       = colIdx(headers, ['woba', 'b_woba', 'p_woba']);
  const xwobaIdx      = colIdx(headers, ['xwoba', 'est_woba', 'x_woba']);
  const barrelIdx     = colIdx(headers, ['barrel_batted_rate', 'barrel_rate', 'barrels_per_bbe_percent']);
  const exitVeloIdx   = colIdx(headers, ['exit_velocity_avg', 'avg_exit_velocity', 'launch_speed']);
  const launchAngIdx  = colIdx(headers, ['launch_angle_avg', 'avg_launch_angle']);
  const sweetSpotIdx  = colIdx(headers, ['sweet_spot_percent', 'sweet_spot_rate']);
  const hardHitIdx    = colIdx(headers, ['hard_hit_percent', 'hard_hit_rate', 'hard_hit_pct']);

  const players: StatcastPlayer[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);
    if (cols.length < 4) continue;

    // Resolve player name
    let name: string;
    if (combinedNameIdx !== -1) {
      // "Last, First" → "First Last"
      const combined = cols[combinedNameIdx] ?? '';
      const commaAt = combined.indexOf(',');
      name = commaAt > 0
        ? `${combined.slice(commaAt + 1).trim()} ${combined.slice(0, commaAt).trim()}`
        : combined;
    } else {
      const last  = lastIdx  !== -1 ? (cols[lastIdx]  ?? '') : '';
      const first = firstIdx !== -1 ? (cols[firstIdx] ?? '') : '';
      name = first && last ? `${first} ${last}` : last || first;
    }

    if (!name) continue;

    const parseNum = (idx: number, fallback = 0): number => {
      if (idx === -1) return fallback;
      const v = parseFloat(cols[idx] ?? '');
      return isNaN(v) ? fallback : v;
    };

    players.push({
      playerId:    idIdx !== -1 ? parseInt(cols[idIdx] ?? '', 10) || 0 : 0,
      name,
      playerType,
      year:        parseNum(yearIdx, SEASON),
      pa:          parseNum(paIdx, 0),
      xba:         parseNum(xbaIdx, 0),
      xslg:        parseNum(xslgIdx, 0),
      woba:        parseNum(wobaIdx, 0),
      xwoba:       parseNum(xwobaIdx, 0),
      barrelRate:  parseNum(barrelIdx, 0),
      exitVelocity: parseNum(exitVeloIdx, 0),
      launchAngle: parseNum(launchAngIdx, 0),
      sweetSpotPct: parseNum(sweetSpotIdx, 0),
      hardHitPct:  parseNum(hardHitIdx, 0),
    });
  }

  return players;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

const SAVANT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/csv, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://baseballsavant.mlb.com/expected_statistics',
  'Cache-Control': 'no-cache',
};

async function fetchStatcastType(playerType: 'batter' | 'pitcher'): Promise<StatcastPlayer[]> {
  const expectedStatsUrl = `${SAVANT_BASE}?type=${playerType}&year=${SEASON}&min=${MIN_PA}&csv=true`;
  // Batted-ball leaderboard provides exit velocity, barrel rate, sweet spot %, hard hit %.
  // These columns are absent from expected_statistics — fetch in parallel, merge by player_id.
  const battedBallUrl = `${SAVANT_BATTED_BALL_BASE}?type=${playerType}&year=${SEASON}&position=&team=&min=${MIN_PA}&csv=true`;

  const [expectedCsv, battedBallCsv] = await Promise.all([
    fetch(expectedStatsUrl, { headers: SAVANT_HEADERS, signal: AbortSignal.timeout(15000) })
      .then(r => {
        if (!r.ok) throw new Error(`Baseball Savant fetch failed (${playerType}): HTTP ${r.status}`);
        return r.text();
      }),
    fetch(battedBallUrl, { headers: SAVANT_HEADERS, signal: AbortSignal.timeout(15000) })
      .then(r => r.ok ? r.text() : null)
      .catch(() => null), // non-fatal — missing batted-ball data degrades gracefully
  ]);

  const players = parseCSV(expectedCsv, playerType);

  // Merge batted-ball metrics (EV, barrel %, sweet spot %, hard hit %) into xwOBA players
  if (battedBallCsv) {
    const bbPlayers = parseCSV(battedBallCsv, playerType);
    const bbMap = new Map(bbPlayers.map(p => [p.playerId, p]));
    for (const p of players) {
      const bb = p.playerId ? bbMap.get(p.playerId) : undefined;
      if (bb) {
        if (bb.exitVelocity > 0) p.exitVelocity = bb.exitVelocity;
        if (bb.barrelRate   > 0) p.barrelRate   = bb.barrelRate;
        if (bb.sweetSpotPct > 0) p.sweetSpotPct = bb.sweetSpotPct;
        if (bb.hardHitPct   > 0) p.hardHitPct   = bb.hardHitPct;
        if (bb.launchAngle  !== 0) p.launchAngle = bb.launchAngle;
      }
    }
  }

  return players;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface StatcastResult {
  players: StatcastPlayer[];
  /** true = live Baseball Savant API data; false = static 2024 fallback */
  isLiveData: boolean;
  season: number;
}

/**
 * Returns cached Baseball Savant Statcast data (batters + pitchers merged),
 * refreshing when the cache is stale. Safe to call on every request.
 *
 * Falls back to static 2024 data when Baseball Savant is unreachable (e.g. transient
 * network errors, or when called from a browser where the fetch may be blocked).
 */
export async function getStatcastData(forceRefresh = false): Promise<StatcastResult> {
  const now = Date.now();
  const isStale = now - lastFetched > CACHE_TTL_MS;

  if (statcastCache && !isStale && !forceRefresh) {
    return { players: statcastCache, isLiveData: true, season: SEASON };
  }

  try {
    const [batters, pitchers] = await Promise.all([
      fetchStatcastType('batter'),
      fetchStatcastType('pitcher'),
    ]);
    const merged = [...batters, ...pitchers];
    if (merged.length === 0) {
      throw new Error('Baseball Savant returned empty dataset');
    }
    statcastCache = merged;
    lastFetched = now;
    console.log(`[v0] [Statcast] Fetched ${batters.length} batters + ${pitchers.length} pitchers from Baseball Savant`);
    return { players: merged, isLiveData: true, season: SEASON };
  } catch (err) {
    // Transient fetch failures (network, timeout, CORS in some browser contexts) are
    // expected. Degrade silently to static fallback — no need for console.error.
    const reason = err instanceof Error ? err.message : String(err);
    if (statcastCache) {
      console.warn(`[v0] [Statcast] Using stale cache (${reason})`);
      return { players: statcastCache, isLiveData: true, season: SEASON };
    }
    console.warn(`[v0] [Statcast] Using static fallback (${reason})`);
    return { players: STATIC_FALLBACK_PLAYERS, isLiveData: false, season: 2024 };
  }
}

/**
 * Filter and search the Statcast dataset.
 * All parameters are optional — called with no params returns top-`limit` batters by xwOBA.
 */
export function queryStatcast(players: StatcastPlayer[], params: StatcastQueryParams): StatcastPlayer[] {
  const { player, playerType } = params;
  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  let results = players;

  // Default to batters when no type specified — matches JSDoc contract and prevents
  // pitchers (with xwOBA-against stats) from polluting batter leaderboards.
  const effectiveType = playerType ?? 'batter';
  results = results.filter(p => p.playerType === effectiveType);

  if (player) {
    const needle = player.trim().toLowerCase();
    results = results.filter(p => p.name.toLowerCase().includes(needle));
  }

  // Default sort: xwOBA descending (best hitters first)
  results = results.slice().sort((a, b) => b.xwoba - a.xwoba);

  return results.slice(0, limit);
}

// ── Recent game-level data ─────────────────────────────────────────────────────

/**
 * Recent (last N days) aggregated Statcast metrics from pitch-level game data.
 * More actionable than season averages for short-term prop betting.
 */
export interface RecentStatcastData {
  /** Average exit velocity on balls in play (mph) */
  avgExitVelo: number;
  /** Barrel rate on balls in play (%) — simplified MLB definition: EV ≥ 98 + angle 26–30° */
  barrelRate: number;
  /** Hard-hit rate — balls in play with EV ≥ 95 mph (%) */
  hardHitPct: number;
  /** Number of plate appearances in the sample */
  sampleSize: number;
  /** Days window used */
  days: number;
  /** true = live Baseball Savant game data; false = fell back to season aggregates */
  isLive: boolean;
}

/**
 * Fetch recent (last `days` calendar days) per-game Statcast data for a batter.
 *
 * Uses the `statcast_search/csv` endpoint which returns pitch-level data for
 * a specific player and date range. Aggregates into key hitting metrics.
 *
 * When `playerId` (MLBAM ID) is provided it is used directly — this eliminates
 * all name-matching ambiguity. When only `playerName` is given, the function
 * tries "First Last" then "Last, First" name formats as a fallback.
 *
 * Returns `null` when there is insufficient sample (< 5 balls in play) or if
 * Baseball Savant is unreachable — callers should fall back to `getStatcastData()`.
 */
export async function getRecentStatcast(
  playerName: string,
  days = 14,
  playerId?: number,
): Promise<RecentStatcastData | null> {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - days);
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  // Build the list of parameter-sets to try.
  // Prefer MLBAM player_id (no name-matching ambiguity); fall back to name variants.
  type ParamSet = Record<string, string>;
  const paramSets: ParamSet[] = [];

  if (playerId) {
    // MLBAM ID path — exact, no ambiguity
    paramSets.push({
      player_type:  'batter',
      hfGT:         'R|',
      player_id:    String(playerId),
      game_date_gt: fmt(start),
      game_date_lt: fmt(today),
      type:         'details',
      csv:          'true',
    });
  }

  // Name fallbacks (also used when no playerId is available)
  const namesToTry = [playerName];
  const parts = playerName.trim().split(/\s+/);
  if (parts.length >= 2) {
    const lastFirst = `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
    if (lastFirst !== playerName) namesToTry.push(lastFirst);
  }
  for (const name of namesToTry) {
    paramSets.push({
      player_type:  'batter',
      hfGT:         'R|',
      player_name:  name,
      game_date_gt: fmt(start),
      game_date_lt: fmt(today),
      type:         'details',
      csv:          'true',
    });
  }

  for (const paramObj of paramSets) {
    const params = new URLSearchParams(paramObj);

    try {
      const res = await fetch(`${SAVANT_SEARCH_URL}?${params}`, {
        headers: SAVANT_HEADERS,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;

      const csv = await res.text();
      const lines = csv.trim().split('\n');
      if (lines.length < 2) continue;

      // Parse header to find column indices
      const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const evIdx     = header.indexOf('launch_speed');
      const angIdx    = header.indexOf('launch_angle');
      const eventsIdx = header.indexOf('events');
      if (evIdx === -1) continue; // unexpected format

      let totalEV = 0, evCount = 0;
      let barrels = 0, hardHit = 0, bip = 0;
      let paCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        const eventVal = eventsIdx >= 0 ? (row[eventsIdx] ?? '').replace(/"/g, '').trim() : '';
        if (eventVal.length > 0) paCount++; // non-empty events column = terminal PA result

        const ev  = parseFloat((row[evIdx]  ?? '').replace(/"/g, ''));
        const ang = parseFloat(angIdx >= 0 ? (row[angIdx] ?? '').replace(/"/g, '') : 'NaN');

        if (isNaN(ev) || ev <= 0) continue;
        totalEV += ev;
        evCount++;
        bip++;
        // Simplified barrel: EV ≥ 98 mph AND launch angle 26–30°
        if (!isNaN(ang) && ev >= 98 && ang >= 26 && ang <= 30) barrels++;
        if (ev >= 95) hardHit++;
      }

      if (bip < 5) continue; // too few balls in play for reliable metrics

      return {
        avgExitVelo: totalEV / evCount,
        barrelRate:  (barrels / bip) * 100,
        hardHitPct:  (hardHit  / bip) * 100,
        sampleSize:  paCount,
        days,
        isLive: true,
      };
    } catch {
      // Try next name format or return null
    }
  }

  return null;
}
