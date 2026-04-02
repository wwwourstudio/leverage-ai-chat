/**
 * Expected Value (EV) Engine
 *
 * Converts sportsbook American odds + model probabilities into EV% bets.
 * The engine:
 *  1. Converts American odds → implied probability (with vig)
 *  2. Strips the vig using the no-vig (fair) line methodology
 *  3. Computes EV against a model probability
 *  4. Applies quarter-Kelly sizing
 *  5. Returns structured EVBet objects sortable by edge
 *
 * EV formula:
 *   EV = (modelProbability × decimalOdds) − 1
 *
 * A bet is +EV when the model assigns a higher probability than the
 * vig-adjusted implied probability embedded in the market price.
 */

import { kellyFraction } from '@/lib/kelly/index';

export interface EVBet {
  gameId: string;
  sport: string;
  matchup: string;
  market: string;
  outcome: string;
  bookmaker: string;
  americanOdds: number;
  decimalOdds: number;
  impliedProbability: number;      // Raw market-implied prob (includes vig)
  noVigProbability: number;        // Vig-stripped fair probability
  modelProbability: number;        // Our model's probability for this outcome
  ev: number;                      // e.g. 0.087 = 8.7% edge
  evPercent: string;               // formatted "8.7%"
  kellyFraction: number;           // full Kelly fraction
  quarterKelly: number;            // recommended 0.25× Kelly
  confidence: 'high' | 'medium' | 'low';
  capturedAt: Date;
}

export interface OddsSnapshotInput {
  gameId: string;
  sport: string;
  matchup: string;
  market: string;
  outcome: string;
  bookmaker: string;
  price: number;         // American odds
  capturedAt: Date;
}

export interface ModelPredictionInput {
  gameId: string;
  market: string;
  outcome: string;
  modelProbability: number;   // 0–1
}

// ─────────────────────────────────────────────────────────────────────────────
// Core conversion utilities
// ─────────────────────────────────────────────────────────────────────────────

// Re-exported from canonical odds-math module for backward compat (clv-tracker imports from here)
export {
  americanToDecimal,
  americanToImpliedProb as americanToImplied,
} from '@/lib/utils/odds-math';
import { americanToDecimal, americanToImpliedProb as americanToImplied } from '@/lib/utils/odds-math';

/**
 * Strip vig from a two-outcome market (e.g. moneyline, Over/Under).
 * Returns fair (no-vig) probabilities for each side.
 *
 * Method: divide each implied probability by the total overround.
 */
export function noVigProbabilities(
  oddsA: number,
  oddsB: number,
): { probA: number; probB: number; vig: number } {
  const implA = americanToImplied(oddsA);
  const implB = americanToImplied(oddsB);
  const overround = implA + implB;
  return {
    probA: implA / overround,
    probB: implB / overround,
    vig: overround - 1,
  };
}

/** EV = (modelProbability × decimalOdds) − 1 */
export function calculateEV(modelProbability: number, americanOdds: number): number {
  const decimal = americanToDecimal(americanOdds);
  return modelProbability * decimal - 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVBet builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a single EVBet from an odds snapshot + model prediction pair.
 * Returns null when there is no edge (EV ≤ 0) or invalid inputs.
 */
export function buildEVBet(
  snapshot: OddsSnapshotInput,
  modelProb: number,
  noVigProb: number,
): EVBet | null {
  if (modelProb <= 0 || modelProb >= 1) return null;
  if (!snapshot.price || !isFinite(snapshot.price)) return null;

  const decimalOdds = americanToDecimal(snapshot.price);
  const impliedProb = americanToImplied(snapshot.price);
  const ev = calculateEV(modelProb, snapshot.price);

  if (ev <= 0) return null;

  const kf = kellyFraction(modelProb, snapshot.price);
  const quarterKelly = kf * 0.25;

  const confidence: EVBet['confidence'] =
    ev >= 0.10 ? 'high'
    : ev >= 0.05 ? 'medium'
    : 'low';

  return {
    gameId: snapshot.gameId,
    sport: snapshot.sport,
    matchup: snapshot.matchup,
    market: snapshot.market,
    outcome: snapshot.outcome,
    bookmaker: snapshot.bookmaker,
    americanOdds: snapshot.price,
    decimalOdds: Math.round(decimalOdds * 1000) / 1000,
    impliedProbability: Math.round(impliedProb * 10000) / 10000,
    noVigProbability: Math.round(noVigProb * 10000) / 10000,
    modelProbability: Math.round(modelProb * 10000) / 10000,
    ev: Math.round(ev * 10000) / 10000,
    evPercent: `${(ev * 100).toFixed(1)}%`,
    kellyFraction: Math.round(kf * 10000) / 10000,
    quarterKelly: Math.round(quarterKelly * 10000) / 10000,
    confidence,
    capturedAt: snapshot.capturedAt,
  };
}

/**
 * Find all positive-EV bets by matching odds snapshots against model predictions.
 *
 * @param snapshots   - Latest odds from The Odds API (one per game/market/outcome/book)
 * @param predictions - Model predictions keyed by gameId+market+outcome
 * @param evThreshold - Minimum EV to include (default 0.05 = 5%)
 */
export function findPositiveEVBets(
  snapshots: OddsSnapshotInput[],
  predictions: ModelPredictionInput[],
  evThreshold = 0.05,
): EVBet[] {
  // Index predictions for O(1) lookup
  const predIndex = new Map<string, number>();
  for (const pred of predictions) {
    const key = `${pred.gameId}||${pred.market}||${pred.outcome}`;
    predIndex.set(key, pred.modelProbability);
  }

  // Group snapshots by game+market so we can compute no-vig probs
  type SnapKey = string;
  const marketGroups = new Map<SnapKey, OddsSnapshotInput[]>();
  for (const snap of snapshots) {
    const key = `${snap.gameId}||${snap.market}`;
    const group = marketGroups.get(key) ?? [];
    group.push(snap);
    marketGroups.set(key, group);
  }

  const evBets: EVBet[] = [];

  for (const snaps of marketGroups.values()) {
    // For two-outcome markets, compute vig-stripped probs
    let noVigMap: Map<string, number> | null = null;
    if (snaps.length === 2) {
      const { probA, probB } = noVigProbabilities(snaps[0].price, snaps[1].price);
      noVigMap = new Map([
        [snaps[0].outcome, probA],
        [snaps[1].outcome, probB],
      ]);
    }

    for (const snap of snaps) {
      const predKey = `${snap.gameId}||${snap.market}||${snap.outcome}`;
      const modelProb = predIndex.get(predKey);
      if (modelProb === undefined) continue;

      const noVigProb = noVigMap?.get(snap.outcome) ?? americanToImplied(snap.price);
      const bet = buildEVBet(snap, modelProb, noVigProb);
      if (bet && bet.ev >= evThreshold) {
        evBets.push(bet);
      }
    }
  }

  // Sort by EV descending
  return evBets.sort((a, b) => b.ev - a.ev);
}
