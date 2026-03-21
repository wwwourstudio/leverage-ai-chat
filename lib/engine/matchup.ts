/**
 * Lineup Matchup Analysis Engine — Layer 0
 *
 * Produces a `matchup_factor` scalar that multiplies into every downstream
 * computation (projection, ML model feature vector, edge score).  This is the
 * FIRST layer that runs — before park/weather context and before the logistic
 * model — because matchup quality gates how much environmental upside actually
 * matters in practice.
 *
 * ─── Why Layer 0? ────────────────────────────────────────────────────────────
 * A cleanup LHB at Coors on a 92°F wind-blowing-out day means nothing if he's
 * facing a dominant LHP who owns that platoon.  The matchup layer absorbs that
 * suppression first, so park/weather can only amplify a pre-validated edge.
 *
 * ─── Output range ────────────────────────────────────────────────────────────
 * matchup_factor is clamped to [0.80, 1.60].
 *   0.80 — severe unfavourable matchup (e.g. weak LHB vs elite LHP + pen)
 *   1.00 — neutral baseline
 *   1.60 — ideal matchup (cleanup slot, opposite-hand, flyball pitcher, weak pen)
 *
 * ─── Typical compound scenario ───────────────────────────────────────────────
 * Slot 4 (×1.22) + LHB vs RHP (+0.12) + flyball pitcher 48% (+0.06) +
 * HR/9 1.6 vs L (+0.10) + protection 0.85 (+0.04) + top-8 team (+0.05)
 * → raw factor ≈ 1.59 → clamped to 1.60
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Full lineup and pitcher context for one batter-pitcher matchup.
 * All fields are available from the MLB Stats API schedule + Statcast endpoints.
 */
export interface LineupContext {
  /** Batting order position 1–9 */
  lineup_slot: number;

  /** Batter handedness */
  batter_hand: 'L' | 'R' | 'S';

  /** Pitcher handedness */
  pitcher_hand: 'L' | 'R';

  /**
   * Pitcher fly-ball percentage (air balls / total BIP × 100).
   * Typical range: 30–55.  League avg ≈ 40.  Higher = more HR risk.
   */
  pitcher_flyball_pct: number;

  /**
   * Pitcher HR/9 split specifically against the batter's handedness.
   * More predictive than overall HR/9.  Typical range: 0.5–2.5.
   * League avg ≈ 1.1 HR/9.
   */
  pitcher_hr9_vs_hand: number;

  /**
   * Protection score: average wOBA/OPS of the hitters immediately before
   * and after this batter (or full lineup power avg).
   * Range 0–1.  High protection means the pitcher cannot pitch around
   * this batter, increasing hittable-pitch frequency.
   * Research shows small but real effect — weight conservatively.
   */
  protection_score: number;

  /**
   * True when batter and pitcher are opposite-handed (classic platoon split).
   * Pre-computed; must be consistent with batter_hand / pitcher_hand.
   */
  platoon_advantage: boolean;

  /**
   * MLB rank of the batter's team by HR output (1 = most HRs, 30 = fewest).
   * Top-10 power teams create lineup depth that forces pitchers into the zone.
   */
  team_power_rank: number;

  /**
   * Opposing bullpen HR/9 allowed.
   * Lower = tougher pen (fewer late-game HR opportunities).
   * Typical range: 0.8–1.8.  League avg ≈ 1.2.
   * Note: renamed from `opposing_bullpen_depth` to an actual sabermetric metric.
   */
  opposing_bullpen_hr9: number;
}

// ─── Lineup slot multipliers ─────────────────────────────────────────────────

/**
 * Per-slot HR opportunity multipliers derived from MLB PA-weighted HR rates
 * by lineup position (2019–2024 sample).
 *
 * Slots 3–5 peak because they face starters longest, receive the most RISP
 * plate appearances, and are protected by the heaviest part of the order.
 * Slots 1 and 9 receive a suppression factor (fewer RBI opportunities,
 * more unprotected counts with 2 outs).
 */
export const LINEUP_SLOT_HR_MULTIPLIERS: Record<number, number> = {
  1: 0.92,  // Leadoff: high PA volume but fewest RBI ops; often pitchers nibble
  2: 1.05,  // Second: analytics-era power slot; RISP situations rising
  3: 1.18,  // Third: best combo of contact quality + PA count + protection
  4: 1.22,  // Cleanup: most RISP, most pitches in zone; highest HR rate
  5: 1.15,  // Fifth: protected by cleanup slot; starters still pitching here
  6: 1.05,  // Sixth: mild premium; quality starters often still engaged
  7: 0.98,  // Seventh: slight suppression begins
  8: 0.90,  // Eighth: notably fewer high-leverage PA; NL #8 different dynamic
  9: 0.85,  // Ninth: lowest HR rate position; pitchers pitch to put-away counts
};

// ─── Main calculation ─────────────────────────────────────────────────────────

/**
 * Calculate the composite matchup factor for a single batter-pitcher context.
 *
 * Component contributions:
 *   Lineup slot multiplier  — multiplicative base [0.85, 1.22]
 *   Platoon advantage       — +0.12 (LvR), +0.08 (RvL), +0.04 (S); −0.04 same-hand
 *   Fly-ball vulnerability  — deviation from 40% league avg × 0.06
 *   HR/9 vs hand            — (HR9 − 1.1) × 0.20 (most predictive single factor)
 *   Protection score        — score × 0.05 (conservative; null effect in research)
 *   Team power context      — +0.05 (top-8), +0.02 (top-15), −0.04 (bottom-8)
 *   Bullpen HR/9            — +0.04 if pen HR9 > 1.4 (weak pen); −0.06 if < 1.0
 *
 * @returns matchup_factor clamped to [0.80, 1.60]
 */
export function calculateMatchupFactor(ctx: LineupContext): number {
  // ── 1. Lineup slot base (multiplicative — scales every additive term below)
  let factor = LINEUP_SLOT_HR_MULTIPLIERS[ctx.lineup_slot] ?? 0.95;

  // ── 2. Platoon and handedness ─────────────────────────────────────────────
  // Asymmetric by handedness: LHB vs RHP has the largest empirical HR split
  if (ctx.platoon_advantage) {
    if (ctx.batter_hand === 'L' && ctx.pitcher_hand === 'R') {
      factor += 0.12;  // classic lefty power edge vs righties (~8-15% HR boost)
    } else if (ctx.batter_hand === 'R' && ctx.pitcher_hand === 'L') {
      factor += 0.08;  // righty vs lefty: real but smaller split
    } else if (ctx.batter_hand === 'S') {
      factor += 0.04;  // switch hitters get partial benefit (they pick best side)
    }
  } else {
    factor -= 0.04;    // same-hand penalty: pitcher has better breaking ball angle
  }

  // ── 3. Pitcher fly-ball / HR vulnerability ────────────────────────────────
  // Normalized around 40% league avg; linear relationship to HR allowed rate
  const fb_deviation = (ctx.pitcher_flyball_pct - 40) / 10;
  factor += fb_deviation * 0.06;  // ±0.06 per 10 pct pts above/below 40%

  // HR/9 vs specific handedness — single most predictive pitcher vulnerability metric
  // Baseline: 1.1 HR/9 (league avg); weight 0.20 per unit deviation
  factor += (ctx.pitcher_hr9_vs_hand - 1.1) * 0.20;

  // ── 4. Lineup protection (conservative weight — effect is smaller than intuition)
  // Research shows mild or null net impact on individual HR rate; keep at 0.05
  factor += ctx.protection_score * 0.05;  // max +5% for elite protection (OPS > 0.950)

  // ── 5. Team power context ─────────────────────────────────────────────────
  if (ctx.team_power_rank <= 8) {
    factor += 0.05;    // top power offenses: pitchers must throw strikes
  } else if (ctx.team_power_rank <= 15) {
    factor += 0.02;    // slightly above average
  } else if (ctx.team_power_rank >= 23) {
    factor -= 0.04;    // weak lineups: pitchers can nibble and punt
  }

  // ── 6. Opposing bullpen HR/9 ──────────────────────────────────────────────
  // Weak pens (high HR/9) create late-game HR opportunities after starter exits
  // Elite pens (low HR/9) close off the back-end of the game for HR props
  if (ctx.opposing_bullpen_hr9 > 1.4) {
    factor += 0.04;    // weak pen = HR opportunity in innings 7-9
  } else if (ctx.opposing_bullpen_hr9 < 1.0) {
    factor -= 0.06;    // elite pen significantly reduces late-game HR chances
  }

  // Clamp: extreme stacking scenarios can't exceed ±50-60% vs neutral baseline
  return Math.max(0.80, Math.min(1.60, factor));
}

// ─── Matchup quality label ────────────────────────────────────────────────────

/**
 * Human-readable tier for a matchup factor.
 * Used in card display, edge scoring tier labels, and fade signal UI.
 */
export function getMatchupLabel(factor: number): string {
  if (factor >= 1.45) return 'Elite Matchup';
  if (factor >= 1.25) return 'Strong Matchup';
  if (factor >= 1.10) return 'Favorable';
  if (factor >= 0.95) return 'Neutral';
  if (factor >= 0.88) return 'Tough Matchup';
  return 'Unfavorable Matchup';
}

/**
 * Detect a fade signal: matchup AND sharp money both indicate suppressed HR.
 * Used by the real-time odds layer to generate high-confidence UNDER signals.
 *
 * A fade fires when:
 *   a) matchup_factor < 0.92 (bad matchup — same-hand ace, elite pen, weak lineup), AND
 *   b) marketMovePts is negative (market moving toward lower HR probability)
 *
 * @param matchupFactor   Output of calculateMatchupFactor
 * @param marketMovePts   Implied probability shift in last 2 hours (negative = fading)
 * @returns               True when both conditions align for an UNDER fade signal
 */
export function isFadeSignal(matchupFactor: number, marketMovePts: number): boolean {
  return matchupFactor < 0.92 && marketMovePts < -0.05;
}

// ─── Explainability ──────────────────────────────────────────────────────────

/**
 * Decompose a LineupContext into a readable breakdown of each component.
 * Useful for debugging, dashboard display, and test assertions.
 */
export interface MatchupBreakdown {
  slotMultiplier: number;
  platoonBoost: number;
  flyballBoost: number;
  hr9Contribution: number;
  protectionBoost: number;
  teamPowerBoost: number;
  bullpenAdjustment: number;
  rawFactor: number;        // sum before clamping
  clampedFactor: number;    // final output of calculateMatchupFactor
  label: string;
}

export function explainMatchupFactor(ctx: LineupContext): MatchupBreakdown {
  const slotMultiplier = LINEUP_SLOT_HR_MULTIPLIERS[ctx.lineup_slot] ?? 0.95;

  let platoonBoost = 0;
  if (ctx.platoon_advantage) {
    if (ctx.batter_hand === 'L' && ctx.pitcher_hand === 'R') platoonBoost = 0.12;
    else if (ctx.batter_hand === 'R' && ctx.pitcher_hand === 'L') platoonBoost = 0.08;
    else if (ctx.batter_hand === 'S') platoonBoost = 0.04;
  } else {
    platoonBoost = -0.04;
  }

  const flyballBoost     = ((ctx.pitcher_flyball_pct - 40) / 10) * 0.06;
  const hr9Contribution  = (ctx.pitcher_hr9_vs_hand - 1.1) * 0.20;
  const protectionBoost  = ctx.protection_score * 0.05;

  const teamPowerBoost =
    ctx.team_power_rank <= 8  ? 0.05 :
    ctx.team_power_rank <= 15 ? 0.02 :
    ctx.team_power_rank >= 23 ? -0.04 : 0;

  const bullpenAdjustment =
    ctx.opposing_bullpen_hr9 > 1.4 ?  0.04 :
    ctx.opposing_bullpen_hr9 < 1.0 ? -0.06 : 0;

  const rawFactor =
    slotMultiplier +
    platoonBoost +
    flyballBoost +
    hr9Contribution +
    protectionBoost +
    teamPowerBoost +
    bullpenAdjustment;

  const clampedFactor = Math.max(0.80, Math.min(1.60, rawFactor));

  return {
    slotMultiplier,
    platoonBoost,
    flyballBoost,
    hr9Contribution,
    protectionBoost,
    teamPowerBoost,
    bullpenAdjustment,
    rawFactor,
    clampedFactor,
    label: getMatchupLabel(clampedFactor),
  };
}
