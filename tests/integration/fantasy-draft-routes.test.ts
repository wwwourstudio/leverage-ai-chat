/**
 * Integration tests for:
 *   POST /api/fantasy/draft/pick
 *   POST /api/fantasy/draft/simulate
 *
 * Strategy: mock @/lib/supabase/server so no real DB calls are made,
 * and mock all fantasy lib functions for the simulate route.
 *
 * Tests cover:
 *   - Auth gate (401)
 *   - Validation (400)
 *   - Resource not found (404)
 *   - Business logic guards (draft not active, player already drafted, etc.)
 *   - Happy paths (200)
 *   - Error handling (500)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

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

// ── Fantasy lib mocks (for simulate route) ────────────────────────────────────
const mockSimulateDraftForward = vi.fn();
vi.mock('@/lib/fantasy/draft/simulation-engine', () => ({
  simulateDraftForward: mockSimulateDraftForward,
}));

const mockBuildDefaultProfiles = vi.fn();
const mockBuildOpponentProfile = vi.fn();
const mockPredictOpponentPick = vi.fn();
vi.mock('@/lib/fantasy/draft/opponent-model', () => ({
  buildDefaultProfiles: mockBuildDefaultProfiles,
  buildOpponentProfile: mockBuildOpponentProfile,
  predictOpponentPick: mockPredictOpponentPick,
}));

const mockCalculateVBD = vi.fn();
vi.mock('@/lib/fantasy/draft/vbd-calculator', () => ({
  calculateVBD: mockCalculateVBD,
}));

const mockDetectTierCliffs = vi.fn();
vi.mock('@/lib/fantasy/draft/tier-cliff-detector', () => ({
  detectTierCliffs: mockDetectTierCliffs,
}));

const mockCalculateDraftRecommendations = vi.fn();
const mockGetTopRecommendations = vi.fn();
vi.mock('@/lib/fantasy/draft/draft-utility', () => ({
  calculateDraftRecommendations: mockCalculateDraftRecommendations,
  getTopRecommendations: mockGetTopRecommendations,
}));

// ── Route imports ─────────────────────────────────────────────────────────────
// Imported after mocks so routes receive mocked dependencies.
const { POST: PICK } = await import('@/app/api/fantasy/draft/pick/route');
const { POST: SIMULATE } = await import('@/app/api/fantasy/draft/simulate/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/fantasy/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
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
    upsert: vi.fn(returnSelf),
    delete: vi.fn(returnSelf),
    eq: vi.fn(returnSelf),
    neq: vi.fn(returnSelf),
    in: vi.fn(returnSelf),
    is: vi.fn(returnSelf),
    not: vi.fn(returnSelf),
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

// ── Setup ─────────────────────────────────────────────────────────────────────

const SAMPLE_USER = { id: 'user-1', email: 'test@example.com' };

const SAMPLE_DRAFT_ROOM = {
  id: 'room-1',
  status: 'active',
  draft_order: ['team-1', 'team-2', 'team-3'],
  current_pick: 1,
  total_picks: 45,
};

const SAMPLE_PICK = {
  id: 'pick-1',
  draft_room_id: 'room-1',
  pick_number: 1,
  round: 1,
  team_id: 'team-1',
  player_name: 'Patrick Mahomes',
  position: 'QB',
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated user
  mockGetUser.mockResolvedValue({ data: { user: SAMPLE_USER } });
});

// ============================================================================
// POST /api/fantasy/draft/pick
// ============================================================================

describe('POST /api/fantasy/draft/pick', () => {

  // ── Auth ───────────────────────────────────────────────────────────────────

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await PICK(makeRequest({ draftRoomId: 'r1', playerName: 'P1', position: 'QB' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unauthorized/i);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it('returns 400 when draftRoomId is missing', async () => {
    const res = await PICK(makeRequest({ playerName: 'Patrick Mahomes', position: 'QB' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/missing/i);
  });

  it('returns 400 when playerName is missing', async () => {
    const res = await PICK(makeRequest({ draftRoomId: 'room-1', position: 'QB' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 400 when position is missing', async () => {
    const res = await PICK(makeRequest({ draftRoomId: 'room-1', playerName: 'Patrick Mahomes' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  // ── Resource guards ────────────────────────────────────────────────────────

  it('returns 404 when draft room is not found', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Not found' }));

    const res = await PICK(makeRequest({ draftRoomId: 'room-x', playerName: 'P1', position: 'QB' }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/draft room not found/i);
  });

  it('returns 400 when draft is not active', async () => {
    mockFrom.mockReturnValueOnce(
      makeChain({ ...SAMPLE_DRAFT_ROOM, status: 'completed' }),
    );

    const res = await PICK(makeRequest({ draftRoomId: 'room-1', playerName: 'P1', position: 'QB' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not active/i);
  });

  it('returns 400 when player is already drafted', async () => {
    // 1st from: draft_rooms → active room
    mockFrom.mockReturnValueOnce(makeChain(SAMPLE_DRAFT_ROOM));
    // 2nd from: draft_picks → existing pick (player already taken)
    mockFrom.mockReturnValueOnce(makeChain({ id: 'existing-pick-99' }));

    const res = await PICK(makeRequest({
      draftRoomId: 'room-1',
      playerName: 'Patrick Mahomes',
      position: 'QB',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/already been drafted/i);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('records the pick and advances the draft on success', async () => {
    // from calls in order:
    // 1. draft_rooms → room data
    // 2. draft_picks (check existing) → no existing pick
    // 3. draft_picks (insert) → new pick
    // 4. draft_rooms (update) → ok
    // 5. fantasy_rosters (insert) → ok
    mockFrom
      .mockReturnValueOnce(makeChain(SAMPLE_DRAFT_ROOM))           // get room
      .mockReturnValueOnce(makeChain(null))                         // no existing pick
      .mockReturnValueOnce(makeChain(SAMPLE_PICK))                  // insert pick
      .mockReturnValueOnce(makeChain(null))                         // update room
      .mockReturnValueOnce(makeChain(null));                        // insert roster

    const res = await PICK(makeRequest({
      draftRoomId: 'room-1',
      playerName: 'Patrick Mahomes',
      position: 'QB',
      teamId: 'team-1',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.pick).toMatchObject({ player_name: 'Patrick Mahomes' });
    expect(body.nextPick).toBe(2);
    expect(body.isComplete).toBe(false);
  });

  it('marks draft as complete when last pick is submitted', async () => {
    const lastPickRoom = { ...SAMPLE_DRAFT_ROOM, current_pick: 45, total_picks: 45 };

    mockFrom
      .mockReturnValueOnce(makeChain(lastPickRoom))
      .mockReturnValueOnce(makeChain(null))
      .mockReturnValueOnce(makeChain(SAMPLE_PICK))
      .mockReturnValueOnce(makeChain(null))
      .mockReturnValueOnce(makeChain(null));

    const res = await PICK(makeRequest({
      draftRoomId: 'room-1',
      playerName: 'Tyreek Hill',
      position: 'WR',
      teamId: 'team-1',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.nextPick).toBeNull();
    expect(body.isComplete).toBe(true);
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  it('returns 500 when inserting the pick fails', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(SAMPLE_DRAFT_ROOM))            // room ok
      .mockReturnValueOnce(makeChain(null))                          // no existing pick
      .mockReturnValueOnce(makeChain(null, { message: 'DB error' })); // insert fails

    const res = await PICK(makeRequest({
      draftRoomId: 'room-1',
      playerName: 'Patrick Mahomes',
      position: 'QB',
    }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/failed to record pick/i);
  });
});

// ============================================================================
// POST /api/fantasy/draft/simulate
// ============================================================================

describe('POST /api/fantasy/draft/simulate', () => {

  // ── Auth ───────────────────────────────────────────────────────────────────

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await SIMULATE(makeRequest({ draftRoomId: 'room-1' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unauthorized/i);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it('returns 400 when draftRoomId is missing', async () => {
    const res = await SIMULATE(makeRequest({ numSimulations: 100 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/missing/i);
  });

  // ── Resource guards ────────────────────────────────────────────────────────

  it('returns 404 when draft room is not found', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Not found' }));

    const res = await SIMULATE(makeRequest({ draftRoomId: 'room-x' }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/draft room not found/i);
  });

  it('returns 400 when no teams are found in the league', async () => {
    const room = { id: 'room-1', fantasy_leagues: { id: 'league-1', sport: 'nfl', league_size: 10, season_year: 2025 } };
    mockFrom
      .mockReturnValueOnce(makeChain(room))          // draft room
      .mockReturnValueOnce(makeChain([]));            // no teams

    const res = await SIMULATE(makeRequest({ draftRoomId: 'room-1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/no teams/i);
  });

  it('returns 400 when user team is not found in the league', async () => {
    const room = {
      id: 'room-1',
      current_pick: 1,
      total_picks: 150,
      draft_order: ['team-1', 'team-2'],
      status: 'active',
      fantasy_leagues: { id: 'league-1', sport: 'nfl', league_size: 2, season_year: 2025 },
    };
    const teams = [
      { id: 'team-1', team_name: 'Team 1', is_user_team: false, draft_position: 1 },
      { id: 'team-2', team_name: 'Team 2', is_user_team: false, draft_position: 2 },
    ];

    mockFrom
      .mockReturnValueOnce(makeChain(room))              // draft room
      .mockReturnValueOnce(makeChain(teams))              // teams
      .mockReturnValueOnce(makeChain([]))                 // existing picks
      .mockReturnValueOnce(makeChain([]));                // projections

    mockCalculateVBD.mockReturnValue([]);
    mockBuildDefaultProfiles.mockReturnValue([]);
    mockSimulateDraftForward.mockReturnValue({
      simulationsRun: 0, executionTimeMs: 0, userNextPick: 1, picksUntilNext: 0, results: [],
    });
    mockDetectTierCliffs.mockReturnValue([]);
    mockCalculateDraftRecommendations.mockReturnValue([]);

    const res = await SIMULATE(makeRequest({ draftRoomId: 'room-1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/user team not found/i);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('returns simulation results on success', async () => {
    const league = {
      id: 'league-1',
      sport: 'nfl',
      league_size: 2,
      season_year: 2025,
      roster_slots: { QB: 1, RB: 2 },
      scoring_settings: {},
    };
    const room = {
      id: 'room-1',
      current_pick: 1,
      total_picks: 30,
      draft_order: ['team-1', 'team-2'],
      status: 'active',
      fantasy_leagues: league,
    };
    const teams = [
      { id: 'team-1', team_name: 'My Team', is_user_team: true, draft_position: 1 },
      { id: 'team-2', team_name: 'Opp Team', is_user_team: false, draft_position: 2 },
    ];
    const projectionRow = {
      id: 'p1', sport: 'nfl', player_name: 'Josh Allen', player_id: 'ja',
      position: 'QB', season_year: 2025, week: null, projection_source: 'manual',
      stats: {}, fantasy_points: 380, adp: 5, vbd: 100, tier: 1, updated_at: '2025-01-01',
    };

    mockFrom
      .mockReturnValueOnce(makeChain(room))                  // draft room
      .mockReturnValueOnce(makeChain(teams))                  // teams
      .mockReturnValueOnce(makeChain([]))                     // existing picks
      .mockReturnValueOnce(makeChain([projectionRow]));       // projections

    const ranked = [{ playerName: 'Josh Allen', position: 'QB', fantasyPoints: 380, vbd: 100, adp: 5 }];
    mockCalculateVBD.mockReturnValue(ranked);

    const opponentProfiles = [{ teamId: 'team-2', teamName: 'Opp Team' }];
    mockBuildDefaultProfiles.mockReturnValue(opponentProfiles);
    mockPredictOpponentPick.mockReturnValue({ playerName: 'Davante Adams', probability: 0.8 });

    const simOutput = {
      simulationsRun: 100,
      executionTimeMs: 42,
      userNextPick: 1,
      picksUntilNext: 0,
      results: [{ playerName: 'Josh Allen', avgVBD: 100 }],
    };
    mockSimulateDraftForward.mockReturnValue(simOutput);
    mockDetectTierCliffs.mockReturnValue([{ position: 'QB', afterRank: 3, dropOff: 50 }]);

    const recs = [{ playerName: 'Josh Allen', utilityScore: 0.95 }];
    mockCalculateDraftRecommendations.mockReturnValue(recs);
    mockGetTopRecommendations.mockReturnValue({
      bestPick: { playerName: 'Josh Allen' },
      leveragePicks: [],
    });

    const res = await SIMULATE(makeRequest({ draftRoomId: 'room-1', numSimulations: 100 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.simulation.simulationsRun).toBe(100);
    expect(body.recommendations.bestPick).toMatchObject({ playerName: 'Josh Allen' });
    expect(body.tierCliffs).toHaveLength(1);
    expect(body.meta.sport).toBe('nfl');
  });
});
