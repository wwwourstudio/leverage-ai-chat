/**
 * Live Line Movement Tracker
 * Analyzes line movement strength and direction
 */

import type { LineSnapshot } from '../sharp/detectSharpMoney';

export interface LineMovementAnalysis {
  openingPrice: number;
  currentPrice: number;
  percentChange: number;
  movementStrength: "weak" | "moderate" | "strong";
}

/**
 * Analyze line movement from historical snapshots
 * @param history - Array of line snapshots
 * @returns Analysis of line movement or null if insufficient data
 */
export function analyzeLineMovement(
  history: LineSnapshot[]
): LineMovementAnalysis | null {
  // Require at least 2 snapshots
  if (history.length < 2) {
    return null;
  }
  
  // Sort by timestamp to ensure chronological order
  const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
  
  const openingPrice = sortedHistory[0].price;
  const currentPrice = sortedHistory[sortedHistory.length - 1].price;
  
  // Calculate percent change
  const percentChange = ((currentPrice - openingPrice) / openingPrice) * 100;
  
  // Classify movement strength based on absolute percent change
  const absPercentChange = Math.abs(percentChange);
  
  let movementStrength: "weak" | "moderate" | "strong";
  
  if (absPercentChange < 1) {
    movementStrength = "weak";
  } else if (absPercentChange <= 3) {
    movementStrength = "moderate";
  } else {
    movementStrength = "strong";
  }
  
  return {
    openingPrice,
    currentPrice,
    percentChange,
    movementStrength,
  };
}
