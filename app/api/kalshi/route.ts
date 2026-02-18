import { NextResponse } from 'next/server';
import { fetchKalshiMarkets, fetchSportsMarkets, fetchElectionMarkets, getMarketByTicker, kalshiMarketToCard } from '@/lib/kalshi-client';

export const runtime = 'edge';

/**
 * GET /api/kalshi
 * Fetch Kalshi prediction markets
 * Query params:
 *  - category: Market category (NFL, NBA, MLB, NHL, election, politics, etc.)
 *  - ticker: Specific market ticker
 *  - sport: Filter by sport (converts to category)
 *  - type: Market type ('election', 'sports', 'all')
 *  - year: Election year (for election markets, default: 2026)
 *  - limit: Number of markets to return (default: 10)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const ticker = searchParams.get('ticker');
    const sport = searchParams.get('sport');
    const type = searchParams.get('type');
    const year = parseInt(searchParams.get('year') || '2026');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    console.log('[v0] [API] [KALSHI] Request:', { category, ticker, sport, type, year, limit });
    
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
    
    // Handle election markets specifically
    if (type === 'election' || category === 'election' || category === 'politics') {
      console.log('[v0] [API] [KALSHI] Fetching election markets...');
      const markets = await fetchElectionMarkets({ year, limit });
      
      if (markets.length === 0) {
        return NextResponse.json({
          success: true,
          markets: [],
          count: 0,
          category: 'election',
          year,
          message: `No ${year} election markets currently available. Check https://kalshi.com for live markets.`,
          timestamp: new Date().toISOString()
        });
      }
      
      return NextResponse.json({
        success: true,
        markets,
        count: markets.length,
        category: 'election',
        year,
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
    if (type === 'sports' || finalCategory) {
      markets = finalCategory 
        ? await fetchKalshiMarkets({ category: finalCategory, limit })
        : await fetchSportsMarkets();
    } else {
      // Fetch all available markets
      markets = await fetchKalshiMarkets({ limit });
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
