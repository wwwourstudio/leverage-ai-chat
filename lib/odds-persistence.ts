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
  event_id: string;
  event_name: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  market_type: string;
  sportsbook: string;
  home_odds?: number;
  away_odds?: number;
  home_implied_prob?: number;
  away_implied_prob?: number;
  home_spread?: number;
  home_spread_odds?: number;
  away_spread?: number;
  away_spread_odds?: number;
  over_total?: number;
  over_odds?: number;
  under_total?: number;
  under_odds?: number;
  raw_odds_data: any;
  source: string;
  api_requests_remaining?: number;
  fetched_at: string;
  expires_at: string;
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

  return createClient(supabaseUrl, serviceKey);
}

/**
 * Calculate implied probability from American odds
 */
function calculateImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
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
        const eventName = `${event.away_team} @ ${event.home_team}`;

        // Process each bookmaker's markets
        for (const bookmaker of event.bookmakers || []) {
          for (const market of bookmaker.markets || []) {
            const row: StoredOddsRow = {
              event_id: event.id,
              event_name: eventName,
              home_team: event.home_team,
              away_team: event.away_team,
              commence_time: event.commence_time,
              market_type: market.key,
              sportsbook: bookmaker.key,
              raw_odds_data: {
                sport_key: event.sport_key,
                sport_title: event.sport_title,
                bookmaker: bookmaker.title,
                market: market,
              },
              source: 'the-odds-api',
              api_requests_remaining: metadata.remainingRequests ? parseInt(metadata.remainingRequests) : undefined,
              fetched_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
            };

            // Extract odds based on market type
            if (market.key === 'h2h') {
              const homeOutcome = market.outcomes.find((o) => o.name === event.home_team);
              const awayOutcome = market.outcomes.find((o) => o.name === event.away_team);

              if (homeOutcome) {
                row.home_odds = homeOutcome.price;
                row.home_implied_prob = calculateImpliedProbability(homeOutcome.price);
              }
              if (awayOutcome) {
                row.away_odds = awayOutcome.price;
                row.away_implied_prob = calculateImpliedProbability(awayOutcome.price);
              }
            } else if (market.key === 'spreads') {
              const homeOutcome = market.outcomes.find((o) => o.name === event.home_team);
              const awayOutcome = market.outcomes.find((o) => o.name === event.away_team);

              if (homeOutcome && 'point' in homeOutcome) {
                row.home_spread = (homeOutcome as any).point;
                row.home_spread_odds = homeOutcome.price;
              }
              if (awayOutcome && 'point' in awayOutcome) {
                row.away_spread = (awayOutcome as any).point;
                row.away_spread_odds = awayOutcome.price;
              }
            } else if (market.key === 'totals') {
              const overOutcome = market.outcomes.find((o) => o.name === 'Over');
              const underOutcome = market.outcomes.find((o) => o.name === 'Under');

              if (overOutcome && 'point' in overOutcome) {
                row.over_total = (overOutcome as any).point;
                row.over_odds = overOutcome.price;
              }
              if (underOutcome && 'point' in underOutcome) {
                row.under_total = (underOutcome as any).point;
                row.under_odds = underOutcome.price;
              }
            }

            rows.push(row);
          }
        }
      } catch (eventError: any) {
        errors.push(`Event ${event.id}: ${eventError.message}`);
        console.error(`[v0] Error processing event ${event.id}:`, eventError);
      }
    }

    if (rows.length === 0) {
      console.warn(`[v0] No rows to insert for ${sportKey}`);
      return { success: true, stored: 0, errors };
    }

    // Batch insert with upsert behavior
    const { data, error } = await supabase.from(tableName).upsert(rows, {
      onConflict: 'event_id,sportsbook,market_type,fetched_at',
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

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('fetched_at', { ascending: false })
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
        .lt('expires_at', cutoffTime);

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
