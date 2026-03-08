import { NextRequest, NextResponse } from 'next/server';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '@/lib/constants';
import { isSupabaseConfigured } from '@/lib/config';

// ============================================================================
// Default insights when no data is available
// ============================================================================

const DEFAULT_INSIGHTS = {
  totalValue: 0,
  winRate: 0,
  roi: 0,
  activeContests: 0,
  totalInvested: 0,
  dataSource: 'default',
  message: 'No historical data yet. Start analyzing to build your track record.',
};

// ============================================================================
// GET /api/insights
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // If Supabase is configured, try to fetch real insights
    if (isSupabaseConfigured()) {
      try {
        // Use server-side Supabase client for API routes
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();

        // Prefer cookie-based session auth; fall back to x-user-id header for
        // legacy callers (e.g. InsightsDashboard passing userId as a header).
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id ?? request.headers.get('x-user-id');

        if (userId) {
          const { data, error } = await supabase
            .from('user_insights')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (!error && data) {
            return NextResponse.json({
              success: true,
              insights: {
                totalValue: data.total_value ?? 0,
                winRate: data.win_rate ?? 0,
                roi: data.roi ?? 0,
                activeContests: data.active_contests ?? 0,
                totalInvested: data.total_invested ?? 0,
                dataSource: 'database',
                message: SUCCESS_MESSAGES.INSIGHTS_LOADED,
              },
            });
          }
        }

        // No user or no data -- return defaults without setupRequired
        return NextResponse.json({
          success: true,
          insights: DEFAULT_INSIGHTS,
        });
      } catch (dbError) {
        // Supabase configured but query failed (e.g. table doesn't exist yet)
        console.warn('[API/insights] Database query failed:', dbError);

        return NextResponse.json({
          success: true,
          insights: DEFAULT_INSIGHTS,
          setupRequired: true,
          message: 'Database tables may need to be created. Run migrations to set up schema.',
        });
      }
    }

    // Supabase not configured -- return defaults
    return NextResponse.json({
      success: true,
      insights: DEFAULT_INSIGHTS,
    });
  } catch (error) {
    console.error('[API/insights] Unhandled error:', error);
    return NextResponse.json(
      {
        success: false,
        insights: DEFAULT_INSIGHTS,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
