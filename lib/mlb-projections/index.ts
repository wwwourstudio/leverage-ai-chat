/**
 * LeverageMetrics MLB Projection Engine
 * Barrel exports for all public interfaces.
 *
 * ─── Architecture layers ──────────────────────────────────────────────────────
 *   Data sources       → statcast-client, mlb-stats-api, park-factors
 *   Feature engineering→ feature-engineering
 *   Model config       → model-config  (coefficients + Platt calibration params)
 *   Models             → models        (inference: hrProbabilityPerAB, etc.)
 *   Simulation         → monte-carlo
 *   Signal aggregation → signal-aggregator  (composite real-time signal)
 *   Backtesting        → backtester         (historical evaluation + calibration)
 *   Card builders      → betting-edges, dfs-adapter, fantasy-adapter, slate-builder
 *   Pipeline           → projection-pipeline (orchestrates all layers)
 */

// ── Core pipeline ──────────────────────────────────────────────────────────────
export { runProjectionPipeline, projectSinglePlayer } from './projection-pipeline';
export type { MLBProjectionCardData, PlayerProjection } from './projection-pipeline';

// ── Data sources ───────────────────────────────────────────────────────────────
export { fetchTodaysGames, getRemainingGames } from './mlb-stats-api';
export { fetchStatcastHitters, fetchStatcastPitchers, findHitterByName, findPitcherByName } from './statcast-client';
export { getParkFactors } from './park-factors';
export type { ParkFactors } from './park-factors';

// ── Feature engineering ────────────────────────────────────────────────────────
export { buildHitterFeatures, buildPitcherFeatures, buildBiomechanicsFeatures, computeWeatherAdjustment } from './feature-engineering';
export type { HitterFeatures, PitcherFeatures, BiomechanicsFeatures, WeatherConditions } from './feature-engineering';

// ── Model configuration ────────────────────────────────────────────────────────
// Import DEFAULT_MODEL_CONFIG when you need the baseline weights,
// or pass a calibrated ModelConfig to hrProbabilityPerAB/kProbabilityPerAB.
export { DEFAULT_MODEL_CONFIG } from './model-config';
export type { ModelConfig, HRModelWeights, KModelWeights, PlattCalibration } from './model-config';

// ── Models ─────────────────────────────────────────────────────────────────────
export { hrProbabilityPerAB, kProbabilityPerAB, pitcherBreakoutScore, computeHitterProbs, computePitcherProbs } from './models';
export type { HitterProjectedStats, PitcherProjectedStats } from './models';

// ── Monte Carlo simulation ─────────────────────────────────────────────────────
export { simulateHitter, simulatePitcher, formatPercentiles } from './monte-carlo';

// ── Matchup engine ─────────────────────────────────────────────────────────────
export { computeMatchupVariables, getDFSMatchupLabel } from './matchup-engine';

// ── Signal aggregation (real-time composite layer) ────────────────────────────
// The main user-interaction enhancement: aggregateSignal() combines model prob
// + live market odds + sharp signals + calibration into one CompositeSignal.
export { aggregateSignal, aggregateSlate, aggregateSharpSignals } from './signal-aggregator';
export type {
  CompositeSignal,
  SignalStrength,
  Recommendation,
  SharpSignalRecord,
  SharpContext,
  AggregatorInput,
  ConfidenceBand,
} from './signal-aggregator';

// ── Backtesting framework ─────────────────────────────────────────────────────
// runBacktest() is pure TS — no DB calls. DB I/O lives in cron/backtest/route.ts.
export { runBacktest, parkFactorBucket, exitVelocityBucket, weatherBucket } from './backtester';
export type {
  BacktestReport,
  BacktestOptions,
  SegmentReport,
  SegmentMetrics,
  PlattEstimate,
  PickResult,
} from './backtester';

// ── Card builders (output adapters) ───────────────────────────────────────────
export { buildDFSCards } from './dfs-adapter';
export { buildBettingEdgeCards, buildKPropEdgeCards } from './betting-edges';
export { buildFantasyCards, buildROSProjectionCards, buildStreamingPitcherCards, buildWaiverCards } from './fantasy-adapter';
export { buildDFSSlate } from './slate-builder';
