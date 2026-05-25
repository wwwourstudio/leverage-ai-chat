/**
 * Kalshi Prediction Markets — Data Client
 *
 * Fetches read-only market data from api.elections.kalshi.com/trade-api/v2.
 * For authenticated trading (orders, portfolio) use lib/kalshi/kalshiClient.ts.
 *
 * Key design:
 *  - One shared market pool per Lambda instance (fetched once, cached 60 s)
 *  - All topic filtering (sports / politics / weather / finance / culture) is
 *    client-side — the Kalshi v2 API silently ignores search/category params
 *  - Politics uses direct series_ticker queries (that param IS supported)
 *  - No fake fallback URL — there is only one Kalshi endpoint
 */

import crypto from 'crypto';

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.KALSHI_ENV === 'demo'
  ? 'https://demo-api.kalshi.co/trade-api/v2'
  : 'https://api.elections.kalshi.com/trade-api/v2';

const FETCH_TIMEOUT_MS  = 15_000;
const POOL_CACHE_TTL_MS = 60_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KalshiMarket {
  ticker: string;
  title: string;
  category: string;
  subtitle: string;
  yesPrice: number;
  noPrice: number;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  spread: number;
  lastPrice: number;
  volume24h: number;
  eventTicker: string;
  seriesTicker: string;
  priceChange: number;
  volume: number;
  openInterest: number;
  closeTime: string;
  status: string;
  priceIsReal: boolean;
}

export interface KalshiVolatilityInput {
  ticker: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  volume24h?: number;
  spread?: number;
  priceChange?: number;
  closeTime?: string;
}

export interface KalshiAnalysis {
  ticker: string;
  title: string;
  impliedProbability: number;
  modelProbability: number;
  edge: number;
  signal: 'YES' | 'NO' | 'PASS';
  confidence: number;
  spreadPct: number;
  isLiquid: boolean;
  recommendation: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function buildHeaders(url: string, method = 'GET'): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'LeverageAI/1.0',
  };

  const keyId = process.env.KALSHI_ACCESS_KEY || process.env.KALSHI_API_KEY_ID;
  const rawKey = process.env.KALSHI_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const privateKey = rawKey && !rawKey.includes('-----')
    ? `-----BEGIN RSA PRIVATE KEY-----\n${rawKey.match(/.{1,64}/g)?.join('\n') ?? rawKey}\n-----END RSA PRIVATE KEY-----`
    : rawKey;

  if (keyId && privateKey) {
    try {
      const ts = Date.now().toString();
      const { pathname } = new URL(url);
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(`${ts}${method.toUpperCase()}${pathname}`);
      sign.end();
      headers['KALSHI-ACCESS-KEY']       = keyId;
      headers['KALSHI-ACCESS-TIMESTAMP'] = ts;
      headers['KALSHI-ACCESS-SIGNATURE'] = sign.sign(
        { key: privateKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
        'base64',
      );
    } catch (err) {
      console.error('[KALSHI] RSA sign failed:', err instanceof Error ? err.message : err);
    }
  } else if (process.env.KALSHI_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.KALSHI_API_KEY}`;
  }

  return headers;
}

// ── Parsing ───────────────────────────────────────────────────────────────────

function parseCents(str: string | undefined | null, fallback: number): number {
  if (str != null && str !== '') {
    const v = parseFloat(str);
    if (Number.isFinite(v) && v > 0) return Math.round(v * 100);
  }
  return fallback;
}

function parseFp(str: string | undefined | null, fallback: number): number {
  if (str != null && str !== '') {
    const v = parseFloat(str);
    if (Number.isFinite(v) && v > 0) return Math.round(v);
  }
  return fallback;
}

const CATEGORY_MAP: Record<string, string> = {
  KXBT: 'Crypto', KXBTD: 'Crypto', KXETH: 'Crypto',
  NFL: 'NFL', NBA: 'NBA', MLB: 'MLB', NHL: 'NHL',
  NCAAB: 'College Basketball', NCAAF: 'College Football',
  NASCAR: 'NASCAR', PGA: 'Golf', F1: 'Formula 1',
  UFC: 'MMA', BOXING: 'Boxing', WNBA: 'WNBA',
  KXUSSENATE: 'Politics', KXUSHOUSE: 'Politics', KXUSGOV: 'Politics',
  PRES: 'Politics', POTUS: 'Politics',
  FED: 'Finance', KXFED: 'Finance', FOMC: 'Finance',
  KXCPI: 'Finance', KXGDP: 'Finance', SP500: 'Finance',
  KXSP: 'Finance', KXNQ: 'Finance',
  WEATHER: 'Weather', TEMP: 'Weather', HURR: 'Weather',
  OSCAR: 'Entertainment', GRAMMY: 'Entertainment',
  EMMY: 'Entertainment', GOLDEN: 'Entertainment',
};

function normalizeCategoryLabel(raw: string): string {
  if (!raw) return 'Prediction Market';
  const upper = raw.toUpperCase();
  if (CATEGORY_MAP[upper]) return CATEGORY_MAP[upper];
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (upper.startsWith(key)) return val;
  }
  if (raw.length < 30 && /^[A-Za-z\s]+$/.test(raw)) {
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }
  return 'Prediction Market';
}

function parseMarket(m: any): KalshiMarket {
  const yesBid    = parseCents(m.yes_bid_dollars,          m.yes_bid          ?? 0);
  const yesAsk    = parseCents(m.yes_ask_dollars,          m.yes_ask          ?? 0);
  const noBid     = parseCents(m.no_bid_dollars,           m.no_bid           ?? 0);
  const noAsk     = parseCents(m.no_ask_dollars,           m.no_ask           ?? 0);
  const lastPrice = parseCents(m.last_price_dollars,       m.last_price       ?? 0);
  const prevBid   = parseCents(m.previous_yes_bid_dollars, m.previous_yes_bid ?? 0);

  const yesMid    = yesBid > 0 && yesAsk > 0 ? Math.round((yesBid + yesAsk) / 2) : 0;
  const rawYes    = lastPrice > 0 ? lastPrice : yesMid > 0 ? yesMid : yesAsk > 0 ? yesAsk : yesBid > 0 ? yesBid : 50;
  const yesPrice  = Math.min(99, Math.max(1, rawYes));
  const noPrice   = noBid > 0 && noAsk > 0 ? Math.round((noBid + noAsk) / 2) : Math.max(0, 100 - yesPrice);

  const toStr = (v: unknown): string =>
    Array.isArray(v) ? String(v[0] ?? '') : typeof v === 'string' ? v : '';

  const rawCategory  = toStr(m.category) || toStr(m.series_ticker) || toStr(m.event_ticker) || '';
  const rawYesSub    = toStr(m.yes_sub_title).replace(/^(yes|no)\s+/i, '').trim();
  const singleYesSub = rawYesSub.split(/,\s*(yes|no)\s+/i)[0].trim();
  const composite    = toStr(m.event_title) && singleYesSub ? `${toStr(m.event_title)}: ${singleYesSub}` : '';
  const rawFull      = toStr(m.title) || composite || toStr(m.event_title) || toStr(m.subtitle) || '';
  // Kalshi combo markets concatenate outcomes with ",yes "/",no " — split and rejoin with ·
  const parts        = rawFull.split(/,\s*(yes|no)\s+/i).filter((_, i) => i % 2 === 0).map(s => s.trim()).filter(Boolean);
  const cleanTitle   = (parts.length > 1 ? parts.join(' · ') : rawFull.trim()).replace(/^(yes|no)\s+/i, '').trim();

  return {
    ticker:       m.ticker || '',
    title:        cleanTitle,
    category:     normalizeCategoryLabel(rawCategory),
    subtitle:     toStr(m.subtitle) || (singleYesSub ? `Yes: ${singleYesSub}` : '') || toStr(m.event_title) || '',
    yesPrice,
    noPrice,
    yesBid,
    yesAsk,
    noBid,
    noAsk,
    spread:       Math.max(0, yesAsk - yesBid),
    lastPrice,
    volume24h:    parseFp(m.volume_24h_fp,    m.volume_24h    ?? 0),
    eventTicker:  m.event_ticker  || '',
    seriesTicker: m.series_ticker || '',
    priceChange:  prevBid > 0 && prevBid !== yesBid ? yesBid - prevBid : 0,
    volume:       parseFp(m.volume_fp,        m.volume        ?? m.volume_24h ?? 0),
    openInterest: parseFp(m.open_interest_fp, m.open_interest ?? 0),
    closeTime:    m.close_time || m.expiration_time || m.end_date || '',
    status:       m.status || 'open',
    priceIsReal:  lastPrice > 0 || yesBid > 0 || yesAsk > 0,
  };
}

// ── Market Classification ─────────────────────────────────────────────────────

export const SPORTS_SERIES_PREFIXES = [
  'NFL', 'NBA', 'MLB', 'NHL', 'NCAAB', 'NCAAF',
  'NASCAR', 'PGA', 'UFC', 'WNBA',
  'KXNFL', 'KXNBA', 'KXMLB', 'KXNHL', 'KXNCAAB', 'KXNCAAF',
  'KXNASCAR', 'KXPGA', 'KXUFC', 'KXWNBA', 'KXMMA', 'KXBOXING',
  'KXF1', 'KXGOLF', 'KXTENNIS', 'KXSOCCER',
];

const SPORTS_CATEGORIES = new Set([
  'NFL', 'NBA', 'MLB', 'NHL',
  'NCAAB', 'College Basketball', 'NCAAF', 'College Football',
  'NASCAR', 'Golf', 'Formula 1', 'MMA', 'Boxing', 'WNBA',
  'Soccer', 'Tennis', 'Sports', 'Baseball', 'Basketball', 'Football', 'Hockey',
]);

const SPORTS_TITLE_RE = /\b(goals?|strikeouts?|touchdowns?|rebounds?|assists?|home\s*runs?|stolen\s*bases?|rushing\s*yards?|passing\s*yards?|receiving\s*yards?|receptions?|tackles?|sacks?|blocks?|steals?|field\s*goals?|free\s*throws?|three[\s-]?pointers?|shots?\s*on\s*goal|clean\s*sheets?|both\s*teams?\s*to\s*score|runs?\s*scored|batting|pitching)\b/i;
const PLAYER_PROP_RE  = /[A-Z][a-z][\w.]* [A-Z][a-z]\w*:\s*\d+[+]/;
const NON_SPORTS_RE   = /\b(election|senator?|congress(?:ional)?|president(?:ial)?|trump|biden|harris|kennedy|vote|democrat|republican|electoral|inaugur|ballot|governor|primary|bitcoin|ethereum|crypto\b|BTC|ETH|nasdaq|S&P|GDP|CPI|inflation|federal\s*reserve|FOMC|oscar|grammy|emmy|golden\s*globe|box\s*office|hurricane|tornado|earthquake|temperature|weather|rainfall)\b/i;

export function isSportsMarket(m: Pick<KalshiMarket, 'seriesTicker' | 'category' | 'ticker' | 'eventTicker' | 'title'>): boolean {
  const series = (m.seriesTicker || '').toUpperCase();
  if (series && SPORTS_SERIES_PREFIXES.some(p => series.startsWith(p))) return true;
  if (SPORTS_CATEGORIES.has(m.category || '')) return true;
  const tkr = (m.ticker || '').toUpperCase();
  const evt = (m.eventTicker || '').toUpperCase();
  if (tkr && SPORTS_SERIES_PREFIXES.some(p => tkr.startsWith(p))) return true;
  if (evt && SPORTS_SERIES_PREFIXES.some(p => evt.startsWith(p))) return true;
  const title = m.title || '';
  if (!title || NON_SPORTS_RE.test(title)) return false;
  if (PLAYER_PROP_RE.test(title)) return true;
  if (SPORTS_TITLE_RE.test(title)) return true;
  const legs = title.split(/\s*[·•]\s*/).map(p => p.trim()).filter(p => p.length > 3);
  if (legs.length >= 2 && legs.some(p => PLAYER_PROP_RE.test(p))) return true;
  if (legs.length >= 3 && legs.every(p => /^[A-Z]/.test(p))) return true;
  return false;
}

const POLITICAL_SERIES = ['KXUSSENATE', 'KXUSHOUSE', 'KXUSGOV', 'PRES', 'POTUS'];
const POLITICS_RE   = /\b(election|senate|congress(?:ional)?|house\s+of\s+rep|representative|president(?:ial)?|governor|mayor|democrat|republican|gop|midterm|primary|ballot|vote|electoral|inaugur)\b/i;
const WEATHER_RE    = /\b(temperature|degrees?|fahrenheit|celsius|rainfall|precipitation|hurricane|tornado|earthquake|flood|snow|blizzard|weather|climate)\b/i;
const FINANCE_RE    = /\b(stock|S&P|NASDAQ|bitcoin|ethereum|crypto|interest\s+rate|federal\s+reserve|inflation|GDP|recession|unemployment|treasury|bond|yield|ETH|BTC)\b/i;
const FINANCE_SERIES_RE = /^(KXBT|KXETH|KXCPI|KXGDP|KXSP|KXNQ|KXFED|SP500|FED|FOMC)/i;
const ENTERTAINMENT_RE  = /\b(oscar|grammy|emmy|tony\s+award|golden\s+globe|bafta|box\s+office|billboard|academy\s+award|best\s+picture|best\s+actor|best\s+actress|cannes|mtv\s+award|vma|reality\s+show)\b/i;

function isPoliticsMarket(m: KalshiMarket): boolean {
  const s = (m.seriesTicker || '').toUpperCase();
  if (POLITICAL_SERIES.some(p => s.startsWith(p))) return true;
  if (m.category === 'Politics') return true;
  return POLITICS_RE.test(`${m.title} ${m.subtitle}`);
}

function isWeatherMarket(m: KalshiMarket): boolean {
  const s = (m.seriesTicker || '').toUpperCase();
  if (s.startsWith('WEATHER') || s.startsWith('TEMP') || s.startsWith('HURR') || s.startsWith('KXHI')) return true;
  if (m.category === 'Weather') return true;
  return WEATHER_RE.test(`${m.title} ${m.subtitle}`);
}

function isFinanceMarket(m: KalshiMarket): boolean {
  if (FINANCE_SERIES_RE.test(m.seriesTicker || '')) return true;
  if (m.category === 'Finance' || m.category === 'Crypto') return true;
  return FINANCE_RE.test(`${m.title} ${m.subtitle}`);
}

function isEntertainmentMarket(m: KalshiMarket): boolean {
  return ENTERTAINMENT_RE.test(`${m.title} ${m.subtitle}`);
}

// ── Cache + Dedup ─────────────────────────────────────────────────────────────

interface CacheEntry { markets: KalshiMarket[]; ts: number; ttl: number }
const _cache    = new Map<string, CacheEntry>();
const _inflight = new Map<string, Promise<KalshiMarket[]>>();

function cacheGet(key: string): KalshiMarket[] | null {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > e.ttl) { _cache.delete(key); return null; }
  return e.markets;
}

function cacheSet(key: string, markets: KalshiMarket[], ttl = POOL_CACHE_TTL_MS): void {
  _cache.set(key, { markets, ts: Date.now(), ttl });
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

let _lastFetchHadError = false;

async function kalshiGet(path: string, params?: Record<string, string>): Promise<any> {
  const qp  = params && Object.keys(params).length ? `?${new URLSearchParams(params)}` : '';
  const url  = `${BASE_URL}${path}${qp}`;
  const res  = await fetch(url, {
    headers: buildHeaders(url),
    signal:  AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Kalshi ${res.status}: ${body.slice(0, 120)}`);
  }
  return res.json();
}

// ── Page Fetch + Quality Filter ───────────────────────────────────────────────

// Ticker-only titles (e.g. "KXBT-25DEC25-T45000") and internal cross-category
// markets have no public Kalshi page — exclude them from card results.
const TICKER_TITLE_RE   = /^[A-Z0-9\-\.%]+$/;
const CROSS_CAT_RE      = /^KXMVE?CROSS/i;
const HEX_SEGMENT_RE    = /-[0-9a-f]{12,}/i;

function qualityFilter(markets: KalshiMarket[]): KalshiMarket[] {
  return markets.filter(m => {
    if (!m.title || m.title.length < 10) return false;
    if (TICKER_TITLE_RE.test(m.title)) return false;
    // Political series always pass — their event tickers can carry short hash suffixes
    const series = (m.seriesTicker || '').toUpperCase();
    if (POLITICAL_SERIES.some(p => series.startsWith(p))) return true;
    if (CROSS_CAT_RE.test(m.seriesTicker || '') || CROSS_CAT_RE.test(m.eventTicker || '') || CROSS_CAT_RE.test(m.ticker || '')) return false;
    if (m.eventTicker && HEX_SEGMENT_RE.test(m.eventTicker)) return false;
    if (m.ticker     && HEX_SEGMENT_RE.test(m.ticker))       return false;
    return true;
  });
}

async function fetchPage(params: Record<string, string>): Promise<{ markets: KalshiMarket[]; cursor: string | null }> {
  const data = await kalshiGet('/markets', params);
  if (!data.markets || !Array.isArray(data.markets)) return { markets: [], cursor: null };
  const markets = qualityFilter(data.markets.map(parseMarket));
  return { markets, cursor: data.cursor && data.cursor !== '' ? data.cursor : null };
}

// ── Shared Market Pool ────────────────────────────────────────────────────────

const POOL_KEY = 'kalshi:pool';

/**
 * Fetch ALL open Kalshi markets, cached for 60 s.
 * Every topic-specific function filters this pool client-side — the API's
 * search/category params are silently ignored, so issuing separate per-topic
 * requests would just return the same page multiple times.
 */
async function getMarketPool(maxMarkets = 1000): Promise<KalshiMarket[]> {
  const cached = cacheGet(POOL_KEY);
  if (cached) return cached;

  const existing = _inflight.get(POOL_KEY);
  if (existing) return existing;

  const promise = (async (): Promise<KalshiMarket[]> => {
    const all  = new Map<string, KalshiMarket>(); // keyed by ticker for dedup
    let cursor: string | null = null;
    let page   = 0;
    _lastFetchHadError = false;

    try {
      do {
        page++;
        const params: Record<string, string> = { limit: '1000', status: 'open' };
        if (cursor) params.cursor = cursor;

        const { markets, cursor: next } = await fetchPage(params);
        for (const m of markets) all.set(m.ticker, m);
        cursor = next;
        console.log(`[KALSHI] Pool page ${page}: +${markets.length} (total: ${all.size})`);
      } while (cursor && all.size < maxMarkets);

      const result = Array.from(all.values());
      const cats   = [...new Set(result.map(m => m.category))].filter(Boolean);
      console.log(`[KALSHI] Pool ready: ${result.length} markets — ${cats.slice(0, 10).join(', ')}`);
      cacheSet(POOL_KEY, result, POOL_CACHE_TTL_MS);
      return result;
    } catch (err) {
      _lastFetchHadError = true;
      console.error('[KALSHI] Pool fetch failed:', err instanceof Error ? err.message : err);
      return [];
    }
  })();

  _inflight.set(POOL_KEY, promise);
  promise.finally(() => _inflight.delete(POOL_KEY));
  return promise;
}

// ── Public Fetch API ──────────────────────────────────────────────────────────

/** Returns a flat slice of the market pool. */
export async function fetchKalshiMarkets(params?: {
  category?: string;
  status?: 'open' | 'closed';
  limit?: number;
  search?: string;
  cursor?: string;
  useCache?: boolean;
  cacheTtlMs?: number;
}): Promise<KalshiMarket[]> {
  const pool = await getMarketPool();
  return pool.slice(0, params?.limit ?? 200);
}

/** Retries the pool fetch up to maxRetries times on network/API errors. */
export async function fetchKalshiMarketsWithRetry(params?: {
  category?: string;
  status?: 'open' | 'closed';
  limit?: number;
  search?: string;
  maxRetries?: number;
}): Promise<KalshiMarket[]> {
  const limit   = params?.limit ?? 200;
  const retries = params?.maxRetries ?? 3;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const markets = await getMarketPool().catch(() => [] as KalshiMarket[]);
    if (markets.length > 0) return markets.slice(0, limit);
    if (!_lastFetchHadError) return []; // empty API response, retrying won't help
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 5000)));
    }
  }
  return [];
}

/** Fetch all open markets up to maxMarkets (alias for pool). */
export async function fetchAllKalshiMarkets(options?: {
  maxMarkets?: number;
  status?: 'open' | 'closed';
  useCache?: boolean;
}): Promise<KalshiMarket[]> {
  return getMarketPool(options?.maxMarkets ?? 2000);
}

export async function fetchSportsMarkets(): Promise<KalshiMarket[]> {
  const pool   = await getMarketPool();
  const sports = pool.filter(isSportsMarket);
  console.log(`[KALSHI] Sports: ${sports.length}/${pool.length}`);
  return sports;
}

/**
 * Fetch political / election markets.
 * Tries direct series_ticker queries first (exact, no false positives),
 * then falls back to client-side filtering of the shared pool.
 */
export async function fetchElectionMarkets(options?: { year?: number; limit?: number }): Promise<KalshiMarket[]> {
  const limit    = options?.limit ?? 20;
  const cacheKey = `kalshi:politics:${limit}`;
  const cached   = cacheGet(cacheKey);
  if (cached) return cached;

  // Strategy 1: direct series_ticker queries (the only query param Kalshi actually honours)
  const seriesResults = await Promise.allSettled(
    POLITICAL_SERIES.map(series =>
      fetchPage({ series_ticker: series, status: 'open', limit: String(Math.min(limit * 4, 200)) })
    )
  );

  const seen    = new Set<string>();
  const results: KalshiMarket[] = [];
  for (const r of seriesResults) {
    if (r.status !== 'fulfilled') continue;
    for (const m of r.value.markets) {
      if (!seen.has(m.ticker)) { seen.add(m.ticker); results.push(m); }
      if (results.length >= limit) break;
    }
    if (results.length >= limit) break;
  }
  console.log(`[KALSHI] Politics (series_ticker): ${results.length}`);

  // Strategy 2: client-side filter from pool (used when series_ticker param is unsupported
  // by this endpoint version, which returns the generic top-N list for all series queries)
  if (results.length === 0) {
    const pool     = await getMarketPool();
    const filtered = pool.filter(isPoliticsMarket);
    console.log(`[KALSHI] Politics (pool filter): ${filtered.length}/${pool.length}`);
    // No political markets open (off-season) — return top open markets so cards populate
    const final = filtered.length > 0 ? filtered : pool.slice(0, limit);
    cacheSet(cacheKey, final.slice(0, limit), 30_000);
    return final.slice(0, limit);
  }

  cacheSet(cacheKey, results, 30_000);
  return results;
}

export async function fetchWeatherMarkets(limit = 50): Promise<KalshiMarket[]> {
  const pool    = await getMarketPool();
  const weather = pool.filter(isWeatherMarket);
  console.log(`[KALSHI] Weather: ${weather.length}/${pool.length}`);
  return weather.slice(0, limit);
}

export async function fetchFinanceMarkets(limit = 50): Promise<KalshiMarket[]> {
  const pool    = await getMarketPool();
  const finance = pool.filter(isFinanceMarket);
  console.log(`[KALSHI] Finance: ${finance.length}/${pool.length}`);
  return finance.slice(0, limit);
}

export async function fetchEntertainmentMarkets(limit = 20): Promise<KalshiMarket[]> {
  const pool = await getMarketPool();
  const ent  = pool.filter(isEntertainmentMarket);
  console.log(`[KALSHI] Entertainment: ${ent.length}/${pool.length}`);
  return ent.slice(0, limit);
}

export async function fetchTopMarketsByVolume(n = 10, _status: 'open' | 'closed' = 'open'): Promise<KalshiMarket[]> {
  const pool = await getMarketPool();
  return pool
    .filter(m => !m.status || m.status === 'active' || m.status === 'open')
    .sort((a, b) =>
      (b.priceIsReal ? 1 : 0) - (a.priceIsReal ? 1 : 0) ||
      (b.volume24h || b.volume) - (a.volume24h || a.volume)
    )
    .slice(0, n);
}

export async function fetchAllCategoryMarkets(): Promise<Record<string, KalshiMarket[]>> {
  const pool = await getMarketPool();
  return {
    sports:    pool.filter(isSportsMarket),
    elections: pool.filter(isPoliticsMarket),
    weather:   pool.filter(isWeatherMarket),
    finance:   pool.filter(isFinanceMarket),
  };
}

// ── Single Market / Orderbook / Trades / History ──────────────────────────────

export async function getMarketByTicker(ticker: string): Promise<KalshiMarket | null> {
  try {
    const data = await kalshiGet(`/markets/${encodeURIComponent(ticker)}`);
    return parseMarket(data.market);
  } catch (err) {
    console.error(`[KALSHI] getMarketByTicker(${ticker}):`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function fetchMarketOrderbook(ticker: string): Promise<{
  yesBids: { price: number; quantity: number }[];
  yesAsks: { price: number; quantity: number }[];
  noBids:  { price: number; quantity: number }[];
  noAsks:  { price: number; quantity: number }[];
} | null> {
  try {
    const data = await kalshiGet(`/markets/${encodeURIComponent(ticker)}/orderbook`);
    const obFp = data.orderbook_fp;
    const obV1 = data.orderbook || {};

    if (obFp) {
      const toLevel = (arr: any[] = []) =>
        arr.map((l: any) => ({
          price:    Math.round(parseFloat(l[0] ?? '0') * 100),
          quantity: Math.round(parseFloat(l[1] ?? '0')),
        })).filter(l => l.price > 0);
      const yesBids = toLevel(obFp.yes_dollars || []);
      const noBids  = toLevel(obFp.no_dollars  || []);
      return {
        yesBids,
        yesAsks: noBids.map(l  => ({ price: 100 - l.price, quantity: l.quantity })),
        noBids,
        noAsks:  yesBids.map(l => ({ price: 100 - l.price, quantity: l.quantity })),
      };
    }

    const toV1 = (arr: any[] = []) => arr.map((l: any) => ({ price: l[0] ?? 0, quantity: l[1] ?? 0 }));
    return {
      yesBids: toV1(obV1.yes),
      yesAsks: toV1(obV1.yes_ask || []),
      noBids:  toV1(obV1.no),
      noAsks:  toV1(obV1.no_ask  || []),
    };
  } catch {
    return null;
  }
}

export async function fetchMarketTrades(ticker: string, limit = 100): Promise<{ ts: string; price: number; count: number }[]> {
  try {
    const data = await kalshiGet(`/markets/${encodeURIComponent(ticker)}/trades`, { limit: String(limit) });
    return (data.trades || []).map((t: any) => ({
      ts:    t.created_time || t.ts || '',
      price: parseCents(t.yes_price_dollars, t.yes_price ?? t.price ?? 0),
      count: t.count ?? 1,
    }));
  } catch {
    return [];
  }
}

export async function fetchMarketHistory(ticker: string, limit = 100): Promise<{ ts: number; pct: number }[]> {
  try {
    const data    = await kalshiGet(`/markets/${encodeURIComponent(ticker)}/history`, { limit: String(limit) });
    const entries = data.history ?? data.market_history ?? [];
    return (entries as any[]).map(h => {
      const raw = h.yes_price ?? h.yes_price_dollars ?? h.price ?? '0.5';
      const pct = typeof raw === 'string'
        ? Math.round(parseFloat(raw) * 100)
        : Math.round(raw > 1 ? raw : raw * 100);
      const ts  = h.ts ? new Date(h.ts).getTime()
        : h.created_time ? new Date(h.created_time).getTime()
        : Date.now();
      return { ts, pct: Math.min(99, Math.max(1, pct)) };
    }).filter((h: any) => h.pct > 0);
  } catch {
    return [];
  }
}

export async function fetchKalshiEvents(params?: {
  status?: string;
  limit?: number;
  series_ticker?: string;
}): Promise<{ eventTicker: string; title: string; category: string; markets: number }[]> {
  try {
    const qp: Record<string, string> = { limit: String(params?.limit ?? 100) };
    if (params?.status)        qp.status        = params.status;
    if (params?.series_ticker) qp.series_ticker = params.series_ticker;
    const data = await kalshiGet('/events', qp);
    return (data.events || []).map((e: any) => ({
      eventTicker: e.event_ticker || e.ticker || '',
      title:       e.title || e.event_title || '',
      category:    e.category || e.series_ticker || '',
      markets:     e.markets?.length ?? e.num_markets ?? 0,
    }));
  } catch {
    return [];
  }
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export function analyzeKalshiVolatility(market: KalshiVolatilityInput, modelProbability: number): KalshiAnalysis {
  const impliedProbability = market.yesPrice / 100;
  const edge       = modelProbability - impliedProbability;
  const spread     = market.spread ?? (market.noPrice - (100 - market.yesPrice));
  const spreadPct  = market.yesPrice > 0 ? Math.abs(spread) / market.yesPrice : 1;
  const isLiquid   = spreadPct < 0.1 && (market.volume24h ?? 0) > 1000;
  const confidence = Math.max(0, Math.round(Math.min(100, Math.abs(edge) * 200) - (isLiquid ? 0 : 20)));
  const signal: 'YES' | 'NO' | 'PASS' =
    Math.abs(edge) < 0.03 || !isLiquid ? 'PASS' : edge > 0 ? 'YES' : 'NO';
  const recommendation =
    signal === 'PASS' ? `No edge — spread too wide or model close to market (edge: ${(edge * 100).toFixed(1)}¢)`
    : signal === 'YES' ? `Buy YES — model (${(modelProbability * 100).toFixed(1)}%) > implied (${market.yesPrice}¢)`
    : `Buy NO — model (${(modelProbability * 100).toFixed(1)}%) < implied (${market.yesPrice}¢)`;
  return { ticker: market.ticker, title: market.title, impliedProbability, modelProbability, edge, signal, confidence, spreadPct, isLiquid, recommendation };
}

// ── Card Formatting ───────────────────────────────────────────────────────────

function kalshiCategoryMeta(category: string): { gradient: string; iconLabel: string } {
  const cat = (category || '').toLowerCase();
  if (cat.includes('election') || cat.includes('politic') || cat.includes('senate') || cat.includes('president') || cat.includes('congress'))
    return { gradient: 'from-blue-600 to-indigo-700', iconLabel: 'election' };
  if (cat.includes('nfl') || cat.includes('nba') || cat.includes('mlb') || cat.includes('nhl') || cat.includes('sport') || cat.includes('ufc') || cat.includes('soccer') || cat.includes('golf') || cat.includes('tennis'))
    return { gradient: 'from-green-600 to-emerald-700', iconLabel: 'sports' };
  if (cat.includes('weather') || cat.includes('temp') || cat.includes('hurricane') || cat.includes('tornado') || cat.includes('snow') || cat.includes('rain'))
    return { gradient: 'from-sky-600 to-cyan-700', iconLabel: 'weather' };
  if (cat.includes('stock') || cat.includes('crypto') || cat.includes('bitcoin') || cat.includes('rate') || cat.includes('inflation') || cat.includes('gdp') || cat.includes('nasdaq') || cat.includes('sp500') || cat.includes('fed'))
    return { gradient: 'from-amber-600 to-orange-700', iconLabel: 'finance' };
  if (cat.includes('oscar') || cat.includes('grammy') || cat.includes('emmy') || cat.includes('award') || cat.includes('box office'))
    return { gradient: 'from-fuchsia-600 to-pink-700', iconLabel: 'entertainment' };
  return { gradient: 'from-purple-600 to-indigo-700', iconLabel: 'market' };
}

export function kalshiMarketToCard(
  market: KalshiMarket,
  orderbook?: { yesBids: { price: number; quantity: number }[]; yesAsks: { price: number; quantity: number }[] } | null,
): any {
  const yesPct = Math.min(100, Math.max(0, market.yesPrice));
  const noPct  = Math.min(100, Math.max(0, market.noPrice));
  const { gradient, iconLabel } = kalshiCategoryMeta(market.category);

  const signal =
    yesPct >= 75 ? 'Strong YES signal' : yesPct >= 60 ? 'Lean YES' :
    yesPct <= 25 ? 'Strong NO signal'  : yesPct <= 40 ? 'Lean NO'  :
    'Market is efficient (near 50/50)';

  let expiresLabel = '';
  if (market.closeTime) {
    const ms   = new Date(market.closeTime).getTime() - Date.now();
    const days = Math.floor(ms / 86400000);
    expiresLabel = days > 1 ? `${days}d` : days === 1 ? '1d' : ms > 0 ? '<24h' : 'Closed';
  }

  const expiryUrgency = (() => {
    if (!market.closeTime) return 'none';
    const days = (new Date(market.closeTime).getTime() - Date.now()) / 86400000;
    return days < 1 ? 'critical' : days < 3 ? 'urgent' : days < 7 ? 'soon' : 'normal';
  })();

  const fmtVol = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000   ? `${(n / 1_000).toFixed(0)}K`
    : n > 0        ? `${n}` : '—';

  const syntheticTrades = (() => {
    if (!market.priceIsReal || yesPct <= 0) return null;
    const prev = Math.max(1, market.lastPrice > 0 ? market.lastPrice : yesPct - (market.priceChange ?? 0));
    if (prev === yesPct) return null;
    return [
      { price: Math.max(1, Math.min(99, prev)) },
      { price: Math.max(1, Math.min(99, (prev + yesPct) / 2)) },
      { price: Math.max(1, Math.min(99, yesPct)) },
    ];
  })();

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
      yesPct,
      noPct,
      edgeScore: Math.round(Math.abs(yesPct - 50) * 2),
      yesBid: market.yesBid,   yesAsk: market.yesAsk,
      noBid:  market.noBid,    noAsk:  market.noAsk,
      spread: market.spread,
      spreadLabel: market.spread <= 1 ? 'Tight' : market.spread <= 4 ? 'Normal' : 'Wide',
      lastPrice: market.lastPrice,
      priceChange: market.priceChange,
      priceDirection: market.priceChange > 0 ? 'up' : market.priceChange < 0 ? 'down' : 'flat',
      yesPrice: `${yesPct}¢`,
      noPrice:  `${noPct}¢`,
      impliedProbability: `${yesPct.toFixed(1)}%`,
      volume:       fmtVol(market.volume),
      volume24h:    fmtVol(market.volume24h),
      openInterest: fmtVol(market.openInterest),
      closeTime: market.closeTime
        ? new Date(market.closeTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'TBD',
      expiresLabel,
      expiryUrgency,
      volumeTier: market.volume >= 1_000_000 ? 'Deep' : market.volume >= 100_000 ? 'Active' : market.volume >= 10_000 ? 'Moderate' : 'Thin',
      isHot: market.volume24h >= 50_000 || market.volume >= 500_000,
      recommendation: signal,
      eventTicker:  market.eventTicker,
      seriesTicker: market.seriesTicker,
      closeTimeIso: market.closeTime || null,
      volumeRaw:        market.volume,
      volume24hRaw:     market.volume24h,
      openInterestRaw:  market.openInterest,
      orderbookBids: orderbook?.yesBids?.slice(0, 5) ?? null,
      orderbookAsks: orderbook?.yesAsks?.slice(0, 5) ?? null,
      priceIsReal: market.priceIsReal,
      trades: syntheticTrades,
    },
    status:   market.status === 'open' || market.status === 'active' ? 'active' : 'closed',
    realData: true,
  };
}

// ── DB Fallback ───────────────────────────────────────────────────────────────

export function buildKalshiMarketFromDbRow(row: {
  market_id: string;
  title: string;
  category?: string | null;
  yes_price?: number | null;
  no_price?: number | null;
  volume?: number | null;
  close_time?: string | null;
  event_ticker?: string | null;
  series_ticker?: string | null;
}): KalshiMarket {
  const yesCents = Math.round((row.yes_price ?? 0.5) * 100);
  const noCents  = Math.round((row.no_price  ?? 0.5) * 100);
  return {
    ticker:       row.market_id,
    title:        row.title,
    category:     row.category ?? 'Prediction Market',
    subtitle:     '',
    yesPrice:     yesCents,
    noPrice:      noCents,
    yesBid:       yesCents,
    yesAsk:       yesCents,
    noBid:        noCents,
    noAsk:        noCents,
    spread:       0,
    lastPrice:    yesCents,
    volume24h:    0,
    eventTicker:  row.event_ticker  || '',
    seriesTicker: row.series_ticker || '',
    priceChange:  0,
    volume:       row.volume ?? 0,
    openInterest: 0,
    closeTime:    row.close_time ?? '',
    status:       'open',
    priceIsReal:  row.yes_price != null,
  };
}

// ── Compat Shims ──────────────────────────────────────────────────────────────

/** @deprecated Circuit breaker was removed. No-op kept for call-site compat. */
export function resetKalshiCircuitBreaker(): void {}

/** True when the last pool fetch failed with a network/API error (vs. empty but valid response). */
export function wasKalshiFetchError(): boolean {
  return _lastFetchHadError;
}

/** @deprecated Use kalshiMarketToCard() directly. */
export function generateKalshiCards(markets: KalshiMarket[]): any[] {
  return markets.slice(0, 6).map(m => kalshiMarketToCard(m));
}
