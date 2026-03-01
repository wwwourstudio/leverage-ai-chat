/**
 * Baseball Savant Data Service
 *
 * Fetches, parses, and caches real 2025 Statcast metrics from Baseball Savant's
 * public Expected Statistics CSV endpoint (no API key required).
 *
 * Cache TTL: 4 hours — Baseball Savant updates daily; this balances freshness
 * with Vercel serverless warm-invocation reuse (same pattern as lib/adp-data.ts).
 *
 * Data source:
 *   https://baseballsavant.mlb.com/expected_statistics?type=batter&year=2025&min=10&csv=true
 *   https://baseballsavant.mlb.com/expected_statistics?type=pitcher&year=2025&min=10&csv=true
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
const SEASON = 2025;
const MIN_PA = 10; // minimum PA/BF to appear in leaderboard
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// ── Module-level cache ────────────────────────────────────────────────────────

let statcastCache: StatcastPlayer[] | null = null;
let lastFetched = 0;

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

/**
 * Parse a Baseball Savant Expected Statistics CSV export.
 * Column detection is dynamic so it survives minor format changes.
 */
function parseCSV(csv: string, playerType: 'batter' | 'pitcher'): StatcastPlayer[] {
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

  const idIdx         = colIdx(headers, ['player_id', 'mlbam_id']);
  const lastIdx       = colIdx(headers, ['last_name']);
  const firstIdx      = colIdx(headers, ['first_name']);
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
    // Handle quoted CSV fields (Baseball Savant sometimes quotes names with commas)
    const cols = lines[i].match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.replace(/"/g, '').trim()) ?? lines[i].split(',').map(c => c.trim());

    if (cols.length < 4) continue;

    const last  = lastIdx  !== -1 ? (cols[lastIdx]  ?? '') : '';
    const first = firstIdx !== -1 ? (cols[firstIdx] ?? '') : '';
    if (!last && !first) continue;

    const name = first && last ? `${first} ${last}` : last || first;

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

async function fetchStatcastType(playerType: 'batter' | 'pitcher'): Promise<StatcastPlayer[]> {
  const url = `${SAVANT_BASE}?type=${playerType}&year=${SEASON}&min=${MIN_PA}&csv=true`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'LeverageAI-App/1.0 (mlb-statcast-lookup)',
      'Accept': 'text/csv, text/plain, */*',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Baseball Savant fetch failed (${playerType}): HTTP ${res.status}`);
  }

  const csv = await res.text();
  return parseCSV(csv, playerType);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns cached Baseball Savant Statcast data (batters + pitchers merged),
 * refreshing when the cache is stale. Safe to call on every request.
 */
export async function getStatcastData(forceRefresh = false): Promise<StatcastPlayer[]> {
  const now = Date.now();
  const isStale = now - lastFetched > CACHE_TTL_MS;

  if (statcastCache && !isStale && !forceRefresh) {
    return statcastCache;
  }

  try {
    const [batters, pitchers] = await Promise.all([
      fetchStatcastType('batter'),
      fetchStatcastType('pitcher'),
    ]);
    const merged = [...batters, ...pitchers];
    statcastCache = merged;
    lastFetched = now;
    console.log(`[v0] [Statcast] Fetched ${batters.length} batters + ${pitchers.length} pitchers from Baseball Savant`);
    return merged;
  } catch (err) {
    console.error('[v0] [Statcast] Failed to fetch Baseball Savant data:', err);
    if (statcastCache) {
      console.warn('[v0] [Statcast] Returning stale cached data');
      return statcastCache;
    }
    return [];
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

  if (playerType) {
    results = results.filter(p => p.playerType === playerType);
  }

  if (player) {
    const needle = player.trim().toLowerCase();
    results = results.filter(p => p.name.toLowerCase().includes(needle));
  }

  // Default sort: xwOBA descending (best hitters first)
  results = results.slice().sort((a, b) => b.xwoba - a.xwoba);

  return results.slice(0, limit);
}
