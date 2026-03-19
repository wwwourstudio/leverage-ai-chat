/**
 * Line Movement Tracker
 *
 * Tracks historical player prop odds snapshots in memory and persists significant
 * changes to the Supabase `line_movement` table. Detects sharp-money signals:
 * when odds shorten materially (e.g. +220 → +180), it typically indicates
 * professional money coming in on that player.
 *
 * Architecture:
 *   - Module-level ring buffer stores last 20 snapshots per (playerId, market, book)
 *   - Snapshots expire after 4 hours (SNAPSHOT_TTL_MS)
 *   - detectSharpMovement() reads from the buffer to compute movement direction
 *   - recordOddsSnapshot() writes to buffer AND optionally persists to Supabase
 *     when the price has moved enough to be notable (NOTABLE_MOVE_THRESHOLD)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OddsSnapshot {
  /** MLBAM player ID */
  playerId: number;
  playerName: string;
  /** Market key e.g. 'player_home_runs', 'player_hits' */
  market: string;
  bookmaker: string;
  /** American odds — e.g. +180, -120 */
  price: number;
  /** Prop line — e.g. 0.5 for HR */
  line: number;
  timestamp: number;
}

export interface SharpMovementResult {
  /** Total price change from first to last snapshot (American odds points) */
  movement: number;
  /** Direction: 'shortening' = odds dropping (sharp money in), 'lengthening' = odds rising */
  direction: 'shortening' | 'lengthening' | 'stable';
  /** true when odds have shortened by ≥ SHARP_THRESHOLD points */
  isSharp: boolean;
  /** First price in the window */
  openPrice: number;
  /** Most recent price */
  currentPrice: number;
  /** Number of snapshots used */
  sampleCount: number;
  /** Best price ever seen in window (for best-line tracking) */
  bestPrice: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SNAPSHOT_TTL_MS       = 4 * 60 * 60 * 1000; // 4 hours
const MAX_SNAPSHOTS_PER_KEY = 20;
/** American odds shortening ≥ this threshold = likely sharp money */
const SHARP_THRESHOLD       = 20; // e.g. +220 → +180 = 40-point drop → sharp
/** Minimum price change required to write to Supabase */
const NOTABLE_MOVE_THRESHOLD = 10;

// ── Module-level snapshot store ───────────────────────────────────────────────

/** Key = `${playerId}:${market}:${bookmaker}` */
const snapshotStore = new Map<string, OddsSnapshot[]>();

function buildKey(playerId: number, market: string, bookmaker: string): string {
  return `${playerId}:${market}:${bookmaker}`;
}

function pruneExpired(snapshots: OddsSnapshot[]): OddsSnapshot[] {
  const cutoff = Date.now() - SNAPSHOT_TTL_MS;
  return snapshots.filter(s => s.timestamp >= cutoff);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a new odds snapshot for a player + market + book.
 *
 * Stores in the in-memory ring buffer. When the price has moved enough
 * (≥ NOTABLE_MOVE_THRESHOLD vs the previous snapshot), also writes a row to
 * the Supabase `line_movement` table for persistent historical analysis.
 *
 * Non-throwing — Supabase write failures are swallowed silently.
 */
export async function recordOddsSnapshot(snapshot: OddsSnapshot): Promise<void> {
  const key = buildKey(snapshot.playerId, snapshot.market, snapshot.bookmaker);

  let existing = pruneExpired(snapshotStore.get(key) ?? []);
  const previous = existing.at(-1);

  // Append and cap ring buffer
  existing.push(snapshot);
  if (existing.length > MAX_SNAPSHOTS_PER_KEY) {
    existing = existing.slice(-MAX_SNAPSHOTS_PER_KEY);
  }
  snapshotStore.set(key, existing);

  // Persist notable moves to Supabase
  if (previous) {
    const delta = Math.abs(snapshot.price - previous.price);
    if (delta >= NOTABLE_MOVE_THRESHOLD) {
      persistLineMovement(snapshot, previous).catch(() => {
        // Non-fatal — persistence is best-effort
      });
    }
  }
}

async function persistLineMovement(
  current: OddsSnapshot,
  previous: OddsSnapshot,
): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    await supabase.from('line_movement').insert({
      // Reuse game_id column as player_id for prop tracking
      game_id:     String(current.playerId),
      sport:       'baseball_mlb',
      bookmaker:   current.bookmaker,
      market_type: current.market,
      old_line:    previous.line,
      new_line:    current.line,
      line_change: current.line - previous.line,
      old_odds:    previous.price,
      new_odds:    current.price,
    });
  } catch {
    // Ignore — Supabase may not be configured or table may not exist yet
  }
}

/**
 * Retrieve recent snapshots for a player + market + book.
 * Returns an empty array when no history is available.
 */
export function getSnapshotHistory(
  playerId: number,
  market: string,
  bookmaker: string,
): OddsSnapshot[] {
  const key = buildKey(playerId, market, bookmaker);
  const snapshots = pruneExpired(snapshotStore.get(key) ?? []);
  snapshotStore.set(key, snapshots); // prune in place
  return [...snapshots];
}

/**
 * Retrieve snapshots across ALL bookmakers for a player + market.
 * Useful for detecting consensus movement (multiple books shortening together).
 */
export function getAllBookSnapshots(
  playerId: number,
  market: string,
): OddsSnapshot[] {
  const results: OddsSnapshot[] = [];
  for (const [key, snapshots] of snapshotStore) {
    if (key.startsWith(`${playerId}:${market}:`)) {
      results.push(...pruneExpired(snapshots));
    }
  }
  return results.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Analyse snapshot history for a player + market + book and return a sharp-money signal.
 *
 * Sharp signal interpretation:
 *   isSharp = true → odds shortened ≥ 20 American odds points from open
 *                    (e.g. +220 → +180 = 40-point drop). Sharp bettors typically
 *                    bet into a price until the market moves 15–30 points.
 *   direction = 'shortening' → price getting shorter (more likely, market pricing in)
 *   direction = 'lengthening' → price drifting out (public fade or injury concern)
 */
export function detectSharpMovement(
  history: OddsSnapshot[],
): SharpMovementResult | null {
  const valid = history.filter(s => Date.now() - s.timestamp <= SNAPSHOT_TTL_MS);
  if (valid.length < 2) return null;

  const openPrice   = valid[0].price;
  const currentPrice = valid[valid.length - 1].price;
  const movement    = currentPrice - openPrice; // negative = shortening
  const bestPrice   = Math.max(...valid.map(s => s.price));

  // American odds: higher = more favourable for bettors.
  // "Shortening" = odds going lower (market is pricing it more likely to hit).
  const direction: SharpMovementResult['direction'] =
    movement <= -5  ? 'shortening'  :
    movement >=  5  ? 'lengthening' :
    'stable';

  // Sharp = odds shortened significantly (movement is large negative)
  const isSharp = movement <= -SHARP_THRESHOLD;

  return {
    movement,
    direction,
    isSharp,
    openPrice,
    currentPrice,
    sampleCount: valid.length,
    bestPrice,
  };
}

/**
 * Clear all snapshots for a specific player + market (e.g. after game starts).
 */
export function clearPlayerSnapshots(playerId: number, market?: string): void {
  for (const key of snapshotStore.keys()) {
    if (key.startsWith(`${playerId}:${market ?? ''}`)) {
      snapshotStore.delete(key);
    }
  }
}

/**
 * Clear entire snapshot store (tests / server restart).
 */
export function clearAllSnapshots(): void {
  snapshotStore.clear();
}
