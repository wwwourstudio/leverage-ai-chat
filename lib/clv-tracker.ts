/**
 * Closing Line Value (CLV) Tracker
 *
 * Measures whether a bet was placed at a price better than the closing line.
 * Beating the closing line is the gold standard for demonstrating long-term
 * model edge — if you consistently beat the close, you are identifying value
 * before the market does.
 *
 * CLV = betPrice − closingPrice  (in American odds points)
 * Positive CLV = you got a better number than the closing market.
 *
 * Example:
 *   Bet placed at +175  (implied 36.4%)
 *   Closing line  +150  (implied 40.0%)
 *   CLV = +25 cents — beat the close ✓
 */

import { createClient as createServerClient } from '@/lib/supabase/server';
import { americanToImplied } from '@/lib/ev-engine';

export interface BetRecord {
  gameId: string;
  market: string;
  outcome: string;
  /** American odds when the bet was placed */
  betPrice: number;
  placedAt: Date;
  /** Optional: which bookmaker the bet was taken at */
  bookmaker?: string;
}

export interface CLVResult {
  betPrice: number;
  closingPrice: number;
  /** Raw American-odds delta (positive = beat the close) */
  clv: number;
  /** CLV expressed as an implied-probability delta */
  clvProbDelta: number;
  verdict: 'beat close' | 'at close' | 'missed close';
}

export interface CLVSummary {
  totalBets: number;
  beatingClose: number;
  beatCloseRate: number;          // fraction 0–1
  avgCLV: number;                 // average American-odds delta
  avgCLVProbDelta: number;        // average implied-prob delta
  /** Annualised ROI estimate based on CLV performance */
  estimatedROI: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Closing line persistence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert a closing line record.
 * Call this from the cron worker once a game's commence_time has passed.
 */
export async function recordClosingLine(
  gameId: string,
  market: string,
  outcome: string,
  price: number,
  bookmaker = 'consensus',
): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('closing_lines')
    .upsert(
      {
        game_id: gameId,
        market,
        outcome,
        closing_price: price,
        bookmaker,
        captured_at: new Date().toISOString(),
      },
      { onConflict: 'game_id,market,outcome,bookmaker' },
    );

  if (error) {
    console.error('[v0] [CLV] Failed to record closing line:', { gameId, market, outcome, error });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLV calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute CLV for a single bet by looking up the closing line from Supabase.
 * Returns null if no closing line has been stored yet (game not yet started).
 */
export async function computeCLV(bet: BetRecord): Promise<CLVResult | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('closing_lines')
    .select('closing_price')
    .eq('game_id', bet.gameId)
    .eq('market', bet.market)
    .eq('outcome', bet.outcome)
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const closingPrice: number = data.closing_price;
  const clv = bet.betPrice - closingPrice;
  const clvProbDelta =
    Math.round((americanToImplied(closingPrice) - americanToImplied(bet.betPrice)) * 10000) / 10000;

  const verdict: CLVResult['verdict'] =
    clv > 2    ? 'beat close'
    : clv < -2  ? 'missed close'
    : 'at close';

  return {
    betPrice: bet.betPrice,
    closingPrice,
    clv,
    clvProbDelta,
    verdict,
  };
}

/**
 * Compute CLV for an array of bets and return a performance summary.
 * Bets without a closing line on record are silently skipped.
 */
export async function computeCLVSummary(bets: BetRecord[]): Promise<CLVSummary> {
  const results = await Promise.all(bets.map(computeCLV));
  const resolved = results.filter((r): r is CLVResult => r !== null);

  if (resolved.length === 0) {
    return {
      totalBets: 0,
      beatingClose: 0,
      beatCloseRate: 0,
      avgCLV: 0,
      avgCLVProbDelta: 0,
      estimatedROI: 0,
    };
  }

  const beatingClose = resolved.filter(r => r.verdict === 'beat close').length;
  const avgCLV = resolved.reduce((s, r) => s + r.clv, 0) / resolved.length;
  const avgCLVProbDelta = resolved.reduce((s, r) => s + r.clvProbDelta, 0) / resolved.length;

  // Rough ROI estimate: every 1% CLV prob delta ≈ 1% ROI at 100% Kelly
  // At 25% Kelly, scale accordingly
  const estimatedROI = Math.round(avgCLVProbDelta * 100 * 0.25 * 100) / 100;

  return {
    totalBets: resolved.length,
    beatingClose,
    beatCloseRate: Math.round((beatingClose / resolved.length) * 10000) / 10000,
    avgCLV: Math.round(avgCLV * 10) / 10,
    avgCLVProbDelta: Math.round(avgCLVProbDelta * 10000) / 10000,
    estimatedROI,
  };
}
