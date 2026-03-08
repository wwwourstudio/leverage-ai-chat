import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * GET /api/line-movement?gameId=<id>
 *
 * Returns line movement history for a specific game from the line_movement table.
 * Used by LineMovementChart to render odds movement over time.
 *
 * Response: { movements: LineMovement[] }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');

  if (!gameId) {
    return NextResponse.json({ movements: [] });
  }

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('line_movement')
      .select('recorded_at, home_odds, away_odds, bookmaker')
      .eq('game_id', gameId)
      .order('recorded_at', { ascending: true })
      .limit(50);

    if (error) {
      // Table may not exist or game not found — return empty gracefully
      console.warn('[API/line-movement] Query error:', error.message);
      return NextResponse.json({ movements: [] });
    }

    const movements = (data ?? []).map((row: any) => ({
      timestamp: row.recorded_at,
      homeOdds: row.home_odds ?? 0,
      awayOdds: row.away_odds ?? 0,
      bookmaker: row.bookmaker ?? 'unknown',
    }));

    return NextResponse.json({ success: true, movements });
  } catch (err) {
    console.error('[API/line-movement] Error:', err);
    return NextResponse.json({ movements: [] });
  }
}
