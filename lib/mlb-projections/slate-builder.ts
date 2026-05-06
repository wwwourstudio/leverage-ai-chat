/**
 * DFS Slate Builder
 * Assembles a complete MLB DFS slate for a given date.
 * Groups players by position, identifies stacks, and ranks by value.
 */

import { buildDFSCardsWithSlate, type DFSCardData } from './dfs-adapter';
import { fetchTodaysGames } from './mlb-stats-api';
import type { DKDraftGroup } from './draftkings-api';

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
  metadata:         {
    date: string;
    gamesCount: number;
    totalProjPts: number;
    totalSalary: number;
    capValid: boolean;
    playingTodayCount: number;
    /** DK contest slate the lineup is targeting. null when DK is unreachable (degraded mode). */
    slate?: { draftGroupId: number; slateLabel: string; startDate: string; gameCount: number; contestType: 'classic' | 'showdown' } | null;
    /** True when DK feed was unreachable; the lineup is projection-only and not contest-validated. */
    degradedMode?: boolean;
    degradedReason?: string;
    /** True when no full lineup could be built because the available DK pool is too thin. */
    insufficientPool?: boolean;
  };
}

/**
 * Build a full DFS slate for DraftKings MLB.
 * Returns position-sorted DFSCard array ready for rendering.
 * (Backward-compatible — internally delegates to buildDFSSlateMulti)
 */
export async function buildDFSSlate(opts: { limit?: number; date?: string; draftGroupId?: number } = {}): Promise<DFSCardData[]> {
  const multi = await buildDFSSlateMulti(opts);
  return multi.slateForCard;
}

/**
 * Build 5 lineup variants from a single player pool fetch.
 * Returns optimal, value, matchup, contrarian, and chalk lineups
 * plus metadata and the annotated optimal lineup as slateForCard.
 */
export async function buildDFSSlateMulti(opts: { limit?: number; date?: string; draftGroupId?: number } = {}): Promise<DFSSlateMulti> {
  const { limit = 9 } = opts;

  const [games, dfsResult] = await Promise.all([
    fetchTodaysGames(opts.date).catch(() => []),
    buildDFSCardsWithSlate({ limit: limit * 4, date: opts.date, draftGroupId: opts.draftGroupId }), // Over-fetch for all lineup variants
  ]);
  const allCards = dfsResult.cards;
  const slateMeta = slateToMeta(dfsResult.slate);

  const empty: DFSSlateMulti = {
    optimalLineup: [], valueLineup: [], matchupLineup: [],
    contrarianLineup: [], chalkLineup: [], topStack: null,
    slateForCard: [],
    metadata: {
      date: opts.date ?? new Date().toISOString().slice(0, 10),
      gamesCount: dfsResult.slate?.gameCount ?? games.length,
      totalProjPts: 0, totalSalary: 0, capValid: true, playingTodayCount: 0,
      slate: slateMeta,
      degradedMode: dfsResult.degradedMode,
      degradedReason: dfsResult.degradedReason,
    },
  };

  if (allCards.length === 0) return empty;

  // ── Hard-filter unavailable players ───────────────────────────────────────
  // Only players DK has in their contest pool, who are not on IL / scratched /
  // missing from the confirmed lineup, and whose team is in this slate.
  const playable = allCards.filter(c => c.data.isPlaying !== false);
  const poolCards = playable.length > 0 ? playable : allCards;
  // If the pool is still too thin (insufficient SP or hitters), surface an
  // empty result with `insufficientPool: true` so the UI can render a banner
  // instead of a bogus lineup.
  const sp = poolCards.filter(c => c.data.position === 'SP' || c.data.position === 'RP').length;
  const bat = poolCards.length - sp;
  if (sp < 2 || bat < 8) {
    return {
      ...empty,
      slateForCard: [],
      metadata: { ...empty.metadata, insufficientPool: true },
    };
  }

  // ── Optimal lineup (position-balanced, max projected pts, cap-enforced) ──
  const optimalLineup = buildOptimalLineup(poolCards, limit);

  // ── Value lineup (top 5 by pts/$K) ────────────────────────────────────────
  const valueLineup = [...poolCards]
    .sort((a, b) => parseFloat(b.data.dkValue) - parseFloat(a.data.dkValue))
    .slice(0, 5)
    .map(c => ({ ...c, data: { ...c.data, cardCategory: 'value' } }));

  // ── Matchup lineup (top 5 by matchup score) ───────────────────────────────
  const matchupLineup = [...poolCards]
    .sort((a, b) => parseFloat(b.data.matchupScore) - parseFloat(a.data.matchupScore))
    .slice(0, 5)
    .map(c => ({ ...c, data: { ...c.data, cardCategory: 'matchup' } }));

  // ── Contrarian lineup (low ownership, decent projection) ──────────────────
  const contrarianLineup = poolCards
    .filter(c => parseFloat(c.data.ownership) < 15 && parseFloat(c.data.projection) > 5)
    .sort((a, b) => parseFloat(b.data.projection) - parseFloat(a.data.projection))
    .slice(0, 5)
    .map(c => ({ ...c, data: { ...c.data, cardCategory: 'contrarian' } }));

  // ── Chalk lineup (high ownership) ─────────────────────────────────────────
  const chalkLineup = poolCards
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
  const totalSalary  = optimalLineup.reduce((s, c) => s + cardSalary(c), 0);
  const capValid     = totalSalary <= 50000;
  // After filtering, every player in the optimal lineup is playing today.
  const playingTodayCount = optimalLineup.filter(c => c.data.isPlaying !== false).length;

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
      gamesCount: dfsResult.slate?.gameCount ?? games.length,
      totalProjPts: Math.round(totalProjPts * 10) / 10,
      totalSalary,
      capValid,
      playingTodayCount,
      slate: slateMeta,
      degradedMode: dfsResult.degradedMode,
      degradedReason: dfsResult.degradedReason,
    },
  };
}

function slateToMeta(slate: DKDraftGroup | null) {
  if (!slate) return null;
  return {
    draftGroupId: slate.draftGroupId,
    slateLabel:   slate.slateLabel,
    startDate:    slate.startDate,
    gameCount:    slate.gameCount,
    contestType:  slate.contestType,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DK_CAP = 50_000;
const MIN_SALARY_PER_SLOT = 2_500;

function parseSalary(s: string | number | undefined): number {
  return parseInt(String(s ?? '').replace(/[^0-9]/g, ''), 10) || 0;
}

/** Prefer DK's authoritative salary; fall back to the parsed display string. */
function cardSalary(c: DFSCardData): number {
  if (typeof c.data.dkSalary === 'number' && c.data.dkSalary > 0) return c.data.dkSalary;
  return parseSalary(c.data.salary);
}

function buildOptimalLineup(cards: DFSCardData[], limit: number): DFSCardData[] {
  const byPosition: Record<string, DFSCardData[]> = {};
  for (const card of cards) {
    const pos = card.data.position ?? 'UTIL';
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(card);
  }

  // DK MLB lineup: SP, C, 1B, 2B, 3B, SS, OF, OF, OF
  const positionPriority = ['SP', 'C', '1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF'];
  const lineup: DFSCardData[] = [];
  let remainingBudget = DK_CAP;

  for (let i = 0; i < positionPriority.length; i++) {
    if (lineup.length >= limit) break;
    const pos = positionPriority[i];
    const slotsRemaining = positionPriority.length - i - 1;
    // Reserve enough budget for remaining slots at minimum salary
    const budgetForThisSlot = remainingBudget - (slotsRemaining * MIN_SALARY_PER_SLOT);

    const available = (byPosition[pos] ?? byPosition['UTIL'] ?? [])
      .filter(c => !lineup.includes(c));

    if (available.length === 0) continue;

    // Sort by projection descending; pick highest that fits within budget
    available.sort((a, b) => parseFloat(b.data.projection) - parseFloat(a.data.projection));
    const pick = available.find(c => cardSalary(c) <= budgetForThisSlot)
      ?? available.sort((a, b) => cardSalary(a) - cardSalary(b))[0]; // fallback: cheapest

    lineup.push(pick);
    remainingBudget -= cardSalary(pick);
  }

  // Fill any remaining slots (e.g. if position pool was short)
  const remaining = cards.filter(c => !lineup.includes(c))
    .sort((a, b) => parseFloat(b.data.projection) - parseFloat(a.data.projection));
  for (const card of remaining) {
    if (lineup.length >= limit) break;
    if (cardSalary(card) <= remainingBudget) {
      lineup.push(card);
      remainingBudget -= cardSalary(card);
    }
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
