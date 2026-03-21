/**
 * ADP live data fetchers — server-only.
 *
 * Provides FantasyPros CSV and ESPN JSON scrapers for MLB and NFL ADP.
 * Both the on-demand path in adp-data.ts and the cron refresh route import
 * from here so scraper logic lives in one place.
 *
 * Source priority: FantasyPros CSV → ESPN JSON → (caller handles static)
 */

import { parseTSV, type NFBCPlayer } from '@/lib/adp-data';

// ── FantasyPros ────────────────────────────────────────────────────────────────

const FP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const FP_URLS: Record<'mlb' | 'nfl', string[]> = {
  // Try the primary export URL first; fall back to the alternate endpoint
  mlb: [
    'https://www.fantasypros.com/mlb/adp/overall.php?export=csv',
    'https://partners.fantasypros.com/api/v1/consensus-rankings.php?sport=MLB&scoring=STANDARD&type=STD&year=2026&week=0&num_teams=12&export=1',
  ],
  nfl: [
    'https://www.fantasypros.com/nfl/adp/half-point-ppr-overall.php?export=csv',
    'https://www.fantasypros.com/nfl/adp/ppr-overall.php?export=csv',
  ],
};

export async function scrapeFantasyPros(sport: 'mlb' | 'nfl'): Promise<NFBCPlayer[]> {
  const urls = FP_URLS[sport];
  let lastErr: Error = new Error('No URLs tried');

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': FP_UA,
          Accept: 'text/csv,text/plain,*/*',
          Referer: 'https://www.fantasypros.com/',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
      });

      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} from ${url}`);
        continue;
      }

      const text = await res.text();

      // Guard: FantasyPros sometimes returns an HTML login wall
      if (text.trimStart().startsWith('<')) {
        lastErr = new Error(`HTML response (login wall?) from ${url}`);
        continue;
      }

      const players = parseTSV(text);
      if (players.length < 50) {
        lastErr = new Error(`Only ${players.length} players from ${url}`);
        continue;
      }

      // FantasyPros uses "/" as position separator ("SP/DH") — normalise to ","
      return players.map(p => ({ ...p, positions: p.positions.replace(/\//g, ',') }));
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastErr;
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
    const adp = typeof e.averageDraftPosition === 'number' ? e.averageDraftPosition : 0;
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

  const res = await fetch(url, {
    headers: {
      'User-Agent': FP_UA,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(12_000),
  });
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
