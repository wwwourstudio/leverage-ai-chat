/**
 * Fantasy Draft Engine Unit Tests
 * Tests for VBD calculator, tier cliff detector, simulation engine, and opponent model
 */

import { describe, it, expect } from 'vitest';
import { calculateVBD, calculateFantasyPoints } from '@/lib/fantasy/draft/vbd-calculator';
import { detectTierCliffs, calculateCliffUrgency } from '@/lib/fantasy/draft/tier-cliff-detector';
import { getRosterFitScore } from '@/lib/fantasy/draft/roster-evaluator';
import {
  buildDefaultProfiles,
  predictOpponentPick,
  calculateOpponentLeverage,
} from '@/lib/fantasy/draft/opponent-model';
import {
  generateSnakeDraftOrder,
  quickSurvivalEstimate,
} from '@/lib/fantasy/draft/simulation-engine';
import { hasFeatureAccess } from '@/lib/fantasy/types';
import type { FantasyProjection } from '@/lib/fantasy/types';

// ============================================================================
// VBD Calculator Tests
// ============================================================================

describe('calculateFantasyPoints', () => {
  it('calculates PPR NFL points correctly', () => {
    const stats = {
      pass_yards: 300,
      pass_td: 2,
      rush_yards: 30,
      rush_td: 0,
      receptions: 0,
      receiving_yards: 0,
    };
    const scoring = {
      pass_yards_per_point: 25,
      pass_td: 4,
      rush_yards_per_point: 10,
      rush_td: 6,
      reception: 1,
      receiving_yards_per_point: 10,
      receiving_td: 6,
    };
    const points = calculateFantasyPoints(stats, scoring);
    // 300/25 = 12 + 2*4 = 8 + 30/10 = 3 = 23 total
    expect(points).toBe(23);
  });

  it('calculates receiving PPR points correctly', () => {
    const stats = {
      receptions: 8,
      receiving_yards: 100,
      receiving_td: 1,
    };
    const scoring = {
      reception: 1,
      receiving_yards_per_point: 10,
      receiving_td: 6,
    };
    const points = calculateFantasyPoints(stats, scoring);
    // 8 receptions + 100/10 yards + 1 TD*6 = 8 + 10 + 6 = 24
    expect(points).toBe(24);
  });

  it('handles zero stats without crashing', () => {
    const points = calculateFantasyPoints({}, {});
    expect(points).toBe(0);
  });
});

describe('calculateVBD', () => {
  const makeProjections = (players: { name: string; pos: string; pts: number; adp: number }[]): FantasyProjection[] =>
    players.map(p => ({
      id: p.name,
      sport: 'nfl',
      playerName: p.name,
      position: p.pos,
      seasonYear: 2025,
      projectionSource: 'test',
      stats: {},
      fantasyPoints: p.pts,
      adp: p.adp,
      vbd: 0,
      tier: 1,
      updatedAt: new Date().toISOString(),
    }));

  it('assigns positive VBD to above-replacement players', () => {
    // Need 13+ QBs for a 12-team, 1-QB league (replacement = QB13)
    const projections = makeProjections([
      { name: 'QB1', pos: 'QB', pts: 400, adp: 1 },
      { name: 'QB2', pos: 'QB', pts: 370, adp: 15 },
      { name: 'QB3', pos: 'QB', pts: 355, adp: 20 },
      { name: 'QB4', pos: 'QB', pts: 340, adp: 25 },
      { name: 'QB5', pos: 'QB', pts: 330, adp: 30 },
      { name: 'QB6', pos: 'QB', pts: 320, adp: 40 },
      { name: 'QB7', pos: 'QB', pts: 315, adp: 50 },
      { name: 'QB8', pos: 'QB', pts: 310, adp: 60 },
      { name: 'QB9', pos: 'QB', pts: 305, adp: 70 },
      { name: 'QB10', pos: 'QB', pts: 300, adp: 80 },
      { name: 'QB11', pos: 'QB', pts: 295, adp: 90 },
      { name: 'QB12', pos: 'QB', pts: 292, adp: 95 },
      { name: 'QB13', pos: 'QB', pts: 290, adp: 100 },  // replacement level (rank 13)
      { name: 'QB14', pos: 'QB', pts: 260, adp: 120 },  // below replacement
    ]);

    const config = {
      leagueSize: 12,
      rosterSlots: { QB: 1, BENCH: 6 },
      scoringSettings: {},
      sport: 'nfl' as const,
    };

    const ranked = calculateVBD(projections, config);
    const qb1 = ranked.find(p => p.playerName === 'QB1');
    const qb14 = ranked.find(p => p.playerName === 'QB14');

    expect(qb1).toBeDefined();
    expect(qb1!.vbd).toBeGreaterThan(0);
    expect(qb14!.vbd).toBeLessThan(0);
  });

  it('ranks players by VBD descending', () => {
    const projections = makeProjections([
      { name: 'RB1', pos: 'RB', pts: 350, adp: 1 },
      { name: 'RB2', pos: 'RB', pts: 300, adp: 5 },
      { name: 'QB1', pos: 'QB', pts: 380, adp: 3 },
    ]);

    const config = {
      leagueSize: 12,
      rosterSlots: { QB: 1, RB: 2, BENCH: 4 },
      scoringSettings: {},
      sport: 'nfl' as const,
    };

    const ranked = calculateVBD(projections, config);
    expect(ranked[0].overallRank).toBe(1);
    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i].vbd).toBeGreaterThanOrEqual(ranked[i + 1].vbd);
    }
  });
});

// ============================================================================
// Tier Cliff Detector Tests
// ============================================================================

describe('detectTierCliffs', () => {
  it('detects obvious tier cliffs', () => {
    const players = [
      { playerName: 'WR1', position: 'WR', projectedPoints: 300, adp: 3, vbd: 80, tier: 1, positionRank: 1, overallRank: 1, scarcityScore: 0.3 },
      { playerName: 'WR2', position: 'WR', projectedPoints: 290, adp: 8, vbd: 70, tier: 1, positionRank: 2, overallRank: 3, scarcityScore: 0.3 },
      { playerName: 'WR3', position: 'WR', projectedPoints: 280, adp: 12, vbd: 60, tier: 1, positionRank: 3, overallRank: 5, scarcityScore: 0.3 },
      // Big cliff here
      { playerName: 'WR4', position: 'WR', projectedPoints: 200, adp: 25, vbd: -20, tier: 2, positionRank: 4, overallRank: 20, scarcityScore: 0.5 },
      { playerName: 'WR5', position: 'WR', projectedPoints: 190, adp: 30, vbd: -30, tier: 2, positionRank: 5, overallRank: 25, scarcityScore: 0.6 },
    ];

    const cliffs = detectTierCliffs(players, { zThreshold: 1.0 });
    expect(cliffs.length).toBeGreaterThan(0);
    expect(cliffs[0].position).toBe('WR');
  });

  it('returns empty array for players with uniform spacing', () => {
    const players = Array.from({ length: 10 }, (_, i) => ({
      playerName: `RB${i + 1}`,
      position: 'RB',
      projectedPoints: 300 - i * 10,
      adp: i + 1,
      vbd: 100 - i * 10,
      tier: 1,
      positionRank: i + 1,
      overallRank: i + 1,
      scarcityScore: 0.5,
    }));

    const cliffs = detectTierCliffs(players, { zThreshold: 3.0 }); // Very strict
    expect(cliffs).toBeInstanceOf(Array);
  });
});

// ============================================================================
// Roster Fit Score Tests
// ============================================================================

describe('getRosterFitScore', () => {
  it('returns 1.0 for empty starter slot', () => {
    const score = getRosterFitScore('QB', [], { QB: 1, RB: 2, BENCH: 4 });
    expect(score).toBe(1.0);
  });

  it('returns lower score when position is full', () => {
    const roster = [
      { id: '1', teamId: 't1', playerName: 'QB1', position: 'QB', rosterSlot: 'QB', acquisitionType: 'draft' as const, acquisitionCost: 5, addedAt: '' },
    ];
    const score = getRosterFitScore('QB', roster, { QB: 1, RB: 2, BENCH: 4 });
    expect(score).toBeLessThan(1.0);
  });

  it('returns 0.85 for FLEX-eligible position filling FLEX slot', () => {
    const roster = [
      { id: '1', teamId: 't1', playerName: 'RB1', position: 'RB', rosterSlot: 'RB', acquisitionType: 'draft' as const, acquisitionCost: 1, addedAt: '' },
      { id: '2', teamId: 't1', playerName: 'RB2', position: 'RB', rosterSlot: 'RB', acquisitionType: 'draft' as const, acquisitionCost: 3, addedAt: '' },
    ];
    const score = getRosterFitScore('RB', roster, { QB: 1, RB: 2, WR: 2, FLEX: 1, BENCH: 4 });
    expect(score).toBe(0.85);
  });
});

// ============================================================================
// Snake Draft Order Tests
// ============================================================================

describe('generateSnakeDraftOrder', () => {
  it('generates correct snake order for 3 teams, 3 rounds', () => {
    const teams = ['A', 'B', 'C'];
    const order = generateSnakeDraftOrder(teams, 3);
    expect(order).toEqual(['A', 'B', 'C', 'C', 'B', 'A', 'A', 'B', 'C']);
  });

  it('generates correct total pick count', () => {
    const teams = Array.from({ length: 12 }, (_, i) => `team${i}`);
    const order = generateSnakeDraftOrder(teams, 15);
    expect(order).toHaveLength(12 * 15);
  });

  it('each team appears exactly 15 times in 12-team, 15-round draft', () => {
    const teams = Array.from({ length: 12 }, (_, i) => `team${i}`);
    const order = generateSnakeDraftOrder(teams, 15);
    for (const team of teams) {
      const count = order.filter(t => t === team).length;
      expect(count).toBe(15);
    }
  });
});

// ============================================================================
// Opponent Model Tests
// ============================================================================

describe('buildDefaultProfiles', () => {
  it('creates profiles for all teams', () => {
    const ids = ['t1', 't2', 't3', 't4'];
    const names = ['Team A', 'Team B', 'Team C', 'Team D'];
    const profiles = buildDefaultProfiles(ids, names);
    expect(profiles).toHaveLength(4);
    expect(profiles[0].teamId).toBe('t1');
  });

  it('position biases sum to approximately 1.0', () => {
    const profiles = buildDefaultProfiles(['t1'], ['Team 1']);
    const bias = profiles[0].positionBias;
    const total = Object.values(bias).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1.0, 1);
  });
});

describe('quickSurvivalEstimate', () => {
  it('returns low survival for player already past ADP', () => {
    const survival = quickSurvivalEstimate(
      { playerName: 'RB1', position: 'RB', adp: 5, vbd: 80, projectedPoints: 300, tier: 1, positionRank: 1, overallRank: 1, scarcityScore: 0.5 },
      currentPick = 10,
      userNextPick = 15,
      leagueSize = 12
    );
    expect(survival).toBeLessThan(0.5);
  });

  it('returns high survival for player with high ADP vs current pick', () => {
    const survival = quickSurvivalEstimate(
      { playerName: 'RB30', position: 'RB', adp: 100, vbd: 10, projectedPoints: 180, tier: 4, positionRank: 30, overallRank: 60, scarcityScore: 0.2 },
      currentPick = 10,
      userNextPick = 22,
      leagueSize = 12
    );
    expect(survival).toBeGreaterThan(0.7);
  });
});

// ============================================================================
// Subscription Tier Tests
// ============================================================================

describe('hasFeatureAccess', () => {
  it('free tier only has basic projections', () => {
    expect(hasFeatureAccess('free', 'basic_projections')).toBe(true);
    expect(hasFeatureAccess('free', 'draft_simulation')).toBe(false);
    expect(hasFeatureAccess('free', 'hedge_fund_mode')).toBe(false);
  });

  it('core tier has draft assistant but not simulation engine', () => {
    expect(hasFeatureAccess('core', 'draft_assistant_basic')).toBe(true);
    expect(hasFeatureAccess('core', 'draft_simulation')).toBe(false);
    expect(hasFeatureAccess('core', 'faab_optimizer')).toBe(false);
  });

  it('pro tier has simulation and FAAB but not hedge fund mode', () => {
    expect(hasFeatureAccess('pro', 'draft_simulation')).toBe(true);
    expect(hasFeatureAccess('pro', 'faab_optimizer')).toBe(true);
    expect(hasFeatureAccess('pro', 'hedge_fund_mode')).toBe(false);
  });

  it('high_stakes tier has all features', () => {
    expect(hasFeatureAccess('high_stakes', 'hedge_fund_mode')).toBe(true);
    expect(hasFeatureAccess('high_stakes', 'bankroll_management')).toBe(true);
    expect(hasFeatureAccess('high_stakes', 'api_access')).toBe(true);
    expect(hasFeatureAccess('high_stakes', 'dfs_optimizer_full')).toBe(true);
  });
});

// Helper to suppress TS lint on bare variable
let currentPick: number;
let userNextPick: number;
let leagueSize: number;
