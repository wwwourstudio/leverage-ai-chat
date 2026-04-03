/**
 * Edge Scorer
 *
 * Converts a fully-computed HRPrediction into an actionable trading decision
 * with explicit edge quantification, EV calculation, Kelly sizing, and tier
 * classification — including matchup-aware fade signals.
 *
 * ─── Edge taxonomy ────────────────────────────────────────────────────────────
 *   Raw edge    = calibratedProb − marketImplied
 *   Adjusted edge = rawEdge × matchupFactor × (1 + sharpBoost)
 *   EV          = (edge × decimalOdds − 1) per unit bet
 *
 * Matchup factor modulates edge in both directions:
 *   • Great matchup (factor > 1.25) amplifies a thin raw edge into STRONG/ELITE
 *   • Bad matchup (factor < 0.90) can push a slightly positive raw edge to PASS
 *   • This prevents over-betting on players with raw model edge but terrible context
 *
 * ─── Fade signal ──────────────────────────────────────────────────────────────
 * A FADE fires when:
 *   a) matchupFactor < 0.92  AND
 *   b) marketMovePts < −0.05 (market already fading the player)
 * This is the highest-conviction UNDER signal — model AND market aligned.
 *
 * ─── Output tiers ─────────────────────────────────────────────────────────────
 *   ELITE   — adjusted edge ≥ 7% or (≥5% AND matchup ≥ 1.25 AND has sharp)
 *   STRONG  — adjusted edge ≥ 4% or (≥3% AND matchup ≥ 1.15)
 *   LEAN    — adjusted edge ≥ 2%
 *   FADE    — matchup-aware UNDER signal (negative edge + bad matchup + market fade)
 *   PASS    — insufficient edge or no market data
 */

import type { HRPrediction } from './predictPlayerHR';
import { isFadeSignal } from './matchup';
import { calculateKelly } from './runTradingEngine';
import { americanToDecimal } from '@/lib/utils/odds-math';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EdgeTier = 'ELITE' | 'STRONG' | 'LEAN' | 'FADE' | 'PASS';

export interface EdgeScore {
  // ── Core metrics ────────────────────────────────────────────────────────────
  /** Model probability after calibration + matchup scaling */
  modelProb: number;
  /** Market implied probability (vig-removed) */
  marketProb: number;
  /** Raw edge: modelProb − marketProb */
  rawEdge: number;
  /**
   * Adjusted edge: rawEdge × matchupFactor × (1 + sharpBoost).
   * This is the edge used for tier classification — context-weighted.
   */
  adjustedEdge: number;

  // ── EV calculation ──────────────────────────────────────────────────────────
  /** Decimal odds at best book (null if no market) */
  decimalOdds: number | null;
  /**
   * Expected value per unit wagered.
   * EV = (modelProb × decimalOdds) − 1
   * Positive EV → profitable long-run bet.
   */
  expectedValue: number | null;

  // ── Kelly sizing ────────────────────────────────────────────────────────────
  /** Full Kelly fraction (fraction of bankroll) */
  kellyFull: number;
  /** Half-Kelly (recommended — reduces variance significantly) */
  kellyHalf: number;
  /**
   * Matchup-adjusted Kelly: kellyHalf × min(matchupFactor, 1.20)
   * Caps the matchup boost to 20% on Kelly sizing to prevent over-leveraging.
   */
  kellyMatchupAdjusted: number;

  // ── Classification ──────────────────────────────────────────────────────────
  tier: EdgeTier;
  /** Human-readable explanation of the tier classification */
  tierReason: string;

  // ── Fade signal ─────────────────────────────────────────────────────────────
  isFade: boolean;
  /** Present when isFade=true; explains fade rationale */
  fadeReason: string | null;

  // ── Context amplifiers ──────────────────────────────────────────────────────
  matchupFactor: number;
  matchupLabel: string;
  sharpBoost: number;
  /** Combined amplifier = matchupFactor × (1 + sharpBoost) */
  totalAmplifier: number;

  // ── Risk flags ──────────────────────────────────────────────────────────────
  flags: EdgeFlag[];

  computedAt: string;
}

export interface EdgeFlag {
  code: string;
  severity: 'warning' | 'info';
  message: string;
}

// ─── American / decimal odds helpers ──────────────────────────────────────────


function decimalToImpliedProb(decOdds: number, overround = 1.065): number {
  return (1 / decOdds) / overround;
}

// ─── Tier classification ──────────────────────────────────────────────────────

function classifyTier(
  adjustedEdge: number,
  matchupFactor: number,
  hasSharp: boolean,
  isFade: boolean,
): { tier: EdgeTier; reason: string } {
  if (isFade) {
    return {
      tier: 'FADE',
      reason: 'Bad matchup AND market fading — high-confidence UNDER signal',
    };
  }

  if (adjustedEdge < 0) {
    return { tier: 'PASS', reason: 'Negative adjusted edge — no bet' };
  }

  // ELITE: either very large edge, or strong edge amplified by great matchup + sharp
  if (adjustedEdge >= 0.07 || (adjustedEdge >= 0.05 && matchupFactor >= 1.25 && hasSharp)) {
    return {
      tier: 'ELITE',
      reason: adjustedEdge >= 0.07
        ? `Adjusted edge ${(adjustedEdge * 100).toFixed(1)}% exceeds ELITE threshold`
        : `Edge ${(adjustedEdge * 100).toFixed(1)}% amplified by elite matchup (×${matchupFactor.toFixed(2)}) + sharp confirmation`,
    };
  }

  // STRONG
  if (adjustedEdge >= 0.04 || (adjustedEdge >= 0.03 && matchupFactor >= 1.15)) {
    return {
      tier: 'STRONG',
      reason: matchupFactor >= 1.15
        ? `Edge ${(adjustedEdge * 100).toFixed(1)}% with favorable matchup ×${matchupFactor.toFixed(2)}`
        : `Adjusted edge ${(adjustedEdge * 100).toFixed(1)}% — standalone STRONG signal`,
    };
  }

  // LEAN
  if (adjustedEdge >= 0.02) {
    return {
      tier: 'LEAN',
      reason: `Thin edge ${(adjustedEdge * 100).toFixed(1)}% — monitor for sharp confirmation`,
    };
  }

  return { tier: 'PASS', reason: `Edge ${(adjustedEdge * 100).toFixed(1)}% below minimum threshold` };
}

// ─── Risk flag generation ─────────────────────────────────────────────────────

function buildFlags(
  prediction: HRPrediction,
  rawEdge: number,
  adjustedEdge: number,
): EdgeFlag[] {
  const flags: EdgeFlag[] = [];
  const { layers, signal } = prediction;

  // Low sample size warning (PA < 100 — Bayesian shrinkage applied but still uncertain)
  // We don't have PA in HRPrediction directly, but barrel < 5% at low confidence is a proxy
  if (layers.rawLogitInputs.barrelPct < 5) {
    flags.push({
      code: 'LOW_BARREL',
      severity: 'warning',
      message: `Barrel rate ${layers.rawLogitInputs.barrelPct.toFixed(1)}% — well below elite (12%+); model less reliable`,
    });
  }

  // Matchup amplifying thin raw edge — could be false positive
  if (rawEdge < 0.02 && adjustedEdge >= 0.04) {
    flags.push({
      code: 'MATCHUP_AMPLIFIED_THIN_EDGE',
      severity: 'warning',
      message: `Raw edge only ${(rawEdge * 100).toFixed(1)}% — matchup amplifying to ${(adjustedEdge * 100).toFixed(1)}%; verify matchup data freshness`,
    });
  }

  // No live market — sizing is theoretical
  if (!signal.sources.marketOddsUsed) {
    flags.push({
      code: 'NO_LIVE_MARKET',
      severity: 'warning',
      message: 'No live market odds available — edge and Kelly sizing are theoretical',
    });
  }

  // Calibration not applied
  if (!signal.sources.calibrationApplied) {
    flags.push({
      code: 'NO_CALIBRATION',
      severity: 'info',
      message: 'Running with default weights — Platt calibration not yet available (need ≥5 settled picks)',
    });
  }

  // Very high park factor without matchup support
  if (layers.parkFactor > 1.15 && layers.matchupFactor < 1.0) {
    flags.push({
      code: 'PARK_BOOST_WITH_BAD_MATCHUP',
      severity: 'warning',
      message: `Park factor ${layers.parkFactor.toFixed(2)} (${prediction.venue}) boosting a unfavorable matchup — park edge may not materialise`,
    });
  }

  // Sharp boost without confirmed sharp signal (just public volume)
  if (signal.sharpBoost > 0 && !signal.sources.sharpSignalUsed) {
    flags.push({
      code: 'UNCONFIRMED_SHARP_BOOST',
      severity: 'info',
      message: 'Sharp boost from public-side volume — await confirmation before increasing size',
    });
  }

  return flags;
}

// ─── Main scorer ──────────────────────────────────────────────────────────────

/**
 * Compute a full EdgeScore from a completed HRPrediction.
 *
 * This is the final step in the pipeline — call it after predictPlayerHR()
 * to get the trading decision with Kelly sizing and tier.
 *
 * @example
 * ```ts
 * const prediction = await predictPlayerHR(input);
 * const score      = scoreEdge(prediction, 10_000); // $10k bankroll
 *
 * if (score.tier === 'ELITE') {
 *   const stake = score.kellyMatchupAdjusted * 10_000;
 *   console.log(`Bet $${stake.toFixed(0)} on ${prediction.playerName} HR`);
 * }
 * if (score.tier === 'FADE') {
 *   console.log(`Fade ${prediction.playerName} — ${score.fadeReason}`);
 * }
 * ```
 */
export function scoreEdge(
  prediction: HRPrediction,
  bankroll: number,
  /** Implied probability movement in the last 2 hours (+ve = market inflating, -ve = fading) */
  recentMarketMovePts = 0,
): EdgeScore {
  const { signal, layers } = prediction;

  // ── Core probabilities ─────────────────────────────────────────────────────
  const modelProb  = signal.calibratedProb;    // Platt-scaled
  const marketProb = signal.marketProb;        // vig-removed
  const rawEdge    = signal.edge;              // calibratedProb − marketProb

  // ── Matchup-amplified edge ─────────────────────────────────────────────────
  const matchupFactor = layers.matchupFactor;
  const sharpBoost    = signal.sharpBoost;
  const totalAmplifier = matchupFactor * (1 + sharpBoost);

  // Adjusted edge applies matchup factor and sharp boost to the raw edge.
  // Negative raw edge stays negative (matchup cannot manufacture edge).
  const adjustedEdge = rawEdge > 0
    ? rawEdge * totalAmplifier
    : rawEdge * (1 / totalAmplifier);  // bad matchup deepens negative edge

  // ── EV calculation ─────────────────────────────────────────────────────────
  const bestAmericanOdds = prediction.signal.marketProb > 0
    ? null  // will compute from marketProb
    : null;

  // Convert marketProb back to decimal odds (inverse of vig-removed prob)
  const decimalOdds = marketProb > 0 ? 1 / (marketProb * 1.065) : null;
  const expectedValue = decimalOdds !== null
    ? modelProb * decimalOdds - 1
    : null;

  // ── Kelly sizing ───────────────────────────────────────────────────────────
  let kellyFull = 0;
  let kellyHalf = 0;
  let kellyMatchupAdjusted = 0;

  if (decimalOdds !== null && bankroll > 0) {
    const kellyResult = calculateKelly({
      probability: modelProb,
      decimalOdds,
      bankroll,
      fraction: 0.5,
    });
    kellyFull = kellyResult.fullKellyStake / bankroll;
    kellyHalf = kellyResult.fractionalKellyStake / bankroll;

    // Matchup-adjusted Kelly: cap matchup boost at +20% to prevent over-leverage
    const matchupKellyMult = Math.min(matchupFactor, 1.20);
    kellyMatchupAdjusted = Math.min(kellyHalf * matchupKellyMult, 0.25);
  }

  // ── Fade signal ────────────────────────────────────────────────────────────
  const fade = isFadeSignal(matchupFactor, recentMarketMovePts);
  let fadeReason: string | null = null;
  if (fade) {
    fadeReason =
      `Matchup factor ${matchupFactor.toFixed(2)} (${prediction.layers.matchupBreakdown.label}) ` +
      `+ market fading ${(recentMarketMovePts * 100).toFixed(1)}pp — ` +
      `UNDER signal on ${prediction.playerName} HR`;
  }

  // ── Tier ───────────────────────────────────────────────────────────────────
  const { tier, reason: tierReason } = classifyTier(
    adjustedEdge,
    matchupFactor,
    signal.sharpContext.hasSharpSignal,
    fade,
  );

  // ── Risk flags ─────────────────────────────────────────────────────────────
  const flags = buildFlags(prediction, rawEdge, adjustedEdge);

  return {
    modelProb,
    marketProb,
    rawEdge,
    adjustedEdge,
    decimalOdds,
    expectedValue,
    kellyFull,
    kellyHalf,
    kellyMatchupAdjusted,
    tier,
    tierReason,
    isFade: fade,
    fadeReason,
    matchupFactor,
    matchupLabel: prediction.layers.matchupBreakdown.label,
    sharpBoost,
    totalAmplifier,
    flags,
    computedAt: new Date().toISOString(),
  };
}

// ─── Slate scoring ────────────────────────────────────────────────────────────

export interface SlatePick {
  prediction: HRPrediction;
  edgeScore: EdgeScore;
}

/**
 * Score an entire sorted prediction slate and return only actionable picks.
 * Fades are included (tier === 'FADE') as actionable UNDER signals.
 *
 * @param predictions       Output of predictSlate()
 * @param bankroll          Total available bankroll
 * @param recentMovePts     Market movement map: playerName → implied prob shift
 */
export function scoreSlate(
  predictions: HRPrediction[],
  bankroll: number,
  recentMovePts: Record<string, number> = {},
): SlatePick[] {
  return predictions
    .map(pred => ({
      prediction: pred,
      edgeScore:  scoreEdge(pred, bankroll, recentMovePts[pred.playerName] ?? 0),
    }))
    .filter(p => p.edgeScore.tier !== 'PASS')
    .sort((a, b) => {
      // Sort: ELITE → FADE → STRONG → LEAN, then by adjustedEdge within tier
      const tierOrder: Record<EdgeTier, number> = { ELITE: 0, FADE: 1, STRONG: 2, LEAN: 3, PASS: 99 };
      const tierDiff = tierOrder[a.edgeScore.tier] - tierOrder[b.edgeScore.tier];
      if (tierDiff !== 0) return tierDiff;
      return Math.abs(b.edgeScore.adjustedEdge) - Math.abs(a.edgeScore.adjustedEdge);
    });
}

// ─── Portfolio capital allocator ──────────────────────────────────────────────

export interface AllocationPlan {
  picks: Array<{
    playerName: string;
    tier: EdgeTier;
    adjustedEdge: number;
    /** Recommended dollar stake */
    dollarStake: number;
    kellyFraction: number;
  }>;
  totalAllocated: number;
  remainingBankroll: number;
  /** True if total allocation exceeds 15% of bankroll (over-concentration warning) */
  isOverConcentrated: boolean;
}

/**
 * Allocate capital across a scored slate using matchup-adjusted Kelly fractions.
 * Total allocation is capped at 15% of bankroll to prevent over-concentration.
 */
export function allocateCapital(slate: SlatePick[], bankroll: number): AllocationPlan {
  const MAX_TOTAL_PCT = 0.15;  // Max 15% of bankroll on HR props
  const MAX_SINGLE_PCT = 0.05; // Max 5% of bankroll on any one player

  const actionable = slate.filter(p => p.edgeScore.tier !== 'FADE' && p.edgeScore.tier !== 'PASS');

  const rawAllocations = actionable.map(p => ({
    playerName:    p.prediction.playerName,
    tier:          p.edgeScore.tier,
    adjustedEdge:  p.edgeScore.adjustedEdge,
    rawFraction:   Math.min(p.edgeScore.kellyMatchupAdjusted, MAX_SINGLE_PCT),
    dollarStake:   0,
    kellyFraction: 0,
  }));

  // Scale down if total exceeds MAX_TOTAL_PCT
  const rawTotal = rawAllocations.reduce((s, a) => s + a.rawFraction, 0);
  const scaleFactor = rawTotal > MAX_TOTAL_PCT ? MAX_TOTAL_PCT / rawTotal : 1.0;

  let totalAllocated = 0;

  const picks = rawAllocations.map(a => {
    const fraction = a.rawFraction * scaleFactor;
    const stake    = fraction * bankroll;
    totalAllocated += stake;
    return {
      playerName:    a.playerName,
      tier:          a.tier,
      adjustedEdge:  a.adjustedEdge,
      dollarStake:   Math.round(stake * 100) / 100,
      kellyFraction: fraction,
    };
  });

  return {
    picks,
    totalAllocated: Math.round(totalAllocated * 100) / 100,
    remainingBankroll: bankroll - totalAllocated,
    isOverConcentrated: totalAllocated / bankroll > MAX_TOTAL_PCT * 1.1,
  };
}
