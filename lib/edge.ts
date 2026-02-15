/**
 * Edge Calculation and Market Analysis
 * 
 * Edge = Model Probability - Market Probability
 * Only trade when edge > threshold (typically 2%)
 */

export interface EdgeAnalysis {
  edge: number;
  modelProb: number;
  marketProb: number;
  isPositive: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Calculate betting edge
 * @param modelProb - Your model's probability estimate (0-1)
 * @param bookProb - Implied probability from bookmaker odds (0-1)
 * @returns Edge (positive = value, negative = no value)
 */
export function calculateEdge(modelProb: number, bookProb: number): number {
  return modelProb - bookProb;
}

/**
 * Calculate implied probability from American odds
 */
export function impliedProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

/**
 * Analyze edge with confidence levels
 */
export function analyzeEdge(modelProb: number, odds: number): EdgeAnalysis {
  const marketProb = impliedProbability(odds);
  const edge = calculateEdge(modelProb, marketProb);

  let confidence: 'high' | 'medium' | 'low';
  if (Math.abs(edge) > 0.05) confidence = 'high';
  else if (Math.abs(edge) > 0.02) confidence = 'medium';
  else confidence = 'low';

  return {
    edge,
    modelProb,
    marketProb,
    isPositive: edge > 0,
    confidence,
  };
}

/**
 * Check if bet meets minimum edge threshold
 */
export function meetsEdgeThreshold(edge: number, minThreshold: number = 0.02): boolean {
  return edge >= minThreshold;
}

/**
 * Detect arbitrage opportunity (two-sided markets)
 * @param probA - Implied probability from side A
 * @param probB - Implied probability from side B
 * @returns True if arbitrage exists (sum < 1)
 */
export function detectArbitrage(probA: number, probB: number): boolean {
  return probA + probB < 1;
}

/**
 * Calculate arbitrage profit percentage
 */
export function calculateArbitrageProfit(probA: number, probB: number): number {
  if (!detectArbitrage(probA, probB)) return 0;

  // Optimal stakes that guarantee profit
  const totalProb = probA + probB;
  return (1 - totalProb) * 100; // Return as percentage
}
