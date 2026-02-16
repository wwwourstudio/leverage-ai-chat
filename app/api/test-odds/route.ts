import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[TEST-ODDS] Starting direct API test');
    
    const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'NO_API_KEY',
        message: 'ODDS_API_KEY not configured in environment variables',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    console.log(`[TEST-ODDS] API Key: ${apiKey.substring(0, 8)}...`);
    
    const sport = 'basketball_nba'; // Test with NBA
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
    
    console.log(`[TEST-ODDS] Fetching: ${url.replace(apiKey, 'REDACTED')}`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    
    console.log(`[TEST-ODDS] Response status: ${response.status}`);
    console.log(`[TEST-ODDS] Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TEST-ODDS] API Error: ${errorText}`);
      
      return NextResponse.json({
        error: 'API_ERROR',
        status: response.status,
        message: errorText,
        url: url.replace(apiKey, 'REDACTED'),
        timestamp: new Date().toISOString()
      }, { status: response.status });
    }
    
    const data = await response.json();
    
    console.log(`[TEST-ODDS] Success! Received ${data?.length || 0} games`);
    
    if (data && data.length > 0) {
      const sample = data[0];
      console.log(`[TEST-ODDS] Sample game: ${sample.away_team} @ ${sample.home_team}`);
      console.log(`[TEST-ODDS] Commence time: ${sample.commence_time}`);
      console.log(`[TEST-ODDS] Bookmakers: ${sample.bookmakers?.length || 0}`);
    }
    
    return NextResponse.json({
      success: true,
      sport: 'basketball_nba',
      gamesFound: data?.length || 0,
      sampleGame: data && data[0] ? {
        matchup: `${data[0].away_team} @ ${data[0].home_team}`,
        startTime: data[0].commence_time,
        bookmakers: data[0].bookmakers?.length || 0,
        markets: data[0].bookmakers?.[0]?.markets?.map((m: any) => m.key) || []
      } : null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[TEST-ODDS] Exception:', error);
    
    return NextResponse.json({
      error: 'EXCEPTION',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
