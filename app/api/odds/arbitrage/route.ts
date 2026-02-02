import { NextRequest, NextResponse } from 'next/server'
import { findArbitrageForEvent } from '@/app/actions/odds'

/**
 * GET /api/odds/arbitrage
 * Find arbitrage opportunities for an event
 * 
 * Query params:
 * - eventId: Event ID (required)
 * - market: Market type (h2h, spreads, totals) (default: h2h)
 * 
 * Examples:
 * - /api/odds/arbitrage?eventId=abc123
 * - /api/odds/arbitrage?eventId=abc123&market=spreads
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    const eventId = searchParams.get('eventId')
    const market = searchParams.get('market') || 'h2h'

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

    const result = await findArbitrageForEvent(eventId, market as 'h2h' | 'spreads' | 'totals')

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
    console.error('[v0] Arbitrage API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
