/**
 * Shared DFS lineup builder — used by both /api/dfs and the cards generator ADP fallback.
 * Converts nfbc_adp player records into a DraftKings-style optimal lineup.
 */

export interface AdpPlayer {
  id: number;
  player_name: string;
  display_name?: string | null;
  team?: string | null;
  positions?: string | null;
  adp?: number | null;
  rank?: number | null;
  value_delta?: number | null;
  is_value_pick?: boolean | null;
  auction_value?: number | null;
}

export interface EnrichedDFSPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  salary: number;
  projectedPoints: number;
  value: number;
  valueGrade: string;
  ownership: string;
}

export interface DFSLineupResult {
  roster: EnrichedDFSPlayer[];
  totalSalary: number;
  totalProjected: number;
}

/** DraftKings roster requirements per sport */
const ROSTER_SPOTS: Record<string, Record<string, number>> = {
  baseball_mlb:          { SP: 2, C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3, UTIL: 1 },
  basketball_nba:        { PG: 1, SG: 1, SF: 1, PF: 1, C: 1, G: 1, F: 1, UTIL: 1 },
  americanfootball_nfl:  { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, DST: 1 },
  icehockey_nhl:         { C: 2, W: 3, D: 2, G: 1, UTIL: 1 },
};
const SALARY_CAP = 50000;

/** Rank 1 → $9,800 (SP) or $5,900 (hitters), Rank 300 → $2,500 */
export function rankToSalary(rank: number, isSP = false): number {
  const clamped = Math.min(Math.max(rank, 1), 300);
  const top = isSP ? 9800 : 5900;
  const salary = Math.round(top - ((clamped - 1) / 299) * (top - 2500));
  return Math.round(salary / 100) * 100;
}

export function estimateProjectedPoints(player: AdpPlayer, isSP = false): number {
  const base = isSP ? 20 : 5.0;
  const rank = player.rank ?? 200;
  const rankBump = Math.max(0, (150 - rank) * (isSP ? 0.06 : 0.015));
  const valueBump = (player.value_delta ?? 0) * 0.1;
  const pickBonus = player.is_value_pick ? (isSP ? 2 : 0.8) : 0;
  return Math.max(1, parseFloat((base + rankBump + valueBump + pickBonus).toFixed(1)));
}

export function buildGreedyLineup(
  players: AdpPlayer[],
  sport = 'baseball_mlb',
): DFSLineupResult {
  const spots = { ...(ROSTER_SPOTS[sport] ?? ROSTER_SPOTS.baseball_mlb) };

  const enriched: (EnrichedDFSPlayer & { _rawPos: string })[] = players.map(p => {
    const primaryPos = (p.positions as string)?.split(/[/,]/)[0]?.trim() ?? 'UTIL';
    const isSP = primaryPos === 'SP';
    const rank = p.rank ?? 200;
    const salary = rankToSalary(rank, isSP);
    const projectedPoints = estimateProjectedPoints(p, isSP);
    const value = salary > 0 ? projectedPoints / (salary / 1000) : 0;
    const valueGrade = value >= 5.5 ? 'A' : value >= 4.5 ? 'B' : value >= 3.5 ? 'C' : 'D';
    const ownershipPct = Math.max(2, Math.min(35, Math.round(8 + projectedPoints / 3)));
    return {
      id: p.id,
      name: p.display_name || p.player_name,
      team: p.team ?? '—',
      position: primaryPos,
      salary,
      projectedPoints,
      value,
      valueGrade,
      ownership: `${ownershipPct}%`,
      _rawPos: primaryPos,
    };
  }).sort((a, b) => b.value - a.value);

  const roster: (EnrichedDFSPlayer & { _rawPos: string })[] = [];
  let totalSalary = 0;
  const rostered = new Set<number>();

  for (const p of enriched) {
    if (totalSalary + p.salary > SALARY_CAP) continue;
    if (rostered.has(p.id)) continue;

    const pos = p._rawPos;
    if ((spots[pos] ?? 0) > 0) {
      spots[pos]--;
    } else if ((spots.UTIL ?? 0) > 0 && pos !== 'SP' && pos !== 'G') {
      spots.UTIL--;
    } else if ((spots.FLEX ?? 0) > 0 && pos !== 'QB' && pos !== 'DST') {
      spots.FLEX--;
    } else {
      continue;
    }

    roster.push(p);
    totalSalary += p.salary;
    rostered.add(p.id);
    if (Object.values(spots).every(v => v === 0)) break;
  }

  return {
    roster: roster.map(({ _rawPos: _, ...p }) => p),
    totalSalary,
    totalProjected: parseFloat(roster.reduce((s, p) => s + p.projectedPoints, 0).toFixed(1)),
  };
}
