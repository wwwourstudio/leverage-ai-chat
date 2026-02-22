/**
 * Roster Construction Evaluator
 *
 * Grades a fantasy team's roster based on:
 * - Positional balance (starter slots filled vs bench-heavy)
 * - Starter strength (sum of starter VBD)
 * - Bench depth (quality of backups)
 * - Ceiling/floor analysis
 * - Bye week conflicts
 * - Handcuff coverage
 */

import type {
  FantasyRoster,
  PlayerWithVBD,
  RosterSlots,
  RosterGrade,
  FantasySport,
} from '../types';

interface RosterContext {
  rosters: FantasyRoster[];
  playerRankings: Map<string, PlayerWithVBD>;
  rosterSlots: RosterSlots;
  sport: FantasySport;
  byeWeeks?: Map<string, number>;   // player -> bye week number
  handcuffMap?: Map<string, string>; // starter RB -> handcuff RB
}

/**
 * Evaluate a team's roster and return a comprehensive grade.
 */
export function evaluateRoster(context: RosterContext): RosterGrade {
  const {
    rosters,
    playerRankings,
    rosterSlots,
  } = context;

  const positionalBalance = gradePositionalBalance(rosters, rosterSlots);
  const starterStrength = gradeStarterStrength(rosters, playerRankings, rosterSlots);
  const benchDepth = gradeBenchDepth(rosters, playerRankings, rosterSlots);
  const { ceiling: ceilingScore, floor: floorScore } = gradeCeilingFloor(rosters, playerRankings);
  const byeConflicts = countByeWeekConflicts(rosters, context.byeWeeks);
  const handcuffCov = gradeHandcuffCoverage(rosters, context.handcuffMap);

  // Weighted overall score
  const overallScore = Math.round(
    positionalBalance * 0.20 +
    starterStrength * 0.35 +
    benchDepth * 0.15 +
    ceilingScore * 0.10 +
    floorScore * 0.10 +
    Math.max(0, 100 - byeConflicts * 10) * 0.05 +
    handcuffCov * 0.05
  );

  const { weakPositions, strongPositions } = identifyStrengthsWeaknesses(
    rosters, playerRankings, rosterSlots
  );

  const recommendations = generateRecommendations(
    rosters, playerRankings, rosterSlots, weakPositions, byeConflicts
  );

  return {
    overall: scoreToGrade(overallScore),
    overallScore,
    positionalBalance,
    starterStrength,
    benchDepth,
    ceilingScore,
    floorScore,
    byeWeekConflicts: byeConflicts,
    handcuffCoverage: handcuffCov,
    weakPositions,
    strongPositions,
    recommendations,
  };
}

/**
 * Grade positional balance: are starter slots filled appropriately?
 */
function gradePositionalBalance(
  rosters: FantasyRoster[],
  rosterSlots: RosterSlots
): number {
  let filledStarters = 0;
  let totalStarters = 0;

  for (const [position, count] of Object.entries(rosterSlots)) {
    if (position === 'BENCH') continue;
    totalStarters += count;

    const playersAtPosition = rosters.filter(r =>
      r.position === position || r.rosterSlot.startsWith(position)
    ).length;

    filledStarters += Math.min(playersAtPosition, count);
  }

  if (totalStarters === 0) return 50;
  return Math.round((filledStarters / totalStarters) * 100);
}

/**
 * Grade starter strength: how good are the players in starting slots?
 */
function gradeStarterStrength(
  rosters: FantasyRoster[],
  playerRankings: Map<string, PlayerWithVBD>,
  rosterSlots: RosterSlots
): number {
  let totalVBD = 0;
  let starterCount = 0;

  for (const roster of rosters) {
    if (roster.rosterSlot.includes('BENCH')) continue;

    const ranking = playerRankings.get(roster.playerName);
    if (ranking) {
      totalVBD += ranking.vbd;
      starterCount++;
    }
  }

  if (starterCount === 0) return 0;

  // Normalize: average VBD of ~30 = 50 score, ~60 = 80 score, ~100 = 100 score
  const avgVBD = totalVBD / starterCount;
  return Math.min(100, Math.round(avgVBD * 1.2 + 20));
}

/**
 * Grade bench depth: quality and position coverage of bench players.
 */
function gradeBenchDepth(
  rosters: FantasyRoster[],
  playerRankings: Map<string, PlayerWithVBD>,
  rosterSlots: RosterSlots
): number {
  const benchPlayers = rosters.filter(r => r.rosterSlot.includes('BENCH'));

  if (benchPlayers.length === 0) return 0;

  // Check position diversity on bench
  const benchPositions = new Set(benchPlayers.map(p => p.position));
  const starterPositions = new Set(
    Object.keys(rosterSlots).filter(p => p !== 'BENCH' && p !== 'FLEX' && p !== 'SUPERFLEX')
  );
  const coverageRatio = benchPositions.size / Math.max(starterPositions.size, 1);

  // Check bench player quality
  let totalBenchRank = 0;
  for (const player of benchPlayers) {
    const ranking = playerRankings.get(player.playerName);
    if (ranking) {
      // Lower position rank = better player
      totalBenchRank += Math.max(0, 50 - ranking.positionRank);
    }
  }

  const qualityScore = Math.min(100, totalBenchRank / benchPlayers.length * 3);
  const diversityScore = coverageRatio * 100;

  return Math.round(qualityScore * 0.6 + diversityScore * 0.4);
}

/**
 * Grade ceiling and floor potential.
 */
function gradeCeilingFloor(
  rosters: FantasyRoster[],
  playerRankings: Map<string, PlayerWithVBD>
): { ceiling: number; floor: number } {
  let totalProjection = 0;
  let playerCount = 0;
  let highCeilingCount = 0;

  for (const roster of rosters) {
    if (roster.rosterSlot.includes('BENCH')) continue;
    const ranking = playerRankings.get(roster.playerName);
    if (ranking) {
      totalProjection += ranking.projectedPoints;
      playerCount++;
      // Top-tier players at their position have high ceilings
      if (ranking.tier <= 2) {
        highCeilingCount++;
      }
    }
  }

  if (playerCount === 0) return { ceiling: 0, floor: 0 };

  // Ceiling score: based on how many elite-tier starters you have
  const ceiling = Math.min(100, Math.round((highCeilingCount / playerCount) * 100 * 1.5));

  // Floor score: based on total projected points (high floor = consistent)
  const avgProjection = totalProjection / playerCount;
  const floor = Math.min(100, Math.round(avgProjection * 0.8));

  return { ceiling, floor };
}

/**
 * Count bye week conflicts (multiple starters sharing the same bye).
 */
function countByeWeekConflicts(
  rosters: FantasyRoster[],
  byeWeeks?: Map<string, number>
): number {
  if (!byeWeeks) return 0;

  const starterByes = new Map<number, number>();
  for (const roster of rosters) {
    if (roster.rosterSlot.includes('BENCH')) continue;
    const bye = byeWeeks.get(roster.playerName);
    if (bye) {
      starterByes.set(bye, (starterByes.get(bye) || 0) + 1);
    }
  }

  // Count weeks where 3+ starters share a bye
  let conflicts = 0;
  for (const [, count] of starterByes) {
    if (count >= 3) conflicts++;
  }

  return conflicts;
}

/**
 * Grade handcuff coverage for RBs.
 */
function gradeHandcuffCoverage(
  rosters: FantasyRoster[],
  handcuffMap?: Map<string, string>
): number {
  if (!handcuffMap || handcuffMap.size === 0) return 50;

  const rosterNames = new Set(rosters.map(r => r.playerName));
  const startingRBs = rosters.filter(r =>
    r.position === 'RB' && !r.rosterSlot.includes('BENCH')
  );

  if (startingRBs.length === 0) return 50;

  let cuffed = 0;
  for (const rb of startingRBs) {
    const handcuff = handcuffMap.get(rb.playerName);
    if (handcuff && rosterNames.has(handcuff)) {
      cuffed++;
    }
  }

  return Math.round((cuffed / startingRBs.length) * 100);
}

/**
 * Identify strong and weak positions.
 */
function identifyStrengthsWeaknesses(
  rosters: FantasyRoster[],
  playerRankings: Map<string, PlayerWithVBD>,
  rosterSlots: RosterSlots
): { weakPositions: string[]; strongPositions: string[] } {
  const weakPositions: string[] = [];
  const strongPositions: string[] = [];

  for (const [position, count] of Object.entries(rosterSlots)) {
    if (position === 'BENCH' || position === 'FLEX' || position === 'SUPERFLEX') continue;

    const starters = rosters
      .filter(r => r.position === position && !r.rosterSlot.includes('BENCH'))
      .map(r => playerRankings.get(r.playerName))
      .filter(Boolean) as PlayerWithVBD[];

    if (starters.length < count) {
      weakPositions.push(position);
      continue;
    }

    const avgTier = starters.reduce((s, p) => s + p.tier, 0) / starters.length;
    if (avgTier <= 2) {
      strongPositions.push(position);
    } else if (avgTier >= 4) {
      weakPositions.push(position);
    }
  }

  return { weakPositions, strongPositions };
}

/**
 * Generate actionable recommendations for roster improvement.
 */
function generateRecommendations(
  rosters: FantasyRoster[],
  playerRankings: Map<string, PlayerWithVBD>,
  rosterSlots: RosterSlots,
  weakPositions: string[],
  byeConflicts: number
): string[] {
  const recommendations: string[] = [];

  // Recommend targeting weak positions
  for (const pos of weakPositions) {
    recommendations.push(`Target ${pos} upgrade — currently a weak spot on your roster`);
  }

  // Bye week warnings
  if (byeConflicts > 0) {
    recommendations.push(
      `${byeConflicts} week(s) with 3+ starters on bye — consider diversifying`
    );
  }

  // Check if bench is too position-heavy
  const benchPlayers = rosters.filter(r => r.rosterSlot.includes('BENCH'));
  const benchPositionCounts = new Map<string, number>();
  for (const p of benchPlayers) {
    benchPositionCounts.set(p.position, (benchPositionCounts.get(p.position) || 0) + 1);
  }

  for (const [pos, count] of benchPositionCounts) {
    const starterSlots = rosterSlots[pos] || 0;
    if (count > starterSlots + 1) {
      recommendations.push(
        `${count} ${pos}s on bench — consider trading depth for upgrades elsewhere`
      );
    }
  }

  return recommendations.slice(0, 5);
}

/**
 * Convert numeric score to letter grade.
 */
function scoreToGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D+';
  if (score >= 45) return 'D';
  if (score >= 40) return 'D-';
  return 'F';
}

/**
 * Get roster fit score for a potential draft pick.
 *
 * Returns 0-1:
 *  1.0 = fills an empty starter slot
 *  0.7 = bench player at a thin position
 *  0.4 = redundant pick at a deep position
 */
export function getRosterFitScore(
  playerPosition: string,
  currentRoster: FantasyRoster[],
  rosterSlots: RosterSlots
): number {
  const starterSlots = rosterSlots[playerPosition] || 0;
  const flexSlots = rosterSlots['FLEX'] || 0;
  const currentStarters = currentRoster.filter(r =>
    r.position === playerPosition && !r.rosterSlot.includes('BENCH')
  ).length;
  const currentBench = currentRoster.filter(r =>
    r.position === playerPosition && r.rosterSlot.includes('BENCH')
  ).length;

  // Fills an empty starter slot
  if (currentStarters < starterSlots) {
    return 1.0;
  }

  // Could fill a FLEX slot (if eligible)
  const flexEligible = ['RB', 'WR', 'TE'].includes(playerPosition);
  const currentFlexUsers = currentRoster.filter(r =>
    r.rosterSlot === 'FLEX'
  ).length;

  if (flexEligible && currentFlexUsers < flexSlots) {
    return 0.85;
  }

  // Bench depth at a position with 0-1 bench players
  if (currentBench < 1) {
    return 0.7;
  }

  // Already deep at this position
  if (currentBench >= 2) {
    return 0.3;
  }

  return 0.5;
}
