import { NextRequest, NextResponse } from 'next/server';
import { fetchPlayerProjections, formatProjectionSummary } from '@/lib/player-projections';
import { LOG_PREFIXES, HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

/**
 * Player Props API Route
 * Fetches real player projection data from The Odds API
 */

export const runtime = 'edge';

interface PlayerPropsRequest {
  player: string;
  sport?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { player, sport = 'baseball_mlb' }: PlayerPropsRequest = await req.json();

    if (!player || player.trim().length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Player name is required',
          timestamp: new Date().toISOString()
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    console.log(`${LOG_PREFIXES.API} Fetching player props for: ${player} (${sport})`);

    // Fetch player projections
    const response = await fetchPlayerProjections(player, sport);

    // Format summary if successful
    if (response.success && response.projections) {
      const summary = formatProjectionSummary(response);
      return NextResponse.json({
        ...response,
        summary
      });
    }

    return NextResponse.json(response);

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`${LOG_PREFIXES.API} Error in player-props route:`, errorMessage);
    
    return NextResponse.json(
      { 
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR, 
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

// GET endpoint for quick player lookup
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const player = searchParams.get('player');
    const sport = searchParams.get('sport') || 'baseball_mlb';

    if (!player) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Player name is required (use ?player=Name)',
          timestamp: new Date().toISOString()
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    console.log(`${LOG_PREFIXES.API} GET player props: ${player}`);

    const response = await fetchPlayerProjections(player, sport);
    
    if (response.success && response.projections) {
      const summary = formatProjectionSummary(response);
      return NextResponse.json({
        ...response,
        summary
      });
    }

    return NextResponse.json(response);

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`${LOG_PREFIXES.API} Error in GET player-props:`, errorMessage);
    
    return NextResponse.json(
      { 
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
