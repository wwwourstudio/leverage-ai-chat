/**
 * Win Probability Engine
 *
 * Monte Carlo simulation for head-to-head matchup probabilities.
 * Models each player's weekly output as a normal distribution around
 * their projection with position-specific variance, then sums starter
 * totals across N simulations to derive win probability.
 */

import type { MatchupSimulation, FantasyProjection } from '../types';

// ============================================================================
// Position-specific standard deviation coefficients
// ============================================================================

// stdDev = projectedPoints * coefficient
// Higher coefficients = more volatile positions
const POSITION_VARIANCE: Record<string, number> = {
  QB: 0.22,
  RB: 0.32,
  WR: 0.30,
  TE: 0.35,
  K: 0.45,
  DEF: 0.50,
  FLEX: 0.31,
  // NBA
  PG: 0.25,
  SG: 0.26,
  SF: 0.26,
  PF: 0.27,
  C: 0.28,
  // MLB
  SP: 0.40,
  RP: 0.55,
  OF: 0.35,
  '1B': 0.33,
  '2B': 0.34,
  '3B': 0.34,
  SS: 0.34,
  DH: 0.33,
};

const DEFAULT_VARIANCE = 0.30;

// ============================================================================
// Types
// ============================================================================

export interface RosterPlayer {
  playerName: string;
  position: string;
  projectedPoints: number;
  isStarter: boolean;
}

export interface MatchupInput {
  teamAId: string;
  teamBId: string;
  teamARoster: RosterPlayer[];
  teamBRoster: RosterPlayer[];
  numSimulations?: number;
}

export interface DetailedMatchupResult extends MatchupSimulation {
  teamAScoreDistribution: { p10: number; p25: number; p50: number; p75: number; p90: number };
  teamBScoreDistribution: { p10: number; p25: number; p50: number; p75: number; p90: number };
  marginOfVictory: number;
  blowoutProbability: number; // probability of 20+ point margin
}

// ============================================================================
// Box-Muller transform for normal distribution sampling
// ============================================================================

function normalRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

// ============================================================================
// Simulate a single team's score
// ============================================================================

function simulateTeamScore(roster: RosterPlayer[]): number {
  let total = 0;
  for (const player of roster) {
    if (!player.isStarter) continue;
    const variance = POSITION_VARIANCE[player.position] || DEFAULT_VARIANCE;
    const stdDev = player.projectedPoints * variance;
    // Floor at 0 — no negative individual scores
    const score = Math.max(0, normalRandom(player.projectedPoints, stdDev));
    total += score;
  }
  return total;
}

// ============================================================================
// Calculate percentiles from sorted array
// ============================================================================

function percentile(sorted: number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
}

// ============================================================================
// Main: Simulate matchup
// ============================================================================

export function simulateMatchup(input: MatchupInput): DetailedMatchupResult {
  const numSims = input.numSimulations || 10000;
  const teamAScores: number[] = [];
  const teamBScores: number[] = [];
  let teamAWins = 0;
  let teamBWins = 0;
  let blowouts = 0;

  for (let i = 0; i < numSims; i++) {
    const scoreA = simulateTeamScore(input.teamARoster);
    const scoreB = simulateTeamScore(input.teamBRoster);
    teamAScores.push(scoreA);
    teamBScores.push(scoreB);

    if (scoreA > scoreB) {
      teamAWins++;
    } else if (scoreB > scoreA) {
      teamBWins++;
    } else {
      // Ties split evenly
      teamAWins += 0.5;
      teamBWins += 0.5;
    }

    if (Math.abs(scoreA - scoreB) >= 20) {
      blowouts++;
    }
  }

  teamAScores.sort((a, b) => a - b);
  teamBScores.sort((a, b) => a - b);

  const teamAMean = teamAScores.reduce((s, v) => s + v, 0) / numSims;
  const teamBMean = teamBScores.reduce((s, v) => s + v, 0) / numSims;

  const teamAStdDev = Math.sqrt(
    teamAScores.reduce((s, v) => s + (v - teamAMean) ** 2, 0) / numSims
  );
  const teamBStdDev = Math.sqrt(
    teamBScores.reduce((s, v) => s + (v - teamBMean) ** 2, 0) / numSims
  );

  return {
    teamAId: input.teamAId,
    teamBId: input.teamBId,
    teamAWinProbability: teamAWins / numSims,
    teamBWinProbability: teamBWins / numSims,
    teamAProjectedPoints: Math.round(teamAMean * 100) / 100,
    teamBProjectedPoints: Math.round(teamBMean * 100) / 100,
    teamAPointsStdDev: Math.round(teamAStdDev * 100) / 100,
    teamBPointsStdDev: Math.round(teamBStdDev * 100) / 100,
    simulations: numSims,
    teamAScoreDistribution: {
      p10: Math.round(percentile(teamAScores, 10) * 100) / 100,
      p25: Math.round(percentile(teamAScores, 25) * 100) / 100,
      p50: Math.round(percentile(teamAScores, 50) * 100) / 100,
      p75: Math.round(percentile(teamAScores, 75) * 100) / 100,
      p90: Math.round(percentile(teamAScores, 90) * 100) / 100,
    },
    teamBScoreDistribution: {
      p10: Math.round(percentile(teamBScores, 10) * 100) / 100,
      p25: Math.round(percentile(teamBScores, 25) * 100) / 100,
      p50: Math.round(percentile(teamBScores, 50) * 100) / 100,
      p75: Math.round(percentile(teamBScores, 75) * 100) / 100,
      p90: Math.round(percentile(teamBScores, 90) * 100) / 100,
    },
    marginOfVictory: Math.round(Math.abs(teamAMean - teamBMean) * 100) / 100,
    blowoutProbability: Math.round((blowouts / numSims) * 10000) / 10000,
  };
}

// ============================================================================
// Simulate full season for playoff/championship probability
// ============================================================================

export interface SeasonSimInput {
  teams: {
    teamId: string;
    teamName: string;
    roster: RosterPlayer[];
    currentWins: number;
    currentLosses: number;
  }[];
  remainingSchedule: { weekNumber: number; teamAId: string; teamBId: string }[];
  playoffSpots: number;
  numSimulations?: number;
}

export interface SeasonSimResult {
  teamId: string;
  teamName: string;
  projectedWins: number;
  projectedLosses: number;
  playoffProbability: number;
  championshipProbability: number;
  simulations: number;
}

export function simulateSeason(input: SeasonSimInput): SeasonSimResult[] {
  const numSims = input.numSimulations || 10000;
  const teamMap = new Map(input.teams.map(t => [t.teamId, t]));

  // Track results per team
  const playoffCount: Record<string, number> = {};
  const champCount: Record<string, number> = {};
  const totalWins: Record<string, number> = {};

  for (const team of input.teams) {
    playoffCount[team.teamId] = 0;
    champCount[team.teamId] = 0;
    totalWins[team.teamId] = 0;
  }

  for (let sim = 0; sim < numSims; sim++) {
    // Track wins for this simulation
    const simWins: Record<string, number> = {};
    for (const team of input.teams) {
      simWins[team.teamId] = team.currentWins;
    }

    // Simulate remaining games
    for (const matchup of input.remainingSchedule) {
      const teamA = teamMap.get(matchup.teamAId);
      const teamB = teamMap.get(matchup.teamBId);
      if (!teamA || !teamB) continue;

      const scoreA = simulateTeamScore(teamA.roster);
      const scoreB = simulateTeamScore(teamB.roster);

      if (scoreA > scoreB) {
        simWins[matchup.teamAId]++;
      } else {
        simWins[matchup.teamBId]++;
      }
    }

    // Accumulate total wins
    for (const team of input.teams) {
      totalWins[team.teamId] += simWins[team.teamId];
    }

    // Determine playoff teams (top N by wins, tiebreak by random)
    const standings = input.teams
      .map(t => ({ teamId: t.teamId, wins: simWins[t.teamId] }))
      .sort((a, b) => b.wins - a.wins || Math.random() - 0.5);

    const playoffTeams = standings.slice(0, input.playoffSpots).map(s => s.teamId);
    for (const teamId of playoffTeams) {
      playoffCount[teamId]++;
    }

    // Simple playoff bracket: seed 1v4, 2v3 then winners play
    if (playoffTeams.length >= 4) {
      const semi1A = teamMap.get(playoffTeams[0])!;
      const semi1B = teamMap.get(playoffTeams[3])!;
      const semi2A = teamMap.get(playoffTeams[1])!;
      const semi2B = teamMap.get(playoffTeams[2])!;

      const s1a = simulateTeamScore(semi1A.roster);
      const s1b = simulateTeamScore(semi1B.roster);
      const s2a = simulateTeamScore(semi2A.roster);
      const s2b = simulateTeamScore(semi2B.roster);

      const finalist1 = s1a >= s1b ? playoffTeams[0] : playoffTeams[3];
      const finalist2 = s2a >= s2b ? playoffTeams[1] : playoffTeams[2];

      const f1 = teamMap.get(finalist1)!;
      const f2 = teamMap.get(finalist2)!;
      const fa = simulateTeamScore(f1.roster);
      const fb = simulateTeamScore(f2.roster);

      const champion = fa >= fb ? finalist1 : finalist2;
      champCount[champion]++;
    } else if (playoffTeams.length >= 2) {
      // 2-team playoff
      const f1 = teamMap.get(playoffTeams[0])!;
      const f2 = teamMap.get(playoffTeams[1])!;
      const fa = simulateTeamScore(f1.roster);
      const fb = simulateTeamScore(f2.roster);
      const champion = fa >= fb ? playoffTeams[0] : playoffTeams[1];
      champCount[champion]++;
    }
  }

  return input.teams.map(team => {
    const totalGames = team.currentWins + team.currentLosses + input.remainingSchedule.filter(
      m => m.teamAId === team.teamId || m.teamBId === team.teamId
    ).length;
    const avgWins = totalWins[team.teamId] / numSims;

    return {
      teamId: team.teamId,
      teamName: team.teamName,
      projectedWins: Math.round(avgWins * 100) / 100,
      projectedLosses: Math.round((totalGames - avgWins) * 100) / 100,
      playoffProbability: Math.round((playoffCount[team.teamId] / numSims) * 10000) / 10000,
      championshipProbability: Math.round((champCount[team.teamId] / numSims) * 10000) / 10000,
      simulations: numSims,
    };
  });
}
