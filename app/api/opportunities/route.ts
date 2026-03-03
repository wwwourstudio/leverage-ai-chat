import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * GET /api/opportunities?type=edge|arbitrage
 *
 * Returns betting opportunities from Supabase, falling back to live detection
 * when no stored opportunities exist.
 *
 * Response shapes:
 *   type=edge      → { opportunities: EdgeOpportunity[] }
 *   type=arbitrage → { opportunities: ArbOpportunity[] }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'edge';

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    if (type === 'arbitrage') {
      // Try stored arbitrage opportunities first
      const { data: stored, error } = await supabase
        .from('arbitrage_opportunities')
        .select('*')
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('profit_margin', { ascending: false })
        .limit(20);

      if (!error && stored && stored.length > 0) {
        const opportunities = stored.map((row: any) => ({
          event: `${row.away_team} @ ${row.home_team}`,
          sport: row.sport ?? 'Unknown',
          homeTeam: row.home_team,
          awayTeam: row.away_team,
          gameTime: row.game_time ?? row.detected_at,
          profitPercentage: (row.profit_margin ?? 0) * 100,
          totalStake: row.total_stake ?? 100,
        }));
        return NextResponse.json({ success: true, opportunities });
      }

      // Fallback: run live arbitrage detection
      const { detectArbitrageFromContext } = await import('@/lib/arbitrage/index');
      const cards = await detectArbitrageFromContext(undefined);
      const opportunities = cards
        .filter((c: any) => c.type === 'arbitrage' || c.data?.isArbitrage)
        .map((c: any) => ({
          event: c.title ?? '',
          sport: c.data?.sport ?? c.category ?? 'Unknown',
          homeTeam: c.data?.homeTeam ?? '',
          awayTeam: c.data?.awayTeam ?? '',
          gameTime: c.data?.gameTime ?? new Date().toISOString(),
          profitPercentage: c.data?.profitPercentage ?? 0,
          totalStake: c.data?.stake ?? 100,
        }));
      return NextResponse.json({ success: true, opportunities });
    }

    // Default: type=edge — value bets with positive EV
    const { data: edgeData, error: edgeError } = await supabase
      .from('bet_allocations')
      .select('id, sport, matchup, edge, bookmaker, market_odds, confidence_score, created_at, status')
      .in('status', ['pending', 'placed'])
      .gt('edge', 0)
      .order('edge', { ascending: false })
      .limit(20);

    if (!edgeError && edgeData && edgeData.length > 0) {
      const opportunities = edgeData.map((row: any) => {
        const parts = (row.matchup ?? ' @ ').split(' @ ');
        return {
          id: row.id,
          sport: row.sport ?? 'Unknown',
          event: row.matchup ?? '',
          home_team: parts[1] ?? '',
          away_team: parts[0] ?? '',
          game_time: row.created_at,
          edge: row.edge ?? 0,
          bookmaker: row.bookmaker ?? '',
          market_odds: row.market_odds ?? 0,
          confidence_score: row.confidence_score ?? 0.5,
          created_at: row.created_at,
        };
      });
      return NextResponse.json({ success: true, opportunities });
    }

    // No stored data — return empty set so feed shows "no opportunities"
    return NextResponse.json({ success: true, opportunities: [] });
  } catch (err) {
    console.error('[API/opportunities] Error:', err);
    return NextResponse.json(
      { success: false, opportunities: [], error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}
