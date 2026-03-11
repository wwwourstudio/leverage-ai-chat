/**
 * KalshiClient — Authenticated Kalshi REST API client.
 *
 * Handles RSA-SHA256 request signing per Kalshi's authentication spec.
 * All trading operations require a valid API key ID + RSA private key.
 *
 * Docs: https://trading-api.readme.io/reference/getting-started
 */

import { createSign, constants } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KalshiMarket {
  ticker: string;
  title: string;
  yes_bid: number;       // Cents (0–99)
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  open_interest: number;
  status: 'open' | 'closed' | 'settled';
  expiration_time: string;
  category: string;
}

export interface KalshiPosition {
  ticker: string;
  position: number;       // Positive = YES, negative = NO
  market_exposure: number; // Dollars
  realized_pnl: number;
  resting_orders_count: number;
}

export interface KalshiOrder {
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  type: 'limit' | 'market';
  count: number;          // Number of contracts
  yes_price?: number;     // Cents, for limit orders
  no_price?: number;
}

export interface KalshiOrderResponse {
  order_id: string;
  status: 'resting' | 'filled' | 'canceled' | 'pending';
  ticker: string;
  side: string;
  count: number;
  filled_count: number;
  remaining_count: number;
}

export interface KalshiPortfolio {
  balance: number;          // Cents
  portfolio_value: number;
  total_deposited: number;
  total_withdrawn: number;
  bonus_balance: number;
}

export interface KalshiEventMarkets {
  event_ticker: string;
  title: string;
  markets: KalshiMarket[];
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class KalshiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiKeyId: string;

  constructor(options?: {
    apiKey?: string;
    apiKeyId?: string;
    demo?: boolean;
  }) {
    this.apiKey = options?.apiKey || process.env.KALSHI_PRIVATE_KEY || '';
    this.apiKeyId = options?.apiKeyId || process.env.KALSHI_API_KEY_ID || '';
    this.baseUrl = options?.demo
      ? 'https://demo-api.kalshi.co/trade-api/v2'
      : 'https://api.elections.kalshi.com/trade-api/v2';
  }

  // ─── RSA-SHA256 Signature ─────────────────────────────────────────────────

  private buildSignature(method: string, path: string, timestampMs: number): string {
    const rawKey = this.apiKey.replace(/\\n/g, '\n');
    const privateKey = rawKey && !rawKey.includes('-----')
      ? `-----BEGIN RSA PRIVATE KEY-----\n${rawKey.match(/.{1,64}/g)?.join('\n') ?? rawKey}\n-----END RSA PRIVATE KEY-----`
      : rawKey;
    const msg = `${timestampMs}${method.toUpperCase()}${path}`;
    const sign = createSign('RSA-SHA256');
    sign.update(msg);
    sign.end();
    return sign.sign({ key: privateKey, padding: constants.RSA_PKCS1_PADDING }, 'base64');
  }

  private authHeaders(method: string, path: string): HeadersInit {
    const ts = Date.now();
    const sig = this.buildSignature(method, path, ts);
    return {
      'Content-Type': 'application/json',
      'KALSHI-ACCESS-KEY': this.apiKeyId,
      'KALSHI-ACCESS-TIMESTAMP': String(ts),
      'KALSHI-ACCESS-SIGNATURE': sig,
    };
  }

  // ─── Generic Request ─────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const path = `/trade-api/v2${endpoint}`;
    const headers = this.authHeaders(method, path);

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Kalshi API ${method} ${endpoint} → ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  // ─── Markets ─────────────────────────────────────────────────────────────

  /** Fetch active markets for a series/event ticker prefix */
  async getMarkets(params?: {
    series_ticker?: string;
    status?: 'open' | 'closed';
    limit?: number;
    cursor?: string;
  }): Promise<{ markets: KalshiMarket[]; cursor?: string }> {
    const qs = new URLSearchParams();
    if (params?.series_ticker) qs.set('series_ticker', params.series_ticker);
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    const query = qs.toString() ? `?${qs}` : '';
    return this.request<{ markets: KalshiMarket[]; cursor?: string }>('GET', `/markets${query}`);
  }

  /** Get a single market by ticker */
  async getMarket(ticker: string): Promise<{ market: KalshiMarket }> {
    return this.request<{ market: KalshiMarket }>('GET', `/markets/${ticker}`);
  }

  /** Get markets grouped under an event */
  async getEvent(eventTicker: string): Promise<KalshiEventMarkets> {
    return this.request<KalshiEventMarkets>('GET', `/events/${eventTicker}`);
  }

  // ─── Portfolio ────────────────────────────────────────────────────────────

  async getBalance(): Promise<KalshiPortfolio> {
    return this.request<KalshiPortfolio>('GET', '/portfolio/balance');
  }

  async getPositions(): Promise<{ positions: KalshiPosition[] }> {
    return this.request<{ positions: KalshiPosition[] }>('GET', '/portfolio/positions');
  }

  // ─── Orders ──────────────────────────────────────────────────────────────

  async createOrder(order: KalshiOrder): Promise<KalshiOrderResponse> {
    return this.request<KalshiOrderResponse>('POST', '/portfolio/orders', order);
  }

  async cancelOrder(orderId: string): Promise<{ order: KalshiOrderResponse }> {
    return this.request<{ order: KalshiOrderResponse }>('DELETE', `/portfolio/orders/${orderId}`);
  }

  async getOrders(params?: {
    ticker?: string;
    status?: 'resting' | 'filled' | 'canceled';
    limit?: number;
  }): Promise<{ orders: KalshiOrderResponse[] }> {
    const qs = new URLSearchParams();
    if (params?.ticker) qs.set('ticker', params.ticker);
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs}` : '';
    return this.request<{ orders: KalshiOrderResponse[] }>('GET', `/portfolio/orders${query}`);
  }

  // ─── Market Analytics ────────────────────────────────────────────────────

  /** Compute implied edge between model probability and market price */
  static computeEdge(modelProb: number, yesBid: number, yesAsk: number): {
    side: 'yes' | 'no' | 'none';
    edge: number;
    midpoint: number;
  } {
    const mid = (yesBid + yesAsk) / 2 / 100; // Convert cents to fraction
    const yesEdge = modelProb - (yesAsk / 100);
    const noEdge = (1 - modelProb) - ((100 - yesBid) / 100);

    if (yesEdge > 0.02) return { side: 'yes', edge: yesEdge, midpoint: mid };
    if (noEdge > 0.02) return { side: 'no', edge: noEdge, midpoint: mid };
    return { side: 'none', edge: Math.max(yesEdge, noEdge), midpoint: mid };
  }

  /** Check if the client has valid credentials configured */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKeyId);
  }
}

// Singleton for server-side use
let _client: KalshiClient | null = null;

export function getKalshiClient(): KalshiClient {
  if (!_client) _client = new KalshiClient();
  return _client;
}
