/**
 * Unified Kalshi Service
 * Integrates Kalshi API with Supabase for caching and real-time updates
 */

import { createClient } from '@/lib/supabase/client';
import { fetchKalshiMarkets, getMarketByTicker, type KalshiMarket } from './kalshi-client';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface KalshiServiceOptions {
  useCache?: boolean;
  storeResults?: boolean;
  category?: string;
  limit?: number;
}

/**
 * Get Kalshi markets with Supabase caching
 */
export async function getKalshiMarketsWithCache(options: KalshiServiceOptions = {}): Promise<KalshiMarket[]> {
  const { useCache = true, storeResults = true, category, limit = 20 } = options;
  
  console.log('[v0] [UNIFIED-KALSHI] Fetching markets with options:', { useCache, storeResults, category, limit });
  
  const supabase = createClient();
  
  // Try cache first if enabled
  if (useCache) {
    try {
      const cacheKey = category || 'all';
      const { data: cached, error } = await supabase
        .from('kalshi_markets')
        .select('*')
        .eq('category', cacheKey)
        .gte('fetched_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
        .order('fetched_at', { ascending: false })
        .limit(limit);
      
      if (!error && cached && cached.length > 0) {
        console.log(`[v0] [UNIFIED-KALSHI] Cache hit: ${cached.length} markets from Supabase`);
        return cached.map((row: any) => ({
          ticker: row.ticker,
          title: row.title,
          category: row.category,
          subtitle: row.subtitle || '',
          yesPrice: row.yes_price,
          noPrice: row.no_price,
          volume: row.volume,
          openInterest: row.open_interest,
          closeTime: row.close_time,
          status: row.status,
        }));
      }
    } catch (error) {
      console.error('[v0] [UNIFIED-KALSHI] Cache read error:', error);
    }
  }
  
  // Fetch from Kalshi API
  console.log('[v0] [UNIFIED-KALSHI] Cache miss, fetching from Kalshi API');
  const markets = await fetchKalshiMarkets({ category, limit });
  
  // Store in Supabase if enabled
  if (storeResults && markets.length > 0) {
    try {
      const rows = markets.map(market => ({
        ticker: market.ticker,
        title: market.title,
        category: category || 'all',
        subtitle: market.subtitle,
        yes_price: market.yesPrice,
        no_price: market.noPrice,
        volume: market.volume,
        open_interest: market.openInterest,
        close_time: market.closeTime,
        status: market.status,
        fetched_at: new Date().toISOString(),
      }));
      
      const { error } = await supabase
        .from('kalshi_markets')
        .upsert(rows, { onConflict: 'ticker' });
      
      if (error) {
        console.error('[v0] [UNIFIED-KALSHI] Failed to store in Supabase:', error);
      } else {
        console.log(`[v0] [UNIFIED-KALSHI] Stored ${rows.length} markets in Supabase`);
      }
    } catch (error) {
      console.error('[v0] [UNIFIED-KALSHI] Storage error:', error);
    }
  }
  
  return markets;
}

/**
 * Get specific market with caching
 */
export async function getKalshiMarketWithCache(ticker: string): Promise<KalshiMarket | null> {
  console.log(`[v0] [UNIFIED-KALSHI] Fetching market: ${ticker}`);
  
  const supabase = createClient();
  
  // Try cache first
  try {
    const { data: cached, error } = await supabase
      .from('kalshi_markets')
      .select('*')
      .eq('ticker', ticker)
      .gte('fetched_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .single();
    
    if (!error && cached) {
      console.log(`[v0] [UNIFIED-KALSHI] Cache hit for ${ticker}`);
      return {
        ticker: cached.ticker,
        title: cached.title,
        category: cached.category,
        subtitle: cached.subtitle || '',
        yesPrice: cached.yes_price,
        noPrice: cached.no_price,
        volume: cached.volume,
        openInterest: cached.open_interest,
        closeTime: cached.close_time,
        status: cached.status,
      };
    }
  } catch (error) {
    console.error(`[v0] [UNIFIED-KALSHI] Cache read error for ${ticker}:`, error);
  }
  
  // Fetch from API
  const market = await getMarketByTicker(ticker);
  
  // Store in cache
  if (market) {
    try {
      await supabase.from('kalshi_markets').upsert({
        ticker: market.ticker,
        title: market.title,
        category: market.category,
        subtitle: market.subtitle,
        yes_price: market.yesPrice,
        no_price: market.noPrice,
        volume: market.volume,
        open_interest: market.openInterest,
        close_time: market.closeTime,
        status: market.status,
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'ticker' });
      
      console.log(`[v0] [UNIFIED-KALSHI] Stored ${ticker} in Supabase`);
    } catch (error) {
      console.error(`[v0] [UNIFIED-KALSHI] Failed to store ${ticker}:`, error);
    }
  }
  
  return market;
}

/**
 * Get sports-related Kalshi markets with caching
 */
export async function getSportsKalshiMarkets(sport?: string): Promise<KalshiMarket[]> {
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
  
  if (sport) {
    const category = sportCategoryMap[sport.toLowerCase()];
    if (!category) {
      console.log(`[v0] [UNIFIED-KALSHI] No category for sport: ${sport}`);
      return [];
    }
    return getKalshiMarketsWithCache({ category, limit: 10 });
  }
  
  // Fetch all sports categories
  const categories = ['NFL', 'NBA', 'MLB', 'NHL'];
  const allMarkets: KalshiMarket[] = [];
  
  for (const category of categories) {
    const markets = await getKalshiMarketsWithCache({ category, limit: 5 });
    allMarkets.push(...markets);
  }
  
  return allMarkets;
}

/**
 * Subscribe to Kalshi market updates via Supabase Realtime
 */
export function subscribeToKalshiMarkets(
  callback: (market: KalshiMarket) => void,
  filter?: { category?: string; ticker?: string }
) {
  const supabase = createClient();
  
  let query = supabase
    .channel('kalshi-markets')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'kalshi_markets' },
      (payload: any) => {
        const row = payload.new as Record<string, any>;
        if (!row) return;
        
        // Apply filters
        if (filter?.category && row.category !== filter.category) return;
        if (filter?.ticker && row.ticker !== filter.ticker) return;
        
        const market: KalshiMarket = {
          ticker: row.ticker,
          title: row.title,
          category: row.category,
          subtitle: row.subtitle || '',
          yesPrice: row.yes_price,
          noPrice: row.no_price,
          volume: row.volume,
          openInterest: row.open_interest,
          closeTime: row.close_time,
          status: row.status,
        };
        
        callback(market);
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(query);
  };
}
