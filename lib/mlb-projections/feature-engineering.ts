/**
 * Feature Engineering for MLB Projection Models
 * Transforms raw Statcast stats + context into model-ready feature vectors.
 */

import type { StatcastHitterStats, StatcastPitcherStats } from './statcast-client';
import type { ParkFactors } from './park-factors';

// ─── Types ────────────────────────────────────────────────────────────────────

/** 12-variable hitter feature vector for the HR Super Model */
export interface HitterFeatures {
  playerId: number;
  playerName: string;
  team: string;
  position: string;
  bats: 'R' | 'L' | 'S';
  // Core Statcast
  exitVelocity: number;    // avg EV mph
  launchAngle: number;     // degrees
  pullPct: number;         // 0–100
  barrelPct: number;       // 0–100
  iso: number;             // isolated power
  hrFbRatio: number;       // 0–1
  xwOBA: number;           // 0.000–0.600
  pullPowerScore: number;  // barrelPct × pullPct / 100 — composite power metric
  // Context
  parkFactor: number;      // HR park factor (1.0 = neutral)
  weatherAdjustment: number; // -0.15 to +0.15
  platoonAdvantage: number;  // -0.05 to +0.10
  umpireZoneTendency: number;// -0.05 to +0.05
}

/** 7-variable pitcher feature vector for the Strikeout Model */
export interface PitcherFeatures {
  playerId: number;
  playerName: string;
  team: string;
  throws: 'R' | 'L';
  // Model inputs
  kPct: number;            // 0–100
  bbPct: number;           // 0–100
  hrPer9: number;
  velocity: number;        // avg FB velo mph
  spinRate: number;        // rpm
  pitchMixEntropy: number; // Shannon entropy of pitch mix (0–1.5)
  releaseExtension: number;// ft
  whiffPct?: number;       // Whiff % (swings-and-misses / total swings, 0–100)
  // Computed
  parkFactor: number;
  weatherAdjustment: number;
}

/** 8-variable biomechanics feature vector for Pitcher Breakout Model */
export interface BiomechanicsFeatures {
  velocityTrend: number;      // normalized slope vs last 5 starts (-1 to +1)
  spinEfficiency: number;     // 0–100 (spinRate / 2800 × 100)
  kineticChainScore: number;  // velocity × extension / 650 (normalized 0–1)
  armSlotConsistency: number; // proxy: 1 - (releaseHeight stdev / mean), 0–1
  strideLength: number;       // extension proxy, normalized 0–1 (ext / 7.5)
  hipShoulderSeparation: number; // proxy: |horizontalBreak| / 15, 0–1
  releaseHeight: number;      // normalized ft / 7.0, 0–1
  movementScore: number;      // sqrt(pfx_x² + pfx_z²) / 20, 0–1
}

// ─── Weather adjustment computation ──────────────────────────────────────────

export interface WeatherConditions {
  tempF: number;           // Temperature in °F
  windSpeedMph: number;    // Wind speed in mph
  windDirectionDeg: number;// Wind direction (0=N, 90=E, 180=S, 270=W)
  isOutdoor: boolean;      // Indoor parks (Tropicana, Rogers Centre) ignore weather
}

/**
 * Compute weather-based HR adjustment factor.
 * Wind blowing out (to CF, RF, LF) boosts HRs; cold suppresses.
 * Range: approximately -0.15 to +0.15
 */
export function computeWeatherAdjustment(w: WeatherConditions, fieldOrientation = 90): number {
  if (!w.isOutdoor) return 0;

  // Temperature effect: optimal 72°F; ±1% per 5°F deviation, bounded
  const tempDelta = w.tempF - 72;
  const tempAdj = Math.max(-0.10, Math.min(0.08, tempDelta * 0.002));

  // Wind effect: component blowing toward CF (roughly fieldOrientation direction)
  // cosine of angle diff: positive = tailwind (blowing out), negative = headwind
  const angleDiffRad = ((w.windDirectionDeg - fieldOrientation + 360) % 360) * (Math.PI / 180);
  const windComponent = Math.cos(angleDiffRad) * w.windSpeedMph;
  const windAdj = Math.max(-0.12, Math.min(0.12, windComponent * 0.007));

  return +(tempAdj + windAdj).toFixed(4);
}

/** Compute platoon advantage: L batter vs R pitcher = +0.08, same-side = -0.03 */
export function computePlatoonAdvantage(bats: 'R' | 'L' | 'S', throws: 'R' | 'L' | 'S'): number {
  if (bats === 'S') return 0.04; // Switch hitters always have platoon advantage
  if (bats === 'L' && throws === 'R') return 0.08;
  if (bats === 'R' && throws === 'L') return 0.08;
  return -0.03; // Same-side matchup is harder
}

/** Shannon entropy of pitch mix — higher = more deceptive (harder to sit on a pitch) */
export function computePitchMixEntropy(fastballPct: number, breakingPct: number, offspeedPct: number): number {
  const probs = [fastballPct / 100, breakingPct / 100, offspeedPct / 100].filter(p => p > 0);
  return -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
}

// ─── Feature builders ────────────────────────────────────────────────────────

/**
 * Build HitterFeatures from Statcast data + context.
 * Applies Bayesian shrinkage for low-PA players (<100 PA → blend toward league avg).
 */
export function buildHitterFeatures(
  stats: StatcastHitterStats,
  parkFactors: ParkFactors,
  weather: WeatherConditions,
  opposingPitcherThrows: 'R' | 'L' | 'S' = 'R',
  position = 'OF',
): HitterFeatures {
  const LEAGUE_AVG_EV = 88.0;
  const LEAGUE_AVG_BARREL = 7.5;
  const LEAGUE_AVG_XWOBA = 0.315;

  // Bayesian shrinkage weight (100+ PA = no shrinkage)
  const shrinkWeight = Math.min(1, stats.pa / 100);

  const ev      = stats.avgExitVelocity * shrinkWeight + LEAGUE_AVG_EV     * (1 - shrinkWeight);
  const barrel  = stats.barrelPct        * shrinkWeight + LEAGUE_AVG_BARREL * (1 - shrinkWeight);
  const xwoba   = stats.xwOBA            * shrinkWeight + LEAGUE_AVG_XWOBA  * (1 - shrinkWeight);

  const pullPS = (barrel * (stats.pullPct ?? 38)) / 100;

  return {
    playerId:          stats.playerId,
    playerName:        stats.playerName,
    team:              stats.team,
    position,
    bats:              stats.bats,
    exitVelocity:      ev,
    launchAngle:       stats.launchAngle,
    pullPct:           stats.pullPct ?? 38,
    barrelPct:         barrel,
    iso:               stats.iso,
    hrFbRatio:         stats.hrFbRatio,
    xwOBA:             xwoba,
    pullPowerScore:    pullPS,
    parkFactor:        parkFactors.hr,
    weatherAdjustment: computeWeatherAdjustment(weather),
    platoonAdvantage:  computePlatoonAdvantage(stats.bats, opposingPitcherThrows),
    umpireZoneTendency:0, // Default 0; enriched when umpire data is available
  };
}

/**
 * Build PitcherFeatures from Statcast data + context.
 */
export function buildPitcherFeatures(
  stats: StatcastPitcherStats,
  parkFactors: ParkFactors,
  weather: WeatherConditions,
): PitcherFeatures {
  return {
    playerId:         stats.playerId,
    playerName:       stats.playerName,
    team:             stats.team,
    throws:           stats.throws,
    kPct:             stats.kPct,
    bbPct:            stats.bbPct,
    hrPer9:           stats.hrPer9,
    velocity:         stats.avgVelocity,
    spinRate:         stats.spinRate,
    pitchMixEntropy:  computePitchMixEntropy(stats.fastballPct, stats.breakingPct, stats.offspeedPct),
    releaseExtension: stats.extension,
    parkFactor:       parkFactors.k,
    weatherAdjustment:computeWeatherAdjustment(weather),
  };
}

/**
 * Build BiomechanicsFeatures from pitcher Statcast data.
 * All inputs normalized to 0–1 range for the breakout score formula.
 */
export function buildBiomechanicsFeatures(stats: StatcastPitcherStats): BiomechanicsFeatures {
  // Velocity trend: positive = gaining velocity (good), negative = declining (bad)
  // Proxy: velocity vs league avg (93.5 mph for starters), normalized
  const velocityTrend = Math.max(-1, Math.min(1, (stats.avgVelocity - 93.5) / 5));

  // Spin efficiency proxy: spinRate / 2800 (elite = 2600+)
  const spinEfficiency = Math.min(100, (stats.spinRate / 2800) * 100);

  // Kinetic chain: velocity × extension / 650 — top pitchers ~6.8 ext at 97+ mph
  const kineticChainScore = Math.min(1, (stats.avgVelocity * stats.extension) / 650);

  // Arm slot consistency: 1 - variance proxy (high extension = more consistent slot)
  const armSlotConsistency = Math.min(1, stats.extension / 7.5);

  // Stride length proxy: extension normalized (longer extension ≈ longer stride)
  const strideLength = Math.min(1, stats.extension / 7.5);

  // Hip-shoulder separation proxy: horizontal break magnitude (more break = more separation)
  const hipShoulderSeparation = Math.min(1, Math.abs(stats.horizontalBreak) / 15);

  // Release height (normalized 0–1, ~5.0–7.0 ft range)
  const releaseHeight = Math.min(1, Math.max(0, (stats.releaseHeight - 4.0) / 3.0));

  // Movement score: combined movement magnitude
  const movementScore = Math.min(1, Math.sqrt(stats.horizontalBreak ** 2 + stats.verticalBreak ** 2) / 20);

  return {
    velocityTrend,
    spinEfficiency,
    kineticChainScore,
    armSlotConsistency,
    strideLength,
    hipShoulderSeparation,
    releaseHeight,
    movementScore,
  };
}
