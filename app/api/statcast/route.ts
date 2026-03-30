import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';
import { isSupabaseConfigured } from '@/lib/config';

export const runtime = 'nodejs';

// Allowlist prevents injection via the metric param
// These map to actual columns in api.hitter_splits
const ALLOWED_METRICS = [
  'barrel_rate',
  'hard_hit_rate',
  'avg_exit_velocity',
  'xslg',
  'hr_rate',
] as const;

type Metric = (typeof ALLOWED_METRICS)[number];

// ============================================================================
// GET /api/statcast?metric=barrel_rate&limit=25&player=ohtani&order=desc
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Supabase not configured', leaders: [] },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE },
      );
    }

    const { searchParams } = new URL(request.url);
    const rawMetric = searchParams.get('metric')?.trim() ?? 'barrel_rate';
    const metric: Metric = (ALLOWED_METRICS as readonly string[]).includes(rawMetric)
      ? (rawMetric as Metric)
      : 'barrel_rate';
    const limit  = Math.min(Number(searchParams.get('limit')) || 25, 100);
    const player = searchParams.get('player')?.trim() ?? '';
    const ascending = searchParams.get('order') === 'asc';

    const supabase = await createClient();

    let query = supabase
      .from('hitter_splits')
      .select('player_name, batter, season, pa, barrel_rate, hard_hit_rate, avg_exit_velocity, xslg, hr_rate')
      .eq('split_type', 'overall')
      .not(metric, 'is', null)
      .order(metric, { ascending })
      .limit(limit);

    if (player) {
      query = query.ilike('player_name', `%${player}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API/statcast] hitter_splits query error:', error.message);
      return NextResponse.json(
        { success: false, error: error.message, leaders: [] },
        { status: HTTP_STATUS.INTERNAL_ERROR },
      );
    }

    return NextResponse.json({
      success: true,
      leaders: data ?? [],
      metric,
      count: data?.length ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API/statcast] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        leaders: [],
        timestamp: new Date().toISOString(),
      },
      { status: HTTP_STATUS.INTERNAL_ERROR },
    );
  }
}
