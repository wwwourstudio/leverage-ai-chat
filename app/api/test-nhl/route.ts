import { NextResponse } from 'next/server';

/**
 * Test endpoint to verify NHL odds API integration
 * Call: GET /api/test-nhl
 */
export async function GET() {
  try {
    console.log('[v0] [TEST-NHL] Starting NHL API integration test');
    
    // Check API key
    const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'ODDS_API_KEY not configured',
        message: 'Set ODDS_API_KEY in environment variables'
      }, { status: 500 });
    }
    
    console.log('[v0] [TEST-NHL] API key found, fetching NHL odds...');
    
    // Import and call unified odds fetcher
    const { getOddsWithCache } = await import('@/lib/unified-odds-fetcher');
    const nhlOdds = await getOddsWithCache('icehockey_nhl', {
      useCache: false,
      storeResults: false
    });
    
    console.log('[v0] [TEST-NHL] Received response:', {
      gamesCount: nhlOdds?.length || 0,
      isArray: Array.isArray(nhlOdds),
      firstGame: nhlOdds?.[0] ? `${nhlOdds[0].away_team} @ ${nhlOdds[0].home_team}` : null
    });
    
    if (!nhlOdds || nhlOdds.length === 0) {
      return NextResponse.json({
        success: true,
        gamesFound: 0,
        message: 'NHL API working but no games currently scheduled',
        note: 'This is normal if no NHL games today'
      });
    }
    
    // Extract sample game data
    const sampleGame = nhlOdds[0];
    const sampleData = {
      matchup: `${sampleGame.away_team} @ ${sampleGame.home_team}`,
      gameTime: sampleGame.commence_time,
      bookmakers: sampleGame.bookmakers?.length || 0,
      markets: sampleGame.bookmakers?.[0]?.markets?.map((m: any) => m.key) || []
    };
    
    return NextResponse.json({
      success: true,
      gamesFound: nhlOdds.length,
      sampleGame: sampleData,
      message: 'NHL API integration working correctly',
      allGames: nhlOdds.map((g: any) => ({
        away: g.away_team,
        home: g.home_team,
        time: g.commence_time
      }))
    });
    
  } catch (error) {
    console.error('[v0] [TEST-NHL] Error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      message: 'Failed to fetch NHL odds'
    }, { status: 500 });
  }
}
