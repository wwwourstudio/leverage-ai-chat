import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';
import { isSupabaseConfigured } from '@/lib/config';

// ============================================================================
// GET /api/dfs?date=2026-03-30&position=hitter&sort=dk_pts_mean&limit=25
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Supabase not configured', projections: [] },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE },
      );
    }

    const { searchParams } = new URL(request.url);
    const date     = searchParams.get('date')?.trim() ?? new Date().toISOString().slice(0, 10);
    const position = searchParams.get('position')?.trim() ?? '';
    const sort     = searchParams.get('sort')?.trim() ?? 'dk_pts_mean';
    const limit    = Math.min(Number(searchParams.get('limit')) || 25, 100);

    const supabase = await createClient();

    // Allowed sort columns to prevent injection
    const ALLOWED_SORTS = ['dk_pts_mean', 'matchup_score', 'p90', 'p50', 'park_factor'];
    const sortCol = ALLOWED_SORTS.includes(sort) ? sort : 'dk_pts_mean';

    let query = supabase
      .from('projections')
      .select('player_id, player_name, game_date, player_type, dk_pts_mean, matchup_score, p10, p50, p90, park_factor, weather_adj')
      .eq('game_date', date)
      .order(sortCol, { ascending: false })
      .limit(limit);

    if (position) {
      query = query.ilike('player_type', `%${position}%`);
    }

    const { data: projections, error } = await query;

    if (error) {
      console.error('[API/dfs] Projections query error:', error.message);
      return NextResponse.json(
        { success: false, error: error.message, projections: [] },
        { status: HTTP_STATUS.INTERNAL_ERROR },
      );
    }

    return NextResponse.json({
      success: true,
      projections: projections ?? [],
      date,
      sort: sortCol,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API/dfs] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        projections: [],
        timestamp: new Date().toISOString(),
      },
      { status: HTTP_STATUS.INTERNAL_ERROR },
    );
  }
}
