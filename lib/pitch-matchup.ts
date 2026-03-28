/**
 * Pitch Type Matchup Model
 *
 * Analyses a batter's historical run value performance against each pitch type
 * weighted by a pitcher's actual pitch mix to produce a composite matchup edge.
 *
 * Positive compositeEdge → batter advantage (lean Over on hits/TB props)
 * Negative compositeEdge → pitcher advantage (lean Under on hits/TB props)
 *
 * Run Value per 100 pitches (RV/100) is the standard Statcast currency:
 *  +2.0 = elite batter vs this pitch    |  -2.0 = pitcher dominates
 */

export type PitchType =
  | 'FF' // 4-seam fastball
  | 'SI' // sinker / 2-seam
  | 'FC' // cutter
  | 'SL' // slider
  | 'CU' // curveball
  | 'KC' // knuckle-curve
  | 'CH' // changeup
  | 'FS' // splitter
  | 'KN' // knuckleball
  | string; // allow arbitrary Statcast pitch codes

export interface PitchMatchupInput {
  /**
   * Batter's run value per 100 pitches against each pitch type.
   * Source: Statcast / Baseball Savant pitch type leaderboards.
   * Positive = batter advantage, negative = pitcher advantage.
   * Example: { FF: +3.2, SL: -1.5, CH: +0.8 }
   */
  batterRunValueVsPitchType: Partial<Record<PitchType, number>>;
  /**
   * Pitcher's pitch mix (fractions, must sum to ~1.0).
   * Example: { FF: 0.55, SL: 0.30, CH: 0.15 }
   */
  pitcherPitchMix: Partial<Record<PitchType, number>>;
  /** Pitcher's average fastball velocity in mph */
  pitcherAvgVelocity: number;
  /** Pitcher's fastball spin rate in RPM */
  pitcherSpinRate: number;
}

export interface PitchMatchupResult {
  /**
   * Weighted composite run value for this matchup.
   * Positive = batter expected to outperform; negative = pitcher expected to dominate.
   */
  compositeEdge: number;
  /** Pitch type the pitcher throws most that the batter exploits or struggles against */
  dominantPitchType: PitchType;
  advantageSide: 'batter' | 'pitcher' | 'neutral';
  /** Pre-formatted signal string ready for card display */
  signal: string;
}

/** Thresholds for declaring advantage vs neutral */
const ADVANTAGE_THRESHOLD = 1.5;  // RV/100

export function computePitchMatchup(input: PitchMatchupInput): PitchMatchupResult {
  const { batterRunValueVsPitchType, pitcherPitchMix, pitcherAvgVelocity, pitcherSpinRate } = input;

  // ── Weighted composite run value ──────────────────────────────────────────
  let compositeEdge = 0;
  let totalWeight = 0;
  let dominantPitch: PitchType = 'FF';
  let dominantPitchMixPct = 0;

  for (const [pitchType, mixFraction] of Object.entries(pitcherPitchMix) as [PitchType, number][]) {
    if (!mixFraction || mixFraction <= 0) continue;
    const rv = batterRunValueVsPitchType[pitchType] ?? 0;
    compositeEdge += rv * mixFraction;
    totalWeight += mixFraction;

    if (mixFraction > dominantPitchMixPct) {
      dominantPitchMixPct = mixFraction;
      dominantPitch = pitchType;
    }
  }

  // Normalise in case pitch mix doesn't sum to exactly 1
  if (totalWeight > 0) {
    compositeEdge = compositeEdge / totalWeight;
  }

  // ── Velocity / spin adjustment ────────────────────────────────────────────
  // High velo (95+ mph) suppresses batter performance slightly
  if (pitcherAvgVelocity >= 97) {
    compositeEdge -= 0.4;
  } else if (pitcherAvgVelocity >= 95) {
    compositeEdge -= 0.2;
  }
  // Elite spin (2400+ RPM) on fastball similarly benefits pitcher
  if (pitcherSpinRate >= 2500) {
    compositeEdge -= 0.3;
  } else if (pitcherSpinRate >= 2400) {
    compositeEdge -= 0.15;
  }

  // ── Advantage classification ──────────────────────────────────────────────
  const advantageSide: PitchMatchupResult['advantageSide'] =
    compositeEdge >= ADVANTAGE_THRESHOLD  ? 'batter'
    : compositeEdge <= -ADVANTAGE_THRESHOLD ? 'pitcher'
    : 'neutral';

  // ── Human-readable pitch type names ──────────────────────────────────────
  const PITCH_NAMES: Partial<Record<PitchType, string>> = {
    FF: '4-Seam FB', SI: 'Sinker', FC: 'Cutter',
    SL: 'Slider',   CU: 'Curve',  KC: 'Knuckle-Curve',
    CH: 'Changeup', FS: 'Splitter', KN: 'Knuckleball',
  };
  const pitchName = PITCH_NAMES[dominantPitch] ?? dominantPitch;
  const mixPct = Math.round((dominantPitchMixPct) * 100);

  // ── Signal string ─────────────────────────────────────────────────────────
  let signal: string;
  const rvStr = compositeEdge >= 0 ? `+${compositeEdge.toFixed(1)}` : compositeEdge.toFixed(1);
  if (advantageSide === 'batter') {
    signal = `Batter matchup edge (RV/100: ${rvStr}) — pitcher leans ${pitchName} (${mixPct}%), batter mashes it`;
  } else if (advantageSide === 'pitcher') {
    signal = `Pitcher dominates (RV/100: ${rvStr}) — ${pitchName} (${mixPct}% usage) is batter's weakness`;
  } else {
    signal = `Neutral matchup (RV/100: ${rvStr}) — no significant pitch type edge detected`;
  }

  // Velocity note appended when relevant
  if (pitcherAvgVelocity >= 95) {
    signal += ` | Velo: ${pitcherAvgVelocity} mph`;
  }

  return {
    compositeEdge: Math.round(compositeEdge * 100) / 100,
    dominantPitchType: dominantPitch,
    advantageSide,
    signal,
  };
}
