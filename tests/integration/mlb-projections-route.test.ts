/**
 * Integration tests for GET /api/mlb-projections
 *
 * Strategy: mock all external fetches (MLB Stats API, Baseball Savant, Open-Meteo)
 * and Supabase so no real network calls are made. Verifies that:
 *   - The route returns the correct shape for all outputFor modes
 *   - Success/error flags are set correctly
 *   - The projection engine falls through gracefully when APIs return minimal data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Next.js server mock ──────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL;
    constructor(url: string) { this.nextUrl = new URL(url); }
  },
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    })),
  },
}));

// ── Supabase mock (prevent real DB calls) ────────────────────────────────────
const mockSupabaseChain = {
  select:   vi.fn().mockReturnThis(),
  insert:   vi.fn().mockReturnThis(),
  upsert:   vi.fn().mockReturnThis(),
  eq:       vi.fn().mockReturnThis(),
  gte:      vi.fn().mockReturnThis(),
  lte:      vi.fn().mockReturnThis(),
  order:    vi.fn().mockReturnThis(),
  limit:    vi.fn().mockReturnThis(),
  single:   vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
};
const mockSupabaseClient = { from: vi.fn(() => mockSupabaseChain) };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// ── MLB Stats API mock response ──────────────────────────────────────────────
const MLB_STATS_EMPTY = JSON.stringify({ dates: [], totalGames: 0 });

// ── Baseball Savant mock (minimal CSV for hitter + pitcher) ─────────────────
const SAVANT_HITTER_CSV = [
  'player_id,last_name,first_name,avg_hit_speed,avg_hit_angle,barrel_batted_rate,xwoba,iso,hr_flyball_ratio,sprint_speed,whiff_percent,hard_hit_percent',
  '660271,Judge,Aaron,95.3,14.2,18.5,0.440,0.310,0.28,27.5,28.0,55.0',
  '545361,Trout,Mike,94.1,13.8,16.0,0.415,0.280,0.24,28.1,25.5,52.3',
].join('\n');

const SAVANT_PITCHER_CSV = [
  'player_id,last_name,first_name,p_k_percent,p_bb_percent,p_era,p_whip,velocity,spin_rate,extension',
  '543037,Cole,Gerrit,31.5,5.2,3.10,0.98,97.2,2521,6.5',
  '605483,deGrom,Jacob,33.0,5.5,2.67,0.81,99.0,2450,6.8',
].join('\n');

// ── Weather mock ─────────────────────────────────────────────────────────────
const WEATHER_OK = JSON.stringify({
  hourly: {
    windspeed_10m: [8, 9, 10],
    winddirection_10m: [180, 185, 190],
    temperature_2m: [72, 74, 73],
  },
});

// ── Route helper ─────────────────────────────────────────────────────────────
async function importRoute() {
  vi.resetModules();
  const { GET } = await import('@/app/api/mlb-projections/route');
  return GET;
}

function makeReq(url: string) {
  const { NextRequest } = require('next/server');
  return new NextRequest(url);
}

// ── Global fetch dispatch ────────────────────────────────────────────────────
beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);

    if (url.includes('statsapi.mlb.com')) {
      return new Response(MLB_STATS_EMPTY, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('baseballsavant.mlb.com') && url.includes('pitcher')) {
      return new Response(SAVANT_PITCHER_CSV, {
        status: 200,
        headers: { 'Content-Type': 'text/csv' },
      });
    }
    if (url.includes('baseballsavant.mlb.com')) {
      return new Response(SAVANT_HITTER_CSV, {
        status: 200,
        headers: { 'Content-Type': 'text/csv' },
      });
    }
    if (url.includes('open-meteo.com')) {
      return new Response(WEATHER_OK, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Odds API / unknown — return empty
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/mlb-projections — default (projections mode)', () => {
  it('returns 200 with success=true and source=LeverageMetrics', async () => {
    const GET = await importRoute();
    const res = await GET(makeReq('http://localhost/api/mlb-projections?playerType=all&limit=3'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.source).toBe('LeverageMetrics');
  });

  it('returns cards as an array', async () => {
    const GET = await importRoute();
    const res = await GET(makeReq('http://localhost/api/mlb-projections?limit=3'));
    const body = await res.json();
    expect(Array.isArray(body.cards)).toBe(true);
  });

  it('count field matches cards array length', async () => {
    const GET = await importRoute();
    const res = await GET(makeReq('http://localhost/api/mlb-projections?limit=3'));
    const body = await res.json();
    expect(body.count).toBe(body.cards.length);
  });

  it('date field is present', async () => {
    const GET = await importRoute();
    const res = await GET(makeReq('http://localhost/api/mlb-projections?limit=3'));
    const body = await res.json();
    expect(body.date).toBeDefined();
    expect(typeof body.date).toBe('string');
  });

  it('respects date query parameter', async () => {
    const GET = await importRoute();
    const res = await GET(makeReq('http://localhost/api/mlb-projections?date=2025-07-04&limit=3'));
    const body = await res.json();
    expect(body.date).toBe('2025-07-04');
  });
});

describe('GET /api/mlb-projections — outputFor=dfs', () => {
  it('returns success with outputFor=dfs', async () => {
    const GET = await importRoute();
    const res = await GET(makeReq('http://localhost/api/mlb-projections?outputFor=dfs&limit=3'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.outputFor).toBe('dfs');
  });

  it('cards is an array', async () => {
    const GET = await importRoute();
    const res = await GET(makeReq('http://localhost/api/mlb-projections?outputFor=dfs&limit=3'));
    const body = await res.json();
    expect(Array.isArray(body.cards)).toBe(true);
  });
});

describe('GET /api/mlb-projections — outputFor=fantasy', () => {
  it('returns success with outputFor=fantasy', async () => {
    const GET = await importRoute();
    const res = await GET(makeReq('http://localhost/api/mlb-projections?outputFor=fantasy&limit=3'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.outputFor).toBe('fantasy');
  });
});

describe('GET /api/mlb-projections — outputFor=betting', () => {
  it('returns success with outputFor=betting', async () => {
    const GET = await importRoute();
    const res = await GET(makeReq('http://localhost/api/mlb-projections?outputFor=betting&limit=3'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.outputFor).toBe('betting');
  });
});

describe('GET /api/mlb-projections — single player lookup', () => {
  it('returns success for player=Judge', async () => {
    const GET = await importRoute();
    const res = await GET(makeReq('http://localhost/api/mlb-projections?player=Judge&playerType=hitter'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.cards)).toBe(true);
  });
});

describe('GET /api/mlb-projections — limit enforcement', () => {
  it('clamps limit to 15 maximum', async () => {
    const GET = await importRoute();
    const res = await GET(makeReq('http://localhost/api/mlb-projections?limit=99'));
    const body = await res.json();
    expect(body.success).toBe(true);
    // Pipeline may return fewer than limit but never more than clamped 15
    expect(body.cards.length).toBeLessThanOrEqual(15);
  });

  it('clamps limit to 1 minimum (does not error on limit=0)', async () => {
    const GET = await importRoute();
    const res = await GET(makeReq('http://localhost/api/mlb-projections?limit=0'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
