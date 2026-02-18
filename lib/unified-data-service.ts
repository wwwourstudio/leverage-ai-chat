/**
 * Unified Data Service
 * Combines data from Odds API and Kalshi API into a single cohesive response
 * Handles pagination, rate limits, error handling, and loading states
 */

import { fetchLiveOdds, ODDS_MARKETS, BETTING_REGIONS, getActiveSports } from '@/lib/odds-api-client';
import { 
  fetchKalshiMarkets, 
  fetchKalshiMarketsWithRetry,
  getKalshiCardsForSport,
  kalshiMarketToCard,
  type KalshiMarket 
} from '@/lib/kalshi-client';
import { LOG_PREFIXES } from '@/lib/constants';

export interface UnifiedDataOptions {
  sport?: string;
  category?: string;
  limit?: number;
  includeKalshi?: boolean;
  includeOdds?: boolean;
  oddsApiKey?: string;
  useCache?: boolean;
}

export interface UnifiedDataResult {
  success: boolean;
  oddsData: any[];
  kalshiData: KalshiMarket[];
  combinedCards: any[];
  dataSources: string[];
  errors: string[];
  metadata: {
    oddsCount: number;
    kalshiCount: number;
    totalCards: number;
    timestamp: string;
    sportsCovered: string[];
  };
}

/**
 * Fetch data from Odds API with comprehensive error handling and retries
 */
async function fetchOddsData(
  sports: string[],
  oddsApiKey: string,
  useCache: boolean = true
): Promise<{ data: Record<string, any[]>; errors: string[] }> {
  const oddsBySport: Record<string, any[]> = {};
  const errors: string[] = [];

  console.log(`${LOG_PREFIXES.API} [UnifiedService] Fetching odds for ${sports.length} sport(s)`);

  // Fetch all sports in parallel with individual error handling
  const results = await Promise.allSettled(
    sports.map(async (sport) => {
      try {
        console.log(`${LOG_PREFIXES.API} [UnifiedService] → Fetching ${sport} odds...`);
        
        const oddsData = await fetchLiveOdds(sport, {
          markets: [
            ODDS_MARKETS.H2H,
            ODDS_MARKETS.SPREADS,
            ODDS_MARKETS.TOTALS,
            ODDS_MARKETS.PLAYER_PROPS
          ],
          regions: [BETTING_REGIONS.US],
          apiKey: oddsApiKey,
          skipCache: !useCache
        });

        const gamesArray = Array.isArray(oddsData) ? oddsData : [];
        
        if (gamesArray.length > 0) {
          console.log(`${LOG_PREFIXES.API} [UnifiedService]   ✓ ${sport}: ${gamesArray.length} games`);
          return { sport, data: gamesArray };
        } else {
          console.log(`${LOG_PREFIXES.API} [UnifiedService]   ○ ${sport}: no games available`);
          return { sport, data: [] };
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`${LOG_PREFIXES.API} [UnifiedService]   ✗ ${sport}: ${errorMsg}`);
        errors.push(`${sport}: ${errorMsg}`);
        return { sport, data: [] };
      }
    })
  );

  // Process results
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.data.length > 0) {
      oddsBySport[result.value.sport] = result.value.data;
    }
  });

  console.log(`${LOG_PREFIXES.API} [UnifiedService] Odds fetch complete: ${Object.keys(oddsBySport).length}/${sports.length} sports returned data`);

  return { data: oddsBySport, errors };
}

/**
 * Fetch data from Kalshi API with comprehensive error handling and retries
 */
async function fetchKalshiData(
  sports: string[],
  limit: number = 10
): Promise<{ data: KalshiMarket[]; errors: string[] }> {
  const allMarkets: KalshiMarket[] = [];
  const errors: string[] = [];

  console.log(`${LOG_PREFIXES.API} [UnifiedService] Fetching Kalshi markets for ${sports.length} sport(s)`);

  // Map sport keys to Kalshi categories
  const sportCategoryMap: Record<string, string> = {
    'americanfootball_nfl': 'NFL',
    'basketball_nba': 'NBA',
    'baseball_mlb': 'MLB',
    'icehockey_nhl': 'NHL',
    'nfl': 'NFL',
    'nba': 'NBA',
    'mlb': 'MLB',
    'nhl': 'NHL',
  };

  const categories = sports
    .map(sport => sportCategoryMap[sport.toLowerCase()])
    .filter(Boolean);

  if (categories.length === 0) {
    console.log(`${LOG_PREFIXES.API} [UnifiedService] No Kalshi categories for given sports`);
    return { data: [], errors: [] };
  }

  // Fetch markets for each category with retry logic
  const results = await Promise.allSettled(
    categories.map(async (category) => {
      try {
        console.log(`${LOG_PREFIXES.API} [UnifiedService] → Fetching Kalshi ${category}...`);
        
        const markets = await fetchKalshiMarketsWithRetry({
          category,
          limit: Math.ceil(limit / categories.length),
          maxRetries: 3
        });

        if (markets.length > 0) {
          console.log(`${LOG_PREFIXES.API} [UnifiedService]   ✓ Kalshi ${category}: ${markets.length} markets`);
          return { category, markets };
        } else {
          console.log(`${LOG_PREFIXES.API} [UnifiedService]   ○ Kalshi ${category}: no markets`);
          return { category, markets: [] };
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`${LOG_PREFIXES.API} [UnifiedService]   ✗ Kalshi ${category}: ${errorMsg}`);
        errors.push(`Kalshi ${category}: ${errorMsg}`);
        return { category, markets: [] };
      }
    })
  );

  // Combine all markets
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.markets.length > 0) {
      allMarkets.push(...result.value.markets);
    }
  });

  // Remove duplicates based on ticker
  const uniqueMarkets = allMarkets.filter((market, index, self) => 
    index === self.findIndex(m => m.ticker === market.ticker)
  );

  console.log(`${LOG_PREFIXES.API} [UnifiedService] Kalshi fetch complete: ${uniqueMarkets.length} unique markets (${allMarkets.length - uniqueMarkets.length} duplicates removed)`);

  return { data: uniqueMarkets, errors };
}

/**
 * Main unified data fetcher
 * Combines Odds API and Kalshi data with intelligent merging
 */
export async function fetchUnifiedData(
  options: UnifiedDataOptions
): Promise<UnifiedDataResult> {
  const {
    sport,
    category,
    limit = 6,
    includeKalshi = true,
    includeOdds = true,
    oddsApiKey,
    useCache = true
  } = options;

  const errors: string[] = [];
  const dataSources: string[] = [];
  let oddsData: Record<string, any[]> = {};
  let kalshiData: KalshiMarket[] = [];

  console.log(`${LOG_PREFIXES.API} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${LOG_PREFIXES.API} [UnifiedService] Fetching unified data`);
  console.log(`${LOG_PREFIXES.API} Options:`, { sport, category, limit, includeKalshi, includeOdds, useCache });

  // Determine which sports to fetch
  const sportsToFetch = sport 
    ? [sport, 'basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb']
        .filter((s, i, arr) => arr.indexOf(s) === i)
        .slice(0, 3)
    : ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb'];

  console.log(`${LOG_PREFIXES.API} [UnifiedService] Sports to fetch: ${sportsToFetch.join(', ')}`);

  // Fetch data from both sources in parallel
  const [oddsResult, kalshiResult] = await Promise.allSettled([
    includeOdds && oddsApiKey 
      ? fetchOddsData(sportsToFetch, oddsApiKey, useCache)
      : Promise.resolve({ data: {}, errors: [] }),
    includeKalshi 
      ? fetchKalshiData(sportsToFetch, limit)
      : Promise.resolve({ data: [], errors: [] })
  ]);

  // Process Odds API results
  if (oddsResult.status === 'fulfilled') {
    oddsData = oddsResult.value.data;
    errors.push(...oddsResult.value.errors);
    
    if (Object.keys(oddsData).length > 0) {
      dataSources.push('The Odds API (real-time odds from 15+ sportsbooks)');
    }
  } else {
    console.error(`${LOG_PREFIXES.API} [UnifiedService] Odds API failed:`, oddsResult.reason);
    errors.push(`Odds API: ${oddsResult.reason}`);
  }

  // Process Kalshi results
  if (kalshiResult.status === 'fulfilled') {
    kalshiData = kalshiResult.value.data;
    errors.push(...kalshiResult.value.errors);
    
    if (kalshiData.length > 0) {
      dataSources.push('Kalshi Prediction Markets (real-time)');
    }
  } else {
    console.error(`${LOG_PREFIXES.API} [UnifiedService] Kalshi API failed:`, kalshiResult.reason);
    errors.push(`Kalshi API: ${kalshiResult.reason}`);
  }

  // Combine data into unified card format
  const combinedCards = combineIntoCards(oddsData, kalshiData, limit);

  // Calculate metadata
  const oddsGamesCount = Object.values(oddsData).reduce((sum, games) => sum + games.length, 0);
  const sportsCovered = [
    ...Object.keys(oddsData),
    ...new Set(kalshiData.map(m => m.category))
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const result: UnifiedDataResult = {
    success: combinedCards.length > 0 || errors.length === 0,
    oddsData: Object.values(oddsData).flat(),
    kalshiData,
    combinedCards,
    dataSources,
    errors,
    metadata: {
      oddsCount: oddsGamesCount,
      kalshiCount: kalshiData.length,
      totalCards: combinedCards.length,
      timestamp: new Date().toISOString(),
      sportsCovered
    }
  };

  console.log(`${LOG_PREFIXES.API} [UnifiedService] ✓ Unified data fetch complete`);
  console.log(`${LOG_PREFIXES.API}   - Odds games: ${result.metadata.oddsCount}`);
  console.log(`${LOG_PREFIXES.API}   - Kalshi markets: ${result.metadata.kalshiCount}`);
  console.log(`${LOG_PREFIXES.API}   - Combined cards: ${result.metadata.totalCards}`);
  console.log(`${LOG_PREFIXES.API}   - Sports covered: ${result.metadata.sportsCovered.join(', ')}`);
  console.log(`${LOG_PREFIXES.API}   - Errors: ${result.errors.length}`);
  console.log(`${LOG_PREFIXES.API} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return result;
}

/**
 * Combine odds and Kalshi data into unified card format
 * Intelligently distributes cards to show variety from both sources
 */
function combineIntoCards(
  oddsBySport: Record<string, any[]>,
  kalshiMarkets: KalshiMarket[],
  limit: number
): any[] {
  const cards: any[] = [];
  
  // Convert Kalshi markets to cards
  const kalshiCards = kalshiMarkets
    .slice(0, Math.ceil(limit / 2)) // Reserve half the cards for Kalshi
    .map(kalshiMarketToCard);
  
  // Import card creation function for odds
  // For now, create simple cards from odds data
  const oddsCards: any[] = [];
  const oddsEntries = Object.entries(oddsBySport);
  
  if (oddsEntries.length > 0) {
    const cardsPerSport = Math.ceil(limit / (2 * oddsEntries.length));
    
    oddsEntries.forEach(([sport, games]) => {
      games.slice(0, cardsPerSport).forEach((game: any) => {
        // Create basic card from game data
        const bestBook = game.bookmakers?.[0];
        const h2hMarket = bestBook?.markets?.find((m: any) => m.key === 'h2h');
        
        if (h2hMarket && h2hMarket.outcomes) {
          oddsCards.push({
            type: 'live-odds',
            title: `${game.away_team} @ ${game.home_team}`,
            icon: 'TrendingUp',
            category: sport.toUpperCase(),
            subcategory: 'Moneyline',
            gradient: 'from-blue-500 to-indigo-600',
            data: {
              matchup: `${game.away_team} @ ${game.home_team}`,
              gameTime: new Date(game.commence_time).toLocaleString(),
              odds: h2hMarket.outcomes.map((o: any) => 
                `${o.name}: ${o.price > 0 ? '+' : ''}${o.price}`
              ).join(', '),
              bookmaker: bestBook.title,
            },
            status: 'active',
            realData: true
          });
        }
      });
    });
  }
  
  // Interleave odds and Kalshi cards for variety
  const maxOddsCards = Math.ceil(limit / 2);
  const maxKalshiCards = limit - maxOddsCards;
  
  cards.push(...oddsCards.slice(0, maxOddsCards));
  cards.push(...kalshiCards.slice(0, maxKalshiCards));
  
  // Shuffle for variety
  return cards
    .sort(() => Math.random() - 0.5)
    .slice(0, limit);
}

/**
 * Fetch comprehensive data for a specific sport
 * Includes both odds and prediction markets
 */
export async function fetchSportData(
  sport: string,
  oddsApiKey?: string
): Promise<UnifiedDataResult> {
  return fetchUnifiedData({
    sport,
    limit: 10,
    includeKalshi: true,
    includeOdds: true,
    oddsApiKey,
    useCache: true
  });
}

/**
 * Fetch comprehensive category data (e.g., "arbitrage", "value", "trending")
 */
export async function fetchCategoryData(
  category: string,
  oddsApiKey?: string
): Promise<UnifiedDataResult> {
  return fetchUnifiedData({
    category,
    limit: 10,
    includeKalshi: true,
    includeOdds: true,
    oddsApiKey,
    useCache: true
  });
}
