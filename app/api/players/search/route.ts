import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';
import { isSupabaseConfigured } from '@/lib/config';

// ── GET /api/players/search?q=judge&sport=mlb&limit=10 ────────────────────────

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Supabase not configured', players: [] },
      { status: HTTP_STATUS.SERVICE_UNAVAILABLE },
    );
  }

  const { searchParams } = new URL(request.url);
  const q     = searchParams.get('q')?.trim() ?? '';
  const sport = searchParams.get('sport')?.trim() ?? '';
  const limit = Math.min(Number(searchParams.get('limit')) || 10, 50);

  try {
    const supabase = await createClient();

    let query = supabase
      .from('nfbc_adp')
      .select('id, sport, rank, display_name, team, positions, adp')
      .order('rank', { ascending: true })
      .limit(limit);

    if (q) {
      query = query.ilike('display_name', `%${q}%`);
    }
    if (sport) {
      query = query.ilike('sport', `%${sport}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API/players/search] Query error:', error.message);
      return NextResponse.json(
        { success: false, error: error.message, players: [] },
        { status: HTTP_STATUS.INTERNAL_ERROR },
      );
    }

    return NextResponse.json({
      success: true,
      players: data ?? [],
    });
  } catch (err) {
    console.error('[API/players/search] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
        players: [],
      },
      { status: HTTP_STATUS.INTERNAL_ERROR },
    );
  }
}
