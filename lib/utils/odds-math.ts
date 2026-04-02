/**
 * Canonical Odds Math Utilities
 *
 * Single source of truth for all odds conversion and arbitrage ROI math.
 * Previously duplicated 13+ times across the codebase.
 *
 * Rules:
 *  - American positive odds  e.g. +150: bet 100 to win 150
 *  - American negative odds  e.g. -110: bet 110 to win 100
 *  - Decimal odds           e.g.  2.50: return per unit staked (profit + stake)
 *  - Implied probability    e.g.  0.40: bookmaker's no-vig probability estimate
 */

/**
 * Convert American odds to implied probability (0–1).
 * Does NOT remove the vig — this is the raw bookmaker-implied probability.
 */
export function americanToImpliedProb(odds: number): number {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

/**
 * Convert American odds to decimal odds (stake-inclusive return per unit).
 */
export function americanToDecimal(odds: number): number {
  if (odds > 0) return odds / 100 + 1;
  return 100 / Math.abs(odds) + 1;
}

/**
 * Convert decimal odds to American odds.
 */
export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

/**
 * Calculate the net win amount for a given stake at American odds.
 * Does not include the returned stake.
 */
export function americanOddsWin(odds: number, stake: number): number {
  if (odds >= 0) return stake * (odds / 100);
  return stake * (100 / Math.abs(odds));
}

/**
 * Calculate the total payout (win + stake) for a given stake at American odds.
 */
export function americanOddsPayout(odds: number, stake: number): number {
  return stake + americanOddsWin(odds, stake);
}

/**
 * Calculate the profit margin (ROI) for an arbitrage across N outcomes.
 * A positive return means an arb exists.
 * @param impliedProbs - Implied probabilities of each outcome (0–1)
 */
export function calcArbitrageROI(impliedProbs: number[]): number {
  const total = impliedProbs.reduce((sum, p) => sum + p, 0);
  return 1 - total;
}

/**
 * Detect whether a set of implied probabilities forms an arbitrage opportunity.
 * Returns true if total implied probability is strictly below 1.
 */
export function isArbitrage(impliedProbs: number[]): boolean {
  return calcArbitrageROI(impliedProbs) > 0;
}
