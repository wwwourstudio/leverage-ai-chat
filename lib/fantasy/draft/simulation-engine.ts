/**
 * Monte Carlo Draft Simulation Engine
 *
 * Simulates a draft forward N times (default 1,000–5,000) to answer:
 * - What's the probability each player survives to my next pick?
 * - What's the expected VBD loss if I pass on a player now?
 * - What does my roster look like at the end of each simulation?
 *
 * Performance: 1,000 sims × 150 remaining players ≈ 150K operations → <2s in Node.js
 */

import type {
  DraftState,
  DraftSimulationResult,
  PlayerWithVBD,
  OpponentProfile,
  OpponentPickPrediction,
  FantasyRoster,
} from '../types';
import { predictOpponentPick } from './opponent-model';
import { FANTASY_CONFIG } from '@/lib/constants';

export interface SimulationConfig {
  numSimulations?: number;
  lookaheadPicks?: number;  // How many picks ahead to simulate (0 = until user's next pick)
}

export interface SimulationOutput {
  results: DraftSimulationResult[];
  userNextPick: number;
  picksUntilNext: number;
  simulationsRun: number;
  executionTimeMs: number;
}

/**
 * Run Monte Carlo forward simulations from the current draft state.
 *
 * For each simulation:
 * 1. Starting from current pick, simulate each opponent's selection
 *    using their profile's probability distribution + randomness
 * 2. Track which players are taken before user's next pick
 * 3. After N sims, aggregate survival probabilities
 */
export function simulateDraftForward(
  state: DraftState,
  opponentProfiles: OpponentProfile[],
  config: SimulationConfig = {}
): SimulationOutput {
  const startTime = Date.now();
  const {
    numSimulations = FANTASY_CONFIG.SIMULATION.DEFAULT_DRAFT_SIMS,
  } = config;

  const { currentPick, draftOrder, userTeamId, availablePlayers } = state;

  // Calculate user's next pick
  const userNextPick = findNextUserPick(currentPick, draftOrder, userTeamId);
  const picksUntilNext = userNextPick - currentPick;

  if (picksUntilNext <= 0 || availablePlayers.length === 0) {
    return {
      results: [],
      userNextPick: currentPick,
      picksUntilNext: 0,
      simulationsRun: 0,
      executionTimeMs: Date.now() - startTime,
    };
  }

  // Track how often each player survives across simulations
  const survivalCounts = new Map<string, number>();
  const pickedAtSum = new Map<string, number>();
  const pickedAtCount = new Map<string, number>();

  for (const player of availablePlayers) {
    survivalCounts.set(player.playerName, 0);
    pickedAtSum.set(player.playerName, 0);
    pickedAtCount.set(player.playerName, 0);
  }

  // Build opponent roster map for predictions
  const opponentRosters = buildOpponentRosters(state);
  const profileMap = new Map(opponentProfiles.map(p => [p.teamId, p]));

  // Run simulations
  for (let sim = 0; sim < numSimulations; sim++) {
    const takenInSim = new Set<string>();

    // Simulate each pick from current to user's next
    for (let pickOffset = 0; pickOffset < picksUntilNext; pickOffset++) {
      const pickNum = currentPick + pickOffset;
      const pickIndex = (pickNum - 1) % draftOrder.length;
      const teamId = draftOrder[pickIndex];

      // Skip if this is the user's team (shouldn't happen between picks)
      if (teamId === userTeamId) continue;

      // Get opponent profile
      const profile = profileMap.get(teamId);
      if (!profile) continue;

      // Get available players for this pick (minus already taken in this sim)
      const simAvailable = availablePlayers.filter(p => !takenInSim.has(p.playerName));
      if (simAvailable.length === 0) break;

      // Predict opponent's pick
      const roster = opponentRosters.get(teamId) || [];
      const prediction = predictOpponentPick(profile, simAvailable, getCurrentRound(pickNum, draftOrder.length), roster);

      // Sample from prediction distribution with randomness
      const selected = sampleFromPrediction(prediction, simAvailable);
      if (selected) {
        takenInSim.add(selected.playerName);
        pickedAtSum.set(
          selected.playerName,
          (pickedAtSum.get(selected.playerName) || 0) + pickNum
        );
        pickedAtCount.set(
          selected.playerName,
          (pickedAtCount.get(selected.playerName) || 0) + 1
        );
      }
    }

    // Count survivors (players NOT taken in this simulation)
    for (const player of availablePlayers) {
      if (!takenInSim.has(player.playerName)) {
        survivalCounts.set(
          player.playerName,
          (survivalCounts.get(player.playerName) || 0) + 1
        );
      }
    }
  }

  // Aggregate results
  const results: DraftSimulationResult[] = availablePlayers.map(player => {
    const survivals = survivalCounts.get(player.playerName) || 0;
    const survivalProb = survivals / numSimulations;
    const pickCount = pickedAtCount.get(player.playerName) || 0;
    const avgPickWhen = pickCount > 0
      ? (pickedAtSum.get(player.playerName) || 0) / pickCount
      : 0;

    // Expected VBD loss = VBD × probability of being taken
    const expectedVBDLoss = player.vbd * (1 - survivalProb);

    return {
      playerName: player.playerName,
      position: player.position,
      survivalProbability: Math.round(survivalProb * 1000) / 1000,
      expectedVBDLoss: Math.round(expectedVBDLoss * 100) / 100,
      pickedByOpponentPct: Math.round((1 - survivalProb) * 1000) / 10,
      avgPickWhenTaken: Math.round(avgPickWhen * 10) / 10,
    };
  });

  // Sort by expected VBD loss (highest loss = most urgent to draft now)
  results.sort((a, b) => b.expectedVBDLoss - a.expectedVBDLoss);

  return {
    results,
    userNextPick,
    picksUntilNext,
    simulationsRun: numSimulations,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Find the user's next pick number given the current pick.
 */
function findNextUserPick(
  currentPick: number,
  draftOrder: string[],
  userTeamId: string
): number {
  const leagueSize = draftOrder.length;

  // Search forward from current pick
  for (let pick = currentPick + 1; pick <= leagueSize * 20; pick++) {
    const pickIndex = getSnakePickIndex(pick, leagueSize);
    if (draftOrder[pickIndex] === userTeamId) {
      return pick;
    }
  }

  return currentPick + leagueSize; // Fallback: assume next round
}

/**
 * Get the draft order index for a pick number in a snake draft.
 *
 * Snake draft: Round 1 goes 1→12, Round 2 goes 12→1, Round 3 goes 1→12, etc.
 */
function getSnakePickIndex(pickNumber: number, leagueSize: number): number {
  const round = Math.ceil(pickNumber / leagueSize);
  const positionInRound = ((pickNumber - 1) % leagueSize);

  if (round % 2 === 1) {
    // Odd rounds: forward order
    return positionInRound;
  } else {
    // Even rounds: reverse order
    return leagueSize - 1 - positionInRound;
  }
}

/**
 * Get the current round number for a pick.
 */
function getCurrentRound(pickNumber: number, leagueSize: number): number {
  return Math.ceil(pickNumber / leagueSize);
}

/**
 * Sample a player selection from an opponent's prediction distribution.
 *
 * Uses weighted random sampling with some noise to prevent determinism.
 */
function sampleFromPrediction(
  prediction: OpponentPickPrediction,
  available: PlayerWithVBD[]
): PlayerWithVBD | null {
  const preds = prediction.predictions;
  if (preds.length === 0) {
    // Fallback: pick a random player from top available
    return available.length > 0 ? available[Math.floor(Math.random() * Math.min(5, available.length))] : null;
  }

  const availableNames = new Set(available.map(p => p.playerName));
  const validPreds = preds.filter(p => availableNames.has(p.playerName));

  if (validPreds.length === 0) {
    return available.length > 0 ? available[Math.floor(Math.random() * Math.min(5, available.length))] : null;
  }

  // Add noise to probabilities (±20%) to create variance across simulations
  const noisyPreds = validPreds.map(p => ({
    ...p,
    probability: p.probability * (0.8 + Math.random() * 0.4),
  }));

  // Normalize
  const total = noisyPreds.reduce((s, p) => s + p.probability, 0);
  if (total <= 0) return available[0];

  // Weighted random selection
  let roll = Math.random() * total;
  for (const pred of noisyPreds) {
    roll -= pred.probability;
    if (roll <= 0) {
      return available.find(p => p.playerName === pred.playerName) || null;
    }
  }

  // Fallback to top prediction
  return available.find(p => p.playerName === validPreds[0].playerName) || null;
}

/**
 * Build current roster map for all opponents from draft picks.
 */
function buildOpponentRosters(state: DraftState): Map<string, FantasyRoster[]> {
  const rosters = new Map<string, FantasyRoster[]>();

  for (const pick of state.picks) {
    const existing = rosters.get(pick.teamId) || [];
    existing.push({
      id: pick.id,
      teamId: pick.teamId,
      playerName: pick.playerName,
      position: pick.position,
      rosterSlot: pick.position,
      acquisitionType: 'draft',
      acquisitionCost: pick.pickNumber,
      addedAt: pick.pickedAt,
    });
    rosters.set(pick.teamId, existing);
  }

  return rosters;
}

/**
 * Generate the full snake draft order for a league.
 *
 * Returns an array of team IDs in pick order for all rounds.
 */
export function generateSnakeDraftOrder(
  teamIds: string[],
  totalRounds: number
): string[] {
  const order: string[] = [];
  const leagueSize = teamIds.length;

  for (let round = 1; round <= totalRounds; round++) {
    if (round % 2 === 1) {
      // Odd rounds: forward
      for (let i = 0; i < leagueSize; i++) {
        order.push(teamIds[i]);
      }
    } else {
      // Even rounds: reverse
      for (let i = leagueSize - 1; i >= 0; i--) {
        order.push(teamIds[i]);
      }
    }
  }

  return order;
}

/**
 * Quick simulation: just estimate survival probability without full Monte Carlo.
 *
 * Uses ADP-based heuristic for fast results (~1ms).
 * Useful for UI preview before running full simulation.
 */
export function quickSurvivalEstimate(
  player: PlayerWithVBD,
  currentPick: number,
  userNextPick: number,
  leagueSize: number
): number {
  if (player.adp <= 0) return 0.5;

  const picksUntilUser = userNextPick - currentPick;
  const adpDistance = player.adp - currentPick;

  if (adpDistance <= 0) {
    // Already past ADP — high chance of being taken
    return Math.max(0.05, 0.3 + adpDistance * 0.05);
  }

  if (adpDistance >= picksUntilUser * 2) {
    // ADP is well past our next pick — very likely to survive
    return 0.95;
  }

  // Linear interpolation based on ADP distance vs picks until our turn
  const ratio = adpDistance / picksUntilUser;
  return Math.min(0.95, Math.max(0.05, ratio * 0.8));
}
