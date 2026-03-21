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
 * matchup_factor is clamped to [0.75, 1.55].
 *   0.75 — severe unfavourable matchup (e.g. weak LHB vs elite LHP closer)
 *   1.00 — neutral baseline
 *   1.55 — ideal matchup (cleanup slot, opposite-hand, flyball pitcher, good pen)
 *
 * ─── Typical compound scenario ───────────────────────────────────────────────
 * Slot 4 (×1.28) + platoon L-vs-R (+0.09+0.05) + flyball pitcher (+0.07)
 * + protection 0.88 (+0.11) + top-10 team (+0.06)
 * → factor ≈ 1.49 before park/weather multiplication
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
   * Pitcher fly-ball percentage (total air balls / total BIP × 100).
   * Typical range: 28–52.  High fly-ball pitchers allow more HRs.
   */
  pitcher_flyball_pct: number;

  /**
   * Pitcher HR/9 split specifically against the batter's hand.
   * More specific than overall HR/9; reveals true platoon HR vulnerability.
   * Typical range: 0.5–2.5.  League avg ≈ 1.2.
   */
  pitcher_hr_per_9_vs_hand: number;

  /**
   * Protection score: average OPS of the batters immediately before and
   * after this batter in the lineup (on-deck + in-hole effect).
   * Range 0–1 (OPS / 1.100 normalised).  High protection → pitcher cannot
   * pitch around this batter, increasing hittable pitches seen.
   */
  protection_score: number;

  /**
   * True when batter and pitcher are opposite-handed (classic platoon split).
   * Pre-computed for speed; must be consistent with batter_hand / pitcher_hand.
   */
  platoon_advantage: boolean;

  /**
   * MLB rank of the batter's team by HR output (1 = most HRs, 30 = fewest).
   * Top-10 power teams create lineup depth that forces pitchers to throw strikes.
   */
  team_power_rank: number;

  /**
   * Opposing bullpen quality score (0–1).
   * Computed as (bullpen ERA rank / 30) adjusted for leverage index.
   * High score (>0.75) = elite pen that suppresses late-game HR opportunities.
   */
  opposing_bullpen_depth: number;
}

// ─── Lineup slot multipliers ─────────────────────────────────────────────────

/**
 * Per-slot HR opportunity multipliers.
 * Slots 3–6 receive the most plate appearances in high-leverage situations
 * and face starters longer.  Slots 1–2 and 7–9 trend neutral.
 *
 * Source: MLB 2019–2024 PA-weighted HR rate by lineup position.
 */
export const LINEUP_SLOT_MULTIPLIER: Record<number, number> = {
  1: 1.05,  // Lead-off: high PA volume but lower protection
  2: 1.08,  // Second: RISP situations increasing; modern analytics slot
  3: 1.22,  // Third: best combination of contact quality + power + PA count
  4: 1.28,  // Cleanup: highest expected HR rate; most RISP, most pitches to hit
  5: 1.25,  // Fifth: protected by cleanup slot; still high leverage
  6: 1.12,  // Sixth: mild premium; quality starters still pitching here
  // 7–9: 1.0 (default — no significant premium vs baseline)
};

// ─── Main calculation ─────────────────────────────────────────────────────────

/**
 * Calculate the composite matchup factor for a single batter-pitcher context.
 *
 * Factor components and their maximum additive contribution:
 *   Lineup slot multiplier  — up to ×1.28 (multiplicative)
 *   Platoon advantage       — +0.09 (opposite hand) + up to +0.05 (classic L-vs-R)
 *   Fly-ball vulnerability  — +0.07 (high fly-ball pitcher)
 *   HR/9 vs hand            — ±(HR/9 − 1.0) × 0.15
 *   Protection score        — up to +0.12 (perfect lineup protection)
 *   Team power context      — +0.06 (top-10 HR team)
 *   Bullpen depth penalty   — −0.08 (elite bullpen reduces late-game HRs)
 *
 * @returns matchup_factor clamped to [0.75, 1.55]
 */
export function calculateMatchupFactor(ctx: LineupContext): number {
  // ── 1. Lineup slot base (multiplicative — applies to all additive terms below)
  let factor = LINEUP_SLOT_MULTIPLIER[ctx.lineup_slot] ?? 1.0;

  // ── 2. Platoon and handedness ─────────────────────────────────────────────
  if (ctx.platoon_advantage) {
    factor += 0.09;  // opposite-hand platoon split (strongest individual signal)
  }
  // Classic L-vs-R edge: left-handed batters historically have the biggest power
  // split vs right-handed pitchers due to arm angle and ball path into the zone
  if (ctx.batter_hand === 'L' && ctx.pitcher_hand === 'R') {
    factor += 0.05;
  }

  // ── 3. Pitcher fly-ball / HR vulnerability ────────────────────────────────
  // Above 42% fly-ball rate: significantly more balls in the air = more HR chances
  if (ctx.pitcher_flyball_pct > 42) {
    factor += 0.07;
  } else if (ctx.pitcher_flyball_pct > 38) {
    factor += 0.03;  // Moderate elevation
  }

  // HR/9 vs specific hand — deviation from league average (1.2 HR/9)
  // Each 0.1 above 1.0 adds 1.5% to factor; below 1.0 subtracts
  factor += (ctx.pitcher_hr_per_9_vs_hand - 1.0) * 0.15;

  // ── 4. Lineup protection and synergy ──────────────────────────────────────
  // High protection_score means pitchers cannot pitch around this batter,
  // increasing frequency of hittable pitches in the strike zone
  factor += ctx.protection_score * 0.12;

  // ── 5. Team power context ─────────────────────────────────────────────────
  // Top-10 power teams create a lineup depth that forces pitchers into the zone
  if (ctx.team_power_rank <= 10) {
    factor += 0.06;
  } else if (ctx.team_power_rank <= 15) {
    factor += 0.03;
  }

  // ── 6. Opposing bullpen depth penalty ─────────────────────────────────────
  // An elite deep bullpen (>0.75) means the starter is pulled early, removing
  // the weakest part of the opposing pitching staff from the equation
  if (ctx.opposing_bullpen_depth > 0.75) {
    factor -= 0.08;
  } else if (ctx.opposing_bullpen_depth > 0.60) {
    factor -= 0.04;
  }

  return Math.max(0.75, Math.min(1.55, factor));
}

// ─── Matchup quality label ────────────────────────────────────────────────────

/**
 * Human-readable tier for a matchup factor.
 * Used in card display and edge scoring tier labels.
 */
export function getMatchupLabel(factor: number): string {
  if (factor >= 1.40) return 'Elite Matchup';
  if (factor >= 1.25) return 'Strong Matchup';
  if (factor >= 1.10) return 'Favorable';
  if (factor >= 0.95) return 'Neutral';
  if (factor >= 0.85) return 'Tough Matchup';
  return 'Unfavorable Matchup';
}

/**
 * Detect a fade signal: matchup AND sharp money both indicate suppressed HR.
 * Used by the real-time odds layer to generate high-confidence UNDER signals.
 *
 * A fade fires when:
 *   a) matchup_factor < 0.92 (bad matchup — e.g. LHB vs elite LHP pen), AND
 *   b) sharpMovement is negative (market moving toward lower HR probability)
 *
 * @param matchupFactor   Output of calculateMatchupFactor
 * @param marketMovePts   Implied probability shift in last 2 hours (negative = market fading)
 * @returns               True when both conditions align for a fade signal
 */
export function isFadeSignal(matchupFactor: number, marketMovePts: number): boolean {
  return matchupFactor < 0.92 && marketMovePts < -0.05;
}

/**
 * Decompose a LineupContext into a readable breakdown of each factor's contribution.
 * Useful for debugging, dashboard explainability, and test assertions.
 */
export interface MatchupBreakdown {
  slotMultiplier: number;
  platoonBoost: number;
  handednessBoost: number;
  flyballBoost: number;
  hr9Contribution: number;
  protectionBoost: number;
  teamPowerBoost: number;
  bullpenPenalty: number;
  rawFactor: number;          // before clamping
  clampedFactor: number;      // final output
  label: string;
}

export function explainMatchupFactor(ctx: LineupContext): MatchupBreakdown {
  const slotMultiplier   = LINEUP_SLOT_MULTIPLIER[ctx.lineup_slot] ?? 1.0;
  const platoonBoost     = ctx.platoon_advantage ? 0.09 : 0;
  const handednessBoost  = (ctx.batter_hand === 'L' && ctx.pitcher_hand === 'R') ? 0.05 : 0;
  const flyballBoost     = ctx.pitcher_flyball_pct > 42 ? 0.07 : ctx.pitcher_flyball_pct > 38 ? 0.03 : 0;
  const hr9Contribution  = (ctx.pitcher_hr_per_9_vs_hand - 1.0) * 0.15;
  const protectionBoost  = ctx.protection_score * 0.12;
  const teamPowerBoost   = ctx.team_power_rank <= 10 ? 0.06 : ctx.team_power_rank <= 15 ? 0.03 : 0;
  const bullpenPenalty   = ctx.opposing_bullpen_depth > 0.75 ? -0.08 : ctx.opposing_bullpen_depth > 0.60 ? -0.04 : 0;

  const rawFactor =
    slotMultiplier +
    platoonBoost +
    handednessBoost +
    flyballBoost +
    hr9Contribution +
    protectionBoost +
    teamPowerBoost +
    bullpenPenalty;

  const clampedFactor = Math.max(0.75, Math.min(1.55, rawFactor));

  return {
    slotMultiplier,
    platoonBoost,
    handednessBoost,
    flyballBoost,
    hr9Contribution,
    protectionBoost,
    teamPowerBoost,
    bullpenPenalty,
    rawFactor,
    clampedFactor,
    label: getMatchupLabel(clampedFactor),
  };
}
