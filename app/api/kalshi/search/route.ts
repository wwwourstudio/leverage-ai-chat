import { NextResponse } from 'next/server';
import { fetchKalshiMarkets } from '@/lib/kalshi';

export const revalidate = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  if (!q) {
    return NextResponse.json(
      { success: false, error: 'q param required', markets: [] },
      { status: 400 }
    );
  }

  try {
    const markets = await fetchKalshiMarkets({ search: q, limit });
    return NextResponse.json({ success: true, count: markets.length, query: q, markets });
  } catch (err) {
    console.error('[API/kalshi/search] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Search temporarily unavailable', fallback: true, markets: [] },
      { status: 503 }
    );
  }
}
