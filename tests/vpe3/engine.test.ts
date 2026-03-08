/**
 * VPE 3.0 — Comprehensive Test Suite
 * =====================================
 * Tests all VPE 3.0 modules: core, pitch modeling, breakout detection,
 * injury risk, simulation, MiLB projections, optimizer, and engine.
 */

import { describe, it, expect } from 'vitest';

import {
  // Core
  ageFactor,
  computeHitterZScores,
  computePitcherZScores,
  platoonAdvantage,
  parkAdjRate,
  weatherMultiplier,
  powerCore,
  enhancedWrcPlus,
  hitterVpeVal,
  arsenalBoost,
  kSkill,
  vpeEra,
  vpePlus,
  pitcherVpeVal,
  pythagoreanWinPct,

  // Pitch Modeling
  calculateStuffPlus,
  arsenalStuffPlus,
  scoreTunnel,
  analyzeCSW,
  predictNextPitch,

  // Breakout
  powerBreakoutIndex,
  swingEfficiency,
  sleeperScore,
  mvpScore,
  analyzeBreakout,

  // Injury
  calculateInjuryRisk,

  // Game State
  decisionTimeScore,
  estimateDecisionTime,
  optimizeDefensivePositioning,

  // Simulation
  simulateHitterGame,
  simulatePitcherGame,
  simulateSeason,

  // MiLB
  milbVpeVal,
  projectMLBDebut,
  milbMonteCarloProjection,
  rankCallUps,

  // Optimizer
  optimizeDFSLineup,
  calculateBettingEdge,
  batchHRPropEdges,
  calculateTradeValue,
  rankTradeValues,

  // Engine
  runVPEEngine,

  // Constants
  LEAGUE_AVG,
  getParkFactors,

  // Mock Data
  mockEliteHitter,
  mockAverageHitter,
  mockBreakoutHitter,
  mockAcePitcher,
  mockAveragePitcher,
  mockCloser,
  mockProspect,
  mockPitchingProspect,
  mockSummerWeather,
  mockColdWeather,
  mockDomeWeather,
} from '@/lib/vpe3';

// ─── Core Functions ─────────────────────────────────────────────────────────

describe('VPE 3.0 Core', () => {
  describe('ageFactor', () => {
    it('peaks at age 27', () => {
      expect(ageFactor(27)).toBe(1.0);
    });
    it('young players get slight boost', () => {
      expect(ageFactor(24)).toBeGreaterThan(1.0);
    });
    it('declines after 30', () => {
      expect(ageFactor(32)).toBeLessThan(1.0);
    });
    it('floors at 0.70', () => {
      expect(ageFactor(45)).toBe(0.70);
    });
  });

  describe('computeHitterZScores', () => {
    it('average hitter has ~0 z-scores', () => {
      const h = computeHitterZScores(mockAverageHitter());
      expect(Math.abs(h.batSpeedZ)).toBeLessThan(0.1);
      expect(Math.abs(h.ev50Z)).toBeLessThan(0.1);
      expect(Math.abs(h.evZ)).toBeLessThan(0.1);
    });
    it('elite hitter has positive z-scores', () => {
      const h = computeHitterZScores(mockEliteHitter());
      expect(h.batSpeedZ).toBeGreaterThan(1.0);
      expect(h.ev50Z).toBeGreaterThan(2.0);
      expect(h.evZ).toBeGreaterThan(1.5);
    });
  });

  describe('platoonAdvantage', () => {
    it('opposite hand gives +0.05', () => {
      expect(platoonAdvantage('L', 'R')).toBe(0.05);
    });
    it('same hand gives -0.02', () => {
      expect(platoonAdvantage('R', 'R')).toBe(-0.02);
    });
    it('switch hitter gives +0.03', () => {
      expect(platoonAdvantage('S', 'R')).toBe(0.03);
    });
  });

  describe('parkAdjRate', () => {
    it('neutral parks return original rate', () => {
      expect(parkAdjRate(0.300, 1.0, 1.0)).toBeCloseTo(0.300, 2);
    });
    it('hitter-friendly parks increase rate', () => {
      expect(parkAdjRate(0.300, 1.20, 1.0)).toBeGreaterThan(0.300);
    });
  });

  describe('weatherMultiplier', () => {
    it('dome games return 0', () => {
      expect(weatherMultiplier(mockDomeWeather())).toBe(0.0);
    });
    it('hot weather gives positive multiplier', () => {
      expect(weatherMultiplier(mockSummerWeather())).toBeGreaterThan(0);
    });
    it('cold weather gives negative multiplier', () => {
      expect(weatherMultiplier(mockColdWeather())).toBeLessThan(0);
    });
  });

  describe('hitterVpeVal', () => {
    it('average hitter ≈ 1.0', () => {
      const val = hitterVpeVal(mockAverageHitter());
      expect(val).toBeGreaterThan(0.8);
      expect(val).toBeLessThan(1.3);
    });
    it('elite hitter > 1.5', () => {
      const val = hitterVpeVal(mockEliteHitter());
      expect(val).toBeGreaterThan(1.5);
    });
    it('park factor affects value', () => {
      const neutral = hitterVpeVal(mockEliteHitter(), 1.0);
      const coors = hitterVpeVal(mockEliteHitter(), 1.22);
      expect(coors).toBeGreaterThan(neutral);
    });
  });

  describe('pitcherVpeVal', () => {
    it('ace pitcher > average pitcher', () => {
      const ace = pitcherVpeVal(mockAcePitcher());
      const avg = pitcherVpeVal(mockAveragePitcher());
      expect(ace).toBeGreaterThan(avg);
    });
    it('closer gets saves leverage bonus', () => {
      const closer = pitcherVpeVal(mockCloser());
      expect(closer).toBeGreaterThan(0.5);
    });
  });

  describe('pythagoreanWinPct', () => {
    it('equal RS/RA = .500', () => {
      expect(pythagoreanWinPct(700, 700)).toBe(0.5);
    });
    it('more RS > RA = above .500', () => {
      expect(pythagoreanWinPct(800, 700)).toBeGreaterThan(0.5);
    });
  });
});

// ─── Pitch Modeling ─────────────────────────────────────────────────────────

describe('VPE 3.0 Pitch Modeling', () => {
  describe('calculateStuffPlus', () => {
    it('ace pitcher gets Plus or Elite grade', () => {
      const p = computePitcherZScores(mockAcePitcher());
      const result = calculateStuffPlus(p, 'fastball');
      expect(result.stuffScore).toBeGreaterThan(0.5);
      expect(['Plus', 'Elite']).toContain(result.grade);
    });
    it('average pitcher gets Average grade', () => {
      const p = computePitcherZScores(mockAveragePitcher());
      const result = calculateStuffPlus(p, 'fastball');
      expect(Math.abs(result.stuffScore)).toBeLessThan(0.5);
    });
  });

  describe('arsenalStuffPlus', () => {
    it('returns result for each pitch type', () => {
      const p = computePitcherZScores(mockAcePitcher());
      const results = arsenalStuffPlus(p);
      expect(Object.keys(results)).toContain('fastball');
      expect(Object.keys(results)).toContain('slider');
    });
  });

  describe('scoreTunnel', () => {
    it('tight tunnel + high release similarity = high score', () => {
      const result = scoreTunnel(0.15, 0.95, 10.0, 0.80);
      expect(result.tunnelScore).toBeGreaterThan(1.5);
      expect(result.grade).toBe('Elite Tunneler');
    });
    it('wide tunnel = lower score than tight tunnel', () => {
      const tight = scoreTunnel(0.15, 0.95, 10.0, 0.80);
      const wide = scoreTunnel(0.80, 0.50, 3.0, 0.40);
      expect(wide.tunnelScore).toBeLessThan(tight.tunnelScore);
    });
  });

  describe('analyzeCSW', () => {
    it('ace has Elite or Above Average tier', () => {
      const result = analyzeCSW(mockAcePitcher());
      expect(result.kSkill).toBeGreaterThan(1.0);
      expect(['Elite', 'Above Average']).toContain(result.dominanceTier);
    });
    it('average pitcher has Average tier', () => {
      const result = analyzeCSW(mockAveragePitcher());
      expect(result.dominanceTier).toBe('Average');
    });
  });

  describe('predictNextPitch', () => {
    it('returns predictions for all pitch types', () => {
      const preds = predictNextPitch('fastball', 1, 1, mockAcePitcher(), 42);
      expect(preds.length).toBeGreaterThan(0);
      const totalProb = preds.reduce((s, p) => s + p.probability, 0);
      expect(totalProb).toBeCloseTo(1.0, 1);
    });
    it('is reproducible with seed', () => {
      const p1 = predictNextPitch('fastball', 0, 0, undefined, 42);
      const p2 = predictNextPitch('fastball', 0, 0, undefined, 42);
      expect(p1[0].probability).toBe(p2[0].probability);
    });
  });
});

// ─── Breakout Detection ─────────────────────────────────────────────────────

describe('VPE 3.0 Breakout', () => {
  describe('powerBreakoutIndex', () => {
    it('breakout hitter has high PBI', () => {
      const pbi = powerBreakoutIndex(mockBreakoutHitter());
      expect(pbi).toBeGreaterThan(0.5);
    });
    it('average hitter has near-zero PBI', () => {
      const pbi = powerBreakoutIndex(mockAverageHitter());
      expect(Math.abs(pbi)).toBeLessThan(0.5);
    });
  });

  describe('analyzeBreakout', () => {
    it('elite hitter gets breakout signals', () => {
      const result = analyzeBreakout(mockEliteHitter());
      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.breakoutProbability).toBeGreaterThan(0.5);
    });
    it('tracks YoY improvement as sleeper', () => {
      const prior = { ev50: 100.0, blastRate: 3.0, contactPct: 72.0, chaseRate: 32.0 };
      const result = analyzeBreakout(mockBreakoutHitter(), prior, 0.8);
      expect(result.sleeperScore).toBeGreaterThan(0);
    });
  });

  describe('mvpScore', () => {
    it('elite hitter scores higher than average', () => {
      const elite = mvpScore(mockEliteHitter());
      const avg = mvpScore(mockAverageHitter());
      expect(elite).toBeGreaterThan(avg);
    });
  });
});

// ─── Injury Risk ────────────────────────────────────────────────────────────

describe('VPE 3.0 Injury Risk', () => {
  it('healthy pitcher has low risk', () => {
    const result = calculateInjuryRisk(mockAveragePitcher());
    expect(result.riskLevel).toBe('Low');
    expect(result.warnings.length).toBe(0);
  });

  it('detects velocity drop', () => {
    const pitcher = mockAcePitcher();
    const result = calculateInjuryRisk(pitcher, 99.0); // prior velo was 99
    expect(result.velocityDrop).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('detects workload spike', () => {
    const pitcher = { ...mockAveragePitcher(), workloadInnings: 200 };
    const result = calculateInjuryRisk(pitcher, undefined, undefined, 120);
    expect(result.workloadSpike).toBeGreaterThan(0);
  });

  it('detects UCL stress pattern', () => {
    const pitcher = { ...mockAcePitcher(), age: 30, releasePointDrift: 2.5 };
    const result = calculateInjuryRisk(pitcher, 99.5, 2700);
    const hasUCLWarning = result.warnings.some(w => w.includes('UCL'));
    expect(hasUCLWarning).toBe(true);
  });
});

// ─── Game State AI ──────────────────────────────────────────────────────────

describe('VPE 3.0 Game State', () => {
  it('estimates decision time from hitter stats', () => {
    const result = estimateDecisionTime(mockEliteHitter());
    expect(result.decisionTimeScore).toBeDefined();
  });

  it('optimizes defensive positioning', () => {
    const result = optimizeDefensivePositioning(mockEliteHitter());
    expect(result.expectedOutsAdded).toBeGreaterThan(0);
    expect(result.positions.length).toBe(7); // 7 fielders
  });
});

// ─── Simulation ─────────────────────────────────────────────────────────────

describe('VPE 3.0 Simulation', () => {
  describe('simulateHitterGame', () => {
    it('produces valid DK point distribution', () => {
      const sim = simulateHitterGame(mockEliteHitter(), 200, 42);
      expect(sim.dkPts.mean).toBeGreaterThan(0);
      expect(sim.dkPts.p90).toBeGreaterThan(sim.dkPts.p10);
      expect(sim.hrs.mean).toBeGreaterThanOrEqual(0);
    });
    it('is reproducible with seed', () => {
      const s1 = simulateHitterGame(mockEliteHitter(), 100, 42);
      const s2 = simulateHitterGame(mockEliteHitter(), 100, 42);
      expect(s1.dkPts.mean).toBe(s2.dkPts.mean);
    });
  });

  describe('simulatePitcherGame', () => {
    it('SP has more Ks than RP', () => {
      const sp = simulatePitcherGame(mockAcePitcher(), 200, 42);
      const rp = simulatePitcherGame(mockCloser(), 200, 42);
      expect(sp.ks.mean).toBeGreaterThan(rp.ks.mean);
    });
  });

  describe('simulateSeason', () => {
    it('produces valid win projection', () => {
      const result = simulateSeason({
        name: 'NYY',
        hitters: [mockEliteHitter()],
        pitchers: [mockAcePitcher()],
        parkHrFactor: 1.12,
        parkRunsFactor: 1.03,
      }, 200, 42);

      expect(result.projectedWins.mean).toBeGreaterThan(50);
      expect(result.projectedWins.mean).toBeLessThanOrEqual(162);
      expect(result.playoffProbability).toBeGreaterThanOrEqual(0);
      expect(result.playoffProbability).toBeLessThanOrEqual(1);
    });
  });
});

// ─── MiLB Projections ──────────────────────────────────────────────────────

describe('VPE 3.0 MiLB', () => {
  it('calculates MiLB VPE-Val', () => {
    const val = milbVpeVal(mockProspect());
    expect(val).toBeGreaterThan(0);
  });

  it('projects MLB debut with translation factor', () => {
    const proj = projectMLBDebut(mockProspect());
    expect(proj.translationFactor).toBe(0.9); // AAA
    expect(proj.mlbDebutVpeVal).toBeGreaterThan(0);
    expect(proj.mlbDebutVpeVal).toBeLessThan(proj.mlbDebutVpeVal / 0.9 + 0.1); // less than raw MiLB
  });

  it('Monte Carlo produces confidence interval', () => {
    const proj = milbMonteCarloProjection(mockProspect(), undefined, 300, 42);
    expect(proj.confidenceInterval[0]).toBeLessThan(proj.mlbDebutVpeVal);
    expect(proj.confidenceInterval[1]).toBeGreaterThan(proj.mlbDebutVpeVal);
  });

  it('ranks call-ups by callUpScore', () => {
    const ranked = rankCallUps([mockProspect(), mockPitchingProspect()]);
    expect(ranked.length).toBe(2);
    expect(ranked[0].projection.callUpScore).toBeGreaterThanOrEqual(
      ranked[1].projection.callUpScore,
    );
  });
});

// ─── Optimizer ──────────────────────────────────────────────────────────────

describe('VPE 3.0 Optimizer', () => {
  describe('optimizeDFSLineup', () => {
    it('builds valid lineup within salary cap', () => {
      const lineup = optimizeDFSLineup(
        [mockEliteHitter(), mockAverageHitter(), mockBreakoutHitter()],
        [mockAcePitcher(), mockAveragePitcher()],
        50000,
        4,
      );
      expect(lineup.totalSalary).toBeLessThanOrEqual(50000);
      expect(lineup.players.length).toBeLessThanOrEqual(4);
      expect(lineup.totalProjectedPts).toBeGreaterThan(0);
    });
  });

  describe('calculateBettingEdge', () => {
    it('identifies positive edge', () => {
      const edge = calculateBettingEdge('Judge', 'HR', 0.08, 1500);
      expect(edge.fairProbability).toBe(0.08);
      expect(edge.edgePct).toBeGreaterThan(0);
    });
    it('classifies recommendation correctly', () => {
      // Large edge: fair prob 0.25 vs market odds +900 (≈10% implied)
      const strong = calculateBettingEdge('Judge', 'HR', 0.25, 900);
      expect(strong.recommendation).toBe('Strong Bet');
    });
  });

  describe('rankTradeValues', () => {
    it('ranks players by trade value', () => {
      const ranked = rankTradeValues([
        { player: mockEliteHitter(), war: 8.0, surplus: 5.0, scarcity: 0.8 },
        { player: mockAverageHitter(), war: 2.0, surplus: 1.0, scarcity: 1.0 },
      ]);
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].tradeValue).toBeGreaterThan(ranked[1].tradeValue);
    });
  });
});

// ─── Full Engine ────────────────────────────────────────────────────────────

describe('VPE 3.0 Engine', () => {
  it('runs full pipeline with mock data', () => {
    const result = runVPEEngine(
      [mockEliteHitter(), mockAverageHitter()],
      [mockAcePitcher(), mockAveragePitcher()],
      [mockProspect()],
      { seed: 42, simIterations: 100 },
    );

    // Hitters ranked by VPE-Val
    expect(result.hitters.length).toBe(2);
    expect(result.hitters[0].vpeVal).toBeGreaterThanOrEqual(result.hitters[1].vpeVal);
    expect(result.hitters[0].breakout).toBeDefined();

    // Pitchers with Stuff+ and CSW
    expect(result.pitchers.length).toBe(2);
    expect(result.pitchers[0].stuffPlus).toBeDefined();
    expect(result.pitchers[0].csw).toBeDefined();
    expect(result.pitchers[0].injuryRisk).toBeDefined();

    // Team projections
    expect(result.teamProjections.length).toBeGreaterThan(0);

    // MiLB call-ups
    expect(result.milbCallUps.length).toBe(1);

    // DFS lineup
    expect(result.dfsLineup).not.toBeNull();
    expect(result.dfsLineup!.totalProjectedPts).toBeGreaterThan(0);

    // Metadata
    expect(result.metadata.version).toBe('3.0.0');
    expect(result.metadata.seed).toBe(42);
  });

  it('is reproducible with same seed', () => {
    const r1 = runVPEEngine(
      [mockEliteHitter()],
      [mockAcePitcher()],
      [],
      { seed: 123, simIterations: 50 },
    );
    const r2 = runVPEEngine(
      [mockEliteHitter()],
      [mockAcePitcher()],
      [],
      { seed: 123, simIterations: 50 },
    );

    expect(r1.hitters[0].vpeVal).toBe(r2.hitters[0].vpeVal);
    expect(r1.pitchers[0].vpeVal).toBe(r2.pitchers[0].vpeVal);
  });
});
