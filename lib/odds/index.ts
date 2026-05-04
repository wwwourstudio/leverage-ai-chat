/**
 * Unified Odds Service
 * Consolidates odds-api-client, enhanced-odds-client, and unified-odds-fetcher
 * Single source of truth for all odds data fetching
 */

import { ENV_KEYS, LOG_PREFIXES, EXTERNAL_APIS } from '@/lib/constants';
import { getOddsApiKey } from '@/lib/config';
import { americanToImpliedProb } from '@/lib/utils/odds-math';
import { supabaseOddsService } from '@/lib/supabase-odds-service';
import { oddsApiQueue } from '@/lib/api-request-manager';

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
    // NCAA sports — short forms and hyphenated UI values
    'ncaab': ODDS_API_SPORTS.NCAAB,
    'ncaaf': ODDS_API_SPORTS.NCAAF,
    'ncaa-basketball': ODDS_API_SPORTS.NCAAB,
    'ncaa-football': ODDS_API_SPORTS.NCAAF,
    'college basketball': ODDS_API_SPORTS.NCAAB,
    'college football': ODDS_API_SPORTS.NCAAF,
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

// Circuit breaker state management
const circuitBreakerState = new Map<string, {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}>();

const CIRCUIT_BREAKER_THRESHOLD = 3; // Open circuit after 3 failures
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
const CIRCUIT_BREAKER_RESET_TIMEOUT = 300000; // 5 minutes

function getCircuitBreakerState(key: string) {
  const state = circuitBreakerState.get(key);
  if (!state) {
    const newState = { failures: 0, lastFailureTime: 0, isOpen: false };
    circuitBreakerState.set(key, newState);
    return newState;
  }
  
  // Auto-reset if enough time has passed
  if (state.isOpen && Date.now() - state.lastFailureTime > CIRCUIT_BREAKER_RESET_TIMEOUT) {
    console.log(`${LOG_PREFIXES.API} Circuit breaker reset for ${key}`);
    state.failures = 0;
    state.isOpen = false;
  }
  
  return state;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  operationKey: string,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  const circuitState = getCircuitBreakerState(operationKey);
  
  // Check circuit breaker
  if (circuitState.isOpen) {
    const timeSinceFailure = Date.now() - circuitState.lastFailureTime;
    if (timeSinceFailure < CIRCUIT_BREAKER_TIMEOUT) {
      const waitTime = Math.ceil((CIRCUIT_BREAKER_TIMEOUT - timeSinceFailure) / 1000);
      const error: any = new Error(`Circuit breaker open for ${operationKey}. Try again in ${waitTime}s`);
      error.isCircuitBreakerOpen = true;
      throw error;
    } else {
      // Allow one retry attempt
      console.log(`${LOG_PREFIXES.API} Circuit breaker half-open, attempting request for ${operationKey}`);
    }
  }
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();
      
      // Success - reset circuit breaker
      if (circuitState.failures > 0) {
        console.log(`${LOG_PREFIXES.API} Circuit breaker cleared for ${operationKey}`);
        circuitState.failures = 0;
        circuitState.isOpen = false;
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      const status = (error as any).status;
      
      // Don't retry on client errors (except rate limiting)
      if (status && status >= 400 && status < 500 && status !== 429) {
        console.warn(`${LOG_PREFIXES.API} Non-retryable error ${status} for ${operationKey} — not retrying`);
        throw error;
      }
      
      // Increment circuit breaker failures
      circuitState.failures++;
      circuitState.lastFailureTime = Date.now();
      
      if (circuitState.failures >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitState.isOpen = true;
        console.error(`${LOG_PREFIXES.API} Circuit breaker opened for ${operationKey} after ${circuitState.failures} failures`);
      }
      
      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 500; // 0-500ms random jitter
        const delay = (initialDelay * Math.pow(2, attempt)) + jitter;
        const statusMsg = status === 429 ? 'Rate limited' : `Error ${status || 'unknown'}`;
        console.log(`${LOG_PREFIXES.API} ${statusMsg} - Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
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
    // Route through the global rate-limited queue to prevent thundering herd
    return oddsApiQueue.enqueue(async () => {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        const error: any = new Error(`Odds API error (${response.status}): ${errorText}`);
        error.status = response.status;
        if (response.status === 429) error.isQuota = true;
        throw error;
      }

      const data = await response.json();
      requestCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    }, 1); // priority 1 (normal)
  }, `odds:${sportKey}`, 3, 1000);

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

  const apiKey = getOddsApiKey();
  if (!apiKey) {
    throw new Error('ODDS_API_KEY not configured');
  }

  try {
    // Check if circuit breaker is open before even attempting the fetch
    const circuitState = getCircuitBreakerState(`odds:${sport}`);
    if (circuitState.isOpen) {
      const timeSinceFailure = Date.now() - circuitState.lastFailureTime;
      if (timeSinceFailure < CIRCUIT_BREAKER_TIMEOUT) {
        console.log(`${LOG_PREFIXES.API} Circuit breaker open for ${sport}, serving stale cache`);
        const staleCached = await supabaseOddsService.getCachedOdds(sport);
        if (staleCached && staleCached.length > 0) {
          return staleCached;
        }
        return [];
      }
    }

    const oddsData = await fetchLiveOdds(sport, {
      apiKey,
      markets: ['h2h', 'spreads', 'totals'],
      regions: ['us'],
      oddsFormat: 'american',
      skipCache: !useCache
    });

    if (storeResults && oddsData.length > 0) {
      // Store results async -- don't block the response
      // Pass the full sport key (e.g. basketball_nba) for both calls;
      // storeSportOdds handles the table name mapping internally
      void Promise.all([
        supabaseOddsService.storeOdds(sport, sport, oddsData),
        supabaseOddsService.storeSportOdds(sport, oddsData)
      ]).catch(err => console.error(`${LOG_PREFIXES.API} Store error for ${sport}:`, err));
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
    
    const homeImplied = americanToImpliedProb(bestHomeOdds);
    const awayImplied = americanToImpliedProb(bestAwayOdds);
    
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
