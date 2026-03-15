/**
 * Single-call overrides for Kalshi category fetch functions.
 *
 * The original fetchSportsMarkets / fetchElectionMarkets / fetchWeatherMarkets /
 * fetchFinanceMarkets each fire 3-14 sequential or batched API requests per
 * invocation. In a serverless environment every cold start resets all in-process
 * throttle state, so those fan-out patterns reliably produce 429 errors.
 *
 * These replacements make exactly ONE API call each, then filter client-side.
 * The underlying fetchKalshiMarkets call is wrapped in Next.js unstable_cache
 * so the HTTP request fires at most once per 5-minute window across all
 * serverless instances in the same deployment.
 */

import { unstable_cache } from 'next/cache';
import type { KalshiMarket } from './index';

const KALSHI_TRADING_URL = 'https://api.elections.kalshi.com/trade-api/v2';
const REVALIDATE_S = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Raw HTTP helper (no in-process caching — that's handled by unstable_cache)
// ---------------------------------------------------------------------------

async function rawFetch(titleSearch: string, limit = 200): Promise<KalshiMarket[]> {
  const url = `${KALSHI_TRADING_URL}/markets?limit=${limit}&status=open&title=${encodeURIComponent(titleSearch)}`;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'LeverageAI/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? 0);
      const delay = retryAfter > 0 ? retryAfter * 1000 : Math.min(2000 * Math.pow(2, attempt), 16000);
      await res.text().catch(() => '');
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, delay + Math.random() * 1000));
        continue;
      }
      throw new Error('Kalshi API error: 429 Too Many Requests');
    }

    if (!res.ok) throw new Error(`Kalshi API error: ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data?.markets)) return [];

    const TICKER_RE = /^[A-Z0-9\-\.%]+$/;
    return data.markets
      .map((m: any): KalshiMarket => {
        const yesBid = m.yes_bid ?? 0;
        const yesAsk = m.yes_ask ?? 0;
        const lastPrice = m.last_price ?? 0;
        const yesMid = yesBid > 0 && yesAsk > 0 ? Math.round((yesBid + yesAsk) / 2) : 0;
        const rawYes = lastPrice > 0 ? lastPrice : yesMid > 0 ? yesMid : yesAsk > 0 ? yesAsk : yesBid > 0 ? yesBid : 50;
        const yesPrice = Math.min(99, Math.max(1, rawYes));
        const toStr = (v: unknown) => Array.isArray(v) ? String(v[0] ?? '') : typeof v === 'string' ? v : '';
        const rawTitle = toStr(m.title).replace(/^(yes|no)\s+/i, '').trim();
        return {
          ticker: m.ticker || '',
          title: rawTitle,
          category: toStr(m.category) || toStr(m.series_ticker) || 'Prediction Market',
          subtitle: toStr(m.subtitle) || toStr(m.event_title) || '',
          yesPrice,
          noPrice: Math.max(0, 100 - yesPrice),
          yesBid,
          yesAsk,
          noBid: m.no_bid ?? 0,
          noAsk: m.no_ask ?? 0,
          spread: Math.max(0, yesAsk - yesBid),
          lastPrice,
          volume24h: m.volume_24h ?? 0,
          eventTicker: m.event_ticker || '',
          seriesTicker: m.series_ticker || '',
          priceChange: 0,
          volume: m.volume ?? m.volume_24h ?? 0,
          openInterest: m.open_interest ?? 0,
          closeTime: m.close_time || m.expiration_time || '',
          status: m.status || 'active',
        };
      })
      .filter((m: KalshiMarket) => m.title.length >= 10 && !TICKER_RE.test(m.title));
  }

  return [];
}

// ---------------------------------------------------------------------------
// Cached variants — one HTTP call per 5-minute window, shared across instances
// ---------------------------------------------------------------------------

const cachedFetchAll = unstable_cache(
  () => rawFetch('', 200),
  ['kalshi-all'],
  { revalidate: REVALIDATE_S, tags: ['kalshi'] },
);

const cachedFetchSenate = unstable_cache(
  () => rawFetch('senate', 200),
  ['kalshi-senate'],
  { revalidate: REVALIDATE_S, tags: ['kalshi'] },
);

const cachedFetchWeather = unstable_cache(
  () => rawFetch('temperature', 100),
  ['kalshi-weather'],
  { revalidate: REVALIDATE_S, tags: ['kalshi'] },
);

const cachedFetchFinance = unstable_cache(
  () => rawFetch('interest rate', 200),
  ['kalshi-finance'],
  { revalidate: REVALIDATE_S, tags: ['kalshi'] },
);

// ---------------------------------------------------------------------------
// Public API — drop-in replacements for the multi-call originals
// ---------------------------------------------------------------------------

const SPORT_KEYWORDS = [
  'nfl', 'nba', 'mlb', 'nhl', 'ncaa', 'ufc', 'boxing', 'golf',
  'formula', 'soccer', 'tennis', 'nascar', 'super bowl', 'world series',
  'stanley cup', 'masters', 'playoff', 'championship',
];

export async function fetchSportsMarketsOptimized(): Promise<KalshiMarket[]> {
  console.log('[KALSHI] fetchSportsMarketsOptimized — single cached call');
  const all = await cachedFetchAll();
  return all.filter(m => {
    const text = `${m.title} ${m.category} ${m.subtitle}`.toLowerCase();
    return SPORT_KEYWORDS.some(k => text.includes(k));
  });
}

const ELECTION_KEYWORDS = [
  'election', 'senate', 'house', 'congress', 'midterm',
  'governor', 'president', 'harris', 'trump', 'republican',
  'democrat', 'ballot', 'primary', 'gop',
];

export async function fetchElectionMarketsOptimized(options?: {
  year?: number;
  limit?: number;
}): Promise<KalshiMarket[]> {
  const { year = 2026, limit = 20 } = options || {};
  console.log('[KALSHI] fetchElectionMarketsOptimized — single cached call');
  const markets = await cachedFetchSenate();
  const filtered = markets.filter(m => {
    const text = `${m.title} ${m.category} ${m.subtitle}`.toLowerCase();
    return ELECTION_KEYWORDS.some(k => text.includes(k)) || text.includes(year.toString());
  });
  return filtered.slice(0, limit);
}

export async function fetchWeatherMarketsOptimized(limit = 50): Promise<KalshiMarket[]> {
  console.log('[KALSHI] fetchWeatherMarketsOptimized — single cached call');
  const markets = await cachedFetchWeather();
  return markets.slice(0, limit);
}

export async function fetchFinanceMarketsOptimized(limit = 50): Promise<KalshiMarket[]> {
  console.log('[KALSHI] fetchFinanceMarketsOptimized — single cached call');
  const markets = await cachedFetchFinance();
  return markets.slice(0, limit);
}
