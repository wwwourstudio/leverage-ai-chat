/**
 * API Route: Get ADP Data (with upload preference)
 * 
 * Returns ADP data, prioritizing recently uploaded data over fallback/scraped data.
 * Used by the application to fetch current ADP rankings for analysis and display.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ADPRow {
  rank: number;
  player_name: string;
  display_name: string;
  adp: number;
  positions: string;
  team: string;
  value_delta: number;
  is_value_pick: boolean;
  uploaded_at?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport')?.toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '120'), 250);

    if (!sport || (sport !== 'mlb' && sport !== 'nfl')) {
      return NextResponse.json(
        { error: 'Missing or invalid sport parameter' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const tableName = sport === 'mlb' ? 'nfbc_adp' : 'nffc_adp';

    // Query: prioritize uploaded data, then fall back to scraped
    const { data: players, error } = await supabase
      .from(tableName)
      .select('rank, player_name, display_name, adp, positions, team, value_delta, is_value_pick, uploaded_at, source')
      .order('source', { ascending: false }) // uploaded first (Z before S)
      .order('rank', { ascending: true })
      .limit(limit);

    if (error) {
      console.error(`[v0] Error fetching ${sport} ADP data:`, error);
      return NextResponse.json(
        { error: 'Failed to fetch ADP data' },
        { status: 500 }
      );
    }

    if (!players || players.length === 0) {
      return NextResponse.json({
        sport,
        players: [],
        totalCount: 0,
        source: 'none',
        message: 'No ADP data available',
      });
    }

    // Determine the source
    const hasUploadedData = (players as any[]).some(p => p.source === 'uploaded');
    const source = hasUploadedData ? 'user_uploaded' : (players[0] as any).source || 'database';

    // Get the most recent upload date
    const mostRecentUpload = (players as any[]).find(p => p.uploaded_at)?.uploaded_at;

    return NextResponse.json({
      sport,
      players: players.map(p => ({
        rank: p.rank,
        playerName: p.player_name,
        displayName: p.display_name,
        adp: p.adp,
        positions: p.positions,
        team: p.team,
        valueDelta: p.value_delta,
        isValuePick: p.is_value_pick,
      })),
      totalCount: players.length,
      source,
      lastUploadDate: mostRecentUpload,
    });
  } catch (error) {
    console.error('[v0] Error in ADP data endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
