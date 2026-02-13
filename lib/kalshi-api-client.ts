/**
 * Kalshi Prediction Markets API Client
 * 
 * Fetches real-time prediction market data from Kalshi API
 * Supports: Event markets, probability data, volume, liquidity
 * 
 * API Documentation: https://trading-api.readme.io/reference/getting-started
 */

const KALSHI_API_BASE_URL = 'https://trading-api.kalshi.com/trade-api/v2';
const KALSHI_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle: string;
  yes_price: number;
  no_price: number;
  volume: number;
  open_interest: number;
  close_time: string;
  category: string;
  tags: string[];
}

interface KalshiMarketResponse {
  markets: KalshiMarket[];
  cursor?: string;
}

// In-memory cache for Kalshi data
const kalshiCache = new Map<string, { data: any; timestamp: number }>();

/**
 * Fetch active Kalshi markets by category
 * @param category - Market category (e.g., 'sports', 'politics', 'weather')
 * @param limit - Number of markets to fetch (default: 10)
 * @returns Array of active markets with probability and volume data
 */
export async function fetchKalshiMarkets(
  category: string = 'sports',
  limit: number = 10
): Promise<KalshiMarket[]> {
  console.log('[v0] [KALSHI API] Fetching markets for category:', category);

  // Check cache first
  const cacheKey = `${category}-${limit}`;
  const cached = kalshiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < KALSHI_CACHE_DURATION) {
    console.log('[v0] [KALSHI API] Returning cached data');
    return cached.data;
  }

  try {
    // Kalshi API requires authentication for most endpoints
    // For now, we'll use the public markets endpoint which doesn't require auth
    const url = new URL(`${KALSHI_API_BASE_URL}/events`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('status', 'open');
    
    // Add category filter if available
    if (category && category !== 'all') {
      url.searchParams.set('series_ticker', category.toUpperCase());
    }

    console.log('[v0] [KALSHI API] Request URL:', url.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(8000),
    });

    console.log('[v0] [KALSHI API] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[v0] [KALSHI API] Error response:', errorText.substring(0, 200));
      throw new Error(`Kalshi API returned ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const data: KalshiMarketResponse = await response.json();
    console.log('[v0] [KALSHI API] Fetched', data.markets?.length || 0, 'markets');

    // Transform and enrich market data
    const markets = data.markets || [];
    
    // Cache the results
    kalshiCache.set(cacheKey, {
      data: markets,
      timestamp: Date.now(),
    });

    return markets;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('[v0] [KALSHI API] Request timeout after 8 seconds');
        throw new Error('Kalshi API request timeout - service may be unavailable');
      }
      console.error('[v0] [KALSHI API] Error:', error.message);
      throw new Error(`Kalshi API error: ${error.message}`);
    }
    console.error('[v0] [KALSHI API] Unknown error:', error);
    throw new Error('Unknown error fetching Kalshi markets');
  }
}

/**
 * Generate Kalshi market cards for display
 * @param markets - Array of Kalshi markets
 * @returns Array of formatted cards for UI display
 */
export function generateKalshiCards(markets: KalshiMarket[]): any[] {
  console.log('[v0] [KALSHI API] Generating cards for', markets.length, 'markets');

  return markets.slice(0, 3).map((market, index) => {
    // Calculate implied probability (Kalshi uses cents, so divide by 100)
    const yesProb = market.yes_price / 100;
    const noProb = market.no_price / 100;
    
    // Determine market confidence based on price distance from 50%
    const confidence = Math.abs(yesProb - 0.5) * 2; // 0-1 scale
    const status = confidence > 0.3 ? 'edge' : confidence > 0.15 ? 'opportunity' : 'neutral';

    return {
      type: 'kalshi-market',
      title: `${market.title}`,
      icon: 'TrendingUp',
      category: 'KALSHI',
      subcategory: market.category || 'Prediction Market',
      gradient: 'from-purple-600 to-indigo-700',
      status,
      data: {
        ticker: market.ticker,
        subtitle: market.subtitle || '',
        yesPrice: `${(yesProb * 100).toFixed(1)}¢`,
        noPrice: `${(noProb * 100).toFixed(1)}¢`,
        yesProbability: `${(yesProb * 100).toFixed(1)}%`,
        noProbability: `${(noProb * 100).toFixed(1)}%`,
        volume: `$${(market.volume / 100).toLocaleString()}`,
        openInterest: `$${(market.open_interest / 100).toLocaleString()}`,
        closingTime: new Date(market.close_time).toLocaleDateString(),
        marketType: 'Binary Outcome',
        tags: market.tags?.join(', ') || '',
      },
      metadata: {
        source: 'Kalshi API',
        fetchedAt: new Date().toISOString(),
        marketIndex: index + 1,
      }
    };
  });
}

/**
 * Enrich cards with Kalshi market data
 * Used by cards-generator to add Kalshi markets when detected
 */
export async function enrichCardsWithKalshi(
  cards: any[],
  category: string = 'sports'
): Promise<any[]> {
  console.log('[v0] [KALSHI API] Enriching cards with Kalshi markets');

  try {
    const markets = await fetchKalshiMarkets(category, 5);
    
    if (markets.length === 0) {
      console.log('[v0] [KALSHI API] No markets found for category:', category);
      return cards;
    }

    const kalshiCards = generateKalshiCards(markets);
    console.log('[v0] [KALSHI API] Generated', kalshiCards.length, 'Kalshi cards');

    // Add Kalshi cards to the beginning of the array
    return [...kalshiCards, ...cards];
  } catch (error) {
    console.error('[v0] [KALSHI API] Failed to enrich with Kalshi data:', error);
    // Return original cards on error
    return cards;
  }
}

/**
 * Validate Kalshi API connectivity
 * Useful for health checks and debugging
 */
export async function testKalshiConnection(): Promise<boolean> {
  try {
    const markets = await fetchKalshiMarkets('all', 1);
    return markets.length > 0;
  } catch (error) {
    console.error('[v0] [KALSHI API] Connection test failed:', error);
    return false;
  }
}
