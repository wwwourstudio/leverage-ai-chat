/**
 * Draft Utility Scoring Function
 *
 * Combines all draft intelligence signals into a single utility score
 * that drives pick recommendations:
 *
 * U(player) = VBD × Scarcity_Weight × Roster_Fit × Survival_Factor - Opponent_Leverage
 *
 * This is the "brain" that synthesizes VBD, tier cliffs, opponent modeling,
 * Monte Carlo simulations, and roster construction into one actionable ranking.
 */

import type {
  DraftState,
  DraftRecommendation,
  DraftSimulationResult,
  PlayerWithVBD,
  OpponentProfile,
  FantasyRoster,
  TierCliff,
} from '../types';
import { getRosterFitScore } from './roster-evaluator';
import { calculateOpponentLeverage } from './opponent-model';
import { calculateCliffUrgency } from './tier-cliff-detector';
import type { OpponentPickPrediction } from '../types';

export interface UtilityConfig {
  vbdWeight?: number;
  scarcityWeight?: number;
  rosterFitWeight?: number;
  survivalWeight?: number;
  opponentLeverageWeight?: number;
  cliffUrgencyWeight?: number;
}

const DEFAULT_WEIGHTS: Required<UtilityConfig> = {
  vbdWeight: 1.0,
  scarcityWeight: 0.8,
  rosterFitWeight: 0.6,
  survivalWeight: 0.7,
  opponentLeverageWeight: 0.5,
  cliffUrgencyWeight: 0.4,
};

/**
 * Calculate utility score for each available player and return ranked recommendations.
 *
 * This is the primary entry point for draft pick advice.
 */
export function calculateDraftRecommendations(
  state: DraftState,
  simulationResults: DraftSimulationResult[],
  opponentPredictions: OpponentPickPrediction[],
  tierCliffs: TierCliff[],
  config: UtilityConfig = {}
): DraftRecommendation[] {
  const weights = { ...DEFAULT_WEIGHTS, ...config };
  const { availablePlayers, userTeamId, draftOrder, currentPick } = state;

  // Get user's current roster
  const userRoster = getUserRoster(state);

  // Get user's roster slots config
  const rosterSlots = getRosterSlotsFromState(state);

  // Build simulation lookup
  const simMap = new Map(simulationResults.map(r => [r.playerName, r]));

  // Calculate cliff urgency per position
  const cliffUrgency = calculateCliffUrgency(availablePlayers, tierCliffs);

  // Calculate picks until user's next turn
  const picksUntilNext = findPicksUntilNext(currentPick, draftOrder, userTeamId);

  // Normalize VBD for scoring
  const maxVBD = Math.max(1, ...availablePlayers.map(p => Math.abs(p.vbd)));

  const recommendations: DraftRecommendation[] = [];

  for (const player of availablePlayers) {
    const sim = simMap.get(player.playerName);

    // 1. Normalized VBD
    const normalizedVBD = player.vbd / maxVBD;

    // 2. Positional scarcity
    const scarcity = player.scarcityScore;

    // 3. Roster fit
    const rosterFit = getRosterFitScore(player.position, userRoster, rosterSlots);

    // 4. Survival factor (urgency when player likely to be taken)
    const survivalProb = sim?.survivalProbability ?? 0.5;
    const survivalFactor = 1 - survivalProb; // Higher when likely to be taken

    // 5. Opponent leverage
    const opponentLeverage = calculateOpponentLeverage(
      player.playerName,
      opponentPredictions,
      picksUntilNext
    );

    // 6. Cliff urgency for this position
    const posCliffUrgency = cliffUrgency.get(player.position) || 0;

    // Combined utility score
    const utility =
      normalizedVBD * weights.vbdWeight +
      scarcity * weights.scarcityWeight +
      rosterFit * weights.rosterFitWeight +
      survivalFactor * weights.survivalWeight +
      posCliffUrgency * weights.cliffUrgencyWeight -
      opponentLeverage * weights.opponentLeverageWeight;

    // Expected VBD loss (regret if we pass)
    const regretScore = sim?.expectedVBDLoss ?? player.vbd * 0.5;

    // Generate reasoning
    const reasoning = generateReasoning(
      player, survivalProb, rosterFit, opponentLeverage, posCliffUrgency, regretScore
    );

    recommendations.push({
      playerName: player.playerName,
      position: player.position,
      utility: Math.round(utility * 1000) / 1000,
      vbd: player.vbd,
      survivalProbability: survivalProb,
      regretScore,
      rosterFitScore: rosterFit,
      scarcityWeight: scarcity,
      opponentLeverage,
      reasoning,
      rank: 0,
    });
  }

  // Sort by utility descending and assign ranks
  recommendations.sort((a, b) => b.utility - a.utility);
  for (let i = 0; i < recommendations.length; i++) {
    recommendations[i].rank = i + 1;
  }

  return recommendations;
}

/**
 * Get the top N recommendations (best pick + leverage picks).
 */
export function getTopRecommendations(
  recommendations: DraftRecommendation[],
  count: number = 4
): {
  bestPick: DraftRecommendation;
  leveragePicks: DraftRecommendation[];
} {
  if (recommendations.length === 0) {
    throw new Error('No recommendations available');
  }

  const bestPick = recommendations[0];

  // Leverage picks: next best at DIFFERENT positions than the best pick
  const leveragePicks = recommendations
    .slice(1)
    .filter(r => r.position !== bestPick.position)
    .slice(0, count - 1);

  // If we don't have enough diverse positions, fill with next best overall
  if (leveragePicks.length < count - 1) {
    const remaining = recommendations
      .slice(1)
      .filter(r => !leveragePicks.some(lp => lp.playerName === r.playerName))
      .slice(0, count - 1 - leveragePicks.length);
    leveragePicks.push(...remaining);
  }

  return { bestPick, leveragePicks };
}

/**
 * Generate human-readable reasoning for a recommendation.
 */
function generateReasoning(
  player: PlayerWithVBD,
  survivalProb: number,
  rosterFit: number,
  opponentLeverage: number,
  cliffUrgency: number,
  regretScore: number
): string {
  const parts: string[] = [];

  // VBD context
  if (player.overallRank <= 3) {
    parts.push(`Elite overall value (Rank #${player.overallRank})`);
  } else if (player.positionRank <= 3) {
    parts.push(`Top-${player.positionRank} ${player.position}`);
  }

  // Survival urgency
  if (survivalProb < 0.3) {
    parts.push(`${Math.round((1 - survivalProb) * 100)}% chance taken before your next pick`);
  } else if (survivalProb > 0.8) {
    parts.push(`Likely available next round (${Math.round(survivalProb * 100)}% survival)`);
  }

  // Roster fit
  if (rosterFit >= 0.85) {
    parts.push('Fills a starting roster need');
  } else if (rosterFit <= 0.4) {
    parts.push('Redundant position — low roster impact');
  }

  // Opponent leverage
  if (opponentLeverage > 0.6) {
    parts.push(`High opponent demand (${Math.round(opponentLeverage * 100)}% leverage)`);
  }

  // Tier cliff
  if (cliffUrgency >= 0.7) {
    parts.push(`${player.position} tier cliff approaching — act now`);
  }

  // Regret score
  if (regretScore > player.vbd * 0.7) {
    parts.push('High regret if passed — significant VBD loss expected');
  }

  return parts.length > 0 ? parts.join('. ') + '.' : `Solid ${player.position} option with ${player.vbd.toFixed(1)} VBD.`;
}

/**
 * Get the user's current roster from draft state.
 */
function getUserRoster(state: DraftState): FantasyRoster[] {
  return state.picks
    .filter(p => p.teamId === state.userTeamId)
    .map(p => ({
      id: p.id,
      teamId: p.teamId,
      playerName: p.playerName,
      position: p.position,
      rosterSlot: p.position,
      acquisitionType: 'draft' as const,
      acquisitionCost: p.pickNumber,
      addedAt: p.pickedAt,
    }));
}

/**
 * Extract roster slots configuration from draft state.
 */
function getRosterSlotsFromState(state: DraftState): Record<string, number> {
  // Calculate from total rounds and league setup
  // Default NFL roster
  return {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1,
    K: 1,
    DEF: 1,
    BENCH: Math.max(0, state.totalRounds - 9),
  };
}

/**
 * Count picks between current and user's next pick.
 */
function findPicksUntilNext(
  currentPick: number,
  draftOrder: string[],
  userTeamId: string
): number {
  const leagueSize = draftOrder.length;

  for (let offset = 1; offset <= leagueSize * 2; offset++) {
    const pickNum = currentPick + offset;
    const round = Math.ceil(pickNum / leagueSize);
    const posInRound = (pickNum - 1) % leagueSize;
    const index = round % 2 === 1 ? posInRound : leagueSize - 1 - posInRound;

    if (draftOrder[index] === userTeamId) {
      return offset;
    }
  }

  return leagueSize; // Fallback
}
