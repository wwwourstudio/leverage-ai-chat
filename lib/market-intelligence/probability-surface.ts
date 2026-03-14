/**
 * Bayesian Probability Surface Model
 *
 * Blends sportsbook consensus, Kalshi prediction market probability,
 * and historical priors using adaptive weights stored in the
 * `signal_performance` Supabase table.
 *
 * P_final = w1 × P_sportsbook + w2 × P_kalshi + w3 × P_historical
 * Weights are re-normalized to sum to 1.0 when some sources are unavailable.
 */

import { createClient } from '@/lib/supabase/server';
import { logger, LogCategory } from '@/lib/logger';
import { type NormalizedPrice, computeConsensus } from './price-normalizer';

export interface SurfaceWeights {
  sportsbook: number;
  prediction_market: number;
  historical: number;
}

export const DEFAULT_WEIGHTS: SurfaceWeights = {
  sportsbook: 0.50,
  prediction_market: 0.30,
  historical: 0.20,
};

export interface ProbabilitySurface {
  eventId: string;
  surfaceProbability: number;
  weights: SurfaceWeights;
  components: {
    sportsbookConsensus: number;
    kalshiProbability: number | null;
    historicalPrior: number | null;
  };
  confidence: number;  // 0-1 based on how many sources contributed
}

/**
 * Load current signal weights from `signal_performance` table.
 * Falls back to DEFAULT_WEIGHTS if DB is unavailable.
 */
export async function loadWeights(): Promise<SurfaceWeights> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('signal_performance')
      .select('signal_name, weight')
      .in('signal_name', ['sportsbook', 'prediction_market', 'historical']);

    if (error || !data || data.length === 0) return DEFAULT_WEIGHTS;

    const weights: Partial<SurfaceWeights> = {};
    for (const row of data) {
      const name = row.signal_name as keyof SurfaceWeights;
      weights[name] = Number(row.weight);
    }

    return {
      sportsbook: weights.sportsbook ?? DEFAULT_WEIGHTS.sportsbook,
      prediction_market: weights.prediction_market ?? DEFAULT_WEIGHTS.prediction_market,
      historical: weights.historical ?? DEFAULT_WEIGHTS.historical,
    };
  } catch (err) {
    logger.info(LogCategory.API, '[market-intelligence] loadWeights fallback', { error: err instanceof Error ? err : String(err) });
    return DEFAULT_WEIGHTS;
  }
}

/**
 * Compute the Bayesian probability blend given component values and weights.
 * Null components are excluded; remaining weights are re-normalized to sum to 1.
 */
export function blendProbabilities(
  sportsbookConsensus: number,
  kalshiProbability: number | null,
  historicalPrior: number | null,
  weights: SurfaceWeights
): { surfaceProbability: number; confidence: number } {
  const components: Array<{ value: number; weight: number }> = [
    { value: sportsbookConsensus, weight: weights.sportsbook },
  ];
  if (kalshiProbability !== null) {
    components.push({ value: kalshiProbability, weight: weights.prediction_market });
  }
  if (historicalPrior !== null) {
    components.push({ value: historicalPrior, weight: weights.historical });
  }

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const surfaceProbability = totalWeight > 0
    ? components.reduce((s, c) => s + c.value * (c.weight / totalWeight), 0)
    : sportsbookConsensus;

  // Confidence: full confidence (1.0) when all 3 sources present
  const confidence = components.length / 3;

  return {
    surfaceProbability: Math.min(1, Math.max(0, parseFloat(surfaceProbability.toFixed(4)))),
    confidence: parseFloat(confidence.toFixed(4)),
  };
}

/**
 * Full async pipeline:
 * 1. Compute sportsbook consensus from normalized prices
 * 2. Load adaptive weights from DB
 * 3. Blend with Kalshi + historical prior
 * 4. Return ProbabilitySurface
 */
export async function buildProbabilitySurface(
  eventId: string,
  prices: NormalizedPrice[],
  kalshiProb: number | null,
  historicalPrior: number | null = null
): Promise<ProbabilitySurface> {
  const sportsbookConsensus = computeConsensus(
    prices.filter(p => p.source === 'sportsbook' && p.side === 'home')
  );

  const weights = await loadWeights();
  const { surfaceProbability, confidence } = blendProbabilities(
    sportsbookConsensus,
    kalshiProb,
    historicalPrior,
    weights
  );

  return {
    eventId,
    surfaceProbability,
    weights,
    components: {
      sportsbookConsensus,
      kalshiProbability: kalshiProb,
      historicalPrior,
    },
    confidence,
  };
}
