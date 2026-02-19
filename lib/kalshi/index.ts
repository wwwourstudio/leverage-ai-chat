/**
 * Unified Kalshi Prediction Markets API Client
 * Consolidated from multiple Kalshi modules
 *
 * Fetches real-time prediction market data from Kalshi API
 * API Documentation: https://trading-api.readme.io/reference/getting-started
 */

const KALSHI_TRADING_URL = 'https://trading-api.kalshi.com/trade-api/v2';

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

interface KalshiPage {
  markets: KalshiMarket[];
  cursor: string | null;
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
  return `kalshi:${category || 'all'}:${status || 'open'}:${limit || 200}:${search || ''}`;
}

/**
 * Get cached markets if available and not expired
 */
function getCachedMarkets(cacheKey: string): KalshiMarket[] | null {
  const cached = marketCache.get(cacheKey);

  if (!cached) return null;

  const now = Date.now();
  if ((now - cached.timestamp) > cached.ttl) {
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
    ttl: ttlMs,
  });
  console.log(`[KALSHI] Cached ${markets.length} markets with ${ttlMs / 1000}s TTL`);
}

/** Build auth headers, attaching the API key when available */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'LeverageAI/1.0',
  };
  const key = process.env.KALSHI_API_KEY;
  if (key) headers['Authorization'] = `Bearer ${key}`;
  return headers;
}

/** Parse a raw Kalshi market response object into a typed KalshiMarket */
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
 * Fetch a single page of markets.
 * Tries the main trading API first; falls back to the elections mirror.
 * Returns parsed markets and the next cursor (null when done).
 */
async function fetchKalshiPage(queryParams: URLSearchParams): Promise<KalshiPage> {
  const response = await fetch(`${KALSHI_TRADING_URL}/markets?${queryParams}`, {
    headers: buildHeaders(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const hasKey = !!process.env.KALSHI_API_KEY;
    console.error(`[KALSHI] API error ${response.status} ${response.statusText} (KALSHI_API_KEY set: ${hasKey}) — ${errorText.substring(0, 200)}`);
    throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.markets || !Array.isArray(data.markets)) {
    console.warn('[KALSHI] Unexpected response format, keys:', Object.keys(data).join(', '));
    return { markets: [], cursor: null };
  }

  const markets = data.markets
    .map(parseMarket)
    .filter((m: KalshiMarket) => m.title && m.title.length > 5);

  const cursor = data.cursor && data.cursor !== '' ? data.cursor : null;
  return { markets, cursor };
}

/**
 * Fetch active markets from Kalshi.
 *
 * Supports keyword title searches:
 * - 'election' → election markets
 * - 'politics' → political markets
 * - 'NFL', 'NBA', 'MLB', 'NHL' → sport markets
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
      console.log('[KALSHI] Returning cached markets');
      return cached;
    }
    console.log('[KALSHI] Cache miss, fetching from API...');
  }

  try {
    const queryParams = new URLSearchParams({
      limit: Math.min(limit, 1000).toString(),
      status,
    });

    // Use title keyword search (series_ticker expects exact IDs like "KXBT", not names)
    const categorySearchMap: Record<string, string> = {
      'election': 'election',
      'elections': 'election',
      'politics': 'senate',
      'political': 'senate',
      '2026': '2026',
      'president': 'president',
      'presidential': 'president',
    };

    if (category) {
      const titleSearch = categorySearchMap[category.toLowerCase()] ?? category;
      queryParams.append('title', titleSearch);
    }
    if (search) {
      queryParams.set('title', search);
    }
    if (cursor) {
      queryParams.append('cursor', cursor);
    }

    console.log('[KALSHI] Fetching markets — params:', { category, status, limit, search, cursor: !!cursor });

    const { markets: meaningfulMarkets } = await fetchKalshiPage(queryParams);

    console.log(`[KALSHI] Fetched ${meaningfulMarkets.length} meaningful markets`);

    if (useCache && !cursor && meaningfulMarkets.length > 0) {
      const cacheKey = getCacheKey({ category, status, limit, search });
      cacheMarkets(cacheKey, meaningfulMarkets, cacheTtlMs);
    }

    return meaningfulMarkets;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[KALSHI] ❌ Request timeout after 10s');
    } else {
      console.error('[KALSHI] ❌ Failed to fetch markets:', error instanceof Error ? error.message : error);
    }
    return [];
  }
}

/**
 * Fetch ALL open Kalshi markets across every category using cursor-based pagination.
 * Pages through until the API signals done or maxMarkets is reached.
 * Default cap: 2000 markets.
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
      console.log(`[KALSHI] All-markets cache hit: ${cached.length} markets`);
      return cached;
    }
  }

  console.log(`[KALSHI] Fetching ALL markets (cap: ${maxMarkets})...`);

  const all: KalshiMarket[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  let page = 0;

  do {
    page++;
    const queryParams = new URLSearchParams({ limit: '1000', status });
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
      console.log(`[KALSHI] Page ${page}: +${markets.length} (total: ${all.length}), more: ${cursor ? 'yes' : 'no'}`);
    } catch (err) {
      console.error(`[KALSHI] Pagination error on page ${page}:`, err instanceof Error ? err.message : err);
      break;
    }
  } while (cursor && all.length < maxMarkets);

  const categories = [...new Set(all.map(m => m.category))].filter(Boolean);
  console.log(`[KALSHI] Done — ${all.length} markets, ${categories.length} categories: ${categories.slice(0, 15).join(', ')}`);

  if (useCache && all.length > 0) {
    cacheMarkets(cacheKey, all, 120000); // 2-min cache for full fetch
  }

  return all;
}

/**
 * Fetch Kalshi markets with retry logic and exponential backoff.
 * For fetching all markets, prefer fetchAllKalshiMarkets() instead.
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
 * Fetch sports-related markets from Kalshi.
 * Searches across all supported sports using keyword title searches, deduplicated by ticker.
 */
export async function fetchSportsMarkets(): Promise<KalshiMarket[]> {
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
    { search: 'US Open tennis', label: 'US Open' },
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

  console.log(`[KALSHI] Fetching sports markets across ${sportSearches.length} categories...`);

  // Batch into groups of 5 concurrent requests
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
        console.log(`[KALSHI] ${batch[j].label}: ${result.value.length} markets`);
      } else {
        console.warn(`[KALSHI] ${batch[j].label} failed:`, result.reason);
      }
    }
  }

  console.log(`[KALSHI] Sports markets total: ${allMarkets.length} (deduplicated)`);
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

    if (allMarkets.length >= limit) break;
  }

  const electionMarkets = allMarkets.filter(market => {
    const text = `${market.title} ${market.category} ${market.subtitle}`.toLowerCase();
    const isElection = text.includes('election') ||
                       text.includes('president') ||
                       text.includes('harris') ||
                       text.includes('trump');
    const isCorrectYear = text.includes(year.toString());
    const isH2H = includeH2H ? text.includes('h2h') || text.includes('vs') : true;
    return isElection && (isCorrectYear || (includeH2H && isH2H));
  });

  console.log(`[KALSHI] Found ${electionMarkets.length} election markets for ${year}`);
  return electionMarkets.slice(0, limit);
}

/**
 * Get market by ticker
 */
export async function getMarketByTicker(ticker: string): Promise<KalshiMarket | null> {
  try {
    const response = await fetch(`${KALSHI_API_BASE_URL}/markets/${ticker}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) throw new Error(`Kalshi API error: ${response.status}`);

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
      },
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
