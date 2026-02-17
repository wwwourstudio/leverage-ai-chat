/**
 * Unified Trading Engine Controller
 * Orchestrates all trading analysis modules
 */

import { detectArbitrage, americanToProbability, type BookOdds, type ArbitrageOpportunity } from '@/lib/arbitrage';
import { detectSharpMoney, type LineSnapshot, type SharpSignal } from '../sharp/detectSharpMoney';
import { calculateKelly, type KellyResult } from '@/lib/kelly';
import { analyzeLineMovement, type LineMovementAnalysis } from '../lines/analyzeLineMovement';
import { analyzeKalshiVolatility, type KalshiMarket, type KalshiAnalysis } from '../kalshi/analyzeKalshiVolatility';

export interface TradingInput {
  odds?: BookOdds[];
  publicBetPercentage?: number;
  lineHistory?: LineSnapshot[];
  kalshiMarket?: KalshiMarket;
  modelProbability?: number;
  bankroll?: number;
  decimalOdds?: number;
  // Additional demo/UI properties
  tickets?: Array<{ side: string; count: number; handle: number }>;
  lines?: Array<{ time: Date; price: number; bookmaker: string }>;
}

export interface TradingEngineResult {
  arbitrage?: ArbitrageOpportunity[];
  sharpSignal?: SharpSignal | null;
  lineMovement?: LineMovementAnalysis | null;
  kalshiAnalysis?: KalshiAnalysis;
  kelly?: KellyResult;
}

/**
 * Run the unified trading engine with provided inputs
 * @param input - Trading analysis inputs
 * @returns Comprehensive trading analysis results
 */
export function runTradingEngine(input: TradingInput): TradingEngineResult {
  const result: TradingEngineResult = {};
  
  // Run arbitrage detection if odds provided
  if (input.odds && input.odds.length > 0) {
    result.arbitrage = detectArbitrage(input.odds);
  }
  
  // Run sharp money detection if required data provided
  if (
    input.publicBetPercentage !== undefined &&
    input.lineHistory &&
    input.lineHistory.length > 0
  ) {
    result.sharpSignal = detectSharpMoney(
      input.publicBetPercentage,
      input.lineHistory
    );
  }
  
  // Run line movement analysis if history provided
  if (input.lineHistory && input.lineHistory.length > 0) {
    result.lineMovement = analyzeLineMovement(input.lineHistory);
  }
  
  // Run Kalshi analysis if market and model probability provided
  if (input.kalshiMarket && input.modelProbability !== undefined) {
    result.kalshiAnalysis = analyzeKalshiVolatility(
      input.kalshiMarket,
      input.modelProbability
    );
  }
  
  // Run Kelly sizing if required data provided
  if (
    input.modelProbability !== undefined &&
    input.bankroll !== undefined &&
    input.decimalOdds !== undefined
  ) {
    result.kelly = calculateKelly({
      probability: input.modelProbability,
      decimalOdds: input.decimalOdds,
      bankroll: input.bankroll,
    });
  } else if (
    input.modelProbability !== undefined &&
    input.bankroll !== undefined &&
    input.odds &&
    input.odds.length > 0
  ) {
    // If decimalOdds not provided but odds array exists, use first odds entry
    const americanOdds = input.odds[0].price;
    const probability = americanToProbability(americanOdds);
    // Convert to decimal odds: decimalOdds = 1 / probability
    const decimalOdds = 1 / probability;
    
    result.kelly = calculateKelly({
      probability: input.modelProbability,
      decimalOdds,
      bankroll: input.bankroll,
    });
  }
  
  return result;
}
