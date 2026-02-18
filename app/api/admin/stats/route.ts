import { NextResponse } from 'next/server';
import { getOddsStats } from '@/lib/supabase-data-service';
import { LOG_PREFIXES } from '@/lib/constants';

export const runtime = 'edge';

/**
 * Admin Stats API
 * Provides database statistics for monitoring dashboard
 */
export async function GET() {
  try {
    console.log(`${LOG_PREFIXES.API} Fetching admin stats`);

    const sports = ['nba', 'nfl', 'nhl', 'mlb', 'ncaab', 'ncaaf'];
    const oddsStats: Record<string, any> = {};

    await Promise.all(
      sports.map(async (sport) => {
        const result = await getOddsStats(sport);
        if (result.ok) {
          oddsStats[sport] = result.value;
        } else {
          console.error(`${LOG_PREFIXES.API} Failed to get stats for ${sport}:`, result.error);
          oddsStats[sport] = {
            totalRecords: 0,
            uniqueEvents: 0,
            error: result.error.message,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      oddsStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIXES.API} Admin stats error:`, errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
