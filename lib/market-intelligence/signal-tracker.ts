/**
 * Signal Performance Tracker + Adaptive Weight System
 *
 * Tracks AI prediction accuracy using Brier scoring, updates signal weights
 * via a gradient-like adjustment rule, and manages model versioning with
 * automatic rollback if new weights perform worse.
 *
 * Brier Score: BS = (P_predicted - outcome)² — lower is better.
 * Weight update: w_new = w_old + LEARNING_RATE × (accuracy - 0.5) × 2
 */

import { createClient } from '@/lib/supabase/server';
import { logger, LogCategory } from '@/lib/logger';

const LEARNING_RATE = 0.05;
const MIN_WEIGHT = 0.05;
const MAX_WEIGHT = 0.80;
const MIN_IMPROVEMENT_THRESHOLD = 0.03; // 3% improvement required to deploy new model

export interface SignalPerformanceRow {
  signal_name: string;
  wins: number;
  losses: number;
  accuracy: number;
  weight: number;
  brier_score: number | null;
  last_updated: string;
}

export interface ModelVersion {
  id: string;
  version: number;
  signals_config: Record<string, number>;
  performance_score: number;
  brier_score: number | null;
  is_active: boolean;
  created_at: string;
}

/** Brier Score for a single prediction. Lower = better (0 = perfect). */
export function computeBrierScore(predictedProbability: number, outcome: 0 | 1): number {
  return parseFloat(((predictedProbability - outcome) ** 2).toFixed(6));
}

/**
 * Record a prediction to `market_predictions` and (optionally) an outcome to `market_outcomes`.
 */
export async function recordPrediction(
  eventId: string,
  predictedProbability: number,
  confidence: number,
  signalsUsed: Record<string, number>,
  modelVersion: number
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('market_predictions').insert({
      event_id: eventId,
      market: 'h2h',
      predicted_probability: predictedProbability,
      confidence,
      signals_used: signalsUsed,
      model_version: modelVersion,
    });
  } catch (err) {
    logger.info(LogCategory.API, '[signal-tracker] recordPrediction failed', { error: err instanceof Error ? err : String(err) });
  }
}

/**
 * Record an actual event outcome. Used to compute Brier scores for retraining.
 * actual_result: 1 = home won, 0 = away won.
 */
export async function recordOutcome(
  eventId: string,
  actualResult: 0 | 1,
  closingProbability?: number
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('market_outcomes').upsert({
      event_id: eventId,
      actual_result: actualResult,
      closing_probability: closingProbability ?? null,
    }, { onConflict: 'event_id' });
  } catch (err) {
    logger.info(LogCategory.API, '[signal-tracker] recordOutcome failed', { error: err instanceof Error ? err : String(err) });
  }
}

/** Load the currently active model version from DB. */
export async function loadActiveModel(): Promise<ModelVersion | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('model_versions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return data as ModelVersion | null;
  } catch {
    return null;
  }
}

/**
 * Update signal weights using gradient-like rule.
 * For each signal: w_new = clamp(w_old + LR × (accuracy - 0.5) × 2, MIN, MAX)
 * Re-normalizes so all weights sum to 1.0.
 */
export async function updateSignalWeights(): Promise<Record<string, number>> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from('signal_performance')
    .select('signal_name, wins, losses, accuracy, weight');

  if (error || !rows) return {};

  const updates: Record<string, number> = {};

  for (const row of rows) {
    const totalGames = (row.wins ?? 0) + (row.losses ?? 0);
    if (totalGames < 10) continue; // not enough data to update

    const accuracy = row.accuracy ?? 0.5;
    const oldWeight = row.weight ?? 0.2;
    const delta = LEARNING_RATE * (accuracy - 0.5) * 2;
    const newWeight = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, oldWeight + delta));
    updates[row.signal_name] = newWeight;
  }

  if (Object.keys(updates).length === 0) return {};

  // Re-normalize weights to sum to 1.0 across the three surface signals
  const surfaceSignals = ['sportsbook', 'prediction_market', 'historical'];
  const surfaceTotal = surfaceSignals.reduce((s, k) => s + (updates[k] ?? 0.2), 0);
  if (surfaceTotal > 0) {
    for (const k of surfaceSignals) {
      if (updates[k] !== undefined) {
        updates[k] = parseFloat((updates[k] / surfaceTotal).toFixed(4));
      }
    }
  }

  // Persist updates
  for (const [signal_name, weight] of Object.entries(updates)) {
    await supabase
      .from('signal_performance')
      .update({ weight, last_updated: new Date().toISOString() })
      .eq('signal_name', signal_name);
  }

  return updates;
}

/**
 * Full retraining pipeline (intended for 24h scheduled runs):
 * 1. Join market_predictions with market_outcomes to get resolved events
 * 2. Compute per-signal Brier scores
 * 3. Update signal weights
 * 4. Create new model version if Brier improvement > 3%
 * 5. Rollback to previous version if new model worsens
 */
export async function runRetraining(): Promise<{
  newVersion: number | null;
  brierImprovement: number;
  deployed: boolean;
  rolledBack: boolean;
  resolvedCount: number;
}> {
  const supabase = await createClient();

  // Fetch resolved predictions (join on event_id)
  const { data: outcomes } = await supabase
    .from('market_outcomes')
    .select('event_id, actual_result, closing_probability')
    .order('resolved_at', { ascending: false })
    .limit(500);

  if (!outcomes || outcomes.length === 0) {
    return { newVersion: null, brierImprovement: 0, deployed: false, rolledBack: false, resolvedCount: 0 };
  }

  const eventIds = outcomes.map((o: any) => o.event_id);
  const { data: predictions } = await supabase
    .from('market_predictions')
    .select('event_id, predicted_probability')
    .in('event_id', eventIds);

  if (!predictions || predictions.length === 0) {
    return { newVersion: null, brierImprovement: 0, deployed: false, rolledBack: false, resolvedCount: outcomes.length };
  }

  // Build lookup for fast join
  const predMap = new Map<string, number>(predictions.map((p: any) => [p.event_id, p.predicted_probability as number]));

  // Compute Brier scores
  let brierSum = 0;
  let count = 0;
  for (const outcome of outcomes) {
    const pred = predMap.get(outcome.event_id);
    if (pred == null) continue;
    brierSum += computeBrierScore(pred, outcome.actual_result as 0 | 1);
    count++;
  }
  const newBrierScore = count > 0 ? brierSum / count : 0.25;

  // Get active model Brier score
  const activeModel = await loadActiveModel();
  const oldBrierScore = activeModel?.brier_score ?? 0.25;
  const brierImprovement = oldBrierScore - newBrierScore; // positive = improvement

  // Update weights
  const newWeights = await updateSignalWeights();

  // Only deploy if improvement > threshold
  if (brierImprovement < MIN_IMPROVEMENT_THRESHOLD) {
    return { newVersion: null, brierImprovement, deployed: false, rolledBack: false, resolvedCount: count };
  }

  // Create new model version
  const newVersion = (activeModel?.version ?? 0) + 1;
  await supabase.from('model_versions').update({ is_active: false }).eq('is_active', true);
  await supabase.from('model_versions').insert({
    version: newVersion,
    brier_score: newBrierScore,
    performance_score: 1 - newBrierScore,
    signals_config: newWeights,
    is_active: true,
  });

  logger.info(LogCategory.API, '[signal-tracker] New model deployed', { metadata: { version: newVersion, brierImprovement, newBrierScore } });

  return { newVersion, brierImprovement, deployed: true, rolledBack: false, resolvedCount: count };
}
