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

// ── Module-level cache ────────────────────────────────────────────────────────

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let _cachedLines: Map<string, HRPropMarketLine> | null = null;
let _cacheTs = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch today's MLB HR prop lines from the Odds API.
 *
 * Returns a Map keyed by normalised player name (lowercase, no punctuation).
 * Selects the book offering the best (lowest implied probability = most
 * favorable) Over line for each player; ties go to the first book seen.
 *
 * Non-throwing: returns cached data (or an empty Map) on any error.
 */
export async function fetchHRPropMarketLines(
  apiKey: string,
): Promise<Map<string, HRPropMarketLine>> {
  const now = Date.now();
  if (_cachedLines && now - _cacheTs < CACHE_TTL_MS) {
    return _cachedLines;
  }

  const url =
    `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds` +
    `?apiKey=${apiKey}&regions=us&markets=batter_home_runs&oddsFormat=american`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.warn(`[HRPropMarket] Odds API error ${res.status} — using cached lines`);
      return _cachedLines ?? new Map();
    }

    const events: any[] = await res.json();
    if (!Array.isArray(events)) return _cachedLines ?? new Map();

    const lines = new Map<string, HRPropMarketLine>();
    const snapshotTs = now;

    for (const event of events) {
      for (const book of (event.bookmakers ?? []).slice(0, 3)) {
        const hrMarket = (book.markets ?? []).find((m: any) => m.key === 'batter_home_runs');
        if (!hrMarket?.outcomes?.length) continue;

        // Group Over/Under outcomes by player description
        const byPlayer = new Map<string, { over?: any; under?: any }>();
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
            bookmaker:   book.title,
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
            bookmaker:  book.title,
            price:      over.price,
            line:       over.point ?? 0.5,
            timestamp:  snapshotTs,
          }).catch(() => {/* ignore */});
        }
      }
    }

    _cachedLines = lines;
    _cacheTs = now;
    console.log(`[HRPropMarket] Cached ${lines.size} HR prop lines from Odds API`);
    return lines;

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
