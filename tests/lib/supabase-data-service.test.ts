import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractBestOdds,
  oddsToImpliedProbability,
  calculateExpectedValue,
  fetchOddsFromDB,
} from '@/lib/supabase-data-service';

// Use vi.hoisted so the mockFrom variable is available inside the vi.mock factory
const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

// Mock the server-side Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}));

// ---- Pure helper functions ----

describe('oddsToImpliedProbability', () => {
  it('calculates implied probability for positive American odds', () => {
    // +200 → 100 / (200 + 100) = 33.33%
    expect(oddsToImpliedProbability(200)).toBeCloseTo(0.3333, 3);
  });

  it('calculates implied probability for negative American odds', () => {
    // -150 → 150 / (150 + 100) = 60%
    expect(oddsToImpliedProbability(-150)).toBeCloseTo(0.6, 3);
  });

  it('calculates 50% implied probability for +100 (even odds)', () => {
    expect(oddsToImpliedProbability(100)).toBeCloseTo(0.5, 3);
  });

  it('calculates high implied probability for heavy favorite', () => {
    // -400 → 400 / 500 = 80%
    expect(oddsToImpliedProbability(-400)).toBeCloseTo(0.8, 3);
  });

  it('calculates low implied probability for large underdog', () => {
    // +500 → 100 / 600 ≈ 16.67%
    expect(oddsToImpliedProbability(500)).toBeCloseTo(0.1667, 3);
  });
});

describe('calculateExpectedValue', () => {
  it('returns positive EV when true probability exceeds implied probability', () => {
    // True prob 60%, implied prob ~50% at +100
    const ev = calculateExpectedValue(100, 0.6);
    expect(ev).toBeGreaterThan(0);
  });

  it('returns negative EV when true probability is below implied probability', () => {
    // True prob 40%, implied prob ~50% at +100
    const ev = calculateExpectedValue(100, 0.4);
    expect(ev).toBeLessThan(0);
  });

  it('returns approximately 0 EV at breakeven (true prob = implied prob)', () => {
    // At +100 implied prob is 0.5; true prob = 0.5 should break even
    const ev = calculateExpectedValue(100, 0.5);
    expect(ev).toBeCloseTo(0, 2);
  });

  it('works for negative American odds', () => {
    // At -150 (60% implied), if true prob is 65% → positive EV
    const ev = calculateExpectedValue(-150, 0.65);
    expect(ev).toBeGreaterThan(0);
  });
});

describe('extractBestOdds', () => {
  it('returns nulls for empty bookmakers array', () => {
    const result = extractBestOdds([]);
    expect(result.bestHomeOdds).toBeNull();
    expect(result.bestAwayOdds).toBeNull();
    expect(result.bestHomeBook).toBeNull();
    expect(result.bestAwayBook).toBeNull();
  });

  it('returns nulls for non-array input', () => {
    const result = extractBestOdds(null as any);
    expect(result.bestHomeOdds).toBeNull();
  });

  it('picks best home odds across bookmakers', () => {
    const bookmakers = [
      {
        key: 'draftkings',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'home team', price: -120 },
              { name: 'away team', price: 100 },
            ],
          },
        ],
      },
      {
        key: 'fanduel',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'home team', price: -110 },  // better for home
              { name: 'away team', price: 90 },
            ],
          },
        ],
      },
    ];

    const result = extractBestOdds(bookmakers);
    expect(result.bestHomeOdds).toBe(-110);
    expect(result.bestHomeBook).toBe('fanduel');
  });

  it('picks best away odds across bookmakers', () => {
    const bookmakers = [
      {
        key: 'book1',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'home', price: -150 },
              { name: 'away team', price: 120 },
            ],
          },
        ],
      },
      {
        key: 'book2',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'home', price: -155 },
              { name: 'away team', price: 130 }, // better
            ],
          },
        ],
      },
    ];

    const result = extractBestOdds(bookmakers);
    expect(result.bestAwayOdds).toBe(130);
    expect(result.bestAwayBook).toBe('book2');
  });

  it('ignores non-h2h markets', () => {
    const bookmakers = [
      {
        key: 'draftkings',
        markets: [
          {
            key: 'spreads',
            outcomes: [
              { name: 'home', price: -110 },
              { name: 'away', price: -110 },
            ],
          },
        ],
      },
    ];

    const result = extractBestOdds(bookmakers);
    expect(result.bestHomeOdds).toBeNull();
    expect(result.bestAwayOdds).toBeNull();
  });

  it('returns null when bookmaker has no markets', () => {
    const bookmakers = [{ key: 'empty_book', markets: [] }];
    const result = extractBestOdds(bookmakers);
    expect(result.bestHomeOdds).toBeNull();
  });

  it('handles bookmakers without markets property', () => {
    const bookmakers = [{ key: 'bad_book' }] as any;
    const result = extractBestOdds(bookmakers);
    expect(result.bestHomeOdds).toBeNull();
  });
});

// ---- fetchOddsFromDB ----

describe('fetchOddsFromDB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Supabase query builders are thenables — they resolve when awaited directly.
   * Make the chain itself a Promise so `await queryBuilder` works correctly
   * regardless of whether .limit() is called.
   */
  function buildQueryChain(resolvedValue: any) {
    const promise = Promise.resolve(resolvedValue);
    const chain: any = {
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    };
    chain.select = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.gte = vi.fn().mockReturnValue(chain);
    chain.lte = vi.fn().mockReturnValue(chain);
    chain.or = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    return chain;
  }

  it('returns Err for unknown sport key', async () => {
    const result = await fetchOddsFromDB({ sport: 'unknown_sport' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/Unknown sport/i);
    }
  });

  it('returns Ok with data on successful query', async () => {
    const mockData = [
      {
        id: 'r1',
        event_id: 'e1',
        sport: 'nba',
        home_team: 'Lakers',
        away_team: 'Celtics',
        commence_time: '2026-02-25T19:00:00Z',
        bookmakers: [],
        created_at: '2026-02-25T10:00:00Z',
      },
    ];

    const chain = buildQueryChain({ data: mockData, error: null, count: 1 });
    mockFrom.mockReturnValue(chain);

    const result = await fetchOddsFromDB({ sport: 'nba', limit: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data).toHaveLength(1);
      expect(result.value.count).toBe(1);
      expect(result.value.lastFetched).toBeTruthy();
    }
  });

  it('returns Err when supabase returns an error', async () => {
    const chain = buildQueryChain({ data: null, error: { message: 'Query failed' }, count: 0 });
    mockFrom.mockReturnValue(chain);

    const result = await fetchOddsFromDB({ sport: 'nba' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Query failed');
    }
  });

  it('returns empty data array when no records exist', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    const result = await fetchOddsFromDB({ sport: 'nfl' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data).toEqual([]);
      expect(result.value.count).toBe(0);
    }
  });

  it('maps sport key variations to the correct table', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    // 'basketball_nba' should map to nba_odds table
    await fetchOddsFromDB({ sport: 'basketball_nba' });
    expect(mockFrom).toHaveBeenCalledWith('nba_odds');
  });

  it('applies team filter when team is specified', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await fetchOddsFromDB({ sport: 'nba', team: 'Lakers' });
    expect(chain.or).toHaveBeenCalledWith(
      expect.stringContaining('Lakers')
    );
  });

  it('applies date range filters when from and to are specified', async () => {
    const chain = buildQueryChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    const from = new Date('2026-02-25T00:00:00Z');
    const to = new Date('2026-02-26T00:00:00Z');
    await fetchOddsFromDB({ sport: 'nba', from, to });

    expect(chain.gte).toHaveBeenCalledWith('commence_time', from.toISOString());
    expect(chain.lte).toHaveBeenCalledWith('commence_time', to.toISOString());
  });

  it('catches exceptions and returns Err', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Unexpected crash');
    });

    const result = await fetchOddsFromDB({ sport: 'nba' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Unexpected crash');
    }
  });
});
