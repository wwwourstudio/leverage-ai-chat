import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');

    const supabase = await createClient();

    // If gameId provided, fetch movements for that game only
    if (gameId) {
      const { data, error } = await supabase
        .from('line_movement')
        .select('*')
        .eq('game_id', gameId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('[API] Line movement query error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch line movement' },
          { status: 500 }
        );
      }

      const movements = data?.map(row => ({
        timestamp: row.timestamp,
        homeOdds: row.home_odds,
        awayOdds: row.away_odds,
        bookmaker: row.bookmaker,
        homeSpread: row.home_spread,
        awaySpread: row.away_spread,
        overUnder: row.over_under
      })) || [];

      return NextResponse.json({
        success: true,
        movements,
        count: movements.length
      });
    }

    // Otherwise, fetch recent significant line movements (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('line_movement')
      .select('*')
      .gt('updated_at', oneDayAgo)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[API] Recent line movements query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch line movements' },
        { status: 500 }
      );
    }

    console.log(`[API] Returning ${data?.length || 0} recent line movements`);

    return NextResponse.json({
      success: true,
      movements: data || [],
      count: data?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API] /api/line-movement error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
