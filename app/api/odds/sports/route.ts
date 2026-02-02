import { NextResponse } from 'next/server'
import { getAvailableSports } from '@/app/actions/odds'

/**
 * GET /api/odds/sports
 * Get list of available sports
 * 
 * No parameters required
 * 
 * Example:
 * - /api/odds/sports
 */
export async function GET() {
  try {
    const result = await getAvailableSports()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
      },
    })
  } catch (error) {
    console.error('[v0] Sports API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
