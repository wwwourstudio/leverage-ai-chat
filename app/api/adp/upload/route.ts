import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseTSV, clearADPCache } from '@/lib/adp-data-service';
import { clearNFLADPCache } from '@/lib/nfl-adp-data';
import type { NFBCPlayer } from '@/lib/adp-data-service';

export const runtime = 'nodejs';
export const maxDuration = 30;

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    db: { schema: 'api' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function savePlayersToSupabase(players: NFBCPlayer[], sport: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const now = new Date().toISOString();
  const rows = players.map(p => ({
    rank: p.rank,
    player_name: p.playerName,
    display_name: p.displayName,
    adp: p.adp,
    positions: p.positions,
    team: p.team,
    value_delta: p.valueDelta,
    is_value_pick: p.isValuePick,
    auction_value: p.auctionValue ?? null,
    sport,
    fetched_at: now,
  }));
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('nfbc_adp')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'sport,rank' });
    if (error) {
      console.warn('[v0] [ADP] Supabase upsert batch failed:', error.message);
      return;
    }
  }
  console.log(`[v0] [ADP] Saved ${players.length} ${sport.toUpperCase()} ADP players to Supabase`);
}

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

    await savePlayersToSupabase(players, sport);

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
