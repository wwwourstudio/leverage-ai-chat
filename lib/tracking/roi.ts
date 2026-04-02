/**
 * ROI Engine
 *
 * Calculates return on investment and P&L for a set of settled pick_results rows.
 * Supports both flat-unit ($100) and Kelly-sized bet sizing.
 *
 * American odds convention:
 *   Positive (+145): bet $100 to win $145 → return = stake + 145
 *   Negative (-110): bet $110 to win $100 → return = stake + stake * (100 / 110)
 */

import { americanOddsWin, americanOddsPayout } from '@/lib/utils/odds-math';

export interface PickResultRow {
  predicted_prob: number;
  actual_result: boolean | null;
  odds?: number | null;       // American odds
  kelly_stake?: number | null; // fraction of bankroll (e.g. 0.025)
  tier?: string | null;
}

export interface ROIResult {
  sampleSize: number;
  settledCount: number;
  totalBet: number;
  totalReturn: number;
  profit: number;
  roi: number;              // (totalReturn - totalBet) / totalBet
  winRate: number;
  avgOdds: number | null;   // average American odds on winning bets
}

export interface KellyROIResult extends ROIResult {
  startingBankroll: number;
  endingBankroll: number;
  bankrollGrowth: number;   // (ending - starting) / starting
}

/**
 * Flat-unit ROI ($100 per bet).
 * Falls back to even-money (+100) when odds are missing.
 */
export function calculateROI(results: PickResultRow[]): ROIResult {
  const settled = results.filter(
    (r) => r.actual_result !== null && r.actual_result !== undefined,
  );

  if (settled.length === 0) {
    return {
      sampleSize: results.length,
      settledCount: 0,
      totalBet: 0,
      totalReturn: 0,
      profit: 0,
      roi: 0,
      winRate: 0,
      avgOdds: null,
    };
  }

  const UNIT = 100;
  let totalBet = 0;
  let totalReturn = 0;
  let wins = 0;
  let oddsSum = 0;
  let oddsCount = 0;

  for (const r of settled) {
    totalBet += UNIT;

    if (r.actual_result === true) {
      wins++;
      const payout = americanOddsPayout(r.odds ?? 100, UNIT);
      totalReturn += payout;

      if (r.odds !== null && r.odds !== undefined) {
        oddsSum += r.odds;
        oddsCount++;
      }
    }
    // Loss: return 0 (stake already deducted)
  }

  const profit = totalReturn - totalBet;
  const roi = totalBet > 0 ? profit / totalBet : 0;

  return {
    sampleSize: results.length,
    settledCount: settled.length,
    totalBet: parseFloat(totalBet.toFixed(2)),
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    profit: parseFloat(profit.toFixed(2)),
    roi: parseFloat(roi.toFixed(4)),
    winRate: parseFloat((wins / settled.length).toFixed(4)),
    avgOdds: oddsCount > 0 ? parseFloat((oddsSum / oddsCount).toFixed(1)) : null,
  };
}

/**
 * Kelly-sized ROI.
 * Uses the kelly_stake fraction stored on each row to size the bet against
 * a starting bankroll.
 */
export function calculateKellyROI(
  results: PickResultRow[],
  startingBankroll = 10_000,
): KellyROIResult {
  const settled = results.filter(
    (r) => r.actual_result !== null && r.actual_result !== undefined,
  );

  let bankroll = startingBankroll;
  let totalBet = 0;
  let totalReturn = 0;
  let wins = 0;
  let oddsSum = 0;
  let oddsCount = 0;

  for (const r of settled) {
    const fraction = Math.max(0, Math.min(0.25, r.kelly_stake ?? 0.02)); // cap at 25%
    const stake = bankroll * fraction;
    totalBet += stake;

    if (r.actual_result === true) {
      wins++;
      const winAmount = americanOddsWin(r.odds ?? 100, stake);
      totalReturn += stake + winAmount;
      bankroll += winAmount;

      if (r.odds !== null && r.odds !== undefined) {
        oddsSum += r.odds;
        oddsCount++;
      }
    } else {
      bankroll -= stake;
    }
  }

  const profit = totalReturn - totalBet;
  const roi = totalBet > 0 ? profit / totalBet : 0;

  return {
    sampleSize: results.length,
    settledCount: settled.length,
    totalBet: parseFloat(totalBet.toFixed(2)),
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    profit: parseFloat(profit.toFixed(2)),
    roi: parseFloat(roi.toFixed(4)),
    winRate: settled.length > 0 ? parseFloat((wins / settled.length).toFixed(4)) : 0,
    avgOdds: oddsCount > 0 ? parseFloat((oddsSum / oddsCount).toFixed(1)) : null,
    startingBankroll,
    endingBankroll: parseFloat(bankroll.toFixed(2)),
    bankrollGrowth: parseFloat(((bankroll - startingBankroll) / startingBankroll).toFixed(4)),
  };
}

/**
 * Compute expected value per $1 wagered for a pick.
 * EV = (model_prob × win_amount) - ((1 - model_prob) × stake)
 */
export function computeExpectedValue(
  modelProb: number,
  americanOdds: number,
  stake = 1,
): number {
  const winAmount = americanOddsWin(americanOdds, stake);
  return modelProb * winAmount - (1 - modelProb) * stake;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

