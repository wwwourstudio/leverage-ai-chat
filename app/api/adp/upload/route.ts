import { NextRequest, NextResponse } from 'next/server';
import { parseTSV, saveADPToSupabase, clearADPCache } from '@/lib/adp-data';
import { clearNFLADPCache } from '@/lib/nfl-adp-data';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sport = ((formData.get('sport') as string | null) ?? 'mlb').toLowerCase();

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!['mlb', 'nfl'].includes(sport)) {
      return NextResponse.json({ success: false, error: 'sport must be "mlb" or "nfl"' }, { status: 400 });
    }

    const text = await file.text();
    if (!text.trim()) {
      return NextResponse.json({ success: false, error: 'File is empty' }, { status: 422 });
    }

    const players = parseTSV(text);

    if (players.length === 0) {
      return NextResponse.json(
        { success: false, error: 'File parsed to 0 players — check that it is a valid TSV/CSV export from nfc.shgn.com' },
        { status: 422 },
      );
    }

    await saveADPToSupabase(players, sport);

    // Clear in-process cache so the next query reads fresh data
    if (sport === 'mlb') {
      clearADPCache();
    } else {
      clearNFLADPCache();
    }

    console.log(`[v0] [ADP] User uploaded ${players.length} ${sport.toUpperCase()} ADP players`);

    return NextResponse.json({
      success: true,
      count: players.length,
      sport,
      message: `Successfully imported ${players.length} ${sport.toUpperCase()} players. Data is now live for all users.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[v0] [ADP] Upload failed:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
