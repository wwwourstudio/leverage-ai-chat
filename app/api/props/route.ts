import { NextResponse } from 'next/server';
import { fetchPlayerProps } from '@/lib/player-props-service';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');
    const propType = searchParams.get('propType');
    const useCache = searchParams.get('useCache') !== 'false';

    if (!sport) {
      return NextResponse.json(
        { error: 'sport parameter required' },
        { status: 400 }
      );
    }

    console.log(`[API] /api/props - Fetching ${sport} props, type: ${propType || 'all'}`);

    const props = await fetchPlayerProps({
      sport,
      propType: propType || undefined,
      useCache,
      storeResults: true
    });

    return NextResponse.json({
      success: true,
      props,
      count: props.length,
      sport,
      propType: propType || 'all',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API] /api/props error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player props' },
      { status: 500 }
    );
  }
}
