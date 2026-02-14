/**
 * Kelly Sizing Optimizer
 * Calculates optimal bet sizing using the Kelly Criterion
 */

export interface KellyInput {
  probability: number;
  decimalOdds: number;
  bankroll: number;
  fraction?: number;
}

export interface KellyResult {
  fullKellyStake: number;
  fractionalKellyStake: number;
  recommendedStake: number;
}

/**
 * Calculate Kelly Criterion bet sizing
 * @param input - Kelly calculation parameters
 * @returns Stake recommendations
 */
export function calculateKelly(input: KellyInput): KellyResult {
  const { probability, decimalOdds, bankroll, fraction = 0.5 } = input;
  
  // Validate inputs
  if (probability <= 0 || probability >= 1) {
    return {
      fullKellyStake: 0,
      fractionalKellyStake: 0,
      recommendedStake: 0,
    };
  }
  
  if (decimalOdds <= 1) {
    return {
      fullKellyStake: 0,
      fractionalKellyStake: 0,
      recommendedStake: 0,
    };
  }
  
  if (bankroll <= 0) {
    return {
      fullKellyStake: 0,
      fractionalKellyStake: 0,
      recommendedStake: 0,
    };
  }
  
  // Kelly Criterion formula
  // b = decimalOdds - 1 (net odds)
  // p = probability of winning
  // q = 1 - p (probability of losing)
  // Kelly fraction = (b * p - q) / b
  
  const b = decimalOdds - 1;
  const p = probability;
  const q = 1 - p;
  
  const kellyFraction = (b * p - q) / b;
  
  // If Kelly fraction is negative or zero, no edge exists
  if (kellyFraction <= 0) {
    return {
      fullKellyStake: 0,
      fractionalKellyStake: 0,
      recommendedStake: 0,
    };
  }
  
  // Calculate stakes
  const fullKellyStake = bankroll * kellyFraction;
  const fractionalKellyStake = fullKellyStake * fraction;
  
  // Cap at bankroll
  const recommendedStake = Math.min(fractionalKellyStake, bankroll);
  
  return {
    fullKellyStake: Math.max(0, fullKellyStake),
    fractionalKellyStake: Math.max(0, fractionalKellyStake),
    recommendedStake: Math.max(0, recommendedStake),
  };
}
