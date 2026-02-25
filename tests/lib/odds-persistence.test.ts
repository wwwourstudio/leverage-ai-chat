import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSupportedSportsForPersistence,
  storeOddsData,
  getRecentOdds,
} from '@/lib/odds-persistence';

// Mock config helpers used by getSupabaseClient()
vi.mock('@/lib/config', () => ({
  getSupabaseUrl: vi.fn().mockReturnValue('http://localhost:54321'),
  getSupabaseServiceKey: vi.fn().mockReturnValue('test-service-key'),
}));

// Mock @supabase/supabase-js createClient
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockGt = vi.fn();
const mockDelete = vi.fn();
const mockLt = vi.fn();

const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Build a chainable query mock helper
function buildChain(finalResult: any) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockResolvedValue(finalResult);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.gt = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockResolvedValue(finalResult);
  return chain;
}

describe('getSupportedSportsForPersistence', () => {
  it('returns an array of sport entries', () => {
    const sports = getSupportedSportsForPersistence();
    expect(Array.isArray(sports)).toBe(true);
    expect(sports.length).toBeGreaterThan(0);
  });

  it('each entry has sportKey and tableName', () => {
    const sports = getSupportedSportsForPersistence();
    for (const sport of sports) {
      expect(sport).toHaveProperty('sportKey');
      expect(sport).toHaveProperty('tableName');
      expect(typeof sport.sportKey).toBe('string');
      expect(typeof sport.tableName).toBe('string');
    }
  });

  it('includes NBA mapping', () => {
    const sports = getSupportedSportsForPersistence();
    const nba = sports.find((s) => s.sportKey === 'basketball_nba');
    expect(nba).toBeTruthy();
    expect(nba!.tableName).toBe('nba_odds');
  });

  it('includes NFL mapping', () => {
    const sports = getSupportedSportsForPersistence();
    const nfl = sports.find((s) => s.sportKey === 'americanfootball_nfl');
    expect(nfl).toBeTruthy();
    expect(nfl!.tableName).toBe('nfl_odds');
  });
});

describe('storeOddsData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns failure for unknown sport key', async () => {
    const result = await storeOddsData('unknown_sport', [], {});
    expect(result.success).toBe(false);
    expect(result.stored).toBe(0);
    expect(result.errors[0]).toMatch(/Unknown sport/i);
  });

  it('returns success with stored=0 when events array is empty', async () => {
    const result = await storeOddsData('basketball_nba', [], {});
    // No rows to insert, still a success
    expect(result.success).toBe(true);
    expect(result.stored).toBe(0);
  });

  it('stores h2h market rows and returns success', async () => {
    const chain = buildChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const events = [
      {
        id: 'event-1',
        sport_key: 'basketball_nba',
        sport_title: 'NBA',
        commence_time: '2026-02-25T19:00:00Z',
        home_team: 'Lakers',
        away_team: 'Celtics',
        bookmakers: [
          {
            key: 'draftkings',
            title: 'DraftKings',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Lakers', price: -150 },
                  { name: 'Celtics', price: 130 },
                ],
              },
            ],
          },
        ],
      },
    ];

    const result = await storeOddsData('basketball_nba', events, {
      remainingRequests: '450',
    });
    expect(result.success).toBe(true);
    expect(result.stored).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('stores spreads market rows correctly', async () => {
    const chain = buildChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const events = [
      {
        id: 'event-2',
        sport_key: 'basketball_nba',
        sport_title: 'NBA',
        commence_time: '2026-02-25T19:00:00Z',
        home_team: 'Lakers',
        away_team: 'Celtics',
        bookmakers: [
          {
            key: 'fanduel',
            title: 'FanDuel',
            markets: [
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Lakers', price: -110, point: -3.5 },
                  { name: 'Celtics', price: -110, point: 3.5 },
                ],
              },
            ],
          },
        ],
      },
    ];

    const result = await storeOddsData('basketball_nba', events, {});
    expect(result.success).toBe(true);
    expect(chain.upsert).toHaveBeenCalledTimes(1);
    const rowsInserted = chain.upsert.mock.calls[0][0];
    const spreadsRow = rowsInserted.find((r: any) => r.market_type === 'spreads');
    expect(spreadsRow).toBeTruthy();
    expect(spreadsRow.home_spread).toBe(-3.5);
    expect(spreadsRow.away_spread).toBe(3.5);
  });

  it('stores totals market rows correctly', async () => {
    const chain = buildChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const events = [
      {
        id: 'event-3',
        sport_key: 'americanfootball_nfl',
        sport_title: 'NFL',
        commence_time: '2026-02-25T20:00:00Z',
        home_team: 'Chiefs',
        away_team: 'Eagles',
        bookmakers: [
          {
            key: 'betmgm',
            title: 'BetMGM',
            markets: [
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', price: -110, point: 47.5 },
                  { name: 'Under', price: -110, point: 47.5 },
                ],
              },
            ],
          },
        ],
      },
    ];

    const result = await storeOddsData('americanfootball_nfl', events, {});
    expect(result.success).toBe(true);
    const rowsInserted = chain.upsert.mock.calls[0][0];
    const totalsRow = rowsInserted.find((r: any) => r.market_type === 'totals');
    expect(totalsRow).toBeTruthy();
    expect(totalsRow.over_total).toBe(47.5);
    expect(totalsRow.under_total).toBe(47.5);
  });

  it('includes implied probability for h2h markets', async () => {
    const chain = buildChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const events = [
      {
        id: 'event-4',
        sport_key: 'basketball_nba',
        sport_title: 'NBA',
        commence_time: '2026-02-25T19:00:00Z',
        home_team: 'Warriors',
        away_team: 'Bucks',
        bookmakers: [
          {
            key: 'draftkings',
            title: 'DraftKings',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Warriors', price: 100 },
                  { name: 'Bucks', price: -120 },
                ],
              },
            ],
          },
        ],
      },
    ];

    await storeOddsData('basketball_nba', events, {});
    const rowsInserted = chain.upsert.mock.calls[0][0];
    const h2hRow = rowsInserted[0];
    // For +100: implied prob = 100 / (100 + 100) = 0.5
    expect(h2hRow.home_implied_prob).toBeCloseTo(0.5);
  });

  it('returns failure when supabase upsert returns an error', async () => {
    const chain = buildChain({ data: null, error: { message: 'DB write failed' } });
    mockFrom.mockReturnValue(chain);

    const events = [
      {
        id: 'event-5',
        sport_key: 'basketball_nba',
        sport_title: 'NBA',
        commence_time: '2026-02-25T19:00:00Z',
        home_team: 'Team A',
        away_team: 'Team B',
        bookmakers: [
          {
            key: 'draftkings',
            title: 'DraftKings',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Team A', price: -110 },
                  { name: 'Team B', price: -110 },
                ],
              },
            ],
          },
        ],
      },
    ];

    const result = await storeOddsData('basketball_nba', events, {});
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Database error: DB write failed');
  });
});

describe('getRecentOdds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns failure for unknown sport', async () => {
    const result = await getRecentOdds('unknown_sport');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown sport/i);
    expect(result.data).toEqual([]);
  });

  it('returns data array on success', async () => {
    const mockData = [{ event_id: '1', home_team: 'Lakers', away_team: 'Celtics' }];
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.gt = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockResolvedValue({ data: mockData, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await getRecentOdds('basketball_nba', 10);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockData);
  });

  it('returns failure with error message when supabase returns error', async () => {
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.gt = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockResolvedValue({ data: null, error: { message: 'Query failed' } });
    mockFrom.mockReturnValue(chain);

    const result = await getRecentOdds('basketball_nba');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Query failed');
    expect(result.data).toEqual([]);
  });

  it('returns empty array when data is null but no error', async () => {
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.gt = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await getRecentOdds('basketball_nba');
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });
});
