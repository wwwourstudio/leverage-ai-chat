import { NextRequest, NextResponse } from 'next/server';
import { detectArbitrageFromContext } from '@/lib/arbitrage/index';

export const runtime = 'nodejs';
export const maxDuration = 20;

/**
 * GET /api/arbitrage?sport=basketball_nba
 *
 * Returns live arbitrage opportunities detected across bookmakers.
 * Mirrors the shape expected by arbitrage-dashboard.tsx:
 *   { opportunities: ArbitrageOpportunity[] }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') || undefined;

    const cards = await detectArbitrageFromContext(sport);

    // Separate true arbitrage entries from plain odds cards
    const opportunities = cards
      .filter((c: any) => c.type === 'arbitrage' || c.data?.isArbitrage === true)
      .map((c: any) => ({
        sport: c.data?.sport ?? c.category ?? 'Unknown',
        event: c.title ?? '',
        homeTeam: c.data?.homeTeam ?? '',
        awayTeam: c.data?.awayTeam ?? '',
        gameTime: c.data?.gameTime ?? new Date().toISOString(),
        marketType: c.data?.marketType ?? 'h2h',
        bestHomeOdds: c.data?.bestHomeOdds ?? 0,
        bestHomeBook: c.data?.bestHomeBook ?? '',
        bestAwayOdds: c.data?.bestAwayOdds ?? 0,
        bestAwayBook: c.data?.bestAwayBook ?? '',
        impliedProbabilities: c.data?.impliedProbabilities ?? { home: 0, away: 0, total: 0 },
        profitPercentage: c.data?.profitPercentage ?? 0,
        stake: c.data?.stake ?? 100,
        bets: c.data?.bets ?? [],
        vigorish: c.data?.vigorish ?? 0,
        isArbitrage: true,
        confidence: c.data?.confidence ?? 'medium',
        allBooks: c.data?.allBooks ?? [],
      }));

    return NextResponse.json({ success: true, opportunities });
  } catch (err) {
    console.error('[API/arbitrage] Error:', err);
    return NextResponse.json(
      { success: false, opportunities: [], error: err instanceof Error ? err.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
