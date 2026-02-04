import { NextRequest, NextResponse } from 'next/server';

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

    // Retrieve API key securely from environment variables
    const oddsApiKey = process.env.ODDS_API_KEY;

    if (!oddsApiKey) {
      console.error('[API] ODDS_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Sports Odds API is not configured. Please add ODDS_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    // Build API URL based on request parameters
    const baseUrl = 'https://api.the-odds-api.com/v4/sports';
    
    // If eventId is provided, fetch specific event odds
    let apiUrl: string;
    if (eventId) {
      apiUrl = `${baseUrl}/${sport}/events/${eventId}/odds?apiKey=${oddsApiKey}&regions=us&markets=${marketType || 'h2h'}`;
    } else {
      // Fetch odds for all upcoming events
      apiUrl = `${baseUrl}/${sport}/odds?apiKey=${oddsApiKey}&regions=us&markets=${marketType || 'h2h'}`;
    }

    console.log(`[API] Fetching odds for sport: ${sport}, market: ${marketType}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Odds API error:', response.status, errorText);
      return NextResponse.json(
        { 
          error: 'Failed to fetch odds data',
          details: response.status === 401 ? 'Invalid API key' : errorText 
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform the data into a consistent format
    const transformedData = {
      sport,
      marketType: marketType || 'h2h',
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
    console.error('[API] Error in odds route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for quick odds lookup
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') || 'upcoming';

    const oddsApiKey = process.env.ODDS_API_KEY;

    if (!oddsApiKey) {
      return NextResponse.json(
        { error: 'ODDS_API_KEY not configured' },
        { status: 500 }
      );
    }

    const apiUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${oddsApiKey}&regions=us`;

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
    console.error('[API] Error in GET odds route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
