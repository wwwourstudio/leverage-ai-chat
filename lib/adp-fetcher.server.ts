/**
 * ADP live data fetchers — server-only.
 *
 * Provides FantasyPros CSV (with optional account login) and ESPN JSON scrapers
 * for MLB and NFL ADP. Both the on-demand path in adp-data.ts and the cron
 * refresh route import from here so scraper logic lives in one place.
 *
 * FantasyPros auth (optional):
 *   Set FANTASYPROS_EMAIL and FANTASYPROS_PASSWORD in your Vercel env vars.
 *   When present, the scraper logs in first to obtain a session cookie, which
 *   unlocks the full CSV export (more players, more scoring formats).
 *   When absent, an unauthenticated request is attempted.
 *
 * Source priority: FantasyPros CSV → ESPN JSON → (caller handles static)
 */

import { parseTSV, type NFBCPlayer } from '@/lib/adp-data';

// ── FantasyPros ────────────────────────────────────────────────────────────────

const FP_BASE  = 'https://www.fantasypros.com';
const FP_LOGIN = `${FP_BASE}/accounts/login/`;

const FP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const FP_URLS: Record<'mlb' | 'nfl', string> = {
  mlb: `${FP_BASE}/mlb/adp/overall.php?export=csv`,
  nfl: `${FP_BASE}/nfl/adp/half-point-ppr-overall.php?export=csv`,
};

/** Parse Set-Cookie headers and return a cookie jar string. */
function extractCookies(headers: Headers): string {
  // Node fetch exposes multiple Set-Cookie values via getSetCookie() or raw headers
  const cookies: string[] = [];
  // getSetCookie is available in Node 18+ / undici
  if (typeof (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function') {
    cookies.push(
      ...(headers as unknown as { getSetCookie: () => string[] })
        .getSetCookie()
        .map(c => c.split(';')[0].trim()),
    );
  } else {
    // Fallback: iterate raw header entries
    headers.forEach((value, name) => {
      if (name.toLowerCase() === 'set-cookie') {
        cookies.push(value.split(';')[0].trim());
      }
    });
  }
  return cookies.join('; ');
}

/**
 * Log in to FantasyPros and return a cookie string with the session.
 * FantasyPros uses Django: fetch a CSRF token first, then POST credentials.
 */
async function loginToFantasyPros(email: string, password: string): Promise<string> {
  // Step 1 — GET login page to receive csrftoken cookie
  // Use a full browser-like header set to avoid bot-detection pages that omit the CSRF form
  const loginPageRes = await fetch(FP_LOGIN, {
    headers: {
      'User-Agent':      FP_UA,
      Accept:            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control':   'no-cache',
      Pragma:            'no-cache',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  });
  if (!loginPageRes.ok) {
    throw new Error(`FantasyPros login page returned HTTP ${loginPageRes.status}`);
  }

  const cookieJar1 = extractCookies(loginPageRes.headers);
  const pageHtml   = await loginPageRes.text();

  // CSRF token may live in the cookie, an HTML form input, or a <meta> tag
  let csrfToken: string | undefined;
  const cookieCsrf = cookieJar1.match(/csrftoken=([^;]+)/);
  if (cookieCsrf) {
    csrfToken = cookieCsrf[1];
  } else {
    const htmlCsrf =
      pageHtml.match(/name=["']csrfmiddlewaretoken["'][^>]*value=["']([^"']+)["']/) ??
      pageHtml.match(/value=["']([^"']+)["'][^>]*name=["']csrfmiddlewaretoken["']/) ??
      pageHtml.match(/<meta[^>]+name=["']csrf-?token["'][^>]*content=["']([^"']+)["']/i);
    if (htmlCsrf) csrfToken = htmlCsrf[1];
  }

  if (!csrfToken) {
    throw new Error('FantasyPros login: could not find CSRF token in login page (possible bot-detection block)');
  }

  // Step 2 — POST credentials
  const body = new URLSearchParams({
    username: email,
    password,
    csrfmiddlewaretoken: csrfToken,
  });

  const loginRes = await fetch(FP_LOGIN, {
    method: 'POST',
    headers: {
      'User-Agent':     FP_UA,
      'Content-Type':  'application/x-www-form-urlencoded',
      Referer:          FP_LOGIN,
      Cookie:           cookieJar1,
      'X-CSRFToken':    csrfToken,
    },
    body: body.toString(),
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  });

  const cookieJar2 = extractCookies(loginRes.headers);
  const merged = mergeCookies(cookieJar1, cookieJar2);

  if (!merged.includes('sessionid=')) {
    throw new Error('FantasyPros login: no sessionid cookie in response — check credentials');
  }

  console.log('[v0] [ADP/fetcher] FantasyPros login successful');
  return merged;
}

/** Merge two cookie jar strings, letting jar2 override jar1 for matching names. */
function mergeCookies(jar1: string, jar2: string): string {
  const map = new Map<string, string>();
  for (const c of [...jar1.split('; '), ...jar2.split('; ')]) {
    const eq = c.indexOf('=');
    if (eq > 0) map.set(c.slice(0, eq), c);
  }
  return [...map.values()].join('; ');
}

/** Cached session cookie — reused across serverless warm invocations. */
let fpSessionCookie: string | null = null;
let fpSessionFetchedAt = 0;
const FP_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function getFantasyProsCookie(): Promise<string | null> {
  const email    = process.env.FANTASYPROS_EMAIL;
  const password = process.env.FANTASYPROS_PASSWORD;
  if (!email || !password) return null; // no creds configured — anonymous attempt

  const now = Date.now();
  if (fpSessionCookie && now - fpSessionFetchedAt < FP_SESSION_TTL_MS) {
    return fpSessionCookie;
  }

  fpSessionCookie    = await loginToFantasyPros(email, password);
  fpSessionFetchedAt = now;
  return fpSessionCookie;
}

export async function scrapeFantasyPros(sport: 'mlb' | 'nfl'): Promise<NFBCPlayer[]> {
  const url     = FP_URLS[sport];
  let cookieJar = '';

  try {
    const session = await getFantasyProsCookie();
    if (session) cookieJar = session;
  } catch (err) {
    // Login failed — fall through to anonymous attempt, log the reason
    console.warn('[v0] [ADP/fetcher] FantasyPros login failed, trying anonymously:', err instanceof Error ? err.message : err);
    fpSessionCookie    = null;
    fpSessionFetchedAt = 0;
  }

  const headers: Record<string, string> = {
    'User-Agent':      FP_UA,
    Accept:            'text/csv,text/plain,*/*',
    Referer:           `${FP_BASE}/`,
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (cookieJar) headers['Cookie'] = cookieJar;

  const res = await fetch(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) throw new Error(`FantasyPros ${sport.toUpperCase()} HTTP ${res.status}`);

  const text = await res.text();

  if (text.trimStart().startsWith('<')) {
    // Session may have expired — clear cache so next call re-logs in
    fpSessionCookie    = null;
    fpSessionFetchedAt = 0;
    throw new Error(`FantasyPros ${sport.toUpperCase()} returned HTML (login wall)`);
  }

  const players = parseTSV(text);
  if (players.length < 50) {
    throw new Error(`FantasyPros ${sport.toUpperCase()}: only ${players.length} players parsed`);
  }

  // FantasyPros uses "/" as position separator ("SP/DH") — normalise to ","
  return players.map(p => ({ ...p, positions: p.positions.replace(/\//g, ',') }));
}

// ── ESPN ───────────────────────────────────────────────────────────────────────

const ESPN_MLB_POS: Record<number, string> = {
  1: 'SP', 2: 'RP', 3: 'C', 4: '1B', 5: '2B',
  6: '3B', 7: 'SS', 8: 'OF', 9: 'OF', 10: 'OF', 11: 'DH',
};

const ESPN_NFL_POS: Record<number, string> = {
  1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST',
};

const ESPN_MLB_TEAMS: Record<number, string> = {
  1: 'BAL', 2: 'BOS', 3: 'LAA', 4: 'CWS', 5: 'CLE', 6: 'DET',
  7: 'KC',  8: 'MIL', 9: 'MIN', 10: 'NYY', 11: 'OAK', 12: 'SEA',
  13: 'TEX', 14: 'TOR', 15: 'ATL', 16: 'CHC', 17: 'CIN', 18: 'HOU',
  19: 'LAD', 20: 'WSH', 21: 'NYM', 22: 'PHI', 23: 'PIT', 24: 'STL',
  25: 'SD',  26: 'SF',  27: 'COL', 28: 'MIA', 29: 'ARI', 30: 'TB',
};

const ESPN_NFL_TEAMS: Record<number, string> = {
  1: 'ATL',  2: 'BUF',  3: 'CHI',  4: 'CIN',  5: 'CLE',  6: 'DAL',
  7: 'DEN',  8: 'DET',  9: 'GB',  10: 'TEN', 11: 'IND', 12: 'KC',
  13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN', 17: 'NE',  18: 'NO',
  19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
  25: 'SF',  26: 'SEA', 27: 'TB',  28: 'WSH', 29: 'CAR', 30: 'JAX',
  33: 'BAL', 34: 'HOU',
};

const ESPN_GAME:     Record<'mlb' | 'nfl', string> = { mlb: 'flb', nfl: 'ffl' };
const ESPN_SEASON:   Record<'mlb' | 'nfl', number> = { mlb: 2026, nfl: 2025 };
const ESPN_LEAGUE:   Record<'mlb' | 'nfl', number> = { mlb: 3, nfl: 1 };

function parseESPNResponse(
  json: unknown,
  posMap: Record<number, string>,
  teamMap: Record<number, string>,
): NFBCPlayer[] {
  const data = json as Record<string, unknown>;
  const list = Array.isArray(data.players) ? (data.players as unknown[]) : [];

  const raw: Array<{ adp: number; player: Omit<NFBCPlayer, 'rank' | 'valueDelta' | 'isValuePick'> }> = [];

  for (const entry of list) {
    const e = entry as Record<string, unknown>;
    // ESPN uses averageDraftPositionProcessed (post-processing) or averageDraftPosition
    const adp =
      (typeof e.averageDraftPositionProcessed === 'number' && e.averageDraftPositionProcessed > 0
        ? e.averageDraftPositionProcessed
        : typeof e.averageDraftPosition === 'number'
          ? e.averageDraftPosition
          : 0);
    if (adp <= 0) continue;

    const p = e.player as Record<string, unknown> | undefined;
    if (!p) continue;

    const fullName = typeof p.fullName === 'string' ? p.fullName.trim() : '';
    if (!fullName) continue;

    const defaultPosId = typeof p.defaultPositionId === 'number' ? p.defaultPositionId : 0;
    const proTeamId    = typeof p.proTeamId          === 'number' ? p.proTeamId          : 0;

    const positions = posMap[defaultPosId] ?? 'UTIL';
    const team      = teamMap[proTeamId]   ?? '';

    // Invert "First Last" → "Last, First" to match the NFBCPlayer convention
    const parts = fullName.split(' ');
    const playerName = parts.length >= 2
      ? `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`
      : fullName;

    raw.push({ adp, player: { playerName, displayName: fullName, adp, positions, team } });
  }

  raw.sort((a, b) => a.adp - b.adp);

  return raw.map(({ player }, i) => {
    const rank       = i + 1;
    const valueDelta = Math.round((player.adp - rank) * 10) / 10;
    return { ...player, rank, valueDelta, isValuePick: valueDelta > 15 };
  });
}

export async function scrapeESPN(sport: 'mlb' | 'nfl'): Promise<NFBCPlayer[]> {
  const url =
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/${ESPN_GAME[sport]}` +
    `/seasons/${ESPN_SEASON[sport]}/segments/0/leaguedefaults/${ESPN_LEAGUE[sport]}` +
    `?scoringPeriodId=1&view=kona_player_info`;

  // X-Fantasy-Filter: sort by ADP and pull a large player pool.
  // Keep the filter minimal — extra fields (e.g. filterRanksForScoringPeriodIds)
  // cause HTTP 400 on the leaguedefaults endpoint.
  const fantasyFilter = JSON.stringify({
    players: {
      filterStatus: { value: ['FREEAGENT', 'ONTEAM', 'WAIVERS'] },
      limit: 600,
      offset: 0,
      sortAverageDraftPositionProcessed: { sortPriority: 1, sortAsc: true },
    },
  });

  const headers: Record<string, string> = {
    'User-Agent':       FP_UA,
    Accept:             'application/json',
    'X-Fantasy-Filter': fantasyFilter,
  };

  let res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });

  // If the filtered request is rejected, retry without the filter header
  if (res.status === 400) {
    console.warn(`[v0] [ADP/fetcher] ESPN ${sport.toUpperCase()} 400 with filter — retrying without filter`);
    const { 'X-Fantasy-Filter': _removed, ...plainHeaders } = headers;
    res = await fetch(url, { headers: plainHeaders, signal: AbortSignal.timeout(12_000) });
  }

  if (!res.ok) throw new Error(`ESPN ${sport.toUpperCase()} HTTP ${res.status}`);

  const json = await res.json() as unknown;
  const posMap  = sport === 'mlb' ? ESPN_MLB_POS  : ESPN_NFL_POS;
  const teamMap = sport === 'mlb' ? ESPN_MLB_TEAMS : ESPN_NFL_TEAMS;

  const players = parseESPNResponse(json, posMap, teamMap);
  if (players.length < 50) {
    throw new Error(`ESPN ${sport.toUpperCase()}: only ${players.length} players parsed`);
  }
  return players;
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

/**
 * Try FantasyPros, then ESPN. Returns players + which source won.
 * Throws only if BOTH sources fail — caller decides the fallback.
 */
export async function fetchLiveADP(
  sport: 'mlb' | 'nfl',
): Promise<{ players: NFBCPlayer[]; source: 'fantasypros' | 'espn' }> {
  // 1. FantasyPros
  try {
    const players = await scrapeFantasyPros(sport);
    console.log(`[v0] [ADP/fetcher] FantasyPros ${sport.toUpperCase()}: ${players.length} players`);
    return { players, source: 'fantasypros' };
  } catch (err) {
    console.warn(
      `[v0] [ADP/fetcher] FantasyPros ${sport.toUpperCase()} failed:`,
      err instanceof Error ? err.message : err,
    );
  }

  // 2. ESPN
  const players = await scrapeESPN(sport);
  console.log(`[v0] [ADP/fetcher] ESPN ${sport.toUpperCase()}: ${players.length} players`);
  return { players, source: 'espn' };
}
