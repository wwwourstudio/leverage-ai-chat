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

/** Internal: one page of Kalshi markets plus the cursor for the next page */
interface KalshiPage {
  markets: KalshiMarket[];
  cursor: string | null;
}

/** Build Authorization headers, attaching the API key when available */
function kalshiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'LeverageAI/1.0',
  };
  const key = process.env.KALSHI_API_KEY;
  if (key) headers['Authorization'] = `Bearer ${key}`;
  return headers;
}

/** Parse a raw Kalshi market object into a typed KalshiMarket */
function parseMarket(m: any): KalshiMarket {
  return {
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
  };
}

/**
 * Fetch a single page of markets from the Kalshi trading API.
 * Falls back to the elections endpoint if the main API rejects the request.
 * Returns the parsed markets and the cursor for the next page (null when done).
 */
async function fetchKalshiPage(queryParams: URLSearchParams): Promise<KalshiPage> {
  const baseUrl = 'https://trading-api.kalshi.com/trade-api/v2';
  const url = `${baseUrl}/markets?${queryParams}`;

  let response = await fetch(url, {
    headers: kalshiHeaders(),
    signal: AbortSignal.timeout(10000),
  });

  // Fall back to the elections mirror if the main endpoint rejects us
  if (!response.ok) {
    const fallbackUrl = `https://api.elections.kalshi.com/trade-api/v2/markets?${queryParams}`;
    console.log('[v0] [KALSHI] Main API failed, trying elections fallback');
    response = await fetch(fallbackUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'LeverageAI/1.0' },
      signal: AbortSignal.timeout(10000),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kalshi API error: ${response.status} ${response.statusText} — ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();

  if (!data.markets || !Array.isArray(data.markets)) {
    console.warn('[v0] [KALSHI] Unexpected response format, keys:', Object.keys(data).join(', '));
    return { markets: [], cursor: null };
  }

  const markets = data.markets
    .map(parseMarket)
    .filter((m: KalshiMarket) => m.title && m.title.length > 5);

  // The API returns an empty string cursor (not null) when there are no more pages
  const cursor = data.cursor && data.cursor !== '' ? data.cursor : null;

  return { markets, cursor };
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
  cursor?: string;
  useCache?: boolean;
  cacheTtlMs?: number;
}): Promise<KalshiMarket[]> {
  const { category, status = 'open', limit = 200, search, cursor, useCache = true, cacheTtlMs = 60000 } = params || {};

  // Check cache first (only when not mid-pagination)
  if (useCache && !cursor) {
    const cacheKey = getCacheKey({ category, status, limit, search });
    const cached = getCachedMarkets(cacheKey);

    if (cached) {
      console.log('[v0] [KALSHI] Returning cached markets');
      return cached;
    }

    console.log('[v0] [KALSHI] Cache miss, fetching from API...');
  }

  try {
    const queryParams = new URLSearchParams({
      limit: Math.min(limit, 1000).toString(),
      status,
    });

    // Keyword → title search mapping (Kalshi doesn't expose category filter directly;
    // series_ticker expects exact series IDs like "KXBT", not human-readable names)
    const categorySearchMap: Record<string, string> = {
      'election': 'election',
      'elections': 'election',
      'politics': 'senate',
      'political': 'senate',
      '2026': '2026',
      'president': 'president',
      'presidential': 'president',
    };

    // Use title keyword search when a category is specified
    if (category) {
      const titleSearch = categorySearchMap[category.toLowerCase()] ?? category;
      queryParams.append('title', titleSearch);
    }

    if (search) {
      // If category already added a title param, search overrides it
      queryParams.set('title', search);
    }

    if (cursor) {
      queryParams.append('cursor', cursor);
    }

    console.log('[v0] [KALSHI] Fetching markets — params:', { category, status, limit, search, cursor: !!cursor });

    const { markets: meaningfulMarkets, cursor: _cursor } = await fetchKalshiPage(queryParams);

    console.log(`[v0] [KALSHI] Fetched ${meaningfulMarkets.length} meaningful markets`);
    console.log('[v0] [KALSHI] Categories:', [...new Set(meaningfulMarkets.map(m => m.category))].filter(Boolean).slice(0, 10).join(', '));
    meaningfulMarkets.slice(0, 3).forEach(m => console.log(`[v0] [KALSHI]   - ${m.title.substring(0, 80)} (${m.category})`));

    // Store in cache if enabled (only first page)
    if (useCache && !cursor && meaningfulMarkets.length > 0) {
      const cacheKey = getCacheKey({ category, status, limit, search });
      cacheMarkets(cacheKey, meaningfulMarkets, cacheTtlMs);
    }

    return meaningfulMarkets;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[v0] [KALSHI] ❌ Request timeout after 10s');
    } else {
      console.error('[v0] [KALSHI] ❌ Failed to fetch markets:', error instanceof Error ? error.message : error);
    }
    return [];
  }
}

/**
 * Fetch ALL open Kalshi markets across every category using cursor-based pagination.
 * Streams through pages until the API returns no more results or maxMarkets is reached.
 * Default cap: 2000 markets to avoid runaway fetches.
 */
export async function fetchAllKalshiMarkets(options?: {
  maxMarkets?: number;
  status?: 'open' | 'closed';
  useCache?: boolean;
}): Promise<KalshiMarket[]> {
  const { maxMarkets = 2000, status = 'open', useCache = true } = options || {};

  const cacheKey = `kalshi:all:${status}:${maxMarkets}`;
  if (useCache) {
    const cached = getCachedMarkets(cacheKey);
    if (cached) {
      console.log(`[v0] [KALSHI] All-markets cache hit: ${cached.length} markets`);
      return cached;
    }
  }

  console.log(`[v0] [KALSHI] Fetching ALL markets (cap: ${maxMarkets})...`);

  const all: KalshiMarket[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  let page = 0;

  do {
    page++;
    const queryParams = new URLSearchParams({
      limit: '1000',
      status,
    });
    if (cursor) queryParams.append('cursor', cursor);

    try {
      const { markets, cursor: nextCursor } = await fetchKalshiPage(queryParams);

      for (const m of markets) {
        if (!seen.has(m.ticker)) {
          seen.add(m.ticker);
          all.push(m);
        }
      }

      cursor = nextCursor;
      console.log(`[v0] [KALSHI] Page ${page}: +${markets.length} markets (total: ${all.length}), nextCursor: ${cursor ? 'yes' : 'done'}`);
    } catch (err) {
      console.error(`[v0] [KALSHI] Pagination error on page ${page}:`, err instanceof Error ? err.message : err);
      break;
    }
  } while (cursor && all.length < maxMarkets);

  console.log(`[v0] [KALSHI] Done — ${all.length} total markets across ${page} pages`);
  const categories = [...new Set(all.map(m => m.category))].filter(Boolean);
  console.log(`[v0] [KALSHI] Categories (${categories.length}):`, categories.slice(0, 20).join(', '));

  if (useCache && all.length > 0) {
    cacheMarkets(cacheKey, all, 120000); // 2-minute cache for full fetch
  }

  return all;
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
 * Fetch sports-related markets from Kalshi.
 * Searches across all supported sports using keyword title searches and deduplicates by ticker.
 */
export async function fetchSportsMarkets(): Promise<KalshiMarket[]> {
  // These are keyword searches sent as the `title` param to Kalshi's markets endpoint.
  // Each entry fetches up to 100 markets matching that keyword.
  const sportSearches = [
    // American football
    { search: 'NFL', label: 'NFL' },
    { search: 'Super Bowl', label: 'Super Bowl' },
    { search: 'NCAAF', label: 'NCAAF' },
    // Basketball
    { search: 'NBA', label: 'NBA' },
    { search: 'NCAAB', label: 'NCAAB' },
    { search: 'March Madness', label: 'March Madness' },
    // Baseball
    { search: 'MLB', label: 'MLB' },
    { search: 'World Series', label: 'World Series' },
    // Hockey
    { search: 'NHL', label: 'NHL' },
    { search: 'Stanley Cup', label: 'Stanley Cup' },
    // Soccer
    { search: 'Premier League', label: 'EPL' },
    { search: 'Champions League', label: 'UCL' },
    { search: 'World Cup', label: 'World Cup' },
    { search: 'MLS', label: 'MLS' },
    { search: 'La Liga', label: 'La Liga' },
    { search: 'Bundesliga', label: 'Bundesliga' },
    // Tennis
    { search: 'US Open tennis', label: 'Tennis US Open' },
    { search: 'Wimbledon', label: 'Wimbledon' },
    { search: 'French Open', label: 'French Open' },
    { search: 'Australian Open', label: 'Australian Open' },
    // Combat sports
    { search: 'UFC', label: 'UFC' },
    { search: 'boxing', label: 'Boxing' },
    // Golf
    { search: 'Masters', label: 'Masters' },
    { search: 'PGA', label: 'PGA' },
    // Racing
    { search: 'Formula 1', label: 'F1' },
    { search: 'NASCAR', label: 'NASCAR' },
    // Other
    { search: 'WNBA', label: 'WNBA' },
    { search: 'college football', label: 'CFB' },
    { search: 'college basketball', label: 'CBB' },
  ];

  const seen = new Set<string>();
  const allMarkets: KalshiMarket[] = [];

  console.log(`[v0] [KALSHI] Fetching sports markets across ${sportSearches.length} categories...`);

  // Batch into groups of 5 concurrent requests to avoid hammering the API
  const batchSize = 5;
  for (let i = 0; i < sportSearches.length; i += batchSize) {
    const batch = sportSearches.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(({ search }) => fetchKalshiMarkets({ search, limit: 100, useCache: true }))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        for (const market of result.value) {
          if (!seen.has(market.ticker)) {
            seen.add(market.ticker);
            allMarkets.push(market);
          }
        }
        console.log(`[v0] [KALSHI] ${batch[j].label}: ${result.value.length} markets`);
      } else {
        console.warn(`[v0] [KALSHI] ${batch[j].label} failed:`, result.reason);
      }
    }
  }

  console.log(`[v0] [KALSHI] Sports markets total: ${allMarkets.length} (deduplicated)`);
  return allMarkets;
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
 * Fetch Kalshi cards for a specific sport.
 * Uses title keyword search so any sport with a recognisable name will work.
 */
export async function getKalshiCardsForSport(sport: string, limit: number = 3): Promise<any[]> {
  // Map Odds-API style sport keys to human-readable Kalshi search terms
  const sportSearchMap: Record<string, string> = {
    // American football
    nfl: 'NFL',
    americanfootball_nfl: 'NFL',
    ncaaf: 'NCAAF',
    americanfootball_ncaaf: 'college football',
    // Basketball
    nba: 'NBA',
    basketball_nba: 'NBA',
    ncaab: 'NCAAB',
    basketball_ncaab: 'college basketball',
    basketball_euroleague: 'Euroleague',
    basketball_nbl: 'NBL',
    wnba: 'WNBA',
    basketball_wnba: 'WNBA',
    // Baseball
    mlb: 'MLB',
    baseball_mlb: 'MLB',
    // Hockey
    nhl: 'NHL',
    icehockey_nhl: 'NHL',
    // Soccer
    soccer_epl: 'Premier League',
    epl: 'Premier League',
    soccer_spain_la_liga: 'La Liga',
    soccer_germany_bundesliga: 'Bundesliga',
    soccer_italy_serie_a: 'Serie A',
    soccer_france_ligue_one: 'Ligue 1',
    soccer_uefa_champs_league: 'Champions League',
    soccer_usa_mls: 'MLS',
    mls: 'MLS',
    // Tennis
    tennis_atp: 'tennis',
    tennis_wta: 'tennis',
    // Combat
    mma_mixed_martial_arts: 'UFC',
    mma: 'UFC',
    boxing_boxing: 'boxing',
    boxing: 'boxing',
    // Golf
    golf_pga_championship: 'PGA',
    golf: 'PGA',
    // Racing
    f1: 'Formula 1',
    nascar: 'NASCAR',
  };

  const search = sportSearchMap[sport.toLowerCase()] ?? sport;

  const markets = await fetchKalshiMarkets({ search, limit });
  return markets.map(kalshiMarketToCard);
}
