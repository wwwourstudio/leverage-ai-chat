/**
 * Live HR Prop Market Odds
 *
 * Fetches `batter_home_runs` markets from the Odds API for today's MLB slate
 * and returns a name-keyed Map of the best available market line per player.
 *
 * Two jobs in one:
 *   1. Provides real market odds to betting-edges.ts so edge% and Kelly are
 *      calculated against actual sportsbook prices, not barrel-rate estimates.
 *   2. Feeds every observed price into line-movement-tracker so that future
 *      requests can detect sharp movement (odds shortening ≥ 20 points).
 *
 * Cache: 10-minute module-level TTL (lines shift frequently in the hours
 * before first pitch, but constant re-fetching wastes Odds API quota).
 *
 * NOTE: Player prop markets must use the event-level endpoint
 * (/sports/{sport}/events/{id}/odds). The game-level /sports/{sport}/odds
 * endpoint returns HTTP 422 for any player prop market key.
 */

import { recordOddsSnapshot } from '@/lib/line-movement-tracker';
import { americanToImpliedProb } from '@/lib/utils/odds-math';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HRPropMarketLine {
  /** Canonical player name from the Odds API response */
  playerName: string;
  /** Prop line — typically 0.5 for HR */
  line: number;
  /** American odds for the Over (e.g. +190) */
  overOdds: number;
  /** American odds for the Under (e.g. -250) */
  underOdds: number;
  /** Vig-adjusted implied probability of the Over */
  impliedProb: number;
  /** Book that provided this line */
  bookmaker: string;
}

interface OddsApiEvent {
  id: string;
  home_team: string;
  away_team: string;
}

interface OddsApiBookmaker {
  title: string;
  markets: Array<{
    key: string;
    outcomes: Array<{
      name: string;
      description?: string;
      price: number;
      point?: number;
    }>;
  }>;
}

// ── Module-level cache ────────────────────────────────────────────────────────

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let _cachedLines: Map<string, HRPropMarketLine> | null = null;
let _cacheTs = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
}

/** Strip punctuation and lowercase for fuzzy key comparison */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z ]/g, '').trim();
}

/** Convert American odds to raw implied probability (no vig removal). Returns 0.5 for zero/null. */
function americanToImpliedProbSafe(odds: number): number {
  if (!odds || odds === 0) return 0.5;
  return americanToImpliedProb(odds);
}

/**
 * Deterministic hash of a string → positive integer.
 * Used as a pseudo-playerId for line-movement-tracker (which requires a numeric ID).
 * Consistent across requests for the same player name.
 */
function hashName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

const BASE_URL = 'https://api.the-odds-api.com/v4';
// Markets to fetch. Batched in chunks of 4 to stay within the Odds API
// per-request limit (>4 markets on the event-level endpoint → HTTP 422).
const HR_MARKETS = ['batter_home_runs'];
const MARKET_BATCH_SIZE = 4;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch today's MLB HR prop lines from the Odds API.
 *
 * Returns a Map keyed by normalised player name (lowercase, no punctuation).
 * Selects the book offering the best (lowest implied probability = most
 * favorable) Over line for each player; ties go to the first book seen.
 *
 * Non-throwing: returns cached data (or an empty Map) on any error.
 * Falls back to cached lines only when ALL chunk fetches fail — partial
 * success (some chunks return data) is used directly.
 */
export async function fetchHRPropMarketLines(
  apiKey: string,
): Promise<Map<string, HRPropMarketLine>> {
  const now = Date.now();
  if (_cachedLines && now - _cacheTs < CACHE_TTL_MS) {
    return _cachedLines;
  }

  try {
    // Step 1: Fetch today's event IDs.
    // Player props are only available via the event-level endpoint;
    // /sports/{sport}/odds returns 422 for player prop market keys.
    const eventsRes = await fetch(
      `${BASE_URL}/sports/baseball_mlb/events?apiKey=${apiKey}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!eventsRes.ok) {
      console.warn(`[HRPropMarket] Events fetch failed: HTTP ${eventsRes.status} — using cached lines`);
      return _cachedLines ?? new Map();
    }

    const events: OddsApiEvent[] = await eventsRes.json();
    if (!Array.isArray(events) || events.length === 0) {
      return _cachedLines ?? new Map();
    }

    // Step 2: For each event (up to 8), fetch market chunks in parallel.
    const marketChunks = chunkArray(HR_MARKETS, MARKET_BATCH_SIZE);
    // Limit to 5 events: 4s (events) + 4s (props) ≈ 8s, fits mlb-projections 25s budget
    const eventsToFetch = events.slice(0, 5);

    // Collect raw bookmaker arrays from all events and chunks
    const allBookmakers: Array<{ bk: OddsApiBookmaker }> = [];

    await Promise.allSettled(
      eventsToFetch.map(async event => {
        const chunkResults = await Promise.all(
          marketChunks.map(async (chunk, ci) => {
            const marketsParam = chunk.join(',');
            const res = await fetch(
              `${BASE_URL}/sports/baseball_mlb/events/${event.id}/odds` +
                `?apiKey=${apiKey}&regions=us&markets=${marketsParam}&oddsFormat=american`,
              { signal: AbortSignal.timeout(4000) },
            );
            if (!res.ok) {
              console.warn(
                `[HRPropMarket] Chunk ${ci + 1}/${marketChunks.length} failed` +
                  ` (${marketsParam}): HTTP ${res.status}`,
              );
              return null;
            }
            return res.json() as Promise<{ bookmakers: OddsApiBookmaker[] }>;
          }),
        );

        // Only fall back to cached lines if ALL chunks fail — partial success is used
        const hasAnySuccess = chunkResults.some(r => r !== null);
        if (!hasAnySuccess) return;

        for (const result of chunkResults) {
          if (!result) continue;
          for (const bk of result.bookmakers ?? []) {
            allBookmakers.push({ bk });
          }
        }
      }),
    );

    // Step 3: Build the best-line map from all collected bookmakers
    const lines = new Map<string, HRPropMarketLine>();
    const snapshotTs = now;

    for (const { bk } of allBookmakers.slice(0, allBookmakers.length)) {
      const hrMarket = (bk.markets ?? []).find(m => m.key === 'batter_home_runs');
      if (!hrMarket?.outcomes?.length) continue;

      // Group Over/Under outcomes by player description
      const byPlayer = new Map<string, { over?: typeof hrMarket.outcomes[0]; under?: typeof hrMarket.outcomes[0] }>();
      for (const outcome of hrMarket.outcomes) {
        const desc = (outcome.description ?? outcome.name ?? '') as string;
        if (!desc) continue;
        const key = normalizeName(desc);
        if (!byPlayer.has(key)) byPlayer.set(key, {});
        const entry = byPlayer.get(key)!;
        if (outcome.name === 'Over') entry.over = outcome;
        else if (outcome.name === 'Under') entry.under = outcome;
      }

      for (const [playerKey, { over, under }] of byPlayer) {
        if (!over) continue;

        const impliedProb = americanToImpliedProbSafe(over.price);
        const candidate: HRPropMarketLine = {
          playerName: over.description ?? playerKey,
          line:        over.point  ?? 0.5,
          overOdds:    over.price,
          underOdds:   under?.price ?? 0,
          impliedProb,
          bookmaker:   bk.title,
        };

        // Keep the most favourable (lowest vig-implied prob) Over line
        const existing = lines.get(playerKey);
        if (!existing || impliedProb < existing.impliedProb) {
          lines.set(playerKey, candidate);
        }

        // Feed into line-movement-tracker (non-blocking, best-effort)
        void recordOddsSnapshot({
          playerId:   hashName(playerKey),
          playerName: candidate.playerName,
          market:     'batter_home_runs',
          bookmaker:  bk.title,
          price:      over.price,
          line:       over.point ?? 0.5,
          timestamp:  snapshotTs,
        }).catch(() => {/* ignore */});
      }
    }

    // Only overwrite cache on success (even partial)
    if (lines.size > 0) {
      _cachedLines = lines;
      _cacheTs = now;
    }
    console.log(`[HRPropMarket] Cached ${lines.size} HR prop lines from Odds API`);
    return lines.size > 0 ? lines : (_cachedLines ?? new Map());

  } catch (err) {
    console.warn('[HRPropMarket] Fetch failed:', err instanceof Error ? err.message : String(err));
    return _cachedLines ?? new Map();
  }
}

/**
 * Look up live HR prop market odds for a player by name.
 *
 * Tries exact normalised key first, then falls back to last-name substring
 * match (handles minor spelling differences between projection data and
 * Odds API description strings).
 *
 * Returns null when no matching line is found (caller should fall back to
 * the barrel-rate estimate).
 */
export function lookupHRPropOdds(
  lines: Map<string, HRPropMarketLine>,
  playerName: string,
): HRPropMarketLine | null {
  if (lines.size === 0) return null;

  const norm = normalizeName(playerName);

  // 1. Exact match
  const exact = lines.get(norm);
  if (exact) return exact;

  // 2. Last-name suffix match (e.g. "judge" matches "aaron judge")
  const lastName = norm.split(' ').at(-1) ?? '';
  if (lastName.length < 3) return null; // too short to be meaningful

  for (const [key, val] of lines) {
    if (key.includes(lastName)) return val;
  }
  return null;
}

/** Invalidate the module cache (useful for testing or forced refresh) */
export function clearHRPropCache(): void {
  _cachedLines = null;
  _cacheTs = 0;
}
