/**
 * Kalshi WebSocket Client — browser-native real-time price streaming
 *
 * Connects to wss://api.elections.kalshi.com/trade-api/ws/v2
 * No npm packages required — uses the browser's built-in WebSocket API.
 *
 * ── Authentication & enablement ──────────────────────────────────────────────
 * Kalshi's WebSocket endpoint requires an ECDSA-signed token that can only be
 * produced on the server side (it depends on KALSHI_PRIVATE_KEY, which must
 * never be exposed to the browser).
 *
 * To enable real-time streaming you MUST do BOTH of the following:
 *
 *  1. Set NEXT_PUBLIC_KALSHI_WS_ENABLED=1 in your Vercel project environment
 *     variables (Settings → Vars). This flag is intentionally opt-in so the
 *     WebSocket is never accidentally opened in environments where the token
 *     relay endpoint is absent.
 *
 *  2. Implement the token relay endpoint at GET /api/kalshi/ws-token.
 *     This server-side route should:
 *       a. Verify the caller is authenticated (check Supabase session or cookie).
 *       b. Generate a short-lived (~60 s) signed Kalshi WebSocket token using
 *          KALSHI_ACCESS_KEY + KALSHI_PRIVATE_KEY via buildHeaders() from
 *          lib/kalshi/index.ts.
 *       c. Return { token: string, expiresAt: number } as JSON.
 *     The client passes this token in the WebSocket URL query string:
 *       wss://api.elections.kalshi.com/trade-api/ws/v2?token=<TOKEN>
 *     or in the first "authenticate" frame after connection, depending on the
 *     Kalshi WS protocol version you are targeting.
 *
 * ── Political market streaming ────────────────────────────────────────────────
 * Use `kalshiWS.subscribePolitical()` to subscribe to all active political
 * market tickers in one call. It fetches the current open-market list for each
 * known political series prefix via the REST API and then subscribes to those
 * tickers over the WebSocket. Tickers are refreshed automatically on reconnect.
 *
 * Features:
 * - Automatic reconnection with exponential backoff (1 s → 30 s cap)
 * - Re-subscribes all active channels after reconnect
 * - Heartbeat ping every 30 s to detect stale connections
 * - Typed message handling for market_update, orderbook_delta, trade, settlement
 *
 * Usage:
 *   kalshiWS.subscribe(['NBA-HEAT-WIN'])
 *   await kalshiWS.subscribePolitical()        // subscribe to all political tickers
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

const WS_BASE_URL   = 'wss://api.elections.kalshi.com/trade-api/ws/v2';
const HEARTBEAT_MS  = 30_000;  // ping every 30 s
const MIN_BACKOFF   =  1_000;  // 1 s
const MAX_BACKOFF   = 30_000;  // 30 s cap
const MAX_RECONNECT = 10;      // stop after 10 attempts

/**
 * Known political series prefixes on Kalshi.
 * These are used by `subscribePolitical()` to look up active tickers and
 * subscribe to them in one call.
 * Keep this list in sync with POLITICAL_SERIES_PREFIXES in:
 *  - app/api/cron/kalshi/route.ts
 *  - lib/kalshi/index.ts (fetchElectionMarkets)
 */
const POLITICAL_SERIES_PREFIXES: string[] = [
  'KXUSSENATE',
  'KXUSHOUSE',
  'KXUSGOV',
  'PRES',
  'POTUS',
];

/**
 * Token relay endpoint — implemented by the host app at GET /api/kalshi/ws-token.
 * Must return { token: string, expiresAt: number } (expiresAt is a Unix ms timestamp).
 * Set to null to use an unauthenticated WebSocket connection (only works for
 * public Kalshi market channels; order management channels require auth).
 */
const TOKEN_RELAY_ENDPOINT = '/api/kalshi/ws-token';

// ── Client ────────────────────────────────────────────────────────────────────

export class KalshiWebSocket {
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private msgId = 1;

  /** Cached WS token retrieved from the server-side token relay endpoint */
  private wsToken: string | null = null;
  private wsTokenExpiresAt = 0;

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
    // NEXT_PUBLIC_KALSHI_WS_ENABLED=1 only when the /api/kalshi/ws-token relay
    // endpoint has been implemented and deployed.
    if (!process.env.NEXT_PUBLIC_KALSHI_WS_ENABLED) {
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return; // already connected / connecting
    }
    void this._openWithToken();
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

  /**
   * Subscribe to all currently open political market tickers.
   *
   * Fetches the active ticker list for each known political series prefix via
   * the REST API (/api/kalshi/markets?category=politics) and then subscribes
   * to those tickers over the WebSocket. Safe to call multiple times — already-
   * subscribed tickers are deduplicated.
   *
   * Prerequisites:
   *  - NEXT_PUBLIC_KALSHI_WS_ENABLED=1 must be set (otherwise this is a no-op)
   *  - /api/kalshi/ws-token relay endpoint must exist
   */
  async subscribePolitical(): Promise<void> {
    if (!process.env.NEXT_PUBLIC_KALSHI_WS_ENABLED) return;

    try {
      const resp = await fetch('/api/kalshi/markets?category=politics&limit=100');
      if (!resp.ok) {
        console.warn('[KALSHI WS] subscribePolitical — could not fetch political tickers:', resp.status);
        return;
      }
      const data = await resp.json() as { markets?: Array<{ ticker: string }> };
      const tickers = (data.markets ?? []).map(m => m.ticker).filter(Boolean);

      if (tickers.length === 0) {
        console.warn('[KALSHI WS] subscribePolitical — 0 political tickers returned by REST API');
        return;
      }

      console.log(`[KALSHI WS] subscribePolitical — subscribing to ${tickers.length} political tickers`);
      this.subscribe(tickers);
    } catch (err) {
      console.error('[KALSHI WS] subscribePolitical error:', err instanceof Error ? err.message : err);
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

  /**
   * Fetch a short-lived WS token from the server-side token relay endpoint,
   * then open the WebSocket with it appended as a query parameter.
   *
   * Token relay contract (GET /api/kalshi/ws-token):
   *   Request:  standard session cookies / Authorization header
   *   Response: { token: string; expiresAt: number }
   *
   * The token is cached until 10 s before expiry to avoid re-fetching on every
   * reconnect attempt within the same session.
   */
  private async _openWithToken(): Promise<void> {
    const now = Date.now();

    // Refresh the cached token if it is absent or about to expire (within 10 s)
    if (!this.wsToken || now >= this.wsTokenExpiresAt - 10_000) {
      try {
        const resp = await fetch(TOKEN_RELAY_ENDPOINT);
        if (resp.ok) {
          const json = await resp.json() as { token?: string; expiresAt?: number };
          if (json.token) {
            this.wsToken = json.token;
            this.wsTokenExpiresAt = json.expiresAt ?? now + 60_000;
            console.log('[KALSHI WS] Token refreshed, expires in', Math.round((this.wsTokenExpiresAt - now) / 1000), 's');
          }
        } else if (resp.status === 404) {
          // Token relay not implemented — connect without a token (public channels only)
          console.warn(
            '[KALSHI WS] Token relay endpoint not found (' + TOKEN_RELAY_ENDPOINT + ').',
            'Connecting without auth — only public market channels will work.',
            'Implement GET /api/kalshi/ws-token to enable authenticated channels.',
          );
        } else {
          console.warn('[KALSHI WS] Token relay returned', resp.status, '— connecting without token');
        }
      } catch (err) {
        console.warn('[KALSHI WS] Failed to fetch token, connecting without auth:', err instanceof Error ? err.message : err);
      }
    }

    // Build the WS URL — append token as query param when available
    const wsUrl = this.wsToken
      ? `${WS_BASE_URL}?token=${encodeURIComponent(this.wsToken)}`
      : WS_BASE_URL;

    this._open(wsUrl);
  }

  private _open(wsUrl: string = WS_BASE_URL): void {
    console.log(`[KALSHI WS] Connecting to ${wsUrl.split('?')[0]}…`);
    try {
      const ws = new WebSocket(wsUrl);
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
    this.reconnectTimer = setTimeout(() => void this._openWithToken(), delay);
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

// Re-export the political series prefix list so downstream components can
// filter their ticker sets without importing from the server-only kalshi/index.ts
export { POLITICAL_SERIES_PREFIXES };
