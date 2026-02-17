/**
 * Unified Data Service
 * Consolidates data-service.ts and supabase-data-service.ts
 * Combines API fetching with database queries
 */

import { createClient } from '@/lib/supabase/client';
import { CACHE_CONFIG, API_ENDPOINTS, LOG_PREFIXES, DATA_SOURCES } from '@/lib/constants';
import type { Result } from '@/lib/types';
import { Ok, Err } from '@/lib/types';

// ============================================
// Types
// ============================================

export interface DynamicCard {
  type: string;
  title: string;
  icon: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, any>;
  status: string;
  realData: boolean;
}

export interface UserInsights {
  totalValue: number;
  winRate: number;
  roi: number;
  activeContests: number;
  totalInvested: number;
  avgConfidence?: number;
  dataSource: string;
  message?: string;
}

export interface OddsRecord {
  id: string;
  event_id: string;
  sport: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: any;
  created_at: string;
  updated_at?: string;
}

// ============================================
// Cache Management
// ============================================

const cache = new Map<string, { data: any; timestamp: number }>();

const CACHE_DURATION = {
  CARDS: CACHE_CONFIG.CARDS_TTL,
  INSIGHTS: CACHE_CONFIG.INSIGHTS_TTL,
  ODDS: CACHE_CONFIG.ODDS_TTL,
};

export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// ============================================
// API Data Fetching
// ============================================

async function safeJsonParse(response: Response): Promise<any> {
  try {
    const text = await response.text();
    
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response body');
    }
    
    return JSON.parse(text);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Response parsing failed: ${errorMessage}`);
  }
}

export async function fetchDynamicCards(params: {
  sport?: string;
  category?: string;
  userContext?: any;
  limit?: number;
}): Promise<DynamicCard[]> {
  const cacheKey = `cards:${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION.CARDS) {
    return cached.data;
  }

  try {
    const response = await fetch(API_ENDPOINTS.CARDS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`Cards API returned ${response.status}`);
    }

    const result = await safeJsonParse(response);
    const cards = Array.isArray(result.cards) ? result.cards : [];

    cache.set(cacheKey, { data: cards, timestamp: Date.now() });
    return cards;
  } catch (error) {
    console.error(`${LOG_PREFIXES.DATA_SERVICE} Fetch error:`, error);
    return [];
  }
}

export async function fetchUserInsights(): Promise<UserInsights> {
  const cacheKey = 'insights:user';
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION.INSIGHTS) {
    return cached.data;
  }

  try {
    const response = await fetch(API_ENDPOINTS.INSIGHTS, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`Insights API returned ${response.status}`);
    }

    const result = await safeJsonParse(response);
    const insights = result.insights || {
      totalValue: 0,
      winRate: 0,
      roi: 0,
      activeContests: 0,
      totalInvested: 0,
      dataSource: DATA_SOURCES.DEFAULT
    };

    cache.set(cacheKey, { data: insights, timestamp: Date.now() });
    return insights;
  } catch (error) {
    return {
      totalValue: 0,
      winRate: 0,
      roi: 0,
      activeContests: 0,
      totalInvested: 0,
      dataSource: DATA_SOURCES.ERROR,
      message: 'Service unavailable'
    };
  }
}

// ============================================
// Database Queries
// ============================================

const SPORT_TABLES = {
  nba: 'nba_odds',
  nfl: 'nfl_odds',
  nhl: 'nhl_odds',
  mlb: 'mlb_odds',
  ncaab: 'ncaab_odds',
  ncaaf: 'ncaaf_odds',
} as const;

function getSportTable(sport: string): string | null {
  const normalizedSport = sport.toLowerCase().replace(/_/g, '');
  return SPORT_TABLES[normalizedSport as keyof typeof SPORT_TABLES] || null;
}

export async function fetchOddsFromDB(
  sport: string,
  options: { limit?: number; from?: Date; to?: Date; team?: string } = {}
): Promise<Result<OddsRecord[], Error>> {
  try {
    const supabase = await createClient();
    const tableName = getSportTable(sport);
    
    if (!tableName) {
      return Err(new Error(`Unknown sport: ${sport}`));
    }

    let queryBuilder = supabase
      .from(tableName)
      .select('*')
      .order('commence_time', { ascending: true });

    if (options.from) {
      queryBuilder = queryBuilder.gte('commence_time', options.from.toISOString());
    }
    if (options.to) {
      queryBuilder = queryBuilder.lte('commence_time', options.to.toISOString());
    }
    if (options.team) {
      queryBuilder = queryBuilder.or(
        `home_team.ilike.%${options.team}%,away_team.ilike.%${options.team}%`
      );
    }
    if (options.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      return Err(new Error(error.message));
    }

    return Ok((data || []) as OddsRecord[]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Err(new Error(message));
  }
}

export async function fetchUpcomingGames(
  sport: string,
  hoursAhead: number = 48
): Promise<Result<OddsRecord[], Error>> {
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  return fetchOddsFromDB(sport, {
    from: now,
    to: future,
    limit: 50,
  });
}

// ============================================
// Utility Functions
// ============================================

export function extractBestOdds(bookmakers: any[]): {
  bestHomeOdds: number | null;
  bestAwayOdds: number | null;
} {
  if (!Array.isArray(bookmakers) || bookmakers.length === 0) {
    return { bestHomeOdds: null, bestAwayOdds: null };
  }

  let bestHomeOdds = -Infinity;
  let bestAwayOdds = -Infinity;

  for (const book of bookmakers) {
    if (!book.markets || !Array.isArray(book.markets)) continue;

    for (const market of book.markets) {
      if (market.key !== 'h2h' || !Array.isArray(market.outcomes)) continue;

      for (const outcome of market.outcomes) {
        const odds = outcome.price;
        
        if (outcome.name.toLowerCase().includes('home') && odds > bestHomeOdds) {
          bestHomeOdds = odds;
        } else if (outcome.name.toLowerCase().includes('away') && odds > bestAwayOdds) {
          bestAwayOdds = odds;
        }
      }
    }
  }

  return {
    bestHomeOdds: bestHomeOdds > -Infinity ? bestHomeOdds : null,
    bestAwayOdds: bestAwayOdds > -Infinity ? bestAwayOdds : null,
  };
}

export function oddsToImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

export function calculateExpectedValue(
  americanOdds: number,
  trueProbability: number
): number {
  const decimalOdds = americanOdds > 0 ? (americanOdds / 100) + 1 : (100 / Math.abs(americanOdds)) + 1;
  return (trueProbability * decimalOdds) - 1;
}
