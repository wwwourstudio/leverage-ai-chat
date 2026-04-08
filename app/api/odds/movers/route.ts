import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * GET /api/odds/movers
 *
 * Returns the biggest game-level line movements within the requested window.
 * Uses the api.get_biggest_line_moves() SQL function; falls back to a direct
 * query of api.line_movement if the RPC call fails (e.g. migration not yet run).
 *
 * Query params:
 *   hours  — look-back window in hours (default 24, max 168)
 *   limit  — max rows returned (default 20, max 100)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hours = Math.min(parseInt(searchParams.get('hours') ?? '24', 10) || 24, 168);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100);

  try {
    const supabase = await createClient();

    // ── Primary: SQL function ────────────────────────────────────────────────
    const { data: rpcData, error: rpcError } = await (supabase as any)
      .schema('api')
      .rpc('get_biggest_line_moves', { hours });

    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      const movers = rpcData.slice(0, limit).map((row: any) => ({
        game_id:   row.game_id,
        market:    row.market,
        selection: row.selection,
        move:      Math.abs(Number(row.move)),
      }));

      return NextResponse.json({
        success: true,
        movers,
        count: movers.length,
        hours,
        timestamp: new Date().toISOString(),
      });
    }

    // ── Fallback: direct query ───────────────────────────────────────────────
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // api.line_movement columns: game_id_uuid, market_type, home_team, away_team,
    //   line_change, timestamp (actual schema — no game_id, movement, or detected_at)
    const { data: fallbackRows, error: fallbackErr } = await supabase
      .schema('api')
      .from('line_movement')
      .select('game_id_uuid, market_type, home_team, away_team, line_change, timestamp')
      .gt('timestamp', since)
      .order('line_change', { ascending: false })
      .limit(limit);

    if (fallbackErr) {
      // Table may not exist yet — return empty gracefully
      return NextResponse.json({
        success: true,
        movers: [],
        count: 0,
        hours,
        note: 'Line movement tracking not yet available',
        timestamp: new Date().toISOString(),
      });
    }

    const movers = (fallbackRows ?? []).map((row: any) => ({
      game_id:     row.game_id_uuid,
      market:      row.market_type,
      selection:   `${row.away_team} @ ${row.home_team}`,
      move:        Math.abs(Number(row.line_change)),
      detected_at: row.timestamp,
    }));

    return NextResponse.json({
      success: true,
      movers,
      count: movers.length,
      hours,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[API/odds/movers] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch movers',
        movers: [],
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
