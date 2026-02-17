/**
 * Unified Odds Service
 * Consolidates odds-api-client, enhanced-odds-client, unified-odds-fetcher, and supabase-odds-service
 * Single source of truth for all odds data fetching and storage
 */

import { ENV_KEYS, LOG_PREFIXES, EXTERNAL_APIS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';

// ============================================
// Supabase Odds Service (merged from supabase-odds-service.ts)
// ============================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class SupabaseOddsService {
  private supabase = createClient();

  async getCachedOdds(sport: string) {
    const { data, error } = await this.supabase
      .from('live_odds_cache')
      .select('*')
      .eq('sport_key', sport)
      .gt('expires_at', new Date().toISOString())
      .order('cached_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error fetching cached odds:', error);
      return [];
    }

    console.log(`[Supabase] Found ${data?.length || 0} cached games for ${sport}`);
    return data || [];
  }

  async storeOdds(sport: string, sportKey: string, games: any[]) {
    const records = games.map((game: any) => ({
      sport,
      sport_key: sportKey,
      game_id: game.id,
      home_team: game.home_team,
      away_team: game.away_team,
      commence_time: game.commence_time,
      bookmakers: game.bookmakers,
      markets: game.bookmakers?.[0]?.markets || [],
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CACHE_TTL).toISOString()
    }));

    const { error } = await this.supabase
      .from('live_odds_cache')
      .upsert(records, { onConflict: 'game_id' });

    if (error) {
      console.error('[Supabase] Error storing odds:', error);
      return false;
    }

    console.log(`[Supabase] Stored ${records.length} games for ${sport}`);
    return true;
  }

  async storeSportOdds(sport: string, games: any[]) {
    const tableName = `${sport}_odds`;
    
    const records = games.map((game: any) => {
      const firstBook = game.bookmakers?.[0];
      const h2hMarket = firstBook?.markets?.find((m: any) => m.key === 'h2h');
      const spreadsMarket = firstBook?.markets?.find((m: any) => m.key === 'spreads');
      const totalsMarket = firstBook?.markets?.find((m: any) => m.key === 'totals');

      return {
        game_id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        commence_time: game.commence_time,
        h2h_odds: h2hMarket?.outcomes || null,
        spreads: spreadsMarket?.outcomes || null,
        totals: totalsMarket?.outcomes || null,
        cached_at: new Date().toISOString()
      };
    });

    const { error } = await this.supabase
      .from(tableName)
      .upsert(records, { onConflict: 'game_id' });

    if (error) {
      console.error(`[Supabase] Error storing ${sport} odds:`, error);
      return false;
    }

    console.log(`[Supabase] Stored ${records.length} games in ${tableName}`);
    return true;
  }

  async getEdgeOpportunities(sport?: string) {
    let query = this.supabase
      .from('edge_opportunities')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('edge', { ascending: false });

    if (sport) {
      query = query.eq('sport', sport);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Supabase] Error fetching edge opportunities:', error);
      return [];
    }

    return data || [];
  }

  async storeEdgeOpportunity(opportunity: {
    market_id: string;
    sport: string;
    matchup: string;
    model_prob: number;
    market_prob: number;
    edge: number;
    confidence_score: number;
    expires_at: string;
  }) {
    const { error } = await this.supabase
      .from('edge_opportunities')
      .insert(opportunity);

    if (error) {
      console.error('[Supabase] Error storing edge opportunity:', error);
      return false;
    }

    console.log('[Supabase] Stored edge opportunity:', opportunity.market_id);
    return true;
  }

  async getArbitrageOpportunities(sport?: string) {
    let query = this.supabase
      .from('arbitrage_opportunities')
      .select('*')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('profit_margin', { ascending: false});

    if (sport) {
      query = query.eq('sport', sport);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Supabase] Error fetching arbitrage opportunities:', error);
      return [];
    }

    return data || [];
  }

  async storeArbitrageOpportunity(arb: {
    market_id: string;
    sport: string;
    matchup: string;
    side_a_book: string;
    side_a_odds: number;
    side_a_stake: number;
    side_b_book: string;
    side_b_odds: number;
    side_b_stake: number;
    profit_margin: number;
    total_implied_prob: number;
    expires_at: string;
  }) {
    const { error } = await this.supabase
      .from('arbitrage_opportunities')
      .insert(arb);

    if (error) {
      console.error('[Supabase] Error storing arbitrage opportunity:', error);
      return false;
    }

    console.log('[Supabase] Stored arbitrage opportunity:', arb.market_id);
    return true;
  }

  async getActiveCapitalState() {
    const { data, error } = await this.supabase
      .from('capital_state')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('[Supabase] Error fetching capital state:', error);
      return null;
    }

    return data;
  }

  async storeBetAllocation(allocation: {
    capital_state_id: string;
    market_id: string;
    sport: string;
    matchup: string;
    edge: number;
    kelly_fraction: number;
    allocated_capital: number;
    confidence_score: number;
  }) {
    const { error } = await this.supabase
      .from('bet_allocations')
      .insert(allocation);

    if (error) {
      console.error('[Supabase] Error storing bet allocation:', error);
      return false;
    }

    console.log('[Supabase] Stored bet allocation:', allocation.market_id);
    return true;
  }

  async trackAIResponse(response: {
    query: string;
    response: string;
    trust_score: number;
    consensus_score: number;
    data_sources: any;
  }) {
    const { error } = await this.supabase
      .from('ai_response_trust')
      .insert(response);

    if (error) {
      console.error('[Supabase] Error tracking AI response:', error);
      return false;
    }

    return true;
  }
}

export const supabaseOddsService = new SupabaseOddsService();

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
const IN_FLIGHT_TTL = 30 * 1000; // 30 seconds
// CACHE_TTL is already defined at line 14

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
