/**
 * LeverageMetrics MLB Projection Engine
 * Barrel exports for all public interfaces.
 */

// Core pipeline
export { runProjectionPipeline, projectSinglePlayer } from './projection-pipeline';
export type { MLBProjectionCardData, PlayerProjection } from './projection-pipeline';

// Data sources
export { fetchTodaysGames, getRemainingGames } from './mlb-stats-api';
export { fetchStatcastHitters, fetchStatcastPitchers, findHitterByName, findPitcherByName } from './statcast-client';
export { getParkFactors } from './park-factors';
export type { ParkFactors } from './park-factors';

// Feature engineering
export { buildHitterFeatures, buildPitcherFeatures, buildBiomechanicsFeatures, computeWeatherAdjustment } from './feature-engineering';
export type { HitterFeatures, PitcherFeatures, BiomechanicsFeatures, WeatherConditions } from './feature-engineering';

// Models
export { hrProbabilityPerAB, kProbabilityPerAB, pitcherBreakoutScore, computeHitterProbs, computePitcherProbs } from './models';

// Monte Carlo
export { simulateHitter, simulatePitcher, formatPercentiles } from './monte-carlo';

// Matchup engine
export { computeMatchupVariables, getDFSMatchupLabel } from './matchup-engine';

// Adapters
export { buildDFSCards } from './dfs-adapter';
export { buildBettingEdgeCards, buildKPropEdgeCards } from './betting-edges';
export { buildFantasyCards, buildROSProjectionCards, buildStreamingPitcherCards, buildWaiverCards } from './fantasy-adapter';
export { buildDFSSlate } from './slate-builder';
