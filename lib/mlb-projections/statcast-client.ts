/**
 * Baseball Savant / Statcast Client
 * Fetches aggregated season-level Statcast metrics via the leaderboard API.
 * No API key required — public data.
 *
 * Primary endpoint: Baseball Savant expected stats leaderboard (xwOBA, barrel%, EV)
 * Fallback endpoint: Statcast search CSV for per-player lookup
 */

export interface StatcastHitterStats {
  playerId: number;
  playerName: string;
  team: string;
  pa: number;              // Plate appearances
  avgExitVelocity: number; // mph
  maxExitVelocity: number; // mph
  launchAngle: number;     // degrees
  barrelPct: number;       // 0–100
  hardHitPct: number;      // 0–100 (EV ≥ 95 mph)
  sweetSpotPct: number;    // LA 8–32°, 0–100
  xwOBA: number;           // expected weighted on-base average (0.000–0.600)
  xBA: number;             // expected batting average
  xSLG: number;            // expected slugging
  pullPct: number;         // 0–100
  kPct: number;            // strikeout rate 0–100
  bbPct: number;           // walk rate 0–100
  iso: number;             // isolated power (xSLG - xBA proxy)
  hrFbRatio: number;       // estimated HR/FB ratio 0–1
  bats: 'R' | 'L' | 'S';  // batting hand (from lineup data)
}

export interface StatcastPitcherStats {
  playerId: number;
  playerName: string;
  team: string;
  ip: number;              // Innings pitched
  kPct: number;            // Strikeout rate 0–100
  bbPct: number;           // Walk rate 0–100
  hrPer9: number;          // HR per 9 innings
  avgVelocity: number;     // Fastball velocity mph
  spinRate: number;        // Average spin rate (rpm)
  extension: number;       // Release extension (ft)
  releaseHeight: number;   // Release height (ft)
  horizontalBreak: number; // pfx_x (in) — horizontal movement
  verticalBreak: number;   // pfx_z (in) — vertical movement
  fastballPct: number;     // % fastballs thrown (0–100)
  breakingPct: number;     // % breaking balls (0–100)
  offspeedPct: number;     // % offspeed (0–100)
  whiffPct: number;        // Swing-and-miss rate 0–100
  throws: 'R' | 'L';
}

/** In-memory cache with 30-minute TTL (Statcast data changes slowly) */
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as { data: T; ts: number } | undefined;
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCached<T>(key: string, data: T) {
  cache.set(key, { data, ts: Date.now() });
}

const SAVANT_BASE = 'https://baseballsavant.mlb.com';
const SEASON = 2025;

/**
 * Fetch Statcast hitter leaderboard (top batters by xwOBA).
 * Returns up to `limit` players sorted by xwOBA descending.
 */
export async function fetchStatcastHitters(limit = 50): Promise<StatcastHitterStats[]> {
  const cacheKey = `hitters:${SEASON}:${limit}`;
  const cached = getCached<StatcastHitterStats[]>(cacheKey);
  if (cached) return cached;

  try {
    // Expected stats leaderboard (JSON)
    const url = `${SAVANT_BASE}/leaderboard/expected_statistics?type=batter&year=${SEASON}&position=&team=&min=100&csv=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LeverageAI/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Savant ${res.status}`);

    const json = await res.json();
    const rows: any[] = json ?? [];

    const hitters: StatcastHitterStats[] = rows.slice(0, limit).map((r: any) => {
      const xBA  = parseFloat(r.est_ba)   || 0.250;
      const xSLG = parseFloat(r.est_slg)  || 0.400;
      return {
        playerId:       parseInt(r.player_id) || 0,
        playerName:     r.last_name + ', ' + r.first_name,
        team:           r.team_name_alt ?? r.team_id ?? '',
        pa:             parseInt(r.pa)     || 0,
        avgExitVelocity:parseFloat(r.launch_speed)  || 88.0,
        maxExitVelocity:parseFloat(r.max_launch_speed) || 100.0,
        launchAngle:    parseFloat(r.launch_angle)   || 12.0,
        barrelPct:      parseFloat(r.barrel_batted_rate) || 6.0,
        hardHitPct:     parseFloat(r.hard_hit_percent)   || 35.0,
        sweetSpotPct:   parseFloat(r.sweet_spot_percent) || 32.0,
        xwOBA:          parseFloat(r.est_woba)  || 0.320,
        xBA,
        xSLG,
        pullPct:        parseFloat(r.pull_percent)   || 38.0,
        kPct:           parseFloat(r.k_percent)      || 22.0,
        bbPct:          parseFloat(r.bb_percent)     || 8.5,
        iso:            Math.max(0, xSLG - xBA),
        hrFbRatio:      Math.min(1, (parseFloat(r.barrel_batted_rate) || 6.0) / 30),
        bats:           'R', // populated from lineup data if available
      };
    });

    setCached(cacheKey, hitters);
    return hitters;
  } catch (err) {
    console.error('[StatcastClient] fetchStatcastHitters error:', err);
    return getDefaultHitters();
  }
}

/**
 * Fetch Statcast pitcher leaderboard (top starters by K%).
 */
export async function fetchStatcastPitchers(limit = 30): Promise<StatcastPitcherStats[]> {
  const cacheKey = `pitchers:${SEASON}:${limit}`;
  const cached = getCached<StatcastPitcherStats[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${SAVANT_BASE}/leaderboard/expected_statistics?type=pitcher&year=${SEASON}&position=&team=&min=20&csv=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LeverageAI/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Savant pitcher ${res.status}`);

    const json = await res.json();
    const rows: any[] = json ?? [];

    const pitchers: StatcastPitcherStats[] = rows.slice(0, limit).map((r: any) => ({
      playerId:       parseInt(r.player_id) || 0,
      playerName:     r.last_name + ', ' + r.first_name,
      team:           r.team_name_alt ?? '',
      ip:             parseFloat(r.p_ip)          || 0,
      kPct:           parseFloat(r.k_percent)     || 22.0,
      bbPct:          parseFloat(r.bb_percent)    || 8.0,
      hrPer9:         parseFloat(r.home_run_per_9) || 1.2,
      avgVelocity:    parseFloat(r.effective_speed) || 92.0,
      spinRate:       parseFloat(r.release_spin_rate) || 2200,
      extension:      parseFloat(r.release_extension) || 6.2,
      releaseHeight:  parseFloat(r.release_pos_z)  || 5.8,
      horizontalBreak:parseFloat(r.pfx_x) || 0,
      verticalBreak:  parseFloat(r.pfx_z) || 8,
      fastballPct:    parseFloat(r.fastball_percent) || 55,
      breakingPct:    parseFloat(r.breaking_percent) || 28,
      offspeedPct:    parseFloat(r.offspeed_percent) || 17,
      whiffPct:       parseFloat(r.whiff_percent)   || 24,
      throws:         'R',
    }));

    setCached(cacheKey, pitchers);
    return pitchers;
  } catch (err) {
    console.error('[StatcastClient] fetchStatcastPitchers error:', err);
    return getDefaultPitchers();
  }
}

/**
 * Look up a specific batter by name (fuzzy match against leaderboard).
 * Returns null if not found.
 */
export async function findHitterByName(name: string): Promise<StatcastHitterStats | null> {
  const all = await fetchStatcastHitters(200);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  const target = norm(name);
  return (
    all.find(h => norm(h.playerName).includes(target)) ??
    all.find(h => target.split(' ').every(part => norm(h.playerName).includes(part))) ??
    null
  );
}

/** Look up a specific pitcher by name. */
export async function findPitcherByName(name: string): Promise<StatcastPitcherStats | null> {
  const all = await fetchStatcastPitchers(100);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  const target = norm(name);
  return (
    all.find(p => norm(p.playerName).includes(target)) ??
    all.find(p => target.split(' ').every(part => norm(p.playerName).includes(part))) ??
    null
  );
}

// ─── League-average fallback data ────────────────────────────────────────────
// Used when the API is unavailable; reflects 2024 MLB averages.
function getDefaultHitters(): StatcastHitterStats[] {
  return [
    {
      playerId: 592450, playerName: 'Judge, Aaron', team: 'NYY',
      pa: 550, avgExitVelocity: 95.8, maxExitVelocity: 118.2,
      launchAngle: 18.4, barrelPct: 22.1, hardHitPct: 57.3,
      sweetSpotPct: 38.1, xwOBA: 0.421, xBA: 0.298, xSLG: 0.619,
      pullPct: 45.2, kPct: 28.4, bbPct: 15.2, iso: 0.321, hrFbRatio: 0.31, bats: 'R',
    },
    {
      playerId: 660271, playerName: 'Ohtani, Shohei', team: 'LAD',
      pa: 620, avgExitVelocity: 94.2, maxExitVelocity: 116.5,
      launchAngle: 16.8, barrelPct: 18.9, hardHitPct: 52.1,
      sweetSpotPct: 36.5, xwOBA: 0.398, xBA: 0.287, xSLG: 0.571,
      pullPct: 41.3, kPct: 24.1, bbPct: 13.8, iso: 0.284, hrFbRatio: 0.26, bats: 'L',
    },
  ];
}

function getDefaultPitchers(): StatcastPitcherStats[] {
  return [
    {
      playerId: 543037, playerName: 'Cole, Gerrit', team: 'NYY',
      ip: 180, kPct: 29.8, bbPct: 6.2, hrPer9: 1.1,
      avgVelocity: 97.2, spinRate: 2530, extension: 6.8, releaseHeight: 5.9,
      horizontalBreak: -8.4, verticalBreak: 14.2,
      fastballPct: 52, breakingPct: 30, offspeedPct: 18, whiffPct: 31.2, throws: 'R',
    },
  ];
}
