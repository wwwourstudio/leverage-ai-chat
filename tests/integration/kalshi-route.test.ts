/**
 * Integration tests for GET /api/kalshi and POST /api/kalshi
 *
 * Strategy: mock @/lib/kalshi-client so no real network calls are made.
 * Each test configures the mock functions and verifies the handler's
 * routing logic, status codes, and response shapes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Next.js server mock ────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    })),
  },
}));

// ── kalshi-client mock ─────────────────────────────────────────────────────
vi.mock('@/lib/kalshi-client', () => ({
  fetchKalshiMarkets: vi.fn(),
  fetchAllKalshiMarkets: vi.fn(),
  fetchSportsMarkets: vi.fn(),
  fetchElectionMarkets: vi.fn(),
  getMarketByTicker: vi.fn(),
  fetchMarketOrderbook: vi.fn().mockResolvedValue(null),
  kalshiMarketToCard: vi.fn(),
}));

import {
  fetchKalshiMarkets,
  fetchAllKalshiMarkets,
  fetchSportsMarkets,
  fetchElectionMarkets,
  getMarketByTicker,
  kalshiMarketToCard,
} from '@/lib/kalshi-client';

const { GET, POST } = await import('@/app/api/kalshi/route');

// ── Helpers ────────────────────────────────────────────────────────────────

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/kalshi');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/kalshi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const SAMPLE_MARKET = {
  ticker: 'NBA-2026-CELTICS-CHAMP',
  title: 'Will the Celtics win the 2026 NBA championship?',
  status: 'open',
  yes_bid: 0.45,
  yes_ask: 0.47,
};

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(fetchKalshiMarkets).mockResolvedValue([]);
  vi.mocked(fetchAllKalshiMarkets).mockResolvedValue([]);
  vi.mocked(fetchSportsMarkets).mockResolvedValue([]);
  vi.mocked(fetchElectionMarkets).mockResolvedValue([]);
  vi.mocked(getMarketByTicker).mockResolvedValue(null);
  vi.mocked(kalshiMarketToCard).mockReturnValue({ type: 'kalshi', title: 'Test' } as any);
});

// ============================================================================
// GET /api/kalshi
// ============================================================================

describe('GET /api/kalshi', () => {

  // ── Ticker lookup ─────────────────────────────────────────────────────

  it('returns the market when a valid ticker is found', async () => {
    vi.mocked(getMarketByTicker).mockResolvedValue(SAMPLE_MARKET as any);

    const res = await GET(makeGetRequest({ ticker: 'NBA-2026-CELTICS-CHAMP' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.markets).toHaveLength(1);
    expect(body.markets[0].ticker).toBe('NBA-2026-CELTICS-CHAMP');
    expect(body.count).toBe(1);
    expect(vi.mocked(getMarketByTicker)).toHaveBeenCalledWith('NBA-2026-CELTICS-CHAMP');
  });

  it('returns 404 when the ticker does not exist', async () => {
    vi.mocked(getMarketByTicker).mockResolvedValue(null);

    const res = await GET(makeGetRequest({ ticker: 'NONEXISTENT' }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not found/i);
  });

  // ── Election markets ─────────────────────────────────────────────────

  it('fetches election markets when type=election', async () => {
    vi.mocked(fetchElectionMarkets).mockResolvedValue([SAMPLE_MARKET] as any);

    const res = await GET(makeGetRequest({ type: 'election' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.category).toBe('election');
    expect(vi.mocked(fetchElectionMarkets)).toHaveBeenCalled();
  });

  it('returns success with empty markets and a message when no election markets exist', async () => {
    vi.mocked(fetchElectionMarkets).mockResolvedValue([]);

    const res = await GET(makeGetRequest({ type: 'election', year: '2026' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.markets).toEqual([]);
    expect(body.message).toBeTruthy();
  });

  it('fetches election markets when category=politics', async () => {
    vi.mocked(fetchElectionMarkets).mockResolvedValue([]);

    const res = await GET(makeGetRequest({ category: 'politics' }));
    await res.json();

    expect(vi.mocked(fetchElectionMarkets)).toHaveBeenCalled();
  });

  // ── Sport mapping ─────────────────────────────────────────────────────

  it('maps sport=nba to category=NBA when fetching markets', async () => {
    vi.mocked(fetchKalshiMarkets).mockResolvedValue([SAMPLE_MARKET] as any);

    const res = await GET(makeGetRequest({ sport: 'nba' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(vi.mocked(fetchKalshiMarkets)).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'NBA' })
    );
  });

  it('maps sport=americanfootball_nfl to NFL', async () => {
    await GET(makeGetRequest({ sport: 'americanfootball_nfl' }));

    expect(vi.mocked(fetchKalshiMarkets)).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'NFL' })
    );
  });

  // ── type param routing ────────────────────────────────────────────────

  it('calls fetchAllKalshiMarkets when type=all', async () => {
    vi.mocked(fetchAllKalshiMarkets).mockResolvedValue([SAMPLE_MARKET] as any);

    const res = await GET(makeGetRequest({ type: 'all' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(vi.mocked(fetchAllKalshiMarkets)).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'open' })
    );
  });

  it('calls fetchSportsMarkets when type=sports and no category', async () => {
    vi.mocked(fetchSportsMarkets).mockResolvedValue([SAMPLE_MARKET] as any);

    const res = await GET(makeGetRequest({ type: 'sports' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(vi.mocked(fetchSportsMarkets)).toHaveBeenCalled();
  });

  it('calls fetchKalshiMarkets when type=sports and category is set', async () => {
    vi.mocked(fetchKalshiMarkets).mockResolvedValue([SAMPLE_MARKET] as any);

    await GET(makeGetRequest({ type: 'sports', category: 'NBA' }));

    expect(vi.mocked(fetchKalshiMarkets)).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'NBA' })
    );
  });

  it('uses default fetchAllKalshiMarkets when no type or category', async () => {
    vi.mocked(fetchAllKalshiMarkets).mockResolvedValue([]);

    await GET(makeGetRequest({}));

    expect(vi.mocked(fetchAllKalshiMarkets)).toHaveBeenCalled();
  });

  // ── Response shape ────────────────────────────────────────────────────

  it('returns success=true, count, and timestamp on success', async () => {
    vi.mocked(fetchAllKalshiMarkets).mockResolvedValue([SAMPLE_MARKET, SAMPLE_MARKET] as any);

    const res = await GET(makeGetRequest({}));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
    expect(body.timestamp).toBeTruthy();
  });

  // ── Error handling ────────────────────────────────────────────────────

  it('returns 500 when fetchAllKalshiMarkets throws', async () => {
    vi.mocked(fetchAllKalshiMarkets).mockRejectedValue(new Error('Network error'));

    const res = await GET(makeGetRequest({}));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Network error');
    expect(body.markets).toEqual([]);
  });
});

// ============================================================================
// POST /api/kalshi
// ============================================================================

describe('POST /api/kalshi', () => {
  it('fetches markets and converts them to cards', async () => {
    vi.mocked(fetchKalshiMarkets).mockResolvedValue([SAMPLE_MARKET, SAMPLE_MARKET] as any);
    vi.mocked(kalshiMarketToCard).mockReturnValue({ type: 'kalshi', title: 'Card' } as any);

    const res = await POST(makePostRequest({ sport: 'nba', limit: 2 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.cards).toHaveLength(2);
    expect(body.count).toBe(2);
    expect(body.dataSources).toContain('Kalshi Prediction Markets (Real-time)');
    expect(vi.mocked(kalshiMarketToCard)).toHaveBeenCalledTimes(2);
  });

  it('maps sport to category in POST requests', async () => {
    vi.mocked(fetchKalshiMarkets).mockResolvedValue([]);

    await POST(makePostRequest({ sport: 'nfl' }));

    expect(vi.mocked(fetchKalshiMarkets)).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'NFL' })
    );
  });

  it('returns 500 on unexpected errors', async () => {
    vi.mocked(fetchKalshiMarkets).mockRejectedValue(new Error('Kalshi down'));

    const res = await POST(makePostRequest({ sport: 'nba' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Kalshi down');
    expect(body.cards).toEqual([]);
  });
});
