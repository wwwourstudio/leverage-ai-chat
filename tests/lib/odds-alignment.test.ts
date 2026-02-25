/**
 * Unit Tests for lib/odds-alignment.ts
 * Covers: validateOddsAlignment
 *
 * The function compares AI-generated odds against market consensus and
 * produces an alignment score + outlier count.  Mistakes here can silently
 * corrupt downstream trust/confidence scores.
 */

import { describe, it, expect } from 'vitest';
import { validateOddsAlignment } from '@/lib/odds-alignment';

// ============================================================================
// Empty / edge case inputs
// ============================================================================

describe('validateOddsAlignment — empty input', () => {
  it('returns perfect alignment for an empty array', () => {
    const result = validateOddsAlignment([]);
    expect(result.overallScore).toBe(1.0);
    expect(result.outliers).toBe(0);
    expect(result.totalPredictions).toBe(0);
    expect(result.averageDeviation).toBe(0);
  });
});

// ============================================================================
// Perfect alignment
// ============================================================================

describe('validateOddsAlignment — perfect alignment', () => {
  it('returns overallScore=1 and 0 outliers when AI matches market exactly', () => {
    const data = [
      { aiOdds: -110, marketOdds: [-110, -110, -110] },
      { aiOdds: 150, marketOdds: [150, 150] },
    ];
    const result = validateOddsAlignment(data);
    expect(result.overallScore).toBeCloseTo(1.0, 6);
    expect(result.outliers).toBe(0);
    expect(result.totalPredictions).toBe(2);
    expect(result.averageDeviation).toBeCloseTo(0, 6);
  });

  it('handles a single prediction with perfect match', () => {
    const result = validateOddsAlignment([{ aiOdds: 200, marketOdds: [200] }]);
    expect(result.overallScore).toBeCloseTo(1.0, 6);
    expect(result.averageDeviation).toBeCloseTo(0, 6);
    expect(result.outliers).toBe(0);
  });
});

// ============================================================================
// Small deviations (no outliers)
// NOTE: The function uses Math.max(avgMarket, 0.001) as the denominator.
// This means it is designed for positive-valued inputs such as decimal odds
// (e.g. 1.5, 2.0) or implied probabilities (e.g. 0.45, 0.55).
// Negative American odds produce division-by-0.001 and are not suitable here.
// ============================================================================

describe('validateOddsAlignment — small deviations', () => {
  it('reports a score slightly below 1.0 for small deviations', () => {
    // Decimal odds: AI says 1.909 (~-110), market averages 1.952 (~-115)
    // deviation = |1.909 - 1.952| / 1.952 ≈ 0.022 → not an outlier
    // score = max(0, 1 - 0.022) ≈ 0.978
    const result = validateOddsAlignment([
      { aiOdds: 1.909, marketOdds: [1.952, 1.952, 1.952] },
    ]);
    expect(result.overallScore).toBeLessThan(1.0);
    expect(result.overallScore).toBeGreaterThan(0.9);
    expect(result.outliers).toBe(0); // 0.022 < 0.2 threshold
    expect(result.totalPredictions).toBe(1);
  });

  it('deviation is computed against the average of multiple market odds', () => {
    // Market odds: [1.0, 3.0] → avg = 2.0; AI = 2.0 → deviation = 0
    const result = validateOddsAlignment([
      { aiOdds: 2.0, marketOdds: [1.0, 3.0] },
    ]);
    expect(result.averageDeviation).toBeCloseTo(0, 6);
    expect(result.overallScore).toBeCloseTo(1.0, 6);
  });
});

// ============================================================================
// Outlier detection (deviation > 0.2)
// ============================================================================

describe('validateOddsAlignment — outlier detection', () => {
  it('flags a prediction as an outlier when deviation exceeds 20%', () => {
    // AI says +200 (decimal-ish 200), market says +100 (100)
    // avgMarket = 100; deviation = |200 - 100| / 100 = 1.0 > 0.2 → outlier
    const result = validateOddsAlignment([
      { aiOdds: 200, marketOdds: [100] },
    ]);
    expect(result.outliers).toBe(1);
  });

  it('does not flag a deviation of exactly 20% as an outlier (threshold is strict >)', () => {
    // We want deviation == 0.2 exactly.
    // |aiOdds - avgMarket| / avgMarket = 0.2  →  aiOdds = avgMarket * 1.2
    // avgMarket = 100 → aiOdds = 120
    const result = validateOddsAlignment([
      { aiOdds: 120, marketOdds: [100] },
    ]);
    // deviation = 20/100 = 0.2, NOT > 0.2 → should not be an outlier
    expect(result.outliers).toBe(0);
  });

  it('correctly counts multiple outliers across predictions', () => {
    const data = [
      { aiOdds: 300, marketOdds: [100] },  // dev = 2.0 → outlier
      { aiOdds: -110, marketOdds: [-110] }, // dev = 0 → not outlier
      { aiOdds: 500, marketOdds: [100] },   // dev = 4.0 → outlier
    ];
    const result = validateOddsAlignment(data);
    expect(result.outliers).toBe(2);
    expect(result.totalPredictions).toBe(3);
  });

  it('counts no outliers when all deviations are below 20%', () => {
    // All within ≤10% of market (using decimal odds / implied probabilities)
    const data = [
      { aiOdds: 1.91, marketOdds: [1.95] },  // dev ≈ 0.020
      { aiOdds: 2.55, marketOdds: [2.50] },  // dev = 0.020
      { aiOdds: 1.98, marketOdds: [2.00] },  // dev = 0.010
    ];
    const result = validateOddsAlignment(data);
    expect(result.outliers).toBe(0);
  });
});

// ============================================================================
// Score calculation
// ============================================================================

describe('validateOddsAlignment — score calculation', () => {
  it('overallScore = max(0, 1 - averageDeviation)', () => {
    // Single prediction: aiOdds = 200, marketOdds = [100]
    // deviation = |200 - 100| / 100 = 1.0
    // averageDeviation = 1.0 / 1 = 1.0
    // overallScore = max(0, 1 - 1.0) = 0
    const result = validateOddsAlignment([{ aiOdds: 200, marketOdds: [100] }]);
    expect(result.overallScore).toBeCloseTo(0, 6);
  });

  it('overallScore is clamped at 0 (never negative)', () => {
    // Very large deviation should not produce a negative score
    const result = validateOddsAlignment([{ aiOdds: 10000, marketOdds: [100] }]);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });

  it('averageDeviation is averaged over all predictions, including perfect ones', () => {
    // Two predictions: one with deviation 1.0 and one with deviation 0
    // averageDeviation = (1.0 + 0) / 2 = 0.5
    const result = validateOddsAlignment([
      { aiOdds: 200, marketOdds: [100] }, // dev = 1.0
      { aiOdds: 100, marketOdds: [100] }, // dev = 0
    ]);
    expect(result.averageDeviation).toBeCloseTo(0.5, 6);
    expect(result.overallScore).toBeCloseTo(0.5, 6);
  });

  it('higher deviation produces lower score', () => {
    // Use positive values (decimal odds) so the denominator is well-behaved
    const closeResult = validateOddsAlignment([{ aiOdds: 1.91, marketOdds: [1.95] }]);
    const farResult = validateOddsAlignment([{ aiOdds: 3.00, marketOdds: [1.95] }]);
    expect(farResult.overallScore).toBeLessThan(closeResult.overallScore);
  });
});

// ============================================================================
// Edge cases
// ============================================================================

describe('validateOddsAlignment — edge cases', () => {
  it('skips entries that have no market odds (empty array)', () => {
    // The entry with no market odds should be skipped; only the valid one counted
    const result = validateOddsAlignment([
      { aiOdds: -110, marketOdds: [] },       // skipped
      { aiOdds: -110, marketOdds: [-110] },   // perfect
    ]);
    // totalPredictions = 2 (includes the skipped entry in the denominator per implementation)
    expect(result.totalPredictions).toBe(2);
    // The skipped entry contributes 0 deviation, so average = 0/2 = 0
    expect(result.averageDeviation).toBeCloseTo(0, 6);
    expect(result.overallScore).toBeCloseTo(1.0, 6);
  });

  it('uses Math.max(avgMarket, 0.001) to avoid division by zero', () => {
    // If avgMarket = 0, denominator becomes 0.001
    // deviation = |50 - 0| / 0.001 = 50000; score = max(0, 1 - 50000) = 0
    expect(() =>
      validateOddsAlignment([{ aiOdds: 50, marketOdds: [0] }])
    ).not.toThrow();
    const result = validateOddsAlignment([{ aiOdds: 50, marketOdds: [0] }]);
    expect(result.overallScore).toBe(0); // clamped
  });

  it('handles a single-element marketOdds array', () => {
    const result = validateOddsAlignment([{ aiOdds: -110, marketOdds: [-110] }]);
    expect(result.averageDeviation).toBeCloseTo(0, 6);
  });

  it('handles many predictions without throwing', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({
      aiOdds: -110 + i,
      marketOdds: [-110, -115, -108],
    }));
    expect(() => validateOddsAlignment(data)).not.toThrow();
    const result = validateOddsAlignment(data);
    expect(result.totalPredictions).toBe(100);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });
});
