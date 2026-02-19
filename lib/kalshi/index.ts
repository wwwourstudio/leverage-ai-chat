/**
 * Unified Kalshi Prediction Markets API Client
 * Consolidated from multiple Kalshi modules
 * 
 * Fetches real-time prediction market data from Kalshi API
 * API Documentation: https://trading-api.readme.io/reference/getting-started
 */

const KALSHI_API_BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';
const KALSHI_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface KalshiMarket {
  ticker: string;
  title: string;
  category: string;
  subtitle: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  openInterest: number;
  closeTime: string;
  status: string;
}

interface KalshiMarketResponse {
  markets: any[];
  cursor?: string;
}

// In-memory cache with TTL
interface CacheEntry {
  data: KalshiMarket[];
  timestamp: number;
  ttl: number;
}

const marketCache = new Map<string, CacheEntry>();

/**
 * Generate cache key from parameters
 */
function getCacheKey(params?: {
  category?: string;
  status?: string;
  limit?: number;
  search?: string;
}): string {
  const { category, status, limit, search } = params || {};
  return `kalshi:${category || 'all'}:${status || 'open'}:${limit || 20}:${search || ''}`;
}

/**
 * Get cached markets if available and not expired
 */
function getCachedMarkets(cacheKey: string): KalshiMarket[] | null {
  const cached = marketCache.get(cacheKey);
  
  if (!cached) {
    return null;
  }
  
  const now = Date.now();
  const isExpired = (now - cached.timestamp) > cached.ttl;
  
  if (isExpired) {
    console.log('[KALSHI] Cache expired for key:', cacheKey);
    marketCache.delete(cacheKey);
    return null;
  }
  
  const remainingMs = cached.ttl - (now - cached.timestamp);
  console.log(`[KALSHI] Cache hit! Remaining TTL: ${Math.floor(remainingMs / 1000)}s`);
  return cached.data;
}

/**
 * Store markets in cache with TTL
 */
function cacheMarkets(cacheKey: string, markets: KalshiMarket[], ttlMs: number = 60000): void {
  marketCache.set(cacheKey, {
    data: markets,
    timestamp: Date.now(),
    ttl: ttlMs
  });
  console.log(`[KALSHI] Cached ${markets.length} markets with ${ttlMs / 1000}s TTL`);
}

/**
 * Fetch active markets from Kalshi
 * 
 * Supports category mappings:
 * - 'election' → Elections
 * - 'politics' → Politics  
 * - 'sports' → Sports markets (NFL, NBA, etc.)
 */
export async function fetchKalshiMarkets(params?: {
  category?: string;
  status?: 'open' | 'closed';
  limit?: number;
  search?: string;
  useCache?: boolean;
  cacheTtlMs?: number;
}): Promise<KalshiMarket[]> {
  const { category, status = 'open', limit = 20, search, useCache = true, cacheTtlMs = 60000 } = params || {};
  
  // Check cache first
  if (useCache) {
    const cacheKey = getCacheKey({ category, status, limit, search });
    const cached = getCachedMarkets(cacheKey);
    
    if (cached) {
      console.log('[KALSHI] Returning cached markets');
      return cached;
    }
    
    console.log('[KALSHI] Cache miss, fetching from API...');
  }
  
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      status,
    });
    
    // Map common keywords to Kalshi categories
    const categoryMap: Record<string, string> = {
      'election': 'Elections',
      'elections': 'Elections',
      'politics': 'Politics',
      'political': 'Politics',
      '2026': 'Elections',
      'president': 'Elections',
      'presidential': 'Elections',
      'sports': 'Sports',
      'nfl': 'NFL',
      'nba': 'NBA',
      'mlb': 'MLB',
      'nhl': 'NHL',
    };
    
    let finalCategory = category;
    if (category && categoryMap[category.toLowerCase()]) {
      finalCategory = categoryMap[category.toLowerCase()];
    }
    
    if (finalCategory) {
      queryParams.append('series_ticker', finalCategory);
    }
    
    if (search) {
      queryParams.append('title', search);
    }
    
    if (category && !finalCategory) {
      queryParams.append('title', category);
    }
    
    const url = `${KALSHI_API_BASE_URL}/markets?${queryParams}`;
    
    console.log('[KALSHI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[KALSHI] Fetching markets from Kalshi API');
    console.log('[KALSHI] URL:', url);
    console.log('[KALSHI] Params:', { category: finalCategory, status, limit, search });
    console.log('[KALSHI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LeverageAI/1.0'
      },
      signal: AbortSignal.timeout(10000),
    });
    
    console.log('[KALSHI] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[KALSHI] ❌ API Error Response:', errorText.substring(0, 500));
      throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
    }
    
    const data: KalshiMarketResponse = await response.json();
    console.log('[KALSHI] ✓ Response received, parsing data...');
    
    if (!data.markets || !Array.isArray(data.markets)) {
      console.error('[KALSHI] ❌ Unexpected response format');
      return [];
    }
    
    console.log(`[KALSHI] Raw markets count: ${data.markets.length}`);
    
    const markets: KalshiMarket[] = data.markets.map((m: any) => ({
      ticker: m.ticker || '',
      title: m.title || m.event_title || m.yes_sub_title || m.subtitle || '',
      category: m.category || m.series_ticker || m.event_ticker || '',
      subtitle: m.subtitle || m.yes_sub_title || '',
      yesPrice: m.yes_bid ?? m.yes_ask ?? m.last_price ?? m.floor_strike ?? 0,
      noPrice: m.no_bid ?? m.no_ask ?? (m.last_price ? (100 - m.last_price) : 100),
      volume: m.volume ?? m.volume_24h ?? 0,
      openInterest: m.open_interest ?? 0,
      closeTime: m.close_time || m.expiration_time || m.end_date || '',
      status: m.status || 'active',
    }));
    
    // Filter out markets with no meaningful data
    const meaningfulMarkets = markets.filter(m => m.title && m.title.length > 5);
    
    console.log(`[KALSHI] Fetched ${markets.length} raw, ${meaningfulMarkets.length} meaningful markets`);
    
    // Store in cache if enabled
    if (useCache && meaningfulMarkets.length > 0) {
      const cacheKey = getCacheKey({ category, status, limit, search });
      cacheMarkets(cacheKey, meaningfulMarkets, cacheTtlMs);
    }
    
    return meaningfulMarkets;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[KALSHI] ❌ Request timeout after 10s');
    } else if (error instanceof Error) {
      console.error('[KALSHI] ❌ Failed to fetch markets:', error.message);
    } else {
      console.error('[KALSHI] ❌ Unknown error:', error);
    }
    return [];
  }
}

/**
 * Fetch Kalshi markets with retry logic and exponential backoff
 */
export async function fetchKalshiMarketsWithRetry(params?: {
  category?: string;
  status?: 'open' | 'closed';
  limit?: number;
  search?: string;
  maxRetries?: number;
}): Promise<KalshiMarket[]> {
  const { maxRetries = 3, ...fetchParams } = params || {};
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[KALSHI] Attempt ${attempt}/${maxRetries}`);
      const markets = await fetchKalshiMarkets(fetchParams);
      
      if (markets.length > 0) {
        console.log(`[KALSHI] ✓ Success on attempt ${attempt}`);
        return markets;
      }
      
      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[KALSHI] Got 0 markets, retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        console.warn('[KALSHI] All retry attempts exhausted');
        return markets;
      }
    } catch (error) {
      console.error(`[KALSHI] Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[KALSHI] Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        console.error('[KALSHI] All retry attempts failed');
        return [];
      }
    }
  }
  
  return [];
}

/**
 * Fetch sports-related markets from Kalshi
 */
export async function fetchSportsMarkets(): Promise<KalshiMarket[]> {
  const categories = ['NFL', 'NBA', 'MLB', 'NHL'];
  const allMarkets: KalshiMarket[] = [];
  
  for (const category of categories) {
    const markets = await fetchKalshiMarkets({ category, limit: 10 });
    allMarkets.push(...markets);
  }
  
  return allMarkets;
}

/**
 * Fetch election-related markets from Kalshi
 */
export async function fetchElectionMarkets(options?: {
  year?: number;
  includeH2H?: boolean;
  limit?: number;
}): Promise<KalshiMarket[]> {
  const { year = 2026, includeH2H = true, limit = 20 } = options || {};
  
  console.log('[KALSHI] Fetching election markets for year:', year);
  
  const searchStrategies = [
    { category: 'election', search: `${year}` },
    { category: 'politics' },
    { search: `president ${year}` },
    { search: 'h2h' },
  ];
  
  const allMarkets: KalshiMarket[] = [];
  
  for (const strategy of searchStrategies) {
    const markets = await fetchKalshiMarkets({ ...strategy, limit: 50 });
    
    markets.forEach(market => {
      if (!allMarkets.some(m => m.ticker === market.ticker)) {
        allMarkets.push(market);
      }
    });
    
    if (allMarkets.length >= limit) {
      break;
    }
  }
  
  const electionMarkets = allMarkets.filter(market => {
    const text = `${market.title} ${market.category} ${market.subtitle}`.toLowerCase();
    const isElection = text.includes('election') || 
                      text.includes('president') || 
                      text.includes('harris') || 
                      text.includes('trump');
    const isCorrectYear = text.includes(year.toString());
    const isH2H = includeH2H ? text.includes('h2h') || text.includes('vs') : true;
    
    return isElection && (isCorrectYear || includeH2H && isH2H);
  });
  
  console.log(`[KALSHI] Found ${electionMarkets.length} election markets for ${year}`);
  
  return electionMarkets.slice(0, limit);
}

/**
 * Get market by ticker
 */
export async function getMarketByTicker(ticker: string): Promise<KalshiMarket | null> {
  try {
    const url = `${KALSHI_API_BASE_URL}/markets/${ticker}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`Kalshi API error: ${response.status}`);
    }
    
    const data = await response.json();
    const m = data.market;
    
    return {
      ticker: m.ticker,
      title: m.title,
      category: m.category,
      subtitle: m.subtitle || '',
      yesPrice: m.yes_bid || 0,
      noPrice: m.no_bid || 0,
      volume: m.volume || 0,
      openInterest: m.open_interest || 0,
      closeTime: m.close_time,
      status: m.status,
    };
  } catch (error) {
    console.error(`[KALSHI] Failed to fetch market ${ticker}:`, error);
    return null;
  }
}

/**
 * Generate Kalshi market cards for display
 */
export function generateKalshiCards(markets: KalshiMarket[]): any[] {
  console.log('[KALSHI] Generating cards for', markets.length, 'markets');

  return markets.slice(0, 3).map((market, index) => {
    const yesProb = market.yesPrice / 100;
    const noProb = market.noPrice / 100;
    const confidence = Math.abs(yesProb - 0.5) * 2;
    const status = confidence > 0.3 ? 'edge' : confidence > 0.15 ? 'opportunity' : 'neutral';

    return {
      type: 'kalshi-market',
      title: market.title,
      icon: 'TrendingUp',
      category: 'KALSHI',
      subcategory: market.category || 'Prediction Market',
      gradient: 'from-purple-600 to-indigo-700',
      status,
      data: {
        ticker: market.ticker,
        subtitle: market.subtitle || '',
        yesPrice: `${(yesProb * 100).toFixed(1)}¢`,
        noPrice: `${(noProb * 100).toFixed(1)}¢`,
        yesProbability: `${(yesProb * 100).toFixed(1)}%`,
        noProbability: `${(noProb * 100).toFixed(1)}%`,
        volume: `$${(market.volume / 100).toLocaleString()}`,
        openInterest: `$${(market.openInterest / 100).toLocaleString()}`,
        closingTime: new Date(market.closeTime).toLocaleDateString(),
        marketType: 'Binary Outcome',
      },
      metadata: {
        source: 'Kalshi API',
        fetchedAt: new Date().toISOString(),
        marketIndex: index + 1,
      }
    };
  });
}

/**
 * Convert Kalshi market to insight card format
 */
export function kalshiMarketToCard(market: KalshiMarket): any {
  const impliedProbability = market.yesPrice / 100;
  
  return {
    type: 'kalshi-market',
    title: market.title,
    icon: 'TrendingUp',
    category: 'KALSHI',
    subcategory: market.category,
    gradient: 'from-purple-600 to-pink-700',
    data: {
      ticker: market.ticker,
      subtitle: market.subtitle,
      yesPrice: `${market.yesPrice}¢`,
      noPrice: `${market.noPrice}¢`,
      impliedProbability: `${(impliedProbability * 100).toFixed(1)}%`,
      volume: market.volume.toLocaleString(),
      openInterest: market.openInterest.toLocaleString(),
      closeTime: new Date(market.closeTime).toLocaleDateString(),
      recommendation: impliedProbability > 0.7 
        ? 'Strong YES position' 
        : impliedProbability < 0.3 
        ? 'Strong NO position'
        : 'Market appears efficient',
    },
    status: market.status === 'open' ? 'active' : 'closed',
    realData: true,
  };
}
