import { NextResponse } from 'next/server';
import { validateSportKey, getPopularSports } from '@/lib/sports-validator';

export const runtime = 'edge';

/**
 * Sports Season Status API
 * Returns information about which sports are currently in season
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport');

  try {
    const oddsApiKey = process.env.ODDS_API_KEY;
    
    if (!oddsApiKey) {
      return NextResponse.json({
        error: 'ODDS_API_KEY not configured',
        sports: []
      }, { status: 503 });
    }

    // If specific sport requested, check just that one
    if (sport) {
      const validation = validateSportKey(sport);
      const sportKey = validation.normalizedKey;
      
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h`;
      
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        return NextResponse.json({
          sport: sportKey,
          inSeason: false,
          eventCount: 0,
          message: 'Unable to fetch sport data'
        });
      }
      
      const data = await response.json();
      const eventCount = Array.isArray(data) ? data.length : 0;
      
      return NextResponse.json({
        sport: sportKey,
        inSeason: eventCount > 0,
        eventCount,
        message: eventCount > 0 
          ? `${eventCount} live games available`
          : 'No games currently available - may be off-season'
      });
    }

    // Otherwise, check all popular sports
    const popularSports = getPopularSports();
    const statusChecks = popularSports.slice(0, 6).map(async (sport) => {
      const url = `https://api.the-odds-api.com/v4/sports/${sport.key}/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h`;
      
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) {
          return {
            sport: sport.key,
            name: sport.name,
            category: sport.category,
            inSeason: false,
            eventCount: 0
          };
        }
        
        const data = await response.json();
        const eventCount = Array.isArray(data) ? data.length : 0;
        
        return {
          sport: sport.key,
          name: sport.name,
          category: sport.category,
          inSeason: eventCount > 0,
          eventCount
        };
      } catch (error) {
        return {
          sport: sport.key,
          name: sport.name,
          category: sport.category,
          inSeason: false,
          eventCount: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const results = await Promise.all(statusChecks);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      sports: results,
      activeSports: results.filter(s => s.inSeason).map(s => s.name),
      totalEvents: results.reduce((sum, s) => sum + s.eventCount, 0)
    });

  } catch (error) {
    console.error('[API] Sports status error:', error);
    return NextResponse.json({
      error: 'Failed to check sports status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
