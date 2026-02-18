import { describe, it, expect, beforeAll } from 'vitest';
import { canReachAPI } from '../setup';

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4';

/**
 * Tests for the insights calculation logic from app/api/insights/route.ts.
 *
 * The insights route primarily reads from Supabase, so we test the pure
 * calculation functions and validate that they produce correct results
 * when fed data derived from live odds.
 */

// ---- Extracted from insights/route.ts ----

function getDefaultInsights() {
  return {
    totalValue: 0,
    winRate: 0,
    roi: 0,
    activeContests: 0,
    totalInvested: 0,
    avgConfidence: 0,
    dataSource: 'default',
    message: 'Start making predictions to see your insights',
  };
}

function calculateInsightsFromPredictions(predictions: any[]) {
  if (predictions.length === 0) {
    return getDefaultInsights();
  }

  const validPredictions = predictions.filter((p) => p.trust_metrics);

  let totalConfidence = 0;
  let highConfidencePredictions = 0;
  let totalFinalConfidence = 0;

  validPredictions.forEach((pred) => {
    const metrics = pred.trust_metrics;
    if (metrics.finalConfidence) {
      totalFinalConfidence += metrics.finalConfidence;
      if (metrics.finalConfidence >= 80) {
        highConfidencePredictions++;
      }
    }
    if (pred.confidence) {
      totalConfidence += pred.confidence;
    }
  });

  const avgConfidence =
    validPredictions.length > 0 ? totalConfidence / validPredictions.length : 75;

  const avgFinalConfidence =
    validPredictions.length > 0
      ? totalFinalConfidence / validPredictions.length
      : 75;

  const simulatedROI = ((avgFinalConfidence - 50) / 50) * 20;

  const winRate =
    validPredictions.length > 0
      ? (highConfidencePredictions / validPredictions.length) * 100
      : 65;

  return {
    totalValue: parseFloat((2500 + simulatedROI * 100).toFixed(2)),
    winRate: parseFloat(winRate.toFixed(1)),
    roi: parseFloat(simulatedROI.toFixed(1)),
    activeContests: predictions.length,
    totalInvested: 2500,
    avgConfidence: parseFloat(avgConfidence.toFixed(1)),
    dataSource: 'calculated',
    lastUpdated: new Date().toISOString(),
  };
}

// ---- Tests ----

describe('Insights Route – Calculation Logic', () => {
  describe('getDefaultInsights', () => {
    it('returns zeroed-out insights', () => {
      const defaults = getDefaultInsights();
      expect(defaults.totalValue).toBe(0);
      expect(defaults.winRate).toBe(0);
      expect(defaults.roi).toBe(0);
      expect(defaults.activeContests).toBe(0);
      expect(defaults.totalInvested).toBe(0);
      expect(defaults.avgConfidence).toBe(0);
      expect(defaults.dataSource).toBe('default');
      expect(defaults.message).toBeTruthy();
    });
  });

  describe('calculateInsightsFromPredictions', () => {
    it('returns default insights for empty predictions', () => {
      const result = calculateInsightsFromPredictions([]);
      expect(result).toEqual(getDefaultInsights());
    });

    it('calculates correct metrics for predictions with trust_metrics', () => {
      const predictions = [
        { confidence: 85, trust_metrics: { finalConfidence: 88 } },
        { confidence: 90, trust_metrics: { finalConfidence: 92 } },
        { confidence: 70, trust_metrics: { finalConfidence: 72 } },
      ];

      const result = calculateInsightsFromPredictions(predictions);

      // avgConfidence = (85 + 90 + 70) / 3 ≈ 81.7
      expect(result.avgConfidence).toBeCloseTo(81.7, 1);
      expect(result.activeContests).toBe(3);

      // highConfidencePredictions = 2 (88, 92 >= 80), winRate = 66.7%
      expect(result.winRate).toBeCloseTo(66.7, 1);

      // avgFinalConfidence = (88 + 92 + 72) / 3 ≈ 84
      // simulatedROI = ((84 - 50) / 50) * 20 = 13.6
      expect(result.roi).toBeCloseTo(13.6, 1);

      // totalValue = 2500 + 13.6 * 100 = 3860
      expect(result.totalValue).toBeCloseTo(3860, 0);
      expect(result.dataSource).toBe('calculated');
      expect(result.totalInvested).toBe(2500);
    });

    it('handles predictions without trust_metrics gracefully', () => {
      const predictions = [
        { confidence: 80 },
        { confidence: 70, trust_metrics: { finalConfidence: 75 } },
      ];

      const result = calculateInsightsFromPredictions(predictions);
      expect(result.activeContests).toBe(2);
      // Only 1 valid prediction: avgConfidence = 70/1 = 70
      expect(result.avgConfidence).toBe(70);
    });

    it('handles all high-confidence predictions', () => {
      const predictions = Array.from({ length: 10 }, (_, i) => ({
        confidence: 90 + (i % 5),
        trust_metrics: { finalConfidence: 85 + (i % 10) },
      }));

      const result = calculateInsightsFromPredictions(predictions);
      expect(result.winRate).toBe(100);
      expect(result.roi).toBeGreaterThan(0);
      expect(result.totalValue).toBeGreaterThan(2500);
    });

    it('handles all low-confidence predictions', () => {
      const predictions = Array.from({ length: 5 }, () => ({
        confidence: 55,
        trust_metrics: { finalConfidence: 60 },
      }));

      const result = calculateInsightsFromPredictions(predictions);
      expect(result.winRate).toBe(0);
      // avgFinalConfidence = 60, ROI = ((60-50)/50)*20 = 4.0
      expect(result.roi).toBeCloseTo(4.0, 1);
    });
  });
});

describe('Insights Route – Live Odds Data Pipeline', () => {
  let reachable = false;
  let liveOddsData: any[];

  beforeAll(async () => {
    reachable = await canReachAPI();
    if (!reachable) return;

    const res = await fetch(
      `${BASE_URL}/sports/upcoming/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h`
    );
    expect(res.ok).toBe(true);
    liveOddsData = await res.json();
  });

  it('generates simulated predictions from live odds and calculates insights', ({ skip }) => {
    if (!reachable) skip();

    const simulatedPredictions = liveOddsData.slice(0, 20).map((event: any) => {
      const book = event.bookmakers?.[0];
      const market = book?.markets?.[0];
      const outcomes = market?.outcomes || [];

      let confidence = 75;
      if (outcomes.length >= 2) {
        const prices = outcomes.map((o: any) => Math.abs(o.price));
        const spread = Math.abs(prices[0] - prices[1]);
        confidence = Math.min(95, 70 + spread * 0.1);
      }

      return {
        sport: event.sport_key,
        matchup: `${event.home_team} vs ${event.away_team}`,
        confidence: Math.round(confidence),
        trust_metrics: {
          finalConfidence: Math.round(confidence * 0.95),
        },
      };
    });

    const insights = calculateInsightsFromPredictions(simulatedPredictions);

    expect(insights.activeContests).toBe(simulatedPredictions.length);
    expect(insights.avgConfidence).toBeGreaterThan(0);
    expect(insights.roi).toBeGreaterThanOrEqual(-100);
    expect(insights.totalValue).toBeGreaterThan(0);
    expect(insights.dataSource).toBe('calculated');
    expect(typeof insights.winRate).toBe('number');
    expect(insights.winRate).toBeGreaterThanOrEqual(0);
    expect(insights.winRate).toBeLessThanOrEqual(100);
  });
});
