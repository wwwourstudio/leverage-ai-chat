/**
 * Market Anomaly Detection Engine
 *
 * Computes anomaly scores by measuring how far each market's implied
 * probability deviates from cross-market consensus (in standard-deviation units).
 * Also runs Benford's Law trust scoring on the raw probability values.
 */

import { validateBenford } from '@/lib/benford-validator';
import {
  type NormalizedPrice,
  computeConsensus,
  computeStdDev,
} from './price-normalizer';

/** Anomaly severity thresholds (z-score units) */
export const ANOMALY_THRESHOLDS = {
  LOW: 1.5,
  MEDIUM: 2.0,
  HIGH: 2.5,
} as const;

export interface AnomalyMarket {
  source: string;
  side: string;
  probability: number;
  deviation: number;   // z-score distance from consensus
  direction: 'over' | 'under';
}

export interface AnomalyResult {
  eventId: string;
  sport: string;
  anomalyScore: number;                   // max z-score across all markets
  severity: 'none' | 'low' | 'medium' | 'high';
  affectedMarkets: AnomalyMarket[];       // markets that crossed a threshold
  benfordTrustScore: number;              // 0-100
  benfordDeviation: number;               // chi-square value
  clusterId: string;                      // hex prefix of eventId for grouping
}

/**
 * Classify severity from a z-score.
 */
function scoreSeverity(zScore: number): AnomalyResult['severity'] {
  if (zScore >= ANOMALY_THRESHOLDS.HIGH) return 'high';
  if (zScore >= ANOMALY_THRESHOLDS.MEDIUM) return 'medium';
  if (zScore >= ANOMALY_THRESHOLDS.LOW) return 'low';
  return 'none';
}

/**
 * Simple deterministic cluster ID from event ID.
 * Groups anomalies from the same event without a full clustering algorithm.
 */
function makeClusterId(eventId: string): string {
  // XOR-fold the char codes for a stable 8-char hex hash
  let h = 0x811c9dc5;
  for (let i = 0; i < eventId.length; i++) {
    h ^= eventId.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Detect anomalies in a set of normalized prices for a single event.
 *
 * Algorithm:
 *   consensus = mean(sportsbook prices for 'home' side)
 *   σ = stddev(all sportsbook prices)
 *   for each price p:
 *     z = |p.probability - consensus| / σ
 *   anomalyScore = max z
 *   benfordTrust = validateBenford(prices scaled to integers).score * 100
 */
export function detectAnomalies(
  prices: NormalizedPrice[],
  eventId: string,
  sport: string
): AnomalyResult {
  const sportsbookHome = prices.filter(p => p.source === 'sportsbook' && p.side === 'home');
  const allSportsbook = prices.filter(p => p.source === 'sportsbook');

  const consensus = computeConsensus(sportsbookHome);
  const sigma = computeStdDev(allSportsbook.length >= 2 ? allSportsbook : prices);

  // Benford check on probability values scaled to 1–100 range
  const benfordValues = prices.map(p => Math.round(p.probability * 100)).filter(v => v >= 1);
  const benfordResult = benfordValues.length >= 5
    ? validateBenford(benfordValues)
    : { score: 1, chiSquare: 0 };

  const benfordTrustScore = Math.round(benfordResult.score * 100);
  const benfordDeviation = benfordResult.chiSquare;

  const affectedMarkets: AnomalyMarket[] = [];
  let maxZScore = 0;

  for (const p of prices) {
    const z = Math.abs(p.probability - consensus) / sigma;
    if (z >= ANOMALY_THRESHOLDS.LOW) {
      affectedMarkets.push({
        source: p.market,
        side: p.side,
        probability: p.probability,
        deviation: parseFloat(z.toFixed(4)),
        direction: p.probability > consensus ? 'over' : 'under',
      });
    }
    if (z > maxZScore) maxZScore = z;
  }

  return {
    eventId,
    sport,
    anomalyScore: parseFloat(maxZScore.toFixed(4)),
    severity: scoreSeverity(maxZScore),
    affectedMarkets,
    benfordTrustScore,
    benfordDeviation,
    clusterId: makeClusterId(eventId),
  };
}

/**
 * Group a list of anomaly results by cluster.
 * Returns the same array with a shared clusterId for anomalies within the same event group.
 */
export function clusterAnomalies(anomalies: AnomalyResult[]): AnomalyResult[] {
  // Current implementation uses event-level clustering (already set via makeClusterId).
  // Cross-event clustering (e.g. same team across multiple markets) can be added here.
  return anomalies;
}

/**
 * Compute composite signal strength:
 *   signalStrength = anomalyScore × (benfordTrust/100) × (velocityScore/100) × 100
 * Clamped to [0, 100].
 */
export function computeSignalStrength(
  anomalyScore: number,
  benfordTrust: number,   // 0-100
  velocityScore: number   // 0-100
): number {
  const raw = anomalyScore * (benfordTrust / 100) * (velocityScore / 100) * 100;
  return Math.min(100, Math.max(0, parseFloat(raw.toFixed(2))));
}
