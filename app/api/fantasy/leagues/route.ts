import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';
import type { FantasyLeague, FantasySport, ScoringFormat, DraftType } from '@/lib/fantasy/types';

// ============================================================================
// POST /api/fantasy/leagues — Create a new fantasy league
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
    const {
      name,
      sport,
      platform = 'custom',
      leagueSize = 12,
      scoringType = 'ppr',
      scoringSettings = {},
      rosterSlots = {},
      draftType = 'snake',
      faabBudget = 100,
      seasonYear,
      teams = [],
    } = body;

    // Validate required fields
    if (!name || !sport) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, sport' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const validSports: FantasySport[] = ['nfl', 'nba', 'mlb', 'nhl'];
    if (!validSports.includes(sport)) {
      return NextResponse.json(
        { success: false, error: `Invalid sport. Must be one of: ${validSports.join(', ')}` },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Create the league
    const { data: league, error: leagueError } = await supabase
      .from('fantasy_leagues')
      .insert({
        user_id: user.id,
        name,
        sport,
        platform,
        league_size: leagueSize,
        scoring_type: scoringType,
        scoring_settings: scoringSettings,
        roster_slots: rosterSlots,
        draft_type: draftType,
        faab_budget: faabBudget,
        season_year: seasonYear || new Date().getFullYear(),
      })
      .select()
      .single();

    if (leagueError) {
      console.error('[API/fantasy/leagues] Create error:', leagueError);
      return NextResponse.json(
        { success: false, error: 'Failed to create league' },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    // Create teams if provided
    if (teams.length > 0) {
      const teamRecords = teams.map((team: { name: string; draftPosition?: number }, index: number) => ({
        league_id: league.id,
        user_id: index === 0 ? user.id : null,
        team_name: team.name || `Team ${index + 1}`,
        draft_position: team.draftPosition || index + 1,
        is_user_team: index === 0,
      }));

      const { error: teamsError } = await supabase
        .from('fantasy_teams')
        .insert(teamRecords);

      if (teamsError) {
        console.error('[API/fantasy/leagues] Teams create error:', teamsError);
      }
    }

    return NextResponse.json({
      success: true,
      league,
    });
  } catch (error) {
    console.error('[API/fantasy/leagues] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

// ============================================================================
// GET /api/fantasy/leagues — List user's leagues
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

    const { data: leagues, error } = await supabase
      .from('fantasy_leagues')
      .select(`
        *,
        fantasy_teams (*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API/fantasy/leagues] List error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch leagues' },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    return NextResponse.json({
      success: true,
      leagues: leagues || [],
    });
  } catch (error) {
    console.error('[API/fantasy/leagues] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
