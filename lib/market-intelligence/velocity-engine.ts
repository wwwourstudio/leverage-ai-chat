/**
 * Line Movement Velocity Engine
 *
 * Tracks odds changes over time from the existing `line_movement` Supabase table,
 * classifies movements as steam, drift, correction, or stable, and stores
 * velocity events to the new `movement_events` table.
 */

import { createClient } from '@/lib/supabase/server';
import { logger, LogCategory } from '@/lib/logger';

export interface VelocityResult {
  eventId: string;
  sport: string;
  bookmaker: string;
  velocityScore: number;       // 0-100 normalized
  direction: 'up' | 'down' | 'flat';
  movementType: 'steam' | 'drift' | 'correction' | 'stable';
  oddsAtStart: number;
  oddsAtEnd: number;
  deltaOdds: number;           // American odds points change
  deltaSeconds: number;
}

/** Points per minute thresholds for movement classification */
export const VELOCITY_THRESHOLDS = {
  STEAM: 5,        // > 5 pts/min → steam move
  DRIFT: 1,        // 1–5 pts/min → slow drift
  CORRECTION: -5,  // rapid reversal below -5 pts/min → correction
} as const;

/** Classify a movement type from pts/min velocity value */
export function classifyMovement(
  ptsPerMin: number,
  direction: 'up' | 'down' | 'flat'
): VelocityResult['movementType'] {
  if (direction === 'flat') return 'stable';
  const absPts = Math.abs(ptsPerMin);
  if (absPts >= VELOCITY_THRESHOLDS.STEAM) return 'steam';
  if (absPts >= VELOCITY_THRESHOLDS.DRIFT) return 'drift';
  // Detect correction: movement reverses a prior steam move
  // (simplified: large downward move on an upward context signals correction)
  if (direction === 'down' && ptsPerMin <= VELOCITY_THRESHOLDS.CORRECTION) return 'correction';
  return 'stable';
}

/** Normalize pts/min velocity to a 0-100 score */
function normalizeVelocity(absPtsPerMin: number): number {
  // Cap at 3× steam threshold for full 100 score
  const cap = VELOCITY_THRESHOLDS.STEAM * 3;
  return Math.min(100, Math.round((absPtsPerMin / cap) * 100));
}

/**
 * Query the existing `line_movement` table and compute velocity for each
 * bookmaker that moved lines in the given time window.
 */
export async function computeVelocity(
  eventId: string,
  windowMinutes: number = 30
): Promise<VelocityResult[]> {
  const supabase = await createClient();

  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('line_movement')
    .select('bookmaker, old_line, new_line, line_change, timestamp, sport')
    .eq('game_id', eventId)
    .gte('timestamp', windowStart)
    .order('timestamp', { ascending: true });

  if (error || !data || data.length === 0) {
    return [];
  }

  // Group by bookmaker
  const byBook = new Map<string, typeof data>();
  for (const row of data) {
    const key = String(row.bookmaker ?? 'unknown');
    if (!byBook.has(key)) byBook.set(key, []);
    byBook.get(key)!.push(row);
  }

  const results: VelocityResult[] = [];
  const sport = data[0]?.sport ?? 'unknown';

  for (const [bookmaker, rows] of byBook.entries()) {
    if (rows.length < 2) continue;

    const first = rows[0];
    const last = rows[rows.length - 1];
    const deltaOdds = (last.new_line ?? 0) - (first.old_line ?? 0);
    const t1 = new Date(first.timestamp).getTime();
    const t2 = new Date(last.timestamp).getTime();
    const deltaSeconds = Math.max(1, Math.round((t2 - t1) / 1000));
    const ptsPerMin = (deltaOdds / deltaSeconds) * 60;

    const direction: VelocityResult['direction'] =
      deltaOdds > 0.5 ? 'up' : deltaOdds < -0.5 ? 'down' : 'flat';

    results.push({
      eventId,
      sport,
      bookmaker,
      velocityScore: normalizeVelocity(Math.abs(ptsPerMin)),
      direction,
      movementType: classifyMovement(ptsPerMin, direction),
      oddsAtStart: first.old_line ?? 0,
      oddsAtEnd: last.new_line ?? 0,
      deltaOdds,
      deltaSeconds,
    });
  }

  return results;
}

/**
 * Persist a velocity result to the `movement_events` table.
 * Non-blocking — errors are logged but not thrown.
 */
export async function recordMovementEvent(result: VelocityResult): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('movement_events').insert({
      event_id: result.eventId,
      sport: result.sport,
      bookmaker: result.bookmaker,
      velocity_score: result.velocityScore,
      direction: result.direction,
      movement_type: result.movementType,
      odds_delta: result.deltaOdds,
      time_delta_seconds: result.deltaSeconds,
    });
  } catch (err) {
    logger.info(LogCategory.API, '[market-intelligence] recordMovementEvent failed', { error: err instanceof Error ? err : String(err) });
  }
}

/**
 * Return the highest velocity score across all bookmakers for an event,
 * along with the dominant movement type.
 */
export function summarizeVelocity(results: VelocityResult[]): {
  velocityScore: number;
  movementType: VelocityResult['movementType'];
  direction: VelocityResult['direction'];
} {
  if (results.length === 0) {
    return { velocityScore: 0, movementType: 'stable', direction: 'flat' };
  }
  const top = results.reduce((a, b) => (b.velocityScore > a.velocityScore ? b : a));
  return {
    velocityScore: top.velocityScore,
    movementType: top.movementType,
    direction: top.direction,
  };
}
