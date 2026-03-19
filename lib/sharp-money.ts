/**
 * Sharp Money Detection
 *
 * Classifies line-movement records from the `line_movement` table into
 * sharp-money signals: steam moves, reverse-line movement, consensus fades,
 * and book-variance clustering.
 *
 * All inputs are plain numbers derived from DB rows — no external API calls.
 *
 * Usage:
 *   import { scoreMovements, SteamLevel } from '@/lib/sharp-money';
 *   const result = scoreMovements(movementRows, publicBettingPct);
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** Raw row from the `line_movement` table */
export interface LineMovementRow {
  game_id: string;
  bookmaker: string;
  market_type: string;
  old_line: number | null;
  new_line: number | null;
  line_change: number | null;
  old_odds: number | null;
  new_odds: number | null;
  timestamp: string;
}

/** Optional public-betting context (if available from a betting splits provider) */
export interface PublicBettingContext {
  /**
   * % of bets placed on the favourite / over (0–100).
   * Used to detect reverse-line movement (sharp side ≠ public side).
   */
  publicBetPct: number;
  /**
   * % of money wagered on the favourite / over (0–100).
   * Large money % diverging from bet % = sharp unilateral action.
   */
  publicMoneyPct: number;
}

/** Composite sharp signal score for a game */
export interface SharpScore {
  gameId: string;
  /** Raw composite signal [0–1] */
  score: number;
  /** Categorised signal strength */
  level: SteamLevel;
  /** Average age of contributing movements in minutes (for UI display) */
  avgAgeMins: number;
  /** Contributing signal breakdown */
  components: SharpComponents;
  /** Human-readable reason for the highest signal */
  primarySignal: string;
  /** Number of distinct bookmakers that moved the same direction */
  consensusBooks: number;
}

export interface SharpComponents {
  /** Books that moved the line in the same direction: 0–1 (fraction of total books) */
  multiBookConsensus: number;
  /** Rapid succession of moves within 30 min: 0–1 */
  steamVelocity: number;
  /**
   * Reverse-line movement:
   * line moved against the public bet pct — a classic sharp indicator.
   * Range 0–1; 0 if no public pct data available.
   */
  reverseLineMovement: number;
  /** Spread between best and worst book on the same outcome: 0–1 */
  bookVariance: number;
}

export type SteamLevel = 'STEAM' | 'SHARP' | 'MODERATE' | 'NEUTRAL';

// ── Thresholds ─────────────────────────────────────────────────────────────────

const STEAM_WINDOW_MIN   = 30;      // minutes: moves within this window = steam
const MIN_BOOKS_STEAM    = 3;       // books must move simultaneously for full steam score
const SPREAD_STEAM       = 1.0;     // spread / moneyline variance to flag
const STEAM_SCORE_THRESH = 0.65;
const SHARP_SCORE_THRESH = 0.40;
const MOD_SCORE_THRESH   = 0.20;

// ── Time decay ─────────────────────────────────────────────────────────────────
//
// A movement from 2 minutes ago is very different from one 4 hours ago.
// We apply exponential decay per row so the composite score reflects
// "how sharp is this RIGHT NOW", not "was this game sharp at some point today".
//
// Decay formula: weight = exp(-λ × age_minutes)
// where λ = ln(2) / HALF_LIFE_MIN — halves every HALF_LIFE_MIN minutes.
//
// HALF_LIFE_MIN = 20  →  weight at 0 min = 1.0
//                         weight at 20 min = 0.50
//                         weight at 40 min = 0.25
//                         weight at 60 min = 0.125  (min-clamped to MIN_DECAY_WEIGHT)

const HALF_LIFE_MIN     = 20;
const LAMBDA            = Math.LN2 / HALF_LIFE_MIN;
const MIN_DECAY_WEIGHT  = 0.05;   // floor: very old moves still have a tiny signal

/** Compute the time-decay weight for a movement row (0.05–1.0). */
function decayWeight(timestamp: string): number {
  const ageMs  = Date.now() - new Date(timestamp).getTime();
  const ageMins = Math.max(0, ageMs / 60_000);
  return Math.max(MIN_DECAY_WEIGHT, Math.exp(-LAMBDA * ageMins));
}

/**
 * Return rows sorted by decay weight descending, with the weight attached.
 * Used internally by component calculators.
 */
function withDecay(rows: LineMovementRow[]): Array<LineMovementRow & { weight: number }> {
  return rows
    .map(r => ({ ...r, weight: decayWeight(r.timestamp) }))
    .sort((a, b) => b.weight - a.weight);
}

// ── Core scoring function ──────────────────────────────────────────────────────

/**
 * Score a set of line-movement rows for a single game.
 *
 * @param rows    All movement records for one game (any market type).
 * @param ctx     Optional public-betting context for reverse-line detection.
 */
export function scoreMovements(
  rows: LineMovementRow[],
  ctx?: PublicBettingContext,
): SharpScore {
  if (rows.length === 0) {
    return neutralScore(rows[0]?.game_id ?? '');
  }

  const gameId = rows[0].game_id;
  const components = computeComponents(rows, ctx);

  // Weighted composite
  const score =
    components.multiBookConsensus * 0.35 +
    components.steamVelocity      * 0.30 +
    components.reverseLineMovement * 0.25 +
    components.bookVariance        * 0.10;

  const clamped = Math.max(0, Math.min(1, score));
  const level   = classify(clamped);
  const primary = primarySignalText(components, ctx);

  // Average age of all movement rows
  const avgAgeMins = rows.length
    ? rows.reduce((s, r) => s + Math.max(0, (Date.now() - new Date(r.timestamp).getTime()) / 60_000), 0) / rows.length
    : 0;

  return {
    gameId,
    score: parseFloat(clamped.toFixed(3)),
    level,
    components,
    primarySignal: primary,
    consensusBooks: countConsensusBooks(rows),
    avgAgeMins: parseFloat(avgAgeMins.toFixed(1)),
  };
}

/**
 * Score multiple games at once, returning a map of gameId → SharpScore.
 * Rows are automatically grouped by game_id.
 */
export function scoreAllGames(
  rows: LineMovementRow[],
  ctxMap?: Map<string, PublicBettingContext>,
): Map<string, SharpScore> {
  // Group by game_id
  const byGame = new Map<string, LineMovementRow[]>();
  for (const row of rows) {
    const arr = byGame.get(row.game_id) ?? [];
    arr.push(row);
    byGame.set(row.game_id, arr);
  }

  const results = new Map<string, SharpScore>();
  for (const [gameId, gameRows] of byGame) {
    results.set(gameId, scoreMovements(gameRows, ctxMap?.get(gameId)));
  }
  return results;
}

// ── Component calculations ─────────────────────────────────────────────────────

function computeComponents(
  rows: LineMovementRow[],
  ctx?: PublicBettingContext,
): SharpComponents {
  return {
    multiBookConsensus: calcMultiBookConsensus(rows),
    steamVelocity:      calcSteamVelocity(rows),
    reverseLineMovement: ctx ? calcReverseLineMovement(rows, ctx) : 0,
    bookVariance:       calcBookVariance(rows),
  };
}

/** Fraction of total books that moved in the same direction within the window.
 *  Recent moves (high decay weight) count more toward the consensus score. */
function calcMultiBookConsensus(rows: LineMovementRow[]): number {
  const books = new Set(rows.map(r => r.bookmaker));
  if (books.size < 2) return 0;

  const weighted = withDecay(rows);

  // Accumulate decay-weighted directional votes per market type
  const scoreByMarket = new Map<string, { pos: number; neg: number; total: number }>();
  for (const row of weighted) {
    if (row.line_change == null && row.old_odds == null) continue;
    const direction = getDirection(row);
    if (direction === 0) continue;
    const entry = scoreByMarket.get(row.market_type) ?? { pos: 0, neg: 0, total: 0 };
    entry.total += row.weight;
    if (direction > 0) entry.pos += row.weight;
    else               entry.neg += row.weight;
    scoreByMarket.set(row.market_type, entry);
  }

  // Find market with strongest weighted consensus
  let maxConsensus = 0;
  for (const entry of scoreByMarket.values()) {
    const dominant = Math.max(entry.pos, entry.neg);
    const fraction = dominant / Math.max(entry.total, 1e-9);
    if (fraction > maxConsensus) maxConsensus = fraction;
  }

  // Scale: ≥ MIN_BOOKS_STEAM books moving = full score
  const booksMoving = Math.min(books.size, MIN_BOOKS_STEAM);
  return Math.min(1, (booksMoving / MIN_BOOKS_STEAM) * maxConsensus);
}

/** Score for steam: multiple books moving within STEAM_WINDOW_MIN.
 *  Uses decay-weighted count so a burst from 5 min ago scores higher
 *  than an identical burst from 45 min ago. */
function calcSteamVelocity(rows: LineMovementRow[]): number {
  if (rows.length < 2) return 0;

  const sorted = [...rows].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  let maxWeightedCount = 0;
  for (let i = 0; i < sorted.length; i++) {
    const windowStart = new Date(sorted[i].timestamp).getTime();
    const windowEnd   = windowStart + STEAM_WINDOW_MIN * 60_000;
    // Decay-weighted sum for rows inside this window
    const weightedCount = sorted
      .filter(r => {
        const t = new Date(r.timestamp).getTime();
        return t >= windowStart && t <= windowEnd;
      })
      .reduce((sum, r) => sum + decayWeight(r.timestamp), 0);

    if (weightedCount > maxWeightedCount) maxWeightedCount = weightedCount;
  }

  // ≥ MIN_BOOKS_STEAM (each at full weight) = steam; scale below that
  return Math.min(1, (maxWeightedCount - MIN_DECAY_WEIGHT) / (MIN_BOOKS_STEAM - MIN_DECAY_WEIGHT));
}

/**
 * Reverse-line movement: line moved AGAINST the public side.
 * Requires PublicBettingContext.
 *
 * Classic sharp signal: 70% of bets on the favourite, but spread moves
 * towards the underdog — sharp money is buying the dog.
 */
function calcReverseLineMovement(
  rows: LineMovementRow[],
  ctx: PublicBettingContext,
): number {
  const spreadRows = rows.filter(r => r.market_type.startsWith('spread'));
  if (spreadRows.length === 0) return 0;

  // Public is betting favourite (>55% bets)
  const publicOnFav = ctx.publicBetPct > 55;

  // Count moves favouring the underdog side (line going up = underdog getting worse = fav side)
  // A move toward the underdog = line_change negative (line number decreasing for fav)
  let rlmCount = 0;
  for (const row of spreadRows) {
    const direction = getDirection(row);
    // If public is on favourite, sharp money is on underdog → line moves against public
    if (publicOnFav && direction < 0) rlmCount++;
    if (!publicOnFav && direction > 0) rlmCount++;
  }

  return Math.min(1, rlmCount / Math.max(spreadRows.length, 1));
}

/** Spread between best and worst available odds, decay-weighted so recent
 *  variance matters more than stale price divergence. */
function calcBookVariance(rows: LineMovementRow[]): number {
  const weighted = withDecay(rows);

  // Only use rows with enough decay weight to be meaningful
  const relevant = weighted.filter(r => r.weight >= 0.2);
  if (relevant.length < 2) return 0;

  const oddsValues = relevant
    .map(r => r.new_odds ?? r.old_odds)
    .filter((v): v is number => v != null);

  if (oddsValues.length < 2) return 0;

  const min = Math.min(...oddsValues);
  const max = Math.max(...oddsValues);
  const variance = Math.abs(max - min);

  // Weight the variance itself by the average decay of these rows
  const avgWeight = relevant.reduce((s, r) => s + r.weight, 0) / relevant.length;
  const decayedVariance = variance * avgWeight;

  return Math.min(1, decayedVariance / (SPREAD_STEAM * 100));
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function getDirection(row: LineMovementRow): -1 | 0 | 1 {
  if (row.line_change != null) {
    if (row.line_change > 0.01) return 1;
    if (row.line_change < -0.01) return -1;
  }
  if (row.old_odds != null && row.new_odds != null) {
    const delta = row.new_odds - row.old_odds;
    if (delta >  MIN_BOOKS_STEAM) return 1;
    if (delta < -MIN_BOOKS_STEAM) return -1;
  }
  return 0;
}

function countConsensusBooks(rows: LineMovementRow[]): number {
  const positiveBooks = new Set<string>();
  const negativeBooks = new Set<string>();
  for (const row of rows) {
    const dir = getDirection(row);
    if (dir > 0) positiveBooks.add(row.bookmaker);
    if (dir < 0) negativeBooks.add(row.bookmaker);
  }
  return Math.max(positiveBooks.size, negativeBooks.size);
}

function classify(score: number): SteamLevel {
  if (score >= STEAM_SCORE_THRESH) return 'STEAM';
  if (score >= SHARP_SCORE_THRESH) return 'SHARP';
  if (score >= MOD_SCORE_THRESH)   return 'MODERATE';
  return 'NEUTRAL';
}

function primarySignalText(
  c: SharpComponents,
  ctx?: PublicBettingContext,
): string {
  const signals: Array<[number, string]> = (
    [
      [c.steamVelocity,       'Steam move detected — rapid multi-book line movement'],
      [c.reverseLineMovement, ctx ? 'Reverse-line movement — sharp money against public' : ''],
      [c.multiBookConsensus,  'Multi-book consensus — coordinated sharp action'],
      [c.bookVariance,        'High book variance — price discrepancy across books'],
    ] as Array<[number, string]>
  ).filter(([, label]) => label !== '');

  const [, label] = signals.sort(([a], [b]) => b - a)[0] ?? [0, 'No significant signal'];
  return label;
}

function neutralScore(gameId: string): SharpScore {
  return {
    gameId,
    score: 0,
    level: 'NEUTRAL',
    components: { multiBookConsensus: 0, steamVelocity: 0, reverseLineMovement: 0, bookVariance: 0 },
    primarySignal: 'No movement data',
    consensusBooks: 0,
    avgAgeMins: 0,
  };
}

/** Exported for use in UI components that want to show "X min ago" labels */
export { decayWeight };
