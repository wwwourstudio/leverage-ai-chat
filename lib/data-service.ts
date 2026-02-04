/**
 * Data Service
 * Centralized service for fetching dynamic data from APIs
 * Eliminates all hardcoded data with real-time fetches
 */

import {
  CACHE_CONFIG,
  API_ENDPOINTS,
  LOG_PREFIXES,
  DATA_SOURCES,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from '@/lib/constants';

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

// Cache configuration (using centralized constants)
const CACHE_DURATION = {
  CARDS: CACHE_CONFIG.CARDS_TTL,
  INSIGHTS: CACHE_CONFIG.INSIGHTS_TTL,
  ODDS: CACHE_CONFIG.ODDS_TTL,
};

const cache = new Map<string, { data: any; timestamp: number }>();

/**
 * Fetch dynamic cards based on context
 */
export async function fetchDynamicCards(params: {
  sport?: string;
  category?: string;
  userContext?: any;
  limit?: number;
}): Promise<DynamicCard[]> {
  const cacheKey = `cards:${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION.CARDS) {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Returning cached cards`);
    return cached.data;
  }

  try {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Fetching fresh cards from API`);
    const response = await fetch(API_ENDPOINTS.CARDS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`Cards API returned ${response.status}`);
    }

    // Validate JSON response
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Cards API returned non-JSON response');
    }

    const result = await response.json();
    const cards = Array.isArray(result.cards) ? result.cards : [];

    cache.set(cacheKey, { data: cards, timestamp: Date.now() });
    return cards;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Error fetching cards:`, errorMessage);
    return [];
  }
}

/**
 * Fetch user insights from Supabase
 */
export async function fetchUserInsights(): Promise<UserInsights> {
  const cacheKey = 'insights:user';
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION.INSIGHTS) {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Returning cached insights`);
    return cached.data;
  }

  try {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Fetching fresh insights from API`);
    const response = await fetch(API_ENDPOINTS.INSIGHTS, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Insights API returned ${response.status}`);
    }

    // Validate response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Insights API returned non-JSON response');
    }

    const result = await response.json();
    
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response format from insights API');
    }

    const insights = result.insights || {
      totalValue: 0,
      winRate: 0,
      roi: 0,
      activeContests: 0,
      totalInvested: 0,
      dataSource: DATA_SOURCES.DEFAULT,
      message: 'No insights available'
    };

    cache.set(cacheKey, { data: insights, timestamp: Date.now() });
    return insights;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Error fetching insights:`, errorMessage);
    return {
      totalValue: 0,
      winRate: 0,
      roi: 0,
      activeContests: 0,
      totalInvested: 0,
      dataSource: DATA_SOURCES.ERROR,
      message: ERROR_MESSAGES.SERVICE_UNAVAILABLE
    };
  }
}

/**
 * Fetch live odds data
 */
export async function fetchLiveOdds(sport: string, marketType: string = 'h2h') {
  const cacheKey = `odds:${sport}:${marketType}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION.ODDS) {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Returning cached odds`);
    return cached.data;
  }

  try {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Fetching fresh odds from API`);
    const response = await fetch(API_ENDPOINTS.ODDS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sport, marketType })
    });

    if (!response.ok) {
      throw new Error(`Odds API returned ${response.status}`);
    }

    // Validate JSON response
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Odds API returned non-JSON response');
    }

    const result = await response.json();
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Error fetching odds:`, errorMessage);
    return { 
      success: false, 
      error: errorMessage,
      events: [],
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Clear cache for specific key or all
 */
export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
    oldestEntry: Array.from(cache.values()).reduce((oldest, current) => 
      current.timestamp < oldest ? current.timestamp : oldest
    , Date.now())
  };
}