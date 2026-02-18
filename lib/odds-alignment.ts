/**
 * Odds Alignment Validator
 * Validates AI-generated odds against real market odds.
 */

interface OddsAlignmentResult {
  overallScore: number;
  outliers: number;
  totalPredictions: number;
  averageDeviation: number;
}

/**
 * Validate AI odds predictions against market odds
 */
export function validateOddsAlignment(
  marketOdds: Array<{ aiOdds: number; marketOdds: number[] }>
): OddsAlignmentResult {
  if (marketOdds.length === 0) {
    return {
      overallScore: 1.0,
      outliers: 0,
      totalPredictions: 0,
      averageDeviation: 0,
    };
  }

  let totalDeviation = 0;
  let outlierCount = 0;

  for (const entry of marketOdds) {
    if (entry.marketOdds.length === 0) continue;

    // Average market odds as baseline
    const avgMarket =
      entry.marketOdds.reduce((sum, o) => sum + o, 0) / entry.marketOdds.length;

    const deviation = Math.abs(entry.aiOdds - avgMarket) / Math.max(avgMarket, 0.001);
    totalDeviation += deviation;

    // An outlier is a prediction that deviates more than 20% from market consensus
    if (deviation > 0.2) {
      outlierCount++;
    }
  }

  const averageDeviation = totalDeviation / marketOdds.length;
  // Score: 1.0 = perfect alignment, 0.0 = worst
  const overallScore = Math.max(0, 1 - averageDeviation);

  return {
    overallScore,
    outliers: outlierCount,
    totalPredictions: marketOdds.length,
    averageDeviation,
  };
}
