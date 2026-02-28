import { NextRequest, NextResponse } from 'next/server';
import { runQuantAnalysis } from '@/lib/quant/quantEngine';
import type { PortfolioInput } from '@/lib/quant/quantEngine';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * POST /api/trading/quant
 *
 * Body:
 * {
 *   bankroll: number,
 *   legs: Array<{ id, label, americanOdds, modelProb, stake? }>,
 *   kellyFraction?: number,       // Default 0.25
 *   maxPositionPct?: number,      // Default 0.05
 *   simulations?: number,         // Monte Carlo runs, default 5000
 *   horizon?: number,             // Bets per sim, default 50
 *   priceSeries?: number[],       // Optional line history for regime detection
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { bankroll, legs, kellyFraction, maxPositionPct, simulations, horizon, priceSeries } = body;

    if (!bankroll || !Array.isArray(legs) || legs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'bankroll and legs array are required' },
        { status: 400 }
      );
    }

    if (typeof bankroll !== 'number' || bankroll <= 0) {
      return NextResponse.json(
        { success: false, error: 'bankroll must be a positive number' },
        { status: 400 }
      );
    }

    const portfolioInput: PortfolioInput = {
      bankroll,
      legs,
      kellyFraction: kellyFraction ?? 0.25,
      maxPositionPct: maxPositionPct ?? 0.05,
    };

    const analysis = runQuantAnalysis(
      portfolioInput,
      { simulations: simulations ?? 5_000, horizon: horizon ?? 50 },
      Array.isArray(priceSeries) && priceSeries.length >= 20 ? priceSeries : undefined
    );

    return NextResponse.json({ success: true, data: analysis });
  } catch (err) {
    console.error('[v0] [API/trading/quant] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Quant analysis failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trading/quant?bankroll=1000&odds=-180&prob=0.58
 * Quick single-leg Kelly calculation
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bankroll = parseFloat(searchParams.get('bankroll') ?? '1000');
    const odds = parseFloat(searchParams.get('odds') ?? '-110');
    const prob = parseFloat(searchParams.get('prob') ?? '0.55');
    const label = searchParams.get('label') ?? 'Bet';

    if (isNaN(bankroll) || isNaN(odds) || isNaN(prob) || prob <= 0 || prob >= 1) {
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
    }

    const analysis = runQuantAnalysis(
      { bankroll, legs: [{ id: '1', label, americanOdds: odds, modelProb: prob }], kellyFraction: 0.25 },
      { simulations: 2_000, horizon: 30 }
    );

    return NextResponse.json({ success: true, data: analysis });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}
