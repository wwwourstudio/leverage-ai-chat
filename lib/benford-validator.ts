/**
 * Benford's Law Validator
 * Validates whether a dataset of numbers follows Benford's Law distribution.
 */

interface BenfordResult {
  isValid: boolean;
  score: number;
  chiSquare: number;
  confidence: 'high' | 'medium' | 'low';
  distribution: Record<string, number>;
}

// Expected Benford distribution for leading digits 1-9
const BENFORD_EXPECTED: Record<string, number> = {
  '1': 0.301, '2': 0.176, '3': 0.125, '4': 0.097,
  '5': 0.079, '6': 0.067, '7': 0.058, '8': 0.051, '9': 0.046,
};

/**
 * Validate a set of numbers against Benford's Law
 */
export function validateBenford(values: number[]): BenfordResult {
  if (values.length === 0) {
    return {
      isValid: true,
      score: 1.0,
      chiSquare: 0,
      confidence: 'low',
      distribution: {},
    };
  }

  // Count leading digits
  const digitCounts: Record<string, number> = {};
  let validCount = 0;

  for (const val of values) {
    const abs = Math.abs(val);
    if (abs < 1) continue;
    const leading = String(abs).charAt(0);
    if (leading >= '1' && leading <= '9') {
      digitCounts[leading] = (digitCounts[leading] || 0) + 1;
      validCount++;
    }
  }

  if (validCount === 0) {
    return {
      isValid: true,
      score: 1.0,
      chiSquare: 0,
      confidence: 'low',
      distribution: digitCounts,
    };
  }

  // Calculate chi-square statistic
  let chiSquare = 0;
  const observed: Record<string, number> = {};

  for (let d = 1; d <= 9; d++) {
    const digit = String(d);
    const observedFreq = (digitCounts[digit] || 0) / validCount;
    observed[digit] = observedFreq;
    const expected = BENFORD_EXPECTED[digit];
    chiSquare += Math.pow(observedFreq - expected, 2) / expected;
  }

  chiSquare *= validCount;

  // Score: 1.0 = perfect match, 0.0 = worst
  const score = Math.max(0, 1 - chiSquare / 50);
  const isValid = chiSquare < 15.507; // Critical value for df=8, alpha=0.05

  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (validCount < 30) confidence = 'low';
  else if (validCount < 100) confidence = 'medium';

  return {
    isValid,
    score,
    chiSquare,
    confidence,
    distribution: observed,
  };
}
