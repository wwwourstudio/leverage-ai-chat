/**
 * Supabase Data Service Layer
 * Provides typed queries for all sports odds tables
 * Eliminates hardcoded data with real database queries
 */

import { createClient } from '@/lib/supabase/server';
import { LOG_PREFIXES } from '@/lib/constants';
import type { Result } from '@/lib/types';
import { Ok, Err } from '@/lib/types';

// ============================================
// Types
// ============================================

export interface OddsRecord {
  id: string;
  event_id: string;
  sport: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: any;
  created_at: string;
  updated_at?: string;
}

export interface SportOddsQuery {
  sport: string;
  limit?: number;
  from?: Date;
  to?: Date;
  team?: string;
}

export interface OddsQueryResult {
  data: OddsRecord[];
  count: number;
  lastFetched?: string;
}

// ============================================
// Sport Table Mapping
// ============================================

const SPORT_TABLES = {
  nba: 'nba_odds',
  nfl: 'nfl_odds',
  nhl: 'nhl_odds',
  mlb: 'mlb_odds',
  ncaab: 'ncaab_odds',
  ncaaf: 'ncaaf_odds',
  baseball_ncaa: 'college_baseball_odds',
} as const;

type SportKey = keyof typeof SPORT_TABLES;

function getSportTable(sport: string): string | null {
  const normalizedSport = sport.toLowerCase().replace(/_/g, '');
  
  // Direct match
  if (normalizedSport in SPORT_TABLES) {
    return SPORT_TABLES[normalizedSport as SportKey];
  }
  
  // Handle variations
  const sportMappings: Record<string, SportKey> = {
    'americanfootballnfl': 'nfl',
    'americanfootballncaaf': 'ncaaf',
    'basketballnba': 'nba',
    'basketballncaab': 'ncaab',
    'icehockeynhl': 'nhl',
    'baseballmlb': 'mlb',
    'baseballncaa': 'baseball_ncaa',
    'collegebaseball': 'baseball_ncaa',
    'collegebasketball': 'ncaab',
    'collegefootball': 'ncaaf',
  };
  
  const mapped = sportMappings[normalizedSport];
  return mapped ? SPORT_TABLES[mapped] : null;
}

// ============================================
// Query Functions
// ============================================

/**
 * Fetch live/recent odds from Supabase for a specific sport
 */
export async function fetchOddsFromDB(
  query: SportOddsQuery
): Promise<Result<OddsQueryResult, Error>> {
  console.log(`${LOG_PREFIXES.DATA_SERVICE} [DB] Fetching odds for ${query.sport}`);
  
  try {
    const supabase = await createClient();
    const tableName = getSportTable(query.sport);
    
    if (!tableName) {
      return Err(new Error(`Unknown sport: ${query.sport}`));
    }

    console.log(`${LOG_PREFIXES.DATA_SERVICE} [DB] Querying table: ${tableName}`);
    
    let queryBuilder = supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .order('commence_time', { ascending: true });

    // Apply filters
    if (query.from) {
      queryBuilder = queryBuilder.gte('commence_time', query.from.toISOString());
    }
    
    if (query.to) {
      queryBuilder = queryBuilder.lte('commence_time', query.to.toISOString());
    }
    
    if (query.team) {
      queryBuilder = queryBuilder.or(
        `home_team.ilike.%${query.team}%,away_team.ilike.%${query.team}%`
      );
    }
    
    if (query.limit) {
      queryBuilder = queryBuilder.limit(query.limit);
    }

    const { data, error, count } = await queryBuilder;

    if (error) {
      console.error(`${LOG_PREFIXES.DATA_SERVICE} [DB] Query error:`, error);
      return Err(new Error(error.message));
    }

    console.log(`${LOG_PREFIXES.DATA_SERVICE} [DB] Found ${data?.length || 0} records`);

    return Ok({
      data: (data || []) as OddsRecord[],
      count: count || 0,
      lastFetched: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIXES.DATA_SERVICE} [DB] Exception:`, message);
    return Err(new Error(message));
  }
}

/**
 * Fetch odds for multiple sports at once
 */
export async function fetchMultiSportOdds(
  sports: string[],
  limit: number = 10
): Promise<Record<string, OddsQueryResult>> {
  console.log(`${LOG_PREFIXES.DATA_SERVICE} [DB] Fetching odds for ${sports.length} sports`);
  
  const results: Record<string, OddsQueryResult> = {};
  
  await Promise.all(
    sports.map(async (sport) => {
      const result = await fetchOddsFromDB({ sport, limit });
      if (result.ok) {
        results[sport] = result.value;
      } else {
        console.error(`${LOG_PREFIXES.DATA_SERVICE} [DB] Failed for ${sport}:`, result.error);
        results[sport] = { data: [], count: 0 };
      }
    })
  );
  
  return results;
}

/**
 * Get upcoming games (next 24-48 hours)
 */
export async function fetchUpcomingGames(
  sport: string,
  hoursAhead: number = 48
): Promise<Result<OddsQueryResult, Error>> {
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  return fetchOddsFromDB({
    sport,
    from: now,
    to: future,
    limit: 50,
  });
}

/**
 * Search for specific team matchups
 */
export async function searchTeamMatchups(
  sport: string,
  teamName: string
): Promise<Result<OddsQueryResult, Error>> {
  return fetchOddsFromDB({
    sport,
    team: teamName,
    limit: 20,
  });
}

/**
 * Get best odds across all sportsbooks for a specific game
 */
export async function getBestOddsForGame(
  eventId: string,
  sport: string
): Promise<Result<OddsRecord | null, Error>> {
  console.log(`${LOG_PREFIXES.DATA_SERVICE} [DB] Fetching best odds for event ${eventId}`);
  
  try {
    const supabase = await createClient();
    const tableName = getSportTable(sport);
    
    if (!tableName) {
      return Err(new Error(`Unknown sport: ${sport}`));
    }

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('event_id', eventId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return Ok(null);
      }
      return Err(new Error(error.message));
    }

    return Ok(data as OddsRecord);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Err(new Error(message));
  }
}

/**
 * Get database statistics for monitoring
 */
export async function getOddsStats(sport: string): Promise<Result<{
  totalRecords: number;
  oldestRecord?: string;
  newestRecord?: string;
  uniqueEvents: number;
}, Error>> {
  try {
    const supabase = await createClient();
    const tableName = getSportTable(sport);
    
    if (!tableName) {
      return Err(new Error(`Unknown sport: ${sport}`));
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return Err(new Error(countError.message));
    }

    // Get oldest and newest records
    const { data: oldestData } = await supabase
      .from(tableName)
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    const { data: newestData } = await supabase
      .from(tableName)
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get unique events count
    const { count: uniqueCount } = await supabase
      .from(tableName)
      .select('event_id', { count: 'exact', head: true });

    return Ok({
      totalRecords: count || 0,
      oldestRecord: oldestData?.created_at,
      newestRecord: newestData?.created_at,
      uniqueEvents: uniqueCount || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Err(new Error(message));
  }
}

/**
 * Check if sport table has recent data (within last hour)
 */
export async function hasRecentData(sport: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const tableName = getSportTable(sport);
    
    if (!tableName) {
      return false;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', oneHourAgo);

    return (count || 0) > 0;
  } catch (error) {
    console.error(`${LOG_PREFIXES.DATA_SERVICE} [DB] Error checking recent data:`, error);
    return false;
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Parse bookmaker data to extract best odds
 */
export function extractBestOdds(bookmakers: any[]): {
  bestHomeOdds: number | null;
  bestAwayOdds: number | null;
  bestHomeBook: string | null;
  bestAwayBook: string | null;
} {
  if (!Array.isArray(bookmakers) || bookmakers.length === 0) {
    return {
      bestHomeOdds: null,
      bestAwayOdds: null,
      bestHomeBook: null,
      bestAwayBook: null,
    };
  }

  let bestHomeOdds = -Infinity;
  let bestAwayOdds = -Infinity;
  let bestHomeBook: string | null = null;
  let bestAwayBook: string | null = null;

  for (const book of bookmakers) {
    if (!book.markets || !Array.isArray(book.markets)) continue;

    for (const market of book.markets) {
      if (market.key !== 'h2h' || !Array.isArray(market.outcomes)) continue;

      for (const outcome of market.outcomes) {
        const odds = outcome.price;
        
        if (outcome.name.toLowerCase().includes('home') && odds > bestHomeOdds) {
          bestHomeOdds = odds;
          bestHomeBook = book.key;
        } else if (outcome.name.toLowerCase().includes('away') && odds > bestAwayOdds) {
          bestAwayOdds = odds;
          bestAwayBook = book.key;
        }
      }
    }
  }

  return {
    bestHomeOdds: bestHomeOdds > -Infinity ? bestHomeOdds : null,
    bestAwayOdds: bestAwayOdds > -Infinity ? bestAwayOdds : null,
    bestHomeBook,
    bestAwayBook,
  };
}

/**
 * Convert American odds to implied probability
 */
export function oddsToImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

/**
 * Calculate expected value
 */
export function calculateExpectedValue(
  americanOdds: number,
  trueProbability: number
): number {
  const impliedProb = oddsToImpliedProbability(americanOdds);
  const decimalOdds = americanOdds > 0 ? (americanOdds / 100) + 1 : (100 / Math.abs(americanOdds)) + 1;
  
  return (trueProbability * decimalOdds) - 1;
}
