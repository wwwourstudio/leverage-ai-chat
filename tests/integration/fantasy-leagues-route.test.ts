/**
 * Integration Tests for POST /api/fantasy/leagues and GET /api/fantasy/leagues
 *
 * Strategy: mock @/lib/supabase/server so no real DB calls are made.
 * Tests cover:
 *   - Unauthorized access (no authenticated user)
 *   - Missing required fields (name, sport)
 *   - Invalid sport value
 *   - Successful league creation
 *   - Listing leagues for an authenticated user
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Next.js server mock ───────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextRequest: class {
    private _body: string;
    constructor(_url: string, init: { method?: string; body?: string } = {}) {
      this._body = init.body ?? '{}';
    }
    async json() {
      return JSON.parse(this._body);
    }
  },
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    })),
  },
}));

// ── Supabase server mock ──────────────────────────────────────────────────────
// We build a flexible chainable mock so each test can control auth + DB outcomes.
let mockUser: { id: string } | null = null;
let mockLeagueResult: { data: any; error: any } = { data: null, error: null };
let mockTeamsResult: { error: any } = { error: null };
let mockListResult: { data: any; error: any } = { data: [], error: null };

const mockChain = {
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn().mockImplementation(async () => mockLeagueResult),
};

const mockTeamsChain = {
  insert: vi.fn().mockImplementation(async () => mockTeamsResult),
};

const mockListChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockImplementation(async () => mockListResult),
};

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockImplementation(async () => ({
      data: { user: mockUser },
    })),
  },
  from: vi.fn().mockImplementation((table: string) => {
    if (table === 'fantasy_leagues') return { ...mockChain, ...mockListChain };
    if (table === 'fantasy_teams') return mockTeamsChain;
    return mockChain;
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

// ── Import route AFTER mocks are set up ──────────────────────────────────────
const { POST, GET } = await import('@/app/api/fantasy/leagues/route');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRequest(body: object, method = 'POST') {
  return new NextRequest('http://localhost/api/fantasy/leagues', {
    method,
    body: JSON.stringify(body),
  });
}

// ============================================================================
// POST /api/fantasy/leagues
// ============================================================================

describe('POST /api/fantasy/leagues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockLeagueResult = { data: null, error: null };
    mockTeamsResult = { error: null };
  });

  it('returns 401 when user is not authenticated', async () => {
    mockUser = null;
    const req = makeRequest({ name: 'Test League', sport: 'nfl' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('returns 400 when name is missing', async () => {
    mockUser = { id: 'user-1' };
    const req = makeRequest({ sport: 'nfl' }); // no name
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/missing required/i);
  });

  it('returns 400 when sport is missing', async () => {
    mockUser = { id: 'user-1' };
    const req = makeRequest({ name: 'My League' }); // no sport
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 400 for an invalid sport', async () => {
    mockUser = { id: 'user-1' };
    const req = makeRequest({ name: 'Curling League', sport: 'curling' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/invalid sport/i);
  });

  it('returns 200 and the league on successful creation', async () => {
    mockUser = { id: 'user-1' };
    const createdLeague = {
      id: 'league-abc',
      name: 'Best League',
      sport: 'nfl',
      user_id: 'user-1',
      league_size: 12,
    };
    mockLeagueResult = { data: createdLeague, error: null };

    const req = makeRequest({ name: 'Best League', sport: 'nfl' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.league).toMatchObject({ id: 'league-abc', sport: 'nfl' });
  });

  it('accepts all valid sports', async () => {
    const validSports = ['nfl', 'nba', 'mlb', 'nhl'];
    for (const sport of validSports) {
      mockUser = { id: 'user-1' };
      mockLeagueResult = {
        data: { id: `league-${sport}`, name: 'Test', sport, user_id: 'user-1', league_size: 12 },
        error: null,
      };

      const req = makeRequest({ name: `${sport.toUpperCase()} League`, sport });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    }
  });

  it('returns 500 when Supabase insert fails', async () => {
    mockUser = { id: 'user-1' };
    mockLeagueResult = { data: null, error: { message: 'DB constraint error' } };

    const req = makeRequest({ name: 'Broken League', sport: 'nba' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});

// ============================================================================
// GET /api/fantasy/leagues
// ============================================================================

describe('GET /api/fantasy/leagues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockListResult = { data: [], error: null };
  });

  it('returns 401 when user is not authenticated', async () => {
    mockUser = null;
    const req = makeRequest({}, 'GET');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('returns 200 and an empty array when no leagues exist', async () => {
    mockUser = { id: 'user-1' };
    mockListResult = { data: [], error: null };

    const req = makeRequest({}, 'GET');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.leagues)).toBe(true);
    expect(body.leagues).toHaveLength(0);
  });

  it('returns 200 and the list when leagues exist', async () => {
    mockUser = { id: 'user-1' };
    mockListResult = {
      data: [
        { id: 'l1', name: 'Dynasty', sport: 'nfl', fantasy_teams: [] },
        { id: 'l2', name: 'Redraft', sport: 'nba', fantasy_teams: [] },
      ],
      error: null,
    };

    const req = makeRequest({}, 'GET');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.leagues).toHaveLength(2);
  });

  it('returns 500 when Supabase query fails', async () => {
    mockUser = { id: 'user-1' };
    mockListResult = { data: null, error: { message: 'Connection error' } };

    const req = makeRequest({}, 'GET');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
