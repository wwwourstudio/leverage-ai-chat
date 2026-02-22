/**
 * Value-Based Drafting (VBD) Calculator
 *
 * Ranks players by their value above replacement level at their position.
 * VBD = Player Projected Points - Replacement Level Points
 *
 * Replacement level is determined by league size and roster configuration.
 * A QB in a 12-team, 1-QB league has replacement = QB13.
 * An RB in a 12-team, 2-RB + 1-FLEX league has replacement ~RB31.
 */

import type {
  FantasyProjection,
  PlayerWithVBD,
  RosterSlots,
  ScoringSettings,
  FantasySport,
} from '../types';

export interface VBDConfig {
  leagueSize: number;
  rosterSlots: RosterSlots;
  scoringSettings: ScoringSettings;
  sport: FantasySport;
}

interface PositionReplacementLevel {
  position: string;
  replacementRank: number;
  replacementPoints: number;
}

/**
 * Calculate the replacement level rank for each position.
 *
 * For a position with N starters across L teams:
 *   replacement_rank = L * N + 1
 *
 * FLEX slots add fractional starters to eligible positions.
 */
export function calculateReplacementLevels(
  config: VBDConfig,
  projectionsByPosition: Map<string, FantasyProjection[]>
): PositionReplacementLevel[] {
  const { leagueSize, rosterSlots } = config;
  const levels: PositionReplacementLevel[] = [];

  // Determine FLEX-eligible positions for the sport
  const flexPositions = getFlexEligiblePositions(config.sport);
  const flexCount = (rosterSlots['FLEX'] || 0) + (rosterSlots['SUPERFLEX'] || 0);
  const flexEligibleCount = flexPositions.length || 1;

  for (const [position, count] of Object.entries(rosterSlots)) {
    if (position === 'BENCH' || position === 'FLEX' || position === 'SUPERFLEX' || position === 'UTIL') {
      continue;
    }

    // Base starters for this position
    let effectiveStarters = count;

    // Add FLEX contribution (distributed across eligible positions)
    if (flexPositions.includes(position)) {
      effectiveStarters += flexCount / flexEligibleCount;
    }

    const replacementRank = Math.ceil(leagueSize * effectiveStarters);

    // Get replacement-level points from projections
    const positionPlayers = projectionsByPosition.get(position) || [];
    const sorted = [...positionPlayers].sort((a, b) => b.fantasyPoints - a.fantasyPoints);
    const replacementPoints = sorted[replacementRank - 1]?.fantasyPoints || 0;

    levels.push({
      position,
      replacementRank,
      replacementPoints,
    });
  }

  return levels;
}

/**
 * Get positions eligible for FLEX slots by sport.
 */
function getFlexEligiblePositions(sport: FantasySport): string[] {
  switch (sport) {
    case 'nfl':
      return ['RB', 'WR', 'TE'];
    case 'nba':
      return ['PG', 'SG', 'SF', 'PF', 'C'];
    case 'mlb':
      return ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH'];
    case 'nhl':
      return ['C', 'LW', 'RW', 'D'];
    default:
      return [];
  }
}

/**
 * Calculate VBD scores for all players.
 *
 * Returns a ranked list of players with VBD, tier, and scarcity info.
 */
export function calculateVBD(
  projections: FantasyProjection[],
  config: VBDConfig
): PlayerWithVBD[] {
  // Group projections by position
  const byPosition = new Map<string, FantasyProjection[]>();
  for (const proj of projections) {
    const existing = byPosition.get(proj.position) || [];
    existing.push(proj);
    byPosition.set(proj.position, existing);
  }

  // Sort each position group by fantasy points
  for (const [pos, players] of byPosition) {
    byPosition.set(pos, players.sort((a, b) => b.fantasyPoints - a.fantasyPoints));
  }

  // Calculate replacement levels
  const replacementLevels = calculateReplacementLevels(config, byPosition);
  const replacementMap = new Map(replacementLevels.map(r => [r.position, r]));

  // Calculate VBD for each player
  const results: PlayerWithVBD[] = [];

  for (const [position, players] of byPosition) {
    const replacement = replacementMap.get(position);
    if (!replacement) continue;

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const vbd = player.fantasyPoints - replacement.replacementPoints;

      results.push({
        playerName: player.playerName,
        playerId: player.playerId,
        position,
        projectedPoints: player.fantasyPoints,
        adp: player.adp,
        vbd,
        tier: 0,  // Assigned below
        positionRank: i + 1,
        overallRank: 0,  // Assigned below
        scarcityScore: 0,  // Assigned below
      });
    }
  }

  // Sort by VBD and assign overall ranks
  results.sort((a, b) => b.vbd - a.vbd);
  for (let i = 0; i < results.length; i++) {
    results[i].overallRank = i + 1;
  }

  // Assign tiers using natural breaks in VBD
  assignTiers(results);

  // Calculate scarcity scores
  calculateScarcityScores(results, config);

  return results;
}

/**
 * Assign tier numbers based on VBD gaps.
 *
 * Uses a simplified Jenks natural breaks approach:
 * players with similar VBD are grouped, and gaps > threshold start new tiers.
 */
function assignTiers(players: PlayerWithVBD[]): void {
  if (players.length === 0) return;

  // Group by position for per-position tiers
  const byPosition = new Map<string, PlayerWithVBD[]>();
  for (const p of players) {
    const existing = byPosition.get(p.position) || [];
    existing.push(p);
    byPosition.set(p.position, existing);
  }

  for (const [, posPlayers] of byPosition) {
    // Sort by VBD descending
    posPlayers.sort((a, b) => b.vbd - a.vbd);

    if (posPlayers.length <= 1) {
      posPlayers.forEach(p => p.tier = 1);
      continue;
    }

    // Calculate gaps between consecutive players
    const gaps: number[] = [];
    for (let i = 1; i < posPlayers.length; i++) {
      gaps.push(posPlayers[i - 1].vbd - posPlayers[i].vbd);
    }

    // Find gap threshold: mean + 0.5 * std dev
    const meanGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const variance = gaps.reduce((s, g) => s + (g - meanGap) ** 2, 0) / gaps.length;
    const stdGap = Math.sqrt(variance);
    const threshold = meanGap + 0.5 * stdGap;

    // Assign tiers
    let tier = 1;
    posPlayers[0].tier = tier;
    for (let i = 1; i < posPlayers.length; i++) {
      if (gaps[i - 1] > threshold) {
        tier++;
      }
      posPlayers[i].tier = tier;
    }
  }
}

/**
 * Calculate positional scarcity scores.
 *
 * Scarcity = how much value drops per additional player drafted at this position.
 * Higher scarcity means more urgency to draft this position.
 */
function calculateScarcityScores(
  players: PlayerWithVBD[],
  config: VBDConfig
): void {
  const byPosition = new Map<string, PlayerWithVBD[]>();
  for (const p of players) {
    const existing = byPosition.get(p.position) || [];
    existing.push(p);
    byPosition.set(p.position, existing);
  }

  for (const [position, posPlayers] of byPosition) {
    const starterCount = config.rosterSlots[position] || 1;
    const totalRelevant = config.leagueSize * starterCount;

    for (const player of posPlayers) {
      if (player.positionRank <= totalRelevant) {
        // Starter-caliber: higher scarcity as we approach replacement level
        player.scarcityScore = player.positionRank / totalRelevant;
      } else {
        // Below replacement: minimal scarcity
        player.scarcityScore = 0.1;
      }
    }
  }
}

/**
 * Get the top N players by VBD, optionally filtered by position.
 */
export function getTopPlayers(
  rankings: PlayerWithVBD[],
  count: number,
  position?: string
): PlayerWithVBD[] {
  let filtered = rankings;
  if (position) {
    filtered = rankings.filter(p => p.position === position);
  }
  return filtered.slice(0, count);
}

/**
 * Calculate fantasy points from raw stats and scoring settings.
 */
export function calculateFantasyPoints(
  stats: Record<string, number>,
  scoring: ScoringSettings
): number {
  let points = 0;

  // Passing
  if (stats.pass_yards && scoring.pass_yards_per_point) {
    points += stats.pass_yards / scoring.pass_yards_per_point;
  }
  if (stats.pass_td && scoring.pass_td) {
    points += stats.pass_td * scoring.pass_td;
  }
  if (stats.interceptions && scoring.interception) {
    points += stats.interceptions * scoring.interception;
  }

  // Rushing
  if (stats.rush_yards && scoring.rush_yards_per_point) {
    points += stats.rush_yards / scoring.rush_yards_per_point;
  }
  if (stats.rush_td && scoring.rush_td) {
    points += stats.rush_td * scoring.rush_td;
  }

  // Receiving
  if (stats.receptions && scoring.reception) {
    points += stats.receptions * scoring.reception;
  }
  if (stats.receiving_yards && scoring.receiving_yards_per_point) {
    points += stats.receiving_yards / scoring.receiving_yards_per_point;
  }
  if (stats.receiving_td && scoring.receiving_td) {
    points += stats.receiving_td * scoring.receiving_td;
  }

  // Turnovers
  if (stats.fumbles_lost && scoring.fumble_lost) {
    points += stats.fumbles_lost * scoring.fumble_lost;
  }

  // NBA
  if (stats.points_scored && scoring.points) {
    points += stats.points_scored * scoring.points;
  }
  if (stats.rebounds_total && scoring.rebounds) {
    points += stats.rebounds_total * scoring.rebounds;
  }
  if (stats.assists_total && scoring.assists) {
    points += stats.assists_total * scoring.assists;
  }
  if (stats.steals_total && scoring.steals) {
    points += stats.steals_total * scoring.steals;
  }
  if (stats.blocks_total && scoring.blocks) {
    points += stats.blocks_total * scoring.blocks;
  }
  if (stats.turnovers_total && scoring.turnovers) {
    points += stats.turnovers_total * scoring.turnovers;
  }

  // MLB
  if (stats.home_runs_total && scoring.home_runs) {
    points += stats.home_runs_total * scoring.home_runs;
  }
  if (stats.rbis_total && scoring.rbis) {
    points += stats.rbis_total * scoring.rbis;
  }
  if (stats.stolen_bases_total && scoring.stolen_bases) {
    points += stats.stolen_bases_total * scoring.stolen_bases;
  }

  return Math.round(points * 100) / 100;
}
