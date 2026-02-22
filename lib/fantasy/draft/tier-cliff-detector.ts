/**
 * Dynamic Tier Cliff Detector
 *
 * Detects sharp drop-offs in player projection curves using first-derivative
 * analysis. When dProjection/dRank spikes sharply (exceeds z-score threshold),
 * it signals a tier cliff — meaning the next player is significantly worse.
 *
 * This drives draft urgency: "Take this position NOW before the cliff."
 */

import type { PlayerWithVBD, TierCliff, TierAssignment } from '../types';
import { FANTASY_CONFIG } from '@/lib/constants';

export interface CliffDetectionConfig {
  zThreshold?: number;       // Z-score threshold for cliff detection (default: 1.5)
  minPlayersPerTier?: number; // Minimum players to form a tier (default: 2)
  maxTiers?: number;          // Maximum tiers per position (default: 10)
}

/**
 * Detect tier cliffs in a ranked player list.
 *
 * Algorithm:
 * 1. Group players by position, sorted by projected points DESC
 * 2. Calculate first derivative: dPoints/dRank for consecutive players
 * 3. Compute mean and std dev of the derivative
 * 4. Flag points where |derivative| > mean + zThreshold * stdDev
 * 5. Return cliff locations with context
 */
export function detectTierCliffs(
  players: PlayerWithVBD[],
  config: CliffDetectionConfig = {}
): TierCliff[] {
  const {
    zThreshold = FANTASY_CONFIG.DRAFT.TIER_CLIFF_Z_THRESHOLD,
    minPlayersPerTier = 2,
    maxTiers = 10,
  } = config;

  const cliffs: TierCliff[] = [];

  // Group by position
  const byPosition = new Map<string, PlayerWithVBD[]>();
  for (const player of players) {
    const group = byPosition.get(player.position) || [];
    group.push(player);
    byPosition.set(player.position, group);
  }

  for (const [position, posPlayers] of byPosition) {
    // Sort by projected points descending
    const sorted = [...posPlayers].sort((a, b) => b.projectedPoints - a.projectedPoints);

    if (sorted.length < 3) continue;

    // Calculate derivatives (point drops between consecutive players)
    const derivatives: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      derivatives.push(sorted[i - 1].projectedPoints - sorted[i].projectedPoints);
    }

    // Calculate statistics
    const mean = derivatives.reduce((s, d) => s + d, 0) / derivatives.length;
    const variance = derivatives.reduce((s, d) => s + (d - mean) ** 2, 0) / derivatives.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) continue;

    // Find cliffs where derivative z-score exceeds threshold
    let tierCount = 1;
    for (let i = 0; i < derivatives.length && tierCount < maxTiers; i++) {
      const zScore = (derivatives[i] - mean) / stdDev;

      if (zScore >= zThreshold) {
        // Check minimum players in current tier
        const playersInTier = i + 1 - (cliffs.filter(c => c.position === position).length > 0
          ? cliffs.filter(c => c.position === position).slice(-1)[0].cliffAfterRank
          : 0);

        if (playersInTier < minPlayersPerTier) continue;

        const cliffPlayer = sorted[i];
        const nextPlayer = sorted[i + 1];
        tierCount++;

        cliffs.push({
          position,
          tierNumber: tierCount - 1,
          cliffAfterRank: i + 1,
          cliffPlayerName: cliffPlayer.playerName,
          projectionDrop: derivatives[i],
          dropPercentage: (derivatives[i] / cliffPlayer.projectedPoints) * 100,
          slopeZScore: zScore,
          playersAbove: sorted.slice(Math.max(0, i - 2), i + 1).map(p => p.playerName),
          playersBelow: sorted.slice(i + 1, Math.min(sorted.length, i + 4)).map(p => p.playerName),
        });
      }
    }
  }

  // Sort by z-score descending (most significant cliffs first)
  return cliffs.sort((a, b) => b.slopeZScore - a.slopeZScore);
}

/**
 * Get active tier cliffs — cliffs that affect currently available players.
 * Useful during a live draft to highlight urgency.
 */
export function getActiveCliffs(
  cliffs: TierCliff[],
  availablePlayers: PlayerWithVBD[]
): TierCliff[] {
  const availableNames = new Set(availablePlayers.map(p => p.playerName));

  return cliffs.filter(cliff => {
    // Cliff is active if there are available players both above and below it
    const hasAbove = cliff.playersAbove.some(name => availableNames.has(name));
    const hasBelow = cliff.playersBelow.some(name => availableNames.has(name));
    return hasAbove && hasBelow;
  });
}

/**
 * Assign players to tiers based on detected cliffs.
 */
export function assignPlayerTiers(
  players: PlayerWithVBD[],
  cliffs: TierCliff[]
): TierAssignment[] {
  const assignments: TierAssignment[] = [];

  // Group by position
  const byPosition = new Map<string, PlayerWithVBD[]>();
  for (const player of players) {
    const group = byPosition.get(player.position) || [];
    group.push(player);
    byPosition.set(player.position, group);
  }

  for (const [position, posPlayers] of byPosition) {
    const sorted = [...posPlayers].sort((a, b) => b.projectedPoints - a.projectedPoints);
    const posCliffs = cliffs
      .filter(c => c.position === position)
      .sort((a, b) => a.cliffAfterRank - b.cliffAfterRank);

    let currentTier = 1;
    let cliffIndex = 0;

    for (let i = 0; i < sorted.length; i++) {
      // Check if we've passed a cliff boundary
      if (cliffIndex < posCliffs.length && i >= posCliffs[cliffIndex].cliffAfterRank) {
        currentTier++;
        cliffIndex++;
      }

      assignments.push({
        playerName: sorted[i].playerName,
        position,
        tier: currentTier,
        projectedPoints: sorted[i].projectedPoints,
        positionRank: i + 1,
      });
    }
  }

  return assignments;
}

/**
 * Generate a human-readable cliff alert message.
 */
export function formatCliffAlert(cliff: TierCliff): string {
  const dropPct = cliff.dropPercentage.toFixed(1);
  const above = cliff.playersAbove.slice(-1)[0] || 'N/A';
  const below = cliff.playersBelow[0] || 'N/A';

  return `${cliff.position} Tier ${cliff.tierNumber} Cliff: ` +
    `${dropPct}% drop after ${above}. ` +
    `Next available: ${below} (${cliff.projectionDrop.toFixed(1)} pts lower)`;
}

/**
 * Calculate positional urgency based on cliff proximity.
 *
 * Returns a 0-1 score per position:
 *  - 1.0 = tier cliff is imminent (1-2 players left in tier)
 *  - 0.5 = cliff is approaching (3-4 players left)
 *  - 0.0 = no significant cliff nearby
 */
export function calculateCliffUrgency(
  availablePlayers: PlayerWithVBD[],
  cliffs: TierCliff[]
): Map<string, number> {
  const urgencyMap = new Map<string, number>();

  // Group available players by position
  const byPosition = new Map<string, PlayerWithVBD[]>();
  for (const player of availablePlayers) {
    const group = byPosition.get(player.position) || [];
    group.push(player);
    byPosition.set(player.position, group);
  }

  for (const [position, posPlayers] of byPosition) {
    const activeCliffs = cliffs.filter(c => c.position === position);
    if (activeCliffs.length === 0) {
      urgencyMap.set(position, 0);
      continue;
    }

    // Count how many available players are above the nearest cliff
    const nearestCliff = activeCliffs[0];
    const aboveCliff = posPlayers.filter(p =>
      nearestCliff.playersAbove.includes(p.playerName)
    ).length;

    // Urgency inversely proportional to players remaining above cliff
    if (aboveCliff <= 1) {
      urgencyMap.set(position, 1.0);
    } else if (aboveCliff <= 3) {
      urgencyMap.set(position, 0.7);
    } else if (aboveCliff <= 5) {
      urgencyMap.set(position, 0.4);
    } else {
      urgencyMap.set(position, 0.1);
    }
  }

  return urgencyMap;
}
