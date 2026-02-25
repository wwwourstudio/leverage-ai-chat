/**
 * Integration tests for POST /api/weather and GET /api/weather
 *
 * Strategy: mock @/lib/weather/index so no real Open-Meteo calls are made.
 * Tests cover all branching paths in both handlers:
 *   - coordinates → fetchWeatherForLocation
 *   - team name   → getGameTimeForecast
 *   - missing params → 400
 *   - service returns null → 404
 *   - unexpected errors → 500
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Next.js server mock ────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextRequest: class MockNextRequest extends Request {},
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    })),
  },
}));

// ── Weather lib mock ───────────────────────────────────────────────────────
vi.mock('@/lib/weather/index', () => ({
  fetchWeatherForLocation: vi.fn(),
  getGameTimeForecast: vi.fn(),
}));

import { fetchWeatherForLocation, getGameTimeForecast } from '@/lib/weather/index';
const { POST, GET } = await import('@/app/api/weather/route');

// ── Fixtures ───────────────────────────────────────────────────────────────

const SAMPLE_WEATHER = {
  temperature: 72,
  windSpeed: 8,
  condition: 'Clear',
  humidity: 45,
};

const SAMPLE_FORECAST = {
  kickoff: SAMPLE_WEATHER,
  team: 'Green Bay Packers',
  stadium: 'Lambeau Field',
  windImpact: 'low',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/weather', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/weather');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(fetchWeatherForLocation).mockResolvedValue(null);
  vi.mocked(getGameTimeForecast).mockResolvedValue(null);
});

// ============================================================================
// POST /api/weather
// ============================================================================

describe('POST /api/weather', () => {

  // ── Coordinate-based ──────────────────────────────────────────────────

  it('returns weather data when coordinates are provided', async () => {
    vi.mocked(fetchWeatherForLocation).mockResolvedValue(SAMPLE_WEATHER as any);

    const res = await POST(makePostRequest({ latitude: 40.71, longitude: -74.01 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.weather).toEqual(SAMPLE_WEATHER);
    expect(body.location).toEqual({ latitude: 40.71, longitude: -74.01 });
    expect(body.timestamp).toBeTruthy();
    expect(vi.mocked(fetchWeatherForLocation)).toHaveBeenCalledWith(40.71, -74.01);
  });

  it('returns 404 when coordinates are valid but weather is unavailable', async () => {
    vi.mocked(fetchWeatherForLocation).mockResolvedValue(null);

    const res = await POST(makePostRequest({ latitude: 0, longitude: 0 }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unavailable/i);
    expect(body.weather).toBeNull();
  });

  // ── Team-based ────────────────────────────────────────────────────────

  it('returns forecast when team is provided', async () => {
    vi.mocked(getGameTimeForecast).mockResolvedValue(SAMPLE_FORECAST as any);

    const res = await POST(makePostRequest({
      team: 'Green Bay Packers',
      gameTime: '2026-01-15T18:00:00Z',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.forecast).toEqual(SAMPLE_FORECAST);
    expect(body.team).toBe('Green Bay Packers');
    expect(body.gameTime).toBeTruthy();
  });

  it('returns 404 when team forecast is unavailable', async () => {
    vi.mocked(getGameTimeForecast).mockResolvedValue(null);

    const res = await POST(makePostRequest({ team: 'Unknown Team' }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Unknown Team/);
    expect(body.forecast).toBeNull();
  });

  it('uses current time when gameTime is not provided with team', async () => {
    vi.mocked(getGameTimeForecast).mockResolvedValue(SAMPLE_FORECAST as any);

    await POST(makePostRequest({ team: 'Chiefs' }));

    expect(vi.mocked(getGameTimeForecast)).toHaveBeenCalledWith('Chiefs', expect.any(Date));
  });

  // ── Validation ────────────────────────────────────────────────────────

  it('returns 400 when neither coordinates nor team are provided', async () => {
    const res = await POST(makePostRequest({ someOtherField: 'x' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/missing/i);
  });

  // ── Error handling ────────────────────────────────────────────────────

  it('returns 500 when fetchWeatherForLocation throws', async () => {
    vi.mocked(fetchWeatherForLocation).mockRejectedValue(new Error('Open-Meteo down'));

    const res = await POST(makePostRequest({ latitude: 40.71, longitude: -74.01 }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Open-Meteo down');
  });

  it('returns 500 with generic message when a non-Error is thrown', async () => {
    vi.mocked(fetchWeatherForLocation).mockRejectedValue('string rejection');

    const res = await POST(makePostRequest({ latitude: 40.71, longitude: -74.01 }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
  });
});

// ============================================================================
// GET /api/weather
// ============================================================================

describe('GET /api/weather', () => {

  // ── Coordinate-based ──────────────────────────────────────────────────

  it('returns weather data when valid lat/lon are in query params', async () => {
    vi.mocked(fetchWeatherForLocation).mockResolvedValue(SAMPLE_WEATHER as any);

    const res = await GET(makeGetRequest({ latitude: '40.71', longitude: '-74.01' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.weather).toEqual(SAMPLE_WEATHER);
    expect(body.location).toEqual({ latitude: 40.71, longitude: -74.01 });
    expect(vi.mocked(fetchWeatherForLocation)).toHaveBeenCalledWith(40.71, -74.01);
  });

  it('returns 400 when latitude is not a valid number', async () => {
    const res = await GET(makeGetRequest({ latitude: 'abc', longitude: '-74.01' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/invalid/i);
  });

  it('returns 400 when longitude is not a valid number', async () => {
    const res = await GET(makeGetRequest({ latitude: '40.71', longitude: 'xyz' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 404 when coordinates are valid but weather is unavailable', async () => {
    vi.mocked(fetchWeatherForLocation).mockResolvedValue(null);

    const res = await GET(makeGetRequest({ latitude: '90', longitude: '180' }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.weather).toBeNull();
  });

  // ── Team-based ────────────────────────────────────────────────────────

  it('returns forecast.kickoff as weather when team is queried', async () => {
    vi.mocked(getGameTimeForecast).mockResolvedValue(SAMPLE_FORECAST as any);

    const res = await GET(makeGetRequest({ team: 'Green Bay Packers' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.weather).toEqual(SAMPLE_WEATHER); // kickoff property
    expect(body.team).toBe('Green Bay Packers');
  });

  it('returns 404 when team forecast is unavailable', async () => {
    vi.mocked(getGameTimeForecast).mockResolvedValue(null);

    const res = await GET(makeGetRequest({ team: 'Unknown Team' }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  // ── Validation ────────────────────────────────────────────────────────

  it('returns 400 when no query parameters are provided', async () => {
    const res = await GET(makeGetRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/missing/i);
  });

  // ── Error handling ────────────────────────────────────────────────────

  it('returns 500 when fetchWeatherForLocation throws', async () => {
    vi.mocked(fetchWeatherForLocation).mockRejectedValue(new Error('API timeout'));

    const res = await GET(makeGetRequest({ latitude: '40.71', longitude: '-74.01' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('API timeout');
  });
});
