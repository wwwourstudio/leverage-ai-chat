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
  getMarketByTicker,
  generateKalshiCards,
  kalshiMarketToCard,
  type KalshiMarket,
} from './kalshi/index';
