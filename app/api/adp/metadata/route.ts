/**
 * API Route: Get Latest ADP Upload Metadata
 * 
 * Returns the most recent upload date and metadata for a given sport.
 * Used by the UI to display data freshness and upload status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport')?.toLowerCase();

    if (!sport || (sport !== 'mlb' && sport !== 'nfl')) {
      return NextResponse.json(
        { error: 'Missing or invalid sport parameter' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch the most recent active upload for this sport
    const { data, error } = await supabase
      .from('adp_upload_history')
      .select('uploaded_at, uploaded_by, player_count, filename, is_active')
      .eq('sport', sport)
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`[v0] Error fetching ${sport} upload metadata:`, error);
      return NextResponse.json(
        { error: 'Failed to fetch metadata' },
        { status: 500 }
      );
    }

    if (!data) {
      // No upload found, return null
      return NextResponse.json({
        sport,
        hasUpload: false,
        lastUploadDate: null,
        playerCount: null,
      });
    }

    return NextResponse.json({
      sport,
      hasUpload: true,
      lastUploadDate: data.uploaded_at,
      playerCount: data.player_count,
      filename: data.filename,
    });
  } catch (error) {
    console.error('[v0] Error in upload metadata endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
