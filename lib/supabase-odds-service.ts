import { createClient } from '@/lib/supabase/client';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Unified Supabase Odds Service
 * Handles all odds data fetching, caching, and storage
 */
export class SupabaseOddsService {
  private supabase = createClient();

  /**
   * Fetch cached odds for a sport
   */
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

  /**
   * Store odds in cache
   */
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

  /**
   * Store odds in sport-specific table
   */
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

  /**
   * Fetch edge opportunities
   */
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

  /**
   * Store edge opportunity
   */
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

  /**
   * Fetch arbitrage opportunities
   */
  async getArbitrageOpportunities(sport?: string) {
    let query = this.supabase
      .from('arbitrage_opportunities')
      .select('*')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('profit_margin', { ascending: false });

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

  /**
   * Store arbitrage opportunity
   */
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

  /**
   * Get active capital state
   */
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

  /**
   * Store bet allocation
   */
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

  /**
   * Track AI response trust
   */
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

// Export singleton instance
export const supabaseOddsService = new SupabaseOddsService();
