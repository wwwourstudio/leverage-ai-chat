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

/**
 * Build a full DFS slate for DraftKings MLB.
 * Returns position-sorted DFSCard array ready for rendering.
 */
export async function buildDFSSlate(opts: { limit?: number; date?: string } = {}): Promise<DFSCardData[]> {
  const { limit = 9 } = opts;

  const [games, cards] = await Promise.all([
    fetchTodaysGames(opts.date).catch(() => []),
    buildDFSCards({ limit: limit * 3, date: opts.date }), // Over-fetch for position coverage
  ]);

  if (cards.length === 0) return [];

  // Group by position for lineup coverage
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

    // Find best player at this position not already in lineup
    const available = (byPosition[pos] ?? byPosition['UTIL'] ?? [])
      .filter(c => !lineup.includes(c));

    if (available.length > 0) {
      // Sort by DK pts projection
      available.sort((a, b) => parseFloat(b.data.projection) - parseFloat(a.data.projection));
      lineup.push(available[0]);
    }
  }

  // Fill any remaining slots with highest-projected players not yet in lineup
  const remaining = cards.filter(c => !lineup.includes(c))
    .sort((a, b) => parseFloat(b.data.projection) - parseFloat(a.data.projection));

  for (const card of remaining) {
    if (lineup.length >= limit) break;
    lineup.push(card);
  }

  // Add stack correlation tips to the top team stack
  const stackTip = buildStackTip(lineup, games.length);
  if (stackTip && lineup.length > 0) {
    // Annotate the first hitter in the stack with the stack tip
    const firstHitter = lineup.find(c => c.data.position !== 'SP' && c.data.position !== 'RP');
    if (firstHitter) {
      firstHitter.data.tips = stackTip + (firstHitter.data.tips ? ` · ${firstHitter.data.tips}` : '');
    }
  }

  return lineup.slice(0, limit);
}

// ─── Stack analysis ───────────────────────────────────────────────────────────

function buildStackTip(cards: DFSCardData[], totalGames: number): string | null {
  // Find the team with the most hitters in the proposed lineup
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
