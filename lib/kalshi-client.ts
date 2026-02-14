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
 */
export async function fetchKalshiMarkets(params?: {
  category?: string;
  status?: 'open' | 'closed';
  limit?: number;
}): Promise<KalshiMarket[]> {
  const { category, status = 'open', limit = 20 } = params || {};
  
  try {
    const baseUrl = 'https://trading-api.kalshi.com/trade-api/v2';
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      status,
    });
    
    if (category) {
      queryParams.append('series_ticker', category);
    }
    
    const url = `${baseUrl}/markets?${queryParams}`;
    
    console.log('[v0] [KALSHI] Fetching markets:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const markets: KalshiMarket[] = (data.markets || []).map((m: any) => ({
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
    }));
    
    console.log(`[v0] [KALSHI] ✓ Fetched ${markets.length} markets`);
    
    return markets;
  } catch (error) {
    console.error('[v0] [KALSHI] Failed to fetch markets:', error);
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
