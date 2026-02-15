/**
 * Hedge Fund-Style Capital Allocator
 * 
 * Implements:
 * - Bankroll cap
 * - Risk budget cap (max % of capital at risk)
 * - Max single position cap
 * - Kelly scaling
 * - Confidence weighting
 * - Total allocation guardrail
 */

import { kellyFraction } from './kelly';

export interface Opportunity {
  market_id: string;
  prob: number;
  odds: number;
  edge: number;
  confidence: number;
  sport: string;
  matchup: string;
}

export interface Allocation {
  market_id: string;
  edge: number;
  kelly_fraction: number;
  allocated_capital: number;
  confidence_score: number;
  sport: string;
  matchup: string;
}

export interface AllocationResult {
  allocations: Allocation[];
  totalAllocated: number;
  remainingCapital: number;
  utilizationRate: number;
}

/**
 * Allocate capital across multiple opportunities with strict risk controls
 */
export function allocateCapital(config: {
  opportunities: Opportunity[];
  totalCapital: number;
  riskBudget: number; // % of capital allowed at risk (e.g., 0.25 = 25%)
  maxSinglePosition: number; // Max % per position (e.g., 0.05 = 5%)
  kellyScale?: number; // Fractional Kelly (default 0.25)
}): AllocationResult {
  const {
    opportunities,
    totalCapital,
    riskBudget,
    maxSinglePosition,
    kellyScale = 0.25,
  } = config;

  console.log('[ALLOCATOR] Starting capital allocation:', {
    opportunities: opportunities.length,
    totalCapital,
    riskBudget,
    maxSinglePosition,
  });

  // Maximum capital allowed at risk
  const maxRiskCapital = totalCapital * riskBudget;

  let totalAllocated = 0;
  const allocations: Allocation[] = [];

  // Sort opportunities by edge * confidence (highest first)
  const sortedOpps = [...opportunities].sort(
    (a, b) => b.edge * b.confidence - a.edge * a.confidence
  );

  for (const opp of sortedOpps) {
    // Calculate full Kelly
    const fullKelly = kellyFraction(opp.prob, opp.odds);

    // Apply fractional Kelly and confidence weighting
    const rawKelly = fullKelly * kellyScale * opp.confidence;

    // Cap at max single position
    const cappedKelly = Math.min(rawKelly, maxSinglePosition);

    // Calculate allocation amount
    let allocation = totalCapital * cappedKelly;

    // Check if adding this allocation would exceed risk budget
    if (totalAllocated + allocation > maxRiskCapital) {
      // Only allocate remaining budget
      allocation = Math.max(0, maxRiskCapital - totalAllocated);
    }

    // Skip if allocation is too small (<$1)
    if (allocation <= 1) {
      console.log('[ALLOCATOR] Skipping small allocation:', {
        market: opp.market_id,
        allocation,
      });
      continue;
    }

    totalAllocated += allocation;

    allocations.push({
      market_id: opp.market_id,
      edge: opp.edge,
      kelly_fraction: cappedKelly,
      allocated_capital: allocation,
      confidence_score: opp.confidence,
      sport: opp.sport,
      matchup: opp.matchup,
    });

    console.log('[ALLOCATOR] Allocated:', {
      market: opp.market_id,
      edge: opp.edge.toFixed(3),
      kelly: cappedKelly.toFixed(4),
      amount: allocation.toFixed(2),
      confidence: opp.confidence.toFixed(2),
    });

    // Stop if we've hit the risk budget
    if (totalAllocated >= maxRiskCapital) {
      console.log('[ALLOCATOR] Risk budget reached');
      break;
    }
  }

  const utilizationRate = totalAllocated / maxRiskCapital;

  console.log('[ALLOCATOR] Allocation complete:', {
    totalAllocated: totalAllocated.toFixed(2),
    remainingCapital: (totalCapital - totalAllocated).toFixed(2),
    utilizationRate: (utilizationRate * 100).toFixed(1) + '%',
    allocationsCreated: allocations.length,
  });

  return {
    allocations,
    totalAllocated,
    remainingCapital: totalCapital - totalAllocated,
    utilizationRate,
  };
}

/**
 * Validate allocation constraints
 */
export function validateAllocation(
  allocation: Allocation,
  totalCapital: number,
  maxSinglePosition: number
): boolean {
  const positionSize = allocation.allocated_capital / totalCapital;

  if (positionSize > maxSinglePosition) {
    console.error('[ALLOCATOR] Position size exceeds max:', {
      market: allocation.market_id,
      positionSize: (positionSize * 100).toFixed(2) + '%',
      max: (maxSinglePosition * 100).toFixed(2) + '%',
    });
    return false;
  }

  return true;
}
