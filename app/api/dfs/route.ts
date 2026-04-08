import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';
import { isSupabaseConfigured } from '@/lib/config';

export const runtime = 'nodejs';

// ============================================================================
// Salary proxy: derive DK-style salary from ADP rank
// Rank 1 → $5900, Rank 300 → $2500 (linear interpolation)
// ============================================================================
function rankToSalary(rank: number, adpMax = 300): number {
  const clamped = Math.min(Math.max(rank, 1), adpMax);
  const salary = Math.round(5900 - ((clamped - 1) / (adpMax - 1)) * 3400);
  // Round to nearest $100
  return Math.round(salary / 100) * 100;
}

// ============================================================================
// Projection model using available nfbc_adp metrics
// ============================================================================
function estimateProjectedPoints(player: {
  rank?: number;
  adp?: number;
  value_delta?: number;
  is_value_pick?: boolean;
  auction_value?: number;
}): number {
  const base = 5.0;
  // Better ADP rank = higher projected points
  const rankBump = player.rank ? Math.max(0, (150 - player.rank) * 0.015) : 0;
  const valueBump = player.value_delta ? player.value_delta * 0.1 : 0;
  const pickBonus = player.is_value_pick ? 0.8 : 0;
  return Math.max(1, parseFloat((base + rankBump + valueBump + pickBonus).toFixed(1)));
}

// ============================================================================
// Greedy lineup builder — MLB DK slate
// ============================================================================
const MLB_ROSTER_SPOTS: Record<string, Record<string, number>> = {
  dk:    { SP: 2, C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3, UTIL: 1 },
  fd:    { SP: 1, C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3, UTIL: 1 },
  yahoo: { SP: 2, C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3, UTIL: 1 },
};
const SALARY_CAPS: Record<string, number> = { dk: 50000, fd: 35000, yahoo: 200 };

function buildGreedyLineup(
  players: EnrichedPlayer[],
  site: string,
): { roster: EnrichedPlayer[]; totalSalary: number; totalProjected: number } {
  const spots = { ...(MLB_ROSTER_SPOTS[site] ?? MLB_ROSTER_SPOTS.dk) };
  const cap = SALARY_CAPS[site] ?? 50000;
  const roster: EnrichedPlayer[] = [];
  let totalSalary = 0;

  // Sort by value descending
  const sorted = [...players].sort((a, b) => b.value - a.value);

  for (const player of sorted) {
    if (Object.values(spots).every(v => v === 0)) break;

    const pos = player.primaryPosition;
    if (!pos) continue;
    if (totalSalary + player.salary > cap) continue;

    if ((spots[pos] ?? 0) > 0) {
      spots[pos]--;
    } else if ((spots.UTIL ?? 0) > 0 && pos !== 'SP' && pos !== 'RP') {
      spots.UTIL--;
    } else {
      continue;
    }

    roster.push(player);
    totalSalary += player.salary;
  }

  // ── Swap pass: upgrade players to fill remaining cap ──────────────────────
  // Repeatedly try to swap each rostered player for the highest-salary player
  // at the same position that fits under the remaining cap. Stop when within
  // $2,000 of the cap or no more improving swaps exist.
  const rosterSet = new Set(roster.map(p => p.id));
  let improved = true;
  while (improved && totalSalary < cap - 2000) {
    improved = false;
    for (let i = 0; i < roster.length; i++) {
      const current = roster[i];
      const pos = current.primaryPosition;
      const remainAfterRemoval = cap - (totalSalary - current.salary);

      // Find highest-salary non-rostered same-position player that fits
      const upgrade = sorted.find(
        p =>
          p.primaryPosition === pos &&
          !rosterSet.has(p.id) &&
          p.salary > current.salary &&
          p.salary <= remainAfterRemoval,
      );

      if (upgrade) {
        rosterSet.delete(current.id);
        rosterSet.add(upgrade.id);
        totalSalary = totalSalary - current.salary + upgrade.salary;
        roster[i] = upgrade;
        improved = true;
        break; // restart the pass after each swap
      }
    }
  }

  return {
    roster,
    totalSalary,
    totalProjected: parseFloat(roster.reduce((s, p) => s + p.projectedPoints, 0).toFixed(1)),
  };
}

interface EnrichedPlayer {
  id: number;
  player_name: string;
  display_name: string;
  team: string;
  positions: string;
  primaryPosition: string;
  adp: number;
  rank: number;
  value_delta: number;
  is_value_pick: boolean;
  auction_value: number | null;
  salary: number;
  site: string;
  projectedPoints: number;
  value: number;
  valueGrade: string;
}

// ============================================================================
// GET /api/dfs?site=dk&sport=mlb&position=OF&limit=100
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Supabase not configured', players: [], lineup: null },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE },
      );
    }

    const { searchParams } = new URL(request.url);
    const sport    = searchParams.get('sport')?.trim() ?? 'mlb';
    const slate    = searchParams.get('slate')?.trim() ?? 'main';
    const site     = searchParams.get('site')?.trim() ?? 'dk';
    const position = searchParams.get('position')?.trim() ?? '';
    const limit    = Math.min(Number(searchParams.get('limit')) || 100, 300);

    const supabase = await createClient();

    let query = supabase
      .from('nfbc_adp')
      .select('id, player_name, display_name, team, positions, adp, rank, value_delta, is_value_pick, auction_value')
      .ilike('sport', `%${sport}%`)
      .order('rank', { ascending: true })
      .limit(limit);

    if (position) {
      query = query.ilike('positions', `%${position}%`);
    }

    const { data: rawPlayers, error } = await query;

    if (error) {
      console.error('[API/dfs] nfbc_adp query error:', error.message);
      return NextResponse.json(
        { success: false, error: error.message, players: [], lineup: null },
        { status: HTTP_STATUS.INTERNAL_ERROR },
      );
    }

    // Enrich each player with salary, projectedPoints, value metrics
    const enriched: EnrichedPlayer[] = (rawPlayers ?? []).map(p => {
      const rank = p.rank ?? 200;
      const salary = rankToSalary(rank);
      const projectedPoints = estimateProjectedPoints(p);
      const value = salary > 0 ? parseFloat(((projectedPoints / salary) * 1000).toFixed(2)) : 0;
      const valueGrade = value >= 1.4 ? 'A' : value >= 1.3 ? 'B' : value >= 1.2 ? 'C' : value >= 1.1 ? 'D' : 'F';
      // Parse primary position (first in slash-delimited list)
      const primaryPosition = (p.positions as string)?.split(/[/,]/)[0]?.trim() ?? '';

      return {
        id: p.id,
        player_name: p.player_name,
        display_name: p.display_name,
        team: p.team,
        positions: p.positions,
        primaryPosition,
        adp: p.adp ?? 0,
        rank,
        value_delta: p.value_delta ?? 0,
        is_value_pick: p.is_value_pick ?? false,
        auction_value: p.auction_value ?? null,
        salary,
        site,
        projectedPoints,
        value,
        valueGrade,
      };
    });

    // Build optimal lineup
    const lineup = buildGreedyLineup(enriched, site);

    return NextResponse.json({
      success: true,
      players: enriched,
      lineup,
      count: enriched.length,
      sport,
      slate,
      site,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API/dfs] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        players: [],
        lineup: null,
        timestamp: new Date().toISOString(),
      },
      { status: HTTP_STATUS.INTERNAL_ERROR },
    );
  }
}
