/**
 * VPE 3.0 — Pitch-Level Modeling
 * ================================
 * Stuff+ pitch quality, pitch tunneling for K prediction,
 * CSW% dominance analysis, and pitch sequencing (Markov model).
 */

import {
  LEAGUE_AVG,
  type PitcherStats,
  type StuffPlusResult,
  type TunnelResult,
  type CSWResult,
  type PitchSequencePrediction,
  type StuffGrade,
  type TunnelGrade,
  type CSWTier,
} from './types';
import { releaseVariancePenalty } from './core';
import { PITCH_TRANSITIONS, COUNT_ADJUSTMENTS } from './constants';

// ── Seeded RNG ──────────────────────────────────────────────────────────────

/** Simple mulberry32 PRNG for reproducibility. */
function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Stuff+ Calculator ───────────────────────────────────────────────────────

const STUFF_WEIGHTS = {
  velocity: 0.30,
  vertBreak: 0.20,
  horizBreak: 0.15,
  spinRate: 0.15,
  extension: 0.10,
  releasePenalty: 0.10,
} as const;

function stuffGrade(score: number): StuffGrade {
  if (score >= 1.5) return 'Elite';
  if (score >= 0.8) return 'Plus';
  if (score >= -0.3) return 'Average';
  if (score >= -1.0) return 'Below';
  return 'Poor';
}

/**
 * Calculate Stuff+ for a specific pitch type.
 *
 * StuffScore = 0.30*Velocity_z + 0.20*VerticalBreak_z + 0.15*HorizontalBreak_z
 *            + 0.15*SpinRate_z + 0.10*Extension_z + 0.10*ReleaseVariancePenalty
 */
export function calculateStuffPlus(
  pitcher: PitcherStats,
  pitchType: string,
  overrides?: {
    velocity?: number;
    vertBreak?: number;
    horizBreak?: number;
    spin?: number;
  },
): StuffPlusResult {
  const sd = LEAGUE_AVG.SD;

  const vel = overrides?.velocity ?? pitcher.velocity;
  const vb = overrides?.vertBreak ?? pitcher.verticalBreak;
  const hb = overrides?.horizBreak ?? pitcher.horizontalBreak;
  const spin = overrides?.spin ?? pitcher.spinRate;

  const velZ = (vel - LEAGUE_AVG.VELOCITY) / sd.VELOCITY;
  const vbZ = (vb - 14.0) / sd.VERT_BREAK;
  const hbZ = (hb - 8.0) / sd.HORIZ_BREAK;
  const spinZ = (spin - LEAGUE_AVG.SPIN_RATE) / sd.SPIN_RATE;
  const extZ = (pitcher.extension - LEAGUE_AVG.EXTENSION) / sd.EXTENSION;
  const relPenalty = -releaseVariancePenalty(pitcher);

  const stuffScore =
    STUFF_WEIGHTS.velocity * velZ +
    STUFF_WEIGHTS.vertBreak * vbZ +
    STUFF_WEIGHTS.horizBreak * hbZ +
    STUFF_WEIGHTS.spinRate * spinZ +
    STUFF_WEIGHTS.extension * extZ +
    STUFF_WEIGHTS.releasePenalty * relPenalty;

  return {
    pitchType,
    stuffScore: Math.round(stuffScore * 1000) / 1000,
    velocityZ: Math.round(velZ * 1000) / 1000,
    vertBreakZ: Math.round(vbZ * 1000) / 1000,
    horizBreakZ: Math.round(hbZ * 1000) / 1000,
    spinRateZ: Math.round(spinZ * 1000) / 1000,
    extensionZ: Math.round(extZ * 1000) / 1000,
    releasePenalty: Math.round(relPenalty * 1000) / 1000,
    grade: stuffGrade(stuffScore),
  };
}

/** Calculate Stuff+ for entire arsenal. */
export function arsenalStuffPlus(
  pitcher: PitcherStats,
  pitchData?: Record<string, { velocity?: number; vertBreak?: number; horizBreak?: number; spin?: number }>,
): Record<string, StuffPlusResult> {
  const results: Record<string, StuffPlusResult> = {};
  for (const pitchType of Object.keys(pitcher.pitchUsage)) {
    results[pitchType] = calculateStuffPlus(
      pitcher,
      pitchType,
      pitchData?.[pitchType],
    );
  }
  return results;
}

// ── Pitch Tunneling ─────────────────────────────────────────────────────────

function tunnelGrade(score: number): TunnelGrade {
  if (score >= 2.0) return 'Elite Tunneler';
  if (score >= 1.0) return 'Plus Tunneler';
  if (score >= 0.0) return 'Average';
  return 'Poor Tunneler';
}

/**
 * Score a pitch pair for tunneling effectiveness.
 *
 * TunnelScore = -1.8*TunnelDistance + 1.4*ReleasePointSimilarity
 *             + 1.2*VelocityDifferential + 1.0*SpinAxisSimilarity
 */
export function scoreTunnel(
  tunnelDistance: number,
  releaseSimilarity: number,
  velocityDifferential: number,
  spinAxisSimilarity: number,
): TunnelResult {
  // Normalize velocity differential (peak at 8-12 mph diff)
  const velNorm = Math.max(0, 1.0 - Math.abs(velocityDifferential - 10.0) / 15.0);

  const tunnelScore =
    -1.8 * tunnelDistance +
    1.4 * releaseSimilarity +
    1.2 * velNorm +
    1.0 * spinAxisSimilarity;

  const predictedKBoost = Math.max(0, tunnelScore * 1.5);

  return {
    tunnelScore: Math.round(tunnelScore * 1000) / 1000,
    tunnelDistance,
    releaseSimilarity,
    velocityDifferential,
    spinAxisSimilarity,
    predictedKBoost: Math.round(predictedKBoost * 100) / 100,
    grade: tunnelGrade(tunnelScore),
  };
}

/** Estimate tunneling for all pitch pairs in a pitcher's arsenal. */
export function analyzePitcherTunneling(pitcher: PitcherStats): TunnelResult[] {
  const pitches = Object.keys(pitcher.pitchUsage);
  const results: TunnelResult[] = [];

  for (let i = 0; i < pitches.length; i++) {
    for (let j = i + 1; j < pitches.length; j++) {
      const p1 = pitches[i];
      const isSpeedPair = p1 === 'fastball' || pitches[j] === 'fastball';
      const tunnelDist = isSpeedPair ? 0.25 : 0.45;
      const relSim = 0.85 - releaseVariancePenalty(pitcher) * 0.3;
      const velDiff = isSpeedPair ? 10.0 : 5.0;
      const spinSim = isSpeedPair ? 0.6 : 0.75;

      results.push(scoreTunnel(tunnelDist, relSim, velDiff, spinSim));
    }
  }

  return results;
}

// ── CSW% Analysis ───────────────────────────────────────────────────────────

function cswTier(kSkillVal: number): CSWTier {
  if (kSkillVal >= 3.0) return 'Elite';
  if (kSkillVal >= 1.0) return 'Above Average';
  if (kSkillVal >= -1.0) return 'Average';
  return 'Below Average';
}

/**
 * CSW% dominance analysis.
 * KSkill = 0.6*(CSW% - league_avg) + 0.4*(K/9 - league_avg)
 */
export function analyzeCSW(pitcher: PitcherStats): CSWResult {
  const cswAbove = pitcher.cswPct - LEAGUE_AVG.CSW_PCT;
  const k9Above = pitcher.kPer9 - LEAGUE_AVG.K_PER_9;
  const kSkillVal = 0.6 * cswAbove + 0.4 * k9Above;

  // Empirical: K% ≈ CSW% × 0.75 + 3.0
  const projectedKPct = pitcher.cswPct * 0.75 + 3.0;

  return {
    cswPct: pitcher.cswPct,
    kSkill: Math.round(kSkillVal * 100) / 100,
    cswAboveAvg: Math.round(cswAbove * 100) / 100,
    k9AboveAvg: Math.round(k9Above * 100) / 100,
    dominanceTier: cswTier(kSkillVal),
    projectedKPct: Math.round(projectedKPct * 10) / 10,
  };
}

// ── Pitch Sequencing (Markov Model) ─────────────────────────────────────────

function countState(balls: number, strikes: number): string {
  if (strikes === 2) return 'two_strikes';
  if (balls > strikes) return 'behind';
  if (strikes > balls) return 'ahead';
  return 'even';
}

/**
 * Predict next pitch probability distribution using Markov transition
 * matrix with count adjustments and arsenal weighting.
 *
 * In production, replace with RNN/transformer for learned sequences.
 */
export function predictNextPitch(
  currentPitch: string,
  balls: number,
  strikes: number,
  pitcher?: PitcherStats,
  seed?: number,
): PitchSequencePrediction[] {
  const rng = seed != null ? seededRng(seed) : Math.random;

  // Base transition probabilities
  const base: Record<string, number> = {
    ...(PITCH_TRANSITIONS[currentPitch] ?? PITCH_TRANSITIONS.fastball),
  };

  // Apply count adjustments
  const state = countState(balls, strikes);
  const adj = COUNT_ADJUSTMENTS[state] ?? {};
  for (const [pitch, delta] of Object.entries(adj)) {
    if (pitch in base) {
      base[pitch] = Math.max(0.05, base[pitch] + delta);
    }
  }

  // Apply pitcher arsenal weighting
  if (pitcher) {
    for (const pitch of Object.keys(base)) {
      const usage = pitcher.pitchUsage[pitch] ?? 0.1;
      base[pitch] *= 0.5 + usage;
    }
  }

  // Normalize
  const total = Object.values(base).reduce((s, v) => s + v, 0);
  const predictions: PitchSequencePrediction[] = [];

  for (const [pitchType, raw] of Object.entries(base)) {
    const prob = raw / total;

    // Location estimate
    let x: number, z: number;
    if (state === 'two_strikes') {
      x = rng() * 1.3 - 0.5;
      z = 1.3 + rng() * 0.9;
    } else if (state === 'behind') {
      x = rng() * 0.6 - 0.3;
      z = 2.0 + rng() * 1.0;
    } else {
      x = rng() * 1.2 - 0.6;
      z = 1.8 + rng() * 1.4;
    }

    predictions.push({
      pitchType,
      probability: Math.round(prob * 1000) / 1000,
      expectedLocation: [
        Math.round(x * 100) / 100,
        Math.round(z * 100) / 100,
      ],
      confidence: Math.round((0.6 + prob * 0.3) * 100) / 100,
    });
  }

  return predictions.sort((a, b) => b.probability - a.probability);
}
