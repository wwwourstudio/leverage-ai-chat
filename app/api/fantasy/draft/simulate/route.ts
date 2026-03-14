import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS, FANTASY_CONFIG } from '@/lib/constants';
import { simulateDraftForward } from '@/lib/fantasy/draft/simulation-engine';
import { buildDefaultProfiles } from '@/lib/fantasy/draft/opponent-model';
import { calculateVBD } from '@/lib/fantasy/draft/vbd-calculator';
import { detectTierCliffs } from '@/lib/fantasy/draft/tier-cliff-detector';
import { calculateDraftRecommendations, getTopRecommendations } from '@/lib/fantasy/draft/draft-utility';
import type { DraftState, FantasyProjection } from '@/lib/fantasy/types';

// ============================================================================
// POST /api/fantasy/draft/simulate — Run Monte Carlo draft simulation
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
      draftRoomId,
      numSimulations = FANTASY_CONFIG.SIMULATION.DEFAULT_DRAFT_SIMS,
    } = body;

    if (!draftRoomId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: draftRoomId' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Fetch draft room state
    const { data: draftRoom, error: roomError } = await supabase
      .from('draft_rooms')
      .select('*, fantasy_leagues(*)')
      .eq('id', draftRoomId)
      .single();

    if (roomError || !draftRoom) {
      return NextResponse.json(
        { success: false, error: 'Draft room not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    const league = draftRoom.fantasy_leagues;

    // Fetch teams
    const { data: teams } = await supabase
      .from('fantasy_teams')
      .select('*')
      .eq('league_id', league.id);

    if (!teams || teams.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No teams found in league' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Fetch existing picks
    const { data: existingPicks } = await supabase
      .from('draft_picks')
      .select('*')
      .eq('draft_room_id', draftRoomId)
      .order('pick_number', { ascending: true });

    // Fetch projections
    const { data: projectionsRaw } = await supabase
      .from('fantasy_projections')
      .select('*')
      .eq('sport', league.sport)
      .eq('season_year', league.season_year)
      .is('week', null)
      .order('fantasy_points', { ascending: false });

    const projections: FantasyProjection[] = (projectionsRaw || []).map((p: any) => ({
      id: p.id,
      sport: p.sport,
      playerName: p.player_name,
      playerId: p.player_id,
      position: p.position,
      seasonYear: p.season_year,
      week: p.week,
      projectionSource: p.projection_source,
      stats: p.stats,
      fantasyPoints: p.fantasy_points || 0,
      adp: p.adp || 999,
      vbd: p.vbd || 0,
      tier: p.tier || 1,
      updatedAt: p.updated_at,
    }));

    // Calculate VBD
    const vbdConfig = {
      leagueSize: league.league_size,
      rosterSlots: league.roster_slots || {},
      scoringSettings: league.scoring_settings || {},
      sport: league.sport,
    };

    const rankedPlayers = calculateVBD(projections, vbdConfig);

    // Remove already-drafted players
    const draftedNames = new Set((existingPicks || []).map((p: any) => p.player_name));
    const availablePlayers = rankedPlayers.filter(p => !draftedNames.has(p.playerName));

    // Find user's team
    const userTeam = teams.find((t: any) => t.is_user_team);
    if (!userTeam) {
      return NextResponse.json(
        { success: false, error: 'User team not found in league' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Build draft state
    const draftState: DraftState = {
      draftRoomId,
      leagueId: league.id,
      leagueSize: league.league_size,
      totalRounds: draftRoom.total_picks ? Math.ceil(draftRoom.total_picks / league.league_size) : 15,
      currentPick: draftRoom.current_pick || 1,
      totalPicks: draftRoom.total_picks || league.league_size * 15,
      draftOrder: draftRoom.draft_order || teams.map((t: any) => t.id),
      picks: (existingPicks || []).map((p: any) => ({
        id: p.id,
        draftRoomId: p.draft_room_id,
        pickNumber: p.pick_number,
        round: p.round,
        teamId: p.team_id,
        playerName: p.player_name,
        position: p.position,
        vbdAtPick: p.vbd_at_pick || 0,
        recommendation: p.recommendation,
        wasRecommended: p.was_recommended || false,
        survivalProbability: p.survival_probability,
        pickedAt: p.picked_at,
      })),
      availablePlayers,
      teamRosters: new Map(),
      userTeamId: userTeam.id,
      userDraftPosition: userTeam.draft_position || 1,
      status: draftRoom.status || 'active',
    };

    // Build opponent profiles
    const opponentTeamIds = teams
      .filter((t: any) => !t.is_user_team)
      .map((t: any) => t.id);
    const opponentNames = teams
      .filter((t: any) => !t.is_user_team)
      .map((t: any) => t.team_name);

    const opponentProfiles = buildDefaultProfiles(opponentTeamIds, opponentNames);

    // Run Monte Carlo simulation
    const simOutput = simulateDraftForward(draftState, opponentProfiles, {
      numSimulations: Math.min(numSimulations, FANTASY_CONFIG.SIMULATION.MAX_DRAFT_SIMS),
    });

    // Detect tier cliffs
    const tierCliffs = detectTierCliffs(availablePlayers);

    // Generate opponent predictions for utility calculation
    const { predictOpponentPick } = await import('@/lib/fantasy/draft/opponent-model');
    const opponentPredictions = opponentProfiles.map(profile => {
      const roster = draftState.picks
        .filter(p => p.teamId === profile.teamId)
        .map(p => ({
          id: p.id,
          teamId: p.teamId,
          playerName: p.playerName,
          position: p.position,
          rosterSlot: p.position,
          acquisitionType: 'draft' as const,
          acquisitionCost: p.pickNumber,
          addedAt: p.pickedAt,
        }));

      return predictOpponentPick(
        profile,
        availablePlayers,
        Math.ceil(draftState.currentPick / draftState.leagueSize),
        roster
      );
    });

    // Calculate utility-based recommendations
    const recommendations = calculateDraftRecommendations(
      draftState,
      simOutput.results,
      opponentPredictions,
      tierCliffs
    );

    const topPicks = recommendations.length > 0
      ? getTopRecommendations(recommendations)
      : null;

    return NextResponse.json({
      success: true,
      simulation: {
        simulationsRun: simOutput.simulationsRun,
        executionTimeMs: simOutput.executionTimeMs,
        userNextPick: simOutput.userNextPick,
        picksUntilNext: simOutput.picksUntilNext,
        topResults: simOutput.results.slice(0, 20),
      },
      tierCliffs: tierCliffs.slice(0, 10),
      recommendations: {
        bestPick: topPicks?.bestPick || null,
        leveragePicks: topPicks?.leveragePicks || [],
        fullRankings: recommendations.slice(0, 30),
      },
      meta: {
        currentPick: draftState.currentPick,
        availableCount: availablePlayers.length,
        sport: league.sport,
      },
    });
  } catch (error) {
    console.error('[API/fantasy/draft/simulate] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
