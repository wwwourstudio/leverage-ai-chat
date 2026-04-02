/**
 * Unified Kelly Criterion Implementation
 * Consolidated from multiple Kelly modules
 * 
 * Formula: f* = (bp - q) / b = (p * decimal - 1) / (decimal - 1)
 * 
 * Where:
 * - f* = optimal fraction of bankroll to bet
 * - b = net odds received on bet (decimal - 1)
 * - p = probability of winning
 * - q = probability of losing (1 - p)
 */

export interface KellyResult {
  fraction: number;
  scaledFraction: number;
  recommendedStake: number;
  edge: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface KellyInput {
  probability: number;
  odds: number; // American odds
  bankroll: number;
  kellyFraction?: number; // Fraction of Kelly to use (default 0.25)
  maxPosition?: number; // Max position size as % of bankroll (default 0.05)
  confidence?: number; // Confidence score 0-1 (default 1)
}

import { americanToDecimal } from '@/lib/utils/odds-math';

/**
 * Calculate Kelly Criterion fraction for a given probability and odds
 * @param prob - True probability of winning (0-1)
 * @param odds - American odds (e.g., +150, -110)
 * @returns Kelly fraction (0-1)
 */
export function kellyFraction(prob: number, odds: number): number {
  // Input validation
  if (prob <= 0 || prob >= 1) {
    console.log('[KELLY] Invalid probability:', prob);
    return 0;
  }

  // Convert American odds to decimal
  const decimal = americanToDecimal(odds);

  // Net odds (b in formula)
  const b = decimal - 1;

  // Full Kelly formula: (p * decimal - 1) / b
  const fraction = (prob * decimal - 1) / b;

  // Never return negative Kelly (means no edge)
  return Math.max(fraction, 0);
}

/**
 * Calculate Kelly fraction with fractional scaling and confidence adjustment
 * Unified implementation supporting multiple input formats
 */
export function calculateKelly(input: KellyInput): KellyResult;
export function calculateKelly(
  prob: number,
  odds: number,
  bankroll: number,
  options?: {
    kellyFraction?: number;
    maxPosition?: number;
    confidence?: number;
  }
): KellyResult;
export function calculateKelly(
  inputOrProb: KellyInput | number,
  odds?: number,
  bankroll?: number,
  options?: {
    kellyFraction?: number;
    maxPosition?: number;
    confidence?: number;
  }
): KellyResult {
  // Handle different input formats
  let prob: number;
  let oddsValue: number;
  let bankrollValue: number;
  let kellyScale: number;
  let maxPosition: number;
  let confidence: number;

  if (typeof inputOrProb === 'object') {
    // Object input format
    const input = inputOrProb;
    prob = input.probability;
    oddsValue = input.odds;
    bankrollValue = input.bankroll;
    kellyScale = input.kellyFraction ?? 0.25;
    maxPosition = input.maxPosition ?? 0.05;
    confidence = input.confidence ?? 1;
  } else {
    // Legacy positional arguments format
    prob = inputOrProb;
    oddsValue = odds!;
    bankrollValue = bankroll!;
    kellyScale = options?.kellyFraction ?? 0.25;
    maxPosition = options?.maxPosition ?? 0.05;
    confidence = options?.confidence ?? 1;
  }

  // Calculate full Kelly
  const fullKelly = kellyFraction(prob, oddsValue);

  // Calculate edge
  const impliedProb = oddsValue > 0 
    ? 100 / (oddsValue + 100) 
    : Math.abs(oddsValue) / (Math.abs(oddsValue) + 100);
  const edge = prob - impliedProb;

  // Apply fractional Kelly (typically 25% to reduce variance)
  let scaledFraction = fullKelly * kellyScale;

  // Apply confidence adjustment
  scaledFraction *= confidence;

  // Cap at max position size
  scaledFraction = Math.min(scaledFraction, maxPosition);

  // Calculate recommended stake
  const recommendedStake = bankrollValue * scaledFraction;

  // Determine confidence level
  let confidenceLevel: 'high' | 'medium' | 'low';
  if (edge > 0.05) confidenceLevel = 'high';
  else if (edge > 0.02) confidenceLevel = 'medium';
  else confidenceLevel = 'low';

  return {
    fraction: fullKelly,
    scaledFraction,
    recommendedStake,
    edge,
    confidence: confidenceLevel,
  };
}

/**
 * Check if a bet meets Kelly criteria for recommendation
 */
export function isKellyPositive(prob: number, odds: number): boolean {
  const fraction = kellyFraction(prob, odds);
  return fraction > 0;
}

/**
 * Calculate Kelly for multiple outcomes (e.g., multi-way markets)
 */
export function calculateMultiKelly(
  outcomes: { probability: number; odds: number }[],
  bankroll: number,
  options?: {
    kellyFraction?: number;
    maxPosition?: number;
  }
): { outcome: number; stake: number; fraction: number }[] {
  return outcomes.map((outcome, index) => {
    const result = calculateKelly({
      probability: outcome.probability,
      odds: outcome.odds,
      bankroll,
      ...options
    });
    
    return {
      outcome: index,
      stake: result.recommendedStake,
      fraction: result.scaledFraction
    };
  });
}
