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
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.log(`${LOG_PREFIXES.DATA_SERVICE} API error ${response.status}:`, errorText);
      throw new Error(`Insights API returned ${response.status}: ${errorText}`);
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

    // Log troubleshooting info if available
    if (result.troubleshooting) {
      console.log(`${LOG_PREFIXES.DATA_SERVICE} Troubleshooting info:`, result.troubleshooting);
    }

    const insights = result.insights || {
      totalValue: 0,
      winRate: 0,
      roi: 0,
      activeContests: 0,
      totalInvested: 0,
      dataSource: DATA_SOURCES.DEFAULT,
      message: result.message || 'No insights available',
      troubleshooting: result.troubleshooting
    };

    cache.set(cacheKey, { data: insights, timestamp: Date.now() });
    return insights;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Error fetching insights:`, errorMessage);
    
    // Provide detailed error messaging
    let userFriendlyMessage = ERROR_MESSAGES.SERVICE_UNAVAILABLE;
    
    if (errorMessage.includes('fetch failed') || errorMessage.includes('NetworkError')) {
      userFriendlyMessage = 'Network error: Cannot connect to API. Check your internet connection and try again.';
      console.log(`${LOG_PREFIXES.DATA_SERVICE} TROUBLESHOOTING: This is typically caused by:`);
      console.log('  1. Database tables not created (run migration in Supabase)');
      console.log('  2. Missing or incorrect environment variables');
      console.log('  3. Supabase project is paused or unavailable');
      console.log('  4. Row Level Security blocking anonymous access');
      console.log(`${LOG_PREFIXES.DATA_SERVICE} Visit /api/health to diagnose the issue`);
    } else if (errorMessage.includes('500')) {
      userFriendlyMessage = 'Server error: The API encountered an error. Check server logs for details.';
    } else if (errorMessage.includes('404')) {
      userFriendlyMessage = 'API endpoint not found. This may indicate a routing issue.';
    }
    
    return {
      totalValue: 0,
      winRate: 0,
      roi: 0,
      activeContests: 0,
      totalInvested: 0,
      dataSource: DATA_SOURCES.ERROR,
      message: userFriendlyMessage
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
