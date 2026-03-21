/**
 * GET /api/kalshi/markets
 *
 * Dedicated markets list endpoint with:
 *  - In-process 60s cache (shared with lib/kalshi/index.ts)
 *  - Graceful degradation when Kalshi is unreachable
 *  - Rate-limit safe (returns 503 + Retry-After on 429)
 *  - Works with or without KALSHI_ACCESS_KEY (public data needs no auth)
 *
 * Query params:
 *  category  - election | sports | weather | finance | trending | all (default: all)
 *  search    - free-text market title search
 *  limit     - number of markets (default: 20, max: 200)
 *  status    - open | closed (default: open)
 */

import { NextResponse } from 'next/server';
import {
  fetchKalshiMarkets,
  fetchAllKalshiMarkets,
  fetchSportsMarkets,
  fetchElectionMarkets,
  fetchWeatherMarkets,
  fetchFinanceMarkets,
  fetchTopMarketsByVolume,
} from '@/lib/kalshi/index';

// Node.js runtime — needed for crypto (RSA signing)
export const runtime = 'nodejs';

// Vercel CDN cache header: 60s fresh, 300s stale-while-revalidate
const CDN_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';

// Route-level in-memory cache (separate from lib-level cache, keyed by full URL)
const ROUTE_CACHE = new Map<string, { data: unknown; expires: number }>();
const ROUTE_TTL   = 60_000; // 60 seconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = (searchParams.get('category') || 'all').toLowerCase();
  const search   = searchParams.get('search') || undefined;
  const limit    = Math.min(parseInt(searchParams.get('limit') || '20'), 200);
  const status   = (searchParams.get('status') || 'open') as 'open' | 'closed';

  // Check in-memory route cache
  const cacheKey = `markets:${category}:${search || ''}:${limit}:${status}`;
  const cached   = ROUTE_CACHE.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': CDN_CACHE },
    });
  }

  try {
    let markets: Awaited<ReturnType<typeof fetchKalshiMarkets>>;

    switch (category) {
      case 'election':
      case 'elections':
      case 'politics':
        markets = await fetchElectionMarkets({ limit: limit * 3 });
        break;
      case 'sports':
      case 'sport':
        markets = await fetchSportsMarkets();
        break;
      case 'weather':
      case 'climate':
        markets = await fetchWeatherMarkets(limit * 3);
        break;
      case 'finance':
      case 'financials':
      case 'crypto':
        markets = await fetchFinanceMarkets(limit * 3);
        break;
      case 'trending':
        markets = await fetchTopMarketsByVolume(limit);
        break;
      case 'all':
        markets = await fetchAllKalshiMarkets({ status, maxMarkets: Math.max(limit * 4, 200) });
        break;
      default:
        // Treat unrecognized category as a search term
        markets = await fetchKalshiMarkets({ search: category, limit });
    }

    if (search) {
      const q = search.toLowerCase();
      markets = markets.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.ticker.toLowerCase().includes(q),
      );
    }

    // Sort by 24h volume descending, then slice to limit
    markets = markets
      .sort((a, b) => (b.volume24h || b.volume) - (a.volume24h || a.volume))
      .slice(0, limit);

    const body = {
      success:   true,
      markets,
      count:     markets.length,
      category,
      timestamp: new Date().toISOString(),
      configured: !!(process.env.KALSHI_ACCESS_KEY || process.env.KALSHI_API_KEY_ID),
    };

    // Store in route cache
    ROUTE_CACHE.set(cacheKey, { data: body, expires: Date.now() + ROUTE_TTL });

    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': CDN_CACHE },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API/kalshi/markets] Error:', msg);

    const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('rate limit');
    const status429   = isRateLimit ? 429 : 500;
    const retryAfter  = isRateLimit ? '60' : undefined;

    return NextResponse.json(
      {
        success: false,
        error:   isRateLimit
          ? 'Kalshi rate limit reached. Try again in ~60 seconds.'
          : `Failed to fetch markets: ${msg}`,
        markets:   [],
        rateLimited: isRateLimit,
      },
      {
        status:  isRateLimit ? 503 : 500,
        headers: {
          ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
