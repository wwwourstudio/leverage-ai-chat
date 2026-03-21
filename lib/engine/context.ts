/**
 * Context Engine — Layer 1
 *
 * Computes park and weather multipliers that scale into the HR probability
 * calculation after the matchup factor (Layer 0).
 *
 *   hrProb = baseRate × parkFactor × weatherFactor × matchupFactor
 *
 * Park factors are derived from multi-year Statcast HR-rate data per stadium,
 * normalized so that 1.0 = league-average HR environment.
 *
 * Weather factors model the physical effects of air density (temperature,
 * humidity, altitude) and wind (direction, speed) on batted-ball carry.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GameContext {
  /** Stadium slug matching stadiums.id in Supabase (e.g. "coors_field") */
  stadium: string;
  /** Fahrenheit */
  temperature: number;
  /** MPH */
  wind_speed: number;
  wind_direction: 'out' | 'in' | 'cross' | 'none';
  /** 0–100 */
  humidity: number;
}

// ─── Park factors ─────────────────────────────────────────────────────────────

/**
 * Stadium park factors (HR rate relative to league average = 1.0).
 * Source: Statcast 2021–2024 HR-rate data, home vs away split, averaged.
 *
 * Values above 1.0 boost HR probability; below 1.0 suppress.
 * Extreme parks: Coors (altitude + air density), Great American, Yankee Stadium.
 */
export const PARK_FACTORS: Record<string, number> = {
  coors_field:              1.30,  // High altitude — thinnest air in MLB
  great_american_ball_park: 1.22,  // Small dimensions, good HR environment
  yankee_stadium:           1.18,  // Short porch in RF, warm summers
  american_family_field:    1.16,  // Retractable roof, hitter-friendly
  fenway_park:              1.10,  // Green Monster forces pull hitters
  globe_life_field:         1.08,  // Warm Texas; indoor = no wind suppression
  oracle_park:              0.88,  // Marine layer + large dimensions
  petco_park:               0.87,  // Spacious; marine layer influence
  tropicana_field:          0.89,  // Dome but suppressive dimensions
  kauffman_stadium:         0.91,  // Large outfield; suppressive
  dodger_stadium:           1.02,  // Slight pitcher-friendly historically
  t_mobile_park:            0.90,  // Large park, marine layer
  pnc_park:                 0.92,  // Spacious
  wrigley_field:            1.05,  // Wind-dependent; neutral when calm
  busch_stadium:            0.97,  // Slightly pitcher-friendly
  camden_yards:             1.05,  // Hitter-friendly dimensions
  target_field:             0.98,  // Cold springs, neutral
  chase_field:              1.08,  // Retractable roof, heat when open
  loanDepot_park:           0.95,  // Humid but large
  truist_park:              1.04,
  citizens_bank_park:       1.12,  // Short dimensions, hitter-friendly
  progressive_field:        0.98,
  guaranteed_rate_field:    1.07,
  angel_stadium:            1.00,
  minute_maid_park:         1.10,  // Heat + Crawford boxes
  rogers_centre:            1.05,
  comerica_park:            0.93,  // Large; historically suppressive
  nationals_park:           1.02,
  american_league:          1.00,  // fallback
};

/**
 * Get the park factor for a given stadium slug.
 * Returns 1.0 (neutral) for unknown stadiums.
 */
export function getParkFactor(stadiumId: string): number {
  return PARK_FACTORS[stadiumId.toLowerCase()] ?? 1.0;
}

// ─── Weather factor ───────────────────────────────────────────────────────────

/**
 * Compute a weather multiplier on HR probability.
 *
 * Physics basis:
 *   - Air density decreases with temperature → higher temps → more carry
 *   - Wind blowing out adds direct carry; in suppresses; cross is neutral
 *   - Humidity slightly decreases air density (humid air is less dense than dry)
 *
 * All adjustments are small (<15% each) and multiplicative.
 * Total range: roughly [0.88, 1.20] in realistic conditions.
 */
export function getWeatherFactor(ctx: GameContext): number {
  let factor = 1.0;

  // ── Temperature ────────────────────────────────────────────────────────────
  // Baseline: 72°F (typical comfortable game day)
  // Research: ~1% carry increase per 10°F above baseline
  if (ctx.temperature >= 95) {
    factor += 0.08;       // Very hot: significant air density drop
  } else if (ctx.temperature >= 85) {
    factor += 0.05;       // Warm
  } else if (ctx.temperature >= 75) {
    factor += 0.02;
  } else if (ctx.temperature <= 50) {
    factor -= 0.06;       // Cold: denser air, less carry
  } else if (ctx.temperature <= 60) {
    factor -= 0.03;
  }

  // ── Wind ───────────────────────────────────────────────────────────────────
  // Wind speed thresholds: <5 mph negligible, 5-15 moderate, 15+ significant
  const windMph = ctx.wind_speed;

  if (ctx.wind_direction === 'out') {
    if (windMph >= 15) factor += 0.10;
    else if (windMph >= 10) factor += 0.06;
    else if (windMph >= 5)  factor += 0.03;
  } else if (ctx.wind_direction === 'in') {
    if (windMph >= 15) factor -= 0.10;
    else if (windMph >= 10) factor -= 0.06;
    else if (windMph >= 5)  factor -= 0.03;
  }
  // 'cross' and 'none': negligible net HR effect

  // ── Humidity (small effect) ─────────────────────────────────────────────────
  // Humid air is ~0.2% less dense per 10% RH increase — very subtle
  if (ctx.humidity >= 80) factor += 0.01;
  else if (ctx.humidity <= 20) factor -= 0.01;

  return Math.max(0.80, Math.min(1.25, factor));
}
