/**
 * Unified Kalshi Prediction Markets API Client
 * Consolidated from multiple Kalshi modules
 *
 * Fetches real-time prediction market data from Kalshi API
 * API Documentation: https://trading-api.readme.io/reference/getting-started
 */

import crypto from 'crypto';
import { unstable_cache } from 'next/cache';

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

// ── Shared cross-instance cache ──────────────────────────────────────────────
// unstable_cache is shared across ALL serverless instances in the same deployment,
// unlike a module-level Map which is per-instance. This prevents the burst of
// duplicate requests that causes 429s when multiple cold-start instances fire
// simultaneously.
const KALSHI_CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Wrap a Kalshi API fetch in Next.js unstable_cache so the result is shared
 * across concurrent serverless instances.  Falls back to a direct fetch if
 * unstable_cache is unavailable (e.g. in unit tests).
 */
function withKalshiCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = KALSHI_CACHE_TTL_SECONDS,
): Promise<T> {
  try {
    return unstable_cache(fn, [key], { revalidate: ttl, tags: ['kalshi'] })();
  } catch {
    // unstable_cache unavailable outside Next.js runtime (tests, scripts)
    return fn();
  }
}

// ── Simple per-process dedup (last-resort for same-instance concurrent calls) ─
const pendingRequests = new Map<string, Promise<KalshiMarket[]>>();

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

/** Build auth headers with RSA-SHA256 signing when credentials are available */
function buildHeaders(url: string = ''): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'LeverageAI/1.0',
  };
  const keyId  = process.env.KALSHI_API_KEY_ID;
  const rawKey = process.env.KALSHI_PRIVATE_KEY?.replace(/\\n/g, '\n');
  // Wrap bare base64 in PEM headers if needed
  const privateKey = rawKey && !rawKey.includes('-----')
    ? `-----BEGIN RSA PRIVATE KEY-----\n${rawKey.match(/.{1,64}/g)?.join('\n') ?? rawKey}\n-----END RSA PRIVATE KEY-----`
    : rawKey;
  if (keyId && privateKey && url) {
    try {
      const { pathname, search } = new URL(url);
      const timestamp = Date.now().toString();
      const message   = `${timestamp}GET${pathname}${search}`;
      const sign      = crypto.createSign('RSA-SHA256');
      sign.update(message);
      sign.end();
      const signature = sign.sign(
        { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
        'base64',
      );
      headers['KALSHI-ACCESS-KEY']       = keyId;
      headers['KALSHI-ACCESS-TIMESTAMP'] = timestamp;
      headers['KALSHI-ACCESS-SIGNATURE'] = signature;
    } catch (err) {
      console.error('[KALSHI] RSA sign failed:', err);
    }
  }
  return headers;
}

/** Map cryptic Kalshi series/event tickers to human-readable category labels */
function normalizeCategoryLabel(raw: string): string {
  if (!raw) return 'Prediction Market';
  const upper = raw.toUpperCase();
  const map: Record<string, string> = {
    'KXBT': 'Crypto', 'KXBTD': 'Crypto', 'KXETH': 'Crypto',
    'NFL': 'NFL', 'NBA': 'NBA', 'MLB': 'MLB', 'NHL': 'NHL',
    'NCAAB': 'College Basketball', 'NCAAF': 'College Football',
    'NASCAR': 'NASCAR', 'PGA': 'Golf', 'F1': 'Formula 1',
    'UFC': 'MMA', 'BOXING': 'Boxing', 'WNBA': 'WNBA',
    'KXUSSENATE': 'Politics', 'KXUSHOUSE': 'Politics', 'KXUSGOV': 'Politics',
    'PRES': 'Politics', 'POTUS': 'Politics',
    'FED': 'Finance', 'KXFED': 'Finance', 'FOMC': 'Finance',
    'KXCPI': 'Finance', 'KXGDP': 'Finance', 'SP500': 'Finance',
    'KXSP': 'Finance', 'KXNQ': 'Finance',
    'WEATHER': 'Weather', 'TEMP': 'Weather', 'HURR': 'Weather',
    'OSCAR': 'Entertainment', 'GRAMMY': 'Entertainment',
    'EMMY': 'Entertainment', 'GOLDEN': 'Entertainment',
  };
  if (map[upper]) return map[upper];
  for (const [key, val] of Object.entries(map)) {
    if (upper.startsWith(key)) return val;
  }
  if (raw.length < 30 && /^[A-Za-z\s]+$/.test(raw)) {
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }
  return 'Prediction Market';
}

/** Parse a raw Kalshi market response object into a typed KalshiMarket */
function parseMarket(m: any): KalshiMarket {
  const yesBid = m.yes_bid ?? 0;
  const yesAsk = m.yes_ask ?? 0;
  const noBid  = m.no_bid  ?? 0;
  const noAsk  = m.no_ask  ?? 0;
  const lastPrice = m.last_price ?? 0;
  // previous_yes_bid is 0 when the market has never had a bid — treat that as absent
  const prevBid = m.previous_yes_bid ?? 0;

  // Best estimate for YES probability: prefer last traded price, then midpoint, then ask/bid.
  // IMPORTANT: never fall through to floor_strike — it is a numeric strike price (e.g. 45000
  // for a BTC contract), not a cents probability, and would corrupt the probability bar.
  const yesMidpoint = yesBid > 0 && yesAsk > 0 ? Math.round((yesBid + yesAsk) / 2) : 0;
  const rawYesPrice =
    lastPrice > 0   ? lastPrice   :
    yesMidpoint > 0 ? yesMidpoint :
    yesAsk > 0      ? yesAsk      :
    yesBid > 0      ? yesBid      :
    50; // genuine 50¢ default only when no price signals exist
  // Kalshi markets trade in the 1–99¢ range — clamp to prevent rendering edge-cases
  const yesPrice = Math.min(99, Math.max(1, rawYesPrice));

  const noPrice  = noBid > 0 && noAsk > 0
    ? Math.round((noBid + noAsk) / 2)
    : Math.max(0, 100 - yesPrice);

  // Safe string coercion — Kalshi occasionally returns array values for string fields;
  // take the first element when that happens, otherwise coerce to string or ''.
  const toStr = (v: unknown): string =>
    Array.isArray(v) ? String(v[0] ?? '') : typeof v === 'string' ? v : '';

  const rawCategory = toStr(m.category) || toStr(m.series_ticker) || toStr(m.event_ticker) || '';

  // yes_sub_title is a short outcome label (e.g. "yes Baylor") — never use it
  // alone as the card title. When a market lacks a proper title, combine
  // event_title + cleaned yes_sub_title so the result is still readable.
  const rawYesSub = toStr(m.yes_sub_title);
  // Strip leading "yes "/"no " prefix that Kalshi sometimes surfaces in sub_title fields
  const cleanYesSub = rawYesSub.replace(/^(yes|no)\s+/i, '').trim();
  // Guard against Kalshi concatenating multiple market sub-titles into one field
  // (e.g. "Scottie Barnes: 2+,yes Precious Achiuwa: 10+,...") — keep only the first entry.
  const singleYesSub = cleanYesSub.split(/,\s*(yes|no)\s+/i)[0].trim();

  const compositeTitle =
    toStr(m.event_title) && singleYesSub ? `${toStr(m.event_title)}: ${singleYesSub}` : '';

  // Primary title — also strip any stray "yes "/"no " prefix that leaks through
  const rawTitleFull: string = toStr(m.title) || compositeTitle || toStr(m.event_title) || toStr(m.subtitle) || '';
  // Kalshi combo markets concatenate outcomes as "Boston,yes Portland,yes Amen Thompson: 4+"
  // Split on the ",yes "/" ,no " separator and rejoin with · for a readable card title
  const titleParts = rawTitleFull.split(/,\s*(yes|no)\s+/i).filter((_, i) => i % 2 === 0).map(s => s.trim()).filter(Boolean);
  const rawTitle = titleParts.length > 1 ? titleParts.join(' · ') : rawTitleFull.trim();
  const cleanTitle = rawTitle.replace(/^(yes|no)\s+/i, '').trim();

  // Price change: only compute when previous_yes_bid is a real (non-zero) prior snapshot.
  // When prevBid === 0 the field was unset by the API (fresh market), so the delta of
  // `yesBid - 0` would falsely appear as a large positive move — guard against that.
  const priceChange = (prevBid > 0 && prevBid !== yesBid) ? yesBid - prevBid : 0;

  return {
    ticker: m.ticker || '',
    title: cleanTitle,
    category: normalizeCategoryLabel(rawCategory),
    subtitle: toStr(m.subtitle) || (singleYesSub ? `Yes: ${singleYesSub}` : '') || toStr(m.event_title) || '',
    yesPrice,
    noPrice,
    yesBid,
    yesAsk,
    noBid,
    noAsk,
    spread: Math.max(0, yesAsk - yesBid),
    lastPrice,
    volume24h: m.volume_24h ?? 0,
    eventTicker: m.event_ticker || '',
    seriesTicker: m.series_ticker || '',
    priceChange,
    volume: m.volume ?? m.volume_24h ?? 0,
    openInterest: m.open_interest ?? 0,
    closeTime: m.close_time || m.expiration_time || m.end_date || '',
    status: m.status || 'active',
  };
}

/**
 * Fetch a single page of markets with 429-aware retry logic.
 * On 429, waits with exponential backoff + jitter before retrying (up to 3 attempts).
 * Callers should use fetchKalshiMarkets (which wraps this in unstable_cache) rather
 * than calling fetchKalshiPage directly, to avoid redundant cross-instance requests.
 */
async function fetchKalshiPage(queryParams: URLSearchParams): Promise<KalshiPage> {
  const url = `${KALSHI_TRADING_URL}/markets?${queryParams}`;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await fetch(url, {
      headers: buildHeaders(url),
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 429) {
      const retryAfterSec = Number(response.headers.get('Retry-After') ?? 0);
      // Exponential backoff: 2s, 4s, 8s
      const baseDelay = retryAfterSec > 0
        ? retryAfterSec * 1000
        : Math.min(2000 * 2 ** attempt, 10000);
      const jitter = Math.random() * 1000;
      const waitMs = Math.round(baseDelay + jitter);
      const host = new URL(url).hostname;
      const errorText = await response.text().catch(() => '');
      console.error(`[KALSHI] API error 429 at ${host} — ${errorText.substring(0, 200)}`);
      if (attempt < MAX_ATTEMPTS - 1) {
        console.log(`[KALSHI] Rate limited — waiting ${waitMs}ms before retry ${attempt + 1}/${MAX_ATTEMPTS - 1}`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw new Error(`Kalshi API error: 429 Too Many Requests`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      const host = new URL(url).hostname;
      console.error(`[KALSHI] API error ${response.status} at ${host} — ${errorText.substring(0, 200)}`);
      throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.markets || !Array.isArray(data.markets)) {
      console.warn('[KALSHI] Unexpected response format, keys:', Object.keys(data).join(', '));
      return { markets: [], cursor: null };
    }

    const TICKER_RE = /^[A-Z0-9\-\.%]+$/;
    const markets = data.markets
      .map(parseMarket)
      .filter((m: KalshiMarket) => {
        if (!m.title || m.title.length < 10) return false;
        if (TICKER_RE.test(m.title)) return false;
        return true;
      });

    const cursor = data.cursor && data.cursor !== '' ? data.cursor : null;
    return { markets, cursor };
  }

  throw new Error('Kalshi endpoint failed after retries');
}

/**
 * Fetch active markets from Kalshi.
 * Results are cached via Next.js unstable_cache (shared across all serverless instances)
 * with a 5-minute TTL to prevent burst 429s on concurrent cold starts.
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
  const { category, status = 'open', limit = 200, search, cursor, useCache = true, cacheTtlMs = 300_000 } = params || {};
  const cacheKey = getCacheKey({ category, status, limit, search });
  const cacheTtlSec = Math.ceil(cacheTtlMs / 1000);

  const doFetch = async (): Promise<KalshiMarket[]> => {
    try {
      const queryParams = new URLSearchParams({
        limit: Math.min(limit, 1000).toString(),
        status,
      });

      const categorySearchMap: Record<string, string> = {
        'election': 'election', 'elections': 'election', 'politics': 'senate',
        'political': 'senate', '2026': '2026', 'president': 'president',
        'presidential': 'president', 'congress': 'congress', 'senate': 'senate',
        'house': 'house representatives', 'governor': 'governor',
        'finance': 'stock', 'financial': 'stock market', 'stocks': 'stock',
        'crypto': 'bitcoin', 'bitcoin': 'bitcoin', 'ethereum': 'ethereum',
        'interest_rate': 'interest rate', 'fed': 'federal reserve',
        'inflation': 'inflation', 'gdp': 'GDP', 'recession': 'recession',
        'unemployment': 'unemployment', 'sp500': 'S&P', 'nasdaq': 'NASDAQ',
        'economy': 'economic',
        'weather': 'temperature', 'climate': 'climate', 'hurricane': 'hurricane',
        'tornado': 'tornado', 'temperature': 'temperature', 'snow': 'snow',
        'rain': 'rainfall', 'wildfire': 'wildfire', 'earthquake': 'earthquake',
        'sports': 'game', 'nfl': 'NFL', 'nba': 'NBA', 'mlb': 'MLB',
        'nhl': 'NHL', 'soccer': 'soccer', 'mma': 'UFC', 'boxing': 'boxing',
        'golf': 'golf', 'tennis': 'tennis', 'f1': 'Formula',
        'entertainment': 'award', 'oscars': 'Oscar', 'grammys': 'Grammy',
        'emmys': 'Emmy', 'movies': 'box office', 'tv': 'ratings',
        'tech': 'technology', 'ai': 'artificial intelligence', 'spacex': 'SpaceX',
        'space': 'space', 'nasa': 'NASA',
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
      // Never cache an empty result — re-throw so unstable_cache doesn't poison future calls.
      if (meaningfulMarkets.length === 0 && !cursor) {
        throw new Error('Kalshi returned 0 markets — not caching empty result');
      }
      return meaningfulMarkets;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const cause = (err as any).cause;
      if (err.name === 'AbortError') {
        console.error('[KALSHI] ❌ Request timeout after 15s');
      } else {
        console.error(`[KALSHI] ❌ Failed to fetch markets: ${err.message}${cause ? ` (cause: ${cause.code ?? cause.message ?? cause})` : ''}`);
      }
      // Re-throw so unstable_cache does NOT store the failure — callers handle []
      throw err;
    }
  };

  // When caching is disabled or paginating, fetch directly
  if (!useCache || cursor) {
    return doFetch();
  }

  // Dedup same-instance concurrent calls while unstable_cache is resolving
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    console.log('[KALSHI] Request already in-flight, coalescing:', cacheKey);
    return pending;
  }

  const promise = withKalshiCache(cacheKey, doFetch, cacheTtlSec)
    .catch((err: Error) => {
      // doFetch throws on 429 / empty results so unstable_cache skips caching the failure.
      // Return [] to the caller so the page renders gracefully without crashing.
      console.log(`[KALSHI] Cache miss / error for key ${cacheKey}: ${err.message}`);
      return [] as KalshiMarket[];
    })
    .finally(() => {
      pendingRequests.delete(cacheKey);
    });
  pendingRequests.set(cacheKey, promise);
  return promise;
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
    // Note: full-market pagination uses the per-page unstable_cache in fetchKalshiMarkets;
    // no separate caching needed here.
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

      const msg = error instanceof Error ? error.message : String(error);
      const cause = (error as any)?.cause;
      const errCode = cause?.code ?? '';

      // 429 is already retried with backoff inside fetchKalshiPage — don't re-retry here
      if (msg.includes('429') || msg.includes('Too Many Requests')) {
        console.error('[KALSHI] Rate limit hit — not retrying at this layer');
        return [];
      }
      if (msg.includes('401') || msg.includes('Unauthorized')) {
        console.error('[KALSHI] Auth failure (401) — aborting retries');
        return [];
      }
      if (errCode === 'ENOTFOUND' || errCode === 'EAI_AGAIN' || msg.includes('ENOTFOUND')) {
        console.error('[KALSHI] DNS failure (ENOTFOUND) — aborting retries');
        return [];
      }
      // "0 markets" throw — brief backoff then retry
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
 * Uses 2 broad API calls ('sports' + 'championship') with client-side dedup,
 * down from 12 batched calls that reliably triggered 429s on concurrent cold starts.
 */
export async function fetchSportsMarkets(): Promise<KalshiMarket[]> {
  const SPORTS_KEYWORDS = ['nfl', 'nba', 'mlb', 'nhl', 'super bowl', 'world series', 'stanley cup',
    'championship', 'playoff', 'march madness', 'ncaa', 'ufc', 'formula', 'nascar',
    'golf', 'masters', 'tennis', 'soccer', 'mls', 'world cup', 'boxing'];

  console.log('[KALSHI] Fetching sports markets...');

  // Two broad searches cover the full sports catalogue; each result is unstable_cache'd
  // for 5 minutes so concurrent instances share the same HTTP response.
  const [sportsMarkets, champMarkets] = await Promise.allSettled([
    fetchKalshiMarkets({ search: 'sports', limit: 200, cacheTtlMs: 300_000 }),
    fetchKalshiMarkets({ search: 'championship', limit: 200, cacheTtlMs: 300_000 }),
  ]);

  const seen = new Set<string>();
  const allMarkets: KalshiMarket[] = [];

  for (const result of [sportsMarkets, champMarkets]) {
    if (result.status === 'fulfilled') {
      for (const market of result.value) {
        if (seen.has(market.ticker)) continue;
        seen.add(market.ticker);
        const text = `${market.title} ${market.category} ${market.subtitle}`.toLowerCase();
        if (SPORTS_KEYWORDS.some(k => text.includes(k))) {
          allMarkets.push(market);
        }
      }
    }
  }

  console.log(`[KALSHI] Sports markets total: ${allMarkets.length} (deduplicated)`);
  return allMarkets;
}

/**
 * Fetch election-related markets from Kalshi.
 * Uses a SINGLE broad API call (search: 'election') and filters client-side.
 * This is critical — multiple sequential API calls to the same serverless endpoint
 * each trigger a separate cold-start and independently burst Kalshi's rate limit.
 */
export async function fetchElectionMarkets(options?: {
  year?: number;
  limit?: number;
}): Promise<KalshiMarket[]> {
  const { year = 2026, limit = 20 } = options || {};

  console.log('[KALSHI] Fetching election markets for year:', year);

  const ELECTION_KEYWORDS = [
    'election', 'senate', 'house', 'congress', 'midterm',
    'governor', 'president', 'harris', 'trump', 'republican',
    'democrat', 'ballot', 'primary', 'gop',
  ];

  function isElectionMarket(market: KalshiMarket): boolean {
    const text = `${market.title} ${market.category} ${market.subtitle}`.toLowerCase();
    return ELECTION_KEYWORDS.some(k => text.includes(k)) || text.includes(year.toString());
  }

  // Single broad API call — client-side filtering handles subcategory matching.
  // Previously 3+ calls ('election', 'senate', 'congress') which burst 429s on
  // concurrent cold-start instances.
  const markets = await fetchKalshiMarkets({
    search: 'election',
    limit: Math.max(200, limit * 10),
    cacheTtlMs: 300_000,
  });

  const electionMarkets = markets.filter(isElectionMarket);

  console.log(`[KALSHI] Found ${electionMarkets.length} election markets for ${year}`);
  return electionMarkets.slice(0, limit);
}

/**
 * Fetch weather-related markets from Kalshi.
 * Single API call — broader client-side filtering covers all weather subcategories.
 */
export async function fetchWeatherMarkets(limit: number = 50): Promise<KalshiMarket[]> {
  const WEATHER_KEYWORDS = ['weather', 'temperature', 'hurricane', 'tornado', 'snow', 'rain', 'wildfire', 'climate', 'storm', 'flood'];

  console.log('[KALSHI] Fetching weather markets...');

  const markets = await fetchKalshiMarkets({ search: 'weather', limit: 200, cacheTtlMs: 300_000 });

  const weatherMarkets = markets.filter(m => {
    const text = `${m.title} ${m.category} ${m.subtitle}`.toLowerCase();
    return WEATHER_KEYWORDS.some(k => text.includes(k));
  });

  console.log(`[KALSHI] Weather markets total: ${weatherMarkets.length}`);
  return weatherMarkets.slice(0, limit);
}

/**
 * Fetch finance/economics markets from Kalshi
 */
export async function fetchFinanceMarkets(limit: number = 50): Promise<KalshiMarket[]> {
  // Reduced to 5 broad terms (was 14). The throttle queue serializes all API calls
  // with a 400ms minimum gap, so fewer terms = fewer requests = no 429s.
  const financeSearches = [
    'stock market',
    'bitcoin',
    'interest rate',
    'inflation',
    'economic',
  ];

  const seen = new Set<string>();
  const all: KalshiMarket[] = [];

  console.log('[KALSHI] Fetching finance markets...');

  // Sequential (not batched) — the throttle queue in fetchKalshiPage already enforces
  // 400ms between requests; running them in parallel would defeat that protection.
  for (const search of financeSearches) {
    if (all.length >= limit) break;
    try {
      const markets = await fetchKalshiMarkets({ search, limit: 50, useCache: true, cacheTtlMs: 300_000 });
      for (const market of markets) {
        if (!seen.has(market.ticker)) {
          seen.add(market.ticker);
          all.push(market);
        }
      }
    } catch {
      // Non-critical — skip this search term
    }
  }

  console.log(`[KALSHI] Finance markets total: ${all.length}`);
  return all.slice(0, limit);
}

/**
 * Fetch all markets across all categories. Returns categorized results.
 * Runs sequentially (not parallel) so the throttle queue stays effective.
 */
export async function fetchAllCategoryMarkets(): Promise<Record<string, KalshiMarket[]>> {
  console.log('[KALSHI] Fetching all category markets...');

  const safeCall = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch { return fallback; }
  };

  const sports    = await safeCall(() => fetchSportsMarkets(),              []);
  const elections = await safeCall(() => fetchElectionMarkets({ limit: 50 }), []);
  const weather   = await safeCall(() => fetchWeatherMarkets(),             []);
  const finance   = await safeCall(() => fetchFinanceMarkets(),             []);

  const result: Record<string, KalshiMarket[]> = { sports, elections, weather, finance };
  const total = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`[KALSHI] All categories total: ${total} markets`);

  return result;
}

/**
 * Get market by ticker
 */
export async function getMarketByTicker(ticker: string): Promise<KalshiMarket | null> {
  try {
    const marketUrl = `${KALSHI_TRADING_URL}/markets/${ticker}`;
    const response = await fetch(marketUrl, {
      headers: buildHeaders(marketUrl),
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
    const orderbookUrl = `${KALSHI_TRADING_URL}/markets/${ticker}/orderbook`;
    const response = await fetch(orderbookUrl, {
      headers: buildHeaders(orderbookUrl),
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
    const tradesUrl = `${KALSHI_TRADING_URL}/markets/${ticker}/trades?${params}`;
    const response = await fetch(tradesUrl, {
      headers: buildHeaders(tradesUrl),
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

    const eventsUrl = `${KALSHI_TRADING_URL}/events?${qp}`;
    const response = await fetch(eventsUrl, {
      headers: buildHeaders(eventsUrl),
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
export function kalshiMarketToCard(
  market: KalshiMarket,
  orderbook?: {
    yesBids: Array<{ price: number; quantity: number }>;
    yesAsks: Array<{ price: number; quantity: number }>;
  } | null
): any {
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
      // Formatted display strings — volumes are in contracts, not dollars, so no $ prefix
      yesPrice: `${yesPct}¢`,
      noPrice: `${noPct}¢`,
      impliedProbability: `${yesPct.toFixed(1)}%`,
      volume: market.volume >= 1_000_000
        ? `${(market.volume / 1_000_000).toFixed(1)}M`
        : market.volume >= 1_000
        ? `${(market.volume / 1_000).toFixed(0)}K`
        : market.volume > 0 ? `${market.volume}` : '—',
      volume24h: market.volume24h >= 1_000_000
        ? `${(market.volume24h / 1_000_000).toFixed(1)}M`
        : market.volume24h >= 1_000
        ? `${(market.volume24h / 1_000).toFixed(0)}K`
        : market.volume24h > 0 ? `${market.volume24h}` : '',
      openInterest: market.openInterest >= 1_000_000
        ? `${(market.openInterest / 1_000_000).toFixed(1)}M`
        : market.openInterest >= 1_000
        ? `${(market.openInterest / 1_000).toFixed(0)}K`
        : market.openInterest > 0 ? `${market.openInterest}` : '—',
      closeTime: market.closeTime
        ? new Date(market.closeTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'TBD',
      expiresLabel,
      expiryUrgency,
      volumeTier,
      isHot: market.volume24h >= 50_000 || market.volume >= 500_000,
      recommendation: signal,
      // Event/series metadata
      eventTicker: market.eventTicker,
      seriesTicker: market.seriesTicker,
      // Level 2 orderbook depth (null when not fetched)
      orderbookBids: orderbook?.yesBids?.slice(0, 5) ?? null,
      orderbookAsks: orderbook?.yesAsks?.slice(0, 5) ?? null,
    },
    status: market.status === 'open' ? 'active' : 'closed',
    realData: true,
  };
}

// ============================================================================
// Kalshi Volatility Analysis
// ============================================================================

export interface KalshiVolatilityInput {
  ticker: string;
  title: string;
  yesPrice: number;     // Current yes price (0–100 cents)
  noPrice: number;      // Current no price (0–100 cents)
  volume24h?: number;
  spread?: number;
  priceChange?: number;
  closeTime?: string;
}

export interface KalshiAnalysis {
  ticker: string;
  title: string;
  impliedProbability: number;   // yesPrice / 100
  modelProbability: number;     // Provided by caller
  edge: number;                 // modelProbability - impliedProbability
  signal: 'YES' | 'NO' | 'PASS';
  confidence: number;           // 0–100
  spreadPct: number;            // spread as % of midpoint
  isLiquid: boolean;
  recommendation: string;
}

/**
 * Analyze a Kalshi prediction market for edge vs a model probability.
 * Returns a buy/pass signal and confidence score.
 */
export function analyzeKalshiVolatility(
  market: KalshiVolatilityInput,
  modelProbability: number,
): KalshiAnalysis {
  const impliedProbability = market.yesPrice / 100;
  const edge = modelProbability - impliedProbability;

  const spread = market.spread ?? (market.noPrice - (100 - market.yesPrice));
  const midpoint = market.yesPrice;
  const spreadPct = midpoint > 0 ? Math.abs(spread) / midpoint : 1;
  const isLiquid = spreadPct < 0.1 && (market.volume24h ?? 0) > 1000;

  // Confidence: penalize illiquid markets and small edges
  const edgeConfidence = Math.min(100, Math.abs(edge) * 200);
  const liquidityPenalty = isLiquid ? 0 : 20;
  const confidence = Math.max(0, Math.round(edgeConfidence - liquidityPenalty));

  let signal: 'YES' | 'NO' | 'PASS';
  if (Math.abs(edge) < 0.03 || !isLiquid) {
    signal = 'PASS';
  } else if (edge > 0) {
    signal = 'YES';
  } else {
    signal = 'NO';
  }

  const recommendation =
    signal === 'PASS'
      ? `No edge — spread too wide or model close to market (edge: ${(edge * 100).toFixed(1)}¢)`
      : signal === 'YES'
      ? `Buy YES — model (${(modelProbability * 100).toFixed(1)}%) > implied (${market.yesPrice}¢)`
      : `Buy NO — model (${(modelProbability * 100).toFixed(1)}%) < implied (${market.yesPrice}¢)`;

  return {
    ticker: market.ticker,
    title: market.title,
    impliedProbability,
    modelProbability,
    edge,
    signal,
    confidence,
    spreadPct,
    isLiquid,
    recommendation,
  };
}
