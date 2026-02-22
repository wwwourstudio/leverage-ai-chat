/**
 * Waiver Engine, Win Probability, and Luck Index Tests
 */

import { describe, it, expect } from 'vitest';
import { detectBreakoutCandidates, generateWaiverRecommendations } from '@/lib/fantasy/waiver/waiver-engine';
import { simulateMatchup, simulateSeason } from '@/lib/fantasy/matchup/win-probability';
import { calculateLuckIndex, luckAnalysisToSeasonSim } from '@/lib/fantasy/matchup/luck-index';
import type { RosterPlayer } from '@/lib/fantasy/matchup/win-probability';
import type { TeamSeason, WeeklyResult } from '@/lib/fantasy/matchup/luck-index';

// ============================================================================
// Waiver Engine Tests
// ============================================================================

describe('detectBreakoutCandidates', () => {
  it('detects a player with rising usage', () => {
    const projections = [
      // Early weeks: low usage
      { playerName: 'WR Breakout', position: 'WR', fantasyPoints: 8, stats: { targets: 4 }, adp: 120, week: 1 },
      { playerName: 'WR Breakout', position: 'WR', fantasyPoints: 7, stats: { targets: 3 }, adp: 120, week: 2 },
      { playerName: 'WR Breakout', position: 'WR', fantasyPoints: 9, stats: { targets: 5 }, adp: 120, week: 3 },
      { playerName: 'WR Breakout', position: 'WR', fantasyPoints: 6, stats: { targets: 3 }, adp: 120, week: 4 },
      // Recent weeks: big spike
      { playerName: 'WR Breakout', position: 'WR', fantasyPoints: 22, stats: { targets: 12 }, adp: 120, week: 5 },
      { playerName: 'WR Breakout', position: 'WR', fantasyPoints: 20, stats: { targets: 11 }, adp: 120, week: 6 },
      { playerName: 'WR Breakout', position: 'WR', fantasyPoints: 25, stats: { targets: 14 }, adp: 120, week: 7 },
    ];

    const candidates = detectBreakoutCandidates(projections, 7, 3, 1.5);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].playerName).toBe('WR Breakout');
    expect(candidates[0].breakoutScore).toBeGreaterThan(0);
    expect(candidates[0].usageZScore).toBeGreaterThan(0);
  });

  it('does not flag a steady player', () => {
    const projections = Array.from({ length: 7 }, (_, i) => ({
      playerName: 'Steady Eddie',
      position: 'RB',
      fantasyPoints: 15 + (Math.random() - 0.5),
      stats: { carries: 18 },
      adp: 50,
      week: i + 1,
    }));

    const candidates = detectBreakoutCandidates(projections, 7, 3, 1.5);
    const flagged = candidates.find(c => c.playerName === 'Steady Eddie');
    expect(flagged).toBeUndefined();
  });

  it('requires minimum data before flagging', () => {
    const projections = [
      { playerName: 'Newbie', position: 'WR', fantasyPoints: 20, stats: {}, adp: 200, week: 1 },
      { playerName: 'Newbie', position: 'WR', fantasyPoints: 25, stats: {}, adp: 200, week: 2 },
    ];

    const candidates = detectBreakoutCandidates(projections, 2, 3, 1.5);
    expect(candidates.length).toBe(0);
  });
});

describe('generateWaiverRecommendations', () => {
  it('generates recommendations for unrostered breakouts', () => {
    const breakouts = [
      {
        playerName: 'Hot Pickup',
        position: 'WR',
        breakoutScore: 2.5,
        usageTrend: 5,
        efficiencyTrend: 8,
        usageZScore: 2.0,
        efficiencyZScore: 3.0,
        weeklyStats: [
          { week: 5, usage: 12, efficiency: 22 },
          { week: 6, usage: 11, efficiency: 20 },
          { week: 7, usage: 14, efficiency: 25 },
        ],
      },
    ];

    const roster = [
      { playerName: 'WR1', position: 'WR', rosterSlot: 'WR' },
      { playerName: 'WR2', position: 'WR', rosterSlot: 'WR' },
      { playerName: 'Bench1', position: 'WR', rosterSlot: 'BENCH' },
    ];

    const rosteredPlayers = new Set(['WR1', 'WR2', 'Bench1', 'RB1', 'QB1']);

    const recs = generateWaiverRecommendations(
      breakouts,
      roster,
      rosteredPlayers,
      100,
      { QB: 1, RB: 2, WR: 2, FLEX: 1, BENCH: 6 },
      true
    );

    expect(recs.length).toBe(1);
    expect(recs[0].addPlayer).toBe('Hot Pickup');
    expect(recs[0].faabBid).toBeGreaterThan(0);
    expect(recs[0].faabBid).toBeLessThanOrEqual(50); // max 50% of budget
    expect(recs[0].reasoning).toBeTruthy();
  });

  it('skips already rostered players', () => {
    const breakouts = [
      {
        playerName: 'Already Owned',
        position: 'RB',
        breakoutScore: 3.0,
        usageTrend: 10,
        efficiencyTrend: 12,
        usageZScore: 3.0,
        efficiencyZScore: 3.0,
        weeklyStats: [],
      },
    ];

    const recs = generateWaiverRecommendations(
      breakouts,
      [],
      new Set(['Already Owned']),
      100,
      { RB: 2 },
      true
    );

    expect(recs.length).toBe(0);
  });
});

// ============================================================================
// Win Probability Tests
// ============================================================================

describe('simulateMatchup', () => {
  const makeRoster = (players: { name: string; pos: string; pts: number }[]): RosterPlayer[] =>
    players.map(p => ({
      playerName: p.name,
      position: p.pos,
      projectedPoints: p.pts,
      isStarter: true,
    }));

  it('favors the team with higher projections', () => {
    const teamA = makeRoster([
      { name: 'QB1', pos: 'QB', pts: 25 },
      { name: 'RB1', pos: 'RB', pts: 20 },
      { name: 'RB2', pos: 'RB', pts: 15 },
      { name: 'WR1', pos: 'WR', pts: 18 },
      { name: 'WR2', pos: 'WR', pts: 14 },
      { name: 'TE1', pos: 'TE', pts: 10 },
    ]);

    const teamB = makeRoster([
      { name: 'QB2', pos: 'QB', pts: 20 },
      { name: 'RB3', pos: 'RB', pts: 12 },
      { name: 'RB4', pos: 'RB', pts: 10 },
      { name: 'WR3', pos: 'WR', pts: 11 },
      { name: 'WR4', pos: 'WR', pts: 9 },
      { name: 'TE2', pos: 'TE', pts: 7 },
    ]);

    const result = simulateMatchup({
      teamAId: 'a',
      teamBId: 'b',
      teamARoster: teamA,
      teamBRoster: teamB,
      numSimulations: 5000,
    });

    expect(result.teamAWinProbability).toBeGreaterThan(0.6);
    expect(result.teamBWinProbability).toBeLessThan(0.4);
    expect(result.teamAProjectedPoints).toBeGreaterThan(result.teamBProjectedPoints);
    expect(result.simulations).toBe(5000);
  });

  it('returns ~50/50 for equal teams', () => {
    const roster = makeRoster([
      { name: 'P1', pos: 'QB', pts: 20 },
      { name: 'P2', pos: 'RB', pts: 15 },
      { name: 'P3', pos: 'WR', pts: 15 },
    ]);

    const result = simulateMatchup({
      teamAId: 'x',
      teamBId: 'y',
      teamARoster: roster,
      teamBRoster: roster,
      numSimulations: 10000,
    });

    // Should be close to 50/50
    expect(result.teamAWinProbability).toBeGreaterThan(0.4);
    expect(result.teamAWinProbability).toBeLessThan(0.6);
  });

  it('provides score distribution percentiles', () => {
    const roster = makeRoster([
      { name: 'P1', pos: 'QB', pts: 22 },
      { name: 'P2', pos: 'RB', pts: 18 },
    ]);

    const result = simulateMatchup({
      teamAId: 'a',
      teamBId: 'b',
      teamARoster: roster,
      teamBRoster: roster,
      numSimulations: 5000,
    });

    expect(result.teamAScoreDistribution.p10).toBeLessThan(result.teamAScoreDistribution.p50);
    expect(result.teamAScoreDistribution.p50).toBeLessThan(result.teamAScoreDistribution.p90);
    expect(result.blowoutProbability).toBeGreaterThanOrEqual(0);
    expect(result.blowoutProbability).toBeLessThanOrEqual(1);
  });
});

describe('simulateSeason', () => {
  it('produces playoff probabilities that sum to correct total', () => {
    const teams = [
      { teamId: 't1', teamName: 'Team 1', roster: [{ playerName: 'QB1', position: 'QB', projectedPoints: 25, isStarter: true }], currentWins: 5, currentLosses: 3 },
      { teamId: 't2', teamName: 'Team 2', roster: [{ playerName: 'QB2', position: 'QB', projectedPoints: 22, isStarter: true }], currentWins: 4, currentLosses: 4 },
      { teamId: 't3', teamName: 'Team 3', roster: [{ playerName: 'QB3', position: 'QB', projectedPoints: 18, isStarter: true }], currentWins: 3, currentLosses: 5 },
      { teamId: 't4', teamName: 'Team 4', roster: [{ playerName: 'QB4', position: 'QB', projectedPoints: 20, isStarter: true }], currentWins: 4, currentLosses: 4 },
    ];

    const schedule = [
      { weekNumber: 9, teamAId: 't1', teamBId: 't2' },
      { weekNumber: 9, teamAId: 't3', teamBId: 't4' },
      { weekNumber: 10, teamAId: 't1', teamBId: 't3' },
      { weekNumber: 10, teamAId: 't2', teamBId: 't4' },
    ];

    const results = simulateSeason({
      teams,
      remainingSchedule: schedule,
      playoffSpots: 2,
      numSimulations: 1000,
    });

    expect(results).toHaveLength(4);

    // Championship probabilities should sum to ~1
    const champSum = results.reduce((s, r) => s + r.championshipProbability, 0);
    expect(champSum).toBeGreaterThan(0.9);
    expect(champSum).toBeLessThan(1.1);

    // Team with most wins + best roster should have highest playoff prob
    const t1 = results.find(r => r.teamId === 't1')!;
    const t3 = results.find(r => r.teamId === 't3')!;
    expect(t1.playoffProbability).toBeGreaterThan(t3.playoffProbability);
  });
});

// ============================================================================
// Luck Index Tests
// ============================================================================

describe('calculateLuckIndex', () => {
  function makeTeamSeason(
    teamId: string,
    teamName: string,
    weeklyScores: { scored: number; oppScored: number; oppId: string }[]
  ): TeamSeason {
    return {
      teamId,
      teamName,
      weeklyResults: weeklyScores.map((w, i) => ({
        week: i + 1,
        teamId,
        pointsScored: w.scored,
        opponentId: w.oppId,
        opponentPointsScored: w.oppScored,
        won: w.scored > w.oppScored,
      })),
    };
  }

  it('identifies a lucky team (many close wins, lower scoring)', () => {
    const teams: TeamSeason[] = [
      makeTeamSeason('lucky', 'Lucky Team', [
        { scored: 101, oppScored: 100, oppId: 'good' },
        { scored: 102, oppScored: 101, oppId: 'avg' },
        { scored: 95, oppScored: 94, oppId: 'avg' },
        { scored: 99, oppScored: 98, oppId: 'good' },
        { scored: 88, oppScored: 87, oppId: 'avg' },
      ]),
      makeTeamSeason('good', 'Good Team', [
        { scored: 130, oppScored: 101, oppId: 'lucky' },
        { scored: 125, oppScored: 110, oppId: 'avg' },
        { scored: 118, oppScored: 120, oppId: 'avg' },
        { scored: 135, oppScored: 99, oppId: 'lucky' },
        { scored: 122, oppScored: 130, oppId: 'avg' },
      ]),
      makeTeamSeason('avg', 'Average Team', [
        { scored: 110, oppScored: 102, oppId: 'lucky' },
        { scored: 105, oppScored: 125, oppId: 'good' },
        { scored: 115, oppScored: 95, oppId: 'lucky' },
        { scored: 100, oppScored: 135, oppId: 'good' },
        { scored: 108, oppScored: 88, oppId: 'lucky' },
      ]),
    ];

    const results = calculateLuckIndex(teams);
    const luckyTeam = results.find(r => r.teamId === 'lucky')!;
    const goodTeam = results.find(r => r.teamId === 'good')!;

    // Lucky team won 5 of 5 but scores are low — should have positive luck index
    expect(luckyTeam.actualWins).toBe(5);
    expect(luckyTeam.luckIndex).toBeGreaterThan(0);
    // Good team scores high but lost some — should have lower or negative luck
    expect(goodTeam.pointsForRank).toBeLessThanOrEqual(2);
  });

  it('returns correct all-play records', () => {
    const teams: TeamSeason[] = [
      makeTeamSeason('top', 'Top Scorer', [
        { scored: 150, oppScored: 100, oppId: 'bot' },
      ]),
      makeTeamSeason('bot', 'Bottom Scorer', [
        { scored: 80, oppScored: 150, oppId: 'top' },
      ]),
      makeTeamSeason('mid', 'Mid Scorer', [
        { scored: 110, oppScored: 100, oppId: 'bot' }, // dummy opponent doesn't matter for all-play
      ]),
    ];

    const results = calculateLuckIndex(teams);
    const top = results.find(r => r.teamId === 'top')!;

    // Top scorer beat both other teams in week 1 all-play
    expect(top.allPlayRecord.wins).toBe(2);
    expect(top.allPlayRecord.winPct).toBe(1);
  });

  it('converts to SeasonSimulation type', () => {
    const teams: TeamSeason[] = [
      makeTeamSeason('t1', 'Test', [
        { scored: 100, oppScored: 90, oppId: 't2' },
      ]),
      makeTeamSeason('t2', 'Test2', [
        { scored: 90, oppScored: 100, oppId: 't1' },
      ]),
    ];

    const results = calculateLuckIndex(teams);
    const sim = luckAnalysisToSeasonSim(results[0]);

    expect(sim.teamId).toBeDefined();
    expect(sim.luckIndex).toBeDefined();
    expect(sim.actualRecord).toBeDefined();
    expect(sim.expectedRecord).toBeDefined();
  });

  it('handles empty input', () => {
    const results = calculateLuckIndex([]);
    expect(results).toEqual([]);
  });
});
