import { NextResponse } from 'next/server';
import { fetchTopMarketsByVolume, fetchKalshiMarketsWithRetry } from '@/lib/kalshi';

export const revalidate = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 50);

  try {
    let markets = await fetchTopMarketsByVolume(limit);

    // Fallback: if volume-ranked fetch returns too few results, broaden the search
    if (markets.length < limit) {
      const broad = await fetchKalshiMarketsWithRetry({ status: 'open', limit: 200, maxRetries: 2 });
      const ranked = broad
        .sort((a, b) => (b.volume24h || b.volume || 0) - (a.volume24h || a.volume || 0))
        .slice(0, limit);
      if (ranked.length > markets.length) markets = ranked;
    }

    return NextResponse.json({ success: true, count: markets.length, markets });
  } catch (err) {
    console.error('[API/kalshi/trending] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Trending markets temporarily unavailable', fallback: true, markets: [] },
      { status: 503 }
    );
  }
}
