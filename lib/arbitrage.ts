/**
 * Arbitrage Detection Engine
 * Identifies risk-free betting opportunities across bookmakers
 */

export interface ArbitrageOpportunity {
  market: string;
  side1: { bookmaker: string; odds: number; stake: number };
  side2: { bookmaker: string; odds: number; stake: number };
  profit: number;
  profitMargin: number;
  totalStake: number;
  riskFree: boolean;
}

/**
 * Detect arbitrage in two-sided markets
 * Returns true if total implied probability < 1
 */
export function detectArbitrage(probA: number, probB: number): boolean {
  return probA + probB < 1;
}

/**
 * Calculate arbitrage opportunity from two odds
 */
export function calculateArbitrage(
  odds1: number,
  odds2: number,
  totalStake: number = 100
): ArbitrageOpportunity | null {
  // Convert to decimal odds
  const decimal1 = odds1 > 0 ? 1 + odds1 / 100 : 1 + 100 / Math.abs(odds1);
  const decimal2 = odds2 > 0 ? 1 + odds2 / 100 : 1 + 100 / Math.abs(odds2);
  
  // Calculate implied probabilities
  const prob1 = 1 / decimal1;
  const prob2 = 1 / decimal2;
  
  // Check for arbitrage
  const totalProb = prob1 + prob2;
  if (totalProb >= 1) {
    return null; // No arbitrage
  }
  
  // Calculate optimal stakes (proportional to decimal odds)
  const stake1 = totalStake / (1 + decimal2 / decimal1);
  const stake2 = totalStake - stake1;
  
  // Calculate guaranteed return
  const return1 = stake1 * decimal1;
  const return2 = stake2 * decimal2;
  
  const profit = Math.min(return1, return2) - totalStake;
  const profitMargin = (profit / totalStake) * 100;
  
  return {
    market: 'two-way',
    side1: {
      bookmaker: 'Book A',
      odds: odds1,
      stake: stake1,
    },
    side2: {
      bookmaker: 'Book B',
      odds: odds2,
      stake: stake2,
    },
    profit,
    profitMargin,
    totalStake,
    riskFree: true,
  };
}

/**
 * Find arbitrage opportunities across multiple bookmakers
 */
export function findArbitrageOpportunities(
  outcomes: Array<{
    outcome: string;
    bookmaker: string;
    odds: number;
  }>,
  minProfitMargin: number = 0.5
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  
  // Group by outcome
  const outcomeGroups = new Map<string, typeof outcomes>();
  for (const outcome of outcomes) {
    if (!outcomeGroups.has(outcome.outcome)) {
      outcomeGroups.set(outcome.outcome, []);
    }
    outcomeGroups.get(outcome.outcome)!.push(outcome);
  }
  
  // Get unique outcomes
  const uniqueOutcomes = Array.from(outcomeGroups.keys());
  
  // Check all pairs of outcomes
  for (let i = 0; i < uniqueOutcomes.length; i++) {
    for (let j = i + 1; j < uniqueOutcomes.length; j++) {
      const outcome1 = uniqueOutcomes[i];
      const outcome2 = uniqueOutcomes[j];
      
      const odds1 = outcomeGroups.get(outcome1) || [];
      const odds2 = outcomeGroups.get(outcome2) || [];
      
      // Try all bookmaker combinations
      for (const book1 of odds1) {
        for (const book2 of odds2) {
          // Skip if same bookmaker (no arbitrage within one book)
          if (book1.bookmaker === book2.bookmaker) continue;
          
          const arb = calculateArbitrage(book1.odds, book2.odds);
          
          if (arb && arb.profitMargin >= minProfitMargin) {
            opportunities.push({
              ...arb,
              market: `${outcome1} vs ${outcome2}`,
              side1: {
                ...arb.side1,
                bookmaker: book1.bookmaker,
              },
              side2: {
                ...arb.side2,
                bookmaker: book2.bookmaker,
              },
            });
          }
        }
      }
    }
  }
  
  // Sort by profit margin (best first)
  return opportunities.sort((a, b) => b.profitMargin - a.profitMargin);
}

/**
 * Calculate middle opportunity (both sides win in a range)
 */
export function detectMiddleOpportunity(
  spread1: number,
  odds1: number,
  spread2: number,
  odds2: number
): {
  hasMiddle: boolean;
  middleRange?: [number, number];
  profit?: number;
} | null {
  // Middle exists if spreads don't overlap
  if (spread1 > spread2) {
    return {
      hasMiddle: true,
      middleRange: [spread2, spread1],
      profit: 0, // Calculate based on odds
    };
  }
  
  return { hasMiddle: false };
}

/**
 * Calculate Dutch betting (guaranteed profit on all outcomes)
 */
export function calculateDutch(
  odds: number[],
  totalStake: number
): {
  stakes: number[];
  guaranteedProfit: number;
  profitMargin: number;
} | null {
  // Convert to decimal odds
  const decimalOdds = odds.map((o) =>
    o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o)
  );
  
  // Calculate total implied probability
  const totalProb = decimalOdds.reduce((sum, d) => sum + 1 / d, 0);
  
  // Only profitable if total probability < 1
  if (totalProb >= 1) {
    return null;
  }
  
  // Calculate stakes proportional to 1/odds
  const stakes = decimalOdds.map((d) => totalStake / (d * totalProb));
  
  // Calculate guaranteed return (same for all outcomes)
  const guaranteedReturn = stakes[0] * decimalOdds[0];
  const guaranteedProfit = guaranteedReturn - totalStake;
  const profitMargin = (guaranteedProfit / totalStake) * 100;
  
  return {
    stakes,
    guaranteedProfit,
    profitMargin,
  };
}
