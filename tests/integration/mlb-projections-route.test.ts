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

// ── Baseball Savant mock (JSON — matches expected_statistics?csv=false format) ─
const SAVANT_HITTER_JSON = [
  {
    player_id: '660271', last_name: 'Judge', first_name: 'Aaron',
    pa: '450', launch_speed: '95.3', max_launch_speed: '119.2',
    launch_angle: '14.2', barrel_batted_rate: '18.5', hard_hit_percent: '55.0',
    sweet_spot_percent: '38.0', est_woba: '0.440', est_ba: '0.290',
    est_slg: '0.600', pull_percent: '42.0', k_percent: '25.0',
    bb_percent: '12.0', team_name_alt: 'NYY',
  },
  {
    player_id: '545361', last_name: 'Trout', first_name: 'Mike',
    pa: '380', launch_speed: '94.1', max_launch_speed: '117.5',
    launch_angle: '13.8', barrel_batted_rate: '16.0', hard_hit_percent: '52.3',
    sweet_spot_percent: '36.0', est_woba: '0.415', est_ba: '0.270',
    est_slg: '0.550', pull_percent: '39.0', k_percent: '22.0',
    bb_percent: '15.0', team_name_alt: 'LAA',
  },
];

const SAVANT_PITCHER_JSON = [
  {
    player_id: '543037', last_name: 'Cole', first_name: 'Gerrit',
    p_ip: '180', k_percent: '31.5', bb_percent: '5.2', home_run_per_9: '1.1',
    effective_speed: '97.2', release_spin_rate: '2521', release_extension: '6.5',
    release_pos_z: '5.9', pfx_x: '-8.2', pfx_z: '12.1',
    fastball_percent: '55', breaking_percent: '28', offspeed_percent: '17',
    whiff_percent: '30.0', team_name_alt: 'NYY',
  },
  {
    player_id: '605483', last_name: 'deGrom', first_name: 'Jacob',
    p_ip: '160', k_percent: '33.0', bb_percent: '5.5', home_run_per_9: '0.9',
    effective_speed: '99.0', release_spin_rate: '2450', release_extension: '6.8',
    release_pos_z: '6.1', pfx_x: '-9.0', pfx_z: '13.5',
    fastball_percent: '60', breaking_percent: '25', offspeed_percent: '15',
    whiff_percent: '33.0', team_name_alt: 'NYM',
  },
];

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
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
    const url = String(input);

    if (url.includes('statsapi.mlb.com')) {
      return new Response(MLB_STATS_EMPTY, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('baseballsavant.mlb.com') && url.includes('type=pitcher')) {
      return new Response(JSON.stringify(SAVANT_PITCHER_JSON), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('baseballsavant.mlb.com')) {
      return new Response(JSON.stringify(SAVANT_HITTER_JSON), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
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
