import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateSportKey } from '@/lib/odds/index';
import { HTTP_STATUS } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * GET /api/props/latest
 *
 * Returns the latest player prop lines. Tries the normalized api.player_props
 * table first; falls back to the existing api.player_props_markets table.
 *
 * Query params:
 *   sport   — sport key, e.g. "basketball_nba"  (optional)
 *   player  — partial player name filter          (optional)
 *   market  — market key, e.g. "batter_home_runs" (optional)
 *   limit   — max rows returned (default 50)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sportParam  = searchParams.get('sport') ?? undefined;
  const player      = searchParams.get('player') ?? undefined;
  const market      = searchParams.get('market') ?? undefined;
  const limit       = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);

  let normalizedSport: string | undefined;
  if (sportParam) {
    const v = validateSportKey(sportParam);
    if (!v.isValid || !v.normalizedKey) {
      return NextResponse.json(
        { success: false, error: `Unknown sport: ${sportParam}`, props: [] },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    normalizedSport = v.normalizedKey;
  }

  try {
    const supabase = await createClient();

    // ── Primary: normalized api.player_props ────────────────────────────────
    let query = supabase
      .schema('api')
      .from('player_props')
      .select(`
        id,
        line,
        over_price,
        under_price,
        updated_at,
        game:games ( sport, home_team, away_team, start_time ),
        player:players ( name, team, position ),
        market:prop_markets ( market_key, description ),
        sportsbook:sportsbooks ( key, name )
      `)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (normalizedSport) {
      query = query.eq('game.sport', normalizedSport);
    }
    if (market) {
      query = query.eq('market.market_key', market);
    }

    const { data: propsRows, error } = await query;

    if (!error && propsRows && propsRows.length > 0) {
      const props = propsRows.map((row: any) => ({
        sport:       row.game?.sport ?? normalizedSport,
        home_team:   row.game?.home_team,
        away_team:   row.game?.away_team,
        start_time:  row.game?.start_time,
        player_name: row.player?.name,
        team:        row.player?.team,
        position:    row.player?.position,
        market:      row.market?.market_key,
        description: row.market?.description,
        sportsbook:  row.sportsbook?.key,
        line:        row.line,
        over_price:  row.over_price,
        under_price: row.under_price,
        updated_at:  row.updated_at,
      }));

      // Optional player name filter (client-side since it's a join column)
      const filtered = player
        ? props.filter(p =>
            p.player_name?.toLowerCase().includes(player.toLowerCase())
          )
        : props;

      return NextResponse.json({
        success: true,
        props: filtered,
        count: filtered.length,
        source: 'normalized',
        timestamp: new Date().toISOString(),
      });
    }

    // ── Fallback: existing player_props_markets table ────────────────────────
    let legacyQuery = supabase
      .schema('api')
      .from('player_props_markets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (normalizedSport) {
      legacyQuery = legacyQuery.eq('sport', normalizedSport);
    }
    if (player) {
      legacyQuery = legacyQuery.ilike('player_name', `%${player}%`);
    }
    if (market) {
      legacyQuery = legacyQuery.eq('stat_type', market);
    }

    const { data: legacyRows } = await legacyQuery;

    const props = (legacyRows ?? []).map((row: any) => ({
      sport:       row.sport,
      game_id:     row.game_id,
      player_name: row.player_name,
      market:      row.stat_type,
      sportsbook:  row.bookmaker,
      line:        row.line,
      over_price:  row.over_odds,
      under_price: row.under_odds,
      game_time:   row.game_time,
      home_team:   row.home_team,
      away_team:   row.away_team,
    }));

    return NextResponse.json({
      success: true,
      props,
      count: props.length,
      source: 'player_props_markets',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[API/props/latest] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch props',
        props: [],
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
