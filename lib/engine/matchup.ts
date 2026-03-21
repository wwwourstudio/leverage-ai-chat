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
 * facing a dominant LHP who owns that platoon with a sweeper-heavy arsenal.
 * The matchup layer absorbs that suppression first, so park/weather can only
 * amplify a pre-validated edge.
 *
 * ─── Architecture ────────────────────────────────────────────────────────────
 * calculateMatchupFactor(ctx) =
 *   positionalFactor(lineup + platoon + protection + team + bullpen)
 *   × calculatePitchMixVuln(ctx)          ← NEW multiplicative sub-component
 *
 * Pitch mix is applied as a multiplier, not an additive term, because it scales
 * ALL the positional/platoon/bullpen signals uniformly rather than shifting the
 * origin.  A great matchup slot with bad arsenal is still suppressed by ~25-30%;
 * a weak slot against a 4-seam-dominant pitcher is amplified proportionally.
 *
 * ─── Output range ────────────────────────────────────────────────────────────
 * matchup_factor is clamped to [0.75, 1.70].
 *   0.75 — worst case: bad slot, same-hand, groundball artist, low HR/FB, elite pen
 *   1.00 — neutral baseline
 *   1.70 — best case: cleanup LHB, flyball 4-seam RHP 55% (14%+ HR/FB), weak pen
 *
 * ─── Stack layers ────────────────────────────────────────────────────────────
 *   0. Matchup Engine  (this file: lineup + platoon + pitch mix + bullpen)
 *   1. Context Engine  (park factors + weather)
 *   2. Learned ML Model (consumes matchup_factor as feature)
 *   3. Real-Time Odds + Sharp money signals
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Full lineup, pitcher context, and pitch arsenal data for one batter-pitcher
 * matchup.  All fields are available from the MLB Stats API schedule +
 * Statcast/Baseball Savant endpoints.
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
   */
  opposing_bullpen_hr9: number;

  // ── Pitch Mix / Arsenal Fields ──────────────────────────────────────────────

  /**
   * Percentage of pitches thrown that are 4-seam fastballs (0–100).
   * High 4-seam usage correlates strongly with elevated fly-ball rate
   * and barrel-per-BIP rate — the primary HR-risk pitch type.
   * Typical range: 20–65%.  League avg ≈ 35%.
   */
  pitcher_four_seam_pct: number;

  /**
   * Combined usage % of all breaking balls (slider + sweeper + curveball + cutter).
   * Higher breaking ball reliance suppresses hard contact via whiff and
   * horizontal/vertical movement inducing weak ground or pull-side contact.
   */
  pitcher_breaking_usage: number;

  /**
   * Combined usage % of offspeed pitches (changeup + splitter).
   * Especially effective vs opposite-hand batters; lowers exit velocity
   * and reduces HR/FB rate by inducing soft contact or weak fly balls.
   */
  pitcher_offspeed_usage: number;

  /**
   * Average velocity of the pitcher's primary fastball (mph).
   * Sub-92 mph flat heaters are most vulnerable to being barreled.
   * Elite velo (>95 mph) provides modest suppression.
   * Typical range: 89–100 mph.
   */
  pitcher_fastball_velo: number;

  /**
   * HR per fly ball allowed (HR/FB ratio).
   * Most predictive single-season stabilizing metric for pitcher HR propensity.
   * League avg ≈ 0.11 (11%).  High (>0.14) = HR-prone; Low (<0.08) = suppressive.
   */
  pitcher_hr_allowed_per_fb: number;
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
  1: 0.92,  // Leadoff: high PA volume but fewest RBI ops; pitchers often nibble
  2: 1.05,  // Second: analytics-era power slot; RISP situations rising
  3: 1.18,  // Third: best combo of contact quality + PA count + protection
  4: 1.22,  // Cleanup: most RISP, most pitches in zone; highest HR rate
  5: 1.15,  // Fifth: protected by cleanup slot; starters still pitching here
  6: 1.05,  // Sixth: mild premium; quality starters often still engaged
  7: 0.98,  // Seventh: slight suppression begins
  8: 0.90,  // Eighth: notably fewer high-leverage PA
  9: 0.85,  // Ninth: lowest HR rate position; pitchers pitch to put-away counts
};

// ─── Pitch mix vulnerability ──────────────────────────────────────────────────

/**
 * Reference HR risk multipliers by pitch type (used for documentation /
 * future per-type barrel analysis).  Current calculatePitchMixVuln uses
 * the aggregate usage fields for speed; this table is the research anchor.
 *
 * Source: Statcast 2021-2024 HR/FB by pitch type, normalized to 1.0.
 */
export const PITCH_MIX_HR_VULNERABILITY: Record<string, number> = {
  four_seam:  1.15,  // elevated 4-seamers → more barrels/HR
  sinker:     0.95,  // more grounders, lower HR risk
  cutter:     1.05,  // mixed; can be flat and HR-prone
  slider:     0.85,  // high whiff, suppresses hard contact
  sweeper:    0.82,  // even better vs same-hand; biggest HR suppressor
  curveball:  0.88,  // depth induces weak contact
  changeup:   0.90,  // good vs opposite hand, lowers EV
  splitter:   0.87,  // elite drop / suppression
};

/**
 * Compute the pitch mix vulnerability sub-factor from the pitcher's arsenal.
 *
 * Logic:
 *   1. Fastball exposure boost:  four_seam_pct / 100 × 0.25
 *      (50% 4-seam diet → +12.5%; 4-seamers produce the highest barrel/FB rates)
 *   2. Breaking + offspeed suppression: combined_usage / 100 × 0.35
 *      (60% breaking/offspeed → -21%; whiff + weak contact dominates)
 *   3. Velocity adjustment: <92 mph flat heaters get barreled (+0.06);
 *      elite ≥95 mph provides modest protection (+0.04)
 *   4. HR/FB rate: (hr_per_fb - 0.11) × 1.8
 *      (most predictive stabilizer; 14% HR/FB → +0.054 vs 8% → -0.054)
 *
 * @returns pitch mix vulnerability factor clamped to [0.75, 1.45]
 */
export function calculatePitchMixVuln(ctx: LineupContext): number {
  let vuln = 1.0;

  // 1. Fastball-dominant arsenal increases HR risk
  const fb_exposure = ctx.pitcher_four_seam_pct / 100;
  vuln += fb_exposure * 0.25;

  // 2. Breaking + offspeed mix suppresses barrels and HR/FB
  const suppress = (ctx.pitcher_breaking_usage + ctx.pitcher_offspeed_usage) / 100;
  vuln -= suppress * 0.35;

  // 3. Primary fastball velocity adjustment
  if (ctx.pitcher_fastball_velo >= 95) {
    vuln += 0.04;   // elite velo helps — harder to elevate even on 4-seams
  } else if (ctx.pitcher_fastball_velo < 92) {
    vuln += 0.06;   // below-avg velo flat 4-seamers are prime barrel candidates
  }

  // 4. HR/FB allowed — strongest predictive signal (stabilizes by ~200 BF)
  // League avg HR/FB ≈ 0.11; scale: each 1% above/below avg moves vuln ~0.018
  vuln += (ctx.pitcher_hr_allowed_per_fb - 0.11) * 1.8;

  return Math.max(0.75, Math.min(1.45, vuln));
}

// ─── Main calculation ─────────────────────────────────────────────────────────

/**
 * Calculate the composite matchup factor for a single batter-pitcher context.
 *
 * Positional component contributions (additive):
 *   Lineup slot multiplier  — multiplicative base [0.85, 1.22]
 *   Platoon advantage       — +0.12 (LvR), +0.08 (RvL), +0.04 (S); −0.04 same-hand
 *   Fly-ball vulnerability  — deviation from 40% league avg × 0.06
 *   HR/9 vs hand            — (HR9 − 1.1) × 0.20 (most predictive pitcher factor)
 *   Protection score        — score × 0.05 (conservative; research shows weak effect)
 *   Team power context      — +0.05 (top-8), +0.02 (top-15), −0.04 (bottom-8)
 *   Bullpen HR/9            — +0.04 if pen HR9 > 1.4; −0.06 if < 1.0
 *
 * Then the positional factor is multiplied by calculatePitchMixVuln(ctx):
 *   Pitch mix vuln [0.75, 1.45] scales the entire positional factor
 *
 * @returns matchup_factor clamped to [0.75, 1.70]
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
  factor += ctx.protection_score * 0.05;  // max +5% for elite protection

  // ── 5. Team power context ─────────────────────────────────────────────────
  if (ctx.team_power_rank <= 8) {
    factor += 0.05;    // top power offenses: pitchers must throw strikes
  } else if (ctx.team_power_rank <= 15) {
    factor += 0.02;
  } else if (ctx.team_power_rank >= 23) {
    factor -= 0.04;    // weak lineups: pitchers can nibble and punt
  }

  // ── 6. Opposing bullpen HR/9 ──────────────────────────────────────────────
  if (ctx.opposing_bullpen_hr9 > 1.4) {
    factor += 0.04;    // weak pen = HR opportunity in innings 7-9
  } else if (ctx.opposing_bullpen_hr9 < 1.0) {
    factor -= 0.06;    // elite pen significantly reduces late-game HR chances
  }

  // ── 7. Pitch mix vulnerability (multiplicative sub-factor) ────────────────
  // Applied as a multiplier so it scales all positional/platoon/bullpen signals
  // rather than simply shifting the origin.  A great matchup slot is still
  // suppressed by a sweeper-heavy arsenal; a weak slot is still amplified by
  // a flat 4-seam dominant arm.
  const pitchVuln = calculatePitchMixVuln(ctx);
  factor *= pitchVuln;

  // Clamp: wider range now that pitch mix can push extreme stacking scenarios
  return Math.max(0.75, Math.min(1.70, factor));
}

// ─── Matchup quality label ────────────────────────────────────────────────────

/**
 * Human-readable tier for a matchup factor.
 * Used in card display, edge scoring tier labels, and fade signal UI.
 */
export function getMatchupLabel(factor: number): string {
  if (factor >= 1.50) return 'Elite Matchup';
  if (factor >= 1.30) return 'Strong Matchup';
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
 *   a) matchup_factor < 0.92 (bad matchup — same-hand ace with heavy sweeper usage,
 *      elite pen, weak lineup slot), AND
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
  // Positional components (additive)
  slotMultiplier: number;
  platoonBoost: number;
  flyballBoost: number;
  hr9Contribution: number;
  protectionBoost: number;
  teamPowerBoost: number;
  bullpenAdjustment: number;
  positionalFactor: number;   // sum of additive components before pitch mix

  // Pitch mix sub-factor (multiplicative)
  pitchMixVuln: number;       // output of calculatePitchMixVuln

  rawFactor: number;          // positionalFactor * pitchMixVuln before clamping
  clampedFactor: number;      // final output of calculateMatchupFactor
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

  const flyballBoost    = ((ctx.pitcher_flyball_pct - 40) / 10) * 0.06;
  const hr9Contribution = (ctx.pitcher_hr9_vs_hand - 1.1) * 0.20;
  const protectionBoost = ctx.protection_score * 0.05;

  const teamPowerBoost =
    ctx.team_power_rank <= 8  ?  0.05 :
    ctx.team_power_rank <= 15 ?  0.02 :
    ctx.team_power_rank >= 23 ? -0.04 : 0;

  const bullpenAdjustment =
    ctx.opposing_bullpen_hr9 > 1.4 ?  0.04 :
    ctx.opposing_bullpen_hr9 < 1.0 ? -0.06 : 0;

  const positionalFactor =
    slotMultiplier +
    platoonBoost +
    flyballBoost +
    hr9Contribution +
    protectionBoost +
    teamPowerBoost +
    bullpenAdjustment;

  const pitchMixVuln  = calculatePitchMixVuln(ctx);
  const rawFactor     = positionalFactor * pitchMixVuln;
  const clampedFactor = Math.max(0.75, Math.min(1.70, rawFactor));

  return {
    slotMultiplier,
    platoonBoost,
    flyballBoost,
    hr9Contribution,
    protectionBoost,
    teamPowerBoost,
    bullpenAdjustment,
    positionalFactor,
    pitchMixVuln,
    rawFactor,
    clampedFactor,
    label: getMatchupLabel(clampedFactor),
  };
}
