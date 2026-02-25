/**
 * Integration tests for POST /api/fantasy/waivers and GET /api/fantasy/waivers
 *
 * Strategy: mock @/lib/supabase/server and @/lib/fantasy/waiver/waiver-engine.
 * Tests cover:
 *   - Auth gate (401)
 *   - Validation (400)
 *   - League not found (404)
 *   - Subscription tier gating (403 for free tier on waiver recommendations)
 *   - action=recommend: basic vs full tier differences
 *   - action=submit: happy path and DB error
 *   - action=invalid: 400
 *   - GET: list waivers with optional filters
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Next.js server mock ──────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextRequest: class MockNextRequest extends Request {},
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    })),
  },
}));

// ── Supabase mock ─────────────────────────────────────────────────────────────
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
};
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// ── Waiver engine mock ────────────────────────────────────────────────────────
const mockDetectBreakoutCandidates = vi.fn();
const mockGenerateWaiverRecommendations = vi.fn();
vi.mock('@/lib/fantasy/waiver/waiver-engine', () => ({
  detectBreakoutCandidates: mockDetectBreakoutCandidates,
  generateWaiverRecommendations: mockGenerateWaiverRecommendations,
}));

// ── Route import ─────────────────────────────────────────────────────────────
const { POST, GET } = await import('@/app/api/fantasy/waivers/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/fantasy/waivers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/fantasy/waivers');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

/** Build a thenable Supabase query chain that resolves to `result`. */
function makeChain(data: any = null, error: any = null) {
  const result = { data, error };
  const p = Promise.resolve(result);
  const chain: any = {};
  const returnSelf = () => chain;
  Object.assign(chain, {
    select: vi.fn(returnSelf),
    insert: vi.fn(returnSelf),
    update: vi.fn(returnSelf),
    delete: vi.fn(returnSelf),
    eq: vi.fn(returnSelf),
    neq: vi.fn(returnSelf),
    in: vi.fn(returnSelf),
    is: vi.fn(returnSelf),
    order: vi.fn(returnSelf),
    limit: vi.fn(returnSelf),
    single: vi.fn(() => p),
    maybeSingle: vi.fn(() => p),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  });
  return chain;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_USER = { id: 'user-1', email: 'test@example.com' };

const SAMPLE_LEAGUE = {
  id: 'league-1',
  user_id: 'user-1',
  sport: 'nfl',
  season_year: 2025,
  faab_budget: 100,
  roster_slots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BENCH: 6 },
};

const SAMPLE_WAIVER = {
  id: 'waiver-1',
  league_id: 'league-1',
  team_id: 'team-1',
  add_player: 'Jaylen Warren',
  drop_player: null,
  faab_bid: 15,
  status: 'pending',
  week: 12,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: SAMPLE_USER } });
  mockDetectBreakoutCandidates.mockReturnValue([]);
  mockGenerateWaiverRecommendations.mockReturnValue([]);
});

// ============================================================================
// POST /api/fantasy/waivers
// ============================================================================

describe('POST /api/fantasy/waivers', () => {

  // ── Auth ───────────────────────────────────────────────────────────────────

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await POST(makePostRequest({
      action: 'recommend',
      leagueId: 'league-1',
      teamId: 'team-1',
    }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unauthorized/i);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it('returns 400 when leagueId is missing', async () => {
    const res = await POST(makePostRequest({ action: 'recommend', teamId: 'team-1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/leagueId/i);
  });

  it('returns 400 when teamId is missing', async () => {
    const res = await POST(makePostRequest({ action: 'recommend', leagueId: 'league-1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/teamId/i);
  });

  // ── Resource guards ────────────────────────────────────────────────────────

  it('returns 404 when league is not found', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Not found' }));

    const res = await POST(makePostRequest({
      action: 'recommend',
      leagueId: 'nonexistent',
      teamId: 'team-1',
    }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/league not found/i);
  });

  // ── Subscription tier gating ───────────────────────────────────────────────

  it('returns 403 for recommend action when user has free tier', async () => {
    // free tier does not include waiver_rankings_basic
    mockFrom
      .mockReturnValueOnce(makeChain(SAMPLE_LEAGUE))   // league found
      .mockReturnValueOnce(makeChain({ tier: 'free' })); // subscription tier

    const res = await POST(makePostRequest({
      action: 'recommend',
      leagueId: 'league-1',
      teamId: 'team-1',
    }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/core tier/i);
  });

  it('allows recommend action for core tier (basic access)', async () => {
    // core tier has waiver_rankings_basic
    mockFrom
      .mockReturnValueOnce(makeChain(SAMPLE_LEAGUE))    // league
      .mockReturnValueOnce(makeChain({ tier: 'core' })) // subscription
      .mockReturnValueOnce(makeChain([]))                // roster
      .mockReturnValueOnce(makeChain([]))                // projections
      .mockReturnValueOnce(makeChain([]))                // all teams
      .mockReturnValueOnce(makeChain([]));               // all rosters

    const res = await POST(makePostRequest({
      action: 'recommend',
      leagueId: 'league-1',
      teamId: 'team-1',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.recommendations).toBeDefined();
    expect(body.meta.tier).toBe('core');
  });

  it('limits recommend results to 5 for basic tier', async () => {
    // core has basic only → max 5 results
    const manyRecs = Array.from({ length: 20 }, (_, i) => ({
      playerName: `Player ${i}`,
      position: 'WR',
      priority: i,
    }));
    mockGenerateWaiverRecommendations.mockReturnValueOnce(manyRecs);

    mockFrom
      .mockReturnValueOnce(makeChain(SAMPLE_LEAGUE))
      .mockReturnValueOnce(makeChain({ tier: 'core' }))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]));

    const res = await POST(makePostRequest({
      action: 'recommend',
      leagueId: 'league-1',
      teamId: 'team-1',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.recommendations.length).toBeLessThanOrEqual(5);
  });

  it('allows up to 20 results and includes breakout candidates for pro tier', async () => {
    // pro has waiver_rankings_full → hasFull=true
    const manyRecs = Array.from({ length: 25 }, (_, i) => ({
      playerName: `Player ${i}`,
      position: 'WR',
      priority: i,
    }));
    const breakouts = [{ playerName: 'Emerging Star', zScore: 2.5 }];
    mockGenerateWaiverRecommendations.mockReturnValueOnce(manyRecs);
    mockDetectBreakoutCandidates.mockReturnValueOnce(breakouts);

    mockFrom
      .mockReturnValueOnce(makeChain(SAMPLE_LEAGUE))
      .mockReturnValueOnce(makeChain({ tier: 'pro' }))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]));

    const res = await POST(makePostRequest({
      action: 'recommend',
      leagueId: 'league-1',
      teamId: 'team-1',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.recommendations.length).toBeLessThanOrEqual(20);
    expect(body.breakoutCandidates).toHaveLength(1);
    expect(body.meta.tier).toBe('pro');
  });

  it('hides breakout candidates for basic (core) tier', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(SAMPLE_LEAGUE))
      .mockReturnValueOnce(makeChain({ tier: 'core' }))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]));

    const res = await POST(makePostRequest({
      action: 'recommend',
      leagueId: 'league-1',
      teamId: 'team-1',
    }));
    const body = await res.json();

    expect(body.breakoutCandidates).toEqual([]);
  });

  // ── action=submit ──────────────────────────────────────────────────────────

  it('submits a waiver claim and returns the created record', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(SAMPLE_LEAGUE))     // league
      .mockReturnValueOnce(makeChain({ tier: 'core' }))  // subscription
      .mockReturnValueOnce(makeChain(SAMPLE_WAIVER));    // insert waiver

    const res = await POST(makePostRequest({
      action: 'submit',
      leagueId: 'league-1',
      teamId: 'team-1',
      addPlayer: 'Jaylen Warren',
      dropPlayer: null,
      faabBid: 15,
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.waiver).toMatchObject({ add_player: 'Jaylen Warren' });
  });

  it('returns 400 when addPlayer is missing in submit action', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(SAMPLE_LEAGUE))
      .mockReturnValueOnce(makeChain({ tier: 'core' }));

    const res = await POST(makePostRequest({
      action: 'submit',
      leagueId: 'league-1',
      teamId: 'team-1',
      // addPlayer missing
      faabBid: 15,
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/addPlayer/i);
  });

  it('returns 500 when waiver_transactions insert fails', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(SAMPLE_LEAGUE))
      .mockReturnValueOnce(makeChain({ tier: 'core' }))
      .mockReturnValueOnce(makeChain(null, { message: 'DB error' }));

    const res = await POST(makePostRequest({
      action: 'submit',
      leagueId: 'league-1',
      teamId: 'team-1',
      addPlayer: 'Jaylen Warren',
    }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/failed to submit/i);
  });

  // ── Invalid action ─────────────────────────────────────────────────────────

  it('returns 400 for an unrecognized action', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(SAMPLE_LEAGUE))
      .mockReturnValueOnce(makeChain({ tier: 'pro' }));

    const res = await POST(makePostRequest({
      action: 'invalid_action',
      leagueId: 'league-1',
      teamId: 'team-1',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/invalid action/i);
  });
});

// ============================================================================
// GET /api/fantasy/waivers
// ============================================================================

describe('GET /api/fantasy/waivers', () => {

  // ── Auth ───────────────────────────────────────────────────────────────────

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await GET(makeGetRequest({ leagueId: 'league-1' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unauthorized/i);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it('returns 400 when leagueId query param is missing', async () => {
    const res = await GET(makeGetRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/leagueId/i);
  });

  // ── Resource guard ─────────────────────────────────────────────────────────

  it('returns 404 when league is not found or not owned by user', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null)); // league not found

    const res = await GET(makeGetRequest({ leagueId: 'nonexistent' }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/league not found/i);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('returns list of waiver transactions for a league', async () => {
    const waivers = [SAMPLE_WAIVER, { ...SAMPLE_WAIVER, id: 'waiver-2' }];
    mockFrom
      .mockReturnValueOnce(makeChain({ id: 'league-1' }))  // league verification
      .mockReturnValueOnce(makeChain(waivers));              // waiver transactions

    const res = await GET(makeGetRequest({ leagueId: 'league-1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.waivers).toHaveLength(2);
  });

  it('returns empty array when no waivers exist for the league', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ id: 'league-1' }))
      .mockReturnValueOnce(makeChain([]));

    const res = await GET(makeGetRequest({ leagueId: 'league-1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.waivers).toEqual([]);
  });

  it('filters by week when week query param is provided', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ id: 'league-1' }))
      .mockReturnValueOnce(makeChain([SAMPLE_WAIVER]));

    const res = await GET(makeGetRequest({ leagueId: 'league-1', week: '12' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('filters by status when status query param is provided', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ id: 'league-1' }))
      .mockReturnValueOnce(makeChain([SAMPLE_WAIVER]));

    const res = await GET(makeGetRequest({ leagueId: 'league-1', status: 'pending' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  it('returns 500 when the DB query for waivers fails', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ id: 'league-1' }))
      .mockReturnValueOnce(makeChain(null, { message: 'DB error' }));

    const res = await GET(makeGetRequest({ leagueId: 'league-1' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/failed to fetch/i);
  });
});
