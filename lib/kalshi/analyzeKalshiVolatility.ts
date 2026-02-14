/**
 * Kalshi Volatility Modeling System
 * Analyzes prediction market volatility and edge estimation
 */

export interface KalshiMarket {
  yesPrice: number;
  noPrice: number;
  volume: number;
  historicalPrices: number[];
}

export interface KalshiAnalysis {
  impliedProbability: number;
  volatility: number;
  edgeEstimate: number;
  riskLevel: "low" | "medium" | "high";
}

/**
 * Calculate standard deviation of an array of numbers
 * @param values - Array of numeric values
 * @returns Standard deviation
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(variance);
}

/**
 * Analyze Kalshi market volatility and edge
 * @param market - Kalshi market data
 * @param modelProbability - Model's estimated probability (0-1)
 * @returns Analysis including volatility and edge estimate
 */
export function analyzeKalshiVolatility(
  market: KalshiMarket,
  modelProbability: number
): KalshiAnalysis {
  // Calculate implied probability from yes price
  const impliedProbability = market.yesPrice / 100;
  
  // Convert historical prices to 0-1 scale and calculate volatility
  const normalizedPrices = market.historicalPrices.map(price => price / 100);
  const volatility = standardDeviation(normalizedPrices);
  
  // Calculate edge estimate (model probability vs market probability)
  const edgeEstimate = modelProbability - impliedProbability;
  
  // Classify risk level based on volatility
  let riskLevel: "low" | "medium" | "high";
  
  if (volatility < 0.05) {
    riskLevel = "low";
  } else if (volatility <= 0.12) {
    riskLevel = "medium";
  } else {
    riskLevel = "high";
  }
  
  return {
    impliedProbability,
    volatility,
    edgeEstimate,
    riskLevel,
  };
}
