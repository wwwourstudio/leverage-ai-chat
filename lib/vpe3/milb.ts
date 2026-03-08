/**
 * VPE 3.0 — Minor League Call-Up Projections
 * =============================================
 * MiLB → MLB translation factors, debut VPE-Val projection,
 * variance/confidence intervals via Monte Carlo, and waiver wire
 * call-up ranking.
 */

import {
  LEAGUE_AVG,
  type MinorLeaguePlayerStats,
  type MiLBProjection,
  type MiLBLevel,
  type ParkFactors,
  type WeatherConditions,
} from './types';
import { MILB_TRANSLATION } from './constants';
import { ageFactor, weatherMultiplier } from './core';

// ── Seeded RNG ──────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalRandom(rng: () => number, mean: number, stdDev: number): number {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

// ── MiLB VPE-Val Calculation ────────────────────────────────────────────────

/**
 * Calculate MiLB-level VPE-Val from minor league Statcast-equivalent metrics.
 *
 * Uses same power core formula as MLB but with MiLB baselines.
 */
export function milbVpeVal(player: MinorLeaguePlayerStats): number {
  const ev50Z = (player.ev50 - 101.0) / 3.5;  // MiLB baseline lower
  const barrelZ = (player.barrelPct - 6.5) / 3.0;
  const hardHitZ = (player.hardHitPct - 34.0) / 6.0;
  const pullZ = (player.pullPct - 38.0) / 5.0;

  const powerCore = 0.40 * ev50Z + 0.25 * barrelZ + 0.20 * hardHitZ + 0.15 * pullZ;
  const disciplineBonus = (player.bbPct - 8.0) / 10.0 - (player.kPct - 22.0) / 15.0;

  const raw = (1.0 + powerCore * 0.5) * ageFactor(player.age) + disciplineBonus * 0.3;
  return Math.round(raw * 1000) / 1000;
}

// ── MLB Debut Projection ────────────────────────────────────────────────────

/**
 * Project MLB debut VPE-Val with context modifiers.
 *
 * VPE-Val_MLB_Debut = VPE-Val_MiLB × MiLB-to-MLB adjustment × Park_M × DayNight_M × Opp_M
 *
 * Translation factors by level: AAA=0.9, AA=0.75, High-A=0.6, Low-A=0.5
 */
export function projectMLBDebut(
  player: MinorLeaguePlayerStats,
  parkFactors: ParkFactors = { hr: 1.0, runs: 1.0, k: 1.0, name: 'Neutral' },
  weather?: WeatherConditions,
  opponentModifier: number = 1.0,
): MiLBProjection {
  const milbVal = player.milbVpeVal > 0 ? player.milbVpeVal : milbVpeVal(player);
  const translationFactor = MILB_TRANSLATION[player.level] ?? 0.60;

  const parkMod = parkFactors.hr;
  const dayNightMod = weather?.isDayGame ? 1.02 : 1.0;
  const weatherMod = weather ? 1.0 + weatherMultiplier(weather) * 0.5 : 1.0;

  const mlbDebutVal =
    milbVal *
    translationFactor *
    parkMod *
    dayNightMod *
    weatherMod *
    opponentModifier;

  // Call-up score: ProjectedVPE-Val × OpportunityMultiplier × PositionalScarcity
  const opportunityMult = player.expectedPlayingTime * (1 + player.teamNeed) / 2;
  const callUpScore = mlbDebutVal * opportunityMult * player.positionalScarcity;

  return {
    mlbDebutVpeVal: Math.round(mlbDebutVal * 1000) / 1000,
    confidenceInterval: [0, 0],  // filled by Monte Carlo
    translationFactor,
    parkModifier: parkMod,
    dayNightModifier: dayNightMod,
    oppModifier: opponentModifier,
    callUpScore: Math.round(callUpScore * 1000) / 1000,
  };
}

// ── Monte Carlo Confidence Intervals ────────────────────────────────────────

/**
 * Generate variance/confidence intervals for MLB debut projection
 * using Monte Carlo simulation.
 */
export function milbMonteCarloProjection(
  player: MinorLeaguePlayerStats,
  parkFactors: ParkFactors = { hr: 1.0, runs: 1.0, k: 1.0, name: 'Neutral' },
  iterations: number = 1000,
  seed: number = 42,
): MiLBProjection {
  const rng = mulberry32(seed);
  const baseProjection = projectMLBDebut(player, parkFactors);

  // Variance based on level (lower levels = more uncertainty)
  const levelVariance: Record<MiLBLevel, number> = {
    'AAA': 0.15,
    'AA': 0.25,
    'High-A': 0.35,
    'Low-A': 0.45,
  };
  const variance = levelVariance[player.level] ?? 0.30;

  const projections: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Vary the translation factor, EV50, and contact metrics
    const translationJitter = normalRandom(rng, 1.0, variance * 0.3);
    const skillJitter = normalRandom(rng, 1.0, variance * 0.5);

    const simVal = baseProjection.mlbDebutVpeVal * translationJitter * skillJitter;
    projections.push(Math.max(0, simVal));
  }

  projections.sort((a, b) => a - b);
  const n = projections.length;
  const p10 = projections[Math.floor(n * 0.10)] ?? 0;
  const p90 = projections[Math.floor(n * 0.90)] ?? 0;

  return {
    ...baseProjection,
    confidenceInterval: [
      Math.round(p10 * 1000) / 1000,
      Math.round(p90 * 1000) / 1000,
    ],
  };
}

// ── Call-Up Ranker ──────────────────────────────────────────────────────────

/**
 * Rank waiver wire call-ups.
 *
 * CallUpScore = ProjectedVPE-Val × OpportunityMultiplier × PositionalScarcity
 *
 * OpportunityMultiplier = expected playing time × (1 + team need) / 2
 * PositionalScarcity = thin positional premium (e.g., SS/C scarce)
 */
export function rankCallUps(
  players: MinorLeaguePlayerStats[],
  parkFactors: ParkFactors = { hr: 1.0, runs: 1.0, k: 1.0, name: 'Neutral' },
  seed: number = 42,
): Array<MinorLeaguePlayerStats & { projection: MiLBProjection }> {
  return players
    .map((player) => {
      const projection = milbMonteCarloProjection(player, parkFactors, 500, seed);
      return { ...player, projection };
    })
    .sort((a, b) => b.projection.callUpScore - a.projection.callUpScore);
}
