import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * GET /api/props?sport=basketball_nba
 *
 * Returns player prop markets from the player-props service.
 * Used by OpportunitiesFeed to enrich the feed with prop bets.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get('sport') || 'basketball_nba';

  try {
    const { fetchPlayerProps } = await import('@/lib/player-props-service');

    const props = await fetchPlayerProps({
      sport,
      useCache: true,
      storeResults: false,
    });

    return NextResponse.json({ success: true, props, count: props.length });
  } catch (err) {
    console.error('[API/props] Error:', err);
    // Return empty props rather than 500 so OpportunitiesFeed degrades cleanly
    return NextResponse.json({ success: true, props: [], count: 0 });
  }
}
