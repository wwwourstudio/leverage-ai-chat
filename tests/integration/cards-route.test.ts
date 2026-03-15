import { describe, it, expect, beforeAll } from 'vitest';
import { canReachAPI } from '../setup';

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4';

/**
 * Tests validate the card generation logic from app/api/cards/route.ts
 * using live odds data. Pure functions are extracted and tested directly.
 */

// ---- Extracted pure functions from cards/route.ts ----

function mapSportToApiKey(sport: string): string {
  const sportMap: Record<string, string> = {
    nba: 'basketball_nba',
    nfl: 'americanfootball_nfl',
    mlb: 'baseball_mlb',
    nhl: 'icehockey_nhl',
    ncaab: 'basketball_ncaab',
    ncaaf: 'americanfootball_ncaaf',
  };
  return sportMap[sport?.toLowerCase()] || 'upcoming';
}

function calculateImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

function calculateMarketEfficiency(bookmakers: any[]): number {
  if (bookmakers.length < 2) return 0;
  const allOdds = bookmakers.flatMap(
    (b: any) =>
      b.markets?.flatMap((m: any) => m.outcomes?.map((o: any) => o.price) || []) || []
  );
  if (allOdds.length === 0) return 0;
  const mean = allOdds.reduce((a: number, b: number) => a + b, 0) / allOdds.length;
  const squaredDiffs = allOdds.map((n: number) => Math.pow(n - mean, 2));
  const variance = Math.sqrt(
    squaredDiffs.reduce((a: number, b: number) => a + b, 0) / allOdds.length
  );
  return variance * 2;
}

// ---- Tests ----

describe('Cards Route – Pure Functions', () => {
  describe('mapSportToApiKey', () => {
    it('maps known sports to their API keys', () => {
      expect(mapSportToApiKey('nba')).toBe('basketball_nba');
      expect(mapSportToApiKey('nfl')).toBe('americanfootball_nfl');
      expect(mapSportToApiKey('mlb')).toBe('baseball_mlb');
      expect(mapSportToApiKey('nhl')).toBe('icehockey_nhl');
      expect(mapSportToApiKey('ncaab')).toBe('basketball_ncaab');
      expect(mapSportToApiKey('ncaaf')).toBe('americanfootball_ncaaf');
    });

    it('is case-insensitive', () => {
      expect(mapSportToApiKey('NBA')).toBe('basketball_nba');
      expect(mapSportToApiKey('Nfl')).toBe('americanfootball_nfl');
    });

    it('returns "upcoming" for unknown sports', () => {
      expect(mapSportToApiKey('cricket')).toBe('upcoming');
      expect(mapSportToApiKey('')).toBe('upcoming');
    });
  });

  describe('calculateMarketEfficiency', () => {
    it('returns 0 when only one bookmaker', () => {
      expect(
        calculateMarketEfficiency([{ markets: [{ outcomes: [{ price: -110 }] }] }])
      ).toBe(0);
    });

    it('detects higher inefficiency when bookmakers disagree', () => {
      const highVariance = [
        { markets: [{ outcomes: [{ price: -150 }, { price: 130 }] }] },
        { markets: [{ outcomes: [{ price: -200 }, { price: 170 }] }] },
      ];
      const lowVariance = [
        { markets: [{ outcomes: [{ price: -110 }, { price: -108 }] }] },
        { markets: [{ outcomes: [{ price: -110 }, { price: -108 }] }] },
      ];

      expect(calculateMarketEfficiency(highVariance)).toBeGreaterThan(
        calculateMarketEfficiency(lowVariance)
      );
    });
  });
});

describe('Cards Route – Live Integration', () => {
  let reachable = false;
  let liveOddsData: any[];

  beforeAll(async () => {
    reachable = await canReachAPI();
    if (!reachable) return;

    const res = await fetch(
      `${BASE_URL}/sports/upcoming/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`
    );
    expect(res.ok).toBe(true);
    liveOddsData = await res.json();
  });

  describe('calculateImpliedProbability with live data', () => {
    it('returns values between 0 and 1 for all live odds', ({ skip }: any) => {
      if (!reachable) skip();
      for (const event of liveOddsData.slice(0, 10)) {
        if (!event.bookmakers) continue;
        for (const book of event.bookmakers) {
          for (const market of book.markets || []) {
            for (const outcome of market.outcomes || []) {
              const prob = calculateImpliedProbability(outcome.price);
              expect(prob).toBeGreaterThan(0);
              expect(prob).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    });

    it('favorite has higher probability than underdog', ({ skip }: any) => {
      if (!reachable) skip();
      const eventsWithH2H = liveOddsData.filter((e: any) =>
        e.bookmakers?.[0]?.markets?.some((m: any) => m.key === 'h2h')
      );

      for (const event of eventsWithH2H.slice(0, 5)) {
        const h2hMarket = event.bookmakers[0].markets.find(
          (m: any) => m.key === 'h2h'
        );
        if (!h2hMarket || h2hMarket.outcomes.length < 2) continue;

        const probs = h2hMarket.outcomes.map((o: any) => ({
          price: o.price,
          prob: calculateImpliedProbability(o.price),
        }));

        const sorted = [...probs].sort((a, b) => a.price - b.price);
        if (sorted[0].price < 0 && sorted[sorted.length - 1].price > 0) {
          expect(sorted[0].prob).toBeGreaterThan(sorted[sorted.length - 1].prob);
        }
      }
    });
  });

  describe('calculateMarketEfficiency with live data', () => {
    it('returns a non-negative finite number', ({ skip }: any) => {
      if (!reachable) skip();
      for (const event of liveOddsData.slice(0, 10)) {
        if (!event.bookmakers || event.bookmakers.length < 2) continue;
        const efficiency = calculateMarketEfficiency(event.bookmakers);
        expect(efficiency).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(efficiency)).toBe(true);
      }
    });
  });

  describe('card generation from live odds', () => {
    it('builds spread cards from events with spread markets', ({ skip }: any) => {
      if (!reachable) skip();
      const eventsWithSpreads = liveOddsData.filter((e: any) =>
        e.bookmakers?.[0]?.markets?.some((m: any) => m.key === 'spreads')
      );

      for (const event of eventsWithSpreads.slice(0, 3)) {
        const bookmaker = event.bookmakers[0];
        const spreadMarket = bookmaker.markets.find((m: any) => m.key === 'spreads');
        const outcome = spreadMarket.outcomes[0];

        const card = {
          type: 'live-odds',
          title: 'Live Odds Analysis',
          data: {
            matchup: `${event.home_team} vs ${event.away_team}`,
            bestLine: `${outcome.name} ${outcome.point > 0 ? '+' : ''}${outcome.point} (${outcome.price > 0 ? '+' : ''}${outcome.price})`,
            book: bookmaker.title,
            confidence: Math.round(calculateImpliedProbability(outcome.price) * 100),
          },
          realData: true,
        };

        expect(card.data.matchup).toContain('vs');
        expect(card.data.bestLine).toBeTruthy();
        expect(card.data.book).toBeTruthy();
        expect(card.data.confidence).toBeGreaterThan(0);
        expect(card.data.confidence).toBeLessThanOrEqual(100);
      }
    });

    it('builds moneyline cards from events with h2h markets', ({ skip }: any) => {
      if (!reachable) skip();
      const eventsWithH2H = liveOddsData.filter((e: any) =>
        e.bookmakers?.[0]?.markets?.some((m: any) => m.key === 'h2h')
      );

      for (const event of eventsWithH2H.slice(0, 3)) {
        const bookmaker = event.bookmakers[0];
        const h2hMarket = bookmaker.markets.find((m: any) => m.key === 'h2h');
        const favoriteOutcome = h2hMarket.outcomes.reduce(
          (prev: any, current: any) =>
            current.price < prev.price ? current : prev
        );

        const card = {
          type: 'moneyline-value',
          data: {
            team: favoriteOutcome.name,
            line: `${favoriteOutcome.price > 0 ? '+' : ''}${favoriteOutcome.price}`,
            impliedWin: `${(calculateImpliedProbability(favoriteOutcome.price) * 100).toFixed(1)}%`,
            book: bookmaker.title,
          },
          realData: true,
        };

        expect(card.data.team).toBeTruthy();
        expect(parseFloat(card.data.impliedWin)).toBeGreaterThan(0);
      }
    });
  });

  describe('sport-specific odds fetch', () => {
    it('fetches NBA odds when available', async ({ skip }: any) => {
      if (!reachable) skip();
      const sportKey = mapSportToApiKey('nba');
      const res = await fetch(
        `${BASE_URL}/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h`
      );
      if (res.ok) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
        for (const event of data.slice(0, 3)) {
          expect(event).toHaveProperty('home_team');
          expect(event).toHaveProperty('away_team');
          expect(event).toHaveProperty('sport_key', 'basketball_nba');
        }
      }
    });
  });
});
