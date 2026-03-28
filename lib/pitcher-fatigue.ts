/**
 * Pitcher Fatigue Model
 *
 * Computes a fatigue multiplier for a starting pitcher based on recent workload.
 * A multiplier > 1.0 indicates the pitcher is running on depleted reserves —
 * useful for adjusting strikeout prop lines and early-game scoring projections.
 *
 * Betting implications:
 *  - fatigued pitcher → favour opposing batters on strikeout-under props
 *  - fatigued pitcher → lean toward Over on game totals
 */

export interface PitcherFatigueInput {
  /** Total pitches thrown in most recent start */
  pitchCountLastStart: number;
  /** Innings pitched in most recent start */
  inningsLastStart: number;
  /** Full days of rest since last start (e.g. 4 = normal turn) */
  daysRest: number;
  /** Cumulative pitch count over the rolling 7-day window */
  pitchCountLast7Days: number;
}

export interface PitcherFatigueResult {
  /** 1.0 = fully fresh; higher = more fatigued. Typical range: 0.85–1.40 */
  fatigueMultiplier: number;
  fatigueLabel: 'fresh' | 'normal' | 'tired' | 'at-risk';
  /**
   * Pre-formatted signal string ready for card display.
   * e.g. "High workload last start (114 pitches) — lean Under on K prop"
   */
  bettingImpact: string;
}

/** Baseline full-rest fatigue score (0 = zero fatigue penalty) */
const BASE_SCORE = 0.0;

/** Max multiplier cap — avoid extreme outliers */
const MAX_MULTIPLIER = 1.50;
const MIN_MULTIPLIER = 0.80;

export function computePitcherFatigue(input: PitcherFatigueInput): PitcherFatigueResult {
  const { pitchCountLastStart, inningsLastStart, daysRest, pitchCountLast7Days } = input;

  let fatigue = BASE_SCORE;

  // ── Short rest penalty ────────────────────────────────────────────────────
  if (daysRest < 4) {
    fatigue += 0.20; // < normal 4-day rotation
  } else if (daysRest === 4) {
    fatigue += 0.08; // standard turn
  }
  // 5+ days rest: no penalty (may even be slightly fresher → subtract a touch)
  if (daysRest >= 6) {
    fatigue -= 0.05;
  }

  // ── Last-start high pitch count ───────────────────────────────────────────
  if (pitchCountLastStart > 110) {
    fatigue += 0.10 + (pitchCountLastStart - 110) * 0.005; // +0.005 per pitch > 110
  } else if (pitchCountLastStart > 100) {
    fatigue += 0.05;
  }

  // ── Deep into game last start (innings) ───────────────────────────────────
  if (inningsLastStart >= 8) {
    fatigue += 0.08;
  } else if (inningsLastStart >= 7) {
    fatigue += 0.04;
  }

  // ── Rolling 7-day workload ────────────────────────────────────────────────
  if (pitchCountLast7Days > 160) {
    fatigue += 0.12;
  } else if (pitchCountLast7Days > 130) {
    fatigue += 0.06;
  }

  // ── Convert fatigue delta to multiplier centered at 1.0 ──────────────────
  const multiplier = Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, 1.0 + fatigue));

  // ── Label ─────────────────────────────────────────────────────────────────
  let fatigueLabel: PitcherFatigueResult['fatigueLabel'];
  if (multiplier <= 0.90) {
    fatigueLabel = 'fresh';
  } else if (multiplier <= 1.08) {
    fatigueLabel = 'normal';
  } else if (multiplier <= 1.22) {
    fatigueLabel = 'tired';
  } else {
    fatigueLabel = 'at-risk';
  }

  // ── Betting impact string ─────────────────────────────────────────────────
  let bettingImpact: string;
  if (fatigueLabel === 'fresh') {
    bettingImpact = `Fresh arm (${daysRest} days rest, ${pitchCountLastStart} pitches last out) — lean Over on K prop`;
  } else if (fatigueLabel === 'normal') {
    bettingImpact = `Normal workload — no significant fatigue adjustment needed`;
  } else if (fatigueLabel === 'tired') {
    const reason =
      pitchCountLastStart > 100 ? `${pitchCountLastStart} pitches last start`
      : daysRest < 4             ? `only ${daysRest} days rest`
      :                            `${pitchCountLast7Days} pitches over 7 days`;
    bettingImpact = `Elevated fatigue (${reason}) — consider Under on K prop, early hook likely`;
  } else {
    bettingImpact = `High fatigue risk — ${pitchCountLastStart} pitches, ${daysRest}d rest. Lean Under on K prop, Over on game total`;
  }

  return { fatigueMultiplier: multiplier, fatigueLabel, bettingImpact };
}
