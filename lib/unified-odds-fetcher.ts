import { fetchLiveOdds } from '@/lib/odds-api-client';
import { supabaseOddsService } from '@/lib/supabase-odds-service';

/**
 * Fetch recent completed games with scores from The Odds API /scores endpoint
 * This always returns data even during offseason or off-days
 */
async function fetchRecentScores(sport: string, apiKey: string, daysFrom: number = 3): Promise<any[]> {
  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/scores/?apiKey=${apiKey}&daysFrom=${daysFrom}`;
    console.log(`[UnifiedFetcher] Fetching recent scores for ${sport} (last ${daysFrom} days)`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      console.error(`[UnifiedFetcher] Scores endpoint error: ${response.status}`);
      return [];
    }
    
    const games = await response.json();
    console.log(`[UnifiedFetcher] Scores endpoint returned ${games?.length || 0} games`);
    return Array.isArray(games) ? games : [];
  } catch (error) {
    console.error('[UnifiedFetcher] Failed to fetch scores:', error);
    return [];
  }
}

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
    console.log(`[UnifiedFetcher] Fetching ${sport} with markets: h2h,spreads,totals`);
    
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
      // CRITICAL FALLBACK: No upcoming games found, fetch RECENT SCORES instead
      console.log(`[UnifiedFetcher] No upcoming games for ${sport} - fetching recent scores as fallback`);
      
      const recentGames = await fetchRecentScores(sport, apiKey, 7);
      
      if (recentGames.length > 0) {
        console.log(`[UnifiedFetcher] Found ${recentGames.length} recent games from scores endpoint`);
        
        // Now fetch odds for these games if they have upcoming entries
        // The scores endpoint returns both completed and upcoming games
        const upcomingFromScores = recentGames.filter((g: any) => !g.completed);
        const completedGames = recentGames.filter((g: any) => g.completed);
        
        console.log(`[UnifiedFetcher] ${upcomingFromScores.length} upcoming, ${completedGames.length} completed`);
        
        // Return whatever we have - upcoming first, then completed
        const allGames = [...upcomingFromScores, ...completedGames];
        
        // Store in Supabase
        if (storeResults && allGames.length > 0) {
          try {
            await supabaseOddsService.storeOdds(sport, sport, allGames);
          } catch (e) {
            console.error('[UnifiedFetcher] Failed to store scores:', e);
          }
        }
        
        return allGames;
      }
      
      console.warn(`[UnifiedFetcher] No games found from either odds or scores endpoint for ${sport}`);
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
