/**
 * Kalshi API Client
 * Integration with Kalshi prediction markets for real market data
 * 
 * API Documentation: https://trading-api.readme.io/reference/introduction
 */

export interface KalshiMarket {
  ticker: string;
  title: string;
  category: string;
  subtitle: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  openInterest: number;
  closeTime: string;
  status: 'open' | 'closed' | 'settled';
}

export interface KalshiSeries {
  ticker: string;
  title: string;
  category: string;
  markets: KalshiMarket[];
}

/**
 * Fetch active markets from Kalshi
 * 
 * Important: For election markets (2026 H2H, etc.), use category mappings:
 * - 'election' → searches for election-related markets
 * - 'politics' → searches political markets
 * - '2026' → searches 2026 election markets
 * 
 * For sports markets, use standard abbreviations:
 * - 'NFL', 'NBA', 'MLB', 'NHL'
 */
export async function fetchKalshiMarkets(params?: {
  category?: string;
  status?: 'open' | 'closed';
  limit?: number;
  search?: string;
}): Promise<KalshiMarket[]> {
  const { category, status = 'open', limit = 20, search } = params || {};
  
  try {
    const baseUrl = 'https://trading-api.kalshi.com/trade-api/v2';
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      status,
    });
    
    // Map common keywords to Kalshi categories
    const categoryMap: Record<string, string> = {
      'election': 'Elections',
      'elections': 'Elections',
      'politics': 'Politics',
      'political': 'Politics',
      '2026': 'Elections',
      'president': 'Elections',
      'presidential': 'Elections',
    };
    
    // Try to map category to Kalshi's category system
    let finalCategory = category;
    if (category && categoryMap[category.toLowerCase()]) {
      finalCategory = categoryMap[category.toLowerCase()];
    }
    
    if (finalCategory) {
      queryParams.append('series_ticker', finalCategory);
    }
    
    // Add search query if provided
    if (search) {
      queryParams.append('title', search);
    }
    
    const url = `${baseUrl}/markets?${queryParams}`;
    
    console.log('[v0] [KALSHI] Fetching markets:', url);
    console.log('[v0] [KALSHI] Parameters:', { category: finalCategory, status, limit, search });
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[v0] [KALSHI] API Error Response:', errorText.substring(0, 500));
      throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Check if we got valid data
    if (!data.markets || !Array.isArray(data.markets)) {
      console.warn('[v0] [KALSHI] Unexpected response format:', JSON.stringify(data).substring(0, 200));
      return [];
    }
    
    const markets: KalshiMarket[] = data.markets.map((m: any) => ({
      ticker: m.ticker,
      title: m.title,
      category: m.category,
      subtitle: m.subtitle || '',
      yesPrice: m.yes_bid || m.last_price || 0,
      noPrice: m.no_bid || (100 - (m.last_price || 0)) || 0,
      volume: m.volume || 0,
      openInterest: m.open_interest || 0,
      closeTime: m.close_time,
      status: m.status,
    }));
    
    console.log(`[v0] [KALSHI] ✓ Fetched ${markets.length} markets`);
    
    // If looking for election markets specifically, filter results
    if (category && ['election', 'elections', '2026', 'politics'].includes(category.toLowerCase())) {
      const electionKeywords = ['election', '2026', 'president', 'harris', 'trump', 'h2h'];
      const filteredMarkets = markets.filter(m => 
        electionKeywords.some(kw => 
          m.title.toLowerCase().includes(kw) || 
          m.category.toLowerCase().includes(kw)
        )
      );
      
      if (filteredMarkets.length > 0) {
        console.log(`[v0] [KALSHI] Found ${filteredMarkets.length} election-related markets`);
        return filteredMarkets;
      } else {
        console.warn('[v0] [KALSHI] No election markets found with current filters');
      }
    }
    
    return markets;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[v0] [KALSHI] Request timeout - API may be slow or unavailable');
    } else {
      console.error('[v0] [KALSHI] Failed to fetch markets:', error);
    }
    return [];
  }
}

/**
 * Fetch sports-related markets from Kalshi
 */
export async function fetchSportsMarkets(): Promise<KalshiMarket[]> {
  try {
    // Fetch markets from various sports categories
    const categories = ['NFL', 'NBA', 'MLB', 'NHL'];
    const allMarkets: KalshiMarket[] = [];
    
    for (const category of categories) {
      const markets = await fetchKalshiMarkets({ category, limit: 10 });
      allMarkets.push(...markets);
    }
    
    return allMarkets;
  } catch (error) {
    console.error('[v0] [KALSHI] Failed to fetch sports markets:', error);
    return [];
  }
}

/**
 * Fetch election-related markets from Kalshi
 * Specifically for 2026 H2H contracts and presidential markets
 */
export async function fetchElectionMarkets(options?: {
  year?: number;
  includeH2H?: boolean;
  limit?: number;
}): Promise<KalshiMarket[]> {
  const { year = 2026, includeH2H = true, limit = 20 } = options || {};
  
  console.log('[v0] [KALSHI] Fetching election markets for year:', year);
  
  try {
    // Try multiple search strategies to find election markets
    const searchStrategies = [
      { category: 'election', search: `${year}` },
      { category: 'politics' },
      { search: `president ${year}` },
      { search: 'h2h' },
    ];
    
    const allMarkets: KalshiMarket[] = [];
    
    for (const strategy of searchStrategies) {
      const markets = await fetchKalshiMarkets({ ...strategy, limit: 50 });
      
      // Filter for unique markets
      markets.forEach(market => {
        if (!allMarkets.some(m => m.ticker === market.ticker)) {
          allMarkets.push(market);
        }
      });
      
      if (allMarkets.length >= limit) {
        break;
      }
    }
    
    // Filter specifically for election/presidential markets
    const electionMarkets = allMarkets.filter(market => {
      const text = `${market.title} ${market.category} ${market.subtitle}`.toLowerCase();
      const isElection = text.includes('election') || 
                        text.includes('president') || 
                        text.includes('harris') || 
                        text.includes('trump');
      const isCorrectYear = text.includes(year.toString());
      const isH2H = includeH2H ? text.includes('h2h') || text.includes('vs') : true;
      
      return isElection && (isCorrectYear || includeH2H && isH2H);
    });
    
    console.log(`[v0] [KALSHI] Found ${electionMarkets.length} election markets for ${year}`);
    
    if (electionMarkets.length === 0) {
      console.warn('[v0] [KALSHI] No 2026 election markets found. Possible reasons:');
      console.warn('  1. Markets not yet created for 2026');
      console.warn('  2. Different ticker/category naming');
      console.warn('  3. API access restrictions');
      console.warn('  Recommendation: Check https://kalshi.com directly for available markets');
    }
    
    return electionMarkets.slice(0, limit);
  } catch (error) {
    console.error('[v0] [KALSHI] Failed to fetch election markets:', error);
    return [];
  }
}

/**
 * Get market by ticker
 */
export async function getMarketByTicker(ticker: string): Promise<KalshiMarket | null> {
  try {
    const baseUrl = 'https://trading-api.kalshi.com/trade-api/v2';
    const url = `${baseUrl}/markets/${ticker}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Kalshi API error: ${response.status}`);
    }
    
    const data = await response.json();
    const m = data.market;
    
    return {
      ticker: m.ticker,
      title: m.title,
      category: m.category,
      subtitle: m.subtitle || '',
      yesPrice: m.yes_bid || 0,
      noPrice: m.no_bid || 0,
      volume: m.volume || 0,
      openInterest: m.open_interest || 0,
      closeTime: m.close_time,
      status: m.status,
    };
  } catch (error) {
    console.error(`[v0] [KALSHI] Failed to fetch market ${ticker}:`, error);
    return null;
  }
}

/**
 * Convert Kalshi market to insight card format
 */
export function kalshiMarketToCard(market: KalshiMarket): any {
  const impliedProbability = market.yesPrice / 100;
  const edge = impliedProbability > 0.5 ? '+' : '';
  
  return {
    type: 'kalshi-market',
    title: market.title,
    icon: 'TrendingUp',
    category: 'KALSHI',
    subcategory: market.category,
    gradient: 'from-purple-600 to-pink-700',
    data: {
      ticker: market.ticker,
      subtitle: market.subtitle,
      yesPrice: `${market.yesPrice}¢`,
      noPrice: `${market.noPrice}¢`,
      impliedProbability: `${(impliedProbability * 100).toFixed(1)}%`,
      volume: market.volume.toLocaleString(),
      openInterest: market.openInterest.toLocaleString(),
      closeTime: new Date(market.closeTime).toLocaleDateString(),
      recommendation: impliedProbability > 0.7 
        ? 'Strong YES position' 
        : impliedProbability < 0.3 
        ? 'Strong NO position'
        : 'Market appears efficient',
    },
    status: market.status === 'open' ? 'active' : 'closed',
    realData: true,
  };
}

/**
 * Fetch Kalshi cards for a specific sport
 */
export async function getKalshiCardsForSport(sport: string, limit: number = 3): Promise<any[]> {
  const sportCategoryMap: Record<string, string> = {
    nfl: 'NFL',
    nba: 'NBA',
    mlb: 'MLB',
    nhl: 'NHL',
    americanfootball_nfl: 'NFL',
    basketball_nba: 'NBA',
    baseball_mlb: 'MLB',
    icehockey_nhl: 'NHL',
  };
  
  const category = sportCategoryMap[sport.toLowerCase()];
  
  if (!category) {
    console.log(`[v0] [KALSHI] No category mapping for sport: ${sport}`);
    return [];
  }
  
  const markets = await fetchKalshiMarkets({ category, limit });
  return markets.map(kalshiMarketToCard);
}
