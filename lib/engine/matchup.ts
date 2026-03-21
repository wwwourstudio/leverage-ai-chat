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
 *   positionalFactor(lineup + flyball + HR9 + protection + team + bullpen)
 *   × calculatePlatoonFactor(ctx)          ← continuous platoon split multiplier
 *   × calculatePitchMixVuln(ctx)           ← arsenal vulnerability multiplier
 *
 * Both sub-factors are multiplicative so they scale all positional/structural
 * signals uniformly.  Additive terms set the baseline; multiplicative terms
 * dial it up or down based on context-specific quality.
 *
 * ─── Platoon Split Score convention ─────────────────────────────────────────
 * batter_platoon_score  [-1, +1]:
 *   +1  = extreme advantage vs opposite-hand pitchers (LHB crushes RHP, RHB crushes LHP)
 *    0  = even splits (switch hitters, or truly balanced batter)
 *   -1  = reverse split (better vs same-hand — rare but real)
 *   Compute: tanh((wOBA_vs_opp_hand - wOBA_vs_same_hand) / 0.08)
 *
 * pitcher_platoon_score [-1, +1]:
 *   +1  = extreme vulnerability to opposite-hand batters
 *    0  = even splits
 *   -1  = reverse split (better vs opposite-hand batters — rare)
 *   Compute: tanh((wOBA_allowed_vs_opp_hand - wOBA_allowed_vs_same_hand) / 0.08)
 *
 * Both scores are "positive = normal platoon direction" so the integration is
 * symmetric: when batter faces opposite-hand pitcher both scores contribute
 * positively; when same-hand both flip negative, creating a natural suppress.
 *
 * ─── Output range ────────────────────────────────────────────────────────────
 * matchup_factor is clamped to [0.70, 1.80].
 *   0.70 — worst: bad slot, strong same-hand platoon ace, elite pen, GB arsenal
 *   1.00 — neutral baseline
 *   1.80 — best: cleanup LHB vs 4-seam RHP, bilateral +0.8 platoon edge, weak pen
 *
 * ─── Stack layers ────────────────────────────────────────────────────────────
 *   0. Matchup Engine  (this file: lineup + platoon score + pitch mix + bullpen)
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
   * Normalized platoon split score for the batter [-1, +1].
   *
   * Positive = batter performs better vs OPPOSITE-hand pitchers (normal platoon).
   * Negative = batter performs better vs SAME-hand pitchers (reverse split).
   * Zero     = even splits (switch hitters or neutral batters).
   *
   * Typical values:
   *   Classic LHB power hitter:  +0.60 to +0.85 (much better vs RHP)
   *   Pull-heavy RHB:            +0.45 to +0.70 (better vs LHP)
   *   Switch hitter:             -0.10 to +0.10
   *   Reverse-split batter:      negative (rare; e.g. some RHB crush same-hand)
   *
   * Compute from wOBA splits:
   *   LHB: tanh((wOBA_vs_RHP - wOBA_vs_LHP) / 0.08)
   *   RHB: tanh((wOBA_vs_LHP - wOBA_vs_RHP) / 0.08)
   *   Use normalizePlatoonDelta() helper below for preprocessing.
   */
  batter_platoon_score: number;

  /**
   * Normalized platoon split score for the pitcher [-1, +1].
   *
   * Positive = pitcher is more vulnerable to OPPOSITE-hand batters (normal platoon).
   * Negative = pitcher more vulnerable to SAME-hand batters (reverse split).
   * Zero     = even splits.
   *
   * Typical values:
   *   Standard RHP with good breaking ball: +0.35 to +0.60 (worse vs LHB)
   *   Standard LHP:                         +0.30 to +0.55 (worse vs RHB)
   *   Sidearm/slot dependent pitcher:       |score| > 0.70
   *   Reverse-split pitcher:                negative (unusual)
   *
   * Compute from wOBA-allowed splits:
   *   RHP: tanh((wOBA_allowed_vs_LHB - wOBA_allowed_vs_RHB) / 0.08)
   *   LHP: tanh((wOBA_allowed_vs_RHB - wOBA_allowed_vs_LHB) / 0.08)
   *   Use normalizePlatoonDelta() helper below for preprocessing.
   */
  pitcher_platoon_score: number;

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

// ─── Platoon split helpers ────────────────────────────────────────────────────

/**
 * Weight applied to platoon_edge inside the matchup factor multiplier.
 * Tuned so that a bilateral maximum edge (+1.0 batter, +1.0 pitcher → edge=1.0)
 * scales factor by ×1.25 and a bilateral minimum (−1.0, −1.0 → edge=−1.0)
 * scales by ×0.75.  Range of the multiplier: [0.75, 1.25] for this sub-factor.
 * Backtest target: 0.20–0.30 based on observed ~15-30% HR swing in extreme splits.
 */
export const PLATOON_WEIGHT = 0.25;

/**
 * Normalize a raw wOBA (or ISO/HR-rate) split delta into a platoon score [-1, +1].
 *
 * The delta must be pre-oriented so that positive = advantage vs opposite hand:
 *   - For batters:   delta = wOBA_vs_opp_hand_pitcher - wOBA_vs_same_hand_pitcher
 *   - For pitchers:  delta = wOBA_allowed_vs_opp_hand - wOBA_allowed_vs_same_hand
 *
 * tanh(x / 0.08) maps the typical league platoon delta range:
 *   ±0.020 → ±0.24  (minor split)
 *   ±0.045 → ±0.49  (moderate split — ~50th pct among qualified hitters)
 *   ±0.080 → ±0.76  (strong split)
 *   ±0.120 → ±0.90  (extreme split)
 *   ±0.200 → ±0.99  (saturates near ±1)
 *
 * @param delta  wOBA or HR-rate difference, pre-oriented (opposite minus same)
 */
export function normalizePlatoonDelta(delta: number): number {
  return Math.tanh(delta / 0.08);
}

/**
 * Compute the combined platoon edge for a specific batter-pitcher matchup.
 *
 * The edge is the average of:
 *   - batter's contribution: how much advantage the batter has vs THIS pitcher's hand
 *   - pitcher's contribution: how vulnerable the pitcher is to THIS batter's hand
 *
 * Sign logic (both scores are "positive = normal platoon"):
 *   - Opposite-hand matchup (LHB vs RHP / RHB vs LHP): both scores contribute
 *     positively → edge > 0 → factor boost
 *   - Same-hand matchup: both scores are negated → edge < 0 → factor suppression
 *   - Switch hitters always treated as opposite-hand (they always pick the favorable side)
 *
 * @returns platoon_edge in roughly [-1, +1]
 */
export function calculatePlatoonEdge(ctx: LineupContext): number {
  const isOppositeHand = ctx.batter_hand === 'S' || ctx.batter_hand !== ctx.pitcher_hand;
  const batter_edge  = isOppositeHand ?  ctx.batter_platoon_score : -ctx.batter_platoon_score;
  const pitcher_edge = isOppositeHand ?  ctx.pitcher_platoon_score : -ctx.pitcher_platoon_score;
  return (batter_edge + pitcher_edge) / 2;
}

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
 * Additive positional components (combined into positionalFactor):
 *   Lineup slot multiplier  — base [0.85, 1.22] by batting order position
 *   Fly-ball vulnerability  — deviation from 40% league avg × 0.06
 *   HR/9 vs hand            — (HR9 − 1.1) × 0.20 (strongest single pitcher stat)
 *   Protection score        — score × 0.05 (conservative; mild empirical effect)
 *   Team power context      — +0.05 (top-8), +0.02 (top-15), −0.04 (bottom-8)
 *   Bullpen HR/9            — +0.04 weak pen; −0.06 elite pen
 *
 * Multiplicative sub-factors (applied in sequence):
 *   Platoon factor          — 1 + platoon_edge × 0.25; edge derived from
 *                             batter_platoon_score and pitcher_platoon_score
 *   Pitch mix vuln          — calculatePitchMixVuln [0.75, 1.45]
 *
 * @returns matchup_factor clamped to [0.70, 1.80]
 */
export function calculateMatchupFactor(ctx: LineupContext): number {
  // ── 1. Lineup slot base (multiplicative — scales every additive term below)
  let factor = LINEUP_SLOT_HR_MULTIPLIERS[ctx.lineup_slot] ?? 0.95;

  // ── 2. Pitcher fly-ball / HR vulnerability ────────────────────────────────
  // Normalized around 40% league avg; linear relationship to HR allowed rate
  const fb_deviation = (ctx.pitcher_flyball_pct - 40) / 10;
  factor += fb_deviation * 0.06;  // ±0.06 per 10 pct pts above/below 40%

  // HR/9 vs specific handedness — single most predictive pitcher vulnerability metric
  // Baseline: 1.1 HR/9 (league avg); weight 0.20 per unit deviation
  factor += (ctx.pitcher_hr9_vs_hand - 1.1) * 0.20;

  // ── 3. Lineup protection (conservative weight — mild empirical effect)
  factor += ctx.protection_score * 0.05;

  // ── 4. Team power context ─────────────────────────────────────────────────
  if (ctx.team_power_rank <= 8) {
    factor += 0.05;    // top power offenses: pitchers must throw strikes
  } else if (ctx.team_power_rank <= 15) {
    factor += 0.02;
  } else if (ctx.team_power_rank >= 23) {
    factor -= 0.04;    // weak lineups: pitchers can nibble and punt
  }

  // ── 5. Opposing bullpen HR/9 ──────────────────────────────────────────────
  if (ctx.opposing_bullpen_hr9 > 1.4) {
    factor += 0.04;    // weak pen = HR opportunity in innings 7-9
  } else if (ctx.opposing_bullpen_hr9 < 1.0) {
    factor -= 0.06;    // elite pen significantly reduces late-game HR chances
  }

  // ── 6. Platoon Split Score (multiplicative) ───────────────────────────────
  // Replaces the old binary platoon_advantage flag with a continuous multiplier
  // derived from normalized batter and pitcher split scores.
  //
  // platoon_edge = avg(batter_contribution, pitcher_contribution)
  //   Opposite-hand matchup: both scores positive → edge > 0 → boost
  //   Same-hand matchup:     both scores negated  → edge < 0 → suppress
  //   Bilateral max (+0.80, +0.80): edge = +0.80 → ×1.20  (+20%)
  //   Bilateral min (−0.80, −0.80): edge = −0.80 → ×0.80  (−20%)
  //   Reverse-split batter (−0.50) vs opposite-hand pitcher (+0.50):
  //     edge = 0 → neutral (batter disadvantage cancels pitcher vulnerability)
  const platoonEdge   = calculatePlatoonEdge(ctx);
  const platoonFactor = 1 + platoonEdge * PLATOON_WEIGHT;
  factor *= platoonFactor;

  // ── 7. Pitch mix vulnerability (multiplicative) ───────────────────────────
  // Applied after platoon so it scales the platoon-adjusted factor.
  // A great platoon edge vs a sweeper-heavy ace is still suppressed;
  // a bad platoon vs a flat 4-seam arm is still amplified.
  const pitchVuln = calculatePitchMixVuln(ctx);
  factor *= pitchVuln;

  // Clamp: platoon × pitch mix compound can push further than either alone
  return Math.max(0.70, Math.min(1.80, factor));
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
  // Additive positional components
  slotMultiplier: number;
  flyballBoost: number;
  hr9Contribution: number;
  protectionBoost: number;
  teamPowerBoost: number;
  bullpenAdjustment: number;
  /** Sum of all additive components above — the structural baseline */
  positionalFactor: number;

  // Platoon sub-factor (multiplicative — applied after positionalFactor)
  /** Batter platoon score as passed in ctx [-1, +1] */
  batPlatoonScore: number;
  /** Pitcher platoon score as passed in ctx [-1, +1] */
  pitPlatoonScore: number;
  /** Combined platoon edge = (batter_contribution + pitcher_contribution) / 2 */
  platoonEdge: number;
  /** 1 + platoon_edge × PLATOON_WEIGHT; the actual multiplier applied */
  platoonMultiplier: number;

  // Pitch mix sub-factor (multiplicative — applied after platoon)
  pitchMixVuln: number;

  /** positionalFactor × platoonMultiplier × pitchMixVuln, before clamping */
  rawFactor: number;
  /** Final output of calculateMatchupFactor */
  clampedFactor: number;
  label: string;
}

export function explainMatchupFactor(ctx: LineupContext): MatchupBreakdown {
  const slotMultiplier = LINEUP_SLOT_HR_MULTIPLIERS[ctx.lineup_slot] ?? 0.95;

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
    flyballBoost +
    hr9Contribution +
    protectionBoost +
    teamPowerBoost +
    bullpenAdjustment;

  const platoonEdge      = calculatePlatoonEdge(ctx);
  const platoonMultiplier = 1 + platoonEdge * PLATOON_WEIGHT;
  const pitchMixVuln     = calculatePitchMixVuln(ctx);
  const rawFactor        = positionalFactor * platoonMultiplier * pitchMixVuln;
  const clampedFactor    = Math.max(0.70, Math.min(1.80, rawFactor));

  return {
    slotMultiplier,
    flyballBoost,
    hr9Contribution,
    protectionBoost,
    teamPowerBoost,
    bullpenAdjustment,
    positionalFactor,
    batPlatoonScore:  ctx.batter_platoon_score,
    pitPlatoonScore:  ctx.pitcher_platoon_score,
    platoonEdge,
    platoonMultiplier,
    pitchMixVuln,
    rawFactor,
    clampedFactor,
    label: getMatchupLabel(clampedFactor),
  };
}
