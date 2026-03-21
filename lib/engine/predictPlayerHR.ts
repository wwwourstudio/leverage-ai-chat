/**
 * predictPlayerHR — Master 4-Layer HR Prediction Pipeline
 *
 * Orchestrates the full intelligence stack in the correct order:
 *
 *   Layer 0 — Matchup Engine      calculateMatchupFactor(lineupCtx)
 *   Layer 1 — Context Engine      park factor × weather factor
 *   Layer 2 — Logistic ML Model   hrProbabilityPerAB(hitterFeatures, config)
 *   Layer 3 — Signal Aggregator   aggregateSignal(modelProb, odds, sharps, calibration)
 *
 * ─── Canonical "massive edge" scenario ───────────────────────────────────────
 *   Aaron Judge (slot 4, R-vs-L would be neutral, but assume LHB example):
 *   Cleanup LHB (×1.28) + platoon L-vs-R (+0.14) + flyball pitcher (+0.07)
 *   + protection 0.88 (+0.11) + top-5 team (+0.06)
 *   = matchup_factor ≈ 1.49
 *
 *   × park_factor Coors (1.22)
 *   × weather_factor 92°F + 12mph out (≈1.19)
 *   Net multiplicative boost ≈ 2.16× on the base HR/AB probability
 *
 * ─── Output ──────────────────────────────────────────────────────────────────
 * HRPrediction exposes every layer's contribution so the edge scorer,
 * dashboard, and backtest can all read the raw vs calibrated vs final values
 * without re-running the pipeline.
 */

import { calculateMatchupFactor, explainMatchupFactor } from './matchup';
import type { LineupContext, MatchupBreakdown } from './matchup';

import { buildHitterFeatures, computeWeatherAdjustment } from '@/lib/mlb-projections/feature-engineering';
import type { WeatherConditions } from '@/lib/mlb-projections/feature-engineering';

import { getParkFactors } from '@/lib/mlb-projections/park-factors';
import { hrProbabilityPerAB, computeHitterProbs } from '@/lib/mlb-projections/models';
import type { HitterProjectedStats } from '@/lib/mlb-projections/models';
import { DEFAULT_MODEL_CONFIG } from '@/lib/mlb-projections/model-config';
import type { ModelConfig } from '@/lib/mlb-projections/model-config';

import { aggregateSignal } from '@/lib/mlb-projections/signal-aggregator';
import type { CompositeSignal, SharpSignalRecord, AggregatorInput } from '@/lib/mlb-projections/signal-aggregator';

import type { StatcastHitterStats } from '@/lib/mlb-projections/statcast-client';

// ─── Input types ──────────────────────────────────────────────────────────────

/** Minimal pitcher context required by the matchup + feature layers */
export interface PitcherContext {
  playerId: number;
  playerName: string;
  team: string;
  throws: 'R' | 'L';
  /** Fly-ball % of total balls in play (0–100) */
  flyballPct: number;
  /** HR/9 split vs the batter's specific hand */
  hr9VsHand: number;
  /** Overall HR/9 for feature engineering */
  hrPer9: number;
  /** Pitcher K% */
  kPct: number;
  /** Pitcher BB% */
  bbPct: number;
  /** Fastball velocity mph */
  avgVelocity: number;
  /** Spin rate RPM */
  spinRate: number;
  /** Horizontal movement (inches) */
  horizontalBreak: number;
  /** Vertical movement (inches) */
  verticalBreak: number;
  /** Release extension ft */
  extension: number;
  /** Release height ft */
  releaseHeight: number;
  /** Pitch mix fractions (0–100 each, should sum to 100) */
  fastballPct: number;
  breakingPct: number;
  offspeedPct: number;
  /** Whiff % (optional — used for DFS matchup score) */
  whiffPct?: number;
}

/** Game-level context: venue, weather, lineup structure */
export interface GameContext {
  gameId: string;
  gameDate: string;               // YYYY-MM-DD
  homeTeam: string;
  awayTeam: string;
  venue: string;

  // Weather
  weather: WeatherConditions;

  // Lineup structure for the batter
  lineupSlot: number;            // 1–9
  /** OPS of the batters immediately before and after in the lineup */
  prevBatterOPS: number;
  nextBatterOPS: number;

  /** League HR rank of the batter's team (1 = most HRs) */
  teamPowerRank: number;

  /** Opposing bullpen HR/9 allowed (league avg ≈ 1.2; lower = tougher pen) */
  bullpenHr9: number;
}

/** Full input bundle for one batter-pitcher-game prediction */
export interface HRPredictionInput {
  /** Batter Statcast season stats */
  batter: StatcastHitterStats;

  /** Opposing starter context */
  pitcher: PitcherContext;

  /** Game-level context */
  game: GameContext;

  /** Best available American odds from market (null = no live market) */
  bestAmericanOdds: number | null;

  /** Recent sharp signals for the full slate (filtered internally by player name) */
  sharpSignals: SharpSignalRecord[];

  /** Optional: override model config with calibrated weights */
  modelConfig?: ModelConfig;
}

// ─── Output types ─────────────────────────────────────────────────────────────

/** Snapshot of every layer's contribution — persisted to matchup_snapshots */
export interface LayerSnapshot {
  // Layer 0
  matchupFactor: number;
  matchupBreakdown: MatchupBreakdown;

  // Layer 1
  parkFactor: number;        // HR-specific park factor from getParkFactors()
  weatherFactor: number;     // weatherAdjustment from feature-engineering
  contextMultiplier: number; // parkFactor × (1 + weatherFactor)

  // Layer 2
  rawLogitInputs: {
    barrelPct: number;
    exitVelocity: number;
    launchAngle: number;
    iso: number;
    hrFbRatio: number;
    parkFactor: number;
    weatherAdjustment: number;
    platoonAdvantage: number;
    xwOBA: number;
    pullPowerScore: number;
  };
  modelProbPerAB: number;      // hrProbabilityPerAB output (before matchup scaling)
  matchupScaledProb: number;   // modelProbPerAB × matchupFactor (clamped [0.01, 0.15])
  hrPerGame: number;           // 1 - (1 - matchupScaledProb)^4

  // Projected counting stats (for Monte Carlo / DFS lineups)
  projectedStats: HitterProjectedStats;
}

/** Full prediction output — all layers exposed */
export interface HRPrediction {
  // Identity
  playerName: string;
  playerId: number;
  gameId: string;
  gameDate: string;
  venue: string;
  opponent: string;

  // Layer snapshots (full explainability)
  layers: LayerSnapshot;

  // Final signal (Layer 3)
  signal: CompositeSignal;

  // Convenience accessors
  finalProbability: number;  // signal.finalProb
  edge: number;              // signal.edge
  recommendation: string;   // 'BET' | 'MONITOR' | 'PASS'
  signalStrength: string;   // 'ELITE' | 'STRONG' | 'LEAN' | 'PASS'

  computedAt: string;
}

// ─── Pipeline implementation ──────────────────────────────────────────────────

/**
 * Run the full 4-layer HR prediction pipeline for a single batter-pitcher matchup.
 *
 * @example
 * ```ts
 * const prediction = await predictPlayerHR({
 *   batter: judgeStatcast,
 *   pitcher: verlander,
 *   game: { gameId: '746167', lineupSlot: 4, venue: 'Yankee Stadium', ... },
 *   bestAmericanOdds: 260,
 *   sharpSignals: todaysSlateSignals,
 * });
 *
 * if (prediction.recommendation === 'BET') {
 *   console.log(`Bet ${(prediction.signal.halfKelly * 100).toFixed(1)}% bankroll`);
 * }
 * ```
 */
export async function predictPlayerHR(input: HRPredictionInput): Promise<HRPrediction> {
  const { batter, pitcher, game, bestAmericanOdds, sharpSignals } = input;
  const config = input.modelConfig ?? DEFAULT_MODEL_CONFIG;

  // ── Layer 0: Matchup Engine ──────────────────────────────────────────────
  const lineupCtx: LineupContext = {
    lineup_slot:              game.lineupSlot,
    batter_hand:              batter.bats,
    pitcher_hand:             pitcher.throws,
    pitcher_flyball_pct:      pitcher.flyballPct,
    pitcher_hr9_vs_hand:      pitcher.hr9VsHand,
    protection_score:         (game.prevBatterOPS + game.nextBatterOPS) / 2,
    platoon_advantage:        batter.bats !== pitcher.throws,
    team_power_rank:          game.teamPowerRank,
    opposing_bullpen_hr9:     game.bullpenHr9,
  };

  const matchupFactor   = calculateMatchupFactor(lineupCtx);
  const matchupBreakdown = explainMatchupFactor(lineupCtx);

  // ── Layer 1: Context Engine ──────────────────────────────────────────────
  const parkFactors      = getParkFactors(game.venue);
  const parkFactor       = parkFactors.hr;
  const weatherFactor    = computeWeatherAdjustment(game.weather);
  // Combined context multiplier used as a single scalar to inspect Layer 1 impact
  const contextMultiplier = parkFactor * (1 + weatherFactor);

  // ── Layer 2: Feature Engineering → Logistic ML Model ────────────────────
  const hitterFeatures = buildHitterFeatures(
    batter,
    parkFactors,
    game.weather,
    pitcher.throws,
  );

  // Raw model probability per at-bat (before matchup scaling)
  const modelProbPerAB = hrProbabilityPerAB(hitterFeatures, config);

  // Apply matchup factor to model probability (clamped to [0.01, 0.15])
  // The matchup factor is applied AFTER the logistic model so that the Platt
  // calibration (which corrects the logit) is not distorted by the matchup
  const matchupScaledProb = Math.max(0.01, Math.min(0.15, modelProbPerAB * matchupFactor));

  // Per-game HR probability (binomial: at least 1 HR in ~4 AB)
  const hrPerGame = 1 - Math.pow(1 - matchupScaledProb, 4);

  // Full projected counting stats (for Monte Carlo / DFS)
  const projectedStats = computeHitterProbs(hitterFeatures, config);

  // Build layer snapshot for persistence and explainability
  const layers: LayerSnapshot = {
    matchupFactor,
    matchupBreakdown,
    parkFactor,
    weatherFactor,
    contextMultiplier,
    rawLogitInputs: {
      barrelPct:         hitterFeatures.barrelPct,
      exitVelocity:      hitterFeatures.exitVelocity,
      launchAngle:       hitterFeatures.launchAngle,
      iso:               hitterFeatures.iso,
      hrFbRatio:         hitterFeatures.hrFbRatio,
      parkFactor:        hitterFeatures.parkFactor,
      weatherAdjustment: hitterFeatures.weatherAdjustment,
      platoonAdvantage:  hitterFeatures.platoonAdvantage,
      xwOBA:             hitterFeatures.xwOBA,
      pullPowerScore:    hitterFeatures.pullPowerScore,
    },
    modelProbPerAB,
    matchupScaledProb,
    hrPerGame,
    projectedStats,
  };

  // ── Layer 3: Signal Aggregator ───────────────────────────────────────────
  // Load live Platt calibration from model_metrics if available
  // (fire-and-forget; defaults to alpha=1.0/beta=0.0 on failure)
  const calibration = await loadCalibration();

  const aggregatorInput: AggregatorInput = {
    playerName:      batter.playerName,
    propMarket:      'batter_home_runs',
    gameDate:        game.gameDate,
    modelProb:       matchupScaledProb,   // Layer 0+2 combined probability
    bestAmericanOdds,
    sharpSignals,
    calibration,
  };

  const signal = aggregateSignal(aggregatorInput);

  return {
    playerName:  batter.playerName,
    playerId:    batter.playerId,
    gameId:      game.gameId,
    gameDate:    game.gameDate,
    venue:       game.venue,
    opponent:    pitcher.team,

    layers,
    signal,

    finalProbability: signal.finalProb,
    edge:             signal.edge,
    recommendation:   signal.recommendation,
    signalStrength:   signal.signalStrength,

    computedAt: new Date().toISOString(),
  };
}

// ─── Batch pipeline ────────────────────────────────────────────────────────────

/**
 * Predict HR probability for an entire slate of players in parallel.
 * Results are sorted by finalProbability descending.
 *
 * @param inputs   Array of individual HRPredictionInput objects
 * @returns        Sorted HRPrediction array
 */
export async function predictSlate(inputs: HRPredictionInput[]): Promise<HRPrediction[]> {
  const results = await Promise.all(inputs.map(predictPlayerHR));
  return results.sort((a, b) => b.finalProbability - a.finalProbability);
}

// ─── Calibration loader ────────────────────────────────────────────────────────

/** Module-level cache: refresh at most once per hour */
let _calibrationCache: { alpha: number; beta: number } | null = null;
let _calibrationLoadedAt = 0;
const CALIBRATION_TTL_MS = 60 * 60 * 1000;

/**
 * Load the latest Platt calibration (alpha, beta) from the model_metrics table.
 * Uses window_days=0 sentinel row written by cron/backtest.
 * Falls back to identity calibration (alpha=1.0, beta=0.0) on any error.
 */
async function loadCalibration(): Promise<{ alpha: number; beta: number }> {
  if (_calibrationCache && Date.now() - _calibrationLoadedAt < CALIBRATION_TTL_MS) {
    return _calibrationCache;
  }

  try {
    if (typeof window !== 'undefined') return { alpha: 1.0, beta: 0.0 };

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data } = await supabase
      .from('model_metrics')
      .select('calibration_alpha, calibration_beta')
      .eq('window_days', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      _calibrationCache = {
        alpha: data.calibration_alpha ?? 1.0,
        beta:  data.calibration_beta  ?? 0.0,
      };
      _calibrationLoadedAt = Date.now();
      return _calibrationCache;
    }
  } catch {
    // Non-fatal — use identity calibration
  }

  return { alpha: 1.0, beta: 0.0 };
}
