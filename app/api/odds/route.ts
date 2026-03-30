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
// Odds enrichment — compute derived fields from raw bookmaker data
// ============================================================================

function americanToImplied(price: number): number {
  return price >= 0 ? 100 / (price + 100) : (-price) / (-price + 100);
}

function enrichEvents(events: any[]): any[] {
  return events.map(event => {
    const bookmakers: any[] = event.bookmakers ?? [];

    // ── h2h: best odds per team ──────────────────────────────────────────────
    const bestH2H: Record<string, { price: number; book: string }> = {};
    for (const bk of bookmakers) {
      for (const market of bk.markets ?? []) {
        if (market.key !== 'h2h') continue;
        for (const outcome of market.outcomes ?? []) {
          const name: string = outcome.name;
          if (!bestH2H[name] || outcome.price > bestH2H[name].price) {
            bestH2H[name] = { price: outcome.price, book: bk.title };
          }
        }
      }
    }

    const homeEntry = bestH2H[event.home_team] ?? null;
    const awayEntry = bestH2H[event.away_team] ?? null;

    // ── implied win % (normalised) ───────────────────────────────────────────
    let impliedWinPct = { home: 50, away: 50 };
    if (homeEntry && awayEntry) {
      const rawHome = americanToImplied(homeEntry.price);
      const rawAway = americanToImplied(awayEntry.price);
      const total = rawHome + rawAway;
      impliedWinPct = {
        home: Math.round((rawHome / total) * 100),
        away: Math.round((rawAway / total) * 100),
      };
    }

    // ── spread: best line for home team ─────────────────────────────────────
    let spread: { home: number; away: number; book: string } | null = null;
    for (const bk of bookmakers) {
      for (const market of bk.markets ?? []) {
        if (market.key !== 'spreads') continue;
        const homeOutcome = market.outcomes?.find((o: any) => o.name === event.home_team);
        const awayOutcome = market.outcomes?.find((o: any) => o.name === event.away_team);
        if (homeOutcome?.point !== undefined && awayOutcome?.point !== undefined) {
          // Prefer the tightest spread (closest to 0 for the underdog)
          if (!spread || Math.abs(homeOutcome.point) < Math.abs(spread.home)) {
            spread = { home: homeOutcome.point, away: awayOutcome.point, book: bk.title };
          }
        }
      }
    }

    // ── total: best O/U line ─────────────────────────────────────────────────
    let total: { line: number; book: string } | null = null;
    for (const bk of bookmakers) {
      for (const market of bk.markets ?? []) {
        if (market.key !== 'totals') continue;
        const overOutcome = market.outcomes?.find((o: any) => o.name === 'Over');
        if (overOutcome?.point !== undefined) {
          // Use first available
          if (!total) total = { line: overOutcome.point, book: bk.title };
        }
      }
    }

    return {
      ...event,
      bestHomeOdds: homeEntry,
      bestAwayOdds: awayEntry,
      spread,
      total,
      impliedWinPct,
      bookmakerCount: bookmakers.length,
    };
  });
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
  const rawEvents = Array.isArray(events) ? events : [];
  return {
    success: true as const,
    events: enrichEvents(rawEvents),
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
