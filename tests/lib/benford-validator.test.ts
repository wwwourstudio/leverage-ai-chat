/**
 * Unit Tests for lib/benford-validator.ts
 * Covers: validateBenford — empty input, no valid values, confidence bands,
 *         perfect-Benford dataset, uniform distribution, chi-square threshold.
 */

import { describe, it, expect } from 'vitest';
import { validateBenford } from '@/lib/benford-validator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a dataset that precisely matches Benford's expected distribution.
 * For N total values: round(N * expected[d]) values starting with digit d.
 */
function buildBenfordDataset(n: number): number[] {
  const expected: Record<string, number> = {
    '1': 0.301, '2': 0.176, '3': 0.125, '4': 0.097,
    '5': 0.079, '6': 0.067, '7': 0.058, '8': 0.051, '9': 0.046,
  };
  const values: number[] = [];
  for (let d = 1; d <= 9; d++) {
    const count = Math.round(n * expected[String(d)]);
    for (let i = 0; i < count; i++) {
      values.push(d * 10); // e.g. 10, 20, 30 … all have the correct leading digit
    }
  }
  return values;
}

/** All n values start with the digit 1 — maximum deviation from Benford. */
function buildUniformLeadingOnes(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 100 + i);
}

/** n values where each digit 1–9 appears equally often. */
function buildUniformDistribution(n: number): number[] {
  const values: number[] = [];
  const perDigit = Math.ceil(n / 9);
  for (let d = 1; d <= 9; d++) {
    for (let j = 0; j < perDigit; j++) {
      values.push(d * 10);
    }
  }
  return values.slice(0, n);
}

// ---------------------------------------------------------------------------
// Empty / degenerate inputs
// ---------------------------------------------------------------------------

describe('validateBenford — empty input', () => {
  it('returns isValid=true and score=1 for an empty array', () => {
    const r = validateBenford([]);
    expect(r.isValid).toBe(true);
    expect(r.score).toBe(1.0);
    expect(r.chiSquare).toBe(0);
  });

  it('returns confidence=low for an empty array', () => {
    expect(validateBenford([]).confidence).toBe('low');
  });

  it('returns an empty distribution for an empty array', () => {
    expect(validateBenford([])).toMatchObject({ distribution: {} });
  });
});

describe('validateBenford — no valid values (all < 1)', () => {
  it('treats all values < 1 as having no valid leading digits', () => {
    const r = validateBenford([0.1, 0.5, -0.9, 0]);
    expect(r.isValid).toBe(true);
    expect(r.score).toBe(1.0);
    expect(r.chiSquare).toBe(0);
  });

  it('also handles the value 0 correctly (skipped — not a valid leading digit)', () => {
    const r = validateBenford([0, 0, 0]);
    expect(r.isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Confidence bands
// ---------------------------------------------------------------------------

describe('validateBenford — confidence bands', () => {
  it('returns confidence=low when fewer than 30 valid numbers', () => {
    const r = validateBenford(buildBenfordDataset(20));
    expect(r.confidence).toBe('low');
  });

  it('returns confidence=medium for 30–99 valid numbers', () => {
    const r = validateBenford(buildBenfordDataset(50));
    expect(r.confidence).toBe('medium');
  });

  it('returns confidence=high for 100+ valid numbers', () => {
    const r = validateBenford(buildBenfordDataset(200));
    expect(r.confidence).toBe('high');
  });

  it('confidence boundary: exactly 30 values → medium', () => {
    const r = validateBenford(buildBenfordDataset(30));
    expect(r.confidence).toBe('medium');
  });

  it('confidence boundary: exactly 100 values → high', () => {
    const r = validateBenford(buildBenfordDataset(100));
    expect(r.confidence).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// Perfect Benford dataset
// ---------------------------------------------------------------------------

describe('validateBenford — near-perfect Benford distribution', () => {
  it('returns isValid=true for a perfect Benford dataset', () => {
    const r = validateBenford(buildBenfordDataset(1000));
    expect(r.isValid).toBe(true);
  });

  it('returns a high score (> 0.85) for a perfect Benford dataset', () => {
    const r = validateBenford(buildBenfordDataset(1000));
    expect(r.score).toBeGreaterThan(0.85);
  });

  it('returns a low chi-square (< 15.507) for a perfect Benford dataset', () => {
    const r = validateBenford(buildBenfordDataset(1000));
    expect(r.chiSquare).toBeLessThan(15.507);
  });
});

// ---------------------------------------------------------------------------
// Strongly non-Benford dataset
// ---------------------------------------------------------------------------

describe('validateBenford — all values starting with digit 1 (worst case)', () => {
  it('returns isValid=false for 100+ values all starting with 1', () => {
    const r = validateBenford(buildUniformLeadingOnes(100));
    expect(r.isValid).toBe(false);
  });

  it('returns a large chi-square (> 15.507) for the leading-ones dataset', () => {
    const r = validateBenford(buildUniformLeadingOnes(100));
    expect(r.chiSquare).toBeGreaterThan(15.507);
  });

  it('returns a low score (< 0.5) for the leading-ones dataset', () => {
    const r = validateBenford(buildUniformLeadingOnes(100));
    expect(r.score).toBeLessThan(0.5);
  });

  it('score never goes below 0', () => {
    const r = validateBenford(buildUniformLeadingOnes(500));
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Uniform distribution (all digits equally likely)
// ---------------------------------------------------------------------------

describe('validateBenford — uniform leading-digit distribution', () => {
  it('returns isValid=false for a large uniformly-distributed dataset', () => {
    const r = validateBenford(buildUniformDistribution(200));
    expect(r.isValid).toBe(false);
  });

  it('reports chi-square > critical value for uniform distribution', () => {
    const r = validateBenford(buildUniformDistribution(200));
    expect(r.chiSquare).toBeGreaterThan(15.507);
  });
});

// ---------------------------------------------------------------------------
// Distribution output
// ---------------------------------------------------------------------------

describe('validateBenford — distribution object', () => {
  it('returns observed frequencies (values between 0 and 1) for all digits 1–9', () => {
    const r = validateBenford(buildBenfordDataset(100));
    for (let d = 1; d <= 9; d++) {
      const freq = r.distribution[String(d)];
      expect(freq).toBeGreaterThanOrEqual(0);
      expect(freq).toBeLessThanOrEqual(1);
    }
  });

  it('distribution frequencies sum to approximately 1', () => {
    const r = validateBenford(buildBenfordDataset(100));
    const total = Object.values(r.distribution).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 1);
  });
});

// ---------------------------------------------------------------------------
// Negative values and mixed datasets
// ---------------------------------------------------------------------------

describe('validateBenford — negative and mixed values', () => {
  it('uses the absolute value for leading-digit detection', () => {
    // [-100, -200] should be treated the same as [100, 200]
    const negative = validateBenford([-100, -200]);
    const positive = validateBenford([100, 200]);
    expect(negative.chiSquare).toBeCloseTo(positive.chiSquare, 6);
  });

  it('skips values whose absolute value is < 1', () => {
    // Only [150, 250] should count — the 0.5 is skipped
    const r = validateBenford([150, 250, 0.5]);
    expect(Object.values(r.distribution).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });
});
