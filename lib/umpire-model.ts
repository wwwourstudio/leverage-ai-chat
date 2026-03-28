/**
 * Umpire Strike Zone Model
 *
 * Quantifies how a home-plate umpire's tendencies deviate from league average
 * and translates those deviations into expected adjustments on:
 *  - strikeout (K) props
 *  - walk (BB) props
 *  - game scoring environment
 *
 * Data source: Statcast umpire scorecard data (callled strike rate, zone metrics)
 * Primary reference: UmpScorecards.com methodology
 */

export interface UmpireInput {
  /**
   * Fraction of pitches in the theoretical zone called as strikes by this umpire.
   * League average ≈ 0.315
   */
  calledStrikeRateUmpire: number;
  /**
   * League-average called strike rate for normalisation.
   * Default: 0.315
   */
  leagueAvgCalledStrikeRate?: number;
  /**
   * Umpire's strike zone size relative to league average.
   * 1.0 = exactly average; > 1.0 = larger zone (pitcher-friendly).
   * Source: sq_inches relative to 482 sq in league avg.
   */
  strikeZoneSizeRelative: number;
}

export interface UmpireResult {
  strikeZoneBias: 'tight' | 'normal' | 'wide';
  /**
   * Expected delta on a pitcher's K prop as a fraction.
   * e.g. +0.12 = pitcher K line should be ~12% higher than baseline.
   */
  koPropImpact: number;
  /**
   * Expected delta on pitcher walk prop.
   * e.g. -0.15 = fewer walks expected (pitcher-friendly zone).
   */
  walkPropImpact: number;
  /**
   * Expected runs adjustment on game total.
   * Wide zones suppress offence; tight zones help batters.
   */
  scoringEnvImpact: number;
  signal: string;
}

const DEFAULT_LEAGUE_AVG_CSR = 0.315;

export function computeUmpireImpact(input: UmpireInput): UmpireResult {
  const {
    calledStrikeRateUmpire,
    leagueAvgCalledStrikeRate = DEFAULT_LEAGUE_AVG_CSR,
    strikeZoneSizeRelative,
  } = input;

  // ── Called strike rate delta ───────────────────────────────────────────────
  const csrDelta = calledStrikeRateUmpire - leagueAvgCalledStrikeRate;

  // ── Zone size delta (relative) ─────────────────────────────────────────────
  const zoneDelta = strikeZoneSizeRelative - 1.0;

  // ── Composite bias score ───────────────────────────────────────────────────
  // Average the two signals (both proxy the same underlying tendency)
  const biasSignal = csrDelta * 5 + zoneDelta;  // scale CSR delta to same range as zone delta

  const strikeZoneBias: UmpireResult['strikeZoneBias'] =
    biasSignal >=  0.06 ? 'wide'
    : biasSignal <= -0.06 ? 'tight'
    : 'normal';

  // ── K prop impact ─────────────────────────────────────────────────────────
  // Each +0.01 CSR above avg ≈ +3% expected strikeouts
  const koPropImpact = Math.round(csrDelta * 3 * 100) / 100;

  // ── Walk prop impact ──────────────────────────────────────────────────────
  // Wider zone → fewer walks; tight zone → more walks
  const walkPropImpact = Math.round(-csrDelta * 2 * 100) / 100;

  // ── Scoring env impact (runs) ─────────────────────────────────────────────
  // Tight zone: more pitches → more PA → slightly more offence
  const scoringEnvImpact =
    strikeZoneBias === 'tight'  ?  0.35
    : strikeZoneBias === 'wide' ? -0.20
    : 0.0;

  // ── Signal string ─────────────────────────────────────────────────────────
  const csrStr = csrDelta >= 0 ? `+${(csrDelta * 100).toFixed(1)}%` : `${(csrDelta * 100).toFixed(1)}%`;

  let signal: string;
  if (strikeZoneBias === 'wide') {
    signal = `Wide zone (CSR ${csrStr} vs avg, zone ${(strikeZoneSizeRelative * 100 - 100).toFixed(0)}% larger) — lean Over on K props, Under on walk props`;
  } else if (strikeZoneBias === 'tight') {
    signal = `Tight zone (CSR ${csrStr} vs avg) — lean Under on K props, batter-friendly environment`;
  } else {
    signal = `Average strike zone — no significant umpire adjustment`;
  }

  return { strikeZoneBias, koPropImpact, walkPropImpact, scoringEnvImpact, signal };
}
