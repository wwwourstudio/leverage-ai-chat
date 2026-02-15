/**
 * Multi-Book Odds Arbitrage Engine
 * Detects arbitrage opportunities across multiple sportsbooks
 */

export interface BookOdds {
  book: string;
  market: string;
  outcome: string;
  price: number; // American odds
}

export interface ArbitrageOpportunity {
  market: string;
  totalImpliedProbability: number;
  profitMargin: number;
  recommendedStakes: {
    book: string;
    outcome: string;
    stakePercent: number;
  }[];
}

/**
 * Convert American odds to implied probability
 * @param odds - American odds (positive or negative)
 * @returns Decimal probability between 0 and 1
 */
export function americanToProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

/**
 * Detect arbitrage opportunities across multiple books
 * @param odds - Array of odds from different books
 * @returns Array of arbitrage opportunities
 */
export function detectArbitrage(odds: BookOdds[]): ArbitrageOpportunity[] {
  if (odds.length === 0) {
    return [];
  }

  // Group odds by market
  const marketMap = new Map<string, BookOdds[]>();
  
  for (const odd of odds) {
    const existing = marketMap.get(odd.market) || [];
    existing.push(odd);
    marketMap.set(odd.market, existing);
  }

  const opportunities: ArbitrageOpportunity[] = [];

  // Analyze each market
  for (const [market, marketOdds] of marketMap.entries()) {
    // Group by outcome to find best price for each outcome
    const outcomeMap = new Map<string, BookOdds[]>();
    
    for (const odd of marketOdds) {
      const existing = outcomeMap.get(odd.outcome) || [];
      existing.push(odd);
      outcomeMap.set(odd.outcome, existing);
    }

    // Need at least 2 outcomes to have arbitrage
    if (outcomeMap.size < 2) {
      continue;
    }

    // Find best price for each outcome
    const bestOutcomes: { outcome: string; book: string; price: number; probability: number }[] = [];
    
    for (const [outcome, outcomeOdds] of outcomeMap.entries()) {
      // Best price means lowest implied probability (highest odds value)
      let bestOdd = outcomeOdds[0];
      let lowestProbability = americanToProbability(bestOdd.price);
      
      for (const odd of outcomeOdds) {
        const prob = americanToProbability(odd.price);
        if (prob < lowestProbability) {
          lowestProbability = prob;
          bestOdd = odd;
        }
      }
      
      bestOutcomes.push({
        outcome,
        book: bestOdd.book,
        price: bestOdd.price,
        probability: lowestProbability,
      });
    }

    // Calculate total implied probability
    const totalImpliedProbability = bestOutcomes.reduce(
      (sum, outcome) => sum + outcome.probability,
      0
    );

    // Arbitrage exists when total implied probability < 1.0
    if (totalImpliedProbability < 1.0) {
      const profitMargin = 1 - totalImpliedProbability;
      
      // Allocate stake percentages proportionally
      const recommendedStakes = bestOutcomes.map((outcome) => ({
        book: outcome.book,
        outcome: outcome.outcome,
        stakePercent: outcome.probability / totalImpliedProbability,
      }));

      opportunities.push({
        market,
        totalImpliedProbability,
        profitMargin,
        recommendedStakes,
      });
    }
  }

  return opportunities;
}
