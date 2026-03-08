/**
 * VPE 3.0 — DFS Optimizer, Betting EV, and Trade Value
 * ======================================================
 * Linear programming DFS lineup optimization, betting edge
 * calculations with Kelly Criterion, and franchise trade value.
 */

import {
  LEAGUE_AVG,
  type HitterStats,
  type PitcherStats,
  type PlayerBase,
  type DFSLineup,
  type BettingEdge,
  type TradeValue,
  type DFSModifiers,
  type SimulationResult,
} from './types';
import { hitterVpeVal, pitcherVpeVal, ageFactor, compositeDFSMultiplier } from './core';
import { calculateInjuryRisk } from './injury';

// ── DFS Optimizer ───────────────────────────────────────────────────────────

interface DFSCandidate {
  player: HitterStats | PitcherStats;
  position: string;
  salary: number;
  projectedPts: number;
  ceilingPts: number;
  floorPts: number;
  value: number; // pts per $1k
}

/**
 * Build DFS candidate pool with projected points and value scores.
 */
function buildCandidates(
  hitters: HitterStats[],
  pitchers: PitcherStats[],
  simResults?: Map<string, SimulationResult>,
  modifiers?: DFSModifiers,
): DFSCandidate[] {
  const mult = modifiers ? compositeDFSMultiplier(modifiers) : 1.0;
  const candidates: DFSCandidate[] = [];

  for (const h of hitters) {
    const sim = simResults?.get(h.playerId);
    const projPts = sim ? sim.mean * mult : estimateHitterDKPts(h) * mult;
    const ceiling = sim ? sim.p90 * mult : projPts * 1.6;
    const floor = sim ? sim.p10 * mult : projPts * 0.3;
    const salary = h.salary || estimateSalary(projPts, 'hitter');

    candidates.push({
      player: h,
      position: h.position,
      salary,
      projectedPts: Math.round(projPts * 100) / 100,
      ceilingPts: Math.round(ceiling * 100) / 100,
      floorPts: Math.round(floor * 100) / 100,
      value: Math.round((projPts / (salary / 1000)) * 100) / 100,
    });
  }

  for (const p of pitchers) {
    const sim = simResults?.get(p.playerId);
    const projPts = sim ? sim.mean : estimatePitcherDKPts(p);
    const ceiling = sim ? sim.p90 : projPts * 1.5;
    const floor = sim ? sim.p10 : projPts * 0.2;
    const salary = p.salary || estimateSalary(projPts, 'pitcher');

    candidates.push({
      player: p,
      position: p.position,
      salary,
      projectedPts: Math.round(projPts * 100) / 100,
      ceilingPts: Math.round(ceiling * 100) / 100,
      floorPts: Math.round(floor * 100) / 100,
      value: Math.round((projPts / (salary / 1000)) * 100) / 100,
    });
  }

  return candidates.sort((a, b) => b.value - a.value);
}

function estimateHitterDKPts(h: HitterStats): number {
  // Rough estimate: wRC+ / 100 * 8 (league avg ~8 DK pts)
  return (h.wrcPlus / 100) * 8 * (1 + h.barrelPct / 50);
}

function estimatePitcherDKPts(p: PitcherStats): number {
  const ip = p.position === 'SP' ? 5.5 : 1.5;
  const outs = ip * 3;
  return outs * 0.75 + (p.kPer9 / 9 * ip) * 2 - (p.era / 9 * ip) * 2;
}

function estimateSalary(projPts: number, type: 'hitter' | 'pitcher'): number {
  const rate = type === 'hitter' ? 810 : 420;
  const raw = projPts * rate;
  return Math.round(Math.max(2000, Math.min(15000, raw)) / 100) * 100;
}

/**
 * Greedy DFS lineup optimizer.
 *
 * Uses a greedy value-based approach with salary constraint.
 * For production, replace with integer linear programming (ILP).
 *
 * @param salaryCap DraftKings salary cap (default $50,000)
 * @param rosterSize Number of players to select (default 10)
 */
export function optimizeDFSLineup(
  hitters: HitterStats[],
  pitchers: PitcherStats[],
  salaryCap: number = 50000,
  rosterSize: number = 10,
  simResults?: Map<string, SimulationResult>,
  modifiers?: DFSModifiers,
): DFSLineup {
  const candidates = buildCandidates(hitters, pitchers, simResults, modifiers);

  // Greedy: pick highest value players within salary cap
  const selected: DFSCandidate[] = [];
  let remainingSalary = salaryCap;
  const usedPositions = new Set<string>();

  // Ensure at least 1 pitcher
  const pitcherCandidates = candidates.filter(c =>
    c.position === 'SP' || c.position === 'RP' || c.position === 'CL',
  );
  if (pitcherCandidates.length > 0) {
    const bestPitcher = pitcherCandidates[0];
    selected.push(bestPitcher);
    remainingSalary -= bestPitcher.salary;
    usedPositions.add(bestPitcher.player.playerId);
  }

  // Fill remaining slots with best value
  for (const candidate of candidates) {
    if (selected.length >= rosterSize) break;
    if (usedPositions.has(candidate.player.playerId)) continue;
    if (candidate.salary > remainingSalary) continue;

    // Ensure salary leaves room for remaining slots
    const slotsLeft = rosterSize - selected.length - 1;
    const minSalaryNeeded = slotsLeft * 2000;
    if (remainingSalary - candidate.salary < minSalaryNeeded) continue;

    selected.push(candidate);
    remainingSalary -= candidate.salary;
    usedPositions.add(candidate.player.playerId);
  }

  const totalSalary = selected.reduce((s, c) => s + c.salary, 0);
  const totalPts = selected.reduce((s, c) => s + c.projectedPts, 0);
  const ceilingPts = selected.reduce((s, c) => s + c.ceilingPts, 0);
  const floorPts = selected.reduce((s, c) => s + c.floorPts, 0);

  return {
    players: selected.map(c => ({
      player: c.player,
      position: c.position as any,
      salary: c.salary,
      projectedPts: c.projectedPts,
    })),
    totalSalary,
    totalProjectedPts: Math.round(totalPts * 100) / 100,
    ceilingPts: Math.round(ceilingPts * 100) / 100,
    floorPts: Math.round(floorPts * 100) / 100,
  };
}

// ── Betting EV Calculator ───────────────────────────────────────────────────

/**
 * Convert probability to American odds.
 */
function probToAmericanOdds(prob: number): number {
  if (prob <= 0 || prob >= 1) return 0;
  if (prob >= 0.5) {
    return Math.round(-prob / (1 - prob) * 100);
  }
  return Math.round((1 - prob) / prob * 100);
}

/**
 * Convert American odds to implied probability.
 */
function americanOddsToProb(odds: number): number {
  if (odds < 0) return Math.abs(odds) / (Math.abs(odds) + 100);
  return 100 / (odds + 100);
}

/**
 * Calculate betting edge for a player prop.
 *
 * Edge = Fair Probability - Market Implied Probability
 * Kelly Fraction = (Edge × (odds + 1) - 1) / odds (quarter-Kelly, capped 2%)
 */
export function calculateBettingEdge(
  playerName: string,
  propType: string,
  fairProbability: number,
  marketOdds: number,
): BettingEdge {
  const marketProb = americanOddsToProb(marketOdds);
  const fairOdds = probToAmericanOdds(fairProbability);
  const edge = fairProbability - marketProb;

  // Quarter-Kelly criterion, capped at 2%
  const decimalOdds = marketOdds > 0 ? marketOdds / 100 + 1 : 100 / Math.abs(marketOdds) + 1;
  const fullKelly = edge > 0 ? (edge * decimalOdds - (1 - fairProbability)) / decimalOdds : 0;
  const kellyFraction = Math.min(0.02, Math.max(0, fullKelly * 0.25));

  let recommendation: BettingEdge['recommendation'];
  if (edge >= 0.06) recommendation = 'Strong Bet';
  else if (edge >= 0.03) recommendation = 'Value';
  else if (edge >= 0.01) recommendation = 'Lean';
  else recommendation = 'Pass';

  return {
    playerName,
    propType,
    fairProbability: Math.round(fairProbability * 1000) / 1000,
    marketProbability: Math.round(marketProb * 1000) / 1000,
    edgePct: Math.round(edge * 10000) / 100,
    kellyFraction: Math.round(kellyFraction * 10000) / 10000,
    fairOdds,
    marketOdds,
    recommendation,
  };
}

/**
 * Batch calculate HR prop betting edges for a set of hitters.
 */
export function batchHRPropEdges(
  hitters: HitterStats[],
  marketOddsMap: Record<string, number> = {},
): BettingEdge[] {
  return hitters
    .map(h => {
      // Fair HR probability from Statcast power metrics
      const fairProb = Math.min(0.12, Math.max(0.01,
        (h.barrelPct / 100) * 0.4 + (h.iso / 2.0) * 0.3 + 0.015,
      ));
      const marketOdds = marketOddsMap[h.playerId] ?? probToAmericanOdds(fairProb * 0.85);

      return calculateBettingEdge(h.name, 'HR', fairProb, marketOdds);
    })
    .filter(e => e.edgePct > 1.0)
    .sort((a, b) => b.edgePct - a.edgePct);
}

// ── Trade Value Calculator ──────────────────────────────────────────────────

/**
 * TradeValue = 3*ProjectedWAR + 2*AgeFactor + 1.5*ContractSurplus
 *            - 1*InjuryRisk + 0.8*PositionalScarcity
 */
export function calculateTradeValue(
  player: HitterStats | PitcherStats,
  projectedWAR: number,
  contractSurplus: number = 0,
  positionalScarcity: number = 1.0,
): TradeValue {
  const af = ageFactor(player.age);

  // Estimate injury risk for pitchers
  let injuryRisk = 0;
  if ('velocity' in player) {
    const ir = calculateInjuryRisk(player as PitcherStats);
    injuryRisk = ir.riskScore / 10; // normalize to 0-1 scale
  }

  const tradeVal =
    3.0 * projectedWAR +
    2.0 * af +
    1.5 * contractSurplus -
    1.0 * injuryRisk +
    0.8 * positionalScarcity;

  return {
    playerName: player.name,
    tradeValue: Math.round(tradeVal * 100) / 100,
    projectedWAR,
    ageFactor: Math.round(af * 1000) / 1000,
    contractSurplus,
    injuryRisk: Math.round(injuryRisk * 1000) / 1000,
    positionalScarcity,
    rank: 0, // filled during ranking
  };
}

/**
 * Rank players by trade value for front-office analytics.
 */
export function rankTradeValues(
  players: Array<{ player: HitterStats | PitcherStats; war: number; surplus: number; scarcity: number }>,
): TradeValue[] {
  return players
    .map(({ player, war, surplus, scarcity }) =>
      calculateTradeValue(player, war, surplus, scarcity),
    )
    .sort((a, b) => b.tradeValue - a.tradeValue)
    .map((tv, i) => ({ ...tv, rank: i + 1 }));
}
