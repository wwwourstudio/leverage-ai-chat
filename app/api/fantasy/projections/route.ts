import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';

// ============================================================================
// GET /api/fantasy/projections — Fetch player projections
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') || 'nfl';
    const position = searchParams.get('position');
    const season = searchParams.get('season') || String(new Date().getFullYear());
    const week = searchParams.get('week');
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

    let query = supabase
      .from('fantasy_projections')
      .select('*')
      .eq('sport', sport)
      .eq('season_year', parseInt(season))
      .order('vbd', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (position) {
      query = query.eq('position', position);
    }

    if (week) {
      query = query.eq('week', parseInt(week));
    } else {
      query = query.is('week', null);
    }

    const { data: projections, error } = await query;

    if (error) {
      console.error('[API/fantasy/projections] Error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch projections' },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    return NextResponse.json({
      success: true,
      sport,
      season: parseInt(season),
      count: projections?.length || 0,
      projections: projections || [],
    });
  } catch (error) {
    console.error('[API/fantasy/projections] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

// ============================================================================
// POST /api/fantasy/projections — Upload/update projections
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    const body = await request.json();
    const { projections } = body;

    if (!Array.isArray(projections) || projections.length === 0) {
      return NextResponse.json(
        { success: false, error: 'projections must be a non-empty array' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Validate and prepare records
    const records = projections.map((p: any) => ({
      sport: p.sport,
      player_name: p.playerName,
      player_id: p.playerId || null,
      position: p.position,
      season_year: p.seasonYear || new Date().getFullYear(),
      week: p.week || null,
      projection_source: p.projectionSource || 'user',
      stats: p.stats || {},
      fantasy_points: p.fantasyPoints || 0,
      adp: p.adp || null,
      vbd: p.vbd || null,
      tier: p.tier || null,
    }));

    const { data, error } = await supabase
      .from('fantasy_projections')
      .upsert(records, {
        onConflict: 'sport,player_name,season_year,week,projection_source',
      })
      .select();

    if (error) {
      console.error('[API/fantasy/projections] Upsert error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save projections' },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('[API/fantasy/projections] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
