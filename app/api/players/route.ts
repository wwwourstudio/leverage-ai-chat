import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';
import { isSupabaseConfigured } from '@/lib/config';

// ============================================================================
// GET /api/players?search=ohtani&sport=mlb&position=OF&limit=25
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Supabase not configured', players: [] },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE },
      );
    }

    const { searchParams } = new URL(request.url);
    const search   = searchParams.get('search')?.trim() ?? '';
    const sport    = searchParams.get('sport')?.trim() ?? '';
    const position = searchParams.get('position')?.trim() ?? '';
    const limit    = Math.min(Number(searchParams.get('limit')) || 25, 100);

    const supabase = await createClient();

    // Primary source: nfbc_adp (richest data with ADP + value metrics)
    let query = supabase
      .from('nfbc_adp')
      .select('id, sport, rank, player_name, display_name, adp, positions, team, value_delta, is_value_pick, auction_value, fetched_at, source')
      .order('rank', { ascending: true })
      .limit(limit);

    if (search) {
      query = query.ilike('player_name', `%${search}%`);
    }
    if (sport) {
      query = query.ilike('sport', `%${sport}%`);
    }
    if (position) {
      query = query.ilike('positions', `%${position}%`);
    }

    const { data: adpPlayers, error: adpError } = await query;

    if (adpError) {
      console.error('[API/players] nfbc_adp query error:', adpError.message);
      // Fall back to players table
      let fallbackQuery = supabase
        .from('players')
        .select('id, name, team_id, position, bats, throws, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(limit);

      if (search) {
        fallbackQuery = fallbackQuery.ilike('name', `%${search}%`);
      }
      if (position) {
        fallbackQuery = fallbackQuery.ilike('position', `%${position}%`);
      }

      const { data: fallbackPlayers, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        return NextResponse.json(
          { success: false, error: fallbackError.message, players: [] },
          { status: HTTP_STATUS.INTERNAL_ERROR },
        );
      }

      return NextResponse.json({
        success: true,
        players: fallbackPlayers ?? [],
        source: 'players',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      players: adpPlayers ?? [],
      source: 'nfbc_adp',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API/players] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        players: [],
        timestamp: new Date().toISOString(),
      },
      { status: HTTP_STATUS.INTERNAL_ERROR },
    );
  }
}
