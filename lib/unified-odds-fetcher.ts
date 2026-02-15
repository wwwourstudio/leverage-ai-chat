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
  
  console.log(`[UnifiedFetcher] API Key present: ${!!apiKey}`);
  console.log(`[UnifiedFetcher] API Key length: ${apiKey?.length || 0}`);
  
  if (!apiKey) {
    console.error('[UnifiedFetcher] ❌ CRITICAL: No API key available!');
    console.error('[UnifiedFetcher] Check ODDS_API_KEY or NEXT_PUBLIC_ODDS_API_KEY env vars');
    return [];
  }

  try {
    console.log(`[UnifiedFetcher] Calling fetchLiveOdds with:`);
    console.log(`[UnifiedFetcher] - sport: ${sport}`);
    console.log(`[UnifiedFetcher] - markets: h2h, spreads, totals`);
    console.log(`[UnifiedFetcher] - regions: us`);
    console.log(`[UnifiedFetcher] - skipCache: ${!useCache}`);
    
    const oddsData = await fetchLiveOdds(sport, {
      markets: ['h2h', 'spreads', 'totals'],
      regions: ['us'],
      oddsFormat: 'american',
      apiKey,
      skipCache: !useCache
    });

    console.log(`[UnifiedFetcher] ✓ Received ${oddsData?.length || 0} games from API`);
    console.log(`[UnifiedFetcher] Data type: ${typeof oddsData}`);
    console.log(`[UnifiedFetcher] Is array: ${Array.isArray(oddsData)}`);

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
