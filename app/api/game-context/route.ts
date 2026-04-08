/**
 * GET /api/game-context?sport=baseball_mlb&home=San+Diego+Padres&away=Pittsburgh+Pirates
 *
 * Returns real team stats, H2H history, and injured-list data for a matchup.
 * Uses the free MLB Stats API (no key required) for baseball_mlb.
 * Other sports return graceful empty shapes — extend as new APIs are added.
 *
 * Module-level 5-minute cache keeps credit/quota cost near zero.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

const MLB = 'https://statsapi.mlb.com/api/v1';
const CACHE_TTL = 5 * 60 * 1000;

// ── Module-level cache keyed by arbitrary string ───────────────────────────
const cache = new Map<string, { data: unknown; ts: number }>();
function fromCache<T>(key: string): T | null {
  const hit = cache.get(key);
  return hit && Date.now() - hit.ts < CACHE_TTL ? (hit.data as T) : null;
}
function toCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function lastWord(s: string) { return s.toLowerCase().split(/\s+/).pop() ?? ''; }
function dateStr(d: Date) { return d.toISOString().slice(0, 10); }

function findTeam(teams: any[], name: string) {
  const n = name.toLowerCase().trim();
  return (
    teams.find((t: any) => t.name?.toLowerCase() === n) ??
    teams.find((t: any) => lastWord(t.name ?? '').length > 3 && lastWord(t.name) === lastWord(n)) ??
    teams.find((t: any) => t.abbreviation?.toLowerCase() === n) ??
    null
  );
}

// ── MLB Stats API fetchers ─────────────────────────────────────────────────

async function getAllTeams() {
  const key = 'mlb_teams';
  const cached = fromCache<any[]>(key);
  if (cached) return cached;
  const res = await fetch(`${MLB}/teams?sportId=1`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return [];
  const { teams } = await res.json();
  toCache(key, teams);
  return teams as any[];
}

async function getStandingsMap(): Promise<Map<number, any>> {
  const key = `standings_${dateStr(new Date())}`;
  const cached = fromCache<Map<number, any>>(key);
  if (cached) return cached;
  const year = new Date().getFullYear();
  const res = await fetch(
    `${MLB}/standings?leagueId=103,104&season=${year}&standingsType=regularSeason`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!res.ok) return new Map();
  const { records = [] } = await res.json();
  const map = new Map<number, any>();
  for (const div of records) {
    for (const tr of (div.teamRecords ?? [])) {
      map.set(tr.team?.id, tr);
    }
  }
  toCache(key, map);
  return map;
}

async function getInjuredList(teamId: number) {
  const key = `il_${teamId}_${dateStr(new Date())}`;
  const cached = fromCache<any[]>(key);
  if (cached) return cached;
  const year = new Date().getFullYear();
  const res = await fetch(
    `${MLB}/teams/${teamId}/roster?rosterType=injuredList&season=${year}`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!res.ok) return [];
  const { roster = [] } = await res.json();
  const data = roster.map((p: any) => ({
    player:   p.person?.fullName ?? 'Unknown',
    position: p.position?.abbreviation ?? '',
    status:   (p.status?.description ?? '')
                .replace(/(\d+)-Day Injured List/, '$1-Day IL')
                .replace('Injured List', 'IL') || 'IL',
  }));
  toCache(key, data);
  return data as any[];
}

async function getH2H(homeId: number, awayId: number, homeName: string) {
  const key = `h2h_${homeId}_${awayId}`;
  const cached = fromCache<any[]>(key);
  if (cached) return cached;
  const end   = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  const res = await fetch(
    `${MLB}/schedule?sportId=1&teamId=${homeId}&opponentId=${awayId}` +
    `&startDate=${dateStr(start)}&endDate=${dateStr(end)}&gameType=R`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!res.ok) return [];
  const { dates = [] } = await res.json();
  const games: any[] = [];
  for (const d of dates) {
    for (const g of (d.games ?? [])) {
      if (g.status?.abstractGameState !== 'Final') continue;
      const ht = g.teams?.home;
      const at = g.teams?.away;
      if (!ht || !at) continue;
      const isHome = ht.team?.id === homeId;
      const myScore  = isHome ? ht.score : at.score;
      const oppScore = isHome ? at.score : ht.score;
      const won      = isHome ? ht.isWinner : at.isWinner;
      games.push({
        date:   d.date,
        score:  `${myScore ?? '?'}-${oppScore ?? '?'}`,
        winner: won ? lastWord(homeName) : lastWord(g.teams?.[isHome ? 'away' : 'home']?.team?.name ?? ''),
        won,
      });
    }
  }
  const data = games.reverse().slice(0, 6);
  toCache(key, data);
  return data;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sport    = searchParams.get('sport') ?? 'baseball_mlb';
  const homeName = searchParams.get('home') ?? '';
  const awayName = searchParams.get('away') ?? '';

  if (sport !== 'baseball_mlb' || !homeName || !awayName) {
    return NextResponse.json({ teams: null, history: [], injuries: [] });
  }

  try {
    const [allTeams, standingsMap] = await Promise.all([getAllTeams(), getStandingsMap()]);
    const homeTeam = findTeam(allTeams, homeName);
    const awayTeam = findTeam(allTeams, awayName);

    if (!homeTeam || !awayTeam) {
      return NextResponse.json({ teams: null, history: [], injuries: [] });
    }

    const [homeStanding, awayStanding, homeIL, awayIL, history] = await Promise.all([
      Promise.resolve(standingsMap.get(homeTeam.id) ?? null),
      Promise.resolve(standingsMap.get(awayTeam.id) ?? null),
      getInjuredList(homeTeam.id),
      getInjuredList(awayTeam.id),
      getH2H(homeTeam.id, awayTeam.id, homeName),
    ]);

    const splitRecord = (standing: any, type: string) => {
      const r = standing?.records?.splitRecords?.find((s: any) => s.type === type);
      return r ? `${r.wins}-${r.losses}` : null;
    };

    const teamShape = (standing: any, team: any, homeOrAway: 'home' | 'away') => ({
      name:       team.name,
      abbr:       team.abbreviation,
      record:     standing ? `${standing.wins}-${standing.losses}` : null,
      winPct:     standing?.winningPercentage ?? null,
      gamesBack:  standing?.gamesBack === '-' ? '—' : (standing?.gamesBack ?? null),
      streak:     standing?.streak?.streakCode ?? null,
      last10:     splitRecord(standing, 'lastTen'),
      splitRecord: splitRecord(standing, homeOrAway),
    });

    return NextResponse.json({
      teams: {
        home: teamShape(homeStanding, homeTeam, 'home'),
        away: teamShape(awayStanding, awayTeam, 'away'),
      },
      history: history.map((g: any) => ({
        date:   g.date,
        score:  g.score,
        winner: g.winner,
        won:    g.won,
      })),
      injuries: [
        ...homeIL.map((p: any) => ({ ...p, team: homeTeam.abbreviation })),
        ...awayIL.map((p: any) => ({ ...p, team: awayTeam.abbreviation })),
      ],
    });
  } catch (err) {
    console.error('[API/game-context]', err);
    return NextResponse.json({ teams: null, history: [], injuries: [] });
  }
}
