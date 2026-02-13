/**
 * Benford's Law Validator
 * Statistical validation for detecting anomalies in AI-generated odds predictions
 */

// Benford's Law expected distribution (first digit probabilities)
const BENFORD_EXPECTED: Record<string, number> = {
  '1': 0.301,
  '2': 0.176,
  '3': 0.125,
  '4': 0.097,
  '5': 0.079,
  '6': 0.067,
  '7': 0.058,
  '8': 0.051,
  '9': 0.046
};

interface BenfordResult {
  score: number; // 0.0 - 1.0 (1.0 = perfect match)
  distribution: Record<string, number>;
  chiSquare: number;
  deviations: Record<string, number>;
  isValid: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Extract first digits from a dataset
 */
function extractFirstDigits(values: number[]): string[] {
  return values
    .filter(v => v > 0)
    .map(v => {
      const abs = Math.abs(v);
      const firstDigit = abs.toString()[0];
      return firstDigit;
    })
    .filter(d => d >= '1' && d <= '9');
}

/**
 * Calculate distribution of first digits
 */
function calculateDistribution(digits: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const total = digits.length;

  // Initialize counts
  for (let i = 1; i <= 9; i++) {
    counts[i.toString()] = 0;
  }

  // Count occurrences
  digits.forEach(d => {
    counts[d] = (counts[d] || 0) + 1;
  });

  // Convert to proportions
  Object.keys(counts).forEach(key => {
    counts[key] = counts[key] / total;
  });

  return counts;
}

/**
 * Calculate Chi-Square statistic for goodness of fit
 */
function calculateChiSquare(observed: Record<string, number>, total: number): number {
  let chiSquare = 0;

  for (let digit = 1; digit <= 9; digit++) {
    const digitStr = digit.toString();
    const expected = BENFORD_EXPECTED[digitStr] * total;
    const obs = (observed[digitStr] || 0) * total;
    chiSquare += Math.pow(obs - expected, 2) / expected;
  }

  return chiSquare;
}

/**
 * Validate dataset against Benford's Law
 */
export function validateBenford(values: number[]): BenfordResult {
  console.log('[v0] [Benford] Validating', values.length, 'values against Benford distribution');

  if (values.length < 30) {
    console.log('[v0] [Benford] Sample size too small (<30), returning low confidence');
    return {
      score: 0,
      distribution: {},
      chiSquare: 0,
      deviations: {},
      isValid: false,
      confidence: 'low'
    };
  }

  // Extract first digits
  const firstDigits = extractFirstDigits(values);
  const distribution = calculateDistribution(firstDigits);
  
  // Calculate deviations from expected
  const deviations: Record<string, number> = {};
  Object.keys(BENFORD_EXPECTED).forEach(digit => {
    const expected = BENFORD_EXPECTED[digit];
    const observed = distribution[digit] || 0;
    deviations[digit] = Math.abs(observed - expected);
  });

  // Calculate Chi-Square
  const chiSquare = calculateChiSquare(distribution, firstDigits.length);
  
  // Chi-Square critical value for 8 degrees of freedom at 95% confidence: 15.507
  const isValid = chiSquare < 15.507;
  
  // Calculate Benford score (0-1, higher is better)
  // Perfect match = chi-square of 0, progressively worse as chi-square increases
  const maxChiSquare = 30; // Arbitrary threshold for normalization
  const score = Math.max(0, 1 - (chiSquare / maxChiSquare));

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low';
  if (score >= 0.85) confidence = 'high';
  else if (score >= 0.70) confidence = 'medium';
  else confidence = 'low';

  console.log('[v0] [Benford] Score:', score.toFixed(4), 'Chi-Square:', chiSquare.toFixed(2), 'Valid:', isValid);

  return {
    score: parseFloat(score.toFixed(4)),
    distribution,
    chiSquare: parseFloat(chiSquare.toFixed(2)),
    deviations,
    isValid,
    confidence
  };
}

/**
 * Validate odds data from AI predictions
 */
export function validateOddsWithBenford(odds: Array<{ value: number; type: string }>): BenfordResult {
  // Extract numeric values from odds (convert American odds to decimals if needed)
  const values = odds.map(o => {
    if (o.type === 'american') {
      // Convert American odds to implied probability percentage
      if (o.value > 0) {
        return 100 / (o.value + 100) * 100;
      } else {
        return (-o.value) / (-o.value + 100) * 100;
      }
    }
    return Math.abs(o.value);
  });

  return validateBenford(values);
}

/**
 * Get baseline Benford distribution for a sport
 */
export async function getBenfordBaseline(sport: string, marketType: string): Promise<Record<string, number> | null> {
  console.log('[v0] [Benford] Fetching baseline for', sport, marketType);
  
  try {
    // This would fetch from odds_benford_baselines table
    // For now, return null (will use default Benford distribution)
    return null;
  } catch (error) {
    console.error('[v0] [Benford] Error fetching baseline:', error);
    return null;
  }
}
