import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NFBCPlayer } from '@/lib/adp-data';

export const runtime = 'nodejs';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    db: { schema: 'api' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const sport = searchParams.get('sport') ?? 'mlb';
    const allowStale = searchParams.get('allowStale') === 'true';

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ players: null }, { status: 200 });
    }

    const { data, error } = await supabase
      .from('nfbc_adp')
      .select('*')
      .eq('sport', sport)
      .order('rank', { ascending: true })
      .limit(300);

    if (error || !data || data.length === 0) {
      return NextResponse.json({ players: null }, { status: 200 });
    }

    // Check freshness unless allowStale
    if (!allowStale) {
      const latestFetch = data[0]?.fetched_at ? new Date(data[0].fetched_at).getTime() : 0;
      if (Date.now() - latestFetch > CACHE_TTL_MS) {
        return NextResponse.json({ players: null }, { status: 200 });
      }
    }

    const players: NFBCPlayer[] = data.map((r: any) => ({
      rank: r.rank as number,
      playerName: r.player_name as string,
      displayName: r.display_name as string,
      adp: r.adp as number,
      positions: r.positions as string,
      team: r.team as string,
      valueDelta: r.value_delta as number,
      isValuePick: r.is_value_pick as boolean,
      auctionValue: r.auction_value != null ? (r.auction_value as number) : undefined,
    }));

    return NextResponse.json({ players }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[v0] [ADP] /api/adp/load failed:', msg);
    return NextResponse.json({ players: null }, { status: 200 });
  }
}
