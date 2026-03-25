import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateSportKey } from '@/lib/odds/index';
import { HTTP_STATUS } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * GET /api/props/movers
 *
 * Returns player props with the biggest line changes in the requested window.
 * Compares api.player_props_history snapshots within the window against the
 * current api.player_props lines to compute delta.
 *
 * Query params:
 *   hours  — look-back window in hours (default 24, max 168)
 *   sport  — sport key filter (optional)
 *   limit  — max rows returned (default 20, max 100)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hours = Math.min(parseInt(searchParams.get('hours') ?? '24', 10) || 24, 168);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100);
  const sportParam = searchParams.get('sport') ?? undefined;

  let normalizedSport: string | undefined;
  if (sportParam) {
    const v = validateSportKey(sportParam);
    if (!v.isValid || !v.normalizedKey) {
      return NextResponse.json(
        { success: false, error: `Unknown sport: ${sportParam}`, movers: [] },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    normalizedSport = v.normalizedKey;
  }

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // ── Fetch historical snapshots in window ─────────────────────────────────
    const { data: histRows, error: histErr } = await supabase
      .schema('api')
      .from('player_props_history')
      .select(`
        player_id,
        market_id,
        sportsbook_id,
        game_id,
        line,
        over_price,
        under_price,
        timestamp
      `)
      .gt('timestamp', since)
      .order('timestamp', { ascending: true });

    if (histErr || !histRows || histRows.length === 0) {
      // Gracefully return empty when tables don't exist yet
      return NextResponse.json({
        success: true,
        movers: [],
        count: 0,
        hours,
        note: histErr
          ? 'Run migration add-normalized-odds-schema.sql to enable prop movement tracking'
          : 'No prop movements in this window',
        timestamp: new Date().toISOString(),
      });
    }

    // ── Fetch current lines ─────────────────────────────────────────────────
    const playerIds  = [...new Set(histRows.map((r: any) => r.player_id))];
    const marketIds  = [...new Set(histRows.map((r: any) => r.market_id))];

    const { data: currentRows } = await supabase
      .schema('api')
      .from('player_props')
      .select(`
        player_id, market_id, sportsbook_id, game_id, line,
        player:players ( name, team ),
        market:prop_markets ( market_key ),
        game:games ( sport )
      `)
      .in('player_id', playerIds)
      .in('market_id', marketIds);

    // Build current line map: player+market+sportsbook+game → line
    const currentMap = new Map<string, number>();
    for (const r of currentRows ?? []) {
      const k = `${r.player_id}|${r.market_id}|${r.sportsbook_id}|${r.game_id}`;
      currentMap.set(k, r.line as number);
    }

    // sport filter map from current rows
    const sportMap = new Map<string, string>();
    for (const r of currentRows ?? []) {
      const k = `${r.player_id}|${r.market_id}|${r.sportsbook_id}|${r.game_id}`;
      sportMap.set(k, (r as any).game?.sport ?? '');
    }

    // ── Compute oldest snapshot per key and delta vs current ────────────────
    const oldestMap = new Map<string, { line: number; timestamp: string }>();
    for (const h of histRows) {
      const k = `${h.player_id}|${h.market_id}|${h.sportsbook_id}|${h.game_id}`;
      if (!oldestMap.has(k)) {
        oldestMap.set(k, { line: h.line as number, timestamp: h.timestamp as string });
      }
    }

    // meta lookup for display
    const metaMap = new Map<string, { player_name: string; team: string; market_key: string }>();
    for (const r of currentRows ?? []) {
      const k = `${r.player_id}|${r.market_id}|${r.sportsbook_id}|${r.game_id}`;
      metaMap.set(k, {
        player_name: (r as any).player?.name ?? '',
        team:        (r as any).player?.team ?? '',
        market_key:  (r as any).market?.market_key ?? '',
      });
    }

    const moversAll: {
      player_name: string;
      team: string;
      market: string;
      sport: string;
      opening_line: number;
      current_line: number;
      line_change: number;
      since: string;
    }[] = [];

    for (const [k, oldest] of oldestMap) {
      const current = currentMap.get(k);
      if (current === undefined) continue;

      const lineChange = current - oldest.line;
      if (Math.abs(lineChange) < 0.5) continue; // skip negligible moves

      // Apply sport filter
      if (normalizedSport && sportMap.get(k) !== normalizedSport) continue;

      const meta = metaMap.get(k);
      moversAll.push({
        player_name:  meta?.player_name ?? '',
        team:         meta?.team ?? '',
        market:       meta?.market_key ?? '',
        sport:        sportMap.get(k) ?? '',
        opening_line: oldest.line,
        current_line: current,
        line_change:  lineChange,
        since:        oldest.timestamp,
      });
    }

    // Sort by absolute change descending
    moversAll.sort((a, b) => Math.abs(b.line_change) - Math.abs(a.line_change));
    const movers = moversAll.slice(0, limit);

    return NextResponse.json({
      success: true,
      movers,
      count: movers.length,
      hours,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[API/props/movers] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch prop movers',
        movers: [],
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
