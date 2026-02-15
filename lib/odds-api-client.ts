/// <reference types="node" />

/**
 * The Odds API Client - Comprehensive Multi-Sport Implementation
 * Supports all sports categories and historical data endpoints
 */

import { ENV_KEYS, LOG_PREFIXES, EXTERNAL_APIS } from '@/lib/constants';

// All supported sports from The Odds API
export const ODDS_API_SPORTS = {
  // American Football
  NFL: 'americanfootball_nfl',
  NCAAF: 'americanfootball_ncaaf',
  
  // Basketball  
  NBA: 'basketball_nba',
  NCAAB: 'basketball_ncaab',
  EUROLEAGUE: 'basketball_euroleague',
  NBL: 'basketball_nbl',
  
  // Baseball
  MLB: 'baseball_mlb',
  
  // Hockey
  NHL: 'icehockey_nhl',
  
  // Soccer
  EPL: 'soccer_epl',
  LA_LIGA: 'soccer_spain_la_liga',
  BUNDESLIGA: 'soccer_germany_bundesliga',
  SERIE_A: 'soccer_italy_serie_a',
  LIGUE_1: 'soccer_france_ligue_one',
  UEFA_CHAMPIONS: 'soccer_uefa_champs_league',
  UEFA_EUROPA: 'soccer_uefa_europa_league',
  MLS: 'soccer_usa_mls',
  
  // Tennis
  ATP: 'tennis_atp',
  WTA: 'tennis_wta',
  
  // MMA
  UFC: 'mma_mixed_martial_arts',
  
  // Golf
  PGA: 'golf_pga_championship',
  
  // Boxing
  BOXING: 'boxing_boxing'
} as const;

export type OddsSport = typeof ODDS_API_SPORTS[keyof typeof ODDS_API_SPORTS];

// Sport metadata
export interface SportInfo {
  key: string;
  name: string;
  category: string;
  active: boolean;
  hasOutrights: boolean;
}

// Sport information lookup
export const SPORT_INFO: Record<string, SportInfo> = {
  [ODDS_API_SPORTS.NFL]: { key: ODDS_API_SPORTS.NFL, name: 'NFL', category: 'American Football', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.NCAAF]: { key: ODDS_API_SPORTS.NCAAF, name: 'NCAA Football', category: 'American Football', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.NBA]: { key: ODDS_API_SPORTS.NBA, name: 'NBA', category: 'Basketball', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.NCAAB]: { key: ODDS_API_SPORTS.NCAAB, name: 'NCAA Basketball', category: 'Basketball', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.EUROLEAGUE]: { key: ODDS_API_SPORTS.EUROLEAGUE, name: 'Euroleague', category: 'Basketball', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.NBL]: { key: ODDS_API_SPORTS.NBL, name: 'NBL', category: 'Basketball', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.MLB]: { key: ODDS_API_SPORTS.MLB, name: 'MLB', category: 'Baseball', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.NHL]: { key: ODDS_API_SPORTS.NHL, name: 'NHL', category: 'Hockey', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.EPL]: { key: ODDS_API_SPORTS.EPL, name: 'Premier League', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.LA_LIGA]: { key: ODDS_API_SPORTS.LA_LIGA, name: 'La Liga', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.BUNDESLIGA]: { key: ODDS_API_SPORTS.BUNDESLIGA, name: 'Bundesliga', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.SERIE_A]: { key: ODDS_API_SPORTS.SERIE_A, name: 'Serie A', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.LIGUE_1]: { key: ODDS_API_SPORTS.LIGUE_1, name: 'Ligue 1', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.UEFA_CHAMPIONS]: { key: ODDS_API_SPORTS.UEFA_CHAMPIONS, name: 'Champions League', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.UEFA_EUROPA]: { key: ODDS_API_SPORTS.UEFA_EUROPA, name: 'Europa League', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.MLS]: { key: ODDS_API_SPORTS.MLS, name: 'MLS', category: 'Soccer', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.ATP]: { key: ODDS_API_SPORTS.ATP, name: 'ATP', category: 'Tennis', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.WTA]: { key: ODDS_API_SPORTS.WTA, name: 'WTA', category: 'Tennis', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.UFC]: { key: ODDS_API_SPORTS.UFC, name: 'UFC/MMA', category: 'MMA', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.PGA]: { key: ODDS_API_SPORTS.PGA, name: 'PGA', category: 'Golf', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.BOXING]: { key: ODDS_API_SPORTS.BOXING, name: 'Boxing', category: 'Boxing', active: true, hasOutrights: false },
};

// Market types
export const ODDS_MARKETS = {
  H2H: 'h2h', // Head to head (moneyline)
  SPREADS: 'spreads',
  TOTALS: 'totals',
  OUTRIGHTS: 'outrights', // Championship/tournament winners
  PLAYER_PROPS: 'player_props'
} as const;

// Betting regions
export const BETTING_REGIONS = {
  US: 'us',
  UK: 'uk',
  EU: 'eu',
  AU: 'au'
} as const;

// Odds formats
export const ODDS_FORMATS = {
  AMERICAN: 'american',
  DECIMAL: 'decimal',
  FRACTIONAL: 'fractional'
} as const;

/**
 * Validate and normalize sport key
 */
export function validateSportKey(sport: string): { 
  isValid: boolean; 
  normalizedKey?: string; 
  error?: string;
  suggestion?: string;
} {
  if (!sport) {
    return { isValid: false, error: 'No sport specified' };
  }

  const lowerSport = sport.toLowerCase();
  
  // Direct match
  if (Object.values(ODDS_API_SPORTS).includes(lowerSport as OddsSport)) {
    return { isValid: true, normalizedKey: lowerSport };
  }

  // Fuzzy matching
  const sportAliases: Record<string, OddsSport> = {
    'football': ODDS_API_SPORTS.NFL,
    'nfl': ODDS_API_SPORTS.NFL,
    'ncaa_football': ODDS_API_SPORTS.NCAAF,
    'college_football': ODDS_API_SPORTS.NCAAF,
    'basketball': ODDS_API_SPORTS.NBA,
    'nba': ODDS_API_SPORTS.NBA,
    'ncaa_basketball': ODDS_API_SPORTS.NCAAB,
    'college_basketball': ODDS_API_SPORTS.NCAAB,
    'baseball': ODDS_API_SPORTS.MLB,
    'mlb': ODDS_API_SPORTS.MLB,
    'hockey': ODDS_API_SPORTS.NHL,
    'nhl': ODDS_API_SPORTS.NHL,
    'soccer': ODDS_API_SPORTS.EPL,
    'premier_league': ODDS_API_SPORTS.EPL,
    'epl': ODDS_API_SPORTS.EPL,
    'la_liga': ODDS_API_SPORTS.LA_LIGA,
    'bundesliga': ODDS_API_SPORTS.BUNDESLIGA,
    'serie_a': ODDS_API_SPORTS.SERIE_A,
    'ligue_1': ODDS_API_SPORTS.LIGUE_1,
    'champions_league': ODDS_API_SPORTS.UEFA_CHAMPIONS,
    'europa_league': ODDS_API_SPORTS.UEFA_EUROPA,
    'mls': ODDS_API_SPORTS.MLS,
    'tennis': ODDS_API_SPORTS.ATP,
    'atp': ODDS_API_SPORTS.ATP,
    'wta': ODDS_API_SPORTS.WTA,
    'mma': ODDS_API_SPORTS.UFC,
    'ufc': ODDS_API_SPORTS.UFC,
    'golf': ODDS_API_SPORTS.PGA,
    'pga': ODDS_API_SPORTS.PGA,
    'boxing': ODDS_API_SPORTS.BOXING
  };

  const normalizedKey = sportAliases[lowerSport];
  if (normalizedKey) {
    return { isValid: true, normalizedKey };
  }

  // Not found
  return {
    isValid: false,
    error: `Unknown sport: ${sport}`,
    suggestion: 'Try: nfl, nba, mlb, nhl, soccer, tennis, mma, golf, or boxing'
  };
}

/**
 * Get sport information
 */
export function getSportInfo(sportKey: string): SportInfo {
  const sportInfo: SportInfo = SPORT_INFO[sportKey] || {
    key: sportKey,
    name: sportKey.toUpperCase(),
    category: 'Unknown',
    active: false,
    hasOutrights: false
  };
  return sportInfo;
}

// Request cache to prevent duplicate calls
const requestCache = new Map<string, { data: any; timestamp: number; promise?: Promise<any> }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const IN_FLIGHT_TTL = 30 * 1000; // 30 seconds for in-flight requests

/**
 * Exponential backoff retry logic
 */
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
      
      // Don't retry on 4xx errors (except 429 rate limit)
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`${LOG_PREFIXES.API} Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Fetch live odds for a sport with caching and retry logic
 */
export async function fetchLiveOdds(
  sportKey: string,
  options: {
    markets?: string[];
    regions?: string[];
    oddsFormat?: string;
    apiKey: string;
    skipCache?: boolean;
  }
): Promise<any> {
  const {
    markets = [ODDS_MARKETS.H2H, ODDS_MARKETS.SPREADS, ODDS_MARKETS.TOTALS],
    regions = [BETTING_REGIONS.US],
    oddsFormat = ODDS_FORMATS.AMERICAN,
    apiKey,
    skipCache = false
  } = options;

  const baseUrl = EXTERNAL_APIS.ODDS_API.BASE_URL;
  const marketsParam = markets.join(',');
  const regionsParam = regions.join(',');
  const url = `${baseUrl}/sports/${sportKey}/odds?apiKey=${apiKey}&regions=${regionsParam}&markets=${marketsParam}&oddsFormat=${oddsFormat}`;
  
  const cacheKey = `odds:${sportKey}:${marketsParam}:${regionsParam}`;
  
  // If skipCache requested, clear any existing cache entry to force fresh fetch
  if (skipCache) {
    console.log(`${LOG_PREFIXES.API} skipCache=true, clearing cache for ${sportKey}`);
    requestCache.delete(cacheKey);
  }
  
  // Check cache (only if not skipping)
  if (!skipCache) {
    const cached = requestCache.get(cacheKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      
      // Return cached data if still fresh
      if (age < CACHE_TTL) {
        console.log(`${LOG_PREFIXES.API} Cache hit for ${sportKey} (age: ${Math.round(age / 1000)}s), markets: ${marketsParam}`);
        return cached.data;
      }
      
      // If there's an in-flight request, wait for it
      if (cached.promise && age < IN_FLIGHT_TTL) {
        console.log(`${LOG_PREFIXES.API} Waiting for in-flight request for ${sportKey}`);
        try {
          return await cached.promise;
        } catch (error) {
          // If in-flight request failed, continue to make new request
          console.log(`${LOG_PREFIXES.API} In-flight request failed, making new request`);
        }
      }
    }
  }
  
  console.log(`[v0] [ODDS-API] Fetching live odds for ${sportKey}`);
  console.log(`[v0] [ODDS-API] Markets requested: ${marketsParam}`);
  console.log(`[v0] [ODDS-API] Regions: ${regionsParam}`);
  console.log(`[v0] [ODDS-API] Skip cache: ${skipCache}`);
  console.log(`[v0] [ODDS-API] URL: ${url.replace(apiKey, 'REDACTED')}`);

  // Create the fetch promise
  const fetchPromise = retryWithBackoff(async () => {
    console.log(`[v0] [ODDS-API] Making HTTP request to API...`);
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      const error: any = new Error(`Odds API error (${response.status}): ${errorText}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    
    console.log(`[v0] [ODDS-API] ✓ Received ${data?.length || 0} games for ${sportKey}`);
    
    if (data && data.length > 0) {
      const sample = data[0];
      console.log(`[v0] [ODDS-API] Sample: ${sample.away_team} @ ${sample.home_team}`);
      const sampleBookies = sample.bookmakers?.length || 0;
      console.log(`[v0] [ODDS-API] Bookmakers: ${sampleBookies}`);
      
      if (sample.bookmakers && sample.bookmakers[0]?.markets) {
        const marketTypes = sample.bookmakers[0].markets.map((m: any) => m.key);
        console.log(`[v0] [ODDS-API] Market types in response: ${marketTypes.join(', ')}`);
      }
    }
    
    // Cache successful response
    requestCache.set(cacheKey, { 
      data, 
      timestamp: Date.now(),
      promise: undefined
    });
    
    return data;
  }, 3, 1000);

  // Store in-flight promise
  if (!skipCache) {
    requestCache.set(cacheKey, {
      data: null,
      timestamp: Date.now(),
      promise: fetchPromise
    });
  }

  return fetchPromise;
}

/**
 * Fetch historical odds (requires historical data endpoint)
 */
export async function fetchHistoricalOdds(
  sportKey: string,
  date: string, // ISO format: YYYY-MM-DD
  options: {
    markets?: string[];
    regions?: string[];
    oddsFormat?: string;
    apiKey: string;
  }
): Promise<any> {
  const {
    markets = [ODDS_MARKETS.H2H, ODDS_MARKETS.SPREADS, ODDS_MARKETS.TOTALS],
    regions = [BETTING_REGIONS.US],
    oddsFormat = ODDS_FORMATS.AMERICAN,
    apiKey
  } = options;

  const baseUrl = EXTERNAL_APIS.ODDS_API.BASE_URL;
  const marketsParam = markets.join(',');
  const regionsParam = regions.join(',');

  const url = `${baseUrl}/sports/${sportKey}/odds-history?apiKey=${apiKey}&regions=${regionsParam}&markets=${marketsParam}&oddsFormat=${oddsFormat}&date=${date}`;
  
  console.log(`${LOG_PREFIXES.API} Fetching historical odds:`, { sportKey, date, markets, regions });

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Odds API historical error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch available sports
 */
export async function fetchAvailableSports(apiKey: string): Promise<any> {
  const baseUrl = EXTERNAL_APIS.ODDS_API.BASE_URL;
  const url = `${baseUrl}/sports?apiKey=${apiKey}`;
  
  console.log(`${LOG_PREFIXES.API} Fetching available sports`);

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Odds API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch outrights/futures (championship winners, etc.)
 */
export async function fetchOutrights(
  sportKey: string,
  options: {
    regions?: string[];
    oddsFormat?: string;
    apiKey: string;
  }
): Promise<any> {
  const {
    regions = [BETTING_REGIONS.US],
    oddsFormat = ODDS_FORMATS.AMERICAN,
    apiKey
  } = options;

  const sportInfo = getSportInfo(sportKey);
  
  if (!sportInfo.hasOutrights) {
    console.log(`${LOG_PREFIXES.API} Sport ${sportKey} does not support outrights`);
    return [];
  }

  const baseUrl = EXTERNAL_APIS.ODDS_API.BASE_URL;
  const regionsParam = regions.join(',');

  const url = `${baseUrl}/sports/${sportKey}/outrights?apiKey=${apiKey}&regions=${regionsParam}&oddsFormat=${oddsFormat}`;
  
  console.log(`${LOG_PREFIXES.API} Fetching outrights:`, { sportKey, regions });

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Odds API outrights error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Get all active sports
 */
export function getActiveSports(): SportInfo[] {
  return Object.values(SPORT_INFO).filter(sport => sport.active);
}

/**
 * Get sports by category
 */
export function getSportsByCategory(category: string): SportInfo[] {
  return Object.values(SPORT_INFO).filter(
    sport => sport.active && sport.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Clear request cache
 */
export function clearOddsCache(sportKey?: string): void {
  if (sportKey) {
    // Clear cache for specific sport
    for (const key of requestCache.keys()) {
      if (key.startsWith(`odds:${sportKey}:`)) {
        requestCache.delete(key);
      }
    }
    console.log(`${LOG_PREFIXES.API} Cleared cache for ${sportKey}`);
  } else {
    // Clear all cache
    requestCache.clear();
    console.log(`${LOG_PREFIXES.API} Cleared all odds cache`);
  }
}

/**
 * Get cache statistics
 */
export function getOddsCacheStats(): {
  size: number;
  keys: string[];
  oldestEntry: number;
} {
  const entries = Array.from(requestCache.values());
  return {
    size: requestCache.size,
    keys: Array.from(requestCache.keys()),
    oldestEntry: entries.length > 0
      ? Math.min(...entries.map(e => e.timestamp))
      : Date.now()
  };
}
