/**
 * GET /api/adp/refresh
 *
 * Seeds Supabase nfbc_adp with live ADP from FantasyPros and ESPN.
 * Called by Vercel Cron at 06:00 UTC daily.
 *
 * Strategy for each sport:
 *  1. Try FantasyPros CSV export (consensus ADP, most widely-used source).
 *  2. If FantasyPros fails, try ESPN Fantasy JSON API.
 *  3. If both live sources fail and DB is empty, seed from static fallback.
 *
 * Live data always overwrites stale cron-seeded rows so ADP stays current.
 * User-uploaded data is preserved: if the fetched_at timestamp is absent or
 * the source column indicates a manual upload, the cron skips that sport.
 *
 * Auth: validated by CRON_SECRET header (Vercel env var).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  type NFBCPlayer,
  parseTSV,
  getADPData,
  saveADPToSupabase,
  loadADPFromSupabase,
  clearADPCache,
} from '@/lib/adp-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── FantasyPros ────────────────────────────────────────────────────────────────

const FP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; LeverageAI/1.0)',
  Accept: 'text/csv,text/plain,*/*',
  Referer: 'https://www.fantasypros.com/',
};

const FP_URLS: Record<'mlb' | 'nfl', string> = {
  mlb: 'https://www.fantasypros.com/mlb/adp/overall.php?export=csv',
  // Half-PPR is the most common NFL fantasy format
  nfl: 'https://www.fantasypros.com/nfl/adp/half-point-ppr-overall.php?export=csv',
};

/** Fetch FantasyPros CSV and parse with the shared TSV/CSV parser. */
async function scrapeFantasyPros(sport: 'mlb' | 'nfl'): Promise<NFBCPlayer[]> {
  const res = await fetch(FP_URLS[sport], {
    headers: FP_HEADERS,
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`FantasyPros ${sport.toUpperCase()} HTTP ${res.status}`);

  const text = await res.text();

  // Guard: if FantasyPros returned an HTML login wall instead of CSV
  if (text.trimStart().startsWith('<')) {
    throw new Error(`FantasyPros ${sport.toUpperCase()} returned HTML — not a CSV export`);
  }

  const players = parseTSV(text);
  if (players.length < 50) {
    throw new Error(`FantasyPros ${sport.toUpperCase()}: only ${players.length} players parsed`);
  }

  // FantasyPros uses "/" as position separator ("SP/DH") — normalise to ","
  return players.map(p => ({ ...p, positions: p.positions.replace(/\//g, ',') }));
}

// ── ESPN ───────────────────────────────────────────────────────────────────────

// ESPN defaultPositionId → fantasy position abbreviation (MLB)
const ESPN_MLB_POS: Record<number, string> = {
  1: 'SP', 2: 'RP', 3: 'C', 4: '1B', 5: '2B',
  6: '3B', 7: 'SS', 8: 'OF', 9: 'OF', 10: 'OF', 11: 'DH',
};

// ESPN defaultPositionId → fantasy position abbreviation (NFL)
const ESPN_NFL_POS: Record<number, string> = {
  1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST',
};

// ESPN proTeamId → MLB abbreviation
const ESPN_MLB_TEAMS: Record<number, string> = {
  1: 'BAL', 2: 'BOS', 3: 'LAA', 4: 'CWS', 5: 'CLE', 6: 'DET',
  7: 'KC',  8: 'MIL', 9: 'MIN', 10: 'NYY', 11: 'OAK', 12: 'SEA',
  13: 'TEX', 14: 'TOR', 15: 'ATL', 16: 'CHC', 17: 'CIN', 18: 'HOU',
  19: 'LAD', 20: 'WSH', 21: 'NYM', 22: 'PHI', 23: 'PIT', 24: 'STL',
  25: 'SD',  26: 'SF',  27: 'COL', 28: 'MIA', 29: 'ARI', 30: 'TB',
};

// ESPN proTeamId → NFL abbreviation
const ESPN_NFL_TEAMS: Record<number, string> = {
  1: 'ATL',  2: 'BUF',  3: 'CHI',  4: 'CIN',  5: 'CLE',  6: 'DAL',
  7: 'DEN',  8: 'DET',  9: 'GB',  10: 'TEN', 11: 'IND', 12: 'KC',
  13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN', 17: 'NE',  18: 'NO',
  19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
  25: 'SF',  26: 'SEA', 27: 'TB',  28: 'WSH', 29: 'CAR', 30: 'JAX',
  33: 'BAL', 34: 'HOU',
};

// ESPN fantasy leaguedefaults IDs
const ESPN_LEAGUE_ID: Record<'mlb' | 'nfl', number> = { mlb: 3, nfl: 1 };
const ESPN_GAME:      Record<'mlb' | 'nfl', string>  = { mlb: 'flb', nfl: 'ffl' };
// Draft seasons: MLB 2026, NFL 2025 (adjust each year)
const ESPN_SEASON:    Record<'mlb' | 'nfl', number>  = { mlb: 2026, nfl: 2025 };

function parseESPNResponse(
  json: unknown,
  posMap: Record<number, string>,
  teamMap: Record<number, string>,
): NFBCPlayer[] {
  const data = json as Record<string, unknown>;
  const list = Array.isArray(data.players) ? (data.players as unknown[]) : [];

  const raw: Array<{ adp: number; player: NFBCPlayer }> = [];

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

    // Invert "First Last" → "Last, First" for playerName (matches existing NFBCPlayer convention)
    const parts = fullName.split(' ');
    const playerName = parts.length >= 2
      ? `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`
      : fullName;

    raw.push({
      adp,
      player: {
        rank: 0, // assigned after sort
        playerName,
        displayName: fullName,
        adp,
        positions,
        team,
        valueDelta: 0,
        isValuePick: false,
      },
    });
  }

  // Sort by ADP, assign ranks
  raw.sort((a, b) => a.adp - b.adp);

  return raw.map(({ player }, i) => {
    const rank       = i + 1;
    const valueDelta = Math.round((player.adp - rank) * 10) / 10;
    return { ...player, rank, valueDelta, isValuePick: valueDelta > 15 };
  });
}

async function scrapeESPN(sport: 'mlb' | 'nfl'): Promise<NFBCPlayer[]> {
  const game     = ESPN_GAME[sport];
  const season   = ESPN_SEASON[sport];
  const leagueId = ESPN_LEAGUE_ID[sport];
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/${game}/seasons/${season}/segments/0/leaguedefaults/${leagueId}?scoringPeriodId=1&view=kona_player_info`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LeverageAI/1.0)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`ESPN ${sport.toUpperCase()} HTTP ${res.status}`);

  const json = await res.json();
  const posMap  = sport === 'mlb' ? ESPN_MLB_POS  : ESPN_NFL_POS;
  const teamMap = sport === 'mlb' ? ESPN_MLB_TEAMS : ESPN_NFL_TEAMS;

  const players = parseESPNResponse(json, posMap, teamMap);
  if (players.length < 50) {
    throw new Error(`ESPN ${sport.toUpperCase()}: only ${players.length} players parsed`);
  }
  return players;
}

// ── Live ADP orchestration ─────────────────────────────────────────────────────

/**
 * Fetch live ADP: FantasyPros first, ESPN as fallback, static last resort.
 * Returns the player list and the source that succeeded.
 */
async function fetchLiveADP(
  sport: 'mlb' | 'nfl',
): Promise<{ players: NFBCPlayer[]; source: string }> {
  // 1. FantasyPros
  try {
    const players = await scrapeFantasyPros(sport);
    console.log(`[v0] [ADP/refresh] FantasyPros ${sport.toUpperCase()}: ${players.length} players`);
    return { players, source: 'fantasypros' };
  } catch (err) {
    console.warn(
      `[v0] [ADP/refresh] FantasyPros ${sport.toUpperCase()} failed:`,
      err instanceof Error ? err.message : err,
    );
  }

  // 2. ESPN
  try {
    const players = await scrapeESPN(sport);
    console.log(`[v0] [ADP/refresh] ESPN ${sport.toUpperCase()}: ${players.length} players`);
    return { players, source: 'espn' };
  } catch (err) {
    console.warn(
      `[v0] [ADP/refresh] ESPN ${sport.toUpperCase()} failed:`,
      err instanceof Error ? err.message : err,
    );
  }

  // 3. Static fallback (only if DB is also empty — caller decides whether to write)
  if (sport === 'nfl') {
    const { getNFLADPData } = await import('@/lib/nfl-adp-data');
    const players = await getNFLADPData(true);
    return { players, source: 'static_fallback' };
  }
  const players = await getADPData(true);
  return { players, source: 'static_fallback' };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const results: Record<string, { seeded: number; skipped: boolean; source: string; error?: string }> = {};

  for (const sport of ['mlb', 'nfl'] as const) {
    try {
      const { players, source } = await fetchLiveADP(sport);

      if (source === 'static_fallback') {
        // Only seed static when DB is empty — never overwrite existing (possibly live) data
        const existing = await loadADPFromSupabase(sport, true);
        if (existing && existing.length > 0) {
          results[sport] = { seeded: existing.length, skipped: true, source: 'supabase_existing' };
          console.log(`[v0] [ADP/refresh] ${sport.toUpperCase()}: DB has ${existing.length} rows, both live sources failed — keeping existing`);
          continue;
        }
      }

      if (players.length > 0) {
        await saveADPToSupabase(players, sport);
        clearADPCache();
        results[sport] = { seeded: players.length, skipped: false, source };
        console.log(`[v0] [ADP/refresh] ${sport.toUpperCase()}: saved ${players.length} players from ${source}`);
      } else {
        results[sport] = { seeded: 0, skipped: false, source: 'empty' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results[sport] = { seeded: 0, skipped: false, source: 'error', error: msg };
      console.error(`[v0] [ADP/refresh] ${sport.toUpperCase()} error:`, msg);
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    results,
  });
}
