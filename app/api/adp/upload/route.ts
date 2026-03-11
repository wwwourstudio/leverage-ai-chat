/**
 * API Route: ADP TSV Upload Handler
 * 
 * Accepts TSV file uploads for NFBC (baseball) and NFFC (football) ADP data.
 * Parses the TSV, validates format, stores in database, and records upload history.
 * Makes the data immediately available to all users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Type definitions
interface ADPRowRaw {
  [key: string]: string;
}

interface ADPPlayer {
  rank: number;
  playerName: string;
  displayName: string;
  adp: number;
  positions: string;
  team: string;
  valueDelta: number;
  isValuePick: boolean;
}

interface ParseResult {
  players: ADPPlayer[];
  sport: 'mlb' | 'nfl';
  totalParsed: number;
  errors: string[];
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parse TSV content and extract ADP data
 * Expects columns: Rank, Player Name, Position(s), Team, ADP (+ optional Auction $)
 */
function parseTSVContent(content: string, sport: 'mlb' | 'nfl'): ParseResult {
  const errors: string[] = [];
  const players: ADPPlayer[] = [];

  try {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      errors.push('TSV file is empty or contains only headers');
      return { players, sport, totalParsed: 0, errors };
    }

    // Parse header row
    const headerLine = lines[0];
    const headers = headerLine.split('\t').map(h => h.trim().toLowerCase());

    // Find column indices (flexible column naming)
    const rankIdx = headers.findIndex(h => h.includes('rank') || h === 'adp rank');
    const playerIdx = headers.findIndex(h => h.includes('player') || h.includes('name'));
    const posIdx = headers.findIndex(h => h.includes('pos') || h.includes('position'));
    const teamIdx = headers.findIndex(h => h === 'team' || h === 'mlb');
    const adpIdx = headers.findIndex(h => h === 'adp' || h.includes('average'));

    if (rankIdx === -1 || playerIdx === -1 || adpIdx === -1) {
      errors.push('Missing required columns: Rank, Player Name, ADP');
      return { players, sport, totalParsed: 0, errors };
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const row = line.split('\t').map(cell => cell.trim());

      try {
        const rank = parseInt(row[rankIdx], 10);
        const playerName = row[playerIdx] || 'Unknown Player';
        const positions = posIdx !== -1 ? row[posIdx] : 'N/A';
        const team = teamIdx !== -1 ? row[teamIdx] : 'N/A';
        const adp = parseFloat(row[adpIdx]);

        // Normalize player name to "First Last" format
        let displayName = playerName;
        if (playerName.includes(',')) {
          // Handle "Last, First" format
          const [last, first] = playerName.split(',').map(s => s.trim());
          displayName = `${first} ${last}`;
        }

        // Calculate value delta (ADP - Rank)
        const valueDelta = Math.round(adp - rank);
        const isValuePick = valueDelta > 15;

        if (!isNaN(rank) && !isNaN(adp)) {
          players.push({
            rank,
            playerName,
            displayName,
            adp,
            positions: positions || 'N/A',
            team: team || 'N/A',
            valueDelta,
            isValuePick,
          });
        }
      } catch (rowError) {
        // Skip malformed rows
        continue;
      }
    }

    if (players.length === 0) {
      errors.push('No valid player records found in TSV');
    }

    return { players, sport, totalParsed: players.length, errors };
  } catch (parseError) {
    const message = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
    errors.push(`TSV parsing error: ${message}`);
    return { players, sport, totalParsed: 0, errors };
  }
}

// ──────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: User not authenticated' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sport = (formData.get('sport') as string)?.toLowerCase() as 'mlb' | 'nfl';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (sport !== 'mlb' && sport !== 'nfl') {
      return NextResponse.json(
        { error: 'Invalid sport: must be "mlb" or "nfl"' },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();
    if (!fileContent.trim()) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      );
    }

    // Parse TSV
    const parseResult = parseTSVContent(fileContent, sport);

    if (parseResult.errors.length > 0 && parseResult.players.length === 0) {
      return NextResponse.json(
        {
          error: parseResult.errors[0] || 'Failed to parse TSV file',
          details: parseResult.errors,
        },
        { status: 400 }
      );
    }

    console.log(`[v0] ADP Upload: Parsed ${parseResult.players.length} players for ${sport}`);

    // Delete existing data for this sport (clear old records)
    const tableName = sport === 'mlb' ? 'nfbc_adp' : 'nffc_adp';
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq('source', 'uploaded');

    if (deleteError && !deleteError.message.includes('no rows')) {
      console.error(`[v0] Error clearing old ${sport} ADP data:`, deleteError);
    }

    // Insert new records with upload metadata
    const recordsToInsert = parseResult.players.map((player) => ({
      rank: player.rank,
      player_name: player.playerName,
      display_name: player.displayName,
      adp: player.adp,
      positions: player.positions,
      team: player.team,
      value_delta: player.valueDelta,
      is_value_pick: player.isValuePick,
      uploaded_at: new Date().toISOString(),
      uploaded_by: user.id,
      source: 'uploaded',
    }));

    const { error: insertError, data: insertedData } = await supabase
      .from(tableName)
      .insert(recordsToInsert)
      .select('id');

    if (insertError) {
      console.error(`[v0] Error inserting ${sport} ADP data:`, insertError);
      return NextResponse.json(
        {
          error: `Failed to store ADP data: ${insertError.message}`,
        },
        { status: 500 }
      );
    }

    // Record upload history
    const { error: historyError } = await supabase
      .from('adp_upload_history')
      .insert({
        sport,
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
        player_count: parseResult.players.length,
        filename: file.name,
        is_active: true,
        notes: `Uploaded ${file.name} - ${parseResult.players.length} players`,
      });

    if (historyError) {
      console.error('[v0] Error recording upload history:', historyError);
      // Don't fail the upload if history tracking fails
    }

    // Mark previous uploads as inactive
    const { error: deactivateError } = await supabase
      .from('adp_upload_history')
      .update({ is_active: false })
      .eq('sport', sport)
      .neq('uploaded_by', user.id);

    if (deactivateError) {
      console.error('[v0] Error updating upload history:', deactivateError);
    }

    console.log(`[v0] ADP Upload Complete: ${parseResult.players.length} ${sport.toUpperCase()} players imported`);

    return NextResponse.json({
      success: true,
      playerCount: parseResult.players.length,
      sport,
      message: `Successfully imported ${parseResult.players.length} ${sport.toUpperCase()} players`,
    });
  } catch (error) {
    console.error('[v0] ADP Upload Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Upload failed: ${message}` },
      { status: 500 }
    );
  }
}
