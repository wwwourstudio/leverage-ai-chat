import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { DFSCardData } from '@/lib/mlb-projections/dfs-adapter';

/**
 * These tests exercise the slate-builder availability filter without hitting
 * the network. We mock `buildDFSCardsWithSlate` (the dfs-adapter entry point)
 * so the slate-builder receives a deterministic card pool.
 */

const mockSlate = {
  draftGroupId: 9999,
  startDate: '2026-05-05T23:05:00Z',
  gameCount: 3,
  slateLabel: 'Main',
  contestType: 'classic' as const,
  games: [],
};

function makeCard(overrides: Partial<DFSCardData['data']> & { player: string; position: string }): DFSCardData {
  return {
    type: 'dfs-lineup',
    title: `${overrides.player} — DFS Play`,
    category: 'MLB',
    subcategory: `DK ${overrides.position}`,
    gradient: 'from-orange-500/30',
    status: 'value',
    realData: true,
    data: {
      team:         'MIA',
      salary:       '$5,000',
      projection:   '8.0',
      ownership:    '15%',
      boomCeiling:  '14',
      bustFloor:    '4',
      targetGame:   'MIA @ ATL',
      tips:         '',
      matchupScore: '60/100',
      parkFactor:   '1.00',
      hrProb:       '8.0%',
      dkValue:      '4.0',
      source:       'test',
      isPlaying:    true,
      dkSalary:     5000,
      ...overrides,
    },
  };
}

vi.mock('@/lib/mlb-projections/dfs-adapter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mlb-projections/dfs-adapter')>(
    '@/lib/mlb-projections/dfs-adapter',
  );
  return {
    ...actual,
    buildDFSCardsWithSlate: vi.fn(),
  };
});

vi.mock('@/lib/mlb-projections/mlb-stats-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mlb-projections/mlb-stats-api')>(
    '@/lib/mlb-projections/mlb-stats-api',
  );
  return { ...actual, fetchTodaysGames: vi.fn().mockResolvedValue([]) };
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildDFSSlateMulti — availability filtering', () => {
  it('drops players with isPlaying=false from the optimal lineup', async () => {
    const { buildDFSCardsWithSlate } = await import('@/lib/mlb-projections/dfs-adapter');
    const { buildDFSSlateMulti } = await import('@/lib/mlb-projections/slate-builder');

    const pool: DFSCardData[] = [
      makeCard({ player: 'Healthy SP A', position: 'SP', dkSalary: 9000, projection: '21.0' }),
      makeCard({ player: 'Healthy SP B', position: 'SP', dkSalary: 8500, projection: '20.5' }),
      // Hitters — 8 healthy, 1 marked OUT (must be excluded)
      makeCard({ player: 'Catcher 1',  position: 'C',  dkSalary: 4000, projection: '6.0' }),
      makeCard({ player: 'First Base', position: '1B', dkSalary: 4500, projection: '7.0' }),
      makeCard({ player: 'Second Base',position: '2B', dkSalary: 4500, projection: '6.5' }),
      makeCard({ player: 'Third Base', position: '3B', dkSalary: 4500, projection: '6.5' }),
      makeCard({ player: 'Shortstop',  position: 'SS', dkSalary: 4500, projection: '6.5' }),
      makeCard({ player: 'OF One',     position: 'OF', dkSalary: 4500, projection: '6.5' }),
      makeCard({ player: 'OF Two',     position: 'OF', dkSalary: 4500, projection: '6.5' }),
      makeCard({ player: 'OF Three',   position: 'OF', dkSalary: 4500, projection: '6.5' }),
      // Injured player who would otherwise be the top OF by projection — must be skipped.
      makeCard({ player: 'INJURED OF', position: 'OF', dkSalary: 5500, projection: '15.0', isPlaying: false, availabilityReason: 'IL' }),
    ];

    vi.mocked(buildDFSCardsWithSlate).mockResolvedValue({
      cards: pool, slate: mockSlate, degradedMode: false,
    });

    const result = await buildDFSSlateMulti({ limit: 9, date: '2026-05-05' });
    const players = result.optimalLineup.map(c => c.data.player);

    expect(players).not.toContain('INJURED OF');
    expect(result.optimalLineup).toHaveLength(9);
    expect(result.metadata.slate?.draftGroupId).toBe(9999);
    expect(result.metadata.degradedMode).toBe(false);
  });

  it('returns insufficientPool when the available pool is too thin', async () => {
    const { buildDFSCardsWithSlate } = await import('@/lib/mlb-projections/dfs-adapter');
    const { buildDFSSlateMulti } = await import('@/lib/mlb-projections/slate-builder');

    // Only one starting pitcher available — should fail SP requirement (≥ 2).
    const pool: DFSCardData[] = [
      makeCard({ player: 'Lonely SP', position: 'SP', dkSalary: 9000, projection: '20' }),
      ...Array.from({ length: 10 }, (_, i) =>
        makeCard({ player: `Bat ${i}`, position: 'OF', dkSalary: 4000, projection: '6' })),
    ];

    vi.mocked(buildDFSCardsWithSlate).mockResolvedValue({
      cards: pool, slate: mockSlate, degradedMode: false,
    });

    const result = await buildDFSSlateMulti({ limit: 9, date: '2026-05-05' });
    expect(result.metadata.insufficientPool).toBe(true);
    expect(result.optimalLineup).toEqual([]);
  });

  it('passes through degradedMode when DK was unreachable', async () => {
    const { buildDFSCardsWithSlate } = await import('@/lib/mlb-projections/dfs-adapter');
    const { buildDFSSlateMulti } = await import('@/lib/mlb-projections/slate-builder');

    vi.mocked(buildDFSCardsWithSlate).mockResolvedValue({
      cards: [], slate: null, degradedMode: true, degradedReason: 'DK 503',
    });

    const result = await buildDFSSlateMulti({ limit: 9, date: '2026-05-05' });
    expect(result.metadata.degradedMode).toBe(true);
    expect(result.metadata.degradedReason).toBe('DK 503');
    expect(result.optimalLineup).toEqual([]);
  });
});
