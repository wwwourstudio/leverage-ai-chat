import { NextRequest, NextResponse } from 'next/server';
import { getMarketByTicker, kalshiMarketToCard } from '@/lib/kalshi-client';

/**
 * GET /api/kalshi/live?ticker=<TICKER>
 *
 * Returns the latest REST price snapshot for a Kalshi market.
 * Used by KalshiCard as a live-price fallback when the WebSocket is unavailable.
 *
 * Response shape mirrors KalshiLivePrice from lib/store/kalshi-store.ts so the
 * client can hydrate the same price fields whether data arrived via WS or REST.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker');
  if (!ticker) {
    return NextResponse.json({ success: false, error: 'ticker param required' }, { status: 400 });
  }

  try {
    const market = await getMarketByTicker(ticker.toUpperCase());
    if (!market) {
      return NextResponse.json({ success: false, error: `Market ${ticker} not found` }, { status: 404 });
    }

    // Normalise to the same shape as KalshiLivePrice (WS store type)
    const yesBid   = market.yesBid   ?? 0;
    const yesAsk   = market.yesAsk   ?? 0;
    const noBid    = market.noBid    ?? 0;
    const noAsk    = market.noAsk    ?? 0;
    const volume   = market.volume   ?? 0;
    const volume24h = market.volume24h ?? 0;
    const lastPrice = market.lastPrice ?? (yesBid > 0 && yesAsk > 0 ? Math.round((yesBid + yesAsk) / 2) : 50);
    const yesMid    = yesBid > 0 && yesAsk > 0 ? Math.round((yesBid + yesAsk) / 2) : lastPrice;

    return NextResponse.json({
      success: true,
      ticker: market.ticker,
      title: market.title,
      yesBid,
      yesAsk,
      noBid,
      noAsk,
      volume,
      volume24h,
      lastPrice,
      yesMid,
      timestamp: new Date().toISOString(),
      card: kalshiMarketToCard(market),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[v0] [API/kalshi/live] Error fetching ${ticker}:`, msg);
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
