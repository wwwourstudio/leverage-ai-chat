/**
 * Unified Kalshi Prediction Markets API Client
 * Consolidated from multiple Kalshi modules
 *
 * Fetches real-time prediction market data from Kalshi API
 * API Documentation: https://trading-api.readme.io/reference/getting-started
 */

const KALSHI_TRADING_URL = 'https://api.elections.kalshi.com/trade-api/v2';

export interface KalshiMarket {
  ticker: string;
  title: string;
  category: string;
  subtitle: string;
  yesPrice: number;
  noPrice: number;
  // Bid/ask order book data (0-100 cents)
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  spread: number;       // yesAsk - yesBid
  lastPrice: number;    // last traded price
  volume24h: number;    // 24-hour rolling volume
  eventTicker: string;  // parent event ticker
  seriesTicker: string; // series/league ticker
  priceChange: number;  // change vs previous_yes_bid
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
  const yesBid = m.yes_bid ?? 0;
  const yesAsk = m.yes_ask ?? yesBid;
  const noBid  = m.no_bid  ?? 0;
  const noAsk  = m.no_ask  ?? noBid;
  const lastPrice = m.last_price ?? 0;
  const prevBid = m.previous_yes_bid ?? yesBid;
  return {
    ticker: m.ticker || '',
    title: m.title || m.event_title || m.yes_sub_title || m.subtitle || '',
    category: m.category || m.series_ticker || m.event_ticker || '',
    subtitle: m.subtitle || m.yes_sub_title || '',
    yesPrice: yesBid || yesAsk || lastPrice || m.floor_strike || 0,
    noPrice: noBid || noAsk || (lastPrice ? (100 - lastPrice) : 100),
    yesBid,
    yesAsk,
    noBid,
    noAsk,
    spread: Math.max(0, yesAsk - yesBid),
    lastPrice,
    volume24h: m.volume_24h ?? 0,
    eventTicker: m.event_ticker || '',
    seriesTicker: m.series_ticker || '',
    priceChange: yesBid - prevBid,
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
      // Elections & Politics
      'election': 'election', 'elections': 'election', 'politics': 'senate',
      'political': 'senate', '2026': '2026', 'president': 'president',
      'presidential': 'president', 'congress': 'congress', 'senate': 'senate',
      'house': 'house representatives', 'governor': 'governor',
      // Finance & Economics
      'finance': 'stock', 'financial': 'stock market', 'stocks': 'stock',
      'crypto': 'bitcoin', 'bitcoin': 'bitcoin', 'ethereum': 'ethereum',
      'interest_rate': 'interest rate', 'fed': 'federal reserve',
      'inflation': 'inflation', 'gdp': 'GDP', 'recession': 'recession',
      'unemployment': 'unemployment', 'sp500': 'S&P', 'nasdaq': 'NASDAQ',
      'economy': 'economic',
      // Weather & Climate
      'weather': 'temperature', 'climate': 'climate', 'hurricane': 'hurricane',
      'tornado': 'tornado', 'temperature': 'temperature', 'snow': 'snow',
      'rain': 'rainfall', 'wildfire': 'wildfire', 'earthquake': 'earthquake',
      // Sports
      'sports': 'game', 'nfl': 'NFL', 'nba': 'NBA', 'mlb': 'MLB',
      'nhl': 'NHL', 'soccer': 'soccer', 'mma': 'UFC', 'boxing': 'boxing',
      'golf': 'golf', 'tennis': 'tennis', 'f1': 'Formula',
      // Entertainment & Culture
      'entertainment': 'award', 'oscars': 'Oscar', 'grammys': 'Grammy',
      'emmys': 'Emmy', 'movies': 'box office', 'tv': 'ratings',
      // Tech & Science
      'tech': 'technology', 'ai': 'artificial intelligence', 'spacex': 'SpaceX',
      'space': 'space', 'nasa': 'NASA',
      // Global Events
      'war': 'conflict', 'global': 'global', 'china': 'China', 'russia': 'Russia',
      'ukraine': 'Ukraine', 'trade': 'trade', 'tariff': 'tariff',
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
 * Fetch weather-related markets from Kalshi
 */
export async function fetchWeatherMarkets(limit: number = 50): Promise<KalshiMarket[]> {
  const weatherSearches = [
    'temperature', 'hurricane', 'tornado', 'snow', 'rainfall',
    'wildfire', 'earthquake', 'climate', 'weather',
  ];

  const seen = new Set<string>();
  const all: KalshiMarket[] = [];

  console.log('[KALSHI] Fetching weather markets...');

  const results = await Promise.allSettled(
    weatherSearches.map(search => fetchKalshiMarkets({ search, limit: 50, useCache: true }))
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const market of result.value) {
        if (!seen.has(market.ticker)) {
          seen.add(market.ticker);
          all.push(market);
        }
      }
    }
  }

  console.log(`[KALSHI] Weather markets total: ${all.length}`);
  return all.slice(0, limit);
}

/**
 * Fetch finance/economics markets from Kalshi
 */
export async function fetchFinanceMarkets(limit: number = 50): Promise<KalshiMarket[]> {
  const financeSearches = [
    'stock', 'S&P', 'NASDAQ', 'bitcoin', 'ethereum', 'crypto',
    'interest rate', 'federal reserve', 'inflation', 'GDP',
    'recession', 'unemployment', 'economic', 'treasury',
  ];

  const seen = new Set<string>();
  const all: KalshiMarket[] = [];

  console.log('[KALSHI] Fetching finance markets...');

  const batchSize = 5;
  for (let i = 0; i < financeSearches.length; i += batchSize) {
    const batch = financeSearches.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(search => fetchKalshiMarkets({ search, limit: 50, useCache: true }))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const market of result.value) {
          if (!seen.has(market.ticker)) {
            seen.add(market.ticker);
            all.push(market);
          }
        }
      }
    }
  }

  console.log(`[KALSHI] Finance markets total: ${all.length}`);
  return all.slice(0, limit);
}

/**
 * Fetch all markets across all categories. Returns categorized results.
 */
export async function fetchAllCategoryMarkets(): Promise<Record<string, KalshiMarket[]>> {
  console.log('[KALSHI] Fetching all category markets...');

  const [sports, elections, weather, finance] = await Promise.allSettled([
    fetchSportsMarkets(),
    fetchElectionMarkets({ limit: 50 }),
    fetchWeatherMarkets(),
    fetchFinanceMarkets(),
  ]);

  const result: Record<string, KalshiMarket[]> = {
    sports: sports.status === 'fulfilled' ? sports.value : [],
    elections: elections.status === 'fulfilled' ? elections.value : [],
    weather: weather.status === 'fulfilled' ? weather.value : [],
    finance: finance.status === 'fulfilled' ? finance.value : [],
  };

  const total = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`[KALSHI] All categories total: ${total} markets`);

  return result;
}

/**
 * Get market by ticker
 */
export async function getMarketByTicker(ticker: string): Promise<KalshiMarket | null> {
  try {
    const response = await fetch(`${KALSHI_TRADING_URL}/markets/${ticker}`, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`Kalshi API error: ${response.status}`);

    const data = await response.json();
    const m = data.market;

    return parseMarket(m);
  } catch (error) {
    console.error(`[KALSHI] Failed to fetch market ${ticker}:`, error);
    return null;
  }
}

/**
 * Fetch the level-2 order book for a specific market.
 * Returns yes/no bids and asks at each price level.
 */
export async function fetchMarketOrderbook(ticker: string): Promise<{
  yesBids: Array<{ price: number; quantity: number }>;
  yesAsks: Array<{ price: number; quantity: number }>;
  noBids: Array<{ price: number; quantity: number }>;
  noAsks: Array<{ price: number; quantity: number }>;
} | null> {
  try {
    const response = await fetch(`${KALSHI_TRADING_URL}/markets/${ticker}/orderbook`, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const ob = data.orderbook || {};
    const toLevel = (arr: any[] = []) => arr.map((l: any) => ({ price: l[0] ?? 0, quantity: l[1] ?? 0 }));
    return {
      yesBids: toLevel(ob.yes),
      yesAsks: toLevel(ob.yes_ask || []),
      noBids: toLevel(ob.no),
      noAsks: toLevel(ob.no_ask || []),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch recent trades / candlestick-style price history for a market.
 * Returns an array of { ts, price, count } entries.
 */
export async function fetchMarketTrades(
  ticker: string,
  limit: number = 100,
): Promise<Array<{ ts: string; price: number; count: number }>> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await fetch(`${KALSHI_TRADING_URL}/markets/${ticker}/trades?${params}`, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const trades: any[] = data.trades || [];
    return trades.map((t: any) => ({
      ts: t.created_time || t.ts || '',
      price: t.yes_price ?? t.price ?? 0,
      count: t.count ?? 1,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch Kalshi events (grouped market containers).
 * Events wrap multiple binary markets (e.g. "2026 Midterms" → many district markets).
 */
export async function fetchKalshiEvents(params?: {
  status?: string;
  limit?: number;
  search?: string;
  series_ticker?: string;
}): Promise<Array<{ eventTicker: string; title: string; category: string; markets: number }>> {
  try {
    const qp = new URLSearchParams({ limit: String(params?.limit ?? 100) });
    if (params?.status) qp.set('status', params.status);
    if (params?.search) qp.set('title', params.search);
    if (params?.series_ticker) qp.set('series_ticker', params.series_ticker);

    const response = await fetch(`${KALSHI_TRADING_URL}/events?${qp}`, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const events: any[] = data.events || [];
    return events.map((e: any) => ({
      eventTicker: e.event_ticker || e.ticker || '',
      title: e.title || e.event_title || '',
      category: e.category || e.series_ticker || '',
      markets: e.markets?.length ?? e.num_markets ?? 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Return the top N Kalshi markets by volume (across all open markets).
 * Fetches a broader set and sorts client-side.
 */
export async function fetchTopMarketsByVolume(
  n: number = 10,
  status: 'open' | 'closed' = 'open',
): Promise<KalshiMarket[]> {
  const markets = await fetchKalshiMarketsWithRetry({ status, limit: Math.max(n * 5, 200), maxRetries: 2 });
  return markets
    .sort((a, b) => (b.volume24h || b.volume) - (a.volume24h || a.volume))
    .slice(0, n);
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
 * Derive a gradient and icon label based on Kalshi market category
 */
function kalshiCategoryMeta(category: string): { gradient: string; iconLabel: string } {
  const cat = (category || '').toLowerCase();
  if (cat.includes('election') || cat.includes('politic') || cat.includes('senate') || cat.includes('president') || cat.includes('congress')) {
    return { gradient: 'from-blue-600 to-indigo-700', iconLabel: 'election' };
  }
  if (cat.includes('nfl') || cat.includes('nba') || cat.includes('mlb') || cat.includes('nhl') || cat.includes('sport') || cat.includes('game') || cat.includes('ufc') || cat.includes('soccer') || cat.includes('golf') || cat.includes('tennis')) {
    return { gradient: 'from-green-600 to-emerald-700', iconLabel: 'sports' };
  }
  if (cat.includes('weather') || cat.includes('temp') || cat.includes('hurricane') || cat.includes('tornado') || cat.includes('snow') || cat.includes('rain')) {
    return { gradient: 'from-sky-600 to-cyan-700', iconLabel: 'weather' };
  }
  if (cat.includes('stock') || cat.includes('crypto') || cat.includes('bitcoin') || cat.includes('rate') || cat.includes('inflation') || cat.includes('gdp') || cat.includes('nasdaq') || cat.includes('sp500') || cat.includes('fed')) {
    return { gradient: 'from-amber-600 to-orange-700', iconLabel: 'finance' };
  }
  if (cat.includes('oscar') || cat.includes('grammy') || cat.includes('emmy') || cat.includes('award') || cat.includes('box office')) {
    return { gradient: 'from-fuchsia-600 to-pink-700', iconLabel: 'entertainment' };
  }
  if (cat.includes('tech') || cat.includes('ai') || cat.includes('space') || cat.includes('nasa') || cat.includes('spacex')) {
    return { gradient: 'from-violet-600 to-purple-700', iconLabel: 'tech' };
  }
  return { gradient: 'from-purple-600 to-indigo-700', iconLabel: 'market' };
}

/**
 * Convert Kalshi market to insight card format (enhanced)
 */
export function kalshiMarketToCard(market: KalshiMarket): any {
  const yesPct = Math.min(100, Math.max(0, market.yesPrice));  // 0-100 cents = 0-100%
  const noPct = Math.min(100, Math.max(0, market.noPrice));
  const { gradient, iconLabel } = kalshiCategoryMeta(market.category);

  // Edge score: how far from 50/50 (0 = efficient, 100 = max edge)
  const edgeScore = Math.round(Math.abs(yesPct - 50) * 2);

  // Recommendation based on probability
  const signal =
    yesPct >= 75 ? 'Strong YES signal'
    : yesPct >= 60 ? 'Lean YES'
    : yesPct <= 25 ? 'Strong NO signal'
    : yesPct <= 40 ? 'Lean NO'
    : 'Market is efficient (near 50/50)';

  // Time to close
  let expiresLabel = '';
  if (market.closeTime) {
    const ms = new Date(market.closeTime).getTime() - Date.now();
    const days = Math.floor(ms / 86400000);
    expiresLabel = days > 1 ? `${days}d` : days === 1 ? '1d' : ms > 0 ? '<24h' : 'Closed';
  }

  // Volume tier
  const volumeTier =
    market.volume >= 1_000_000 ? 'Deep'
    : market.volume >= 100_000 ? 'Active'
    : market.volume >= 10_000 ? 'Moderate'
    : 'Thin';

  // Expiry urgency for color coding
  const expiryUrgency = (() => {
    if (!market.closeTime) return 'none';
    const days = (new Date(market.closeTime).getTime() - Date.now()) / 86400000;
    return days < 1 ? 'critical' : days < 3 ? 'urgent' : days < 7 ? 'soon' : 'normal';
  })();

  // Spread label
  const spreadLabel =
    market.spread <= 1 ? 'Tight' :
    market.spread <= 4 ? 'Normal' : 'Wide';

  // Price change direction
  const priceDirection =
    market.priceChange > 0 ? 'up' :
    market.priceChange < 0 ? 'down' : 'flat';

  return {
    type: 'kalshi-market',
    title: market.title,
    icon: 'TrendingUp',
    category: 'KALSHI',
    subcategory: market.category || 'Prediction Market',
    gradient,
    data: {
      ticker: market.ticker,
      subtitle: market.subtitle,
      iconLabel,
      // Raw numbers for gauge rendering
      yesPct,
      noPct,
      edgeScore,
      // Order book (bid/ask) raw values in cents 0-100
      yesBid: market.yesBid,
      yesAsk: market.yesAsk,
      noBid: market.noBid,
      noAsk: market.noAsk,
      spread: market.spread,
      spreadLabel,
      // Price movement
      lastPrice: market.lastPrice,
      priceChange: market.priceChange,
      priceDirection,
      // Formatted display strings
      yesPrice: `${yesPct}¢`,
      noPrice: `${noPct}¢`,
      impliedProbability: `${yesPct.toFixed(1)}%`,
      volume: market.volume >= 1_000_000
        ? `$${(market.volume / 1_000_000).toFixed(1)}M`
        : market.volume >= 1_000
        ? `$${(market.volume / 1_000).toFixed(0)}K`
        : `$${market.volume}`,
      volume24h: market.volume24h >= 1_000_000
        ? `$${(market.volume24h / 1_000_000).toFixed(1)}M`
        : market.volume24h >= 1_000
        ? `$${(market.volume24h / 1_000).toFixed(0)}K`
        : market.volume24h > 0 ? `$${market.volume24h}` : '',
      openInterest: market.openInterest >= 1_000_000
        ? `$${(market.openInterest / 1_000_000).toFixed(1)}M`
        : market.openInterest >= 1_000
        ? `$${(market.openInterest / 1_000).toFixed(0)}K`
        : `$${market.openInterest}`,
      closeTime: market.closeTime
        ? new Date(market.closeTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'TBD',
      expiresLabel,
      expiryUrgency,
      volumeTier,
      recommendation: signal,
      // Event/series metadata
      eventTicker: market.eventTicker,
      seriesTicker: market.seriesTicker,
    },
    status: market.status === 'open' ? 'active' : 'closed',
    realData: true,
  };
}
