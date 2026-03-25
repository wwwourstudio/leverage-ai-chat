import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateSportKey } from '@/lib/odds/index';
import { HTTP_STATUS } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * GET /api/odds/latest
 *
 * Returns the latest normalized odds from api.odds joined with api.games
 * and api.sportsbooks. Falls back to live_odds_cache when the normalized
 * tables are empty (e.g. before the first ingest run).
 *
 * Query params:
 *   sport   — sport key, e.g. "basketball_nba"  (optional)
 *   market  — "h2h" | "spreads" | "totals"       (optional)
 *   limit   — max rows returned (default 50)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sportParam  = searchParams.get('sport') ?? undefined;
  const market      = searchParams.get('market') ?? undefined;
  const limit       = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);

  // Validate sport key if provided
  let normalizedSport: string | undefined;
  if (sportParam) {
    const v = validateSportKey(sportParam);
    if (!v.isValid || !v.normalizedKey) {
      return NextResponse.json(
        { success: false, error: `Unknown sport: ${sportParam}`, odds: [] },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    normalizedSport = v.normalizedKey;
  }

  try {
    const supabase = await createClient();

    // ── Primary: normalized api.odds table ──────────────────────────────────
    let query = supabase
      .schema('api')
      .from('odds')
      .select(`
        id,
        market,
        selection,
        line,
        price,
        updated_at,
        game:games ( sport, home_team, away_team, start_time ),
        sportsbook:sportsbooks ( key, name )
      `)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (normalizedSport) {
      // Filter via the joined games table
      query = query.eq('game.sport', normalizedSport);
    }
    if (market) {
      query = query.eq('market', market);
    }

    const { data: oddsRows, error } = await query;

    if (!error && oddsRows && oddsRows.length > 0) {
      const odds = oddsRows.map((row: any) => ({
        sport:      row.game?.sport ?? normalizedSport,
        home_team:  row.game?.home_team,
        away_team:  row.game?.away_team,
        start_time: row.game?.start_time,
        sportsbook: row.sportsbook?.key,
        market:     row.market,
        selection:  row.selection,
        line:       row.line,
        price:      row.price,
        updated_at: row.updated_at,
      }));

      return NextResponse.json({
        success: true,
        odds,
        count: odds.length,
        source: 'normalized',
        timestamp: new Date().toISOString(),
      });
    }

    // ── Fallback: live_odds_cache ────────────────────────────────────────────
    let cacheQuery = supabase
      .schema('api')
      .from('live_odds_cache')
      .select('sport_key, game_id, sport, bookmakers, expires_at')
      .gt('expires_at', new Date().toISOString())
      .limit(limit);

    if (normalizedSport) {
      cacheQuery = cacheQuery.eq('sport_key', normalizedSport);
    }

    const { data: cacheRows } = await cacheQuery;

    const odds = (cacheRows ?? []).map((row: any) => ({
      sport:      row.sport_key,
      game_id:    row.game_id,
      bookmakers: row.bookmakers,
      source:     'cache',
    }));

    return NextResponse.json({
      success: true,
      odds,
      count: odds.length,
      source: 'live_odds_cache',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[API/odds/latest] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch odds',
        odds: [],
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
