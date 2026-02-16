import { NextResponse } from 'next/server';
import { detectArbitrageOpportunities } from '@/lib/arbitrage-detector';
import { getOddsWithCache } from '@/lib/unified-odds-fetcher';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const SPORTS = ['americanfootball_nfl', 'basketball_nba', 'icehockey_nhl', 'baseball_mlb'];

export async function GET(request: Request) {
  try {
    console.log('[API] /api/arbitrage - Fetching opportunities');

    // Fetch odds for all sports in parallel
    const allOddsPromises = SPORTS.map(sport =>
      getOddsWithCache(sport, { useCache: true, storeResults: false })
        .then(odds => ({ sport, odds }))
        .catch(err => {
          console.error(`[API] Error fetching ${sport}:`, err);
          return { sport, odds: [] };
        })
    );

    const allOddsResults = await Promise.all(allOddsPromises);
    
    // Detect arbitrage across all games
    const allOpportunities = [];
    
    for (const { sport, odds } of allOddsResults) {
      if (odds && odds.length > 0) {
        const opportunities = detectArbitrageOpportunities(odds);
        allOpportunities.push(...opportunities);
      }
    }

    // Sort by profit percentage
    allOpportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);

    // Store in Supabase
    if (allOpportunities.length > 0) {
      try {
        const supabase = await createClient();
        const rows = allOpportunities.map(opp => ({
          sport: opp.sport,
          event: opp.event,
          home_team: opp.homeTeam,
          away_team: opp.awayTeam,
          game_time: opp.gameTime,
          market_type: opp.marketType,
          profit_percentage: opp.profitPercentage,
          total_stake: opp.stake,
          best_home_odds: opp.bestHomeOdds,
          best_home_book: opp.bestHomeBook,
          best_away_odds: opp.bestAwayOdds,
          best_away_book: opp.bestAwayBook,
          status: 'active',
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min expiry
        }));

        await supabase.from('arbitrage_opportunities').upsert(rows, {
          onConflict: 'event,market_type'
        });

        console.log(`[API] Stored ${rows.length} arbitrage opportunities in Supabase`);
      } catch (error) {
        console.error('[API] Supabase storage error:', error);
      }
    }

    console.log(`[API] Found ${allOpportunities.length} arbitrage opportunities`);

    return NextResponse.json({
      success: true,
      opportunities: allOpportunities,
      count: allOpportunities.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API] /api/arbitrage error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch arbitrage opportunities' },
      { status: 500 }
    );
  }
}
