import { NextResponse } from 'next/server';

export const revalidate = 30;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  if (!ticker) {
    return NextResponse.json({ success: false, error: 'ticker param required' }, { status: 400 });
  }

  try {
    const apiKey = process.env.KALSHI_ACCESS_KEY ?? process.env.KALSHI_API_KEY_ID ?? process.env.KALSHI_API_KEY ?? '';
    const res = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/markets/${encodeURIComponent(ticker)}/orderbook`,
      {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        next: { revalidate: 30 },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Kalshi returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, ticker, orderbook: data });
  } catch (err) {
    console.error(`[API/kalshi/orderbook/${ticker}] Error:`, err);
    return NextResponse.json(
      { success: false, error: 'Orderbook temporarily unavailable', fallback: true },
      { status: 503 }
    );
  }
}
