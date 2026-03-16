import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types from adp-data.ts
export interface NFBCPlayer {
  rank: number;
  playerName: string;
  displayName: string;
  adp: number;
  positions: string;
  team: string;
  valueDelta: number;
  isValuePick: boolean;
  auctionValue?: number;
}

// Module-level singleton - only created on server
let _adpSupabaseServer: SupabaseClient | null = null;

function getADPSupabaseClient(): SupabaseClient | null {
  if (_adpSupabaseServer) return _adpSupabaseServer;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  _adpSupabaseServer = createClient(url, key, {
    db: { schema: 'api' },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _adpSupabaseServer;
}

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function saveADPToSupabase(players: NFBCPlayer[], sport = 'mlb'): Promise<void> {
  try {
    const supabase = getADPSupabaseClient();
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
    // Upsert in batches of 50 to stay well within payload limits
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
  } catch (err) {
    console.warn('[v0] [ADP] saveADPToSupabase failed (non-critical):', err);
  }
}

export async function loadADPFromSupabase(sport = 'mlb', allowStale = false): Promise<NFBCPlayer[] | null> {
  try {
    const supabase = getADPSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('nfbc_adp')
      .select('*')
      .eq('sport', sport)
      .order('rank', { ascending: true })
      .limit(300);
    if (error || !data || data.length === 0) return null;
    // Check freshness unless allowStale — compare against cache TTL (4 hours)
    if (!allowStale) {
      const latestFetch = data[0]?.fetched_at ? new Date(data[0].fetched_at).getTime() : 0;
      if (Date.now() - latestFetch > CACHE_TTL_MS) return null;
    }
    return data.map((r: any) => ({
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
  } catch (err) {
    console.warn('[v0] [ADP] loadADPFromSupabase failed (non-critical):', err);
    return null;
  }
}
