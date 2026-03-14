/**
 * Monte Carlo Simulation Engine
 * Simulates player performance over N game iterations to compute percentile distributions.
 * Supports both hitters (HR, RBI, hits, SB) and pitchers (K, WHIP, W).
 */

import type { HitterProjectedStats, PitcherProjectedStats } from './models';

export interface SimulationResult {
  mean: number;
  stdDev: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  distribution: number[]; // Raw results array (sorted ascending)
}

export interface HitterSimResult {
  hrs:    SimulationResult;
  hits:   SimulationResult;
  rbis:   SimulationResult;
  runs:   SimulationResult;
  sbs:    SimulationResult;
  ks:     SimulationResult;  // Hitter Ks (projected to strikeout)
  dkPts:  SimulationResult;  // DraftKings fantasy points
}

export interface PitcherSimResult {
  ks:     SimulationResult;  // Strikeouts
  whip:   SimulationResult;  // WHIP per simulated outing
  wins:   SimulationResult;  // Binary W/L (0 or 1)
  dkPts:  SimulationResult;  // DraftKings fantasy points
}

// DraftKings MLB scoring
const DK_HITTER_SCORING = {
  single:   3,
  double:   5,
  triple:   8,
  hr:       10,
  rbi:      2,
  run:      2,
  bb:       2,
  sb:       5,
  strikeout:-0.5, // Hitter K penalty
};

const DK_PITCHER_SCORING = {
  out:      0.75, // Per out recorded (2.25/IP)
  k:        2,
  win:      4,
  er:      -2,
  noHitter: 5,
};

const AT_BATS_PER_GAME = 4;     // Average HBs per game
const PAS_PER_GAME     = 4.4;   // Plate appearances (includes BB)
const INNINGS_STARTED  = 5.5;   // Average SP innings (with 6-IP quality starts)

/**
 * Simulate a hitter's performance across N game iterations.
 * Each iteration = 1 game of 4 AB / 4.4 PA.
 */
export function simulateHitter(probs: HitterProjectedStats, N = 1000): HitterSimResult {
  const hrs:  number[] = [];
  const hits: number[] = [];
  const rbis: number[] = [];
  const runs: number[] = [];
  const sbs:  number[] = [];
  const ks:   number[] = [];
  const dkPts:number[] = [];

  for (let i = 0; i < N; i++) {
    let gameHR = 0, gameHits = 0, gameRBI = 0, gameRun = 0, gameSB = 0, gameK = 0;

    for (let ab = 0; ab < AT_BATS_PER_GAME; ab++) {
      const r = Math.random();
      if (r < probs.hrPerAB) {
        gameHR++;
        gameHits++;
        gameRBI++; // HR always = at least 1 RBI
        gameRun++;
      } else if (r < probs.hrPerAB + probs.kProb) {
        gameK++;
      } else if (r < probs.hrPerAB + probs.kProb + probs.hitProb) {
        gameHits++;
        // Single/double/triple distribution: ~72% S, 20% D, 3% T, 5% HR (already counted)
        const hitRoll = Math.random();
        if (hitRoll < 0.05) {
          // Extra base (non-HR) — counts as double in DK
          gameRBI += Math.random() < 0.25 ? 1 : 0;
        } else {
          gameRBI += Math.random() < 0.12 ? 1 : 0;
        }
        gameRun += Math.random() < probs.runProb ? 1 : 0;
      }
    }

    // Walk opportunity (per PA beyond AB)
    const walks = Math.floor(Math.random() < (PAS_PER_GAME - AT_BATS_PER_GAME) * probs.bbProb ? 1 : 0);

    // SB attempt (based on speed proxy)
    const sb = Math.random() < probs.sbProb ? 1 : 0;
    gameSB = sb;

    const dk =
      gameHR * DK_HITTER_SCORING.hr +
      (gameHits - gameHR) * DK_HITTER_SCORING.single + // Simplification: non-HR hits = singles for DK floor
      gameRBI * DK_HITTER_SCORING.rbi +
      gameRun * DK_HITTER_SCORING.run +
      walks * DK_HITTER_SCORING.bb +
      gameSB * DK_HITTER_SCORING.sb +
      gameK * DK_HITTER_SCORING.strikeout;

    hrs.push(gameHR);
    hits.push(gameHits);
    rbis.push(gameRBI);
    runs.push(gameRun);
    sbs.push(gameSB);
    ks.push(gameK);
    dkPts.push(Math.max(0, dk));
  }

  return {
    hrs:   summarize(hrs),
    hits:  summarize(hits),
    rbis:  summarize(rbis),
    runs:  summarize(runs),
    sbs:   summarize(sbs),
    ks:    summarize(ks),
    dkPts: summarize(dkPts),
  };
}

/**
 * Simulate a pitcher's performance across N start iterations.
 */
export function simulatePitcher(probs: PitcherProjectedStats, N = 1000): PitcherSimResult {
  const ks:    number[] = [];
  const whips: number[] = [];
  const wins:  number[] = [];
  const dkPts: number[] = [];

  for (let i = 0; i < N; i++) {
    const inningsPitched = Math.max(1, INNINGS_STARTED + (Math.random() - 0.5) * 3);
    const batsFaced = Math.round(inningsPitched * 3.3);
    let gameK = 0, gameH = 0, gameER = 0;
    const gameW = 0; // walks tracked at game level (always 0 — per-AB walk tracking not yet implemented)

    for (let ab = 0; ab < batsFaced; ab++) {
      if (Math.random() < probs.kPerAB)       gameK++;
      else if (Math.random() < 0.26)          gameH++;  // ~26% of non-K result in hit
      if (Math.random() < probs.eraPitched / 9 / 3) gameER++;
    }

    const gameWHIP = inningsPitched > 0 ? (gameH + gameW) / inningsPitched : 2.0;
    const won = Math.random() < probs.winProbAbove500 ? 1 : 0;

    const dk =
      (inningsPitched * 3) * DK_PITCHER_SCORING.out + // Outs recorded
      gameK   * DK_PITCHER_SCORING.k +
      won     * DK_PITCHER_SCORING.win +
      gameER  * DK_PITCHER_SCORING.er;

    ks.push(gameK);
    whips.push(gameWHIP);
    wins.push(won);
    dkPts.push(Math.max(0, dk));
  }

  return {
    ks:   summarize(ks),
    whip: summarize(whips),
    wins: summarize(wins),
    dkPts:summarize(dkPts),
  };
}

// ─── Statistical helpers ──────────────────────────────────────────────────────

function summarize(values: number[]): SimulationResult {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    mean:         +mean.toFixed(3),
    stdDev:       +stdDev.toFixed(3),
    p10:          sorted[Math.floor(n * 0.10)] ?? 0,
    p25:          sorted[Math.floor(n * 0.25)] ?? 0,
    p50:          sorted[Math.floor(n * 0.50)] ?? 0,
    p75:          sorted[Math.floor(n * 0.75)] ?? 0,
    p90:          sorted[Math.floor(n * 0.90)] ?? 0,
    distribution: sorted,
  };
}

/** Format percentile output for display in cards */
export function formatPercentiles(sim: SimulationResult, decimals = 2): {
  p10: string; p50: string; p90: string; mean: string;
} {
  return {
    p10:  sim.p10.toFixed(decimals),
    p50:  sim.p50.toFixed(decimals),
    p90:  sim.p90.toFixed(decimals),
    mean: sim.mean.toFixed(decimals),
  };
}
