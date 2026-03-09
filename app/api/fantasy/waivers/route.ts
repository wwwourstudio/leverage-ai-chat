import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS, FANTASY_CONFIG } from '@/lib/constants';
import { hasFeatureAccess } from '@/lib/fantasy/types';
import type { SubscriptionTier, WaiverRecommendation } from '@/lib/fantasy/types';
import { detectBreakoutCandidates, generateWaiverRecommendations } from '@/lib/fantasy/waiver/waiver-engine';

// ============================================================================
// POST /api/fantasy/waivers — Submit a waiver claim or get recommendations
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    const body = await request.json();
    const { action, leagueId, teamId, week } = body;

    if (!leagueId || !teamId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: leagueId, teamId' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Verify league ownership
    const { data: league, error: leagueError } = await supabase
      .from('fantasy_leagues')
      .select('*')
      .eq('id', leagueId)
      .eq('user_id', user.id)
      .single();

    if (leagueError || !league) {
      return NextResponse.json(
        { success: false, error: 'League not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    // Check subscription tier
    const { data: subscription } = await supabase
      .from('subscription_tiers')
      .select('tier')
      .eq('user_id', user.id)
      .single();

    const tier: SubscriptionTier = (subscription?.tier as SubscriptionTier) || 'free';

    if (action === 'recommend') {
      // Generate waiver recommendations
      const hasBasic = hasFeatureAccess(tier, 'waiver_rankings_basic');
      const hasFull = hasFeatureAccess(tier, 'waiver_rankings_full');

      if (!hasBasic && !hasFull) {
        return NextResponse.json(
          { success: false, error: 'Waiver rankings require Core tier or above' },
          { status: HTTP_STATUS.FORBIDDEN }
        );
      }

      // Fetch current roster
      const { data: roster } = await supabase
        .from('fantasy_rosters')
        .select('*')
        .eq('team_id', teamId);

      // Fetch weekly projections for available players
      const currentWeek = week || getCurrentNFLWeek();
      const { data: projections } = await supabase
        .from('fantasy_projections')
        .select('*')
        .eq('sport', league.sport)
        .eq('season_year', league.season_year)
        .order('fantasy_points', { ascending: false });

      // Get all rostered players across the league
      const { data: allTeams } = await supabase
        .from('fantasy_teams')
        .select('id')
        .eq('league_id', leagueId);

      const teamIds = (allTeams || []).map((t: any) => t.id);

      const { data: allRosters } = await supabase
        .from('fantasy_rosters')
        .select('player_name')
        .in('team_id', teamIds);

      const rosteredNames = new Set((allRosters || []).map((r: any) => r.player_name));

      // Map projections to typed objects
      const mappedProjections = (projections || []).map((p: any) => ({
        playerName: p.player_name,
        position: p.position,
        fantasyPoints: p.fantasy_points || 0,
        stats: p.stats || {},
        adp: p.adp || 999,
        week: p.week,
      }));

      // Detect breakout candidates
      const breakouts = detectBreakoutCandidates(
        mappedProjections,
        currentWeek,
        FANTASY_CONFIG.WAIVER.ROLLING_WINDOW_WEEKS,
        FANTASY_CONFIG.WAIVER.BREAKOUT_Z_THRESHOLD
      );

      // Generate recommendations
      const myRoster = (roster || []).map((r: any) => ({
        playerName: r.player_name,
        position: r.position,
        rosterSlot: r.roster_slot,
      }));

      const recommendations = generateWaiverRecommendations(
        breakouts,
        myRoster,
        rosteredNames,
        league.faab_budget || FANTASY_CONFIG.WAIVER.DEFAULT_FAAB_BUDGET,
        league.roster_slots || {},
        hasFull
      );

      // Limit results for basic tier
      const maxResults = hasFull ? 20 : 5;

      return NextResponse.json({
        success: true,
        week: currentWeek,
        recommendations: recommendations.slice(0, maxResults),
        breakoutCandidates: hasFull ? breakouts.slice(0, 10) : [],
        meta: {
          tier,
          sport: league.sport,
          rosterSize: myRoster.length,
          availablePlayers: mappedProjections.filter(p => !rosteredNames.has(p.playerName)).length,
        },
      });
    }

    if (action === 'submit') {
      // Submit a waiver claim
      const { addPlayer, dropPlayer, faabBid = 0 } = body;

      if (!addPlayer) {
        return NextResponse.json(
          { success: false, error: 'Missing required field: addPlayer' },
          { status: HTTP_STATUS.BAD_REQUEST }
        );
      }

      const currentWeek = week || getCurrentNFLWeek();

      const { data: waiver, error: waiverError } = await supabase
        .from('waiver_transactions')
        .insert({
          league_id: leagueId,
          team_id: teamId,
          add_player: addPlayer,
          drop_player: dropPlayer || null,
          faab_bid: faabBid,
          status: 'pending',
          week: currentWeek,
          reason: body.reason || null,
        })
        .select()
        .single();

      if (waiverError) {
        console.error('[API/fantasy/waivers] Submit error:', waiverError);
        return NextResponse.json(
          { success: false, error: 'Failed to submit waiver claim' },
          { status: HTTP_STATUS.INTERNAL_ERROR }
        );
      }

      return NextResponse.json({
        success: true,
        waiver,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Must be "recommend" or "submit"' },
      { status: HTTP_STATUS.BAD_REQUEST }
    );
  } catch (error) {
    console.error('[API/fantasy/waivers] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

// ============================================================================
// GET /api/fantasy/waivers — List waiver transactions for a league
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    const week = searchParams.get('week');
    const status = searchParams.get('status');

    if (!leagueId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter: leagueId' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Verify league ownership
    const { data: league } = await supabase
      .from('fantasy_leagues')
      .select('id')
      .eq('id', leagueId)
      .eq('user_id', user.id)
      .single();

    if (!league) {
      return NextResponse.json(
        { success: false, error: 'League not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    let query = supabase
      .from('waiver_transactions')
      .select('*')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false });

    if (week) {
      const weekNum = parseInt(week, 10);
      if (!Number.isInteger(weekNum) || weekNum < 1) {
        return NextResponse.json(
          { success: false, error: 'Invalid week parameter' },
          { status: HTTP_STATUS.BAD_REQUEST }
        );
      }
      query = query.eq('week', weekNum);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: waivers, error } = await query;

    if (error) {
      console.error('[API/fantasy/waivers] List error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch waivers' },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    return NextResponse.json({
      success: true,
      waivers: waivers || [],
    });
  } catch (error) {
    console.error('[API/fantasy/waivers] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getCurrentNFLWeek(): number {
  const now = new Date();
  // NFL season starts first week of September
  const seasonStart = new Date(now.getFullYear(), 8, 1); // Sep 1
  // Find the first Thursday on or after Sep 1
  while (seasonStart.getDay() !== 4) {
    seasonStart.setDate(seasonStart.getDate() + 1);
  }
  const diffMs = now.getTime() - seasonStart.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(diffWeeks + 1, 18));
}
