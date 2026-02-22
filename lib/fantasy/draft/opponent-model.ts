/**
 * Heuristic Opponent Modeling Engine
 *
 * Predicts what each opponent will pick based on observable tendencies:
 * - Position bias (how they weight positions vs league average)
 * - Reach tendency (how far they deviate from ADP)
 * - Best-available adherence (how often they take the BPA)
 * - Risk tolerance, early QB bias, stacking preference
 *
 * Uses weighted heuristic scoring instead of ML (gradient boosted trees)
 * for TypeScript-native execution without external dependencies.
 */

import type {
  DraftPick,
  DraftState,
  OpponentProfile,
  OpponentPickPrediction,
  PlayerWithVBD,
  FantasyRoster,
} from '../types';

/**
 * Build an opponent profile from their draft history.
 */
export function buildOpponentProfile(
  teamId: string,
  teamName: string,
  picks: DraftPick[],
  allPicks: DraftPick[],
  playerRankings: Map<string, PlayerWithVBD>
): OpponentProfile {
  const teamPicks = picks.filter(p => p.teamId === teamId);

  // Calculate position bias
  const positionBias = calculatePositionBias(teamPicks, allPicks);

  // Calculate reach tendency
  const reachTendency = calculateReachTendency(teamPicks, playerRankings);

  // Calculate BPA adherence
  const bestAvailableAdherence = calculateBPAAdherence(teamPicks, allPicks, playerRankings);

  // Estimate risk tolerance from pick patterns
  const riskTolerance = estimateRiskTolerance(teamPicks, playerRankings);

  // Check for early QB bias
  const earlyQBBias = teamPicks.length >= 3
    ? teamPicks.slice(0, 5).filter(p => p.position === 'QB').length / Math.min(5, teamPicks.length)
    : 0.15;

  // Check for stacking (multiple players from same team)
  const stackingPreference = calculateStackingPreference(teamPicks);

  // Handcuff pattern
  const handcuffPattern = calculateHandcuffPattern(teamPicks);

  return {
    teamId,
    teamName,
    positionBias,
    reachTendency,
    bestAvailableAdherence,
    riskTolerance,
    earlyQBBias,
    stackingPreference,
    handcuffPattern,
    pickHistory: teamPicks,
  };
}

/**
 * Calculate how an opponent's position picks deviate from league average.
 */
function calculatePositionBias(
  teamPicks: DraftPick[],
  allPicks: DraftPick[]
): Record<string, number> {
  if (teamPicks.length === 0) {
    // Default distribution for unknown opponents
    return { QB: 0.12, RB: 0.30, WR: 0.30, TE: 0.12, K: 0.08, DEF: 0.08 };
  }

  const positionCounts: Record<string, number> = {};
  for (const pick of teamPicks) {
    positionCounts[pick.position] = (positionCounts[pick.position] || 0) + 1;
  }

  const bias: Record<string, number> = {};
  for (const [pos, count] of Object.entries(positionCounts)) {
    bias[pos] = count / teamPicks.length;
  }

  return bias;
}

/**
 * Calculate how far an opponent reaches beyond ADP.
 *
 * Positive = reaches (picks before ADP)
 * Negative = waits (picks after ADP)
 */
function calculateReachTendency(
  teamPicks: DraftPick[],
  playerRankings: Map<string, PlayerWithVBD>
): number {
  if (teamPicks.length === 0) return 0;

  let totalDeviation = 0;
  let counted = 0;

  for (const pick of teamPicks) {
    const ranking = playerRankings.get(pick.playerName);
    if (ranking && ranking.adp > 0) {
      totalDeviation += ranking.adp - pick.pickNumber;
      counted++;
    }
  }

  return counted > 0 ? totalDeviation / counted : 0;
}

/**
 * Calculate how often an opponent drafts the best player available by VBD.
 */
function calculateBPAAdherence(
  teamPicks: DraftPick[],
  allPicks: DraftPick[],
  playerRankings: Map<string, PlayerWithVBD>
): number {
  if (teamPicks.length === 0) return 0.5;

  let bpaCount = 0;

  for (const pick of teamPicks) {
    // Find who was best available at this pick number
    const pickedBefore = new Set(
      allPicks
        .filter(p => p.pickNumber < pick.pickNumber)
        .map(p => p.playerName)
    );

    const available = [...playerRankings.values()]
      .filter(p => !pickedBefore.has(p.playerName))
      .sort((a, b) => b.vbd - a.vbd);

    if (available.length > 0 && available[0].playerName === pick.playerName) {
      bpaCount++;
    }
  }

  return bpaCount / teamPicks.length;
}

/**
 * Estimate risk tolerance from tier patterns.
 * High risk = picks more upside players from lower tiers.
 */
function estimateRiskTolerance(
  teamPicks: DraftPick[],
  playerRankings: Map<string, PlayerWithVBD>
): number {
  if (teamPicks.length === 0) return 0.5;

  let totalTier = 0;
  let counted = 0;

  for (const pick of teamPicks) {
    const ranking = playerRankings.get(pick.playerName);
    if (ranking) {
      totalTier += ranking.tier;
      counted++;
    }
  }

  if (counted === 0) return 0.5;

  // Average tier: lower = safer picks, higher = riskier reaches
  const avgTier = totalTier / counted;
  return Math.min(1, avgTier / 5);
}

/**
 * Check if opponent stacks players from the same NFL team.
 */
function calculateStackingPreference(teamPicks: DraftPick[]): number {
  if (teamPicks.length < 3) return 0;

  // Would need team data to check this properly
  // For now, return 0 (no stacking detected without team info)
  return 0;
}

/**
 * Check if opponent handcuffs their RBs.
 */
function calculateHandcuffPattern(teamPicks: DraftPick[]): number {
  const rbPicks = teamPicks.filter(p => p.position === 'RB');
  if (rbPicks.length < 3) return 0;

  // Without team data, we estimate based on late RB picks following early ones
  const earlyRBs = rbPicks.filter(p => p.round <= 4).length;
  const lateRBs = rbPicks.filter(p => p.round >= 10).length;

  if (earlyRBs > 0 && lateRBs > 0) {
    return Math.min(1, lateRBs / earlyRBs);
  }

  return 0;
}

/**
 * Predict the next pick for a single opponent.
 *
 * Returns probability distribution over available players.
 */
export function predictOpponentPick(
  opponent: OpponentProfile,
  availablePlayers: PlayerWithVBD[],
  currentRound: number,
  currentRoster: FantasyRoster[]
): OpponentPickPrediction {
  const predictions: { playerName: string; position: string; probability: number }[] = [];

  // Calculate roster needs
  const positionCounts = new Map<string, number>();
  for (const roster of currentRoster) {
    positionCounts.set(roster.position, (positionCounts.get(roster.position) || 0) + 1);
  }

  for (const player of availablePlayers) {
    let score = 0;

    // 1. VBD weight (BPA tendency)
    const vbdNormalized = player.vbd / Math.max(1, availablePlayers[0]?.vbd || 1);
    score += vbdNormalized * opponent.bestAvailableAdherence * 3;

    // 2. Position bias weight
    const posBias = opponent.positionBias[player.position] || 0.1;
    score += posBias * 2;

    // 3. ADP alignment (opponents tend to pick near ADP)
    if (player.adp > 0) {
      const adpDiff = Math.abs(player.adp - (currentRound * 12));
      const adpScore = Math.max(0, 1 - adpDiff / 50);
      score += adpScore * (1 - Math.abs(opponent.reachTendency) / 20);
    }

    // 4. Roster need boost
    const currentAtPosition = positionCounts.get(player.position) || 0;
    if (currentAtPosition === 0 && currentRound >= 3) {
      score += 1.5; // Strong boost if they haven't drafted this position yet
    }

    // 5. QB timing factor
    if (player.position === 'QB') {
      if (currentRound <= 4) {
        score *= (1 + opponent.earlyQBBias);
      } else {
        const hasQB = (positionCounts.get('QB') || 0) > 0;
        if (!hasQB && currentRound >= 8) {
          score += 2; // Must-draft QB territory
        }
      }
    }

    // 6. Risk tolerance factor
    if (player.tier <= 2) {
      score *= (1 + (1 - opponent.riskTolerance) * 0.3); // Safe players get boost for low-risk opponents
    }

    predictions.push({
      playerName: player.playerName,
      position: player.position,
      probability: Math.max(0, score),
    });
  }

  // Normalize to probabilities
  const totalScore = predictions.reduce((s, p) => s + p.probability, 0);
  if (totalScore > 0) {
    for (const pred of predictions) {
      pred.probability = pred.probability / totalScore;
    }
  }

  // Sort by probability descending
  predictions.sort((a, b) => b.probability - a.probability);

  return {
    teamId: opponent.teamId,
    predictions: predictions.slice(0, 20), // Top 20 most likely picks
  };
}

/**
 * Build default opponent profiles when no history is available.
 *
 * Uses league-average tendencies for common draft archetypes.
 */
export function buildDefaultProfiles(
  teamIds: string[],
  teamNames: string[]
): OpponentProfile[] {
  const archetypes = [
    // BPA Drafter
    { bpa: 0.8, posBias: { QB: 0.10, RB: 0.30, WR: 0.30, TE: 0.12, K: 0.09, DEF: 0.09 }, risk: 0.3, qb: 0.1, reach: 0 },
    // Zero RB
    { bpa: 0.4, posBias: { QB: 0.10, RB: 0.15, WR: 0.45, TE: 0.12, K: 0.09, DEF: 0.09 }, risk: 0.6, qb: 0.1, reach: 3 },
    // Hero RB
    { bpa: 0.5, posBias: { QB: 0.10, RB: 0.35, WR: 0.30, TE: 0.08, K: 0.09, DEF: 0.08 }, risk: 0.5, qb: 0.1, reach: -2 },
    // Robust RB
    { bpa: 0.6, posBias: { QB: 0.08, RB: 0.40, WR: 0.25, TE: 0.10, K: 0.09, DEF: 0.08 }, risk: 0.2, qb: 0.05, reach: -1 },
    // Early QB
    { bpa: 0.5, posBias: { QB: 0.18, RB: 0.25, WR: 0.28, TE: 0.12, K: 0.09, DEF: 0.08 }, risk: 0.4, qb: 0.6, reach: 2 },
    // TE Premium
    { bpa: 0.5, posBias: { QB: 0.10, RB: 0.28, WR: 0.28, TE: 0.16, K: 0.09, DEF: 0.09 }, risk: 0.4, qb: 0.1, reach: 4 },
  ];

  return teamIds.map((id, index) => {
    const arch = archetypes[index % archetypes.length];
    return {
      teamId: id,
      teamName: teamNames[index] || `Team ${index + 1}`,
      positionBias: arch.posBias,
      reachTendency: arch.reach,
      bestAvailableAdherence: arch.bpa,
      riskTolerance: arch.risk,
      earlyQBBias: arch.qb,
      stackingPreference: 0,
      handcuffPattern: 0,
      pickHistory: [],
    };
  });
}

/**
 * Calculate opponent leverage for a specific player.
 *
 * Returns 0-1: probability that any opponent takes this player
 * before the user's next pick.
 */
export function calculateOpponentLeverage(
  playerName: string,
  opponentPredictions: OpponentPickPrediction[],
  picksUntilUserNext: number
): number {
  // Probability that NO opponent takes this player
  let survivalProb = 1;

  // Only consider the next N opponents who pick before the user
  const relevantPredictions = opponentPredictions.slice(0, picksUntilUserNext);

  for (const pred of relevantPredictions) {
    const playerPred = pred.predictions.find(p => p.playerName === playerName);
    const pickProb = playerPred?.probability || 0;
    survivalProb *= (1 - pickProb);
  }

  // Return probability that SOME opponent takes this player
  return 1 - survivalProb;
}
