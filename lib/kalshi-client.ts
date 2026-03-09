/**
 * Re-export shim for backward compatibility.
 * The canonical implementation lives in lib/kalshi/index.ts.
 */
export {
  fetchKalshiMarkets,
  fetchAllKalshiMarkets,
  fetchKalshiMarketsWithRetry,
  fetchElectionMarkets,
  fetchSportsMarkets,
  fetchWeatherMarkets,
  fetchFinanceMarkets,
  fetchAllCategoryMarkets,
  fetchTopMarketsByVolume,
  fetchMarketOrderbook,
  fetchMarketTrades,
  fetchKalshiEvents,
  getMarketByTicker,
  generateKalshiCards,
  kalshiMarketToCard,
  analyzeKalshiVolatility,
  type KalshiMarket,
  type KalshiVolatilityInput,
  type KalshiAnalysis,
} from './kalshi/index';
