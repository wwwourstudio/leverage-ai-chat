import { NextRequest, NextResponse } from 'next/server'
import {
  fetchLiveOdds,
  getCachedOddsAction,
  getAvailableSports,
} from '@/app/actions/odds'
import type { Sport, Market, Region } from '@/lib/services/odds-api'

/**
 * GET /api/odds
 * Fetch live odds with caching
 * 
 * Query params:
 * - sport: Sport key (required)
 * - markets: Comma-separated list of markets (default: h2h,spreads,totals)
 * - regions: Comma-separated list of regions (default: us)
 * - forceRefresh: Force API call instead of using cache (default: false)
 * - cached: Only return cached data (default: false)
 * 
 * Examples:
 * - /api/odds?sport=basketball_nba
 * - /api/odds?sport=americanfootball_nfl&markets=h2h,spreads&forceRefresh=true
 * - /api/odds?sport=soccer_epl&cached=true
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    const sport = searchParams.get('sport') as Sport | null
    const marketsParam = searchParams.get('markets') || 'h2h,spreads,totals'
    const regionsParam = searchParams.get('regions') || 'us'
    const forceRefresh = searchParams.get('forceRefresh') === 'true'
    const cachedOnly = searchParams.get('cached') === 'true'

    if (!sport) {
      return NextResponse.json(
        { error: 'Sport parameter is required' },
        { status: 400 }
      )
    }

    const markets = marketsParam.split(',') as Market[]
    const regions = regionsParam.split(',') as Region[]

    // Validate sport
    const validSports = [
      'americanfootball_nfl',
      'basketball_nba',
      'baseball_mlb',
      'icehockey_nhl',
      'soccer_epl',
      'soccer_uefa_champs_league',
    ]

    if (!validSports.includes(sport)) {
      return NextResponse.json(
        { error: `Invalid sport. Valid sports: ${validSports.join(', ')}` },
        { status: 400 }
      )
    }

    let result
    if (cachedOnly) {
      result = await getCachedOddsAction(sport)
    } else {
      result = await fetchLiveOdds(sport, markets, regions, forceRefresh)
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (error) {
    console.error('[v0] Odds API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
