/**
 * Unit Tests for lib/odds-transformer.ts
 * Covers: calculateImpliedProbability, formatAmericanOdds, calculateMarketEfficiency,
 *         findBestSpread, findBestMoneyline, findBestTotal, detectLineMovement,
 *         transformOddsEvent, transformOddsEvents, filterEventsByTimeRange,
 *         sortEventsByValue
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateImpliedProbability,
  formatAmericanOdds,
  calculateMarketEfficiency,
  findBestSpread,
  findBestMoneyline,
  findBestTotal,
  detectLineMovement,
  transformOddsEvent,
  transformOddsEvents,
  filterEventsByTimeRange,
  sortEventsByValue,
  type OddsEvent,
  type Bookmaker,
} from '@/lib/odds-transformer';

// ============================================================================
// Fixtures
// ============================================================================

function makeBookmaker(
  title: string,
  markets: Array<{ key: string; outcomes: Array<{ name: string; price: number; point?: number }> }>
): Bookmaker {
  return {
    key: title.toLowerCase(),
    title,
    last_update: new Date().toISOString(),
    markets: markets.map(m => ({
      key: m.key,
      last_update: new Date().toISOString(),
      outcomes: m.outcomes,
    })),
  };
}

function makeEvent(
  homeTeam: string,
  awayTeam: string,
  bookmakers: Bookmaker[],
  commenceTime?: string
): OddsEvent {
  return {
    id: `${homeTeam}-${awayTeam}`,
    sport_key: 'basketball_nba',
    sport_title: 'NBA',
    commence_time: commenceTime ?? new Date(Date.now() + 3_600_000).toISOString(),
    home_team: homeTeam,
    away_team: awayTeam,
    bookmakers,
  };
}

// ============================================================================
// calculateImpliedProbability
// ============================================================================

describe('calculateImpliedProbability', () => {
  it('calculates implied probability for +100 (even money = 50%)', () => {
    expect(calculateImpliedProbability(100)).toBeCloseTo(0.5, 6);
  });

  it('calculates implied probability for +200', () => {
    // 100 / 300 = 1/3
    expect(calculateImpliedProbability(200)).toBeCloseTo(1 / 3, 4);
  });

  it('calculates implied probability for -110', () => {
    // 110 / 210 ≈ 0.5238
    expect(calculateImpliedProbability(-110)).toBeCloseTo(110 / 210, 6);
  });

  it('calculates implied probability for -200', () => {
    // 200 / 300 ≈ 0.6667
    expect(calculateImpliedProbability(-200)).toBeCloseTo(2 / 3, 4);
  });

  it('always returns a value strictly between 0 and 1', () => {
    [100, 150, 200, -110, -150, -200, 500].forEach(odds => {
      const p = calculateImpliedProbability(odds);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    });
  });
});

// ============================================================================
// formatAmericanOdds
// ============================================================================

describe('formatAmericanOdds', () => {
  it('prepends + for positive odds', () => {
    expect(formatAmericanOdds(150)).toBe('+150');
    expect(formatAmericanOdds(100)).toBe('+100');
  });

  it('uses the sign directly for negative odds', () => {
    expect(formatAmericanOdds(-110)).toBe('-110');
    expect(formatAmericanOdds(-200)).toBe('-200');
  });

  it('handles edge case of 0 (treated as non-positive → no +)', () => {
    // 0 is not > 0 so the else branch runs
    expect(formatAmericanOdds(0)).toBe('0');
  });
});

// ============================================================================
// calculateMarketEfficiency
// ============================================================================

describe('calculateMarketEfficiency', () => {
  it('returns 0 when fewer than 2 bookmakers are provided', () => {
    const book = makeBookmaker('DraftKings', [
      { key: 'h2h', outcomes: [{ name: 'Lakers', price: -110 }] },
    ]);
    expect(calculateMarketEfficiency([book])).toBe(0);
    expect(calculateMarketEfficiency([])).toBe(0);
  });

  it('returns 0 when there are fewer than 2 total price points', () => {
    const book1 = makeBookmaker('BookA', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: -110 }] }]);
    const book2 = makeBookmaker('BookB', [{ key: 'h2h', outcomes: [] }]);
    expect(calculateMarketEfficiency([book1, book2])).toBe(0);
  });

  it('returns a higher value when books disagree widely', () => {
    const book1 = makeBookmaker('BookA', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: -500 }] }]);
    const book2 = makeBookmaker('BookB', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: 400 }] }]);
    const efficiency = calculateMarketEfficiency([book1, book2]);
    expect(efficiency).toBeGreaterThan(0);
  });

  it('returns a lower value when books agree closely', () => {
    const book1 = makeBookmaker('BookA', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: -111 }] }]);
    const book2 = makeBookmaker('BookB', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: -109 }] }]);
    const agree = calculateMarketEfficiency([book1, book2]);

    const book3 = makeBookmaker('BookC', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: -500 }] }]);
    const book4 = makeBookmaker('BookD', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: 400 }] }]);
    const disagree = calculateMarketEfficiency([book3, book4]);

    expect(disagree).toBeGreaterThan(agree);
  });

  it('is capped at 10', () => {
    const book1 = makeBookmaker('BookA', [{ key: 'h2h', outcomes: [{ name: 'X', price: -10000 }] }]);
    const book2 = makeBookmaker('BookB', [{ key: 'h2h', outcomes: [{ name: 'X', price: 10000 }] }]);
    expect(calculateMarketEfficiency([book1, book2])).toBeLessThanOrEqual(10);
  });
});

// ============================================================================
// findBestSpread
// ============================================================================

describe('findBestSpread', () => {
  it('returns null when no bookmakers have spreads market', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: -110 }] }]),
    ]);
    expect(findBestSpread(event)).toBeNull();
  });

  it('returns the outcome with the highest edge (least favourite = highest underdog price)', () => {
    // Bigger underdog price → lower implied prob → higher (1-p)*100 edge
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('BookA', [{
        key: 'spreads',
        outcomes: [{ name: 'Lakers', price: -110, point: -3.5 }, { name: 'Celtics', price: -110, point: 3.5 }],
      }]),
      makeBookmaker('BookB', [{
        key: 'spreads',
        outcomes: [{ name: 'Lakers', price: -115, point: -3.5 }, { name: 'Celtics', price: 105, point: 3.5 }],
      }]),
    ]);
    const best = findBestSpread(event);
    // Celtics at +105 → implied prob ≈ 0.488 → edge = 51.2 (highest)
    expect(best).not.toBeNull();
    expect(best!.outcome.price).toBe(105);
    expect(best!.bookmaker).toBe('BookB');
  });

  it('includes impliedProbability and edge in the result', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', [{
        key: 'spreads',
        outcomes: [{ name: 'Lakers', price: -110 }],
      }]),
    ]);
    const best = findBestSpread(event);
    expect(best).not.toBeNull();
    expect(best!.impliedProbability).toBeCloseTo(110 / 210, 4);
    expect(best!.edge).toBeGreaterThan(0);
  });
});

// ============================================================================
// findBestMoneyline
// ============================================================================

describe('findBestMoneyline', () => {
  it('returns null when no bookmakers have h2h market', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', [{ key: 'spreads', outcomes: [] }]),
    ]);
    expect(findBestMoneyline(event)).toBeNull();
  });

  it('returns the single outcome with the highest price across all books', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('BookA', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: -110 }, { name: 'Celtics', price: -110 }] }]),
      makeBookmaker('BookB', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: 130 }, { name: 'Celtics', price: -160 }] }]),
    ]);
    const best = findBestMoneyline(event);
    expect(best).not.toBeNull();
    expect(best!.outcome.price).toBe(130);
    expect(best!.bookmaker).toBe('BookB');
  });

  it('includes impliedProbability in the result', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: 150 }] }]),
    ]);
    const best = findBestMoneyline(event);
    expect(best!.impliedProbability).toBeCloseTo(100 / 250, 4);
  });
});

// ============================================================================
// findBestTotal
// ============================================================================

describe('findBestTotal', () => {
  it('returns null when no bookmakers have a totals market', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', [{ key: 'h2h', outcomes: [] }]),
    ]);
    expect(findBestTotal(event)).toBeNull();
  });

  it('returns the outcome with the highest price across books', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('BookA', [{ key: 'totals', outcomes: [{ name: 'Over', price: -110, point: 225 }, { name: 'Under', price: -110, point: 225 }] }]),
      makeBookmaker('BookB', [{ key: 'totals', outcomes: [{ name: 'Over', price: 105, point: 225.5 }, { name: 'Under', price: -115, point: 225.5 }] }]),
    ]);
    const best = findBestTotal(event);
    expect(best!.outcome.price).toBe(105);
    expect(best!.bookmaker).toBe('BookB');
  });
});

// ============================================================================
// detectLineMovement
// ============================================================================

describe('detectLineMovement', () => {
  it('returns "No data" when there are no bookmakers', () => {
    const event = makeEvent('Lakers', 'Celtics', []);
    expect(detectLineMovement(event)).toBe('No data');
  });

  it('returns "Single source" for exactly one bookmaker', () => {
    const event = makeEvent('Lakers', 'Celtics', [makeBookmaker('DK', [])]);
    expect(detectLineMovement(event)).toBe('Single source');
  });

  it('returns "Limited sources" for exactly two bookmakers', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', []),
      makeBookmaker('FD', []),
    ]);
    expect(detectLineMovement(event)).toBe('Limited sources');
  });

  it('returns "Stable (multiple sources)" for 3+ bookmakers', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', []),
      makeBookmaker('FD', []),
      makeBookmaker('MGM', []),
    ]);
    expect(detectLineMovement(event)).toBe('Stable (multiple sources)');
  });
});

// ============================================================================
// transformOddsEvent
// ============================================================================

describe('transformOddsEvent', () => {
  it('returns an object with the original event', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: -110 }, { name: 'Celtics', price: -110 }] }]),
    ]);
    const transformed = transformOddsEvent(event);
    expect(transformed.event).toBe(event);
  });

  it('calculates lineMovement from bookmaker count', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', []),
      makeBookmaker('FD', []),
      makeBookmaker('MGM', []),
    ]);
    expect(transformOddsEvent(event).lineMovement).toBe('Stable (multiple sources)');
  });

  it('returns null bestSpread when no spreads market exists', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: -110 }] }]),
    ]);
    expect(transformOddsEvent(event).bestSpread).toBeNull();
  });

  it('returns null bestTotal when no totals market exists', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: -110 }] }]),
    ]);
    expect(transformOddsEvent(event).bestTotal).toBeNull();
  });

  it('populates bestMoneyline when h2h market exists', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: 120 }, { name: 'Celtics', price: -140 }] }]),
    ]);
    expect(transformOddsEvent(event).bestMoneyline).not.toBeNull();
    expect(transformOddsEvent(event).bestMoneyline!.outcome.price).toBe(120);
  });

  it('includes a marketEfficiency value', () => {
    const event = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('DK', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: -110 }] }]),
      makeBookmaker('FD', [{ key: 'h2h', outcomes: [{ name: 'Lakers', price: -115 }] }]),
    ]);
    const result = transformOddsEvent(event);
    expect(typeof result.marketEfficiency).toBe('number');
    expect(result.marketEfficiency).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// transformOddsEvents
// ============================================================================

describe('transformOddsEvents', () => {
  it('returns an empty array for an empty input', () => {
    expect(transformOddsEvents([])).toEqual([]);
  });

  it('returns an empty array for non-array input', () => {
    expect(transformOddsEvents(null as unknown as never[])).toEqual([]);
  });

  it('maps each event to a TransformedOdds entry', () => {
    const events = [
      makeEvent('Lakers', 'Celtics', [makeBookmaker('DK', [])]),
      makeEvent('Warriors', 'Nets', [makeBookmaker('FD', [])]),
    ];
    const results = transformOddsEvents(events);
    expect(results).toHaveLength(2);
    expect(results[0].event.home_team).toBe('Lakers');
    expect(results[1].event.home_team).toBe('Warriors');
  });
});

// ============================================================================
// filterEventsByTimeRange
// ============================================================================

describe('filterEventsByTimeRange', () => {
  const now = Date.now();

  it('includes events that commence within the time window', () => {
    const inWindow = makeEvent('Lakers', 'Celtics', [], new Date(now + 3_600_000).toISOString()); // +1h
    expect(filterEventsByTimeRange([inWindow], 24)).toHaveLength(1);
  });

  it('excludes events that have already started (in the past)', () => {
    const past = makeEvent('Lakers', 'Celtics', [], new Date(now - 1_000).toISOString());
    expect(filterEventsByTimeRange([past], 24)).toHaveLength(0);
  });

  it('excludes events beyond the hoursAhead cutoff', () => {
    const farFuture = makeEvent('Lakers', 'Celtics', [], new Date(now + 49 * 3_600_000).toISOString()); // +49h
    expect(filterEventsByTimeRange([farFuture], 48)).toHaveLength(0);
  });

  it('uses 24 hours as the default window', () => {
    const in12h = makeEvent('A', 'B', [], new Date(now + 12 * 3_600_000).toISOString());
    const in25h = makeEvent('C', 'D', [], new Date(now + 25 * 3_600_000).toISOString());
    const filtered = filterEventsByTimeRange([in12h, in25h]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].home_team).toBe('A');
  });
});

// ============================================================================
// sortEventsByValue
// ============================================================================

describe('sortEventsByValue', () => {
  it('sorts events descending by combined spread edge + marketEfficiency', async () => {
    const spreadEvent = makeEvent('Lakers', 'Celtics', [
      makeBookmaker('BookA', [{
        key: 'spreads',
        outcomes: [{ name: 'Celtics', price: 200 }], // big underdog = high edge
      }]),
      makeBookmaker('BookB', [{
        key: 'spreads',
        outcomes: [{ name: 'Celtics', price: 180 }],
      }]),
    ]);

    const flatEvent = makeEvent('Warriors', 'Nets', [
      makeBookmaker('BookA', [{
        key: 'h2h',
        outcomes: [{ name: 'Warriors', price: -110 }],
      }]),
    ]);

    const { transformOddsEvent: tx } = await import('@/lib/odds-transformer');
    const transformed = [tx(flatEvent), tx(spreadEvent)];
    const sorted = sortEventsByValue(transformed);

    // The spread event should rank first (higher edge)
    expect(sorted[0].event.home_team).toBe('Lakers');
  });

  it('returns the same array (sorted in-place)', async () => {
    const event = makeEvent('Lakers', 'Celtics', [makeBookmaker('DK', [])]);
    const { transformOddsEvent: tx } = await import('@/lib/odds-transformer');
    const arr = [tx(event)];
    const result = sortEventsByValue(arr);
    expect(result).toBe(arr);
  });
});
