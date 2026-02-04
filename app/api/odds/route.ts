import { NextRequest, NextResponse } from 'next/server';
import { getOddsApiKey, isOddsApiConfigured } from '@/lib/env';
import {
  EXTERNAL_APIS,
  LOG_PREFIXES,
  ERROR_MESSAGES,
  HTTP_STATUS,
  MARKET_TYPES,
} from '@/lib/constants';

// Sports Odds API integration
// Documentation: https://the-odds-api.com/

export const runtime = 'edge';

interface OddsRequest {
  sport: string;
  marketType?: string;
  eventId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { sport, marketType, eventId }: OddsRequest = await req.json();

    // Check if Odds API is configured
    if (!isOddsApiConfigured()) {
      console.log(`${LOG_PREFIXES.API} ODDS_API_KEY is not configured`);
      return NextResponse.json(
        { 
          error: ERROR_MESSAGES.ODDS_NOT_CONFIGURED, 
          message: 'Please add ODDS_API_KEY to environment variables.',
          documentation: 'See ENV_CONFIGURATION.md for setup instructions',
          events: [],
          timestamp: new Date().toISOString()
        },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }

    const oddsApiKey = getOddsApiKey();

    // Build API URL based on request parameters
    const baseUrl = `${EXTERNAL_APIS.ODDS_API.BASE_URL}/sports`;
    
    // If eventId is provided, fetch specific event odds
    let apiUrl: string;
    if (eventId) {
      apiUrl = `${baseUrl}/${sport}/events/${eventId}/odds?apiKey=${oddsApiKey}&regions=${EXTERNAL_APIS.ODDS_API.REGIONS}&markets=${marketType || MARKET_TYPES.H2H}`;
    } else {
      // Fetch odds for all upcoming events
      apiUrl = `${baseUrl}/${sport}/odds?apiKey=${oddsApiKey}&regions=${EXTERNAL_APIS.ODDS_API.REGIONS}&markets=${marketType || MARKET_TYPES.H2H}`;
    }

    console.log(`${LOG_PREFIXES.API} Fetching odds for sport: ${sport}, market: ${marketType}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`${LOG_PREFIXES.API} Odds API error:`, response.status, errorText.substring(0, 200));
      return NextResponse.json(
        { 
          error: 'Failed to fetch odds data',
          details: response.status === HTTP_STATUS.UNAUTHORIZED ? ERROR_MESSAGES.INVALID_API_KEY : errorText.substring(0, 100) 
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform the data into a consistent format
    const transformedData = {
      sport,
      marketType: marketType || MARKET_TYPES.H2H,
      events: Array.isArray(data) ? data : [data],
      timestamp: new Date().toISOString(),
      remainingRequests: response.headers.get('x-requests-remaining'),
      usedRequests: response.headers.get('x-requests-used'),
    };

    // Calculate implied probabilities from odds
    transformedData.events = transformedData.events.map((event: any) => {
      if (event.bookmakers && event.bookmakers.length > 0) {
        const markets = event.bookmakers[0].markets || [];
        const oddsWithProbabilities = markets.map((market: any) => {
          const outcomes = market.outcomes.map((outcome: any) => {
            // Convert American odds to implied probability
            const impliedProb = outcome.price > 0
              ? 100 / (outcome.price + 100)
              : Math.abs(outcome.price) / (Math.abs(outcome.price) + 100);
            
            return {
              ...outcome,
              impliedProbability: impliedProb,
            };
          });
          
          return {
            ...market,
            outcomes,
          };
        });

        return {
          ...event,
          bookmakers: [
            {
              ...event.bookmakers[0],
              markets: oddsWithProbabilities,
            },
            ...event.bookmakers.slice(1),
          ],
        };
      }
      return event;
    });

    return NextResponse.json(transformedData);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`${LOG_PREFIXES.API} Error in odds route:`, errorMessage);
    return NextResponse.json(
      { error: ERROR_MESSAGES.INTERNAL_ERROR, details: errorMessage },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

// GET endpoint for quick odds lookup
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') || 'upcoming';

    if (!isOddsApiConfigured()) {
      return NextResponse.json(
        { 
          error: ERROR_MESSAGES.ODDS_NOT_CONFIGURED,
          message: 'See ENV_CONFIGURATION.md for setup',
          events: [],
          timestamp: new Date().toISOString()
        },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }

    const oddsApiKey = getOddsApiKey();

    const apiUrl = `${EXTERNAL_APIS.ODDS_API.BASE_URL}/sports/${sport}/odds?apiKey=${oddsApiKey}&regions=${EXTERNAL_APIS.ODDS_API.REGIONS}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch odds' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      sport,
      events: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`${LOG_PREFIXES.API} Error in GET odds route:`, errorMessage);
    return NextResponse.json(
      { error: ERROR_MESSAGES.INTERNAL_ERROR, details: errorMessage },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
