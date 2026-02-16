/**
 * Odds Alignment Validator
 * Validates AI predictions against real market odds from multiple sportsbooks
 */

interface OddsComparison {
  aiPrediction: number;
  marketOdds: number[];
  marketAverage: number;
  deviation: number;
  alignmentScore: number; // 0-1 (1 = perfect alignment)
  confidence: 'high' | 'medium' | 'low';
  isOutlier: boolean;
}

interface AlignmentResult {
  overallScore: number;
  comparisons: OddsComparison[];
  totalPredictions: number;
  alignedPredictions: number;
  outliers: number;
  averageDeviation: number;
}

/**
 * Calculate alignment between AI prediction and market odds
 */
function calculateAlignment(aiOdds: number, marketOdds: number[]): OddsComparison {
  if (marketOdds.length === 0) {
    return {
      aiPrediction: aiOdds,
      marketOdds: [],
      marketAverage: 0,
      deviation: 100,
      alignmentScore: 0,
      confidence: 'low',
      isOutlier: true
    };
  }

  // Calculate market average
  const marketAverage = marketOdds.reduce((a, b) => a + b, 0) / marketOdds.length;
  
  // Calculate percentage deviation
  const deviation = Math.abs((aiOdds - marketAverage) / marketAverage) * 100;
  
  // Calculate alignment score (closer = higher score)
  // 0% deviation = 1.0 score, 20%+ deviation = 0.0 score
  const alignmentScore = Math.max(0, 1 - (deviation / 20));
  
  // Determine confidence
  let confidence: 'high' | 'medium' | 'low';
  if (alignmentScore >= 0.90) confidence = 'high';
  else if (alignmentScore >= 0.75) confidence = 'medium';
  else confidence = 'low';
  
  // Flag as outlier if deviation > 15%
  const isOutlier = deviation > 15;
  
  console.log('[v0] [Odds Alignment] AI:', aiOdds, 'Market:', marketAverage.toFixed(2), 'Deviation:', deviation.toFixed(2) + '%', 'Score:', alignmentScore.toFixed(3));

  return {
    aiPrediction: aiOdds,
    marketOdds,
    marketAverage: parseFloat(marketAverage.toFixed(2)),
    deviation: parseFloat(deviation.toFixed(2)),
    alignmentScore: parseFloat(alignmentScore.toFixed(4)),
    confidence,
    isOutlier
  };
}

/**
 * Validate multiple AI predictions against market odds
 */
export function validateOddsAlignment(
  predictions: Array<{ aiOdds: number; marketOdds: number[] }>
): AlignmentResult {
  console.log('[v0] [Odds Alignment] Validating', predictions.length, 'predictions');

  const comparisons = predictions.map(p => calculateAlignment(p.aiOdds, p.marketOdds));
  
  const totalPredictions = comparisons.length;
  const alignedPredictions = comparisons.filter((c: OddsComparison) => c.alignmentScore >= 0.75).length;
  const outliers = comparisons.filter((c: OddsComparison) => c.isOutlier).length;
  
  const averageDeviation = comparisons.reduce((sum: number, c: OddsComparison) => sum + c.deviation, 0) / totalPredictions;
  const overallScore = comparisons.reduce((sum: number, c: OddsComparison) => sum + c.alignmentScore, 0) / totalPredictions;

  console.log('[v0] [Odds Alignment] Overall Score:', overallScore.toFixed(3), 'Aligned:', alignedPredictions + '/' + totalPredictions, 'Outliers:', outliers);

  return {
    overallScore: parseFloat(overallScore.toFixed(4)),
    comparisons,
    totalPredictions,
    alignedPredictions,
    outliers,
    averageDeviation: parseFloat(averageDeviation.toFixed(2))
  };
}

/**
 * Get consensus odds from multiple sportsbooks
 */
export function getConsensusOdds(bookOdds: Record<string, number>): {
  consensus: number;
  spread: number;
  books: number;
} {
  const odds = Object.values(bookOdds);
  
  if (odds.length === 0) {
    return { consensus: 0, spread: 0, books: 0 };
  }

  const consensus = odds.reduce((a, b) => a + b, 0) / odds.length;
  const min = Math.min(...odds);
  const max = Math.max(...odds);
  const spread = max - min;

  console.log('[v0] [Odds Alignment] Consensus:', consensus.toFixed(2), 'from', odds.length, 'books, Spread:', spread.toFixed(2));

  return {
    consensus: parseFloat(consensus.toFixed(2)),
    spread: parseFloat(spread.toFixed(2)),
    books: odds.length
  };
}

/**
 * Detect sharp money movement (line movement against public betting)
 */
export function detectSharpMoney(
  openingLine: number,
  currentLine: number,
  publicBettingPercentage: number
): {
  isSharpMove: boolean;
  direction: 'favorite' | 'underdog' | 'none';
  significance: 'high' | 'medium' | 'low';
} {
  const lineMovement = currentLine - openingLine;
  const movementPercentage = Math.abs(lineMovement / openingLine) * 100;
  
  // Sharp money = line moves against public betting
  // If public is on favorite but line moves toward underdog = sharp underdog
  const isSharpMove = (
    (publicBettingPercentage > 60 && lineMovement < 0) ||
    (publicBettingPercentage < 40 && lineMovement > 0)
  ) && movementPercentage > 2;

  let direction: 'favorite' | 'underdog' | 'none' = 'none';
  if (isSharpMove) {
    direction = lineMovement < 0 ? 'underdog' : 'favorite';
  }

  let significance: 'high' | 'medium' | 'low' = 'low';
  if (movementPercentage > 5) significance = 'high';
  else if (movementPercentage > 3) significance = 'medium';

  console.log('[v0] [Sharp Money] Movement:', lineMovement.toFixed(2), 'Public:', publicBettingPercentage + '%', 'Sharp:', isSharpMove, 'Direction:', direction);

  return { isSharpMove, direction, significance };
}
