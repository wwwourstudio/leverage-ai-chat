/**
 * VPE 3.0 — Main Engine Orchestrator
 * =====================================
 * Combines all VPE 3.0 modules into a single orchestration layer.
 * Produces complete VPE3Result with hitter/pitcher projections,
 * breakout detection, injury risk, team simulations, MiLB call-ups,
 * DFS lineups, betting edges, and trade values.
 */

import type {
  HitterStats,
  PitcherStats,
  MinorLeaguePlayerStats,
  WeatherConditions,
  ParkFactors,
  Granularity,
  DFSModifiers,
  VPE3Result,
  BreakoutResult,
  StuffPlusResult,
  CSWResult,
  InjuryRiskResult,
} from './types';

import {
  computeHitterZScores,
  computePitcherZScores,
  hitterVpeVal,
  pitcherVpeVal,
  computeDFSModifiers,
  compositeDFSMultiplier,
} from './core';

import { arsenalStuffPlus, analyzeCSW } from './pitch-modeling';
import { analyzeBreakout } from './breakout';
import { calculateInjuryRisk } from './injury';
import { simulateHitterGame, simulatePitcherGame, simulateSeason } from './simulation';
import { milbMonteCarloProjection, rankCallUps } from './milb';
import { optimizeDFSLineup, batchHRPropEdges, rankTradeValues } from './optimizer';
import { getParkFactors, NEUTRAL_PARK } from './constants';

// ── Engine Options ──────────────────────────────────────────────────────────

export interface VPEEngineOptions {
  granularity?: Granularity;
  seed?: number;
  simIterations?: number;
  salaryCap?: number;
  rosterSize?: number;
  weather?: WeatherConditions;
  parkOverride?: ParkFactors;
  /** Prior season data for breakout/sleeper detection (playerId → metrics) */
  priorSeasonData?: Map<string, {
    ev50: number;
    blastRate: number;
    contactPct: number;
    chaseRate: number;
  }>;
  /** Prior pitcher data for injury risk (playerId → metrics) */
  priorPitcherData?: Map<string, {
    velocity: number;
    spinRate: number;
    workloadInnings: number;
  }>;
  /** Market odds for betting edge calculation (playerId → American odds) */
  marketOdds?: Record<string, number>;
  /** Trade value inputs (playerId → { war, surplus, scarcity }) */
  tradeInputs?: Array<{
    playerId: string;
    war: number;
    surplus: number;
    scarcity: number;
  }>;
}

// ── Main Engine ─────────────────────────────────────────────────────────────

/**
 * Run the full VPE 3.0 engine pipeline.
 *
 * Pipeline:
 * 1. Compute z-scores for all players
 * 2. Calculate VPE-Val for hitters and pitchers
 * 3. Run breakout detection on hitters
 * 4. Run Stuff+ and CSW analysis on pitchers
 * 5. Run injury risk assessment on pitchers
 * 6. Monte Carlo simulate game outcomes
 * 7. Build team projections and season simulation
 * 8. Project MiLB call-ups
 * 9. Optimize DFS lineup
 * 10. Calculate betting edges
 * 11. Compute trade values
 */
export function runVPEEngine(
  hitters: HitterStats[],
  pitchers: PitcherStats[],
  milbPlayers: MinorLeaguePlayerStats[] = [],
  options: VPEEngineOptions = {},
): VPE3Result {
  const {
    granularity = 'daily',
    seed = 42,
    simIterations = 1000,
    salaryCap = 50000,
    rosterSize = 10,
    weather,
    parkOverride,
    priorSeasonData,
    priorPitcherData,
    marketOdds = {},
    tradeInputs = [],
  } = options;

  // --- Step 1: Z-scores ---
  const zHitters = hitters.map(computeHitterZScores);
  const zPitchers = pitchers.map(computePitcherZScores);

  // --- Step 2 & 3: Hitter VPE-Val + Breakout ---
  const enrichedHitters = zHitters.map((h) => {
    const park = parkOverride ?? getParkFactors(h.team);
    const vpe = hitterVpeVal(h, park.hr);
    const prior = priorSeasonData?.get(h.playerId);
    const breakout = analyzeBreakout(h, prior);
    return { ...h, vpeVal: vpe, breakout };
  });

  // --- Step 4 & 5: Pitcher Stuff+, CSW, Injury ---
  const enrichedPitchers = zPitchers.map((p) => {
    const park = parkOverride ?? getParkFactors(p.team);
    const vpe = pitcherVpeVal(p, park.runs);
    const stuffPlus = arsenalStuffPlus(p);
    const csw = analyzeCSW(p);

    const priorP = priorPitcherData?.get(p.playerId);
    const injuryRisk = calculateInjuryRisk(
      p,
      priorP?.velocity,
      priorP?.spinRate,
      priorP?.workloadInnings,
    );

    return { ...p, vpeVal: vpe, stuffPlus, csw, injuryRisk };
  });

  // Sort by VPE-Val descending
  enrichedHitters.sort((a, b) => b.vpeVal - a.vpeVal);
  enrichedPitchers.sort((a, b) => b.vpeVal - a.vpeVal);

  // --- Step 6: Monte Carlo Simulation (top players) ---
  const simResults = new Map<string, { mean: number; p10: number; p90: number }>();

  for (const h of enrichedHitters.slice(0, 20)) {
    const sim = simulateHitterGame(h, simIterations, seed);
    simResults.set(h.playerId, {
      mean: sim.dkPts.mean,
      p10: sim.dkPts.p10,
      p90: sim.dkPts.p90,
    });
  }
  for (const p of enrichedPitchers.slice(0, 10)) {
    const sim = simulatePitcherGame(p, simIterations, seed);
    simResults.set(p.playerId, {
      mean: sim.dkPts.mean,
      p10: sim.dkPts.p10,
      p90: sim.dkPts.p90,
    });
  }

  // --- Step 7: Team Season Simulation ---
  // Group players by team for team-level projections
  const teamMap = new Map<string, { hitters: HitterStats[]; pitchers: PitcherStats[] }>();
  for (const h of enrichedHitters) {
    const t = teamMap.get(h.team) ?? { hitters: [], pitchers: [] };
    t.hitters.push(h);
    teamMap.set(h.team, t);
  }
  for (const p of enrichedPitchers) {
    const t = teamMap.get(p.team) ?? { hitters: [], pitchers: [] };
    t.pitchers.push(p);
    teamMap.set(p.team, t);
  }

  const teamProjections = Array.from(teamMap.entries()).map(([team, roster], i) => {
    const park = getParkFactors(team);
    return simulateSeason(
      {
        name: team,
        hitters: roster.hitters,
        pitchers: roster.pitchers,
        parkHrFactor: park.hr,
        parkRunsFactor: park.runs,
      },
      Math.min(simIterations, 500), // fewer iterations for team sim
      seed + i * 1000,
    );
  });

  // --- Step 8: MiLB Call-Ups ---
  const milbCallUps = milbPlayers.length > 0
    ? rankCallUps(milbPlayers, parkOverride ?? NEUTRAL_PARK, seed)
        .map(p => p.projection)
    : [];

  // --- Step 9: DFS Lineup ---
  const dfsLineup = enrichedHitters.length > 0 || enrichedPitchers.length > 0
    ? optimizeDFSLineup(enrichedHitters, enrichedPitchers, salaryCap, rosterSize)
    : null;

  // --- Step 10: Betting Edges ---
  const bettingEdges = batchHRPropEdges(enrichedHitters, marketOdds);

  // --- Step 11: Trade Values ---
  const tradeValues = tradeInputs.length > 0
    ? rankTradeValues(
        tradeInputs.map(ti => {
          const player =
            enrichedHitters.find(h => h.playerId === ti.playerId) ??
            enrichedPitchers.find(p => p.playerId === ti.playerId);
          return {
            player: player ?? enrichedHitters[0],
            war: ti.war,
            surplus: ti.surplus,
            scarcity: ti.scarcity,
          };
        }),
      )
    : [];

  return {
    hitters: enrichedHitters,
    pitchers: enrichedPitchers,
    teamProjections,
    milbCallUps,
    dfsLineup,
    bettingEdges,
    tradeValues,
    metadata: {
      version: '3.0.0',
      timestamp: new Date().toISOString(),
      granularity,
      seed,
    },
  };
}
