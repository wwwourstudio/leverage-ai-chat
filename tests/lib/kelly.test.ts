/**
 * Unit Tests for lib/kelly/index.ts
 * Covers: kellyFraction, calculateKelly (object + positional), isKellyPositive,
 *         calculateMultiKelly
 *
 * All numeric expectations use toBeCloseTo() with 4-digit precision because
 * fractional-Kelly involves floating-point arithmetic.
 */

import { describe, it, expect } from 'vitest';
import {
  kellyFraction,
  calculateKelly,
  isKellyPositive,
  calculateMultiKelly,
} from '@/lib/kelly/index';

// ============================================================================
// kellyFraction — core formula
// ============================================================================

describe('kellyFraction', () => {
  // Formula: f* = (p * decimal - 1) / (decimal - 1)
  // For +150: decimal = 2.5, b = 1.5

  it('returns the correct fraction for positive odds with edge', () => {
    // f = (0.6 * 2.5 - 1) / 1.5 = 0.5 / 1.5 = 0.3333
    expect(kellyFraction(0.6, 150)).toBeCloseTo(1 / 3, 4);
  });

  it('returns the correct fraction for negative odds with edge', () => {
    // -110: decimal = 1 + 100/110 = 21/11 ≈ 1.9091, b = 10/11
    // f = (0.55 * 21/11 - 1) / (10/11) = 0.55 / 10 = 0.055
    expect(kellyFraction(0.55, -110)).toBeCloseTo(0.055, 4);
  });

  it('returns 0 when the probability exactly matches fair odds (no edge)', () => {
    // +100 → decimal 2.0; p=0.5 → f = (0.5*2 - 1)/1 = 0
    expect(kellyFraction(0.5, 100)).toBeCloseTo(0, 6);
  });

  it('returns 0 (not negative) when there is negative edge', () => {
    // +100 → p=0.4 → f = (0.4*2 - 1)/1 = -0.2 → clamped to 0
    expect(kellyFraction(0.4, 100)).toBe(0);
  });

  it('returns 0 and logs for probability of 0', () => {
    expect(kellyFraction(0, -110)).toBe(0);
  });

  it('returns 0 for probability of 1 (invalid)', () => {
    expect(kellyFraction(1, -110)).toBe(0);
  });

  it('returns 0 for probability > 1 (invalid)', () => {
    expect(kellyFraction(1.5, -110)).toBe(0);
  });

  it('returns 0 for probability < 0 (invalid)', () => {
    expect(kellyFraction(-0.1, 100)).toBe(0);
  });

  it('returns a larger fraction for higher probability', () => {
    const low = kellyFraction(0.52, -110);
    const high = kellyFraction(0.65, -110);
    expect(high).toBeGreaterThan(low);
  });

  it('returns a larger fraction for higher (more generous) odds at the same probability', () => {
    // Higher odds = bigger win multiplier = bigger fraction at same prob
    const fraction110 = kellyFraction(0.6, -110);
    const fraction200 = kellyFraction(0.6, 200);
    expect(fraction200).toBeGreaterThan(fraction110);
  });
});

// ============================================================================
// calculateKelly — object input form
// ============================================================================

describe('calculateKelly (object input)', () => {
  it('returns correct fraction, scaledFraction, recommendedStake, and edge', () => {
    // prob=0.6, +150, bankroll=1000, defaults: kellyFraction=0.25, maxPos=0.05
    // fullKelly = 1/3 ≈ 0.333
    // impliedProb = 100/(150+100) = 0.4
    // edge = 0.6 - 0.4 = 0.2 → 'high'
    // scaledFraction = 0.333 * 0.25 = 0.083 → capped at 0.05 (maxPosition)
    // recommendedStake = 1000 * 0.05 = 50
    const result = calculateKelly({ probability: 0.6, odds: 150, bankroll: 1000 });

    expect(result.fraction).toBeCloseTo(1 / 3, 4);
    expect(result.scaledFraction).toBeCloseTo(0.05, 6); // capped at maxPosition
    expect(result.recommendedStake).toBeCloseTo(50, 4);
    expect(result.edge).toBeCloseTo(0.2, 6);
    expect(result.confidence).toBe('high');
  });

  it('classifies edge > 0.05 as high confidence', () => {
    // prob=0.6, odds=+150 → edge=0.2 → 'high'
    expect(calculateKelly({ probability: 0.6, odds: 150, bankroll: 1000 }).confidence).toBe('high');
  });

  it('classifies edge > 0.02 (but ≤ 0.05) as medium confidence', () => {
    // -110 → impliedProb ≈ 0.5238; prob=0.55 → edge ≈ 0.0262
    const result = calculateKelly({ probability: 0.55, odds: -110, bankroll: 1000 });
    expect(result.edge).toBeGreaterThan(0.02);
    expect(result.edge).toBeLessThanOrEqual(0.05);
    expect(result.confidence).toBe('medium');
  });

  it('classifies edge ≤ 0.02 as low confidence', () => {
    // prob=0.51, +100 → impliedProb=0.5 → edge=0.01 → 'low'
    const result = calculateKelly({ probability: 0.51, odds: 100, bankroll: 1000 });
    expect(result.edge).toBeLessThanOrEqual(0.02);
    expect(result.confidence).toBe('low');
  });

  it('applies the kellyFraction scaling option', () => {
    // Using half-Kelly (0.5) instead of default quarter-Kelly (0.25)
    const quarter = calculateKelly({ probability: 0.55, odds: -110, bankroll: 1000 });
    const half = calculateKelly({ probability: 0.55, odds: -110, bankroll: 1000, kellyFraction: 0.5 });
    // Half-kelly should be roughly 2x quarter-kelly (unless capped)
    expect(half.scaledFraction).toBeGreaterThan(quarter.scaledFraction);
  });

  it('caps scaledFraction at maxPosition', () => {
    // Huge edge: prob=0.9, odds=+200 → full Kelly very large
    const result = calculateKelly({
      probability: 0.9,
      odds: 200,
      bankroll: 10000,
      maxPosition: 0.02,
    });
    expect(result.scaledFraction).toBeLessThanOrEqual(0.02);
  });

  it('applies confidence multiplier to scaledFraction', () => {
    const full = calculateKelly({ probability: 0.6, odds: 150, bankroll: 1000, confidence: 1 });
    const half = calculateKelly({ probability: 0.6, odds: 150, bankroll: 1000, confidence: 0.5 });
    // half-confidence should produce smaller scaledFraction
    expect(half.scaledFraction).toBeLessThanOrEqual(full.scaledFraction);
  });

  it('returns fraction=0 and recommendedStake=0 when there is no edge', () => {
    const result = calculateKelly({ probability: 0.4, odds: 100, bankroll: 1000 });
    expect(result.fraction).toBe(0);
    expect(result.scaledFraction).toBe(0);
    expect(result.recommendedStake).toBe(0);
  });

  it('scales recommendedStake proportionally with bankroll', () => {
    const small = calculateKelly({ probability: 0.55, odds: -110, bankroll: 1000 });
    const large = calculateKelly({ probability: 0.55, odds: -110, bankroll: 10000 });
    expect(large.recommendedStake).toBeCloseTo(small.recommendedStake * 10, 4);
  });
});

// ============================================================================
// calculateKelly — positional (legacy) form
// ============================================================================

describe('calculateKelly (positional input)', () => {
  it('produces the same result as the object form', () => {
    const obj = calculateKelly({ probability: 0.6, odds: 150, bankroll: 1000 });
    const pos = calculateKelly(0.6, 150, 1000);
    expect(pos.fraction).toBeCloseTo(obj.fraction, 6);
    expect(pos.scaledFraction).toBeCloseTo(obj.scaledFraction, 6);
    expect(pos.recommendedStake).toBeCloseTo(obj.recommendedStake, 6);
    expect(pos.edge).toBeCloseTo(obj.edge, 6);
    expect(pos.confidence).toBe(obj.confidence);
  });

  it('accepts options in positional form', () => {
    const result = calculateKelly(0.6, 150, 1000, { kellyFraction: 0.5, maxPosition: 0.1 });
    // fullKelly ≈ 0.333, scaled = 0.333 * 0.5 = 0.1665, capped at 0.1
    expect(result.scaledFraction).toBeCloseTo(0.1, 4);
  });
});

// ============================================================================
// isKellyPositive
// ============================================================================

describe('isKellyPositive', () => {
  it('returns true when there is positive expected value', () => {
    expect(isKellyPositive(0.6, 150)).toBe(true);  // edge=0.2
    expect(isKellyPositive(0.55, -110)).toBe(true); // small positive edge
  });

  it('returns false when probability exactly meets fair odds', () => {
    expect(isKellyPositive(0.5, 100)).toBe(false);
  });

  it('returns false when there is negative expected value', () => {
    expect(isKellyPositive(0.4, -110)).toBe(false);
  });

  it('returns false for invalid probability', () => {
    expect(isKellyPositive(0, 100)).toBe(false);
    expect(isKellyPositive(1.2, 100)).toBe(false);
  });
});

// ============================================================================
// calculateMultiKelly
// ============================================================================

describe('calculateMultiKelly', () => {
  const outcomes = [
    { probability: 0.6, odds: 150 }, // +EV
    { probability: 0.4, odds: 100 }, // negative EV → fraction=0
  ];

  it('returns one result per outcome', () => {
    const results = calculateMultiKelly(outcomes, 1000);
    expect(results).toHaveLength(2);
  });

  it('returns sequential outcome indices', () => {
    const results = calculateMultiKelly(outcomes, 1000);
    expect(results[0].outcome).toBe(0);
    expect(results[1].outcome).toBe(1);
  });

  it('calculates non-zero stake for the positive-EV outcome', () => {
    const results = calculateMultiKelly(outcomes, 1000);
    expect(results[0].stake).toBeGreaterThan(0);
    expect(results[0].fraction).toBeGreaterThan(0);
  });

  it('calculates zero stake for the negative-EV outcome', () => {
    const results = calculateMultiKelly(outcomes, 1000);
    expect(results[1].stake).toBe(0);
    expect(results[1].fraction).toBe(0);
  });

  it('applies maxPosition to all outcomes', () => {
    const all = [
      { probability: 0.9, odds: 200 },
      { probability: 0.9, odds: 300 },
    ];
    const results = calculateMultiKelly(all, 10000, { maxPosition: 0.01 });
    results.forEach(r => {
      expect(r.fraction).toBeLessThanOrEqual(0.01);
    });
  });
});
