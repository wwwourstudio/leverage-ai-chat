/**
 * VPE 3.0 — Core Computation Functions
 * =======================================
 * Pure functions for z-score computation, VPE-Val calculation,
 * age curves, platoon splits, and park-adjusted rate projections.
 *
 * All z-score variables are standardized against LEAGUE_AVG constants.
 */

import {
  LEAGUE_AVG,
  type HitterStats,
  type PitcherStats,
  type WeatherConditions,
  type DFSModifiers,
} from './types';

// ── Utility ─────────────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round(val: number, decimals: number = 3): number {
  const f = 10 ** decimals;
  return Math.round(val * f) / f;
}

// ── Age Factor ──────────────────────────────────────────────────────────────

/** Aging curve: peaks at 27, declines ~2% per year after 30. */
export function ageFactor(age: number): number {
  if (age <= 27) return 1.0 + (27 - age) * 0.005;
  return Math.max(0.70, 1.0 - (age - 27) * 0.02);
}

// ── Z-Score Computations ────────────────────────────────────────────────────

export function computeHitterZScores(h: HitterStats): HitterStats {
  const sd = LEAGUE_AVG.SD;
  return {
    ...h,
    batSpeedZ: round((h.batSpeed - LEAGUE_AVG.BAT_SPEED) / sd.BAT_SPEED),
    ev50Z: round((h.ev50 - LEAGUE_AVG.EV50) / sd.EV50),
    attackAngleZ: round((h.attackAngle - LEAGUE_AVG.ATTACK_ANGLE) / sd.ATTACK_ANGLE),
    evZ: round((h.ev - LEAGUE_AVG.EV) / sd.EV),
  };
}

export function computePitcherZScores(p: PitcherStats): PitcherStats {
  const sd = LEAGUE_AVG.SD;
  return {
    ...p,
    velocityZ: round((p.velocity - LEAGUE_AVG.VELOCITY) / sd.VELOCITY),
    spinRateZ: round((p.spinRate - LEAGUE_AVG.SPIN_RATE) / sd.SPIN_RATE),
    extensionZ: round((p.extension - LEAGUE_AVG.EXTENSION) / sd.EXTENSION),
    vertBreakZ: round((p.verticalBreak - 14.0) / sd.VERT_BREAK),
    horizBreakZ: round((p.horizontalBreak - 8.0) / sd.HORIZ_BREAK),
  };
}

// ── Platoon Advantage ───────────────────────────────────────────────────────

/** Platoon split modifier: opposite-hand = +0.05, same-hand = -0.02, switch = +0.03. */
export function platoonAdvantage(
  batterHand: string,
  pitcherHand: string,
): number {
  if (batterHand === 'S') return 0.03;
  if (batterHand !== pitcherHand) return 0.05;
  return -0.02;
}

// ── Park-Adjusted Rate ──────────────────────────────────────────────────────

/**
 * Schedule-weighted park adjustment.
 * ParkAdjRate = RegressedRate × (Σ PF_home + Σ PF_away) / 200
 * Simplified: uses average of home and away park factor.
 */
export function parkAdjRate(
  statRate: number,
  homePF: number,
  awayPF: number,
): number {
  return round(statRate * (homePF + awayPF) / 2.0);
}

// ── Weather Multiplier ──────────────────────────────────────────────────────

export function weatherMultiplier(w: WeatherConditions): number {
  if (!w.isOutdoor) return 0.0;
  const tempAdj = clamp((w.tempF - 72.0) * 0.003, -0.10, 0.10);
  const windOut = Math.cos(((w.windDirectionDeg - 270) * Math.PI) / 180);
  const windAdj = clamp(windOut * w.windSpeedMph * 0.004, -0.05, 0.05);
  return round(tempAdj + windAdj, 4);
}

export function dayNightMultiplier(isDayGame: boolean): number {
  return isDayGame ? 1.02 : 1.0;
}

// ── DFS Modifier Composite ─────────────────────────────────────────────────

export function computeDFSModifiers(
  weather: WeatherConditions,
  parkHrFactor: number,
  batterHand: string,
  pitcherHand: string,
  fatigueFactor: number = 1.0,
  opponentStrength: number = 1.0,
): DFSModifiers {
  return {
    weather: 1.0 + weatherMultiplier(weather),
    fatigue: fatigueFactor,
    dayNight: dayNightMultiplier(weather.isDayGame),
    opponentStrength,
    platoon: 1.0 + platoonAdvantage(batterHand, pitcherHand),
    park: parkHrFactor,
  };
}

export function compositeDFSMultiplier(m: DFSModifiers): number {
  return m.weather * m.fatigue * m.dayNight * m.opponentStrength * m.platoon * m.park;
}

// ── Hitter VPE-Val ──────────────────────────────────────────────────────────

/**
 * PowerCore = 0.40*EV50_z + 0.25*BarrelPct_z + 0.20*HardHit_z + 0.15*ISO_z
 */
export function powerCore(h: HitterStats): number {
  const ev50Z = (h.ev50 - LEAGUE_AVG.EV50) / LEAGUE_AVG.SD.EV50;
  const barrelZ = (h.barrelPct - LEAGUE_AVG.BARREL_PCT) / 3.0;
  const hardHitZ = (h.hardHitPct - LEAGUE_AVG.HARD_HIT_PCT) / 6.0;
  const isoZ = (h.iso - LEAGUE_AVG.ISO) / 0.05;
  return round(0.40 * ev50Z + 0.25 * barrelZ + 0.20 * hardHitZ + 0.15 * isoZ);
}

/**
 * Enhanced wRC+ with air-boost and park adjustment.
 * AirBoost = 1.0 + 0.15 * (PullAir% - league_avg) / league_avg
 * Enhanced_wRC+ = wRC+ × AirBoost × ParkFactor
 */
export function enhancedWrcPlus(h: HitterStats, parkHrFactor: number = 1.0): number {
  const airBoost = 1.0 + 0.15 * (h.pullAirPct - LEAGUE_AVG.PULL_AIR_PCT) / Math.max(LEAGUE_AVG.PULL_AIR_PCT, 1);
  return round(h.wrcPlus * airBoost * parkHrFactor, 1);
}

/**
 * VPE-Val for hitters.
 * VPE-Val_hit = (Enhanced_wRC+ / 100) * (1 + PowerCore × 0.5) * AgeFactor
 * League average ≈ 1.0, elite ≈ 3.0+
 */
export function hitterVpeVal(h: HitterStats, parkHrFactor: number = 1.0): number {
  const ewrc = enhancedWrcPlus(h, parkHrFactor);
  const pc = powerCore(h);
  return round((ewrc / 100.0) * (1.0 + pc * 0.5) * ageFactor(h.age));
}

// ── Pitcher VPE-Val ─────────────────────────────────────────────────────────

/**
 * Arsenal quality composite.
 * ArsenalBoost = Σ (Usage%_i × PitchSkill_i)
 */
export function arsenalBoost(p: PitcherStats): number {
  let boost = 0;
  for (const [pitch, usage] of Object.entries(p.pitchUsage)) {
    const skill = p.pitchSkills[pitch] ?? 0.5;
    boost += usage * skill;
  }
  return round(boost);
}

/** Penalty for inconsistent release point (0-1 scale). */
export function releaseVariancePenalty(p: PitcherStats): number {
  return Math.min(1.0, p.releasePointDrift / 4.0);
}

/**
 * CSW% dominance metric.
 * KSkill = 0.6*(CSW% - league_avg) + 0.4*(K/9 - league_avg)
 */
export function kSkill(p: PitcherStats): number {
  return round(
    0.6 * (p.cswPct - LEAGUE_AVG.CSW_PCT) + 0.4 * (p.kPer9 - LEAGUE_AVG.K_PER_9),
    2,
  );
}

/** Saves leverage multiplier for closers/high-leverage RP. */
export function savesLeverageBonus(p: PitcherStats): number {
  if (p.position !== 'RP' && p.position !== 'CL') return 0;
  const svRate = p.saves / Math.max(p.saveOpportunities, 1);
  return round(svRate * p.leverageIndex * 0.5);
}

/**
 * VPE-adjusted ERA.
 * VPE_ERA = ERA * (1 - ArsenalBoost × 0.3) * ParkFactor * (1 + ReleasePenalty × 0.1)
 */
export function vpeEra(p: PitcherStats, parkRunsFactor: number = 1.0): number {
  const arsenal = arsenalBoost(p);
  const penalty = releaseVariancePenalty(p);
  const era = p.era * (1 - arsenal * 0.3) * parkRunsFactor * (1 + penalty * 0.1);
  return round(Math.max(1.50, era), 2);
}

/**
 * VPE+ metric: pitcher quality on 100-scale (higher = better).
 * VPE+ = 100 + KSkill × 8 + ArsenalBoost × 20 - ReleasePenalty × 15
 */
export function vpePlus(p: PitcherStats): number {
  return round(
    100 + kSkill(p) * 8 + arsenalBoost(p) * 20 - releaseVariancePenalty(p) * 15,
    1,
  );
}

/**
 * VPE-Val for pitchers.
 * VPE-Val_pitch = (VPE+ / 100) * IP_factor * AgeFactor + SavesLeverage
 */
export function pitcherVpeVal(p: PitcherStats, parkRunsFactor: number = 1.0): number {
  const vpp = vpePlus(p);
  const ipFactor = p.ip > 0 ? Math.min(p.ip / 180.0, 1.2) : 0.5;
  const saves = savesLeverageBonus(p);
  return round((vpp / 100.0) * ipFactor * ageFactor(p.age) + saves);
}

// ── Team Pythagorean ────────────────────────────────────────────────────────

/**
 * Pythagorean expectation: Win% = RS^exp / (RS^exp + RA^exp)
 */
export function pythagoreanWinPct(
  runsScored: number,
  runsAllowed: number,
  exponent: number = 1.83,
): number {
  if (runsScored + runsAllowed === 0) return 0.500;
  return round(
    runsScored ** exponent / (runsScored ** exponent + runsAllowed ** exponent),
    4,
  );
}
