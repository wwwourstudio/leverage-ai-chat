import { NextRequest, NextResponse } from 'next/server';
import {
  fetchLiveOdds,
  validateSportKey,
  ODDS_MARKETS,
  BETTING_REGIONS,
} from '@/lib/odds/index';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/lib/constants';
import { getOddsApiKey } from '@/lib/config';

// ============================================================================
// Default sport based on current month (season-aware)
// ============================================================================

function getDefaultSport(): string {
  const month = new Date().getMonth() + 1; // 1-12
  // NFL: Sep–Feb, MLB: Mar–Oct, NBA: Oct–Jun
  if (month >= 3 && month <= 10) return 'baseball_mlb';
  if (month >= 9 || month <= 2) return 'americanfootball_nfl';
  return 'basketball_nba';
}

// ============================================================================
// Shared helper — used by both GET and POST
// ============================================================================

const MARKETS_MAP: Record<string, string[]> = {
  h2h:     [ODDS_MARKETS.H2H],
  spreads: [ODDS_MARKETS.SPREADS],
  totals:  [ODDS_MARKETS.TOTALS],
  all:     [ODDS_MARKETS.H2H, ODDS_MARKETS.SPREADS, ODDS_MARKETS.TOTALS],
};

async function fetchOddsForSport(sport: string, marketType = 'h2h') {
  const validation = validateSportKey(sport);
  if (!validation.isValid || !validation.normalizedKey) {
    return { success: false as const, error: validation.error || `Unknown sport: ${sport}`, events: [] };
  }
  const apiKey = getOddsApiKey();
  if (!apiKey) {
    console.error('[API/odds] ODDS_API_KEY is not configured — set it in Vercel environment variables');
    return {
      success: false as const,
      error: ERROR_MESSAGES.ODDS_NOT_CONFIGURED,
      events: [],
      message: 'Set ODDS_API_KEY in environment variables to enable live odds.',
    };
  }
  const events = await fetchLiveOdds(validation.normalizedKey, {
    apiKey,
    markets: MARKETS_MAP[marketType] ?? [ODDS_MARKETS.H2H],
    regions: [BETTING_REGIONS.US],
    oddsFormat: 'american',
  });
  return {
    success: true as const,
    events: Array.isArray(events) ? events : [],
    sport: validation.normalizedKey,
    timestamp: new Date().toISOString(),
    message: SUCCESS_MESSAGES.ODDS_FETCHED,
  };
}

// ============================================================================
// GET /api/odds?sport=baseball_mlb&markets=h2h
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport      = searchParams.get('sport')   ?? getDefaultSport();
    const marketType = searchParams.get('markets') ?? 'h2h';
    const result = await fetchOddsForSport(sport, marketType);
    const status = result.success ? HTTP_STATUS.OK : (result.error === ERROR_MESSAGES.ODDS_NOT_CONFIGURED ? HTTP_STATUS.SERVICE_UNAVAILABLE : HTTP_STATUS.BAD_REQUEST);
    return NextResponse.json(result, { status });
  } catch (error) {
    console.error('[API/odds GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : ERROR_MESSAGES.INTERNAL_ERROR, events: [], timestamp: new Date().toISOString() },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

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

    const result = await fetchOddsForSport(sport, marketType);
    const status = result.success ? HTTP_STATUS.OK : (result.error === ERROR_MESSAGES.ODDS_NOT_CONFIGURED ? HTTP_STATUS.SERVICE_UNAVAILABLE : HTTP_STATUS.BAD_REQUEST);
    return NextResponse.json(result, { status });
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
