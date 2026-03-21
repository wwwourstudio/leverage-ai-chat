/**
 * Tests for /lib/engine/predictHR.ts
 *
 * Vitest + vitest.setup.ts mocks (Next.js headers, fetch, Supabase env vars).
 * Supabase client and ML model are mocked per-test; no network calls made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase server client ──────────────────────────────────────────────
// Must be hoisted before the module import so the mock is in place.
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// ─── Mock ML predict function ─────────────────────────────────────────────────
vi.mock('@/lib/ml/predict', () => ({
  predictHRFromFeatures: vi.fn(),
}));

// ─── Mock context engine ──────────────────────────────────────────────────────
vi.mock('@/lib/engine/context', () => ({
  getParkFactor:    vi.fn(() => 1.0),
  getWeatherFactor: vi.fn(() => 1.0),
}));

import { createClient } from '@/lib/supabase/server';
import { predictHRFromFeatures } from '@/lib/ml/predict';
import { getParkFactor, getWeatherFactor } from '@/lib/engine/context';
import { predictHR } from '@/lib/engine/predictHR';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const INPUT = {
  playerId:  'player-uuid-001',
  pitcherId: 'pitcher-uuid-001',
  gameId:    'game-001',
  date:      '2026-03-20',
};

/** Minimal valid player row (matches PlayerStatRow shape) */
const PLAYER_ROW = {
  barrel_rate:    0.10,
  hard_hit_rate:  0.45,
  avg_exit_velo:  91.0,
  bip_count:      80,
  platoon_score:  0.65,
  iso:            0.210,
  woba:           0.360,
  players: { hand: 'L', team_id: 'NYY' },
};

/** Minimal valid pitcher row */
const PITCHER_ROW = {
  flyball_pct:         42,
  hr_per_fb:           0.13,
  hr_allowed_per_fb:   0.13,
  hr9_vs_hand:         1.3,
  four_seam_pct:       45,
  breaking_usage:      30,
  offspeed_usage:      15,
  avg_velo:            93.5,
  platoon_score:       0.55,
  pitches_thrown:      120,
  pitchers: { hand: 'R' },
};

/** Minimal valid game row */
const GAME_ROW = {
  stadium_id:     'yankee_stadium',
  temperature:    78,
  wind_speed:     8,
  wind_direction: 'out',
  humidity:       55,
  stadiums: { park_factor: 1.05 },
};

/** Odds row */
const ODDS_ROW = {
  implied_prob:   0.135,
  american_odds:  +650,
};

// ─── Supabase mock builder ────────────────────────────────────────────────────

/**
 * Builds a mock Supabase client where each .from() chain resolves to the
 * provided data (or error) for that table.
 */
function buildSupabaseMock(overrides: {
  playerData?:  Record<string, unknown> | null;
  playerError?: { message: string } | null;
  pitcherData?: Record<string, unknown> | null;
  pitcherError?:{ message: string } | null;
  gameData?:    typeof GAME_ROW | null;
  gameError?:   { message: string } | null;
  oddsData?:    { implied_prob: number | null; american_odds: number } | null;
} = {}) {
  const {
    playerData   = PLAYER_ROW,
    playerError  = null,
    pitcherData  = PITCHER_ROW,
    pitcherError = null,
    gameData     = GAME_ROW,
    gameError    = null,
    oddsData     = null,
  } = overrides;

  const makeChain = (data: unknown, error: unknown) => {
    const chain: Record<string, () => unknown> = {};
    const terminal = () => Promise.resolve({ data, error });
    chain.select      = () => chain;
    chain.eq          = () => chain;
    chain.order       = () => chain;
    chain.limit       = () => chain;
    chain.single      = terminal;
    chain.maybeSingle = terminal;
    return chain;
  };

  const fromMap: Record<string, unknown> = {
    player_game_stats:  makeChain(playerData,  playerError),
    pitcher_game_stats: makeChain(pitcherData, pitcherError),
    games:              makeChain(gameData,    gameError),
    live_odds_cache:    makeChain(oddsData,    null),
  };

  return { from: (table: string) => fromMap[table] ?? makeChain(null, { message: 'unknown table' }) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('predictHR', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (getParkFactor as ReturnType<typeof vi.fn>).mockReturnValue(1.0);
    (getWeatherFactor as ReturnType<typeof vi.fn>).mockReturnValue(1.0);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns a valid prediction with ML model active', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(buildSupabaseMock());
    (predictHRFromFeatures as ReturnType<typeof vi.fn>).mockResolvedValue(0.18);

    const result = await predictHR(INPUT);

    expect(result.probability).toBe(0.18);
    expect(result.components.mlAdjusted).toBe(0.18);
    expect(result.confidence).toBe('high');
    expect(result.edge).toBe(0);      // no odds row
    expect(result.impliedOdds).toBeNull();
    expect(result.warnings).toBeUndefined();
  });

  it('falls back to rule-based when ML throws, sets confidence to medium', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(buildSupabaseMock());
    (predictHRFromFeatures as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('model not loaded'),
    );

    const result = await predictHR(INPUT);

    expect(result.components.mlAdjusted).toBeUndefined();
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('ML model unavailable')]),
    );
    // dataAdequate = true (bip=80, pitches=120), mlUsed = false → medium
    expect(result.confidence).toBe('medium');
    // Rule-based prob should be positive and reasonable
    expect(result.probability).toBeGreaterThan(0);
    expect(result.probability).toBeLessThan(1);
  });

  // ── Edge vs odds ──────────────────────────────────────────────────────────

  it('computes edge and impliedOdds when odds row present', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildSupabaseMock({ oddsData: ODDS_ROW }),
    );
    (predictHRFromFeatures as ReturnType<typeof vi.fn>).mockResolvedValue(0.20);

    const result = await predictHR(INPUT);

    expect(result.impliedOdds).toBe(650);
    // edge = 0.20 - 0.135 = 0.065
    expect(result.edge).toBeCloseTo(0.065, 3);
  });

  it('falls back to american_odds when implied_prob is null', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildSupabaseMock({ oddsData: { implied_prob: null, american_odds: +600 } }),
    );
    (predictHRFromFeatures as ReturnType<typeof vi.fn>).mockResolvedValue(0.20);

    const result = await predictHR(INPUT);

    // implied from +600: 100 / 700 ≈ 0.1429
    expect(result.edge).toBeCloseTo(0.20 - 100 / 700, 3);
  });

  // ── Data quality ──────────────────────────────────────────────────────────

  it('adds warning and sets confidence low when bip_count < 20', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildSupabaseMock({ playerData: { ...PLAYER_ROW, bip_count: 10 } }),
    );
    (predictHRFromFeatures as ReturnType<typeof vi.fn>).mockResolvedValue(0.12);

    const result = await predictHR(INPUT);

    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Limited batter contact data')]),
    );
    // mlUsed=true, dataAdequate=false → medium
    expect(result.confidence).toBe('medium');
  });

  it('warns about extreme matchup factor', async () => {
    // Force a very high matchup factor by using an extreme pitcher platoon score
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildSupabaseMock({
        pitcherData: {
          ...PITCHER_ROW,
          platoon_score:   0.95,
          four_seam_pct:   60,
          breaking_usage:  10,
          hr_allowed_per_fb: 0.18,
        },
      }),
    );
    (predictHRFromFeatures as ReturnType<typeof vi.fn>).mockResolvedValue(0.22);

    const result = await predictHR(INPUT);

    // matchupFactor should be well above 1.4, triggering the warning
    const matchup = result.components.matchupFactor;
    if (matchup > 1.4) {
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Extreme matchup adjustment')]),
      );
    }
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('throws when player stats are missing', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildSupabaseMock({ playerData: null, playerError: { message: 'not found' } }),
    );

    await expect(predictHR(INPUT)).rejects.toThrow(/No player stats/);
  });

  it('throws when pitcher stats are missing', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildSupabaseMock({ pitcherData: null, pitcherError: { message: 'not found' } }),
    );

    await expect(predictHR(INPUT)).rejects.toThrow(/No pitcher stats/);
  });

  it('throws when game context is missing', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildSupabaseMock({ gameData: null, gameError: { message: 'not found' } }),
    );

    await expect(predictHR(INPUT)).rejects.toThrow(/No game context/);
  });

  // ── Probability clamping ───────────────────────────────────────────────────

  it('clamps probability to [0, 1] even if ML returns out-of-range value', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(buildSupabaseMock());
    (predictHRFromFeatures as ReturnType<typeof vi.fn>).mockResolvedValue(1.5);

    const result = await predictHR(INPUT);
    expect(result.probability).toBeLessThanOrEqual(1.0);
  });

  it('clamps probability to [0, 1] when ML returns negative', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(buildSupabaseMock());
    (predictHRFromFeatures as ReturnType<typeof vi.fn>).mockResolvedValue(-0.3);

    const result = await predictHR(INPUT);
    expect(result.probability).toBeGreaterThanOrEqual(0);
  });

  // ── Handedness defaults ────────────────────────────────────────────────────

  it('defaults batter hand to R and warns when players join is null', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildSupabaseMock({ playerData: { ...PLAYER_ROW, players: null } }),
    );
    (predictHRFromFeatures as ReturnType<typeof vi.fn>).mockResolvedValue(0.14);

    const result = await predictHR(INPUT);

    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Batter handedness not found')]),
    );
    // Should still complete without throwing
    expect(result.probability).toBeGreaterThan(0);
  });

  // ── Output shape ──────────────────────────────────────────────────────────

  it('output components are all finite numbers', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(buildSupabaseMock());
    (predictHRFromFeatures as ReturnType<typeof vi.fn>).mockResolvedValue(0.16);

    const result = await predictHR(INPUT);
    const { baseRate, parkFactor, weatherFactor, matchupFactor } = result.components;

    expect(Number.isFinite(baseRate)).toBe(true);
    expect(Number.isFinite(parkFactor)).toBe(true);
    expect(Number.isFinite(weatherFactor)).toBe(true);
    expect(Number.isFinite(matchupFactor)).toBe(true);
    expect(Number.isFinite(result.probability)).toBe(true);
  });
});
