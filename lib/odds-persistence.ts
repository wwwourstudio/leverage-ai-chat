/**
 * Odds Persistence Layer
 * Handles storing and retrieving odds data by sport from Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey } from './config';

// Sport to table mapping
const SPORT_TABLES: Record<string, string> = {
  'basketball_nba': 'nba_odds',
  'americanfootball_nfl': 'nfl_odds',
  'baseball_mlb': 'mlb_odds',
  'icehockey_nhl': 'nhl_odds',
  'basketball_ncaab': 'ncaab_odds',
  'americanfootball_ncaaf': 'ncaaf_odds',
  'baseball_ncaa': 'college_baseball_odds',
};

interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
      }>;
    }>;
  }>;
}

interface StoredOddsRow {
  game_id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  h2h_odds: any[] | null;
  spreads: any[] | null;
  totals: any[] | null;
  cached_at: string;
}

/**
 * Get Supabase client with service role key (for writes)
 */
function getSupabaseClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase not configured. Missing URL or service key.');
  }

  return createClient(supabaseUrl, serviceKey, { db: { schema: 'api' } });
}


/**
 * Store odds data for a specific sport
 */
export async function storeOddsData(
  sportKey: string,
  events: OddsEvent[],
  metadata: { remainingRequests?: string; usedRequests?: string }
): Promise<{ success: boolean; stored: number; errors: string[] }> {
  const tableName = SPORT_TABLES[sportKey];

  if (!tableName) {
    console.warn(`[OddsPersistence] No table mapping for sport: ${sportKey}`);
    return { success: false, stored: 0, errors: [`Unknown sport: ${sportKey}`] };
  }

  try {
    const supabase = getSupabaseClient();
    const rows: StoredOddsRow[] = [];
    const errors: string[] = [];

    console.log(`[v0] Storing ${events.length} events for ${sportKey} in table ${tableName}`);

    for (const event of events) {
      try {
        // Aggregate all bookmakers' markets into per-type JSONB arrays
        const h2hOdds: any[] = [];
        const spreadsOdds: any[] = [];
        const totalsOdds: any[] = [];

        for (const bookmaker of event.bookmakers || []) {
          for (const market of bookmaker.markets || []) {
            const entry = { bookmaker: bookmaker.key, outcomes: market.outcomes };
            if (market.key === 'h2h') h2hOdds.push(entry);
            else if (market.key === 'spreads') spreadsOdds.push(entry);
            else if (market.key === 'totals') totalsOdds.push(entry);
          }
        }

        rows.push({
          game_id:       event.id,
          home_team:     event.home_team,
          away_team:     event.away_team,
          commence_time: event.commence_time,
          h2h_odds:      h2hOdds.length    ? h2hOdds    : null,
          spreads:       spreadsOdds.length ? spreadsOdds : null,
          totals:        totalsOdds.length  ? totalsOdds  : null,
          cached_at:     new Date().toISOString(),
        });
      } catch (eventError: any) {
        errors.push(`Event ${event.id}: ${eventError.message}`);
        console.error(`[v0] Error processing event ${event.id}:`, eventError);
      }
    }

    if (rows.length === 0) {
      console.warn(`[v0] No rows to insert for ${sportKey}`);
      return { success: true, stored: 0, errors };
    }

    // Upsert on game_id (unique per sport table)
    const { data, error } = await supabase.from(tableName).upsert(rows, {
      onConflict: 'game_id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error(`[v0] Supabase insert error for ${tableName}:`, error);
      errors.push(`Database error: ${error.message}`);
      return { success: false, stored: 0, errors };
    }

    console.log(`[v0] ✅ Stored ${rows.length} odds records in ${tableName}`);
    return { success: true, stored: rows.length, errors };
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[v0] Error storing odds for ${sportKey}:`, errorMsg);
    return { success: false, stored: 0, errors: [errorMsg] };
  }
}

/**
 * Retrieve recent odds for a sport
 */
export async function getRecentOdds(
  sportKey: string,
  limit: number = 50
): Promise<{ success: boolean; data: any[]; error?: string }> {
  const tableName = SPORT_TABLES[sportKey];

  if (!tableName) {
    return { success: false, data: [], error: `Unknown sport: ${sportKey}` };
  }

  try {
    const supabase = getSupabaseClient();

    // Sport tables use cached_at; treat rows older than 5 min as expired
    const freshSince = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .gt('cached_at', freshSince)
      .order('cached_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`[v0] Error fetching odds from ${tableName}:`, error);
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[v0] Error retrieving odds for ${sportKey}:`, errorMsg);
    return { success: false, data: [], error: errorMsg };
  }
}

/**
 * Get all supported sports with table mappings
 */
export function getSupportedSportsForPersistence(): Array<{ sportKey: string; tableName: string }> {
  return Object.entries(SPORT_TABLES).map(([sportKey, tableName]) => ({
    sportKey,
    tableName,
  }));
}

/**
 * Clean up expired odds across all tables
 */
export async function cleanupExpiredOdds(): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = getSupabaseClient();
    const cutoffTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    let totalDeleted = 0;

    for (const tableName of Object.values(SPORT_TABLES)) {
      const { error, count } = await supabase
        .from(tableName)
        .delete()
        .lt('cached_at', cutoffTime);

      if (error) {
        console.error(`[v0] Error cleaning up ${tableName}:`, error);
      } else {
        console.log(`[v0] Cleaned up ${count || 0} expired records from ${tableName}`);
        totalDeleted += count || 0;
      }
    }

    return {
      success: true,
      message: `Cleaned up ${totalDeleted} expired odds records`,
    };
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[v0] Error during cleanup:`, errorMsg);
    return { success: false, message: errorMsg };
  }
}
