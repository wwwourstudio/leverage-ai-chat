import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * GET /api/props/history
 *
 * Returns historical player prop line snapshots.
 *
 * Query params:
 *   player_name — partial player name filter  (required unless game_id provided)
 *   game_id     — game UUID                   (required unless player_name provided)
 *   market      — market key filter            (optional)
 *   from        — ISO timestamp lower bound    (optional)
 *   to          — ISO timestamp upper bound    (optional, default: now)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerName = searchParams.get('player_name') ?? undefined;
  const gameId     = searchParams.get('game_id')     ?? undefined;
  const market     = searchParams.get('market')      ?? undefined;
  const from       = searchParams.get('from')        ?? undefined;
  const to         = searchParams.get('to')          ?? new Date().toISOString();

  if (!playerName && !gameId) {
    return NextResponse.json(
      {
        success: false,
        error: 'At least one of player_name or game_id is required',
        history: [],
      },
      { status: HTTP_STATUS.BAD_REQUEST }
    );
  }

  try {
    const supabase = await createClient();

    // ── Primary: normalized api.player_props_history ────────────────────────
    let query = supabase
      .schema('api')
      .from('player_props_history')
      .select(`
        id,
        line,
        over_price,
        under_price,
        timestamp,
        player:players ( name, team, position ),
        market:prop_markets ( market_key, description ),
        sportsbook:sportsbooks ( key ),
        game:games ( sport, home_team, away_team, start_time )
      `)
      .order('timestamp', { ascending: false })
      .limit(200);

  if (gameId) {
      query = query.eq('game_id', gameId);
    }
    if (market) {
      query = query.eq('market.market_key', market);
    }
    if (from) {
      query = query.gte('timestamp', from);
    }
    query = query.lte('timestamp', to);

    const { data: rows, error } = await query;

    if (!error && rows) {
      // Apply player name filter (join column — filter client-side)
      const filtered = playerName
        ? rows.filter((r: any) =>
            r.player?.name?.toLowerCase().includes(playerName.toLowerCase())
          )
        : rows;

      const history = filtered.map((r: any) => ({
        player_name: r.player?.name,
        team:        r.player?.team,
        position:    r.player?.position,
        sport:       r.game?.sport,
        home_team:   r.game?.home_team,
        away_team:   r.game?.away_team,
        start_time:  r.game?.start_time,
        market:      r.market?.market_key,
        description: r.market?.description,
        sportsbook:  r.sportsbook?.key,
        line:        r.line,
        over_price:  r.over_price,
        under_price: r.under_price,
        timestamp:   r.timestamp,
      }));

      return NextResponse.json({
        success: true,
        history,
        count: history.length,
        source: 'normalized',
        timestamp: new Date().toISOString(),
      });
    }

    // ── Fallback: existing player_props_markets is not time-series; return empty ─
    return NextResponse.json({
      success: true,
      history: [],
      count: 0,
      note: 'Run migration add-normalized-odds-schema.sql to enable prop history tracking',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[API/props/history] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch prop history',
        history: [],
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
