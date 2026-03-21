/**
 * GET /api/kalshi/market/[ticker]
 *
 * Single market lookup by ticker with real-time price.
 * No auth required for public market data.
 * Includes edge calculation when model probability is provided.
 *
 * Query params:
 *  modelProb - optional float [0,1] for edge calculation
 */

import { NextResponse } from 'next/server';
import { getMarketByTicker } from '@/lib/kalshi/index';
import { KalshiClient } from '@/lib/kalshi/kalshiClient';

export const runtime = 'nodejs';

// Per-ticker cache: 30s TTL (prices move fast)
const TICKER_CACHE = new Map<string, { data: unknown; expires: number }>();
const TICKER_TTL   = 30_000;

export async function GET(
  request: Request,
  { params }: { params: { ticker: string } },
) {
  const ticker    = params.ticker?.toUpperCase();
  const { searchParams } = new URL(request.url);
  const modelProb = parseFloat(searchParams.get('modelProb') || 'NaN');

  if (!ticker) {
    return NextResponse.json({ success: false, error: 'Ticker is required' }, { status: 400 });
  }

  // Check per-ticker cache
  const cached = TICKER_CACHE.get(ticker);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }

  try {
    const market = await getMarketByTicker(ticker);

    if (!market) {
      return NextResponse.json(
        { success: false, error: `Market "${ticker}" not found`, market: null },
        { status: 404 },
      );
    }

    // Compute edge when caller provides a model probability
    let edge: ReturnType<typeof KalshiClient.computeEdge> | null = null;
    if (!isNaN(modelProb) && modelProb >= 0 && modelProb <= 1) {
      edge = KalshiClient.computeEdge(modelProb, market.yesBid, market.yesAsk);
    }

    const kalshiUrl = `https://kalshi.com/markets/${market.eventTicker || ticker}/${ticker}`;

    const body = {
      success: true,
      market,
      edge,
      kalshiUrl,
      timestamp: new Date().toISOString(),
    };

    TICKER_CACHE.set(ticker, { data: body, expires: Date.now() + TICKER_TTL });

    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[API/kalshi/market/${ticker}] Error:`, msg);
    return NextResponse.json(
      { success: false, error: msg, market: null },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
