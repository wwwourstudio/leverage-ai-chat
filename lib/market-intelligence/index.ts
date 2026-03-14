/**
 * Market Intelligence Orchestrator
 *
 * Single entry point for the market intelligence pipeline.
 * Runs: normalize → surface → anomaly → velocity → store → return report.
 *
 * Also exports a lightweight `getMarketIntelligenceSummary()` for injecting
 * signals into the /api/analyze AI prompt context (DB-only, no live API calls).
 */

import { createClient } from '@/lib/supabase/server';
import { logger, LogCategory } from '@/lib/logger';
import {
  normalizeOddsEvent,
  normalizeKalshiMarkets,
} from './price-normalizer';
import {
  detectAnomalies,
  computeSignalStrength,
  type AnomalyResult,
} from './anomaly-detector';
import { buildProbabilitySurface, type ProbabilitySurface } from './probability-surface';
import {
  computeVelocity,
  recordMovementEvent,
  summarizeVelocity,
  type VelocityResult,
} from './velocity-engine';

export interface TimelineEvent {
  timestamp: string;
  type: 'odds_move' | 'anomaly_detected' | 'kalshi_diverge' | 'velocity_spike' | 'snapshot';
  description: string;
  detail: string;
}

export interface MarketIntelligenceReport {
  eventId: string;
  sport: string;
  // Probability
  surfaceProbability: number;
  sportsbookConsensus: number;
  kalshiProbability: number | null;
  // Anomaly
  anomalyScore: number;
  severity: AnomalyResult['severity'];
  affectedMarkets: AnomalyResult['affectedMarkets'];
  // Trust
  benfordTrustScore: number;
  // Velocity
  velocityScore: number;
  movementType: VelocityResult['movementType'];
  direction: VelocityResult['direction'];
  // Composite
  signalStrength: number;
  // Explainability
  timeline: TimelineEvent[];
  // Meta
  capturedAt: string;
}

/**
 * Full market intelligence pipeline for a single event.
 * Intended to be called by the /api/market-intelligence/snapshot route.
 */
export async function analyzeMarket(
  eventId: string,
  sport: string,
  oddsEvent: Record<string, unknown>,
  kalshiMarkets: Array<Record<string, unknown>> = []
): Promise<MarketIntelligenceReport> {
  const capturedAt = new Date().toISOString();
  const timeline: TimelineEvent[] = [];

  // 1. Normalize prices
  const prices = normalizeOddsEvent(oddsEvent, capturedAt);
  const kalshiPrices = normalizeKalshiMarkets(kalshiMarkets, eventId, capturedAt);
  const allPrices = [...prices, ...kalshiPrices];

  // 2. Extract Kalshi yes probability for the home-equivalent market
  const kalshiYes = kalshiPrices.find(p => p.side === 'yes');
  const kalshiProb = kalshiYes ? kalshiYes.probability : null;

  if (kalshiProb !== null) {
    const sportsbookConsensusForTimeline = prices.filter(p => p.source === 'sportsbook' && p.side === 'home');
    const consensus = sportsbookConsensusForTimeline.length > 0
      ? sportsbookConsensusForTimeline.reduce((s, p) => s + p.probability, 0) / sportsbookConsensusForTimeline.length
      : 0.5;
    const divergence = Math.abs(kalshiProb - consensus);
    if (divergence > 0.05) {
      timeline.push({
        timestamp: capturedAt,
        type: 'kalshi_diverge',
        description: `Kalshi diverges from sportsbooks by ${(divergence * 100).toFixed(1)}%`,
        detail: `Kalshi: ${(kalshiProb * 100).toFixed(1)}% vs Sportsbook: ${(consensus * 100).toFixed(1)}%`,
      });
    }
  }

  // 3. Build probability surface
  let surface: ProbabilitySurface;
  try {
    surface = await buildProbabilitySurface(eventId, allPrices, kalshiProb);
  } catch {
    // Fallback to sportsbook consensus
    const consensus = allPrices.filter(p => p.source === 'sportsbook' && p.side === 'home');
    const fallback = consensus.length > 0
      ? consensus.reduce((s, p) => s + p.probability, 0) / consensus.length
      : 0.5;
    surface = {
      eventId,
      surfaceProbability: fallback,
      weights: { sportsbook: 1, prediction_market: 0, historical: 0 },
      components: { sportsbookConsensus: fallback, kalshiProbability: null, historicalPrior: null },
      confidence: 0.33,
    };
  }

  timeline.push({
    timestamp: capturedAt,
    type: 'snapshot',
    description: `Surface probability: ${(surface.surfaceProbability * 100).toFixed(1)}%`,
    detail: `Sportsbook: ${(surface.components.sportsbookConsensus * 100).toFixed(1)}%, Kalshi: ${kalshiProb !== null ? (kalshiProb * 100).toFixed(1) + '%' : 'N/A'}`,
  });

  // 4. Detect anomalies
  const anomaly = detectAnomalies(allPrices, eventId, sport);

  if (anomaly.severity !== 'none') {
    timeline.push({
      timestamp: capturedAt,
      type: 'anomaly_detected',
      description: `${anomaly.severity.toUpperCase()} anomaly detected (score: ${anomaly.anomalyScore.toFixed(2)})`,
      detail: `${anomaly.affectedMarkets.length} market(s) deviate from consensus`,
    });
  }

  // 5. Compute velocity
  let velocityResults: VelocityResult[] = [];
  try {
    velocityResults = await computeVelocity(eventId, 30);
    // Record in DB (fire-and-forget)
    await Promise.all(velocityResults.map(r => recordMovementEvent(r)));
  } catch {
    // Non-fatal
  }

  const { velocityScore, movementType, direction } = summarizeVelocity(velocityResults);

  if (movementType === 'steam' || movementType === 'correction') {
    timeline.push({
      timestamp: capturedAt,
      type: 'velocity_spike',
      description: `${movementType === 'steam' ? 'Steam move' : 'Correction'} detected`,
      detail: `Velocity score: ${velocityScore}/100, direction: ${direction}`,
    });
  }

  // 6. Composite signal strength
  const signalStrength = computeSignalStrength(
    anomaly.anomalyScore,
    anomaly.benfordTrustScore,
    velocityScore
  );

  // 7. Persist snapshot
  try {
    const supabase = await createClient();
    await supabase.from('market_snapshots').insert({
      event_id: eventId,
      sport,
      home_team: String(oddsEvent.home_team ?? ''),
      away_team: String(oddsEvent.away_team ?? ''),
      market_type: 'h2h',
      sportsbook_prob: surface.components.sportsbookConsensus,
      kalshi_prob: kalshiProb,
      consensus_prob: surface.components.sportsbookConsensus,
      surface_prob: surface.surfaceProbability,
      raw_odds: oddsEvent.bookmakers ?? null,
      captured_at: capturedAt,
    });

    if (anomaly.severity !== 'none') {
      await supabase.from('market_anomalies').insert({
        event_id: eventId,
        sport,
        anomaly_score: anomaly.anomalyScore,
        severity: anomaly.severity,
        affected_markets: anomaly.affectedMarkets,
        cluster_id: anomaly.clusterId,
        benford_trust: anomaly.benfordTrustScore,
        signal_strength: signalStrength,
        detected_at: capturedAt,
      });
    }
  } catch (err) {
    logger.info(LogCategory.API, '[market-intelligence] persistence failed (non-fatal)', { error: err instanceof Error ? err : String(err) });
  }

  return {
    eventId,
    sport,
    surfaceProbability: surface.surfaceProbability,
    sportsbookConsensus: surface.components.sportsbookConsensus,
    kalshiProbability: kalshiProb,
    anomalyScore: anomaly.anomalyScore,
    severity: anomaly.severity,
    affectedMarkets: anomaly.affectedMarkets,
    benfordTrustScore: anomaly.benfordTrustScore,
    velocityScore,
    movementType,
    direction,
    signalStrength,
    timeline,
    capturedAt,
  };
}

/**
 * Lightweight summary for /api/analyze signal injection.
 * Reads from cached market_anomalies + market_snapshots only — no live API calls.
 * Expected latency: <100ms.
 */
export async function getMarketIntelligenceSummary(
  eventId: string,
  sport: string
): Promise<{
  anomalyScore: number;
  severity: string;
  velocityScore: number;
  movementType: string;
  surfaceProbability: number;
  benfordTrust: number;
  signalStrength: number;
} | null> {
  try {
    const supabase = await createClient();

    const [anomalyRes, snapshotRes, velocityRes] = await Promise.all([
      supabase
        .from('market_anomalies')
        .select('anomaly_score, severity, benford_trust, signal_strength')
        .eq('event_id', eventId)
        .order('detected_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('market_snapshots')
        .select('surface_prob')
        .eq('event_id', eventId)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('movement_events')
        .select('velocity_score, movement_type')
        .eq('event_id', eventId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!snapshotRes.data && !anomalyRes.data) return null;

    return {
      anomalyScore: anomalyRes.data?.anomaly_score ?? 0,
      severity: anomalyRes.data?.severity ?? 'none',
      velocityScore: velocityRes.data?.velocity_score ?? 0,
      movementType: velocityRes.data?.movement_type ?? 'stable',
      surfaceProbability: snapshotRes.data?.surface_prob ?? 0.5,
      benfordTrust: anomalyRes.data?.benford_trust ?? 100,
      signalStrength: anomalyRes.data?.signal_strength ?? 0,
    };
  } catch (err) {
    logger.info(LogCategory.API, '[market-intelligence] getMarketIntelligenceSummary failed', { error: err instanceof Error ? err : String(err), metadata: { eventId, sport } });
    return null;
  }
}

// Re-export key types for consumers
export type { AnomalyResult, ProbabilitySurface, VelocityResult };
