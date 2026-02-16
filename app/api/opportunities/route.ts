import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'edge', 'arbitrage', 'sharp', or 'all'
  const sport = searchParams.get('sport');
  const limit = parseInt(searchParams.get('limit') || '50');
  
  const supabase = await createClient();

    if (type === 'edge' || type === 'all' || !type) {
      // Fetch edge opportunities
      let query = supabase
        .from('edge_opportunities')
        .select('*')
        .gte('confidence_score', 0.5)
        .order('edge', { ascending: false })
        .limit(limit);

      if (sport) {
        query = query.eq('sport', sport);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[API] Edge opportunities error:', error);
      }

      return NextResponse.json({
        success: true,
        opportunities: data || [],
        count: data?.length || 0,
        type: 'edge'
      });
    }

    if (type === 'arbitrage') {
      // Fetch arbitrage opportunities
      let query = supabase
        .from('arbitrage_opportunities')
        .select('*')
        .eq('status', 'active')
        .order('profit_percentage', { ascending: false })
        .limit(limit);

      if (sport) {
        query = query.eq('sport', sport);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[API] Arbitrage opportunities error:', error);
      }

      return NextResponse.json({
        success: true,
        opportunities: data?.map(opp => ({
          event: opp.event,
          sport: opp.sport,
          homeTeam: opp.home_team,
          awayTeam: opp.away_team,
          gameTime: opp.game_time,
          profitPercentage: opp.profit_percentage,
          bestHomeBook: opp.best_home_book,
          bestAwayBook: opp.best_away_book
        })) || [],
        count: data?.length || 0,
        type: 'arbitrage'
      });
    }

    if (type === 'sharp') {
      // Fetch sharp signals
      let query = supabase
        .from('sharp_signals')
        .select('*')
        .in('signal_type', ['steam', 'reverse_line_move'])
        .gte('magnitude', 10)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (sport) {
        query = query.eq('sport', sport);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[API] Sharp signals error:', error);
      }

      return NextResponse.json({
        success: true,
        opportunities: data || [],
        count: data?.length || 0,
        type: 'sharp'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid type parameter'
    }, { status: 400 });

  } catch (error) {
    console.error('[API] /api/opportunities error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
