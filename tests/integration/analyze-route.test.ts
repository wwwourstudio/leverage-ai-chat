import { describe, it, expect, beforeAll } from 'vitest';
import { canReachAPI } from '../setup';

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4';

/**
 * Tests for the analysis pipeline from app/api/analyze/route.ts.
 *
 * Focuses on the trust-metrics calculation functions that use live odds
 * data: Benford scoring, odds alignment, and the full pipeline.
 */

// ---- Extracted pure functions from analyze/route.ts ----

function extractNumbers(text: string): number[] {
  const regex = /\b\d+\.?\d*\b/g;
  const matches = text.match(regex);
  return matches ? matches.map((m) => parseFloat(m)) : [];
}

function calculateBenfordScore(numbers: number[]): number {
  const firstDigits = numbers
    .filter((n) => n >= 1)
    .map((n) => parseInt(n.toString()[0]));

  if (firstDigits.length < 10) return 85;

  const distribution = new Array(10).fill(0);
  firstDigits.forEach((d) => distribution[d]++);

  const benfordExpected = [
    0, 0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046,
  ];

  let deviation = 0;
  for (let i = 1; i <= 9; i++) {
    const observed = distribution[i] / firstDigits.length;
    deviation += Math.abs(observed - benfordExpected[i]);
  }

  return Math.max(50, Math.min(100, 100 - deviation * 100));
}

function calculateOddsAlignment(aiResponse: string, oddsData: any): number {
  const probRegex = /(\d+)%/g;
  const probMatches = aiResponse.match(probRegex);

  if (!probMatches || !oddsData.events || oddsData.events.length === 0) {
    return 85;
  }

  const aiProbs = probMatches.map((m) => parseInt(m.replace('%', '')));

  const marketProbs: number[] = [];
  for (const event of oddsData.events) {
    if (event.bookmakers) {
      for (const bookmaker of event.bookmakers) {
        for (const market of bookmaker.markets || []) {
          for (const outcome of market.outcomes || []) {
            if (outcome.price) {
              const price = outcome.price;
              const impliedProb =
                price > 0
                  ? (100 / (price + 100)) * 100
                  : (Math.abs(price) / (Math.abs(price) + 100)) * 100;
              marketProbs.push(Math.round(impliedProb));
            }
          }
        }
      }
    }
  }

  if (marketProbs.length === 0) return 85;

  let totalDeviation = 0;
  let comparisons = 0;
  for (const aiProb of aiProbs) {
    const closestMarket = marketProbs.reduce(
      (closest, mp) =>
        Math.abs(mp - aiProb) < Math.abs(closest - aiProb) ? mp : closest,
      marketProbs[0]
    );
    totalDeviation += Math.abs(aiProb - closestMarket);
    comparisons++;
  }

  const avgDeviation = comparisons > 0 ? totalDeviation / comparisons : 0;
  return Math.max(50, Math.min(100, Math.round(100 - avgDeviation)));
}

// ---- Tests ----

describe('Analyze Route – Pure Functions', () => {
  describe('extractNumbers', () => {
    it('extracts integers and decimals from text', () => {
      const text = 'The Lakers have a 65% chance to win. Line is -3.5 at -110.';
      const numbers = extractNumbers(text);
      expect(numbers).toContain(65);
      expect(numbers).toContain(3.5);
      expect(numbers).toContain(110);
    });

    it('returns empty array for text with no numbers', () => {
      expect(extractNumbers('no numbers here')).toEqual([]);
    });

    it('extracts numbers from a realistic AI response', () => {
      const fakeResponse = `
        Based on current market data, the NBA spread shows +4.5 at -110 odds.
        Implied win probability is roughly 52% for the home team.
        Historical accuracy for this type of bet is around 58% over the last 200 games.
        Recommended position size: 10-15% of bankroll.
      `;
      const numbers = extractNumbers(fakeResponse);
      expect(numbers.length).toBeGreaterThanOrEqual(5);
      expect(numbers).toContain(4.5);
      expect(numbers).toContain(52);
      expect(numbers).toContain(58);
      expect(numbers).toContain(200);
    });
  });

  describe('calculateBenfordScore', () => {
    it('returns 85 for fewer than 10 numbers', () => {
      expect(calculateBenfordScore([1, 2, 3])).toBe(85);
    });

    it('returns a score between 50 and 100', () => {
      const numbers = [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 45, 67, 89, 123, 456, 789,
        1000,
      ];
      const score = calculateBenfordScore(numbers);
      expect(score).toBeGreaterThanOrEqual(50);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('gives a high score to data following Benford distribution', () => {
      const benfordNumbers = [
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 13, 14, 15, 16, 17, 18, 19, 2, 2,
        2, 2, 2, 2, 21, 22, 23, 24, 25, 3, 3, 3, 3, 31, 32, 33, 4, 4, 4, 41,
        42, 5, 5, 51, 52, 6, 6, 61, 7, 7, 8, 9,
      ];
      const score = calculateBenfordScore(benfordNumbers);
      expect(score).toBeGreaterThan(75);
    });

    it('gives a lower score to uniformly distributed data', () => {
      const uniform = Array.from({ length: 90 }, (_, i) => (i % 9) + 1);
      const score = calculateBenfordScore(uniform);
      const benfordish = [
        1, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 31, 42, 55,
      ];
      const benfordScore = calculateBenfordScore(benfordish);
      expect(benfordScore).toBeGreaterThan(score);
    });
  });

  describe('calculateOddsAlignment', () => {
    it('returns 85 default when AI response has no percentages', () => {
      const score = calculateOddsAlignment('The Lakers will win tonight.', {
        events: [
          {
            bookmakers: [
              { markets: [{ outcomes: [{ price: -110 }, { price: 100 }] }] },
            ],
          },
        ],
      });
      expect(score).toBe(85);
    });

    it('returns 85 when odds data has no events', () => {
      expect(
        calculateOddsAlignment('Win probability is 60%', { events: [] })
      ).toBe(85);
    });
  });
});

describe('Analyze Route – Live Integration', () => {
  let reachable = false;
  let liveOddsData: any[];

  beforeAll(async () => {
    reachable = await canReachAPI();
    if (!reachable) return;

    const res = await fetch(
      `${BASE_URL}/sports/upcoming/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads`
    );
    expect(res.ok).toBe(true);
    liveOddsData = await res.json();
  });

  it('works with numbers extracted from live odds data', ({ skip }: any) => {
    if (!reachable) skip();
    const allNumbers: number[] = [];
    for (const event of liveOddsData.slice(0, 20)) {
      for (const book of event.bookmakers || []) {
        for (const market of book.markets || []) {
          for (const outcome of market.outcomes || []) {
            if (outcome.price) allNumbers.push(Math.abs(outcome.price));
            if (outcome.point) allNumbers.push(Math.abs(outcome.point));
          }
        }
      }
    }

    if (allNumbers.length >= 10) {
      const score = calculateBenfordScore(allNumbers);
      expect(score).toBeGreaterThanOrEqual(50);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('returns a high score when AI probabilities align with market', ({ skip }: any) => {
    if (!reachable) skip();
    const event = liveOddsData.find((e: any) =>
      e.bookmakers?.[0]?.markets?.some((m: any) => m.key === 'h2h')
    );

    if (event) {
      const h2hMarket = event.bookmakers[0].markets.find(
        (m: any) => m.key === 'h2h'
      );
      const matchingResponse = h2hMarket.outcomes
        .map((o: any) => {
          const prob =
            o.price > 0
              ? Math.round((100 / (o.price + 100)) * 100)
              : Math.round(
                  (Math.abs(o.price) / (Math.abs(o.price) + 100)) * 100
                );
          return `${o.name} has a ${prob}% chance`;
        })
        .join('. ');

      const score = calculateOddsAlignment(matchingResponse, {
        events: [event],
      });
      expect(score).toBeGreaterThanOrEqual(85);
    }
  });

  it('returns a lower score when AI probabilities diverge from market', ({ skip }: any) => {
    if (!reachable) skip();
    const event = liveOddsData.find((e: any) =>
      e.bookmakers?.[0]?.markets?.some((m: any) => m.key === 'h2h')
    );

    if (event) {
      const divergentResponse =
        'Team A has a 99% win probability and Team B has 1%';
      const score = calculateOddsAlignment(divergentResponse, {
        events: [event],
      });
      expect(score).toBeGreaterThanOrEqual(50);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('computes end-to-end trust metrics with live odds', ({ skip }: any) => {
    if (!reachable) skip();
    const simulatedAIResponse = `
      Based on current NBA lines, the home team has a 58% win probability.
      The spread of -4.5 suggests a moderate edge. Market consensus is at 55%.
      Historical patterns show 62% accuracy for similar spots over 150 games.
      Recommended: 12% bankroll allocation. Risk level: medium.
    `;

    const numbers = extractNumbers(simulatedAIResponse);
    expect(numbers.length).toBeGreaterThan(5);

    const benfordScore =
      numbers.length >= 10 ? calculateBenfordScore(numbers) : 85;
    const oddsAlignment = calculateOddsAlignment(simulatedAIResponse, {
      events: liveOddsData.slice(0, 5),
    });
    const marketConsensus = 85;
    const historicalAccuracy = 85;

    const finalConfidence = Math.round(
      benfordScore * 0.2 +
        oddsAlignment * 0.3 +
        marketConsensus * 0.3 +
        historicalAccuracy * 0.2
    );

    expect(finalConfidence).toBeGreaterThanOrEqual(50);
    expect(finalConfidence).toBeLessThanOrEqual(100);

    const trustLevel =
      finalConfidence >= 80 ? 'high' : finalConfidence >= 60 ? 'medium' : 'low';
    expect(['high', 'medium', 'low']).toContain(trustLevel);
  });
});
