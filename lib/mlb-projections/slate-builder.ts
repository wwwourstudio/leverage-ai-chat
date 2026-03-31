/**
 * DFS Slate Builder
 * Assembles a complete MLB DFS slate for a given date.
 * Groups players by position, identifies stacks, and ranks by value.
 */

import { buildDFSCards, type DFSCardData } from './dfs-adapter';
import { fetchTodaysGames } from './mlb-stats-api';

export interface DFSSlate {
  date: string;
  gamesCount: number;
  cards: DFSCardData[];
  stacks: DFSStack[];
  topValuePlays: DFSCardData[];
}

export interface DFSStack {
  team: string;
  players: string[];
  combinedMatchupScore: string;
  stackType: 'mini' | 'full';
}

export interface DFSSlateMulti {
  optimalLineup:    DFSCardData[];
  valueLineup:      DFSCardData[];
  matchupLineup:    DFSCardData[];
  contrarianLineup: DFSCardData[];
  chalkLineup:      DFSCardData[];
  topStack:         { team: string; players: string[]; type: 'full' | 'mini' } | null;
  slateForCard:     DFSCardData[];
  metadata:         { date: string; gamesCount: number; totalProjPts: number; totalSalary: number };
}

/**
 * Build a full DFS slate for DraftKings MLB.
 * Returns position-sorted DFSCard array ready for rendering.
 * (Backward-compatible — internally delegates to buildDFSSlateMulti)
 */
export async function buildDFSSlate(opts: { limit?: number; date?: string } = {}): Promise<DFSCardData[]> {
  const multi = await buildDFSSlateMulti(opts);
  return multi.slateForCard;
}

/**
 * Build 5 lineup variants from a single player pool fetch.
 * Returns optimal, value, matchup, contrarian, and chalk lineups
 * plus metadata and the annotated optimal lineup as slateForCard.
 */
export async function buildDFSSlateMulti(opts: { limit?: number; date?: string } = {}): Promise<DFSSlateMulti> {
  const { limit = 9 } = opts;

  const [games, allCards] = await Promise.all([
    fetchTodaysGames(opts.date).catch(() => []),
    buildDFSCards({ limit: limit * 4, date: opts.date }), // Over-fetch for all lineup variants
  ]);

  const empty: DFSSlateMulti = {
    optimalLineup: [], valueLineup: [], matchupLineup: [],
    contrarianLineup: [], chalkLineup: [], topStack: null,
    slateForCard: [],
    metadata: { date: opts.date ?? new Date().toISOString().slice(0, 10), gamesCount: games.length, totalProjPts: 0, totalSalary: 0 },
  };

  if (allCards.length === 0) return empty;

  // ── Optimal lineup (position-balanced, max projected pts) ────────────────
  const optimalLineup = buildOptimalLineup(allCards, limit);

  // ── Value lineup (top 5 by pts/$K) ────────────────────────────────────────
  const valueLineup = [...allCards]
    .sort((a, b) => parseFloat(b.data.dkValue) - parseFloat(a.data.dkValue))
    .slice(0, 5)
    .map(c => ({ ...c, data: { ...c.data, cardCategory: 'value' } }));

  // ── Matchup lineup (top 5 by matchup score) ───────────────────────────────
  const matchupLineup = [...allCards]
    .sort((a, b) => parseFloat(b.data.matchupScore) - parseFloat(a.data.matchupScore))
    .slice(0, 5)
    .map(c => ({ ...c, data: { ...c.data, cardCategory: 'matchup' } }));

  // ── Contrarian lineup (low ownership, decent projection) ──────────────────
  const contrarianLineup = allCards
    .filter(c => parseFloat(c.data.ownership) < 15 && parseFloat(c.data.projection) > 5)
    .sort((a, b) => parseFloat(b.data.projection) - parseFloat(a.data.projection))
    .slice(0, 5)
    .map(c => ({ ...c, data: { ...c.data, cardCategory: 'contrarian' } }));

  // ── Chalk lineup (high ownership) ─────────────────────────────────────────
  const chalkLineup = allCards
    .filter(c => parseFloat(c.data.ownership) > 25)
    .sort((a, b) => parseFloat(b.data.projection) - parseFloat(a.data.projection))
    .slice(0, 5)
    .map(c => ({ ...c, data: { ...c.data, cardCategory: 'chalk' } }));

  // ── Top stack ─────────────────────────────────────────────────────────────
  const topStack = findTopStack(optimalLineup);

  // ── Annotate stack partners on optimal lineup ────────────────────────────
  if (topStack) {
    for (const card of optimalLineup) {
      if (card.data.team === topStack.team) {
        card.data.stackTeam = topStack.team;
        card.data.stackType = topStack.type;
        card.data.stackPartners = topStack.players.filter(p => p !== card.data.player);
      }
    }
  }

  // Attach stack tip to first hitter
  const stackTip = buildStackTip(optimalLineup, games.length);
  if (stackTip) {
    const firstHitter = optimalLineup.find(c => c.data.position !== 'SP' && c.data.position !== 'RP');
    if (firstHitter) {
      firstHitter.data.tips = stackTip + (firstHitter.data.tips ? ` · ${firstHitter.data.tips}` : '');
    }
  }

  // ── slateForCard: optimal lineup annotated with cardCategory='optimal' ────
  const slateForCard = optimalLineup.map(c => ({
    ...c,
    data: { ...c.data, cardCategory: c.data.cardCategory ?? 'optimal' },
  }));

  // ── Metadata ──────────────────────────────────────────────────────────────
  const totalProjPts = optimalLineup.reduce((s, c) => s + parseFloat(c.data.projection), 0);
  const totalSalary  = optimalLineup.reduce((s, c) => s + parseFloat(String(c.data.salary).replace(/[^0-9]/g, '')), 0);

  return {
    optimalLineup,
    valueLineup,
    matchupLineup,
    contrarianLineup,
    chalkLineup,
    topStack,
    slateForCard,
    metadata: {
      date: opts.date ?? new Date().toISOString().slice(0, 10),
      gamesCount: games.length,
      totalProjPts: Math.round(totalProjPts * 10) / 10,
      totalSalary,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildOptimalLineup(cards: DFSCardData[], limit: number): DFSCardData[] {
  const byPosition: Record<string, DFSCardData[]> = {};
  for (const card of cards) {
    const pos = card.data.position ?? 'UTIL';
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(card);
  }

  // DK MLB lineup: SP, C, 1B, 2B, 3B, SS, OF, OF, OF (+ optional UTIL)
  const lineup: DFSCardData[] = [];
  const positionPriority = ['SP', 'C', '1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF'];

  for (const pos of positionPriority) {
    if (lineup.length >= limit) break;
    const available = (byPosition[pos] ?? byPosition['UTIL'] ?? [])
      .filter(c => !lineup.includes(c));
    if (available.length > 0) {
      available.sort((a, b) => parseFloat(b.data.projection) - parseFloat(a.data.projection));
      lineup.push(available[0]);
    }
  }

  // Fill remaining slots with highest-projected players
  const remaining = cards.filter(c => !lineup.includes(c))
    .sort((a, b) => parseFloat(b.data.projection) - parseFloat(a.data.projection));
  for (const card of remaining) {
    if (lineup.length >= limit) break;
    lineup.push(card);
  }

  return lineup.slice(0, limit);
}

function findTopStack(cards: DFSCardData[]): { team: string; players: string[]; type: 'full' | 'mini' } | null {
  const teamCounts: Record<string, string[]> = {};
  for (const card of cards) {
    if (card.data.position === 'SP' || card.data.position === 'RP') continue;
    const team = card.data.team;
    if (!teamCounts[team]) teamCounts[team] = [];
    teamCounts[team].push(card.data.player);
  }
  const top = Object.entries(teamCounts).sort((a, b) => b[1].length - a[1].length)[0];
  if (!top || top[1].length < 2) return null;
  return { team: top[0], players: top[1], type: top[1].length >= 3 ? 'full' : 'mini' };
}

function buildStackTip(cards: DFSCardData[], totalGames: number): string | null {
  const teamCounts: Record<string, number> = {};
  for (const card of cards) {
    if (card.data.position === 'SP' || card.data.position === 'RP') continue;
    const team = card.data.team;
    teamCounts[team] = (teamCounts[team] ?? 0) + 1;
  }
  const topTeam = Object.entries(teamCounts).sort((a, b) => b[1] - a[1])[0];
  if (!topTeam || topTeam[1] < 2) return null;
  const [team, count] = topTeam;
  const stackType = count >= 3 ? 'Full stack' : 'Mini-stack';
  return `${stackType}: ${count} ${team} hitters targeted — correlated upside`;
}
