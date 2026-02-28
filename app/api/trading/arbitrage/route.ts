import { NextRequest, NextResponse } from 'next/server';
import { detectArbitrageFromContext } from '@/lib/arbitrage/index';

export const runtime = 'nodejs';
export const maxDuration = 20;

/**
 * GET /api/trading/arbitrage?sport=basketball_nba&minProfit=0.01
 *
 * Scans live odds across books and returns arbitrage opportunities.
 * Falls back to live odds if no arb is found.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') || undefined;

    const cards = await detectArbitrageFromContext(sport);

    const arbs = cards.filter(c => c.type === 'arbitrage');
    const oddsCards = cards.filter(c => c.type !== 'arbitrage');

    return NextResponse.json({
      success: true,
      data: {
        arbitrageCount: arbs.length,
        arbitrageOpportunities: arbs,
        liveOddsCards: oddsCards,
        scannedAt: new Date().toISOString(),
        sport: sport ?? 'all',
      },
    });
  } catch (err) {
    console.error('[v0] [API/trading/arbitrage] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Arbitrage scan failed' },
      { status: 500 }
    );
  }
}
