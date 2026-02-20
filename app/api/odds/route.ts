import { NextRequest, NextResponse } from 'next/server';
import {
  fetchLiveOdds,
  validateSportKey,
  ODDS_MARKETS,
  BETTING_REGIONS,
} from '@/lib/odds/index';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/lib/constants';

// ============================================================================
// POST /api/odds
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sport, marketType = 'h2h' } = body;

    if (!sport) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: sport', events: [] },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Validate and normalize sport key
    const validation = validateSportKey(sport);
    if (!validation.isValid || !validation.normalizedKey) {
      return NextResponse.json(
        { success: false, error: validation.error || `Unknown sport: ${sport}`, events: [] },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
    if (!apiKey) {
      console.error('[API/odds] ODDS_API_KEY is not configured — set it in Vercel environment variables');
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.ODDS_NOT_CONFIGURED,
          events: [],
          message: 'Set ODDS_API_KEY in environment variables to enable live odds.',
        },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }

    // Map marketType string to valid array
    const marketsMap: Record<string, string[]> = {
      h2h: [ODDS_MARKETS.H2H],
      spreads: [ODDS_MARKETS.SPREADS],
      totals: [ODDS_MARKETS.TOTALS],
      all: [ODDS_MARKETS.H2H, ODDS_MARKETS.SPREADS, ODDS_MARKETS.TOTALS],
    };
    const markets = marketsMap[marketType] || [ODDS_MARKETS.H2H];

    const events = await fetchLiveOdds(validation.normalizedKey, {
      apiKey,
      markets,
      regions: [BETTING_REGIONS.US],
      oddsFormat: 'american',
    });

    return NextResponse.json({
      success: true,
      events: Array.isArray(events) ? events : [],
      sport: validation.normalizedKey,
      timestamp: new Date().toISOString(),
      message: SUCCESS_MESSAGES.ODDS_FETCHED,
    });
  } catch (error) {
    console.error('[API/odds] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.INTERNAL_ERROR,
        events: [],
        timestamp: new Date().toISOString(),
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
