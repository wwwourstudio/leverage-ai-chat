import { NextResponse } from 'next/server';
import { fetchKalshiMarkets, fetchSportsMarkets, getMarketByTicker, kalshiMarketToCard } from '@/lib/kalshi-client';

export const runtime = 'edge';

/**
 * GET /api/kalshi
 * Fetch Kalshi prediction markets
 * Query params:
 *  - category: Market category (NFL, NBA, MLB, NHL, etc.)
 *  - ticker: Specific market ticker
 *  - sport: Filter by sport (converts to category)
 *  - limit: Number of markets to return (default: 10)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const ticker = searchParams.get('ticker');
    const sport = searchParams.get('sport');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    console.log('[v0] [API] [KALSHI] Request:', { category, ticker, sport, limit });
    
    // If ticker is provided, fetch specific market
    if (ticker) {
      const market = await getMarketByTicker(ticker);
      
      if (!market) {
        return NextResponse.json({
          success: false,
          error: 'Market not found',
          markets: []
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        markets: [market],
        count: 1,
        timestamp: new Date().toISOString()
      });
    }
    
    // Map sport to category if provided
    let finalCategory = category;
    if (sport && !category) {
      const sportCategoryMap: Record<string, string> = {
        nfl: 'NFL',
        nba: 'NBA',
        mlb: 'MLB',
        nhl: 'NHL',
        americanfootball_nfl: 'NFL',
        basketball_nba: 'NBA',
        baseball_mlb: 'MLB',
        icehockey_nhl: 'NHL',
      };
      finalCategory = sportCategoryMap[sport.toLowerCase()];
    }
    
    // Fetch markets based on category or all sports
    let markets;
    if (finalCategory) {
      markets = await fetchKalshiMarkets({ category: finalCategory, limit });
    } else {
      markets = await fetchSportsMarkets();
    }
    
    console.log(`[v0] [API] [KALSHI] ✓ Returning ${markets.length} markets`);
    
    return NextResponse.json({
      success: true,
      markets,
      count: markets.length,
      category: finalCategory || 'all',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[v0] [API] [KALSHI] Error:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      markets: []
    }, { status: 500 });
  }
}

/**
 * POST /api/kalshi
 * Fetch Kalshi markets and convert to cards
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sport, category, limit = 3 } = body;
    
    console.log('[v0] [API] [KALSHI] POST Request:', { sport, category, limit });
    
    // Map sport to category
    let finalCategory = category;
    if (sport && !category) {
      const sportCategoryMap: Record<string, string> = {
        nfl: 'NFL',
        nba: 'NBA',
        mlb: 'MLB',
        nhl: 'NHL',
        americanfootball_nfl: 'NFL',
        basketball_nba: 'NBA',
        baseball_mlb: 'MLB',
        icehockey_nhl: 'NHL',
      };
      finalCategory = sportCategoryMap[sport.toLowerCase()];
    }
    
    // Fetch markets
    const markets = await fetchKalshiMarkets({ 
      category: finalCategory, 
      limit 
    });
    
    // Convert to cards
    const cards = markets.map(kalshiMarketToCard);
    
    console.log(`[v0] [API] [KALSHI] ✓ Returning ${cards.length} cards`);
    
    return NextResponse.json({
      success: true,
      cards,
      count: cards.length,
      dataSources: ['Kalshi Prediction Markets (Real-time)'],
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[v0] [API] [KALSHI] Error:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      cards: []
    }, { status: 500 });
  }
}
