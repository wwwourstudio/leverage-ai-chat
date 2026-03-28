/**
 * Bullpen Fatigue Model
 *
 * Estimates how taxed a team's bullpen is based on recent usage patterns.
 * Heavy bullpen usage over the prior 3 days degrades late-game run suppression,
 * which shifts expected value toward the Over in high-leverage situations.
 *
 * Betting implications:
 *  - high fatigue → lean Over on game total
 *  - high fatigue → fade team's 5th-inning line or F5 total
 *  - low fatigue  → may actually signal rest advantage for a team coming off an off-day
 */

export interface BullpenFatigueInput {
  /** Total relief innings pitched over the last 3 days */
  inningsLast3Days: number;
  /** Total pitches thrown by relievers over the last 3 days */
  pitchCountLast3Days: number;
  /**
   * Bullpen ERA over the rolling 14-day window.
   * A high ERA signals an already-struggling pen under additional load.
   */
  eraLast14Days: number;
}

export interface BullpenFatigueResult {
  /** 0 = fully rested; 100 = maximally fatigued */
  fatigueScore: number;
  riskLevel: 'low' | 'moderate' | 'high';
  /**
   * Expected runs adjustment to apply to a game total projection.
   * Positive = more runs expected late in the game.
   * Typical range: -0.3 to +1.2
   */
  scoringEnvImpact: number;
  signal: string;
}

/** League-average bullpen ERA for normalisation (~4.10 as of 2024) */
const LEAGUE_AVG_BULLPEN_ERA = 4.10;

export function computeBullpenFatigue(input: BullpenFatigueInput): BullpenFatigueResult {
  const { inningsLast3Days, pitchCountLast3Days, eraLast14Days } = input;

  let score = 0;

  // ── Innings workload component (0–40 pts) ─────────────────────────────────
  // Normal bullpen: ~2–3 innings/day → 6–9 inn over 3 days
  if (inningsLast3Days >= 15) {
    score += 40;
  } else if (inningsLast3Days >= 12) {
    score += 28;
  } else if (inningsLast3Days >= 9) {
    score += 16;
  } else if (inningsLast3Days >= 6) {
    score += 6;
  }

  // ── Pitch count component (0–30 pts) ─────────────────────────────────────
  // ~15–20 pitches/inning → heavy 3-day use > 250 pitches
  if (pitchCountLast3Days >= 300) {
    score += 30;
  } else if (pitchCountLast3Days >= 240) {
    score += 20;
  } else if (pitchCountLast3Days >= 180) {
    score += 10;
  } else if (pitchCountLast3Days >= 120) {
    score += 4;
  }

  // ── ERA component (0–30 pts) ───────────────────────────────────────────────
  // Already bad ERA + heavy usage = compounded risk
  const eraDelta = eraLast14Days - LEAGUE_AVG_BULLPEN_ERA;
  if (eraDelta >= 2.5) {
    score += 30;
  } else if (eraDelta >= 1.5) {
    score += 18;
  } else if (eraDelta >= 0.5) {
    score += 8;
  } else if (eraDelta <= -1.0) {
    score -= 5; // elite bullpen — slight bonus
  }

  const fatigueScore = Math.min(100, Math.max(0, score));

  // ── Risk level ────────────────────────────────────────────────────────────
  const riskLevel: BullpenFatigueResult['riskLevel'] =
    fatigueScore >= 60 ? 'high'
    : fatigueScore >= 30 ? 'moderate'
    : 'low';

  // ── Scoring environment impact (expected extra runs) ─────────────────────
  const scoringEnvImpact = riskLevel === 'high'   ? 0.7 + (eraDelta > 0 ? 0.3 : 0)
    : riskLevel === 'moderate' ? 0.3
    : eraDelta <= -1.0         ? -0.2
    : 0.0;

  // ── Signal string ─────────────────────────────────────────────────────────
  let signal: string;
  if (riskLevel === 'high') {
    signal = `Bullpen taxed (${inningsLast3Days} IP / ${pitchCountLast3Days} pitches last 3 days, ERA ${eraLast14Days.toFixed(2)} L14) — lean Over on game total`;
  } else if (riskLevel === 'moderate') {
    signal = `Moderate bullpen usage (${inningsLast3Days} IP last 3 days) — slight Over lean in close games`;
  } else {
    signal = `Rested bullpen — no late-game scoring environment adjustment needed`;
  }

  return { fatigueScore, riskLevel, scoringEnvImpact, signal };
}
