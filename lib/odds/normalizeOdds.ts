/**
 * normalizeOdds.ts
 *
 * Converts raw Odds API v4 event arrays into flat NormalizedOdd rows —
 * the canonical shape used by ingestOdds.ts and the new API routes.
 */

// ── Public types ─────────────────────────────────────────────────────────────

export interface NormalizedOdd {
  /** Sport key, e.g. "basketball_nba" */
  sport: string;
  home_team: string;
  away_team: string;
  /** ISO 8601 string */
  start_time: string;
  /** Bookmaker API key, e.g. "draftkings" */
  sportsbook: string;
  /** "h2h" | "spreads" | "totals" */
  market: string;
  /** Team name, "Over", or "Under" */
  selection: string;
  /** Spread / total value; null for h2h moneylines */
  line: number | null;
  /** American odds integer */
  price: number;
}

// ── Raw Odds API v4 shapes (subset we care about) ────────────────────────────

interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: OddsApiMarket[];
}

export interface OddsApiEvent {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: OddsApiBookmaker[];
}

// ── Normalizer ────────────────────────────────────────────────────────────────

/**
 * Flattens a raw Odds API event array into individual NormalizedOdd rows.
 *
 * One event × one bookmaker × one market × one outcome → one row.
 * Skips outcomes that are missing a price or whose market key is not in
 * the SUPPORTED_MARKETS set (prevents player_props bleed-through).
 */
export function normalizeOddsResponse(
  sport: string,
  events: OddsApiEvent[]
): NormalizedOdd[] {
  const SUPPORTED_MARKETS = new Set(['h2h', 'spreads', 'totals']);
  const rows: NormalizedOdd[] = [];

  for (const event of events) {
    if (!Array.isArray(event.bookmakers)) continue;

    for (const book of event.bookmakers) {
      if (!book.key || !Array.isArray(book.markets)) continue;

      for (const market of book.markets) {
        if (!SUPPORTED_MARKETS.has(market.key)) continue;
        if (!Array.isArray(market.outcomes)) continue;

        for (const outcome of market.outcomes) {
          // price is required; skip malformed outcomes
          if (typeof outcome.price !== 'number') continue;

          rows.push({
            sport,
            home_team: event.home_team,
            away_team: event.away_team,
            start_time: event.commence_time,
            sportsbook: book.key,
            market: market.key,
            selection: outcome.name,
            line: typeof outcome.point === 'number' ? outcome.point : null,
            price: outcome.price,
          });
        }
      }
    }
  }

  return rows;
}
