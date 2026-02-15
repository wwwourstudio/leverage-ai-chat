/**
 * Kelly Criterion Implementation (Mathematically Verified)
 * 
 * Formula: f* = (bp - q) / b
 * Simplified to: (p * decimal - 1) / b
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
  const decimal = odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);

  // Net odds (b in formula)
  const b = decimal - 1;

  // Full Kelly formula: (p * decimal - 1) / b
  const fraction = (prob * decimal - 1) / b;

  // Never return negative Kelly (means no edge)
  return Math.max(fraction, 0);
}

/**
 * Calculate Kelly fraction with fractional scaling and confidence adjustment
 * @param prob - True probability of winning
 * @param odds - American odds
 * @param bankroll - Total bankroll
 * @param options - Configuration options
 */
export function calculateKelly(
  prob: number,
  odds: number,
  bankroll: number,
  options: {
    kellyFraction?: number; // Fraction of Kelly to use (default 0.25)
    maxPosition?: number; // Max position size as % of bankroll (default 0.05)
    confidence?: number; // Confidence score 0-1 (default 1)
  } = {}
): KellyResult {
  const {
    kellyFraction: kellyScale = 0.25,
    maxPosition = 0.05,
    confidence = 1,
  } = options;

  // Calculate full Kelly
  const fullKelly = kellyFraction(prob, odds);

  // Calculate edge
  const impliedProb = odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
  const edge = prob - impliedProb;

  // Apply fractional Kelly (typically 25% to reduce variance)
  let scaledFraction = fullKelly * kellyScale;

  // Apply confidence adjustment
  scaledFraction *= confidence;

  // Cap at max position size
  scaledFraction = Math.min(scaledFraction, maxPosition);

  // Calculate recommended stake
  const recommendedStake = bankroll * scaledFraction;

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
