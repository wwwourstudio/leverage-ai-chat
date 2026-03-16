/**
 * Kalshi Real-Time Store (Zustand)
 *
 * Manages live market price data streamed via KalshiWebSocket.
 * Components subscribe to specific tickers and receive instant price updates
 * without polling the REST API.
 *
 * Usage:
 *   const price = useKalshiStore(s => s.getPrice('NBA-HEAT-WIN'))
 *   const { subscribe, unsubscribe, wsConnected } = useKalshiStore()
 */

import { create } from 'zustand';
import type { KalshiWSMarketUpdate } from '@/lib/kalshi-websocket';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KalshiLivePrice {
  ticker:       string;
  yesBid:       number;
  yesAsk:       number;
  noBid:        number;
  noAsk:        number;
  volume:       number;
  volume24h:    number;
  lastPrice:    number;
  timestamp:    string;
  /** Derived: midpoint of yes bid/ask in cents */
  yesMid:       number;
  /** Change vs previous snapshot, in cents */
  delta:        number | null;
}

interface KalshiStoreState {
  // Real-time price snapshots keyed by ticker
  prices:           Record<string, KalshiLivePrice>;
  // WebSocket connection status
  wsConnected:      boolean;
  // Set of tickers currently subscribed
  subscribedTickers: Set<string>;

  // ── Actions ──────────────────────────────────────────────────────────────
  /** Subscribe to real-time updates for the given tickers */
  subscribe:    (tickers: string[]) => void;
  /** Unsubscribe from real-time updates */
  unsubscribe:  (tickers: string[]) => void;
  /** Internal: called by the WebSocket listener when a price update arrives */
  updatePrice:  (ticker: string, update: KalshiWSMarketUpdate) => void;
  /** Internal: called by the WebSocket listener on connection state change */
  setWsConnected: (connected: boolean) => void;
  /** Get the latest price snapshot for a ticker (or undefined) */
  getPrice:     (ticker: string) => KalshiLivePrice | undefined;
  /** Initialize WebSocket listeners (call once on app mount, client-side only) */
  initWS:       () => () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useKalshiStore = create<KalshiStoreState>((set, get) => ({
  prices:            {},
  wsConnected:       false,
  subscribedTickers: new Set(),

  subscribe(tickers) {
    if (!tickers.length) return;
    set(state => {
      const next = new Set(state.subscribedTickers);
      tickers.forEach(t => next.add(t));
      return { subscribedTickers: next };
    });
    // Lazily import to avoid SSR issues (WebSocket is browser-only)
    if (typeof window !== 'undefined') {
      import('@/lib/kalshi-websocket').then(({ kalshiWS }) => {
        kalshiWS.connect();
        kalshiWS.subscribe(tickers);
      });
    }
  },

  unsubscribe(tickers) {
    if (!tickers.length) return;
    set(state => {
      const next = new Set(state.subscribedTickers);
      tickers.forEach(t => next.delete(t));
      return { subscribedTickers: next };
    });
    if (typeof window !== 'undefined') {
      import('@/lib/kalshi-websocket').then(({ kalshiWS }) => {
        kalshiWS.unsubscribe(tickers);
      });
    }
  },

  updatePrice(ticker, update) {
    set(state => {
      const prev = state.prices[ticker];
      const yesMid = update.yes_bid > 0 && update.yes_ask > 0
        ? Math.round((update.yes_bid + update.yes_ask) / 2)
        : update.yes_bid || update.yes_ask || 50;
      const delta = prev != null ? yesMid - prev.yesMid : null;

      const price: KalshiLivePrice = {
        ticker,
        yesBid:    update.yes_bid,
        yesAsk:    update.yes_ask,
        noBid:     update.no_bid,
        noAsk:     update.no_ask,
        volume:    update.volume,
        volume24h: update.volume_24h ?? 0,
        lastPrice: update.last_price ?? yesMid,
        timestamp: update.timestamp,
        yesMid,
        delta,
      };

      return { prices: { ...state.prices, [ticker]: price } };
    });
  },

  setWsConnected(connected) {
    set({ wsConnected: connected });
  },

  getPrice(ticker) {
    return get().prices[ticker];
  },

  initWS() {
    if (typeof window === 'undefined') return () => {};

    let cleanupPriceUnsub: (() => void) | null = null;
    let cleanupConnUnsub:  (() => void) | null = null;

    import('@/lib/kalshi-websocket').then(({ kalshiWS }) => {
      const { updatePrice, setWsConnected, subscribedTickers } = get();

      // Listen for price updates
      cleanupPriceUnsub = kalshiWS.onPriceUpdate((ticker, data) => {
        updatePrice(ticker, data);
      });

      // Listen for connection state
      cleanupConnUnsub = kalshiWS.onConnectionChange(connected => {
        setWsConnected(connected);
      });

      // Connect if there are already pending subscriptions
      if (subscribedTickers.size > 0) {
        kalshiWS.connect();
        kalshiWS.subscribe(Array.from(subscribedTickers));
      }
    });

    // Return cleanup function
    return () => {
      cleanupPriceUnsub?.();
      cleanupConnUnsub?.();
    };
  },
}));
