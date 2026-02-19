/**
 * Unified Trading Engine Controller
 * Orchestrates all trading analysis modules.
 *
 * This engine works with lightweight in-memory types for pure computation.
 * It intentionally does NOT import the Supabase-backed canonical modules
 * (line-movement-tracker, arbitrage-detector) because those are async / DB-
 * coupled. Instead it embeds the same math and exports its own types.
 *
 * Canonical modules consolidated from:
 *   - lib/arbitrage/detectArbitrage.ts   -> inline detectArbitrage + americanToProbability
 *   - lib/sharp/detectSharpMoney.ts      -> inline detectSharpMoney
 *   - lib/kelly/calculateKelly.ts        -> inline calculateKelly
 *   - lib/lines/analyzeLineMovement.ts   -> inline analyzeLineMovement
 *   - lib/kalshi/analyzeKalshiVolatility  -> re-exported from @/lib/kalshi-client
 */

import {
  analyzeKalshiVolatility,
  type KalshiVolatilityInput,
  type KalshiAnalysis,
} from '@/lib/kalshi-client';

// ---------------------------------------------------------------------------
// Engine-local types (lightweight, no DB dependency)
// ---------------------------------------------------------------------------

export interface BookOdds {
  book: string;
  market: string;
  outcome: string;
  price: number; // American odds
}

export interface ArbitrageOpportunity {
  market: string;
  totalImpliedProbability: number;
  profitMargin: number;
  expectedReturn?: number;
  bets?: { outcome: string; bookmaker: string; stake: number; odds: number }[];
  recommendedStakes: {
    book: string;
    outcome: string;
    stakePercent: number;
  }[];
}

export interface LineSnapshot {
  timestamp: number;
  price: number;
  volume?: number;
}

export interface SharpSignal {
  direction: 'up' | 'down';
  confidence: number;
  reason: string;
  isReverseLineMovement?: boolean;
  publicSide?: string;
  publicPercentage?: number;
  sharpSide?: string;
  moneyPercentage?: number;
}

export interface LineMovementAnalysis {
  openingPrice: number;
  currentPrice: number;
  percentChange: number;
  movementStrength: 'weak' | 'moderate' | 'strong';
  direction?: string;
  strength?: string;
}

export interface KellyInput {
  probability: number;
  decimalOdds: number;
  bankroll: number;
  fraction?: number;
}

export interface KellyResult {
  fullKellyStake: number;
  fractionalKellyStake: number;
  recommendedStake: number;
  edge?: number;
  fullKellyPercent?: number;
  halfKellyStake?: number;
  halfKellyPercent?: number;
  expectedValue?: number;
}

// Re-export Kalshi types so consumers only need this module
export type { KalshiVolatilityInput, KalshiAnalysis };

// ---------------------------------------------------------------------------
// Pure-computation helpers (no DB, no async)
// ---------------------------------------------------------------------------

/** Convert American odds to implied probability (0-1). */
export function americanToProbability(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
}

/** Detect arbitrage across multiple books. */
export function detectArbitrage(odds: BookOdds[]): ArbitrageOpportunity[] {
  if (odds.length === 0) return [];

  const marketMap = new Map<string, BookOdds[]>();
  for (const odd of odds) {
    const existing = marketMap.get(odd.market) || [];
    existing.push(odd);
    marketMap.set(odd.market, existing);
  }

  const opportunities: ArbitrageOpportunity[] = [];

  for (const [market, marketOdds] of marketMap.entries()) {
    const outcomeMap = new Map<string, BookOdds[]>();
    for (const odd of marketOdds) {
      const existing = outcomeMap.get(odd.outcome) || [];
      existing.push(odd);
      outcomeMap.set(odd.outcome, existing);
    }
    if (outcomeMap.size < 2) continue;

    const bestOutcomes: { outcome: string; book: string; probability: number }[] = [];
    for (const [outcome, outcomeOdds] of outcomeMap.entries()) {
      let best = outcomeOdds[0];
      let lowest = americanToProbability(best.price);
      for (const odd of outcomeOdds) {
        const prob = americanToProbability(odd.price);
        if (prob < lowest) {
          lowest = prob;
          best = odd;
        }
      }
      bestOutcomes.push({ outcome, book: best.book, probability: lowest });
    }

    const totalImplied = bestOutcomes.reduce((s, o) => s + o.probability, 0);
    if (totalImplied < 1.0) {
      opportunities.push({
        market,
        totalImpliedProbability: totalImplied,
        profitMargin: 1 - totalImplied,
        recommendedStakes: bestOutcomes.map(o => ({
          book: o.book,
          outcome: o.outcome,
          stakePercent: o.probability / totalImplied,
        })),
      });
    }
  }
  return opportunities;
}

/** Detect sharp money via reverse line movement. */
export function detectSharpMoney(
  publicBetPercentage: number,
  lineHistory: LineSnapshot[],
): SharpSignal | null {
  if (lineHistory.length < 2) return null;

  const sorted = [...lineHistory].sort((a, b) => a.timestamp - b.timestamp);
  const first = sorted[0].price;
  const last = sorted[sorted.length - 1].price;
  const movement = last - first;
  const pctChange = Math.abs((movement / first) * 100);
  const hours =
    (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 3_600_000;

  const buildConfidence = (mag: number, speed: number, extreme: boolean) => {
    let c = Math.min((pctChange / 10) * 0.5 + Math.min(speed / 5, 0.5), 1);
    if (extreme) c = Math.min(c * 1.2, 1);
    return Math.max(0.1, c);
  };

  if (publicBetPercentage > 70 && movement < 0) {
    const speed = hours > 0 ? Math.abs(movement) / hours : Math.abs(movement);
    return {
      direction: 'down',
      confidence: buildConfidence(Math.abs(movement), speed, publicBetPercentage > 80),
      reason: `Public betting ${publicBetPercentage.toFixed(1)}% but line moved down ${pctChange.toFixed(2)}% - sharp money detected on opposite side`,
    };
  }

  if (publicBetPercentage < 30 && movement > 0) {
    const speed = hours > 0 ? Math.abs(movement) / hours : Math.abs(movement);
    return {
      direction: 'up',
      confidence: buildConfidence(Math.abs(movement), speed, publicBetPercentage < 20),
      reason: `Only ${publicBetPercentage.toFixed(1)}% public betting but line moved up ${pctChange.toFixed(2)}% - sharp money pushing line`,
    };
  }

  return null;
}

/** Analyze line movement strength. */
export function analyzeLineMovement(
  history: LineSnapshot[],
): LineMovementAnalysis | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
  const opening = sorted[0].price;
  const current = sorted[sorted.length - 1].price;
  const pct = ((current - opening) / opening) * 100;
  const abs = Math.abs(pct);

  return {
    openingPrice: opening,
    currentPrice: current,
    percentChange: pct,
    movementStrength: abs < 1 ? 'weak' : abs <= 3 ? 'moderate' : 'strong',
  };
}

/** Calculate Kelly Criterion bet sizing. */
export function calculateKelly(input: KellyInput): KellyResult {
  const { probability, decimalOdds, bankroll, fraction = 0.5 } = input;

  if (probability <= 0 || probability >= 1 || decimalOdds <= 1 || bankroll <= 0) {
    return { fullKellyStake: 0, fractionalKellyStake: 0, recommendedStake: 0 };
  }

  const b = decimalOdds - 1;
  const kellyFrac = (b * probability - (1 - probability)) / b;

  if (kellyFrac <= 0) {
    return { fullKellyStake: 0, fractionalKellyStake: 0, recommendedStake: 0 };
  }

  const full = bankroll * kellyFrac;
  const fractional = full * fraction;

  return {
    fullKellyStake: Math.max(0, full),
    fractionalKellyStake: Math.max(0, fractional),
    recommendedStake: Math.min(Math.max(0, fractional), bankroll),
  };
}

// ---------------------------------------------------------------------------
// Engine orchestrator
// ---------------------------------------------------------------------------

export interface TradingInput {
  odds?: BookOdds[];
  publicBetPercentage?: number;
  lineHistory?: LineSnapshot[];
  kalshiMarket?: KalshiVolatilityInput;
  modelProbability?: number;
  bankroll?: number;
  decimalOdds?: number;
  tickets?: Array<{ side: string; count: number; handle: number }>;
  lines?: Array<{ time: Date; price: number; bookmaker: string }>;
}

export interface TradingEngineResult {
  arbitrage?: ArbitrageOpportunity[];
  sharp?: SharpSignal | null;
  sharpSignal?: SharpSignal | null;
  lineMovement?: LineMovementAnalysis | null;
  kalshi?: KalshiAnalysis;
  kalshiAnalysis?: KalshiAnalysis;
  kelly?: KellyResult;
  metadata?: { processingTimeMs?: number; timestamp?: string; modulesRun?: string[] };
}

/**
 * Run the unified trading engine with provided inputs.
 */
export function runTradingEngine(input: TradingInput): TradingEngineResult {
  const result: TradingEngineResult = {};

  if (input.odds && input.odds.length > 0) {
    result.arbitrage = detectArbitrage(input.odds);
  }

  if (input.publicBetPercentage !== undefined && input.lineHistory && input.lineHistory.length > 0) {
    result.sharpSignal = detectSharpMoney(input.publicBetPercentage, input.lineHistory);
  }

  if (input.lineHistory && input.lineHistory.length > 0) {
    result.lineMovement = analyzeLineMovement(input.lineHistory);
  }

  if (input.kalshiMarket && input.modelProbability !== undefined) {
    result.kalshiAnalysis = analyzeKalshiVolatility(input.kalshiMarket, input.modelProbability);
  }

  if (input.modelProbability !== undefined && input.bankroll !== undefined && input.decimalOdds !== undefined) {
    result.kelly = calculateKelly({
      probability: input.modelProbability,
      decimalOdds: input.decimalOdds,
      bankroll: input.bankroll,
    });
  } else if (input.modelProbability !== undefined && input.bankroll !== undefined && input.odds && input.odds.length > 0) {
    const prob = americanToProbability(input.odds[0].price);
    result.kelly = calculateKelly({
      probability: input.modelProbability,
      decimalOdds: 1 / prob,
      bankroll: input.bankroll,
    });
  }

  return result;
}
