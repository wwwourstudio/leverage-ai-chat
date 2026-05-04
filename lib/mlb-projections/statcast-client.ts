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

/**
 * L1: in-process cache for within-request reuse (lost on cold start — that's OK,
 *     its only purpose is to avoid duplicate fetches within the same invocation).
 * L2: Supabase `statcast_leaderboard_cache` table for cross-invocation persistence
 *     (6-hour TTL). This is the fix for Vercel serverless cold-start cache misses.
 */
const memCache = new Map<string, { data: unknown; ts: number }>();
const MEM_TTL  = 5 * 60 * 1000; // 5 min — reuse within the same warm instance

function getMemCached<T>(key: string): T | null {
  const entry = memCache.get(key) as { data: T; ts: number } | undefined;
  if (entry && Date.now() - entry.ts < MEM_TTL) return entry.data;
  return null;
}
function setMemCached<T>(key: string, data: T) {
  memCache.set(key, { data, ts: Date.now() });
}

// Keep old names as aliases so existing callers (if any) don't break
const getCached  = getMemCached;
const setCached  = setMemCached;

function getSupabaseCache() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const { createClient } = require('@supabase/supabase-js');
    return createClient(url, key, { db: { schema: 'api' } }) as import('@supabase/supabase-js').SupabaseClient;
  } catch { return null; }
}

async function getLeaderboardFromDB<T>(key: string): Promise<T | null> {
  try {
    const sb = getSupabaseCache();
    if (!sb) return null;
    const { data, error } = await sb
      .from('statcast_leaderboard_cache')
      .select('payload')
      .eq('cache_key', key)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data?.payload) return null;
    return JSON.parse(data.payload) as T;
  } catch { return null; }
}

async function saveLeaderboardToDB<T>(key: string, value: T): Promise<void> {
  try {
    const sb = getSupabaseCache();
    if (!sb) return;
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    await sb.from('statcast_leaderboard_cache').upsert({
      cache_key:  key,
      payload:    JSON.stringify(value),
      cached_at:  new Date().toISOString(),
      expires_at: expiresAt,
    });
  } catch { /* non-critical — projection pipeline continues without it */ }
}

const SAVANT_BASE = 'https://baseballsavant.mlb.com';
// Use last complete MLB season (season runs Apr–Oct; before April the prior year is most recent).
const now = new Date();
const SEASON = now.getMonth() < 3 /* Jan–Mar */ ? now.getFullYear() - 1 : now.getFullYear();

/**
 * Fetch Statcast hitter leaderboard (top batters by xwOBA).
 * Returns up to `limit` players sorted by xwOBA descending.
 */
export async function fetchStatcastHitters(limit = 50): Promise<StatcastHitterStats[]> {
  const cacheKey = `hitters:${SEASON}:${limit}`;

  // L1: in-process memory cache
  const memHit = getCached<StatcastHitterStats[]>(cacheKey);
  if (memHit) return memHit;

  // L2: Supabase persistent cache (survives Vercel cold starts)
  const dbHit = await getLeaderboardFromDB<StatcastHitterStats[]>(cacheKey);
  if (dbHit?.length) { setCached(cacheKey, dbHit); return dbHit; }

  try {
    // Expected stats leaderboard (JSON)
    const url = `${SAVANT_BASE}/leaderboard/expected_statistics?type=batter&year=${SEASON}&position=&team=&min=100&csv=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LeverageAI/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Savant ${res.status}`);

    // Use text() first — Baseball Savant sometimes wraps the array in an object
    // or appends trailing content that breaks res.json() at parse time.
    const rawText = await res.text();
    let rows: any[] = [];
    try {
      const parsed = JSON.parse(rawText.trim());
      if (Array.isArray(parsed)) {
        rows = parsed;
      } else if (parsed && typeof parsed === 'object') {
        // Wrapped response like {"stats": [...]} — find the first array value
        const found = Object.values(parsed as Record<string, unknown>).find(v => Array.isArray(v));
        rows = (found as any[]) ?? [];
      }
    } catch {
      // Try extracting the first JSON array literal from the response text
      const match = rawText.match(/\[[\s\S]+\]/);
      if (match) {
        try { rows = JSON.parse(match[0]); } catch { /* fall through to defaults */ }
      }
    }

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
    void saveLeaderboardToDB(cacheKey, hitters); // fire-and-forget — never blocks response
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

  const memHit = getCached<StatcastPitcherStats[]>(cacheKey);
  if (memHit) return memHit;

  const dbHit = await getLeaderboardFromDB<StatcastPitcherStats[]>(cacheKey);
  if (dbHit?.length) { setCached(cacheKey, dbHit); return dbHit; }

  try {
    const url = `${SAVANT_BASE}/leaderboard/expected_statistics?type=pitcher&year=${SEASON}&position=&team=&min=20&csv=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LeverageAI/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Savant pitcher ${res.status}`);

    const rawText = await res.text();
    let rows: any[] = [];
    try {
      const parsed = JSON.parse(rawText.trim());
      if (Array.isArray(parsed)) {
        rows = parsed;
      } else if (parsed && typeof parsed === 'object') {
        const found = Object.values(parsed as Record<string, unknown>).find(v => Array.isArray(v));
        rows = (found as any[]) ?? [];
      }
    } catch {
      const match = rawText.match(/\[[\s\S]+\]/);
      if (match) {
        try { rows = JSON.parse(match[0]); } catch { /* fall through to defaults */ }
      }
    }

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
    void saveLeaderboardToDB(cacheKey, pitchers);
    return pitchers;
  } catch (err) {
    console.error('[StatcastClient] fetchStatcastPitchers error:', err);
    return getDefaultPitchers();
  }
}

/**
 * Look up a specific batter by name (fuzzy match against leaderboard).
 * Merges season-level Baseball Savant data with recent pitch-level DB data.
 * Returns null if not found in either source.
 */
export async function findHitterByName(name: string): Promise<StatcastHitterStats | null> {
  const [all, dbData] = await Promise.all([
    fetchStatcastHitters(200),
    findHitterInDB(name).catch(() => null),
  ]);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  const target = norm(name);
  const seasonRow = (
    all.find(h => norm(h.playerName).includes(target)) ??
    all.find(h => target.split(' ').every(part => norm(h.playerName).includes(part))) ??
    null
  );
  if (!seasonRow) return null;
  // Overlay recent DB metrics (last 30 days) onto season-level data when available
  if (dbData) {
    if (dbData.avgExitVelocity) seasonRow.avgExitVelocity = dbData.avgExitVelocity;
    if (dbData.barrelPct)       seasonRow.barrelPct       = dbData.barrelPct;
    if (dbData.hardHitPct)      seasonRow.hardHitPct      = dbData.hardHitPct;
    if (dbData.sweetSpotPct)    seasonRow.sweetSpotPct    = dbData.sweetSpotPct;
    if (dbData.launchAngle)     seasonRow.launchAngle      = dbData.launchAngle;
  }
  return seasonRow;
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

/**
 * Pull recent pitch-level aggregates for a hitter from the Supabase statcast_events DB.
 * Returns null if the table is empty or the player has no recent data.
 * Used to enrich season-level Baseball Savant data with recency-weighted metrics.
 */
export async function findHitterInDB(name: string): Promise<Partial<StatcastHitterStats> | null> {
  try {
    const { getPlayerAggregate } = await import('@/lib/statcastQuery');
    const agg = await getPlayerAggregate(name, 'batter', 30);
    if (!agg || agg.sampleBIP < 10) return null;
    return {
      playerName: agg.playerName,
      avgExitVelocity: agg.avgExitVelo ?? undefined,
      barrelPct:       agg.barrelRate  ?? undefined,
      hardHitPct:      agg.hardHitRate ?? undefined,
      sweetSpotPct:    agg.sweetSpotRate ?? undefined,
      launchAngle:     agg.avgLaunchAngle ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Pull recent pitch-level aggregates for a pitcher from the Supabase statcast_events DB.
 */
export async function findPitcherInDB(name: string): Promise<Partial<StatcastPitcherStats> | null> {
  try {
    const { getPlayerAggregate } = await import('@/lib/statcastQuery');
    const agg = await getPlayerAggregate(name, 'pitcher', 30);
    if (!agg || agg.samplePitches < 20) return null;
    return {
      playerName:  agg.playerName,
      avgVelocity: agg.avgReleaseSpeed ?? undefined,
      spinRate:    agg.avgSpinRate     ?? undefined,
    };
  } catch {
    return null;
  }
}

// ─── League-average fallback data ────────────────────────────────────────────
// Used when the API is unavailable; reflects 2024 MLB averages.
// 2025 season elite hitters — all DK positions covered (C/1B/2B/3B/SS/OF).
// Used when Baseball Savant API is unavailable; reflects career/recent averages.
function getDefaultHitters(): StatcastHitterStats[] {
  return [
    // OF
    { playerId: 592450, playerName: 'Judge, Aaron',       team: 'NYY', pa: 550, avgExitVelocity: 95.8, maxExitVelocity: 118.2, launchAngle: 18.4, barrelPct: 22.1, hardHitPct: 57.3, sweetSpotPct: 38.1, xwOBA: 0.421, xBA: 0.298, xSLG: 0.619, pullPct: 45.2, kPct: 28.4, bbPct: 15.2, iso: 0.321, hrFbRatio: 0.31, bats: 'R' },
    { playerId: 660271, playerName: 'Ohtani, Shohei',     team: 'LAD', pa: 620, avgExitVelocity: 94.2, maxExitVelocity: 116.5, launchAngle: 16.8, barrelPct: 18.9, hardHitPct: 52.1, sweetSpotPct: 36.5, xwOBA: 0.398, xBA: 0.287, xSLG: 0.571, pullPct: 41.3, kPct: 24.1, bbPct: 13.8, iso: 0.284, hrFbRatio: 0.26, bats: 'L' },
    { playerId: 660670, playerName: 'Acuna Jr., Ronald',   team: 'ATL', pa: 540, avgExitVelocity: 91.8, maxExitVelocity: 112.3, launchAngle: 13.2, barrelPct: 13.4, hardHitPct: 48.6, sweetSpotPct: 35.2, xwOBA: 0.382, xBA: 0.278, xSLG: 0.502, pullPct: 38.1, kPct: 22.8, bbPct: 11.5, iso: 0.224, hrFbRatio: 0.19, bats: 'R' },
    { playerId: 670541, playerName: 'Alvarez, Yordan',     team: 'HOU', pa: 510, avgExitVelocity: 93.4, maxExitVelocity: 115.8, launchAngle: 17.2, barrelPct: 19.2, hardHitPct: 53.4, sweetSpotPct: 37.8, xwOBA: 0.412, xBA: 0.292, xSLG: 0.592, pullPct: 42.7, kPct: 20.1, bbPct: 14.3, iso: 0.300, hrFbRatio: 0.28, bats: 'L' },
    { playerId: 665742, playerName: 'Soto, Juan',          team: 'NYM', pa: 580, avgExitVelocity: 90.1, maxExitVelocity: 111.4, launchAngle: 15.6, barrelPct: 12.8, hardHitPct: 46.2, sweetSpotPct: 40.1, xwOBA: 0.406, xBA: 0.289, xSLG: 0.518, pullPct: 36.4, kPct: 16.2, bbPct: 18.7, iso: 0.229, hrFbRatio: 0.20, bats: 'L' },
    // 1B
    { playerId: 518692, playerName: 'Freeman, Freddie',    team: 'LAD', pa: 590, avgExitVelocity: 91.2, maxExitVelocity: 113.6, launchAngle: 14.8, barrelPct: 12.1, hardHitPct: 46.8, sweetSpotPct: 41.2, xwOBA: 0.388, xBA: 0.288, xSLG: 0.498, pullPct: 37.5, kPct: 14.4, bbPct: 12.1, iso: 0.210, hrFbRatio: 0.18, bats: 'L' },
    { playerId: 624413, playerName: 'Alonso, Pete',        team: 'NYM', pa: 560, avgExitVelocity: 92.4, maxExitVelocity: 114.1, launchAngle: 16.4, barrelPct: 16.2, hardHitPct: 49.3, sweetSpotPct: 34.8, xwOBA: 0.372, xBA: 0.256, xSLG: 0.519, pullPct: 44.1, kPct: 24.8, bbPct: 11.2, iso: 0.263, hrFbRatio: 0.24, bats: 'R' },
    // 2B
    { playerId: 514888, playerName: 'Altuve, Jose',        team: 'HOU', pa: 520, avgExitVelocity: 88.2, maxExitVelocity: 108.4, launchAngle: 10.8, barrelPct: 8.4, hardHitPct: 39.2, sweetSpotPct: 38.6, xwOBA: 0.348, xBA: 0.272, xSLG: 0.432, pullPct: 35.4, kPct: 13.8, bbPct: 8.6, iso: 0.160, hrFbRatio: 0.13, bats: 'R' },
    { playerId: 663538, playerName: 'Hoerner, Nico',       team: 'CHC', pa: 480, avgExitVelocity: 86.4, maxExitVelocity: 105.2, launchAngle:  8.2, barrelPct: 5.6, hardHitPct: 34.1, sweetSpotPct: 36.4, xwOBA: 0.326, xBA: 0.264, xSLG: 0.392, pullPct: 32.8, kPct: 11.4, bbPct: 7.8, iso: 0.128, hrFbRatio: 0.09, bats: 'R' },
    // 3B
    { playerId: 608070, playerName: 'Ramirez, Jose',       team: 'CLE', pa: 570, avgExitVelocity: 91.6, maxExitVelocity: 112.8, launchAngle: 14.2, barrelPct: 13.8, hardHitPct: 47.4, sweetSpotPct: 37.1, xwOBA: 0.386, xBA: 0.274, xSLG: 0.512, pullPct: 40.2, kPct: 12.4, bbPct: 10.8, iso: 0.238, hrFbRatio: 0.21, bats: 'S' },
    { playerId: 663586, playerName: 'Riley, Austin',       team: 'ATL', pa: 540, avgExitVelocity: 93.1, maxExitVelocity: 114.6, launchAngle: 17.8, barrelPct: 17.4, hardHitPct: 51.2, sweetSpotPct: 35.6, xwOBA: 0.378, xBA: 0.268, xSLG: 0.534, pullPct: 43.5, kPct: 22.6, bbPct: 8.4, iso: 0.266, hrFbRatio: 0.25, bats: 'R' },
    { playerId: 592518, playerName: 'Machado, Manny',      team: 'SD',  pa: 530, avgExitVelocity: 91.0, maxExitVelocity: 112.0, launchAngle: 13.6, barrelPct: 12.4, hardHitPct: 46.1, sweetSpotPct: 36.8, xwOBA: 0.368, xBA: 0.268, xSLG: 0.480, pullPct: 39.8, kPct: 15.2, bbPct: 10.6, iso: 0.212, hrFbRatio: 0.18, bats: 'R' },
    // SS
    { playerId: 607208, playerName: 'Turner, Trea',        team: 'PHI', pa: 560, avgExitVelocity: 89.8, maxExitVelocity: 110.6, launchAngle: 11.8, barrelPct: 10.2, hardHitPct: 43.8, sweetSpotPct: 35.4, xwOBA: 0.364, xBA: 0.284, xSLG: 0.474, pullPct: 41.6, kPct: 18.4, bbPct: 7.6, iso: 0.190, hrFbRatio: 0.16, bats: 'R' },
    { playerId: 596019, playerName: 'Lindor, Francisco',   team: 'NYM', pa: 570, avgExitVelocity: 89.2, maxExitVelocity: 109.8, launchAngle: 12.4, barrelPct: 9.8, hardHitPct: 41.6, sweetSpotPct: 34.8, xwOBA: 0.352, xBA: 0.268, xSLG: 0.462, pullPct: 38.2, kPct: 17.6, bbPct: 9.2, iso: 0.194, hrFbRatio: 0.16, bats: 'S' },
    { playerId: 608369, playerName: 'Seager, Corey',       team: 'TEX', pa: 540, avgExitVelocity: 91.4, maxExitVelocity: 113.2, launchAngle: 16.2, barrelPct: 14.6, hardHitPct: 48.4, sweetSpotPct: 36.2, xwOBA: 0.382, xBA: 0.276, xSLG: 0.514, pullPct: 42.4, kPct: 20.8, bbPct: 9.8, iso: 0.238, hrFbRatio: 0.22, bats: 'L' },
    // C
    { playerId: 668939, playerName: 'Rutschman, Adley',    team: 'BAL', pa: 510, avgExitVelocity: 89.6, maxExitVelocity: 110.4, launchAngle: 14.4, barrelPct: 10.8, hardHitPct: 43.2, sweetSpotPct: 37.4, xwOBA: 0.362, xBA: 0.268, xSLG: 0.454, pullPct: 36.8, kPct: 16.4, bbPct: 12.4, iso: 0.186, hrFbRatio: 0.15, bats: 'S' },
    { playerId: 669257, playerName: 'Smith, Will',          team: 'LAD', pa: 480, avgExitVelocity: 89.0, maxExitVelocity: 109.6, launchAngle: 15.8, barrelPct: 11.6, hardHitPct: 44.8, sweetSpotPct: 36.1, xwOBA: 0.358, xBA: 0.260, xSLG: 0.458, pullPct: 38.4, kPct: 18.6, bbPct: 11.8, iso: 0.198, hrFbRatio: 0.17, bats: 'R' },
    // Additional OF depth
    { playerId: 671739, playerName: 'Tucker, Kyle',        team: 'HOU', pa: 530, avgExitVelocity: 90.8, maxExitVelocity: 112.1, launchAngle: 14.6, barrelPct: 13.2, hardHitPct: 46.4, sweetSpotPct: 38.2, xwOBA: 0.376, xBA: 0.274, xSLG: 0.492, pullPct: 39.6, kPct: 20.2, bbPct: 10.4, iso: 0.218, hrFbRatio: 0.19, bats: 'L' },
    { playerId: 676801, playerName: 'De La Cruz, Elly',    team: 'CIN', pa: 520, avgExitVelocity: 91.2, maxExitVelocity: 113.4, launchAngle: 12.8, barrelPct: 11.8, hardHitPct: 45.6, sweetSpotPct: 33.8, xwOBA: 0.354, xBA: 0.262, xSLG: 0.476, pullPct: 40.4, kPct: 28.6, bbPct: 8.2, iso: 0.214, hrFbRatio: 0.18, bats: 'S' },
    { playerId: 682998, playerName: 'Jackson, Jarren',     team: 'MIL', pa: 460, avgExitVelocity: 90.4, maxExitVelocity: 111.2, launchAngle: 13.4, barrelPct: 12.2, hardHitPct: 44.8, sweetSpotPct: 34.6, xwOBA: 0.348, xBA: 0.258, xSLG: 0.468, pullPct: 42.1, kPct: 26.4, bbPct: 9.4, iso: 0.210, hrFbRatio: 0.18, bats: 'R' },
    { playerId: 645302, playerName: 'Betts, Mookie',       team: 'LAD', pa: 510, avgExitVelocity: 90.6, maxExitVelocity: 111.8, launchAngle: 13.8, barrelPct: 12.6, hardHitPct: 45.2, sweetSpotPct: 38.8, xwOBA: 0.376, xBA: 0.278, xSLG: 0.488, pullPct: 41.2, kPct: 17.2, bbPct: 11.4, iso: 0.210, hrFbRatio: 0.18, bats: 'R' },
  ];
}

// 2025 season elite starters — reflects recent performance averages.
// Used when Baseball Savant API is unavailable.
function getDefaultPitchers(): StatcastPitcherStats[] {
  return [
    { playerId: 543037, playerName: 'Cole, Gerrit',     team: 'NYY', ip: 180, kPct: 29.8, bbPct: 6.2, hrPer9: 1.1, avgVelocity: 97.2, spinRate: 2530, extension: 6.8, releaseHeight: 5.9, horizontalBreak: -8.4, verticalBreak: 14.2, fastballPct: 52, breakingPct: 30, offspeedPct: 18, whiffPct: 31.2, throws: 'R' },
    { playerId: 675911, playerName: 'Strider, Spencer', team: 'ATL', ip: 162, kPct: 36.4, bbPct: 6.8, hrPer9: 0.8, avgVelocity: 96.4, spinRate: 2480, extension: 6.6, releaseHeight: 5.8, horizontalBreak: -7.8, verticalBreak: 13.6, fastballPct: 55, breakingPct: 32, offspeedPct: 13, whiffPct: 34.8, throws: 'R' },
    { playerId: 554430, playerName: 'Wheeler, Zack',    team: 'PHI', ip: 192, kPct: 28.6, bbPct: 5.8, hrPer9: 1.0, avgVelocity: 97.8, spinRate: 2560, extension: 7.0, releaseHeight: 6.1, horizontalBreak: -9.2, verticalBreak: 15.1, fastballPct: 54, breakingPct: 28, offspeedPct: 18, whiffPct: 29.8, throws: 'R' },
    { playerId: 669203, playerName: 'Burnes, Corbin',   team: 'BAL', ip: 196, kPct: 30.2, bbPct: 5.4, hrPer9: 0.7, avgVelocity: 95.8, spinRate: 2640, extension: 6.5, releaseHeight: 5.7, horizontalBreak: -6.4, verticalBreak: 12.8, fastballPct: 46, breakingPct: 36, offspeedPct: 18, whiffPct: 32.4, throws: 'R' },
    { playerId: 622491, playerName: 'Castillo, Luis',   team: 'SEA', ip: 186, kPct: 27.4, bbPct: 7.2, hrPer9: 0.6, avgVelocity: 96.6, spinRate: 2490, extension: 6.9, releaseHeight: 5.6, horizontalBreak: -8.8, verticalBreak: 13.4, fastballPct: 50, breakingPct: 28, offspeedPct: 22, whiffPct: 28.6, throws: 'R' },
    { playerId: 592332, playerName: 'Gausman, Kevin',   team: 'TOR', ip: 174, kPct: 26.8, bbPct: 6.4, hrPer9: 1.2, avgVelocity: 93.4, spinRate: 2380, extension: 6.4, releaseHeight: 5.5, horizontalBreak:  4.2, verticalBreak: 11.6, fastballPct: 44, breakingPct: 26, offspeedPct: 30, whiffPct: 27.4, throws: 'R' },
    { playerId: 656302, playerName: 'Cease, Dylan',     team: 'SD',  ip: 170, kPct: 31.6, bbPct: 9.2, hrPer9: 0.9, avgVelocity: 96.2, spinRate: 2510, extension: 6.7, releaseHeight: 5.8, horizontalBreak: -8.1, verticalBreak: 13.8, fastballPct: 48, breakingPct: 34, offspeedPct: 18, whiffPct: 33.2, throws: 'R' },
    { playerId: 641482, playerName: 'Cortes, Nestor',   team: 'NYY', ip: 156, kPct: 24.8, bbPct: 6.6, hrPer9: 0.9, avgVelocity: 90.8, spinRate: 2420, extension: 6.3, releaseHeight: 5.4, horizontalBreak:  6.2, verticalBreak: 10.4, fastballPct: 40, breakingPct: 32, offspeedPct: 28, whiffPct: 26.8, throws: 'L' },
    { playerId: 605483, playerName: 'Snell, Blake',     team: 'LAD', ip: 148, kPct: 33.4, bbPct: 11.8, hrPer9: 0.8, avgVelocity: 94.6, spinRate: 2460, extension: 6.2, releaseHeight: 5.6, horizontalBreak: -7.4, verticalBreak: 12.2, fastballPct: 42, breakingPct: 38, offspeedPct: 20, whiffPct: 35.6, throws: 'L' },
    { playerId: 621111, playerName: 'Fried, Max',       team: 'NYY', ip: 178, kPct: 24.6, bbPct: 6.8, hrPer9: 0.7, avgVelocity: 93.2, spinRate: 2350, extension: 6.4, releaseHeight: 5.5, horizontalBreak:  5.8, verticalBreak: 11.2, fastballPct: 38, breakingPct: 36, offspeedPct: 26, whiffPct: 25.8, throws: 'L' },
    { playerId: 668678, playerName: 'Skubal, Tarik',    team: 'DET', ip: 192, kPct: 29.4, bbPct: 5.6, hrPer9: 0.6, avgVelocity: 94.8, spinRate: 2510, extension: 6.6, releaseHeight: 5.7, horizontalBreak: -7.2, verticalBreak: 13.0, fastballPct: 50, breakingPct: 30, offspeedPct: 20, whiffPct: 30.6, throws: 'L' },
    { playerId: 663158, playerName: 'Ryan, Joe',        team: 'MIN', ip: 168, kPct: 27.8, bbPct: 5.4, hrPer9: 1.1, avgVelocity: 95.6, spinRate: 2480, extension: 6.5, releaseHeight: 5.8, horizontalBreak: -8.6, verticalBreak: 14.4, fastballPct: 52, breakingPct: 28, offspeedPct: 20, whiffPct: 29.2, throws: 'R' },
  ];
}
