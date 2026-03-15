import { NextResponse } from 'next/server';
import {
  fetchKalshiMarkets,
  fetchAllKalshiMarkets,
  fetchSportsMarkets,
  fetchElectionMarkets,
  fetchWeatherMarkets,
  fetchFinanceMarkets,
  fetchTopMarketsByVolume,
  fetchMarketOrderbook,
  fetchMarketTrades,
  fetchKalshiEvents,
  getMarketByTicker,
  kalshiMarketToCard,
} from '@/lib/kalshi-client';

// No edge runtime — Node.js runtime needed for in-memory cache and full API surface

// ── Route-level response cache (90s TTL) ─────────────────────────────────────
const ROUTE_CACHE = new Map<string, { data: unknown; expires: number }>();
const ROUTE_CACHE_TTL = 90_000;

function getRouteCache(key: string): unknown | null {
  const entry = ROUTE_CACHE.get(key);
  return entry && entry.expires > Date.now() ? entry.data : null;
}
function setRouteCache(key: string, data: unknown): void {
  ROUTE_CACHE.set(key, { data, expires: Date.now() + ROUTE_CACHE_TTL });
}

function isRateLimitError(err: unknown): boolean {
  const msg = String(err);
  return msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too_many_requests');
}

/**
 * GET /api/kalshi
 * Fetch Kalshi prediction markets
 * Query params:
 *  - ticker:    Specific market ticker (returns single market + optional extras)
 *  - type:      'election' | 'sports' | 'weather' | 'finance' | 'trending' | 'all' | 'events'
 *  - subcategory: Kalshi subcategory pill value ('Politics','Sports','Climate','Financials',...)
 *  - category:  Market category string (NFL, NBA, election, politics, etc.)
 *  - sport:     Sport key (nfl, nba, mlb, nhl — maps to category)
 *  - year:      Election year (default: 2026)
 *  - limit:     Number of markets to return (default: 10)
 *  - include:   Comma-separated extras for a ticker: 'orderbook', 'trades'
 *  - search:    Free-text title search
 */
export async function GET(request: Request) {
  // Serve from route-level cache when available (disabled in test env to preserve mock isolation)
  const cacheKey = request.url;
  const isTest = process.env.NODE_ENV === 'test';
  if (!isTest) {
    const cached = getRouteCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  try {
    const { searchParams } = new URL(request.url);
    const ticker      = searchParams.get('ticker');
    const type        = searchParams.get('type');
    const subcategory = (searchParams.get('subcategory') || '').toLowerCase();
    const category    = searchParams.get('category');
    const sport       = searchParams.get('sport');
    const search      = searchParams.get('search');
    const year        = parseInt(searchParams.get('year') || '2026');
    const limit       = parseInt(searchParams.get('limit') || '10');
    const include     = (searchParams.get('include') || '').split(',').map(s => s.trim()).filter(Boolean);

    console.log('[v0] [API] [KALSHI] GET:', { ticker, type, subcategory, category, sport, search, year, limit, include });

    // ── Single market by ticker ──────────────────────────────────────────────
    if (ticker) {
      const market = await getMarketByTicker(ticker);
      if (!market) {
        return NextResponse.json({ success: false, error: 'Market not found', markets: [] }, { status: 404 });
      }

      const extras: Record<string, any> = {};
      if (include.includes('orderbook')) {
        extras.orderbook = await fetchMarketOrderbook(ticker);
      }
      if (include.includes('trades')) {
        extras.trades = await fetchMarketTrades(ticker, 50);
      }

      return NextResponse.json({
        success: true,
        markets: [market],
        count: 1,
        ...extras,
        timestamp: new Date().toISOString(),
      });
    }

    // ── Events endpoint ──────────────────────────────────────────────────────
    if (type === 'events') {
      const events = await fetchKalshiEvents({ limit, search: search || undefined });
      return NextResponse.json({ success: true, events, count: events.length, timestamp: new Date().toISOString() });
    }

    // ── Subcategory pill routing (from sidebar pills) ─────────────────────
    if (subcategory) {
      let markets: Awaited<ReturnType<typeof fetchKalshiMarkets>> = [];

      if (subcategory === 'sports' || subcategory === 'sport') {
        markets = await fetchSportsMarkets();
      } else if (subcategory === 'politics' || subcategory === 'elections' || subcategory === 'election') {
        markets = await fetchElectionMarkets({ year, limit: limit * 5 });
      } else if (subcategory === 'weather' || subcategory === 'climate') {
        markets = await fetchWeatherMarkets(limit * 5);
      } else if (['financials', 'finance', 'economics', 'crypto', 'companies'].includes(subcategory)) {
        markets = await fetchFinanceMarkets(limit * 5);
      } else if (subcategory === 'trending') {
        markets = await fetchTopMarketsByVolume(limit);
      } else {
        markets = await fetchKalshiMarkets({ search: subcategory, limit });
      }

      if (markets.length === 0) {
        console.log(`[v0] [API] [KALSHI] subcategory=${subcategory} returned 0 markets`);
        // Removed: fallback to trending. When the API is unreachable the trending
        // fetch also returns [] and just wastes time. Empty result is returned as-is.
      }

      markets = markets.sort((a, b) => (b.volume24h || b.volume) - (a.volume24h || a.volume));
      console.log(`[v0] [API] [KALSHI] subcategory=${subcategory} → ${markets.length} markets`);

      return NextResponse.json({
        success: true,
        markets,
        count: markets.length,
        subcategory,
        timestamp: new Date().toISOString(),
      });
    }

    // ── Legacy type / category routing ───────────────────────────────────────
    if (type === 'election' || category === 'election' || category === 'politics') {
      const markets = await fetchElectionMarkets({ year, limit });
      return NextResponse.json({
        success: true,
        markets,
        count: markets.length,
        category: 'election',
        year,
        ...(markets.length === 0 && {
          message: `No ${year} election markets currently available. Check https://kalshi.com for live markets.`,
        }),
        timestamp: new Date().toISOString(),
      });
    }

    // Map sport key → category string
    let finalCategory = category;
    if (sport && !category) {
      const sportMap: Record<string, string> = {
        nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL',
        americanfootball_nfl: 'NFL', basketball_nba: 'NBA',
        baseball_mlb: 'MLB', icehockey_nhl: 'NHL',
      };
      finalCategory = sportMap[sport.toLowerCase()] || sport;
    }

    let markets: Awaited<ReturnType<typeof fetchKalshiMarkets>>;
    if (type === 'all') {
      markets = await fetchAllKalshiMarkets({ status: 'open', maxMarkets: 2000 });
    } else if (type === 'sports') {
      markets = finalCategory
        ? await fetchKalshiMarkets({ category: finalCategory, limit })
        : await fetchSportsMarkets();
    } else if (type === 'weather') {
      markets = await fetchWeatherMarkets(limit);
    } else if (type === 'finance') {
      markets = await fetchFinanceMarkets(limit);
    } else if (type === 'trending') {
      markets = await fetchTopMarketsByVolume(limit);
    } else if (search) {
      markets = await fetchKalshiMarkets({ search, limit });
    } else if (finalCategory) {
      markets = await fetchKalshiMarkets({ category: finalCategory, limit });
    } else {
      markets = await fetchAllKalshiMarkets({ status: 'open', maxMarkets: limit > 200 ? limit : 2000 });
    }

    console.log(`[v0] [API] [KALSHI] ✓ Returning ${markets.length} markets`);

    const responseData = {
      success: true,
      markets,
      count: markets.length,
      category: finalCategory || type || 'all',
      timestamp: new Date().toISOString(),
    };
    if (!isTest) setRouteCache(cacheKey, responseData);
    return NextResponse.json(responseData);

  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[v0] [API] [KALSHI] Error:', msg);
    if (isRateLimitError(error)) {
      return NextResponse.json({
        success: false,
        error: 'Market data temporarily unavailable — rate limit reached. Try again in a moment.',
        rateLimited: true,
        markets: [],
      }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: msg, markets: [] }, { status: 500 });
  }
}

/**
 * POST /api/kalshi
 * Fetch Kalshi markets and convert to insight cards
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sport, category, subcategory, limit = 3 } = body;

    console.log('[v0] [API] [KALSHI] POST:', { sport, category, subcategory, limit });

    let markets: Awaited<ReturnType<typeof fetchKalshiMarkets>> = [];
    const sub = (subcategory || '').toLowerCase();

    if (sub === 'sports' || sub === 'sport') {
      markets = await fetchSportsMarkets();
    } else if (sub === 'politics' || sub === 'elections' || sub === 'election') {
      markets = await fetchElectionMarkets({ limit: limit * 5 });
    } else if (sub === 'weather' || sub === 'climate') {
      markets = await fetchWeatherMarkets(limit * 5);
    } else if (['financials', 'finance', 'economics', 'crypto', 'companies'].includes(sub)) {
      markets = await fetchFinanceMarkets(limit * 5);
    } else if (sub === 'trending') {
      markets = await fetchTopMarketsByVolume(limit);
    } else {
      let finalCategory = category;
      if (sport && !category) {
        const sportMap: Record<string, string> = {
          nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL',
          americanfootball_nfl: 'NFL', basketball_nba: 'NBA',
          baseball_mlb: 'MLB', icehockey_nhl: 'NHL',
        };
        finalCategory = sportMap[(sport as string).toLowerCase()] || sport;
      }
      markets = await fetchKalshiMarkets({ category: finalCategory, limit });
    }

    // Sort by volume and take top N
    markets = markets
      .sort((a, b) => (b.volume24h || b.volume) - (a.volume24h || a.volume))
      .slice(0, limit);

    const orderbookResults = await Promise.allSettled(
      markets.slice(0, 3).map(m =>
        Promise.race([
          fetchMarketOrderbook(m.ticker),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
        ])
      )
    );
    const cards = markets.map((m, i) => {
      const ob = orderbookResults[i]?.status === 'fulfilled' ? orderbookResults[i].value : null;
      return kalshiMarketToCard(m, ob);
    });

    console.log(`[v0] [API] [KALSHI] ✓ Returning ${cards.length} cards`);

    return NextResponse.json({
      success: true,
      cards,
      count: cards.length,
      dataSources: ['Kalshi Prediction Markets (Real-time)'],
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[v0] [API] [KALSHI] POST Error:', msg);
    return NextResponse.json({ success: false, error: msg, cards: [] }, { status: 500 });
  }
}
