import { NextResponse } from 'next/server';
import { getOddsApiKey, isOddsApiConfigured } from '@/lib/config';
import { EXTERNAL_APIS, LOG_PREFIXES, ERROR_MESSAGES, HTTP_STATUS } from '@/lib/constants';

export const runtime = 'edge';

/**
 * Odds API Sports List
 * Returns all available sports from The Odds API with current status
 */
export async function GET() {
  try {
    // Check if Odds API is configured
    if (!isOddsApiConfigured()) {
      console.log(`${LOG_PREFIXES.API} ODDS_API_KEY is not configured`);
      return NextResponse.json(
        { 
          error: ERROR_MESSAGES.ODDS_NOT_CONFIGURED,
          message: 'Please add ODDS_API_KEY to environment variables.',
          sports: [],
          timestamp: new Date().toISOString()
        },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }

    const oddsApiKey = getOddsApiKey();
    const apiUrl = `${EXTERNAL_APIS.ODDS_API.BASE_URL}/sports?apiKey=${oddsApiKey}`;

    console.log(`${LOG_PREFIXES.API} Fetching sports list from Odds API...`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log(`${LOG_PREFIXES.API} Odds API sports response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${LOG_PREFIXES.API} Odds API error:`, response.status, errorText.substring(0, 200));
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch sports list',
          details: response.status === HTTP_STATUS.UNAUTHORIZED 
            ? ERROR_MESSAGES.INVALID_API_KEY 
            : errorText.substring(0, 100),
          sports: [],
          timestamp: new Date().toISOString()
        },
        { status: response.status }
      );
    }

    const sports = await response.json();
    
    console.log(`${LOG_PREFIXES.API} Retrieved ${sports.length} sports from Odds API`);

    // Group sports by category for easier consumption
    const sportsByCategory: Record<string, any[]> = {
      american_football: [],
      basketball: [],
      baseball: [],
      hockey: [],
      soccer: [],
      other: []
    };

    sports.forEach((sport: any) => {
      if (sport.key.includes('americanfootball')) {
        sportsByCategory.american_football.push(sport);
      } else if (sport.key.includes('basketball')) {
        sportsByCategory.basketball.push(sport);
      } else if (sport.key.includes('baseball')) {
        sportsByCategory.baseball.push(sport);
      } else if (sport.key.includes('hockey')) {
        sportsByCategory.hockey.push(sport);
      } else if (sport.key.includes('soccer') || sport.key.includes('football')) {
        sportsByCategory.soccer.push(sport);
      } else {
        sportsByCategory.other.push(sport);
      }
    });

    // Get API usage stats from headers
    const remainingRequests = response.headers.get('x-requests-remaining');
    const usedRequests = response.headers.get('x-requests-used');

    return NextResponse.json({
      success: true,
      sports,
      sportsByCategory,
      totalSports: sports.length,
      apiUsage: {
        remaining: remainingRequests,
        used: usedRequests
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIXES.API} Error fetching sports list:`, errorMessage);
    
    return NextResponse.json(
      { 
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        details: errorMessage,
        sports: [],
        timestamp: new Date().toISOString()
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
