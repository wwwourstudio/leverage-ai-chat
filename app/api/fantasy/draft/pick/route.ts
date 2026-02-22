import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';

// ============================================================================
// POST /api/fantasy/draft/pick — Submit a draft pick
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
      playerName,
      position,
      teamId,
    } = body;

    if (!draftRoomId || !playerName || !position) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: draftRoomId, playerName, position' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Fetch draft room
    const { data: draftRoom, error: roomError } = await supabase
      .from('draft_rooms')
      .select('*')
      .eq('id', draftRoomId)
      .single();

    if (roomError || !draftRoom) {
      return NextResponse.json(
        { success: false, error: 'Draft room not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    if (draftRoom.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Draft is not active' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Verify it's the right team's turn
    const draftOrder = draftRoom.draft_order || [];
    const leagueSize = draftOrder.length;
    const currentPick = draftRoom.current_pick || 1;
    const round = Math.ceil(currentPick / leagueSize);
    const posInRound = (currentPick - 1) % leagueSize;
    const orderIndex = round % 2 === 1 ? posInRound : leagueSize - 1 - posInRound;
    const expectedTeamId = draftOrder[orderIndex];

    const pickingTeamId = teamId || expectedTeamId;

    // Check player hasn't already been drafted
    const { data: existingPick } = await supabase
      .from('draft_picks')
      .select('id')
      .eq('draft_room_id', draftRoomId)
      .eq('player_name', playerName)
      .single();

    if (existingPick) {
      return NextResponse.json(
        { success: false, error: `${playerName} has already been drafted` },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Insert the pick
    const { data: pick, error: pickError } = await supabase
      .from('draft_picks')
      .insert({
        draft_room_id: draftRoomId,
        pick_number: currentPick,
        round,
        team_id: pickingTeamId,
        player_name: playerName,
        position,
      })
      .select()
      .single();

    if (pickError) {
      console.error('[API/fantasy/draft/pick] Insert error:', pickError);
      return NextResponse.json(
        { success: false, error: 'Failed to record pick' },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    // Advance the draft
    const totalPicks = draftRoom.total_picks || leagueSize * 15;
    const nextPick = currentPick + 1;
    const isComplete = nextPick > totalPicks;

    const { error: updateError } = await supabase
      .from('draft_rooms')
      .update({
        current_pick: nextPick,
        status: isComplete ? 'completed' : 'active',
        completed_at: isComplete ? new Date().toISOString() : null,
      })
      .eq('id', draftRoomId);

    if (updateError) {
      console.error('[API/fantasy/draft/pick] Update error:', updateError);
    }

    // Also add to roster
    const { error: rosterError } = await supabase
      .from('fantasy_rosters')
      .insert({
        team_id: pickingTeamId,
        player_name: playerName,
        position,
        roster_slot: position,
        acquisition_type: 'draft',
        acquisition_cost: currentPick,
      });

    if (rosterError) {
      console.error('[API/fantasy/draft/pick] Roster error:', rosterError);
    }

    return NextResponse.json({
      success: true,
      pick,
      nextPick: isComplete ? null : nextPick,
      isComplete,
    });
  } catch (error) {
    console.error('[API/fantasy/draft/pick] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
