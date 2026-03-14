/**
 * Cross-Market Price Normalization
 *
 * Converts American odds, decimal odds, and Kalshi prices into a unified
 * probability space [0,1] for cross-market anomaly detection.
 */

// Re-use the existing implementation from arbitrage module
import { americanOddsToImpliedProbability } from '@/lib/arbitrage';

export interface NormalizedPrice {
  market: string;        // e.g. 'DraftKings', 'Kalshi', 'FanDuel'
  event: string;
  side: 'home' | 'away' | 'yes' | 'no' | 'over' | 'under';
  probability: number;   // [0, 1]
  source: 'sportsbook' | 'prediction_market' | 'historical';
  timestamp: string;     // ISO 8601
}

/** American odds → probability (delegates to existing arbitrage utility) */
export function normalizeAmericanOdds(
  odds: number,
  meta: Omit<NormalizedPrice, 'probability'>
): NormalizedPrice {
  return { ...meta, probability: americanOddsToImpliedProbability(odds) };
}

/** Decimal odds → probability: P = 1 / decimal */
export function normalizeDecimalOdds(
  decimal: number,
  meta: Omit<NormalizedPrice, 'probability'>
): NormalizedPrice {
  const probability = decimal > 0 ? Math.min(1, 1 / decimal) : 0;
  return { ...meta, probability };
}

/**
 * Kalshi price → probability.
 * Kalshi prices are in cents (0–100). A "yes" price of 62 means 62% implied probability.
 */
export function normalizeKalshiPrice(
  priceCents: number,
  meta: Omit<NormalizedPrice, 'probability'>
): NormalizedPrice {
  const probability = Math.min(1, Math.max(0, priceCents / 100));
  return { ...meta, probability };
}

/**
 * Extract all normalized prices from a raw Odds API event object.
 * Handles h2h (moneyline) markets only for now.
 */
export function normalizeOddsEvent(
  event: Record<string, unknown>,
  timestamp: string = new Date().toISOString()
): NormalizedPrice[] {
  const results: NormalizedPrice[] = [];
  const eventName = String(event.id ?? 'unknown');
  const bookmakers = event.bookmakers as Array<Record<string, unknown>> | undefined;

  if (!Array.isArray(bookmakers)) return results;

  for (const book of bookmakers) {
    const bookKey = String(book.key ?? book.title ?? 'unknown');
    const markets = book.markets as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(markets)) continue;

    for (const market of markets) {
      if (market.key !== 'h2h') continue;
      const outcomes = market.outcomes as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(outcomes)) continue;

      const [home, away] = outcomes;
      if (home && typeof home.price === 'number') {
        results.push(normalizeAmericanOdds(home.price, {
          market: bookKey,
          event: eventName,
          side: 'home',
          source: 'sportsbook',
          timestamp,
        }));
      }
      if (away && typeof away.price === 'number') {
        results.push(normalizeAmericanOdds(away.price, {
          market: bookKey,
          event: eventName,
          side: 'away',
          source: 'sportsbook',
          timestamp,
        }));
      }
    }
  }

  return results;
}

/**
 * Inject Kalshi market probabilities into normalized prices array.
 */
export function normalizeKalshiMarkets(
  kalshiMarkets: Array<Record<string, unknown>>,
  eventName: string,
  timestamp: string = new Date().toISOString()
): NormalizedPrice[] {
  const results: NormalizedPrice[] = [];

  for (const m of kalshiMarkets) {
    const yesPrice = m.yes_price as number | undefined;
    const noPrice = m.no_price as number | undefined;
    const title = String(m.market_id ?? m.title ?? 'kalshi');

    if (typeof yesPrice === 'number') {
      results.push(normalizeKalshiPrice(yesPrice, {
        market: title,
        event: eventName,
        side: 'yes',
        source: 'prediction_market',
        timestamp,
      }));
    }
    if (typeof noPrice === 'number') {
      results.push(normalizeKalshiPrice(noPrice, {
        market: title,
        event: eventName,
        side: 'no',
        source: 'prediction_market',
        timestamp,
      }));
    }
  }

  return results;
}

/**
 * Compute consensus probability (simple mean) across a set of normalized prices,
 * filtered by source and side.
 */
export function computeConsensus(
  prices: NormalizedPrice[],
  opts: { source?: NormalizedPrice['source']; side?: NormalizedPrice['side'] } = {}
): number {
  const filtered = prices.filter(p =>
    (!opts.source || p.source === opts.source) &&
    (!opts.side || p.side === opts.side)
  );
  if (filtered.length === 0) return 0.5; // fallback to coin-flip
  return filtered.reduce((sum, p) => sum + p.probability, 0) / filtered.length;
}

/** Standard deviation of probability values in a set of normalized prices */
export function computeStdDev(prices: NormalizedPrice[]): number {
  if (prices.length < 2) return 0.01; // floor to prevent division by zero
  const mean = prices.reduce((s, p) => s + p.probability, 0) / prices.length;
  const variance = prices.reduce((s, p) => s + (p.probability - mean) ** 2, 0) / prices.length;
  return Math.max(0.01, Math.sqrt(variance));
}
