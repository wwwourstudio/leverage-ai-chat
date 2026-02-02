import { NextRequest, NextResponse } from 'next/server'
import { getBestOddsForEvent, compareMarketsForEvent } from '@/app/actions/odds'

/**
 * GET /api/odds/best
 * Get best odds for a specific event
 * 
 * Query params:
 * - eventId: Event ID (required)
 * - market: Market type (h2h, spreads, totals) (default: h2h)
 * - compareAll: Compare all markets (default: false)
 * 
 * Examples:
 * - /api/odds/best?eventId=abc123
 * - /api/odds/best?eventId=abc123&market=spreads
 * - /api/odds/best?eventId=abc123&compareAll=true
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    const eventId = searchParams.get('eventId')
    const market = searchParams.get('market') || 'h2h'
    const compareAll = searchParams.get('compareAll') === 'true'

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId parameter is required' },
        { status: 400 }
      )
    }

    const validMarkets = ['h2h', 'spreads', 'totals']
    if (!validMarkets.includes(market)) {
      return NextResponse.json(
        { error: `Invalid market. Valid markets: ${validMarkets.join(', ')}` },
        { status: 400 }
      )
    }

    let result
    if (compareAll) {
      result = await compareMarketsForEvent(eventId)
    } else {
      result = await getBestOddsForEvent(eventId, market as 'h2h' | 'spreads' | 'totals')
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error?.includes('not found') ? 404 : 500 }
      )
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    })
  } catch (error) {
    console.error('[v0] Best odds API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
