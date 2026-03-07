/**
 * Unit tests for LeverageMetrics MLB Projection Engine core modules.
 * Tests pure functions only — no external fetches, no mocked modules needed.
 */

import { describe, it, expect } from 'vitest';
import {
  simulateHitter,
  simulatePitcher,
  formatPercentiles,
} from '@/lib/mlb-projections/monte-carlo';
import type { HitterProjectedStats, PitcherProjectedStats } from '@/lib/mlb-projections/models';
import {
  hrProbabilityPerAB,
  kProbabilityPerAB,
  pitcherBreakoutScore,
  computeHitterProbs,
  computePitcherProbs,
} from '@/lib/mlb-projections/models';
import type { HitterFeatures, PitcherFeatures, BiomechanicsFeatures } from '@/lib/mlb-projections/feature-engineering';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const avgHitterFeatures: HitterFeatures = {
  playerId: 1,
  playerName: 'Test Hitter',
  team: 'NYY',
  position: 'OF',
  bats: 'R',
  exitVelocity: 88,
  launchAngle: 12,
  pullPct: 40,
  barrelPct: 8,
  iso: 0.18,
  hrFbRatio: 0.12,
  xwOBA: 0.315,
  pullPowerScore: 3.2,
  parkFactor: 1.0,
  weatherAdjustment: 0,
  platoonAdvantage: 0,
  umpireZoneTendency: 0,
};

const eliteHitterFeatures: HitterFeatures = {
  ...avgHitterFeatures,
  playerId: 2,
  playerName: 'Elite Hitter',
  exitVelocity: 96,
  launchAngle: 16,
  barrelPct: 20,
  iso: 0.30,
  hrFbRatio: 0.25,
  pullPowerScore: 8.0,
};

const avgPitcherFeatures: PitcherFeatures = {
  playerId: 10,
  playerName: 'Test Pitcher',
  team: 'LAD',
  throws: 'R',
  kPct: 22,
  bbPct: 8,
  hrPer9: 1.2,
  velocity: 93.5,
  spinRate: 2200,
  pitchMixEntropy: 0.6,
  releaseExtension: 6.0,
  parkFactor: 1.0,
  weatherAdjustment: 0,
};

const elitePitcherFeatures: PitcherFeatures = {
  ...avgPitcherFeatures,
  playerId: 11,
  playerName: 'Elite Pitcher',
  kPct: 32,
  velocity: 97,
  spinRate: 2500,
  bbPct: 5,
  hrPer9: 0.8,
};

const avgBiomechanics: BiomechanicsFeatures = {
  velocityTrend: 0,
  spinEfficiency: 50,
  kineticChainScore: 0.5,
  armSlotConsistency: 0.5,
  strideLength: 0.5,
  hipShoulderSeparation: 0.5,
  releaseHeight: 0.5,
  movementScore: 0.5,
};

const avgHitterProbs: HitterProjectedStats = {
  hrPerAB: 0.04,
  hrPerGame: 0.15,
  hitProb: 0.27,
  rbiProb: 0.11,
  runProb: 0.15,
  sbProb: 0.05,
  kProb: 0.24,
  bbProb: 0.085,
};

const zeroProbHitter: HitterProjectedStats = {
  hrPerAB: 0,
  hrPerGame: 0,
  hitProb: 0,
  rbiProb: 0,
  runProb: 0,
  sbProb: 0,
  kProb: 0,
  bbProb: 0,
};

const certainHrHitter: HitterProjectedStats = {
  hrPerAB: 1,
  hrPerGame: 1,
  hitProb: 1,
  rbiProb: 1,
  runProb: 1,
  sbProb: 0,
  kProb: 0,
  bbProb: 0,
};

const avgPitcherProbs: PitcherProjectedStats = {
  kPerAB: 0.25,
  kPerInning: 0.75,
  ksPer9: 8.5,
  whip: 1.25,
  eraPitched: 4.0,
  winProbAbove500: 0.5,
};

// ─── Monte Carlo: simulateHitter ─────────────────────────────────────────────

describe('simulateHitter', () => {
  it('returns an object with all required SimulationResult fields', () => {
    const result = simulateHitter(avgHitterProbs, 500);
    for (const key of ['hrs', 'hits', 'rbis', 'runs', 'sbs', 'ks', 'dkPts'] as const) {
      expect(result[key]).toBeDefined();
      expect(typeof result[key].p50).toBe('number');
      expect(typeof result[key].mean).toBe('number');
    }
  });

  it('percentiles satisfy P10 ≤ P50 ≤ P90 for all stats', () => {
    const result = simulateHitter(avgHitterProbs, 500);
    for (const sim of Object.values(result)) {
      expect(sim.p10).toBeLessThanOrEqual(sim.p50);
      expect(sim.p50).toBeLessThanOrEqual(sim.p90);
    }
  });

  it('zeroProbHitter produces P50 HRs = 0', () => {
    const result = simulateHitter(zeroProbHitter, 1000);
    expect(result.hrs.p50).toBe(0);
    expect(result.hrs.p90).toBe(0);
  });

  it('certainHrHitter produces P50 HRs = 4 (AT_BATS_PER_GAME)', () => {
    const result = simulateHitter(certainHrHitter, 1000);
    // Every AB is a HR (prob=1.0), so each game = 4 HRs
    expect(result.hrs.p50).toBe(4);
  });

  it('DK points are non-negative for zero-prob hitter', () => {
    const result = simulateHitter(zeroProbHitter, 500);
    expect(result.dkPts.p10).toBeGreaterThanOrEqual(0);
    expect(result.dkPts.mean).toBeGreaterThanOrEqual(0);
  });

  it('strong hitter projects more HR than weak hitter', () => {
    // Use unsaturated features to ensure meaningful hrPerAB difference
    // Weak: low barrel, low EV, pitcher-friendly park → logit ≈ -4.07 → p ≈ 0.017
    const weakFeatures: HitterFeatures = {
      ...avgHitterFeatures,
      exitVelocity: 83,
      launchAngle: 8,
      barrelPct: 2,
      iso: 0.07,
      hrFbRatio: 0.04,
      pullPowerScore: 0.8,
      parkFactor: 0.88,
      weatherAdjustment: 0,
    };
    // Strong: moderate barrel, neutral park → logit ≈ -2.75 → p ≈ 0.060
    const strongFeatures: HitterFeatures = {
      ...avgHitterFeatures,
      exitVelocity: 88,
      launchAngle: 12,
      barrelPct: 6,
      iso: 0.14,
      hrFbRatio: 0.09,
      pullPowerScore: 2.4,
      parkFactor: 0.95,
      weatherAdjustment: 0,
    };
    const weakProbs   = computeHitterProbs(weakFeatures);
    const strongProbs = computeHitterProbs(strongFeatures);
    // Sanity: underlying probabilities must differ clearly
    expect(strongProbs.hrPerAB).toBeGreaterThan(weakProbs.hrPerAB);
    // Simulate at N=1000 — difference is ~10σ so this is effectively deterministic
    const weakSim   = simulateHitter(weakProbs,   1000);
    const strongSim = simulateHitter(strongProbs, 1000);
    expect(strongSim.hrs.mean).toBeGreaterThan(weakSim.hrs.mean);
  });

  it('distribution array has exactly N entries', () => {
    const N = 200;
    const result = simulateHitter(avgHitterProbs, N);
    expect(result.hrs.distribution).toHaveLength(N);
  });
});

// ─── Monte Carlo: simulatePitcher ────────────────────────────────────────────

describe('simulatePitcher', () => {
  it('returns an object with ks, whip, wins, dkPts', () => {
    const result = simulatePitcher(avgPitcherProbs, 500);
    expect(result.ks).toBeDefined();
    expect(result.whip).toBeDefined();
    expect(result.wins).toBeDefined();
    expect(result.dkPts).toBeDefined();
  });

  it('percentiles satisfy P10 ≤ P50 ≤ P90 for Ks', () => {
    const result = simulatePitcher(avgPitcherProbs, 500);
    expect(result.ks.p10).toBeLessThanOrEqual(result.ks.p50);
    expect(result.ks.p50).toBeLessThanOrEqual(result.ks.p90);
  });

  it('win prob 0 → wins.mean ≈ 0', () => {
    const noWinProbs: PitcherProjectedStats = { ...avgPitcherProbs, winProbAbove500: 0 };
    const result = simulatePitcher(noWinProbs, 500);
    expect(result.wins.mean).toBe(0);
  });

  it('win prob 1 → wins.mean ≈ 1', () => {
    const alwaysWinsProbs: PitcherProjectedStats = { ...avgPitcherProbs, winProbAbove500: 1 };
    const result = simulatePitcher(alwaysWinsProbs, 500);
    expect(result.wins.mean).toBe(1);
  });

  it('elite pitcher projects more Ks than weak pitcher', () => {
    // Use unsaturated features so kPerAB differs meaningfully between the two pitchers
    const weakFeatures: PitcherFeatures = {
      ...avgPitcherFeatures,
      kPct: 10,
      velocity: 90,
      spinRate: 1800,
      bbPct: 12,
      hrPer9: 2.5,
      pitchMixEntropy: 0.2,
      releaseExtension: 5.0,
    };
    const weakProbs  = computePitcherProbs(weakFeatures);
    const eliteProbs = computePitcherProbs(elitePitcherFeatures);
    // Verify the underlying probabilities differ before simulating
    expect(eliteProbs.kPerAB).toBeGreaterThan(weakProbs.kPerAB);
    const eliteSim = simulatePitcher(eliteProbs, 2000);
    const weakSim  = simulatePitcher(weakProbs, 2000);
    expect(eliteSim.ks.mean).toBeGreaterThan(weakSim.ks.mean);
  });

  it('DK points are non-negative', () => {
    const result = simulatePitcher(avgPitcherProbs, 500);
    expect(result.dkPts.p10).toBeGreaterThanOrEqual(0);
  });
});

// ─── Monte Carlo: formatPercentiles ──────────────────────────────────────────

describe('formatPercentiles', () => {
  it('returns string values for p10, p50, p90, mean', () => {
    const result = simulateHitter(avgHitterProbs, 200);
    const formatted = formatPercentiles(result.hrs);
    expect(typeof formatted.p10).toBe('string');
    expect(typeof formatted.p50).toBe('string');
    expect(typeof formatted.p90).toBe('string');
    expect(typeof formatted.mean).toBe('string');
  });

  it('respects decimals parameter', () => {
    const result = simulateHitter(avgHitterProbs, 200);
    const f1 = formatPercentiles(result.hrs, 1);
    const f3 = formatPercentiles(result.hrs, 3);
    expect(f1.p50.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(1);
    expect(f3.p50.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });
});

// ─── Models: hrProbabilityPerAB ───────────────────────────────────────────────

describe('hrProbabilityPerAB', () => {
  it('returns a value in [0.01, 0.12]', () => {
    const p = hrProbabilityPerAB(avgHitterFeatures);
    expect(p).toBeGreaterThanOrEqual(0.01);
    expect(p).toBeLessThanOrEqual(0.12);
  });

  it('elite hitter has higher HR prob than average hitter', () => {
    const avgP = hrProbabilityPerAB(avgHitterFeatures);
    const eliteP = hrProbabilityPerAB(eliteHitterFeatures);
    expect(eliteP).toBeGreaterThan(avgP);
  });

  it('higher barrel rate monotonically increases HR prob (all else equal)', () => {
    // Use a weak-hitter base to stay well below the 0.12 ceiling
    const weakBase: HitterFeatures = {
      ...avgHitterFeatures,
      exitVelocity: 85,
      launchAngle: 8,
      iso: 0.10,
      hrFbRatio: 0.06,
      xwOBA: 0.280,
      pullPowerScore: 1.0,
      parkFactor: 0.90,
      weatherAdjustment: -0.05,
    };
    const p2  = hrProbabilityPerAB({ ...weakBase, barrelPct: 2 });
    const p5  = hrProbabilityPerAB({ ...weakBase, barrelPct: 5 });
    const p8  = hrProbabilityPerAB({ ...weakBase, barrelPct: 8 });
    expect(p5).toBeGreaterThan(p2);
    expect(p8).toBeGreaterThan(p5);
  });

  it('HR-friendly park factor increases HR prob', () => {
    const neutral = hrProbabilityPerAB({ ...avgHitterFeatures, parkFactor: 1.0 });
    const hrFriendly = hrProbabilityPerAB({ ...avgHitterFeatures, parkFactor: 1.15 });
    expect(hrFriendly).toBeGreaterThan(neutral);
  });
});

// ─── Models: kProbabilityPerAB ────────────────────────────────────────────────

describe('kProbabilityPerAB', () => {
  it('returns a value in [0.10, 0.45]', () => {
    const p = kProbabilityPerAB(avgPitcherFeatures);
    expect(p).toBeGreaterThanOrEqual(0.10);
    expect(p).toBeLessThanOrEqual(0.45);
  });

  it('elite pitcher has K prob ≥ average pitcher K prob', () => {
    // Both may hit the 0.45 ceiling — use ≥ to test that elite is never worse
    const avgP = kProbabilityPerAB(avgPitcherFeatures);
    const eliteP = kProbabilityPerAB(elitePitcherFeatures);
    expect(eliteP).toBeGreaterThanOrEqual(avgP);
  });

  it('higher K% increases K probability (using unsaturated inputs)', () => {
    // Use a low-velocity, low-spinrate base to keep logit below the 0.45 ceiling
    const weakBase: PitcherFeatures = {
      ...avgPitcherFeatures,
      velocity: 90,
      spinRate: 1800,
      bbPct: 10,
      hrPer9: 2.0,
      pitchMixEntropy: 0.3,
      releaseExtension: 5.5,
    };
    const low  = kProbabilityPerAB({ ...weakBase, kPct: 10 });
    const high = kProbabilityPerAB({ ...weakBase, kPct: 15 });
    expect(high).toBeGreaterThan(low);
  });
});

// ─── Models: pitcherBreakoutScore ─────────────────────────────────────────────

describe('pitcherBreakoutScore', () => {
  it('returns a value in [0, 100]', () => {
    const score = pitcherBreakoutScore(avgBiomechanics);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('all-min inputs clamp to 0', () => {
    const minBio: BiomechanicsFeatures = {
      velocityTrend: -1,
      spinEfficiency: 0,
      kineticChainScore: 0,
      armSlotConsistency: 0,
      strideLength: 0,
      hipShoulderSeparation: 0,
      releaseHeight: 0,
      movementScore: 0,
    };
    expect(pitcherBreakoutScore(minBio)).toBe(0);
  });

  it('all-max inputs produce a score in [80, 100]', () => {
    // The weighted sum of all max inputs is 90 (sum of all weights),
    // which is clamped to [0, 100] and rounded — so result is 90.
    const maxBio: BiomechanicsFeatures = {
      velocityTrend: 1,
      spinEfficiency: 100,
      kineticChainScore: 1,
      armSlotConsistency: 1,
      strideLength: 1,
      hipShoulderSeparation: 1,
      releaseHeight: 1,
      movementScore: 1,
    };
    const score = pitcherBreakoutScore(maxBio);
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns an integer (Math.round applied)', () => {
    const score = pitcherBreakoutScore(avgBiomechanics);
    expect(score).toBe(Math.round(score));
  });
});

// ─── Models: computeHitterProbs ──────────────────────────────────────────────

describe('computeHitterProbs', () => {
  it('all probabilities are in [0, 1]', () => {
    const probs = computeHitterProbs(avgHitterFeatures);
    expect(probs.hrPerAB).toBeGreaterThanOrEqual(0);
    expect(probs.hrPerAB).toBeLessThanOrEqual(1);
    expect(probs.hitProb).toBeGreaterThanOrEqual(0);
    expect(probs.hitProb).toBeLessThanOrEqual(1);
    expect(probs.kProb).toBeGreaterThanOrEqual(0);
    expect(probs.kProb).toBeLessThanOrEqual(1);
    expect(probs.bbProb).toBeGreaterThanOrEqual(0);
    expect(probs.bbProb).toBeLessThanOrEqual(1);
  });

  it('hrPerGame > hrPerAB (multi-AB opportunity)', () => {
    const probs = computeHitterProbs(avgHitterFeatures);
    // P(at least 1 HR in 4 AB) > P(HR in 1 AB) when prob > 0
    expect(probs.hrPerGame).toBeGreaterThan(probs.hrPerAB);
  });
});

// ─── Models: computePitcherProbs ─────────────────────────────────────────────

describe('computePitcherProbs', () => {
  it('kPerAB is in [0.10, 0.45]', () => {
    const probs = computePitcherProbs(avgPitcherFeatures);
    expect(probs.kPerAB).toBeGreaterThanOrEqual(0.10);
    expect(probs.kPerAB).toBeLessThanOrEqual(0.45);
  });

  it('ksPer9 = kPerAB * 27', () => {
    const probs = computePitcherProbs(avgPitcherFeatures);
    expect(probs.ksPer9).toBeCloseTo(probs.kPerAB * 27, 5);
  });

  it('winProbAbove500 is in [0.1, 0.8]', () => {
    const probs = computePitcherProbs(avgPitcherFeatures);
    expect(probs.winProbAbove500).toBeGreaterThanOrEqual(0.1);
    expect(probs.winProbAbove500).toBeLessThanOrEqual(0.8);
  });
});
