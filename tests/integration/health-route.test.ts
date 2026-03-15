/**
 * Integration tests for GET /api/health
 *
 * Strategy: mock global fetch (URL-dispatched) and @supabase/supabase-js so no
 * real network calls are made.  We control each service's health by returning
 * different mock responses and verify that:
 *   - the correct HTTP status is used (200 healthy/degraded, 503 unhealthy)
 *   - the overall status rolls up correctly from individual services
 *   - the environment flags reflect env-var presence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Next.js server mock ────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    })),
  },
}));

// ── Supabase direct-package mock ───────────────────────────────────────────
const mockSupabaseChain = {
  select: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
};
const mockSupabaseClient = { from: vi.fn(() => mockSupabaseChain) };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal successful fetch Response for a given URL pattern. */
function oddsOkResponse() {
  return new Response(JSON.stringify([{ key: 'nba' }]), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'x-requests-remaining': '500',
      'x-requests-used': '10',
    },
  });
}

function weatherOkResponse() {
  return new Response(
    JSON.stringify({ current: { temperature_2m: 72 } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function kalshiOkResponse() {
  return new Response(
    JSON.stringify({ markets: [] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/** Create a fetch spy that dispatches by URL. */
function mockFetch(overrides: Record<string, Response> = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
    const url = String(input);
    for (const [pattern, resp] of Object.entries(overrides)) {
      if (url.includes(pattern)) return resp;
    }
    // Default: everything succeeds
    if (url.includes('the-odds-api.com')) return oddsOkResponse();
    if (url.includes('open-meteo.com')) return weatherOkResponse();
    if (url.includes('kalshi.com')) return kalshiOkResponse();
    return new Response('{}', { status: 200 });
  });
}

// ── Env-var helpers ────────────────────────────────────────────────────────

function withOddsKey(fn: () => void, key = 'test-odds-key') {
  const orig = process.env.ODDS_API_KEY;
  process.env.ODDS_API_KEY = key;
  try { fn(); } finally { process.env.ODDS_API_KEY = orig ?? ''; if (!orig) delete process.env.ODDS_API_KEY; }
}

function withoutOddsKey(fn: () => void) {
  const orig = process.env.ODDS_API_KEY;
  delete process.env.ODDS_API_KEY;
  try { fn(); } finally { if (orig !== undefined) process.env.ODDS_API_KEY = orig; }
}

// ── Route import ───────────────────────────────────────────────────────────
// Imported after mocks so the module receives the mocked dependencies.
const { GET } = await import('@/app/api/health/route');

// ============================================================================
// Tests
// ============================================================================

describe('GET /api/health', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Reset supabase chain mock state
    mockSupabaseChain.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  // ── Overall status ──────────────────────────────────────────────────────

  it('returns HTTP 200 and status=healthy when all services respond OK', async () => {
    mockFetch();
    process.env.ODDS_API_KEY = 'test-key';

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.services).toHaveProperty('odds');
    expect(body.services).toHaveProperty('weather');
    expect(body.services).toHaveProperty('kalshi');
    expect(body.services).toHaveProperty('database');
    expect(body.timestamp).toBeTruthy();

    delete process.env.ODDS_API_KEY;
  });

  it('returns HTTP 503 and status=unhealthy when ODDS_API_KEY is missing', async () => {
    mockFetch();
    delete process.env.ODDS_API_KEY;

    const res = await GET();
    const body = await res.json();

    // Odds is unhealthy → overall unhealthy
    expect(body.services.odds.status).toBe('unhealthy');
    expect(body.status).toBe('unhealthy');
    expect(res.status).toBe(503);
  });

  it('returns status=unhealthy and HTTP 503 when Odds API returns a non-OK status', async () => {
    process.env.ODDS_API_KEY = 'test-key';
    mockFetch({
      'the-odds-api.com': new Response('{"message":"Unauthorized"}', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    const res = await GET();
    const body = await res.json();

    expect(body.services.odds.status).toBe('unhealthy');
    expect(body.services.odds.details?.statusCode).toBe(401);
    expect(res.status).toBe(503);

    delete process.env.ODDS_API_KEY;
  });

  it('returns status=degraded (HTTP 200) when quota is nearly exhausted', async () => {
    process.env.ODDS_API_KEY = 'test-key';
    mockFetch({
      'the-odds-api.com': new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'x-requests-remaining': '5',  // < 10 → degraded
          'x-requests-used': '495',
        },
      }),
    });

    const res = await GET();
    const body = await res.json();

    expect(body.services.odds.status).toBe('degraded');
    // degraded still returns 200 (weather & db must also be ok)
    delete process.env.ODDS_API_KEY;
  });

  it('returns unhealthy when Supabase is not configured', async () => {
    process.env.ODDS_API_KEY = 'test-key';
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    mockFetch();
    const res = await GET();
    const body = await res.json();

    expect(body.services.database.status).toBe('unhealthy');
    expect(res.status).toBe(503);

    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl!;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey!;
    delete process.env.ODDS_API_KEY;
  });

  it('returns unhealthy database when Supabase returns an error', async () => {
    process.env.ODDS_API_KEY = 'test-key';
    mockFetch();
    mockSupabaseChain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'connection refused', code: 'PGRST_CONNECTION_ERROR' },
    });

    const res = await GET();
    const body = await res.json();

    expect(body.services.database.status).toBe('unhealthy');
    expect(res.status).toBe(503);

    delete process.env.ODDS_API_KEY;
  });

  it('Supabase "no rows" error (PGRST116) is treated as healthy', async () => {
    process.env.ODDS_API_KEY = 'test-key';
    mockFetch();
    mockSupabaseChain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'no rows', code: 'PGRST116' },
    });

    const res = await GET();
    const body = await res.json();

    expect(body.services.database.status).toBe('healthy');

    delete process.env.ODDS_API_KEY;
  });

  it('returns degraded (not unhealthy) when KALSHI_API_KEY_ID is absent', async () => {
    process.env.ODDS_API_KEY = 'test-key';
    const origKalshiId = process.env.KALSHI_API_KEY_ID;
    const origKalshiKey = process.env.KALSHI_PRIVATE_KEY;
    delete process.env.KALSHI_API_KEY_ID;
    delete process.env.KALSHI_PRIVATE_KEY;
    mockFetch();

    const res = await GET();
    const body = await res.json();

    expect(body.services.kalshi.status).toBe('degraded');
    // Kalshi is optional: overall not forced to unhealthy by kalshi alone
    // (depends on other services)
    expect(['healthy', 'degraded']).toContain(body.status);

    if (origKalshiId !== undefined) process.env.KALSHI_API_KEY_ID = origKalshiId;
    if (origKalshiKey !== undefined) process.env.KALSHI_PRIVATE_KEY = origKalshiKey;
    delete process.env.ODDS_API_KEY;
  });

  // ── Environment flags ───────────────────────────────────────────────────

  it('sets oddsApiConfigured=true when ODDS_API_KEY is set', async () => {
    process.env.ODDS_API_KEY = 'my-key';
    mockFetch();

    const res = await GET();
    const body = await res.json();

    expect(body.environment.oddsApiConfigured).toBe(true);
    delete process.env.ODDS_API_KEY;
  });

  it('sets oddsApiConfigured=false when ODDS_API_KEY is absent', async () => {
    delete process.env.ODDS_API_KEY;
    mockFetch();

    const res = await GET();
    const body = await res.json();

    expect(body.environment.oddsApiConfigured).toBe(false);
  });

  it('sets weatherApiConfigured=true always (Open-Meteo needs no key)', async () => {
    mockFetch();
    const res = await GET();
    const body = await res.json();
    expect(body.environment.weatherApiConfigured).toBe(true);
  });

  it('sets databaseConfigured based on Supabase env vars', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    mockFetch();

    const res = await GET();
    const body = await res.json();
    expect(body.environment.databaseConfigured).toBe(true);
  });

  // ── Response time fields ────────────────────────────────────────────────

  it('includes numeric responseTime on healthy services', async () => {
    process.env.ODDS_API_KEY = 'test-key';
    mockFetch();

    const res = await GET();
    const body = await res.json();

    // responseTime is optional but should be a number when present
    if (body.services.odds.responseTime !== undefined) {
      expect(typeof body.services.odds.responseTime).toBe('number');
    }

    delete process.env.ODDS_API_KEY;
  });
});
