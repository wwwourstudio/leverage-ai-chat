import { fetchLiveOdds } from '@/lib/odds-api-client';
import { supabaseOddsService } from '@/lib/supabase-odds-service';

/**
 * Unified Odds Fetcher
 * Combines API fetching with Supabase caching and storage
 */
export async function getOddsWithCache(
  sport: string,
  options: {
    useCache?: boolean;
    storeResults?: boolean;
  } = {}
) {
  const { useCache = true, storeResults = true } = options;

  console.log(`[UnifiedFetcher] Fetching odds for ${sport}, useCache=${useCache}, storeResults=${storeResults}`);

  // Try cache first if enabled
  if (useCache) {
    const cachedOdds = await supabaseOddsService.getCachedOdds(sport);
    if (cachedOdds && cachedOdds.length > 0) {
      console.log(`[UnifiedFetcher] Returning ${cachedOdds.length} cached games for ${sport}`);
      return cachedOdds;
    }
  }

  // Fetch from API
  console.log(`[UnifiedFetcher] ===== FETCHING FRESH DATA =====`);
  console.log(`[UnifiedFetcher] Sport: ${sport}`);
  const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
  
  console.log(`[UnifiedFetcher] ====== API KEY DIAGNOSTIC ======`);
  console.log(`[UnifiedFetcher] ODDS_API_KEY exists: ${!!process.env.ODDS_API_KEY}`);
  console.log(`[UnifiedFetcher] NEXT_PUBLIC_ODDS_API_KEY exists: ${!!process.env.NEXT_PUBLIC_ODDS_API_KEY}`);
  console.log(`[UnifiedFetcher] Selected API Key present: ${!!apiKey}`);
  console.log(`[UnifiedFetcher] Selected API Key length: ${apiKey?.length || 0}`);
  console.log(`[UnifiedFetcher] Selected API Key first 8 chars: ${apiKey?.substring(0, 8) || 'N/A'}`);
  console.log(`[UnifiedFetcher] ================================`);
  
  if (!apiKey) {
    console.error('[UnifiedFetcher] ❌❌❌ CRITICAL: NO API KEY CONFIGURED ❌❌❌');
    console.error('[UnifiedFetcher] You must set ODDS_API_KEY or NEXT_PUBLIC_ODDS_API_KEY');
    console.error('[UnifiedFetcher] Get your free key at: https://the-odds-api.com/');
    throw new Error('ODDS_API_KEY not configured - cannot fetch odds data');
  }

  try {
    console.log(`[UnifiedFetcher] ====== CALLING THE ODDS API ======`);
    console.log(`[UnifiedFetcher] - sport: ${sport}`);
    console.log(`[UnifiedFetcher] - markets: ['h2h', 'spreads', 'totals']`);
    console.log(`[UnifiedFetcher] - regions: ['us']`);
    console.log(`[UnifiedFetcher] - oddsFormat: 'american'`);
    console.log(`[UnifiedFetcher] - skipCache: ${!useCache}`);
    console.log(`[UnifiedFetcher] - API URL will be: https://api.the-odds-api.com/v4/sports/${sport}/odds/?markets=h2h,spreads,totals`);
    console.log(`[UnifiedFetcher] ====================================`);
    
    const oddsData = await fetchLiveOdds(sport, {
      markets: ['h2h', 'spreads', 'totals'],
      regions: ['us'],
      oddsFormat: 'american',
      apiKey,
      skipCache: !useCache
    });

    console.log(`[UnifiedFetcher] ====== API RESPONSE RECEIVED ======`);
    console.log(`[UnifiedFetcher] Games returned: ${oddsData?.length || 0}`);
    console.log(`[UnifiedFetcher] Data type: ${typeof oddsData}`);
    console.log(`[UnifiedFetcher] Is array: ${Array.isArray(oddsData)}`);
    console.log(`[UnifiedFetcher] Is null: ${oddsData === null}`);
    console.log(`[UnifiedFetcher] Is undefined: ${oddsData === undefined}`);
    
    if (oddsData && oddsData.length > 0) {
      const sample = oddsData[0];
      console.log(`[UnifiedFetcher] Sample game: ${sample.away_team} @ ${sample.home_team}`);
      console.log(`[UnifiedFetcher] Sample bookmakers: ${sample.bookmakers?.length || 0}`);
      console.log(`[UnifiedFetcher] Sample start time: ${sample.commence_time}`);
    } else {
      console.warn(`[UnifiedFetcher] ⚠️ NO GAMES RETURNED FOR ${sport}`);
      console.warn(`[UnifiedFetcher] This could mean:`);
      console.warn(`[UnifiedFetcher] 1. No games scheduled/live for this sport`);
      console.warn(`[UnifiedFetcher] 2. Sport key "${sport}" is invalid`);
      console.warn(`[UnifiedFetcher] 3. API quota exceeded`);
      console.warn(`[UnifiedFetcher] 4. API returned an error (check earlier logs)`);
    }
    console.log(`[UnifiedFetcher] ===================================`);

    // Store in Supabase if enabled
    if (storeResults && oddsData.length > 0) {
      await Promise.all([
        supabaseOddsService.storeOdds(sport, sport, oddsData),
        supabaseOddsService.storeSportOdds(sport.split('_')[0], oddsData)
      ]);
      
      // Track line movement for sharp money detection
      try {
        const { monitorOddsChanges } = await import('@/lib/line-movement-tracker');
        await monitorOddsChanges(oddsData, sport);
        console.log(`[UnifiedFetcher] Line movement tracked for ${sport}`);
      } catch (error) {
        console.error('[UnifiedFetcher] Line tracking error:', error);
      }
    }

    return oddsData;
  } catch (error) {
    console.error('[UnifiedFetcher] Error fetching odds:', error);
    
    // Fallback to cache even if expired
    const cachedOdds = await supabaseOddsService.getCachedOdds(sport);
    if (cachedOdds && cachedOdds.length > 0) {
      console.log(`[UnifiedFetcher] Returning expired cache as fallback`);
      return cachedOdds;
    }
    
    return [];
  }
}

/**
 * Fetch opportunities across all sports
 */
export async function getAllOpportunities() {
  const [edges, arbs] = await Promise.all([
    supabaseOddsService.getEdgeOpportunities(),
    supabaseOddsService.getArbitrageOpportunities()
  ]);

  return {
    edges,
    arbitrage: arbs,
    total: edges.length + arbs.length
  };
}

/**
 * Get opportunities for specific sport
 */
export async function getSportOpportunities(sport: string) {
  const [edges, arbs] = await Promise.all([
    supabaseOddsService.getEdgeOpportunities(sport),
    supabaseOddsService.getArbitrageOpportunities(sport)
  ]);

  return {
    edges,
    arbitrage: arbs,
    total: edges.length + arbs.length
  };
}
