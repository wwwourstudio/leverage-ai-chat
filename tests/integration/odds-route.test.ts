import { describe, it, expect, beforeAll } from 'vitest';
import { canReachAPI } from '../setup';

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4';

describe('Odds API Route – Live Integration', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await canReachAPI();
  });

  /**
   * GET /v4/sports — list all available sports
   */
  describe('GET /sports (available sports)', () => {
    let sports: any[];

    beforeAll(async () => {
      if (!reachable) return;
      const res = await fetch(`${BASE_URL}/sports?apiKey=${ODDS_API_KEY}`);
      expect(res.ok).toBe(true);
      sports = await res.json();
    });

    it('returns a non-empty array of sports', ({ skip }: any) => {
      if (!reachable) skip();
      expect(Array.isArray(sports)).toBe(true);
      expect(sports.length).toBeGreaterThan(0);
    });

    it('each sport has the expected shape', ({ skip }: any) => {
      if (!reachable) skip();
      for (const sport of sports.slice(0, 5)) {
        expect(sport).toHaveProperty('key');
        expect(sport).toHaveProperty('group');
        expect(sport).toHaveProperty('title');
        expect(sport).toHaveProperty('active');
        expect(typeof sport.key).toBe('string');
        expect(typeof sport.title).toBe('string');
        expect(typeof sport.active).toBe('boolean');
      }
    });

    it('contains at least one active sport', ({ skip }: any) => {
      if (!reachable) skip();
      const activeSports = sports.filter((s: any) => s.active);
      expect(activeSports.length).toBeGreaterThan(0);
    });
  });

  /**
   * GET /v4/sports/{sport}/odds — fetch live odds for a sport
   */
  describe('GET /sports/upcoming/odds (live odds)', () => {
    let oddsResponse: Response;
    let oddsData: any[];

    beforeAll(async () => {
      if (!reachable) return;
      oddsResponse = await fetch(
        `${BASE_URL}/sports/upcoming/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h`
      );
      expect(oddsResponse.ok).toBe(true);
      oddsData = await oddsResponse.json();
    });

    it('returns an array of events', ({ skip }: any) => {
      if (!reachable) skip();
      expect(Array.isArray(oddsData)).toBe(true);
    });

    it('includes rate-limit headers', ({ skip }: any) => {
      if (!reachable) skip();
      const remaining = oddsResponse.headers.get('x-requests-remaining');
      const used = oddsResponse.headers.get('x-requests-used');
      expect(remaining).not.toBeNull();
      expect(used).not.toBeNull();
    });

    it('each event has required fields', ({ skip }: any) => {
      if (!reachable) skip();
      for (const event of oddsData.slice(0, 5)) {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('sport_key');
        expect(event).toHaveProperty('sport_title');
        expect(event).toHaveProperty('commence_time');
        expect(event).toHaveProperty('home_team');
        expect(event).toHaveProperty('away_team');
      }
    });

    it('events with bookmakers have well-formed market data', ({ skip }: any) => {
      if (!reachable) skip();
      const eventsWithBooks = oddsData.filter(
        (e: any) => e.bookmakers && e.bookmakers.length > 0
      );

      for (const event of eventsWithBooks.slice(0, 3)) {
        const book = event.bookmakers[0];
        expect(book).toHaveProperty('key');
        expect(book).toHaveProperty('title');
        expect(book).toHaveProperty('markets');
        expect(Array.isArray(book.markets)).toBe(true);

        for (const market of book.markets) {
          expect(market).toHaveProperty('key');
          expect(market).toHaveProperty('outcomes');
          expect(Array.isArray(market.outcomes)).toBe(true);

          for (const outcome of market.outcomes) {
            expect(outcome).toHaveProperty('name');
            expect(outcome).toHaveProperty('price');
            expect(typeof outcome.price).toBe('number');
          }
        }
      }
    });
  });

  /**
   * Implied probability calculation (mirrors route logic)
   */
  describe('implied probability calculation', () => {
    function calculateImpliedProbability(americanOdds: number): number {
      if (americanOdds > 0) {
        return 100 / (americanOdds + 100);
      } else {
        return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
      }
    }

    it('converts positive American odds correctly', () => {
      expect(calculateImpliedProbability(150)).toBeCloseTo(0.4, 4);
      expect(calculateImpliedProbability(100)).toBeCloseTo(0.5, 4);
    });

    it('converts negative American odds correctly', () => {
      expect(calculateImpliedProbability(-200)).toBeCloseTo(0.6667, 3);
      expect(calculateImpliedProbability(-110)).toBeCloseTo(0.5238, 3);
    });

    it('produces valid probabilities from live odds data', async ({ skip }: any) => {
      if (!reachable) skip();
      const res = await fetch(
        `${BASE_URL}/sports/upcoming/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h`
      );
      const events = await res.json();

      const eventsWithBooks = events.filter(
        (e: any) => e.bookmakers && e.bookmakers.length > 0
      );

      for (const event of eventsWithBooks.slice(0, 3)) {
        const outcomes = event.bookmakers[0].markets[0]?.outcomes || [];
        for (const outcome of outcomes) {
          const prob = calculateImpliedProbability(outcome.price);
          expect(prob).toBeGreaterThan(0);
          expect(prob).toBeLessThan(1);
        }
      }
    });
  });

  /**
   * Spreads market
   */
  describe('GET /sports/{sport}/odds with spreads market', () => {
    it('returns spread data with point values', async ({ skip }: any) => {
      if (!reachable) skip();
      const res = await fetch(
        `${BASE_URL}/sports/upcoming/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads`
      );
      expect(res.ok).toBe(true);
      const events = await res.json();

      const eventsWithSpreads = events.filter(
        (e: any) =>
          e.bookmakers?.some((b: any) =>
            b.markets?.some((m: any) => m.key === 'spreads')
          )
      );

      for (const event of eventsWithSpreads.slice(0, 3)) {
        const spreadMarket = event.bookmakers[0].markets.find(
          (m: any) => m.key === 'spreads'
        );
        if (spreadMarket) {
          for (const outcome of spreadMarket.outcomes) {
            expect(outcome).toHaveProperty('name');
            expect(outcome).toHaveProperty('price');
            expect(outcome).toHaveProperty('point');
            expect(typeof outcome.point).toBe('number');
          }
        }
      }
    });
  });

  /**
   * Error handling
   */
  describe('error handling', () => {
    it('returns an error for an invalid sport key', async ({ skip }: any) => {
      if (!reachable) skip();
      const res = await fetch(
        `${BASE_URL}/sports/invalid_sport_xyz/odds?apiKey=${ODDS_API_KEY}&regions=us`
      );
      expect(res.ok).toBe(false);
      expect(res.status).toBe(404);
    });

    it('returns 401 for an invalid API key', async ({ skip }: any) => {
      if (!reachable) skip();
      const res = await fetch(
        `${BASE_URL}/sports/upcoming/odds?apiKey=invalid_key_12345&regions=us`
      );
      expect(res.ok).toBe(false);
      expect(res.status).toBe(401);
    });
  });
});
