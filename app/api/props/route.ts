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
    // Return success:false with empty props so callers can detect errors
    // while OpportunitiesFeed still degrades gracefully (checks propsData.props array)
    return NextResponse.json({
      success: false,
      props: [],
      count: 0,
      error: err instanceof Error ? err.message : 'Failed to fetch player props',
    });
  }
}
