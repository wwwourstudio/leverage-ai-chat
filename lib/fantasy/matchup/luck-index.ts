/**
 * Luck Index Calculator
 *
 * Measures how much a team's record deviates from their "expected" record.
 * Uses all-play win percentage (how a team would have done against every
 * opponent every week) and schedule strength to quantify luck.
 *
 * Luck Index = (Actual Win% - Expected Win%) * 100
 *   Positive = lucky (winning more than expected)
 *   Negative = unlucky (losing more than expected)
 *
 * Additional metrics:
 * - Close game record (decided by < 10 points)
 * - Points-against luck (are opponents scoring below their average vs you?)
 * - Strength of schedule (average opponent points-for)
 */

import type { SeasonSimulation } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface WeeklyResult {
  week: number;
  teamId: string;
  pointsScored: number;
  opponentId: string;
  opponentPointsScored: number;
  won: boolean;
}

export interface TeamSeason {
  teamId: string;
  teamName: string;
  weeklyResults: WeeklyResult[];
}

export interface LuckAnalysis {
  teamId: string;
  teamName: string;
  actualWins: number;
  actualLosses: number;
  actualWinPct: number;
  expectedWins: number;
  expectedLosses: number;
  expectedWinPct: number;
  luckIndex: number;
  luckRating: 'very_lucky' | 'lucky' | 'neutral' | 'unlucky' | 'very_unlucky';
  allPlayRecord: { wins: number; losses: number; winPct: number };
  closeGameRecord: { wins: number; losses: number; total: number };
  closeGameLuck: number;
  pointsForRank: number;
  pointsAgainstRank: number;
  strengthOfSchedule: number;
  strengthOfScheduleRank: number;
  weeklyLuck: { week: number; lucky: boolean; margin: number }[];
  consistencyScore: number;
  medianPointsFor: number;
}

// ============================================================================
// Core: Calculate all-play win percentage
// ============================================================================

function calculateAllPlayRecord(
  team: TeamSeason,
  allTeams: TeamSeason[]
): { wins: number; losses: number; winPct: number } {
  let wins = 0;
  let losses = 0;

  for (const result of team.weeklyResults) {
    // Compare against every other team's score that same week
    for (const opponent of allTeams) {
      if (opponent.teamId === team.teamId) continue;
      const opponentWeek = opponent.weeklyResults.find(r => r.week === result.week);
      if (!opponentWeek) continue;

      if (result.pointsScored > opponentWeek.pointsScored) {
        wins++;
      } else if (result.pointsScored < opponentWeek.pointsScored) {
        losses++;
      } else {
        // Tie — split
        wins += 0.5;
        losses += 0.5;
      }
    }
  }

  const total = wins + losses;
  return {
    wins: Math.round(wins * 100) / 100,
    losses: Math.round(losses * 100) / 100,
    winPct: total > 0 ? Math.round((wins / total) * 10000) / 10000 : 0,
  };
}

// ============================================================================
// Core: Strength of schedule
// ============================================================================

function calculateStrengthOfSchedule(
  team: TeamSeason,
  allTeams: TeamSeason[]
): number {
  const opponentScores: number[] = [];
  const teamMap = new Map(allTeams.map(t => [t.teamId, t]));

  for (const result of team.weeklyResults) {
    const opponent = teamMap.get(result.opponentId);
    if (!opponent) continue;

    // Use opponent's average points (excluding the game against this team)
    const opponentOtherGames = opponent.weeklyResults.filter(
      r => r.opponentId !== team.teamId
    );
    if (opponentOtherGames.length > 0) {
      const avgPts = opponentOtherGames.reduce((s, r) => s + r.pointsScored, 0) / opponentOtherGames.length;
      opponentScores.push(avgPts);
    }
  }

  if (opponentScores.length === 0) return 0;
  return Math.round(
    (opponentScores.reduce((s, v) => s + v, 0) / opponentScores.length) * 100
  ) / 100;
}

// ============================================================================
// Core: Close game analysis (margin < 10 points)
// ============================================================================

function analyzeCloseGames(
  team: TeamSeason,
  closeMargin: number = 10
): { wins: number; losses: number; total: number } {
  let wins = 0;
  let losses = 0;

  for (const result of team.weeklyResults) {
    const margin = Math.abs(result.pointsScored - result.opponentPointsScored);
    if (margin < closeMargin) {
      if (result.won) wins++;
      else losses++;
    }
  }

  return { wins, losses, total: wins + losses };
}

// ============================================================================
// Core: Consistency score (inverse of coefficient of variation)
// ============================================================================

function calculateConsistency(team: TeamSeason): number {
  const scores = team.weeklyResults.map(r => r.pointsScored);
  if (scores.length < 2) return 100;

  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  if (mean === 0) return 0;

  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
  const cv = Math.sqrt(variance) / mean;

  // Convert to 0-100 scale where higher = more consistent
  // CV of 0 = 100 (perfectly consistent), CV of 0.5+ = ~0
  return Math.round(Math.max(0, Math.min(100, (1 - cv * 2) * 100)) * 100) / 100;
}

// ============================================================================
// Core: Median points for
// ============================================================================

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

// ============================================================================
// Main: Calculate luck index for all teams
// ============================================================================

export function calculateLuckIndex(allTeams: TeamSeason[]): LuckAnalysis[] {
  if (allTeams.length === 0) return [];

  // Pre-calculate all-play records
  const allPlayRecords = new Map<string, { wins: number; losses: number; winPct: number }>();
  for (const team of allTeams) {
    allPlayRecords.set(team.teamId, calculateAllPlayRecord(team, allTeams));
  }

  // Pre-calculate strength of schedule
  const sosValues = new Map<string, number>();
  for (const team of allTeams) {
    sosValues.set(team.teamId, calculateStrengthOfSchedule(team, allTeams));
  }

  // Rank by points for
  const pointsForTotals = allTeams.map(team => ({
    teamId: team.teamId,
    total: team.weeklyResults.reduce((s, r) => s + r.pointsScored, 0),
  })).sort((a, b) => b.total - a.total);

  // Rank by points against
  const pointsAgainstTotals = allTeams.map(team => ({
    teamId: team.teamId,
    total: team.weeklyResults.reduce((s, r) => s + r.opponentPointsScored, 0),
  })).sort((a, b) => a.total - b.total); // lower PA is better

  // Rank SOS
  const sosRanked = [...sosValues.entries()]
    .sort((a, b) => b[1] - a[1]); // higher SOS = harder schedule

  return allTeams.map(team => {
    const totalGames = team.weeklyResults.length;
    const actualWins = team.weeklyResults.filter(r => r.won).length;
    const actualLosses = totalGames - actualWins;
    const actualWinPct = totalGames > 0 ? actualWins / totalGames : 0;

    const allPlay = allPlayRecords.get(team.teamId)!;
    const expectedWinPct = allPlay.winPct;

    // Expected record based on all-play percentage
    const expectedWins = Math.round(expectedWinPct * totalGames * 100) / 100;
    const expectedLosses = Math.round((totalGames - expectedWins) * 100) / 100;

    // Luck index: actual vs expected win percentage, scaled to -100 to +100
    const luckIndex = Math.round((actualWinPct - expectedWinPct) * 100 * 100) / 100;

    // Categorize luck
    let luckRating: LuckAnalysis['luckRating'];
    if (luckIndex >= 15) luckRating = 'very_lucky';
    else if (luckIndex >= 5) luckRating = 'lucky';
    else if (luckIndex <= -15) luckRating = 'very_unlucky';
    else if (luckIndex <= -5) luckRating = 'unlucky';
    else luckRating = 'neutral';

    const closeGames = analyzeCloseGames(team);
    const closeGameLuck = closeGames.total > 0
      ? Math.round(((closeGames.wins / closeGames.total) - 0.5) * 100 * 100) / 100
      : 0;

    const pfRank = pointsForTotals.findIndex(p => p.teamId === team.teamId) + 1;
    const paRank = pointsAgainstTotals.findIndex(p => p.teamId === team.teamId) + 1;
    const sosRank = sosRanked.findIndex(([id]) => id === team.teamId) + 1;

    // Weekly luck analysis
    const weeklyLuck = team.weeklyResults.map(result => {
      const margin = result.pointsScored - result.opponentPointsScored;
      // A win by slim margin = lucky, a loss by slim margin = unlucky
      const lucky = result.won && margin < 5;
      return {
        week: result.week,
        lucky,
        margin: Math.round(margin * 100) / 100,
      };
    });

    const scores = team.weeklyResults.map(r => r.pointsScored);

    return {
      teamId: team.teamId,
      teamName: team.teamName,
      actualWins,
      actualLosses,
      actualWinPct: Math.round(actualWinPct * 10000) / 10000,
      expectedWins,
      expectedLosses,
      expectedWinPct: Math.round(expectedWinPct * 10000) / 10000,
      luckIndex,
      luckRating,
      allPlayRecord: allPlay,
      closeGameRecord: closeGames,
      closeGameLuck,
      pointsForRank: pfRank,
      pointsAgainstRank: paRank,
      strengthOfSchedule: sosValues.get(team.teamId) || 0,
      strengthOfScheduleRank: sosRank,
      weeklyLuck,
      consistencyScore: calculateConsistency(team),
      medianPointsFor: Math.round(calculateMedian(scores) * 100) / 100,
    };
  }).sort((a, b) => b.luckIndex - a.luckIndex);
}

// ============================================================================
// Convert to SeasonSimulation type (for API compatibility)
// ============================================================================

export function luckAnalysisToSeasonSim(analysis: LuckAnalysis): SeasonSimulation {
  return {
    teamId: analysis.teamId,
    teamName: analysis.teamName,
    projectedWins: analysis.expectedWins,
    projectedLosses: analysis.expectedLosses,
    playoffProbability: 0, // calculated separately by win-probability engine
    championshipProbability: 0,
    luckIndex: analysis.luckIndex,
    strengthOfSchedule: analysis.strengthOfSchedule,
    expectedRecord: {
      wins: analysis.expectedWins,
      losses: analysis.expectedLosses,
    },
    actualRecord: {
      wins: analysis.actualWins,
      losses: analysis.actualLosses,
    },
  };
}
