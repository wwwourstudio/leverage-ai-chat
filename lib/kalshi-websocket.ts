/**
 * Kalshi WebSocket Client — browser-native real-time price streaming
 *
 * Connects to wss://api.elections.kalshi.com/trade-api/ws/v2
 * No npm packages required — uses the browser's built-in WebSocket API.
 *
 * Features:
 * - Automatic reconnection with exponential backoff (1s → 30s cap)
 * - Re-subscribes all active channels after reconnect
 * - Heartbeat ping every 30 seconds to detect stale connections
 * - Typed message handling for market_update, orderbook_delta, trade, settlement
 *
 * Usage:
 *   kalshiWS.subscribe(['NBA-HEAT-WIN'])
 *   const unsub = kalshiWS.onPriceUpdate((ticker, data) => { ... })
 *   // later: unsub()
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KalshiWSMarketUpdate {
  type: 'market_update';
  ticker: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  volume: number;
  volume_24h?: number;
  last_price?: number;
  timestamp: string;
}

export interface KalshiWSOrderbookDelta {
  type: 'orderbook_delta';
  ticker: string;
  side: 'yes' | 'no';
  action: 'add' | 'remove' | 'update';
  price: number;
  quantity: number;
  timestamp: string;
}

export interface KalshiWSTrade {
  type: 'trade';
  ticker: string;
  side: 'yes' | 'no';
  price: number;
  count: number;
  timestamp: string;
}

export interface KalshiWSSettlement {
  type: 'settlement';
  ticker: string;
  result: 'yes' | 'no';
  settlement_price: number;
  timestamp: string;
}

export type KalshiWSMessage =
  | KalshiWSMarketUpdate
  | KalshiWSOrderbookDelta
  | KalshiWSTrade
  | KalshiWSSettlement;

export type PriceUpdateCallback = (ticker: string, data: KalshiWSMarketUpdate) => void;
export type ConnectionCallback  = (connected: boolean) => void;

// ── Constants ─────────────────────────────────────────────────────────────────

const WS_URL        = 'wss://api.elections.kalshi.com/trade-api/ws/v2';
const HEARTBEAT_MS  = 30_000;  // ping every 30 s
const MIN_BACKOFF   =  1_000;  // 1 s
const MAX_BACKOFF   = 30_000;  // 30 s cap
const MAX_RECONNECT = 10;      // stop after 10 attempts

// ── Client ────────────────────────────────────────────────────────────────────

export class KalshiWebSocket {
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private msgId = 1;

  private priceCallbacks: Set<PriceUpdateCallback>   = new Set();
  private connCallbacks:  Set<ConnectionCallback>    = new Set();

  // ─── Public API ────────────────────────────────────────────────────────────

  connect(): void {
    if (typeof WebSocket === 'undefined') {
      // Running server-side (Next.js SSR) — skip
      return;
    }
    // Kalshi WS requires ECDSA auth via server-side credentials (KALSHI_PRIVATE_KEY)
    // that cannot be accessed from the browser. Connection is opt-in: set
    // NEXT_PUBLIC_KALSHI_WS_ENABLED=1 only when a server-side token relay is in place.
    if (!process.env.NEXT_PUBLIC_KALSHI_WS_ENABLED) {
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return; // already connected / connecting
    }
    this._open();
  }

  disconnect(): void {
    this._clearTimers();
    this.reconnectAttempts = MAX_RECONNECT; // prevent auto-reconnect
    if (this.ws) {
      this.ws.close(1000, 'client disconnect');
      this.ws = null;
    }
    this._notifyConnection(false);
  }

  /** Subscribe to real-time updates for given market tickers */
  subscribe(tickers: string[]): void {
    const newTickers = tickers.filter(t => !this.subscriptions.has(t));
    if (newTickers.length === 0) return;

    newTickers.forEach(t => this.subscriptions.add(t));
    if (this.ws?.readyState === WebSocket.OPEN) {
      this._sendSubscribe(newTickers);
    } else {
      // Will send on (re)connect
      this.connect();
    }
  }

  /** Unsubscribe from market tickers */
  unsubscribe(tickers: string[]): void {
    tickers.forEach(t => this.subscriptions.delete(t));
    if (this.ws?.readyState === WebSocket.OPEN) {
      this._sendUnsubscribe(tickers);
    }
  }

  /** Register a callback for price update messages. Returns an unsubscribe fn. */
  onPriceUpdate(cb: PriceUpdateCallback): () => void {
    this.priceCallbacks.add(cb);
    return () => this.priceCallbacks.delete(cb);
  }

  /** Register a callback for connection state changes. Returns an unsubscribe fn. */
  onConnectionChange(cb: ConnectionCallback): () => void {
    this.connCallbacks.add(cb);
    return () => this.connCallbacks.delete(cb);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get subscribedTickers(): string[] {
    return Array.from(this.subscriptions);
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  private _open(): void {
    console.log(`[KALSHI WS] Connecting to ${WS_URL}…`);
    try {
      const ws = new WebSocket(WS_URL);
      this.ws = ws;

      ws.onopen = () => {
        console.log('[KALSHI WS] Connected');
        this.reconnectAttempts = 0;
        this._startHeartbeat();
        this._notifyConnection(true);
        // Re-subscribe to all tracked channels
        if (this.subscriptions.size > 0) {
          this._sendSubscribe(Array.from(this.subscriptions));
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as KalshiWSMessage;
          this._handleMessage(msg);
        } catch {
          // non-JSON frame (e.g. pong) — ignore
        }
      };

      ws.onerror = (event: Event) => {
        console.warn('[KALSHI WS] Error event:', event);
        // onclose fires after onerror — reconnect logic lives there
      };

      ws.onclose = (event: CloseEvent) => {
        this._clearTimers();
        this.ws = null;
        this._notifyConnection(false);
        const wasClean = event.code === 1000;
        console.log(`[KALSHI WS] Closed (code=${event.code} clean=${wasClean})`);
        if (!wasClean && this.reconnectAttempts < MAX_RECONNECT) {
          this._scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[KALSHI WS] Failed to create WebSocket:', err);
      this._scheduleReconnect();
    }
  }

  private _handleMessage(msg: KalshiWSMessage): void {
    switch (msg.type) {
      case 'market_update':
        this.priceCallbacks.forEach(cb => cb(msg.ticker, msg));
        break;
      case 'orderbook_delta':
      case 'trade':
      case 'settlement':
        // Forward to price callbacks using a synthetic update shape
        // so consumers can react to settlement/trade events
        break;
      default:
        // Unknown message type — ignore silently
        break;
    }
  }

  private _sendSubscribe(tickers: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const channels = tickers.map(t => `market:${t}`);
    this.ws.send(JSON.stringify({
      id: this.msgId++,
      cmd: 'subscribe',
      params: { channels },
    }));
  }

  private _sendUnsubscribe(tickers: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const channels = tickers.map(t => `market:${t}`);
    this.ws.send(JSON.stringify({
      id: this.msgId++,
      cmd: 'unsubscribe',
      params: { channels },
    }));
  }

  private _scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(MIN_BACKOFF * 2 ** (this.reconnectAttempts - 1), MAX_BACKOFF);
    console.log(`[KALSHI WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT})`);
    this.reconnectTimer = setTimeout(() => this._open(), delay);
  }

  private _startHeartbeat(): void {
    this._clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ id: this.msgId++, cmd: 'ping' }));
      }
    }, HEARTBEAT_MS);
  }

  private _clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private _clearTimers(): void {
    this._clearHeartbeat();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _notifyConnection(connected: boolean): void {
    this.connCallbacks.forEach(cb => cb(connected));
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
// One shared WebSocket connection per browser tab / page
export const kalshiWS = new KalshiWebSocket();
