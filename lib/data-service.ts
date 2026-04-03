/**
 * Data Service (Client-Side)
 * Fetches dynamic data from internal API routes for use in client components.
 * Server-side equivalents live in lib/data/index.ts.
 *
 * Shared types are canonical in lib/data/index.ts and re-exported here.
 */

import {
  CACHE_CONFIG,
  API_ENDPOINTS,
  LOG_PREFIXES,
  DATA_SOURCES,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from '@/lib/constants';

// Import and re-export canonical types from lib/data/index.ts
import type { DynamicCard, UserInsights } from '@/lib/data/index';
export type { DynamicCard, UserInsights };

// Cache configuration (using centralized constants)
const CACHE_DURATION = {
  CARDS: CACHE_CONFIG.CARDS_TTL,
  INSIGHTS: CACHE_CONFIG.INSIGHTS_TTL,
  ODDS: CACHE_CONFIG.ODDS_TTL,
};

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_MAX_SIZE = 100; // prevent unbounded growth

/** Evict expired entries; if still over max, remove oldest first (single O(n log n) pass). */
function evictCache(): void {
  const now = Date.now();
  const maxTtl = Math.max(CACHE_DURATION.CARDS, CACHE_DURATION.INSIGHTS, CACHE_DURATION.ODDS);
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > maxTtl) cache.delete(key);
  }
  if (cache.size > CACHE_MAX_SIZE) {
    const overage = cache.size - CACHE_MAX_SIZE;
    const byAge = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < overage; i++) cache.delete(byAge[i][0]);
  }
}

/**
 * Safely parse JSON with error handling
 */
async function safeJsonParse(response: Response): Promise<any> {
  try {
    // Get the text from the response (read once — clone removed as it was unused)
    const text = await response.text();
    
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Response length: ${text.length} bytes`);
    
    // Check if it's empty
    if (!text || text.trim().length === 0) {
      console.error(`${LOG_PREFIXES.DATA_SERVICE} Empty response body received`);
      throw new Error('Empty response body');
    }
    
    // Check for common non-JSON responses
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      console.error(`${LOG_PREFIXES.DATA_SERVICE} Received HTML instead of JSON`);
      throw new Error('Server returned HTML instead of JSON (possible error page)');
    }
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(text);
      console.log(`${LOG_PREFIXES.DATA_SERVICE} Successfully parsed JSON`);
      return parsed;
    } catch (parseError) {
      // Log the first 500 characters for better debugging
      const preview = text.length > 500 ? text.substring(0, 500) + '...' : text;
      console.error(`${LOG_PREFIXES.DATA_SERVICE} JSON parse failed`);
      console.error(`${LOG_PREFIXES.DATA_SERVICE} Response preview:`, preview);
      console.error(`${LOG_PREFIXES.DATA_SERVICE} Parse error:`, parseError instanceof Error ? parseError.message : 'Unknown');
      
      // Try to extract any useful info from malformed JSON
      if (text.includes('"error"')) {
        const errorMatch = text.match(/"error":\s*"([^"]*)"/);
        if (errorMatch) {
          throw new Error(`Server error: ${errorMatch[1]}`);
        }
      }
      
      throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIXES.DATA_SERVICE} Response parsing failed:`, errorMessage);
    throw new Error(`Response parsing failed: ${errorMessage}`);
  }
}

/**
 * Fetch dynamic cards based on context
 * CLIENT-SIDE ONLY - Do not call from server components
 */
export async function fetchDynamicCards(params: {
  sport?: string;
  category?: string;
  userContext?: any;
  limit?: number;
}): Promise<DynamicCard[]> {
  // Skip if running on server
  if (typeof window === 'undefined') {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Skipping fetchDynamicCards on server`);
    return [];
  }

  console.log(`${LOG_PREFIXES.DATA_SERVICE} Fetching cards:`, JSON.stringify(params));
  
  // Sort keys for a deterministic cache key regardless of object property order
  const cacheKey = `cards:${JSON.stringify(params, Object.keys(params).sort())}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION.CARDS) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(API_ENDPOINTS.CARDS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`${LOG_PREFIXES.DATA_SERVICE} ✗ API Error Response:`, errorText.substring(0, 500));
      throw new Error(`Cards API returned ${response.status}: ${errorText.substring(0, 100)}`);
    }

    // Validate JSON response
    const contentType = response.headers.get('content-type');
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Response Content-Type: ${contentType}`);
    
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Cards API returned non-JSON response');
    }

    console.log(`${LOG_PREFIXES.DATA_SERVICE} → Parsing JSON response...`);
    const result = await safeJsonParse(response);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} ✓ JSON parsed successfully`);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Result structure:`, Object.keys(result));
    
    const cards = Array.isArray(result.cards) ? result.cards : [];
    console.log(`${LOG_PREFIXES.DATA_SERVICE} ✓ Extracted ${cards.length} cards from response`);
    
    if (cards.length > 0) {
      console.log(`${LOG_PREFIXES.DATA_SERVICE} Card types:`, cards.map((c: DynamicCard) => c.type));
      console.log(`${LOG_PREFIXES.DATA_SERVICE} Card categories:`, cards.map((c: DynamicCard) => c.category));
      console.log(`${LOG_PREFIXES.DATA_SERVICE} Sample card:`, JSON.stringify(cards[0], null, 2));
    } else {
      console.log(`${LOG_PREFIXES.DATA_SERVICE} ⚠ WARNING: Zero cards returned!`);
      console.log(`${LOG_PREFIXES.DATA_SERVICE} Full API response:`, JSON.stringify(result, null, 2));
    }

    evictCache();
    cache.set(cacheKey, { data: cards, timestamp: Date.now() });
    console.log(`${LOG_PREFIXES.DATA_SERVICE} ✓ Cached ${cards.length} cards`);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} ========================================`);
    return cards;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    console.log(`${LOG_PREFIXES.DATA_SERVICE} ✗ FETCH ERROR:`, errorMessage);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Error stack:`, errorStack);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Returning empty array as fallback`);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} ========================================`);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch user insights from Supabase
 * CLIENT-SIDE ONLY - Do not call from server components
 */
export async function fetchUserInsights(): Promise<UserInsights> {
  // Skip if running on server
  if (typeof window === 'undefined') {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Skipping fetchUserInsights on server`);
    return {
      totalValue: 0,
      winRate: 0,
      roi: 0,
      activeContests: 0,
      totalInvested: 0,
      dataSource: DATA_SOURCES.DEFAULT,
      message: 'Loading...'
    };
  }

  const cacheKey = 'insights:user';
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION.INSIGHTS) {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Returning cached insights`);
    return cached.data;
  }

  const insightsController = new AbortController();
  const insightsTimeoutId = setTimeout(() => insightsController.abort(), 10000); // 10s timeout

  try {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Fetching fresh insights from API`);
    const response = await fetch(API_ENDPOINTS.INSIGHTS, {
      method: 'GET',
      signal: insightsController.signal,
    });

    if (!response.ok) {
      throw new Error(`Insights API returned ${response.status}`);
    }

    // Validate response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Insights API returned non-JSON response');
    }

    const result = await safeJsonParse(response);

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

    evictCache();
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
  } finally {
    clearTimeout(insightsTimeoutId);
  }
}

/**
 * Fetch live odds data
 * CLIENT-SIDE ONLY - Do not call from server components
 */
export async function fetchLiveOdds(sport: string, marketType: string = 'h2h') {
  // Skip if running on server
  if (typeof window === 'undefined') {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Skipping fetchLiveOdds on server`);
    return { 
      success: false, 
      error: 'Server-side fetch not supported',
      events: [],
      timestamp: new Date().toISOString()
    };
  }

  const cacheKey = `odds:${sport}:${marketType}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION.ODDS) {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Returning cached odds`);
    return cached.data;
  }

  const oddsController = new AbortController();
  const oddsTimeoutId = setTimeout(() => oddsController.abort(), 10000); // 10s timeout

  try {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Fetching fresh odds from API`);
    const response = await fetch(API_ENDPOINTS.ODDS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sport, marketType }),
      signal: oddsController.signal,
    });

    if (!response.ok) {
      throw new Error(`Odds API returned ${response.status}`);
    }

    // Validate JSON response
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Odds API returned non-JSON response');
    }

    const result = await safeJsonParse(response);
    evictCache();
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
  } finally {
    clearTimeout(oddsTimeoutId);
  }
}

/**
 * Fetch player data (ADP + roster info)
 * CLIENT-SIDE ONLY
 */
export async function fetchPlayers(params: {
  search?: string;
  sport?: string;
  position?: string;
  limit?: number;
} = {}) {
  if (typeof window === 'undefined') {
    return { success: false, players: [], error: 'Server-side fetch not supported' };
  }

  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.sport) qs.set('sport', params.sport);
  if (params.position) qs.set('position', params.position);
  if (params.limit) qs.set('limit', String(params.limit));

  const cacheKey = `players:${qs.toString()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION.CARDS) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `${API_ENDPOINTS.PLAYERS}?${qs.toString()}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) throw new Error(`Players API returned ${response.status}`);

    const result = await safeJsonParse(response);
    evictCache();
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Error fetching players:`, msg);
    return { success: false, players: [], error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch DFS projections
 * CLIENT-SIDE ONLY
 */
export async function fetchDFS(params: {
  date?: string;
  position?: string;
  sort?: string;
  limit?: number;
} = {}) {
  if (typeof window === 'undefined') {
    return { success: false, projections: [], error: 'Server-side fetch not supported' };
  }

  const qs = new URLSearchParams();
  if (params.date) qs.set('date', params.date);
  if (params.position) qs.set('position', params.position);
  if (params.sort) qs.set('sort', params.sort);
  if (params.limit) qs.set('limit', String(params.limit));

  const cacheKey = `dfs:${qs.toString()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION.CARDS) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `${API_ENDPOINTS.DFS}?${qs.toString()}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) throw new Error(`DFS API returned ${response.status}`);

    const result = await safeJsonParse(response);
    evictCache();
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Error fetching DFS projections:`, msg);
    return { success: false, projections: [], error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch Statcast leaderboard data
 * CLIENT-SIDE ONLY
 */
export async function fetchStatcast(metric = 'xwoba', limit = 25) {
  if (typeof window === 'undefined') {
    return { success: false, leaders: [], error: 'Server-side fetch not supported' };
  }

  const qs = new URLSearchParams({ metric, limit: String(limit) });
  const cacheKey = `statcast:${qs.toString()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION.CARDS) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_ENDPOINTS.STATCAST}?${qs.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Statcast API returned ${response.status}`);
    const result = await safeJsonParse(response);
    evictCache();
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Error fetching statcast:`, msg);
    return { success: false, leaders: [], error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch arbitrage opportunities
 * CLIENT-SIDE ONLY
 */
export async function fetchArbitrage(sport = 'baseball_mlb') {
  if (typeof window === 'undefined') {
    return { success: false, opportunities: [], error: 'Server-side fetch not supported' };
  }

  const cacheKey = `arbitrage:${sport}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION.CARDS) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_ENDPOINTS.ARBITRAGE}?sport=${sport}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Arbitrage API returned ${response.status}`);
    const result = await safeJsonParse(response);
    evictCache();
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Error fetching arbitrage:`, msg);
    return { success: false, opportunities: [], error: msg };
  } finally {
    clearTimeout(timeoutId);
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
