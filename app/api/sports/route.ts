import { NextResponse } from 'next/server';
import { SPORT_KEYS } from '@/lib/constants';
import { getSeasonInfo } from '@/lib/seasonal-context';

export const dynamic = 'force-dynamic';

interface SportEntry {
  key: string;
  short: string;
  name: string;
  category: string;
  isInSeason: boolean;
  seasonName: string;
  context: string;
  seasonStart?: string;
  nextGameEstimate?: string;
}

/**
 * GET /api/sports
 * Returns metadata and seasonal status for all supported sports.
 *
 * Query parameters:
 *  - active=true  Only return sports currently in-season
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    const sports: SportEntry[] = Object.entries(SPORT_KEYS).map(([, value]) => {
      const info = getSeasonInfo(value.API);
      return {
        key: value.API,
        short: value.SHORT,
        name: value.NAME,
        category: value.CATEGORY,
        isInSeason: info.isInSeason,
        seasonName: info.seasonName,
        context: info.context,
        ...(info.seasonStart ? { seasonStart: info.seasonStart } : {}),
        ...(info.nextGameEstimate ? { nextGameEstimate: info.nextGameEstimate } : {}),
      };
    });

    const filtered = activeOnly ? sports.filter((s) => s.isInSeason) : sports;

    return NextResponse.json({
      success: true,
      sports: filtered,
      total: filtered.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[v0] [API/sports] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sports data' },
      { status: 500 },
    );
  }
}
