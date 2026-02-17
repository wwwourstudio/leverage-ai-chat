/**
 * Unified Odds Service
 * Consolidates odds-api-client, enhanced-odds-client, unified-odds-fetcher, and supabase-odds-service
 * Single source of truth for all odds data fetching and storage
 */

import { ENV_KEYS, LOG_PREFIXES, EXTERNAL_APIS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';

// Re-export Supabase odds service singleton
export { supabaseOddsService } from '@/lib/supabase-odds-service';

// ============================================
// Types & Constants
// ============================================

export const ODDS_API_SPORTS = {
  NFL: 'americanfootball_nfl',
  NCAAF: 'americanfootball_ncaaf',
  NBA: 'basketball_nba',
  NCAAB: 'basketball_ncaab',
  MLB: 'baseball_mlb',
  NHL: 'icehockey_nhl',
  EPL: 'soccer_epl',
  LA_LIGA: 'soccer_spain_la_liga',
  MLS: 'soccer_usa_mls',
  UFC: 'mma_mixed_martial_arts',
  ATP: 'tennis_atp',
  WTA: 'tennis_wta',
} as const;

export type OddsSport = typeof ODDS_API_SPORTS[keyof typeof ODDS_API_SPORTS];

export const ODDS_MARKETS = {
  H2H: 'h2h',
  SPREADS: 'spreads',
  TOTALS: 'totals',
  OUTRIGHTS: 'outrights',
  PLAYER_PROPS: 'player_props'
} as const;

export const BETTING_REGIONS = {
  US: 'us',
  UK: 'uk',
  EU: 'eu',
  AU: 'au'
} as const;

export interface OddsAPIOptions {
  apiKey: string;
  markets?: string[];
  regions?: string[];
  oddsFormat?: 'decimal' | 'american';
  bookmakers?: string[];
  eventIds?: string[];
  commenceTimeFrom?: string;
  commenceTimeTo?: string;
  includeLinks?: boolean;
  skipCache?: boolean;
}

// ============================================
// Cache Management
// ============================================

const requestCache = new Map<string, { data: any; timestamp: number; promise?: Promise<any> }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const IN_FLIGHT_TTL = 30 * 1000; // 30 seconds

export function clearOddsCache(sportKey?: string): void {
  if (sportKey) {
    for (const key of requestCache.keys()) {
      if (key.startsWith(`odds:${sportKey}:`)) {
        requestCache.delete(key);
      }
    }
    console.log(`${LOG_PREFIXES.API} Cleared cache for ${sportKey}`);
  } else {
    requestCache.clear();
    console.log(`${LOG_PREFIXES.API} Cleared all odds cache`);
  }
}

// ============================================
// Sport Validation
// ============================================

export function validateSportKey(sport: string): { 
  isValid: boolean; 
  normalizedKey?: string; 
  error?: string;
} {
  if (!sport) {
    return { isValid: false, error: 'No sport specified' };
  }

  const lowerSport = sport.toLowerCase();
  
  if (Object.values(ODDS_API_SPORTS).includes(lowerSport as OddsSport)) {
    return { isValid: true, normalizedKey: lowerSport };
  }

  const sportAliases: Record<string, OddsSport> = {
    'football': ODDS_API_SPORTS.NFL,
    'nfl': ODDS_API_SPORTS.NFL,
    'basketball': ODDS_API_SPORTS.NBA,
    'nba': ODDS_API_SPORTS.NBA,
    'baseball': ODDS_API_SPORTS.MLB,
    'mlb': ODDS_API_SPORTS.MLB,
    'hockey': ODDS_API_SPORTS.NHL,
    'nhl': ODDS_API_SPORTS.NHL,
  };

  const normalizedKey = sportAliases[lowerSport];
  if (normalizedKey) {
    return { isValid: true, normalizedKey };
  }

  return { isValid: false, error: `Unknown sport: ${sport}` };
}

// ============================================
// Core Fetching Functions
// ============================================

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const status = (error as any).status;
      
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`${LOG_PREFIXES.API} Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

export async function fetchLiveOdds(
  sportKey: string,
  options: OddsAPIOptions
): Promise<any> {
  const {
    apiKey,
    markets = [ODDS_MARKETS.H2H, ODDS_MARKETS.SPREADS, ODDS_MARKETS.TOTALS],
    regions = [BETTING_REGIONS.US],
    oddsFormat = 'american',
    skipCache = false
  } = options;

  const baseUrl = EXTERNAL_APIS.ODDS_API.BASE_URL;
  const marketsParam = markets.join(',');
  const regionsParam = regions.join(',');
  const url = `${baseUrl}/sports/${sportKey}/odds?apiKey=${apiKey}&regions=${regionsParam}&markets=${marketsParam}&oddsFormat=${oddsFormat}`;
  
  const cacheKey = `odds:${sportKey}:${marketsParam}:${regionsParam}`;
  
  if (skipCache) {
    requestCache.delete(cacheKey);
  }
  
  if (!skipCache) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`${LOG_PREFIXES.API} Cache hit for ${sportKey}`);
      return cached.data;
    }
    
    if (cached?.promise && Date.now() - cached.timestamp < IN_FLIGHT_TTL) {
      return await cached.promise;
    }
  }

  const fetchPromise = retryWithBackoff(async () => {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      const error: any = new Error(`Odds API error (${response.status}): ${errorText}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    requestCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  });

  if (!skipCache) {
    requestCache.set(cacheKey, {
      data: null,
      timestamp: Date.now(),
      promise: fetchPromise
    });
  }

  return fetchPromise;
}

// ============================================
// Unified Fetcher with Supabase Integration
// ============================================

export async function getOddsWithCache(
  sport: string,
  options: {
    useCache?: boolean;
    storeResults?: boolean;
  } = {}
) {
  const { useCache = true, storeResults = true } = options;

  if (useCache) {
    const cachedOdds = await supabaseOddsService.getCachedOdds(sport);
    if (cachedOdds && cachedOdds.length > 0) {
      return cachedOdds;
    }
  }

  const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
  if (!apiKey) {
    throw new Error('ODDS_API_KEY not configured');
  }

  try {
    const oddsData = await fetchLiveOdds(sport, {
      apiKey,
      markets: ['h2h', 'spreads', 'totals'],
      regions: ['us'],
      oddsFormat: 'american',
      skipCache: !useCache
    });

    if (storeResults && oddsData.length > 0) {
      await Promise.all([
        supabaseOddsService.storeOdds(sport, sport, oddsData),
        supabaseOddsService.storeSportOdds(sport.split('_')[0], oddsData)
      ]);
    }

    return oddsData;
  } catch (error) {
    console.error('[Odds] Fetch error:', error);
    const cachedOdds = await supabaseOddsService.getCachedOdds(sport);
    return cachedOdds || [];
  }
}

// ============================================
// Arbitrage Detection
// ============================================

export async function findArbitrageOpportunities(
  sport: string,
  apiKey: string
): Promise<any[]> {
  const events = await fetchLiveOdds(sport, {
    apiKey,
    markets: ['h2h'],
    regions: ['us', 'us2', 'uk']
  });
  
  const opportunities: any[] = [];
  
  for (const event of events) {
    if (!event.bookmakers || event.bookmakers.length < 2) continue;
    
    const h2hMarkets = event.bookmakers
      .map((b: any) => b.markets?.find((m: any) => m.key === 'h2h'))
      .filter(Boolean);
    
    if (h2hMarkets.length < 2) continue;
    
    let bestHomeOdds = -Infinity;
    let bestAwayOdds = -Infinity;
    
    for (const market of h2hMarkets) {
      const homeOutcome = market.outcomes.find((o: any) => o.name === event.home_team);
      const awayOutcome = market.outcomes.find((o: any) => o.name === event.away_team);
      
      if (homeOutcome && homeOutcome.price > bestHomeOdds) {
        bestHomeOdds = homeOutcome.price;
      }
      if (awayOutcome && awayOutcome.price > bestAwayOdds) {
        bestAwayOdds = awayOutcome.price;
      }
    }
    
    const homeImplied = bestHomeOdds > 0 
      ? 100 / (bestHomeOdds + 100)
      : -bestHomeOdds / (-bestHomeOdds + 100);
    const awayImplied = bestAwayOdds > 0
      ? 100 / (bestAwayOdds + 100)
      : -bestAwayOdds / (-bestAwayOdds + 100);
    
    const totalImplied = homeImplied + awayImplied;
    
    if (totalImplied < 1) {
      const profit = ((1 / totalImplied) - 1) * 100;
      opportunities.push({
        event: `${event.away_team} @ ${event.home_team}`,
        gameTime: event.commence_time,
        profit: profit.toFixed(2) + '%',
        homeOdds: bestHomeOdds,
        awayOdds: bestAwayOdds
      });
    }
  }
  
  return opportunities;
}
