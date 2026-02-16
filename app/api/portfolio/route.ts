import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch active capital state
    const { data: capitalState } = await supabase
      .from('capital_state')
      .select('*')
      .eq('active', true)
      .single();

    if (!capitalState) {
      return NextResponse.json(
        { error: 'No active capital state found' },
        { status: 404 }
      );
    }

    // Fetch all bet allocations
    const { data: positions, error: positionsError } = await supabase
      .from('bet_allocations')
      .select('*')
      .order('created_at', { ascending: false });

    if (positionsError) {
      console.error('[API] Portfolio positions error:', positionsError);
      return NextResponse.json(
        { error: 'Failed to fetch positions' },
        { status: 500 }
      );
    }

    // Calculate portfolio stats
    const allocatedCapital = positions
      ?.filter(p => p.status === 'pending' || p.status === 'placed')
      .reduce((sum, p) => sum + (p.allocated_capital || 0), 0) || 0;

    const settledPositions = positions?.filter(p => 
      p.status === 'won' || p.status === 'lost' || p.status === 'void'
    ) || [];

    const totalReturn = settledPositions.reduce((sum, p) => 
      sum + (p.actual_return || 0), 0
    );

    const wonPositions = settledPositions.filter(p => p.status === 'won').length;
    const winRate = settledPositions.length > 0 
      ? (wonPositions / settledPositions.length) * 100 
      : 0;

    const roi = capitalState.total_capital > 0 
      ? (totalReturn / capitalState.total_capital) * 100 
      : 0;

    // Calculate Sharpe Ratio (simplified)
    const returns = settledPositions.map(p => 
      (p.actual_return || 0) / (p.allocated_capital || 1)
    );
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / (returns.length || 1);
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length || 1);
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    const stats = {
      totalCapital: capitalState.total_capital,
      allocatedCapital,
      availableCapital: capitalState.total_capital - allocatedCapital,
      totalPositions: positions?.length || 0,
      activePositions: positions?.filter(p => p.status === 'pending' || p.status === 'placed').length || 0,
      totalReturn,
      roi,
      sharpeRatio,
      winRate
    };

    return NextResponse.json({
      success: true,
      positions: positions || [],
      stats,
      capitalState: {
        totalCapital: capitalState.total_capital,
        riskBudget: capitalState.risk_budget,
        maxSinglePosition: capitalState.max_single_position,
        kellyScale: capitalState.kelly_scale
      }
    });

  } catch (error) {
    console.error('[API] /api/portfolio error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
