/**
 * Kalshi API Client
 * Integration with Kalshi prediction markets for real market data
 * 
 * API Documentation: https://trading-api.readme.io/reference/introduction
 */

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

// In-memory cache for Kalshi markets
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
    console.log('[v0] [KALSHI] Cache expired for key:', cacheKey);
    marketCache.delete(cacheKey);
    return null;
  }
  
  const remainingMs = cached.ttl - (now - cached.timestamp);
  console.log(`[v0] [KALSHI] Cache hit! Key: ${cacheKey}, Remaining TTL: ${Math.floor(remainingMs / 1000)}s`);
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
  console.log(`[v0] [KALSHI] Cached ${markets.length} markets with ${ttlMs / 1000}s TTL`);
}

export interface KalshiSeries {
  ticker: string;
  title: string;
  category: string;
  markets: KalshiMarket[];
}

/**
 * Fetch active markets from Kalshi
 * 
 * Important: For election markets (2026 H2H, etc.), use category mappings:
 * - 'election' → searches for election-related markets
 * - 'politics' → searches political markets
 * - '2026' → searches 2026 election markets
 * 
 * For sports markets, use standard abbreviations:
 * - 'NFL', 'NBA', 'MLB', 'NHL'
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
      console.log('[v0] [KALSHI] Returning cached markets');
      return cached;
    }
    
    console.log('[v0] [KALSHI] Cache miss, fetching from API...');
  }
  
  try {
    // Use the main Kalshi trading API; fall back to elections endpoint if unavailable
    const baseUrl = 'https://trading-api.kalshi.com/trade-api/v2';
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
    };
    
    // Try to map category to Kalshi's category system
    let finalCategory = category;
    if (category && categoryMap[category.toLowerCase()]) {
      finalCategory = categoryMap[category.toLowerCase()];
    }
    
    // Use cursor-based pagination and category filter
    if (finalCategory) {
      queryParams.append('series_ticker', finalCategory);
    }
    
    // Add search query if provided - Kalshi uses 'title' param
    if (search) {
      queryParams.append('title', search);
    }
    
    // Add event_ticker for more targeted searches
    if (category && !finalCategory) {
      queryParams.append('title', category);
    }
    
    const url = `${baseUrl}/markets?${queryParams}`;
    
    console.log('[v0] [KALSHI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[v0] [KALSHI] Fetching markets from Kalshi API');
    console.log('[v0] [KALSHI] URL:', url);
    console.log('[v0] [KALSHI] Params:', { category: finalCategory, status, limit, search });
    console.log('[v0] [KALSHI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'LeverageAI/1.0',
    };
    // Attach API key if configured
    const kalshiApiKey = process.env.KALSHI_API_KEY;
    if (kalshiApiKey) {
      headers['Authorization'] = `Bearer ${kalshiApiKey}`;
    }

    let response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    console.log('[v0] [KALSHI] Response status:', response.status, response.statusText);

    // If main API rejects (requires auth we don't have), fall back to the elections endpoint
    if (!response.ok) {
      const fallbackBase = 'https://api.elections.kalshi.com/trade-api/v2';
      const fallbackUrl = `${fallbackBase}/markets?${queryParams}`;
      console.log('[v0] [KALSHI] Main API unavailable, trying elections fallback:', fallbackUrl);
      response = await fetch(fallbackUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'LeverageAI/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      console.log('[v0] [KALSHI] Fallback response status:', response.status, response.statusText);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[v0] [KALSHI] ❌ API Error Response:', errorText.substring(0, 500));
      throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('[v0] [KALSHI] ✓ Response received, parsing data...');
    
    // Check if we got valid data
    if (!data.markets || !Array.isArray(data.markets)) {
      console.error('[v0] [KALSHI] ❌ Unexpected response format');
      console.error('[v0] [KALSHI] Response keys:', Object.keys(data));
      console.error('[v0] [KALSHI] Response sample:', JSON.stringify(data).substring(0, 500));
      return [];
    }
    
    console.log(`[v0] [KALSHI] Raw markets count: ${data.markets.length}`);
    
    // Log raw field names from first market for debugging
    if (data.markets.length > 0) {
      const sampleKeys = Object.keys(data.markets[0]);
      console.log('[v0] [KALSHI] Raw market fields:', sampleKeys.join(', '));
    }
    
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
    
    console.log(`[v0] [KALSHI] Fetched ${markets.length} raw, ${meaningfulMarkets.length} meaningful markets`);
    console.log('[v0] [KALSHI] Categories:', [...new Set(meaningfulMarkets.map(m => m.category))].filter(Boolean).slice(0, 10).join(', '));
    meaningfulMarkets.slice(0, 3).forEach(m => console.log(`[v0] [KALSHI]   - ${m.title.substring(0, 80)} (${m.category})`));
    
    // Store in cache if enabled
    if (useCache && meaningfulMarkets.length > 0) {
      const cacheKey = getCacheKey({ category, status, limit, search });
      cacheMarkets(cacheKey, meaningfulMarkets, cacheTtlMs);
    }
    
    return meaningfulMarkets;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[v0] [KALSHI] ❌ Request timeout after 10s - API may be slow or unavailable');
    } else if (error instanceof Error) {
      console.error('[v0] [KALSHI] ❌ Failed to fetch markets:', error.message);
    } else {
      console.error('[v0] [KALSHI] ❌ Unknown error:', error);
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
      console.log(`[v0] [KALSHI] Attempt ${attempt}/${maxRetries}`);
      const markets = await fetchKalshiMarkets(fetchParams);
      
      if (markets.length > 0) {
        console.log(`[v0] [KALSHI] ✓ Success on attempt ${attempt}`);
        return markets;
      }
      
      // If we got 0 markets, it might be a real response or an error
      // Only retry if we're not on the last attempt
      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[v0] [KALSHI] Got 0 markets, retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        console.warn('[v0] [KALSHI] All retry attempts exhausted, returning empty array');
        return markets;
      }
    } catch (error) {
      console.error(`[v0] [KALSHI] Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[v0] [KALSHI] Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        console.error('[v0] [KALSHI] All retry attempts failed');
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
  try {
    // Fetch markets from various sports categories
    const categories = ['NFL', 'NBA', 'MLB', 'NHL'];
    const allMarkets: KalshiMarket[] = [];
    
    for (const category of categories) {
      const markets = await fetchKalshiMarkets({ category, limit: 10 });
      allMarkets.push(...markets);
    }
    
    return allMarkets;
  } catch (error) {
    console.error('[v0] [KALSHI] Failed to fetch sports markets:', error);
    return [];
  }
}

/**
 * Fetch election-related markets from Kalshi
 * Specifically for 2026 H2H contracts and presidential markets
 */
export async function fetchElectionMarkets(options?: {
  year?: number;
  includeH2H?: boolean;
  limit?: number;
}): Promise<KalshiMarket[]> {
  const { year = 2026, includeH2H = true, limit = 20 } = options || {};
  
  console.log('[v0] [KALSHI] Fetching election markets for year:', year);
  
  try {
    // Try multiple search strategies to find election markets
    const searchStrategies = [
      { category: 'election', search: `${year}` },
      { category: 'politics' },
      { search: `president ${year}` },
      { search: 'h2h' },
    ];
    
    const allMarkets: KalshiMarket[] = [];
    
    for (const strategy of searchStrategies) {
      const markets = await fetchKalshiMarkets({ ...strategy, limit: 50 });
      
      // Filter for unique markets
      markets.forEach(market => {
        if (!allMarkets.some(m => m.ticker === market.ticker)) {
          allMarkets.push(market);
        }
      });
      
      if (allMarkets.length >= limit) {
        break;
      }
    }
    
    // Filter specifically for election/presidential markets
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
    
    console.log(`[v0] [KALSHI] Found ${electionMarkets.length} election markets for ${year}`);
    
    if (electionMarkets.length === 0) {
      console.warn('[v0] [KALSHI] No 2026 election markets found. Possible reasons:');
      console.warn('  1. Markets not yet created for 2026');
      console.warn('  2. Different ticker/category naming');
      console.warn('  3. API access restrictions');
      console.warn('  Recommendation: Check https://kalshi.com directly for available markets');
    }
    
    return electionMarkets.slice(0, limit);
  } catch (error) {
    console.error('[v0] [KALSHI] Failed to fetch election markets:', error);
    return [];
  }
}

/**
 * Get market by ticker
 */
export async function getMarketByTicker(ticker: string): Promise<KalshiMarket | null> {
  try {
    const baseUrl = 'https://trading-api.kalshi.com/trade-api/v2';
    const url = `${baseUrl}/markets/${ticker}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
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
    console.error(`[v0] [KALSHI] Failed to fetch market ${ticker}:`, error);
    return null;
  }
}

/**
 * Convert Kalshi market to insight card format
 */
export function kalshiMarketToCard(market: KalshiMarket): any {
  const impliedProbability = market.yesPrice / 100;
  const edge = impliedProbability > 0.5 ? '+' : '';
  
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

// ---------------------------------------------------------------------------
// Kalshi Volatility Analysis (consolidated from lib/kalshi/analyzeKalshiVolatility.ts)
// ---------------------------------------------------------------------------

export interface KalshiVolatilityInput {
  yesPrice: number;
  noPrice: number;
  volume: number;
  historicalPrices: number[];
}

export interface KalshiAnalysis {
  impliedProbability: number;
  volatility: number;
  edgeEstimate: number;
  riskLevel: "low" | "medium" | "high";
  currentPrice?: number;
  isVolatile?: boolean;
  edgeVsModel?: number;
  volume24h?: number;
}

/**
 * Calculate standard deviation of an array of numbers
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Analyze Kalshi market volatility and edge
 * @param market - Kalshi market data with historical prices
 * @param modelProbability - Model's estimated probability (0-1)
 */
export function analyzeKalshiVolatility(
  market: KalshiVolatilityInput,
  modelProbability: number
): KalshiAnalysis {
  const impliedProbability = market.yesPrice / 100;
  const normalizedPrices = market.historicalPrices.map(price => price / 100);
  const volatility = standardDeviation(normalizedPrices);
  const edgeEstimate = modelProbability - impliedProbability;

  let riskLevel: "low" | "medium" | "high";
  if (volatility < 0.05) riskLevel = "low";
  else if (volatility <= 0.12) riskLevel = "medium";
  else riskLevel = "high";

  return { impliedProbability, volatility, edgeEstimate, riskLevel };
}

/**
 * Fetch Kalshi cards for a specific sport
 */
export async function getKalshiCardsForSport(sport: string, limit: number = 3): Promise<any[]> {
  const sportCategoryMap: Record<string, string> = {
    nfl: 'NFL',
    nba: 'NBA',
    mlb: 'MLB',
    nhl: 'NHL',
    americanfootball_nfl: 'NFL',
    basketball_nba: 'NBA',
    baseball_mlb: 'MLB',
    icehockey_nhl: 'NHL',
  };
  
  const category = sportCategoryMap[sport.toLowerCase()];
  
  if (!category) {
    console.log(`[v0] [KALSHI] No category mapping for sport: ${sport}`);
    return [];
  }
  
  const markets = await fetchKalshiMarkets({ category, limit });
  return markets.map(kalshiMarketToCard);
}
