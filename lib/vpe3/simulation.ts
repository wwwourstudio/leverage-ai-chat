/**
 * VPE 3.0 — Monte Carlo Simulation Engine
 * ==========================================
 * Player game simulation, season simulation, and team projection
 * with Pythagorean expectation and reproducibility seeds.
 */

import {
  LEAGUE_AVG,
  type HitterStats,
  type PitcherStats,
  type SimulationResult,
  type HitterSimResult,
  type PitcherSimResult,
  type SeasonSimResult,
  type DFSModifiers,
} from './types';
import { DK_SCORING } from './constants';
import { hitterVpeVal, pitcherVpeVal, pythagoreanWinPct, compositeDFSMultiplier } from './core';

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

/** Box-Muller transform for normal distribution. */
function normalRandom(rng: () => number, mean: number, stdDev: number): number {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/** Binomial sample: n trials with probability p. */
function binomialSample(rng: () => number, n: number, p: number): number {
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (rng() < p) count++;
  }
  return count;
}

// ── Percentile Calculation ──────────────────────────────────────────────────

function computeSimResult(values: number[]): SimulationResult {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;

  return {
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
    p10: sorted[Math.floor(n * 0.10)] ?? 0,
    p25: sorted[Math.floor(n * 0.25)] ?? 0,
    p50: sorted[Math.floor(n * 0.50)] ?? 0,
    p75: sorted[Math.floor(n * 0.75)] ?? 0,
    p90: sorted[Math.floor(n * 0.90)] ?? 0,
    distribution: sorted,
  };
}

// ── Hitter Game Simulation ──────────────────────────────────────────────────

/**
 * Simulate a single game for a hitter, N iterations.
 *
 * Assumptions: 4 AB/game, 4.4 PA/game.
 * Uses binomial draws for discrete outcomes.
 */
export function simulateHitterGame(
  hitter: HitterStats,
  iterations: number = 1000,
  seed: number = 42,
  dfsModifiers?: DFSModifiers,
): HitterSimResult {
  const rng = mulberry32(seed);
  const mult = dfsModifiers ? compositeDFSMultiplier(dfsModifiers) : 1.0;
  const AB = 4;
  const PA = 4.4;

  // Base probabilities from hitter stats
  const hrProb = Math.min(0.12, Math.max(0.01,
    (hitter.barrelPct / 100) * 0.4 + (hitter.iso / 2.0) * 0.3 + 0.015,
  )) * mult;
  const hitProb = Math.min(0.38, hitter.xwoba * 0.85) * Math.sqrt(mult);
  const kProb = Math.min(0.40, hitter.kPct / 100);
  const bbProb = Math.min(0.20, hitter.bbPct / 100);
  const sbProb = 0.04; // ~16 SB/season baseline

  const hrs: number[] = [];
  const hits: number[] = [];
  const rbis: number[] = [];
  const runs: number[] = [];
  const sbs: number[] = [];
  const ks: number[] = [];
  const dkPts: number[] = [];

  const dk = DK_SCORING.hitter;

  for (let i = 0; i < iterations; i++) {
    const gameHR = binomialSample(rng, AB, hrProb);
    const gameHits = gameHR + binomialSample(rng, AB - gameHR, hitProb * 0.7);
    const gameK = binomialSample(rng, AB - gameHits, kProb * 0.8);
    const gameBB = binomialSample(rng, Math.round(PA - AB), bbProb * 2);
    const gameRBI = gameHR + binomialSample(rng, gameHits - gameHR, 0.25);
    const gameRuns = gameHR + binomialSample(rng, gameHits - gameHR + gameBB, 0.30);
    const gameSB = binomialSample(rng, 1, sbProb);

    // Hit type distribution for non-HR hits
    const singles = Math.round((gameHits - gameHR) * 0.70);
    const doubles = Math.round((gameHits - gameHR) * 0.22);
    const triples = Math.round((gameHits - gameHR) * 0.03);

    const pts =
      gameHR * dk.hr +
      singles * dk.single +
      doubles * dk.double +
      triples * dk.triple +
      gameRBI * dk.rbi +
      gameRuns * dk.run +
      gameBB * dk.bb +
      gameSB * dk.sb +
      gameK * dk.k;

    hrs.push(gameHR);
    hits.push(gameHits);
    rbis.push(gameRBI);
    runs.push(gameRuns);
    sbs.push(gameSB);
    ks.push(gameK);
    dkPts.push(Math.round(pts * 100) / 100);
  }

  return {
    hrs: computeSimResult(hrs),
    hits: computeSimResult(hits),
    rbis: computeSimResult(rbis),
    runs: computeSimResult(runs),
    sbs: computeSimResult(sbs),
    ks: computeSimResult(ks),
    dkPts: computeSimResult(dkPts),
  };
}

// ── Pitcher Game Simulation ─────────────────────────────────────────────────

/**
 * Simulate a single start for a pitcher, N iterations.
 *
 * Assumptions: SP goes 5.5 IP (16.5 outs) on average.
 */
export function simulatePitcherGame(
  pitcher: PitcherStats,
  iterations: number = 1000,
  seed: number = 42,
  dfsModifiers?: DFSModifiers,
): PitcherSimResult {
  const rng = mulberry32(seed);
  const isSP = pitcher.position === 'SP';
  const avgOuts = isSP ? 16.5 : 4.5; // 5.5 IP for SP, 1.5 IP for RP

  const kPerAB = Math.min(0.40, Math.max(0.10, pitcher.kPct / 100));
  const erRate = pitcher.era / 9.0; // ER per inning

  const ks: number[] = [];
  const whips: number[] = [];
  const wins: number[] = [];
  const dkPts: number[] = [];

  const dk = DK_SCORING.pitcher;

  for (let i = 0; i < iterations; i++) {
    // Randomize innings (±1.5 for SP, ±0.5 for RP)
    const variance = isSP ? 4.5 : 1.5;
    const outs = Math.max(3, Math.round(normalRandom(rng, avgOuts, variance)));
    const ip = outs / 3;
    const batsFaced = Math.round(outs * 1.35);

    const gameK = binomialSample(rng, batsFaced, kPerAB);
    const gameHits = binomialSample(rng, batsFaced - gameK, 0.25);
    const gameBB = binomialSample(rng, batsFaced - gameK - gameHits, 0.08);
    const gameER = Math.max(0, Math.round(normalRandom(rng, erRate * ip, 1.5)));

    const gameWHIP = ip > 0 ? (gameHits + gameBB) / ip : 2.0;
    const winProb = isSP && ip >= 5 && gameER <= 3 ? 0.55 : (isSP ? 0.30 : 0.10);
    const gameWin = rng() < winProb ? 1 : 0;

    const pts =
      outs * dk.out +
      gameK * dk.k +
      gameWin * dk.win +
      gameER * dk.er +
      gameHits * dk.hit +
      gameBB * dk.bb;

    ks.push(gameK);
    whips.push(Math.round(gameWHIP * 100) / 100);
    wins.push(gameWin);
    dkPts.push(Math.round(pts * 100) / 100);
  }

  return {
    ks: computeSimResult(ks),
    whip: computeSimResult(whips),
    wins: computeSimResult(wins),
    dkPts: computeSimResult(dkPts),
  };
}

// ── Season Simulation ───────────────────────────────────────────────────────

interface TeamInput {
  name: string;
  hitters: HitterStats[];
  pitchers: PitcherStats[];
  parkHrFactor: number;
  parkRunsFactor: number;
}

/**
 * Monte Carlo season simulation.
 *
 * Sums player VPE-Val projections → team runs scored/allowed →
 * Pythagorean win% → simulate 162-game season × N iterations.
 */
export function simulateSeason(
  team: TeamInput,
  iterations: number = 1000,
  seed: number = 42,
): SeasonSimResult {
  const rng = mulberry32(seed);

  // Calculate team strength from VPE-Val
  const avgHitterVPE = team.hitters.length > 0
    ? team.hitters.reduce((s, h) => s + hitterVpeVal(h, team.parkHrFactor), 0) / team.hitters.length
    : 1.0;
  const avgPitcherVPE = team.pitchers.length > 0
    ? team.pitchers.reduce((s, p) => s + pitcherVpeVal(p, team.parkRunsFactor), 0) / team.pitchers.length
    : 1.0;

  const baseRS = 4.5 * avgHitterVPE;  // runs scored per game
  const baseRA = 4.5 / Math.max(avgPitcherVPE, 0.5); // runs allowed per game

  const winTotals: number[] = [];
  const rsTotals: number[] = [];
  const raTotals: number[] = [];

  for (let i = 0; i < iterations; i++) {
    let seasonWins = 0;
    let seasonRS = 0;
    let seasonRA = 0;

    for (let g = 0; g < 162; g++) {
      const gameRS = Math.max(0, normalRandom(rng, baseRS, 2.5));
      const gameRA = Math.max(0, normalRandom(rng, baseRA, 2.5));
      seasonRS += gameRS;
      seasonRA += gameRA;
      if (gameRS > gameRA) seasonWins++;
      else if (gameRS === gameRA) {
        // Extra innings coin flip
        seasonWins += rng() < 0.5 ? 1 : 0;
      }
    }

    winTotals.push(seasonWins);
    rsTotals.push(Math.round(seasonRS));
    raTotals.push(Math.round(seasonRA));
  }

  const winResult = computeSimResult(winTotals);
  const rsResult = computeSimResult(rsTotals);
  const raResult = computeSimResult(raTotals);

  // Playoff probability: teams >= 87 wins typically make playoffs
  const playoffProb = winTotals.filter(w => w >= 87).length / iterations;
  // Division win: assume ~92 wins needed
  const divProb = winTotals.filter(w => w >= 92).length / iterations;
  // World Series: ~100+ wins → ~15% WS win rate, scaling down
  const wsProb = winTotals.filter(w => w >= 95).length / iterations * 0.15;

  return {
    teamName: team.name,
    projectedWins: { ...winResult, distribution: [] }, // strip large array for API
    playoffProbability: Math.round(playoffProb * 1000) / 1000,
    divisionWinProbability: Math.round(divProb * 1000) / 1000,
    worldSeriesProbability: Math.round(wsProb * 10000) / 10000,
    runsScored: { ...rsResult, distribution: [] },
    runsAllowed: { ...raResult, distribution: [] },
  };
}

// ── Multi-Team Season ───────────────────────────────────────────────────────

/**
 * Simulate full division/league with multiple teams.
 */
export function simulateMultiTeamSeason(
  teams: TeamInput[],
  iterations: number = 1000,
  seed: number = 42,
): SeasonSimResult[] {
  return teams.map((team, i) =>
    simulateSeason(team, iterations, seed + i * 1000),
  );
}
