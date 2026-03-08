/**
 * VPE 3.0 — Vortex Projection Engine
 * =====================================
 * Fully modular baseball analytics engine for MLB player projection,
 * simulation, and ranking with extreme granularity.
 *
 * Integrates Statcast, Hawk-Eye, park/weather factors, historical
 * performance, and Minor League stats for DFS, betting, and
 * front-office analytics.
 *
 * @example
 * ```ts
 * import { runVPEEngine, mockEliteHitter, mockAcePitcher, mockProspect } from '@/lib/vpe3';
 *
 * const result = runVPEEngine(
 *   [mockEliteHitter()],
 *   [mockAcePitcher()],
 *   [mockProspect()],
 *   { seed: 42, simIterations: 1000 },
 * );
 *
 * console.log(result.hitters[0].vpeVal);        // Hitter VPE-Val
 * console.log(result.pitchers[0].stuffPlus);     // Stuff+ by pitch
 * console.log(result.dfsLineup);                 // Optimized DFS lineup
 * console.log(result.bettingEdges);              // HR prop edges
 * ```
 */

// ── Types ───────────────────────────────────────────────────────────────────
export type {
  Position,
  Handedness,
  Granularity,
  BreakoutTier,
  StuffGrade,
  TunnelGrade,
  CSWTier,
  MiLBLevel,
  ParkFactors,
  WeatherConditions,
  DFSModifiers,
  PlayerBase,
  HitterStats,
  PitcherStats,
  MinorLeaguePlayerStats,
  StuffPlusResult,
  TunnelResult,
  CSWResult,
  PitchSequencePrediction,
  BreakoutResult,
  InjuryRiskResult,
  DecisionTimeResult,
  DefensivePositionResult,
  SimulationResult,
  HitterSimResult,
  PitcherSimResult,
  SeasonSimResult,
  MiLBProjection,
  DFSLineup,
  BettingEdge,
  TradeValue,
  VPE3Result,
} from './types';

export { LEAGUE_AVG } from './types';

// ── Constants ───────────────────────────────────────────────────────────────
export {
  PARK_FACTORS,
  NEUTRAL_PARK,
  getParkFactors,
  INDOOR_TEAMS,
  MILB_TRANSLATION,
  DK_SCORING,
  PITCH_TRANSITIONS,
  COUNT_ADJUSTMENTS,
} from './constants';

// ── Core Functions ──────────────────────────────────────────────────────────
export {
  ageFactor,
  computeHitterZScores,
  computePitcherZScores,
  platoonAdvantage,
  parkAdjRate,
  weatherMultiplier,
  dayNightMultiplier,
  computeDFSModifiers,
  compositeDFSMultiplier,
  powerCore,
  enhancedWrcPlus,
  hitterVpeVal,
  arsenalBoost,
  releaseVariancePenalty,
  kSkill,
  savesLeverageBonus,
  vpeEra,
  vpePlus,
  pitcherVpeVal,
  pythagoreanWinPct,
} from './core';

// ── Pitch Modeling ──────────────────────────────────────────────────────────
export {
  calculateStuffPlus,
  arsenalStuffPlus,
  scoreTunnel,
  analyzePitcherTunneling,
  analyzeCSW,
  predictNextPitch,
} from './pitch-modeling';

// ── Breakout Detection ──────────────────────────────────────────────────────
export {
  powerBreakoutIndex,
  swingEfficiency,
  sleeperScore,
  mvpScore,
  analyzeBreakout,
} from './breakout';

// ── Injury Risk ─────────────────────────────────────────────────────────────
export { calculateInjuryRisk } from './injury';

// ── Game State AI ───────────────────────────────────────────────────────────
export {
  decisionTimeScore,
  estimateDecisionTime,
  calculateEOA,
  optimizeDefensivePositioning,
} from './game-state';

// ── Simulation ──────────────────────────────────────────────────────────────
export {
  simulateHitterGame,
  simulatePitcherGame,
  simulateSeason,
  simulateMultiTeamSeason,
} from './simulation';

// ── MiLB Projections ────────────────────────────────────────────────────────
export {
  milbVpeVal,
  projectMLBDebut,
  milbMonteCarloProjection,
  rankCallUps,
} from './milb';

// ── Optimizer ───────────────────────────────────────────────────────────────
export {
  optimizeDFSLineup,
  calculateBettingEdge,
  batchHRPropEdges,
  calculateTradeValue,
  rankTradeValues,
} from './optimizer';

// ── Engine Orchestrator ─────────────────────────────────────────────────────
export { runVPEEngine } from './engine';
export type { VPEEngineOptions } from './engine';

// ── Mock Data ───────────────────────────────────────────────────────────────
export {
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
} from './mock-data';
