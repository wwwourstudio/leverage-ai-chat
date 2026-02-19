/**
 * Re-export shim for backward compatibility.
 * The canonical implementation lives in lib/kalshi/index.ts.
 */
export {
  fetchKalshiMarkets,
  fetchKalshiMarketsWithRetry,
  fetchElectionMarkets,
  fetchSportsMarkets,
  getMarketByTicker,
  generateKalshiCards,
  kalshiMarketToCard,
  type KalshiMarket,
} from './kalshi/index';
