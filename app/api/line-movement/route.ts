import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');

    if (!gameId) {
      return NextResponse.json(
        { error: 'gameId parameter required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Fetch line movement history from Supabase
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

  } catch (error) {
    console.error('[API] /api/line-movement error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
