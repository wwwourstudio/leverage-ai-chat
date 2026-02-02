import { NextRequest, NextResponse } from 'next/server'
import { fetchMultipleSports, cleanupExpiredOdds } from '@/app/actions/odds'
import type { Sport } from '@/lib/services/odds-api'

/**
 * GET /api/cron/refresh-odds
 * Scheduled job to refresh odds cache for major sports
 * 
 * This should be called every 5 minutes via Vercel Cron or external scheduler
 * 
 * Authorization: Requires CRON_SECRET environment variable match
 * 
 * Example vercel.json configuration:
 * {
 *   "crons": [{
 *     "path": "/api/cron/refresh-odds",
 *     "schedule": "*/5 * * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[v0] Starting scheduled odds refresh')

    // Define major sports to refresh
    const majorSports: Sport[] = [
      'americanfootball_nfl',
      'basketball_nba',
      'baseball_mlb',
      'icehockey_nhl',
      'soccer_epl',
    ]

    // Fetch odds for all major sports
    const fetchResult = await fetchMultipleSports(majorSports, ['h2h', 'spreads', 'totals'])

    // Cleanup expired cache entries
    const cleanupResult = await cleanupExpiredOdds()

    console.log('[v0] Scheduled odds refresh completed')

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      fetch: fetchResult,
      cleanup: cleanupResult,
    })
  } catch (error) {
    console.error('[v0] Cron job error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request)
}
