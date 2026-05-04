/**
 * KalshiClient — Authenticated Kalshi REST API client.
 *
 * Handles RSA-SHA256 request signing per Kalshi's authentication spec.
 * All trading operations require a valid API key ID + RSA private key.
 *
 * Docs: https://trading-api.readme.io/reference/getting-started
 */

import { createSign, constants } from 'crypto';
import { getKalshiApiKey, getKalshiPrivateKey } from '@/lib/config';

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

// ─── Rate limiter (token bucket: 5 tokens, refills 1 token / 200ms) ──────────

const _rateTokens = { count: 5, lastRefill: Date.now() };

function acquireRateToken(): Promise<void> {
  return new Promise(resolve => {
    const tryAcquire = () => {
      const now = Date.now();
      const refill = Math.floor((now - _rateTokens.lastRefill) / 200);
      if (refill > 0) {
        _rateTokens.count = Math.min(5, _rateTokens.count + refill);
        _rateTokens.lastRefill = now;
      }
      if (_rateTokens.count > 0) {
        _rateTokens.count--;
        resolve();
      } else {
        setTimeout(tryAcquire, 200);
      }
    };
    tryAcquire();
  });
}

// ─── GET response cache (keyed by URL, TTL = 60s) ─────────────────────────────

const _requestCache = new Map<string, { data: unknown; expires: number }>();

function getCachedResponse(key: string): unknown | null {
  const entry = _requestCache.get(key);
  return entry && entry.expires > Date.now() ? entry.data : null;
}

function setCachedResponse(key: string, data: unknown): void {
  _requestCache.set(key, { data, expires: Date.now() + 60_000 });
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
    // Support both KALSHI_ACCESS_KEY (new) and KALSHI_API_KEY_ID (legacy) env vars
    this.apiKey = options?.apiKey || getKalshiPrivateKey() || '';
    this.apiKeyId = options?.apiKeyId || getKalshiApiKey() || '';
    const isDemoEnv = process.env.KALSHI_ENV === 'demo';
    this.baseUrl = (options?.demo || isDemoEnv)
      ? 'https://demo-api.kalshi.co/trade-api/v2'
      : 'https://api.elections.kalshi.com/trade-api/v2';
  }

  // ─── RSA-PSS Signature (Kalshi requires PSS, not PKCS1v15) ───────────────

  private buildSignature(method: string, path: string, timestampMs: number): string {
    const rawKey = this.apiKey.replace(/\\n/g, '\n');
    const privateKey = rawKey && !rawKey.includes('-----')
      ? `-----BEGIN RSA PRIVATE KEY-----\n${rawKey.match(/.{1,64}/g)?.join('\n') ?? rawKey}\n-----END RSA PRIVATE KEY-----`
      : rawKey;
    const msg = `${timestampMs}${method.toUpperCase()}${path}`;
    const sign = createSign('RSA-SHA256');
    sign.update(msg);
    sign.end();
    // Kalshi requires RSA-PSS with SHA-256 and salt length = digest length (32)
    return sign.sign(
      { key: privateKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
      'base64',
    );
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
    const cacheKey = method === 'GET' ? `${this.baseUrl}${endpoint}` : '';

    // Serve from cache for GET requests
    if (cacheKey) {
      const cached = getCachedResponse(cacheKey);
      if (cached !== null) return cached as T;
    }

    // Throttle outgoing requests
    await acquireRateToken();

    let lastErr: Error = new Error('Request failed');
    for (let attempt = 0; attempt < 4; attempt++) {
      // Exponential back-off for retries (1s, 2s, 4s)
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 8000)));
      }

      const headers = this.authHeaders(method, path);
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (networkErr) {
        lastErr = networkErr as Error;
        continue; // retry on network errors
      }

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After') ?? 0);
        await new Promise(r => setTimeout(r, retryAfter > 0 ? retryAfter * 1000 : 2000));
        lastErr = new Error(`Kalshi API 429 rate limit on ${endpoint}`);
        continue; // retry after waiting
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Kalshi API ${method} ${endpoint} → ${res.status}: ${text}`);
      }

      const data = await res.json() as T;
      if (cacheKey) setCachedResponse(cacheKey, data);
      return data;
    }

    throw lastErr;
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
