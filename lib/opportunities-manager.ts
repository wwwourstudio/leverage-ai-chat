/**
 * Opportunities Manager
 * Manages betting opportunities with capital allocation and risk management
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface BettingOpportunity {
  market_id: string;
  prob: number;           // Model's probability (0-1)
  odds: number;           // American odds format
  edge: number;           // Expected edge (0-1)
  confidence: number;     // Confidence in model (0-1)
  sport: string;
  matchup: string;
}

export interface CapitalAllocationConfig {
  opportunities: BettingOpportunity[];
  totalCapital: number;
  riskBudget: number;           // Maximum % of capital at risk (0-1)
  maxSinglePosition: number;    // Maximum % per bet (0-1)
  kellyScale: number;           // Kelly criterion scaling factor (0-1)
}

export interface AllocationResult {
  market_id: string;
  allocated_capital: number;
  suggested_bet_size: number;
  kelly_fraction: number;
  expected_value: number;
  risk_adjusted_allocation: number;
}

export interface CapitalAllocationResult {
  allocations: AllocationResult[];
  totalAllocated: number;
  remainingCapital: number;
  utilizationRate: number;
  riskMetrics: {
    totalRiskExposure: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
}

export interface OpportunityFilter {
  minEdge?: number;
  minConfidence?: number;
  sports?: string[];
  maxOdds?: number;
  minOdds?: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(odds: number): number {
  if (odds > 0) {
    return (odds / 100) + 1;
  }
  return (100 / Math.abs(odds)) + 1;
}

/**
 * Calculate implied probability from American odds
 */
export function oddsToImpliedProbability(odds: number): number {
  const decimal = americanToDecimal(odds);
  return 1 / decimal;
}

/**
 * Calculate Kelly criterion fraction
 */
export function calculateKellyFraction(
  probability: number,
  odds: number,
  confidence: number = 1
): number {
  const decimalOdds = americanToDecimal(odds);
  const q = 1 - probability;
  const b = decimalOdds - 1;
  
  // Kelly formula: (bp - q) / b
  const kellyFraction = ((b * probability) - q) / b;
  
  // Apply confidence adjustment
  return Math.max(0, kellyFraction * confidence);
}

/**
 * Calculate expected value for a bet
 */
export function calculateExpectedValue(
  probability: number,
  odds: number,
  stake: number
): number {
  const decimalOdds = americanToDecimal(odds);
  const winAmount = stake * (decimalOdds - 1);
  const loseAmount = stake;
  
  return (probability * winAmount) - ((1 - probability) * loseAmount);
}

/**
 * Validate opportunity data
 */
export function validateOpportunity(opp: BettingOpportunity): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!opp.market_id || opp.market_id.trim() === '') {
    errors.push('market_id is required');
  }
  
  if (opp.prob < 0 || opp.prob > 1) {
    errors.push('prob must be between 0 and 1');
  }
  
  if (opp.edge < 0 || opp.edge > 1) {
    errors.push('edge must be between 0 and 1');
  }
  
  if (opp.confidence < 0 || opp.confidence > 1) {
    errors.push('confidence must be between 0 and 1');
  }
  
  if (!opp.sport || opp.sport.trim() === '') {
    errors.push('sport is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// Core Allocation Logic
// ============================================================================

/**
 * Allocate capital across betting opportunities using Kelly criterion
 * with risk management constraints
 */
export function allocateCapital(
  config: CapitalAllocationConfig
): CapitalAllocationResult {
  const {
    opportunities,
    totalCapital,
    riskBudget,
    maxSinglePosition,
    kellyScale
  } = config;
  
  // Validate configuration
  if (totalCapital <= 0) {
    throw new Error('totalCapital must be positive');
  }
  
  if (riskBudget <= 0 || riskBudget > 1) {
    throw new Error('riskBudget must be between 0 and 1');
  }
  
  if (maxSinglePosition <= 0 || maxSinglePosition > 1) {
    throw new Error('maxSinglePosition must be between 0 and 1');
  }
  
  if (kellyScale <= 0 || kellyScale > 1) {
    throw new Error('kellyScale must be between 0 and 1');
  }
  
  // Validate all opportunities
  for (const opp of opportunities) {
    const validation = validateOpportunity(opp);
    if (!validation.valid) {
      throw new Error(`Invalid opportunity ${opp.market_id}: ${validation.errors.join(', ')}`);
    }
  }
  
  // Calculate Kelly fractions for each opportunity
  const allocations: AllocationResult[] = [];
  let totalAllocated = 0;
  const maxRiskCapital = totalCapital * riskBudget;
  
  for (const opp of opportunities) {
    // Calculate raw Kelly fraction
    const rawKelly = calculateKellyFraction(opp.prob, opp.odds, opp.confidence);
    
    // Apply Kelly scaling
    const scaledKelly = rawKelly * kellyScale;
    
    // Calculate suggested bet size
    let suggestedBet = totalCapital * scaledKelly;
    
    // Apply maximum single position constraint
    const maxPosition = totalCapital * maxSinglePosition;
    suggestedBet = Math.min(suggestedBet, maxPosition);
    
    // Ensure we don't exceed total risk budget
    const remainingRiskBudget = maxRiskCapital - totalAllocated;
    suggestedBet = Math.min(suggestedBet, remainingRiskBudget);
    
    // Only allocate if there's a positive edge
    if (suggestedBet > 0 && opp.edge > 0) {
      const expectedValue = calculateExpectedValue(opp.prob, opp.odds, suggestedBet);
      
      allocations.push({
        market_id: opp.market_id,
        allocated_capital: suggestedBet,
        suggested_bet_size: suggestedBet,
        kelly_fraction: scaledKelly,
        expected_value: expectedValue,
        risk_adjusted_allocation: suggestedBet / totalCapital
      });
      
      totalAllocated += suggestedBet;
    }
  }
  
  // Calculate risk metrics
  const totalRiskExposure = totalAllocated / totalCapital;
  const utilizationRate = totalAllocated / maxRiskCapital;
  
  // Simple Sharpe ratio estimate (assuming risk-free rate = 0)
  const avgExpectedValue = allocations.reduce((sum, a) => sum + a.expected_value, 0) / Math.max(allocations.length, 1);
  const sharpeRatio = allocations.length > 0 ? avgExpectedValue / Math.sqrt(totalRiskExposure) : 0;
  
  return {
    allocations,
    totalAllocated,
    remainingCapital: totalCapital - totalAllocated,
    utilizationRate,
    riskMetrics: {
      totalRiskExposure,
      maxDrawdown: totalRiskExposure, // Simplified estimate
      sharpeRatio
    }
  };
}

/**
 * Filter opportunities based on criteria
 */
export function filterOpportunities(
  opportunities: BettingOpportunity[],
  filter: OpportunityFilter
): BettingOpportunity[] {
  return opportunities.filter(opp => {
    // Check minimum edge
    if (filter.minEdge !== undefined && opp.edge < filter.minEdge) {
      return false;
    }
    
    // Check minimum confidence
    if (filter.minConfidence !== undefined && opp.confidence < filter.minConfidence) {
      return false;
    }
    
    // Check sport filter
    if (filter.sports && filter.sports.length > 0 && !filter.sports.includes(opp.sport)) {
      return false;
    }
    
    // Check odds range
    if (filter.maxOdds !== undefined && opp.odds > filter.maxOdds) {
      return false;
    }
    
    if (filter.minOdds !== undefined && opp.odds < filter.minOdds) {
      return false;
    }
    
    return true;
  });
}

/**
 * Sort opportunities by expected value (descending)
 */
export function sortOpportunitiesByEV(opportunities: BettingOpportunity[]): BettingOpportunity[] {
  return [...opportunities].sort((a, b) => {
    const evA = a.edge * a.confidence;
    const evB = b.edge * b.confidence;
    return evB - evA;
  });
}

// ============================================================================
// Database Integration
// ============================================================================

/**
 * Store allocation results in Supabase
 */
export async function storeAllocationResults(
  supabaseUrl: string,
  supabaseKey: string,
  results: CapitalAllocationResult
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const records = results.allocations.map(allocation => ({
    market_id: allocation.market_id,
    allocated_capital: allocation.allocated_capital,
    suggested_bet_size: allocation.suggested_bet_size,
    kelly_fraction: allocation.kelly_fraction,
    expected_value: allocation.expected_value,
    risk_adjusted_allocation: allocation.risk_adjusted_allocation,
    created_at: new Date().toISOString()
  }));
  
  const { error } = await supabase
    .from('capital_allocations')
    .insert(records);
  
  if (error) {
    throw new Error(`Failed to store allocation results: ${error.message}`);
  }
}

/**
 * Retrieve historical allocations from Supabase
 */
export async function getHistoricalAllocations(
  supabaseUrl: string,
  supabaseKey: string,
  limit: number = 100
): Promise<any[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('capital_allocations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    throw new Error(`Failed to retrieve historical allocations: ${error.message}`);
  }
  
  return data || [];
}

// ============================================================================
// Example Usage
// ============================================================================

/**
 * Example: Basic capital allocation
 */
export function exampleBasicAllocation(): CapitalAllocationResult {
  const opportunities: BettingOpportunity[] = [
    {
      market_id: 'nba_lakers_ml',
      prob: 0.58,
      odds: +120,
      edge: 0.045,
      confidence: 0.85,
      sport: 'NBA',
      matchup: 'Lakers @ Celtics'
    },
    {
      market_id: 'nfl_chiefs_spread',
      prob: 0.62,
      odds: -110,
      edge: 0.038,
      confidence: 0.90,
      sport: 'NFL',
      matchup: 'Chiefs -7'
    }
  ];
  
  return allocateCapital({
    opportunities,
    totalCapital: 10000,
    riskBudget: 0.25,
    maxSinglePosition: 0.05,
    kellyScale: 0.25
  });
}
