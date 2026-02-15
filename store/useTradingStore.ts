/**
 * Trading Engine Zustand Store
 * Manages trading engine state across the application
 */

import { create } from 'zustand';
import { runTradingEngine, type TradingEngineResult } from '../lib/engine/runTradingEngine';

interface TradingState {
  results: TradingEngineResult | null;
  setResults: (results: TradingEngineResult) => void;
  clearResults: () => void;
}

export const useTradingStore = create<TradingState>((set) => ({
  results: null,
  setResults: (results: TradingEngineResult) => set({ results }),
  clearResults: () => set({ results: null }),
}));
