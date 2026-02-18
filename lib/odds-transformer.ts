/**
 * Odds Data Transformer
 * Transforms raw Odds API data into usable formats for cards and analysis
 */

import { LOG_PREFIXES } from '@/lib/constants';

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export interface Bookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: Market[];
}

export interface Market {
  key: string;
  last_update: string;
  outcomes: Outcome[];
}

export interface Outcome {
  name: string;
  price: number;
  point?: number;
}

export interface TransformedOdds {
  event: OddsEvent;
  bestSpread: {
    outcome: Outcome;
    bookmaker: string;
    impliedProbability: number;
    edge: number;
  } | null;
  bestMoneyline: {
    outcome: Outcome;
    bookmaker: string;
    impliedProbability: number;
  } | null;
  bestTotal: {
    outcome: Outcome;
    bookmaker: string;
    impliedProbability: number;
  } | null;
  marketEfficiency: number;
  lineMovement: string;
}

/**
 * Calculate implied probability from American odds
 */
export function calculateImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

/**
 * Format American odds with proper sign
 */
export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

/**
 * Calculate market efficiency by comparing odds across bookmakers
 */
export function calculateMarketEfficiency(bookmakers: Bookmaker[]): number {
  if (bookmakers.length < 2) return 0;
  
  const allOdds: number[] = [];
  bookmakers.forEach(bookmaker => {
    bookmaker.markets.forEach(market => {
      market.outcomes.forEach(outcome => {
        if (typeof outcome.price === 'number') {
          allOdds.push(outcome.price);
        }
      });
    });
  });
  
  if (allOdds.length < 2) return 0;
  
  // Calculate standard deviation as a measure of inefficiency
  const mean = allOdds.reduce((sum, val) => sum + val, 0) / allOdds.length;
  const squaredDiffs = allOdds.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / allOdds.length;
  const stdDev = Math.sqrt(variance);
  
  // Convert to a percentage-like metric (higher = more inefficiency/opportunity)
  return Math.min(stdDev / 10, 10); // Cap at 10%
}

/**
 * Find the best spread bet across all bookmakers
 */
export function findBestSpread(event: OddsEvent): TransformedOdds['bestSpread'] {
  let bestSpread: TransformedOdds['bestSpread'] = null;
  let bestValue = -Infinity;
  
  event.bookmakers.forEach(bookmaker => {
    const spreadMarket = bookmaker.markets.find(m => m.key === 'spreads');
    if (!spreadMarket || !spreadMarket.outcomes) return;
    
    spreadMarket.outcomes.forEach(outcome => {
      const impliedProb = calculateImpliedProbability(outcome.price);
      const edge = (1 - impliedProb) * 100; // Simplified edge calculation
      
      if (edge > bestValue) {
        bestValue = edge;
        bestSpread = {
          outcome,
          bookmaker: bookmaker.title,
          impliedProbability: impliedProb,
          edge
        };
      }
    });
  });
  
  return bestSpread;
}

/**
 * Find the best moneyline bet across all bookmakers
 */
export function findBestMoneyline(event: OddsEvent): TransformedOdds['bestMoneyline'] {
  let bestML: TransformedOdds['bestMoneyline'] = null;
  let bestOdds = -Infinity;
  
  event.bookmakers.forEach(bookmaker => {
    const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
    if (!h2hMarket || !h2hMarket.outcomes) return;
    
    h2hMarket.outcomes.forEach(outcome => {
      if (outcome.price > bestOdds) {
        bestOdds = outcome.price;
        bestML = {
          outcome,
          bookmaker: bookmaker.title,
          impliedProbability: calculateImpliedProbability(outcome.price)
        };
      }
    });
  });
  
  return bestML;
}

/**
 * Find the best total (over/under) bet
 */
export function findBestTotal(event: OddsEvent): TransformedOdds['bestTotal'] {
  let bestTotal: TransformedOdds['bestTotal'] = null;
  let bestOdds = -Infinity;
  
  event.bookmakers.forEach(bookmaker => {
    const totalsMarket = bookmaker.markets.find(m => m.key === 'totals');
    if (!totalsMarket || !totalsMarket.outcomes) return;
    
    totalsMarket.outcomes.forEach(outcome => {
      if (outcome.price > bestOdds) {
        bestOdds = outcome.price;
        bestTotal = {
          outcome,
          bookmaker: bookmaker.title,
          impliedProbability: calculateImpliedProbability(outcome.price)
        };
      }
    });
  });
  
  return bestTotal;
}

/**
 * Detect line movement trends (simplified version)
 */
export function detectLineMovement(event: OddsEvent): string {
  // In a production system, this would compare with historical data
  // For now, we check for consistency across bookmakers
  const bookmakerCount = event.bookmakers.length;
  
  if (bookmakerCount === 0) return 'No data';
  if (bookmakerCount === 1) return 'Single source';
  if (bookmakerCount >= 3) return 'Stable (multiple sources)';
  
  return 'Limited sources';
}

/**
 * Transform raw odds event into enriched format
 */
export function transformOddsEvent(event: OddsEvent): TransformedOdds {
  console.log(`${LOG_PREFIXES.API} Transforming odds for ${event.home_team} vs ${event.away_team}`);
  
  return {
    event,
    bestSpread: findBestSpread(event),
    bestMoneyline: findBestMoneyline(event),
    bestTotal: findBestTotal(event),
    marketEfficiency: calculateMarketEfficiency(event.bookmakers),
    lineMovement: detectLineMovement(event)
  };
}

/**
 * Transform array of events
 */
export function transformOddsEvents(events: OddsEvent[]): TransformedOdds[] {
  if (!Array.isArray(events) || events.length === 0) {
    console.log(`${LOG_PREFIXES.API} No events to transform`);
    return [];
  }
  
  console.log(`${LOG_PREFIXES.API} Transforming ${events.length} odds events`);
  return events.map(transformOddsEvent);
}

/**
 * Filter events by time range
 */
export function filterEventsByTimeRange(
  events: OddsEvent[],
  hoursAhead: number = 24
): OddsEvent[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  return events.filter(event => {
    const commenceTime = new Date(event.commence_time);
    return commenceTime >= now && commenceTime <= cutoff;
  });
}

/**
 * Sort events by best value opportunity
 */
export function sortEventsByValue(transformed: TransformedOdds[]): TransformedOdds[] {
  return transformed.sort((a, b) => {
    const aValue = (a.bestSpread?.edge || 0) + a.marketEfficiency;
    const bValue = (b.bestSpread?.edge || 0) + b.marketEfficiency;
    return bValue - aValue; // Descending order
  });
}
