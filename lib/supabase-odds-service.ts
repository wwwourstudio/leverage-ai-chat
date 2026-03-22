
/**
 * Safely get Supabase client. Uses createBrowserClient on client,
 * and a direct @supabase/supabase-js client on server to avoid
 * dependency on cookies()/headers().
 * Returns null when env vars are missing.
 */
function getSupabase() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    if (typeof window !== 'undefined') {
      // Browser: use the singleton browser client
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require('@/lib/supabase/client');
      return createClient();
    }

    // Server: create a lightweight client without cookies dependency.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@supabase/supabase-js');
    return createClient(url, key, { db: { schema: 'api' } });
  } catch (err) {
    console.error('[SupabaseOddsService] Failed to create Supabase client:', err);
    return null;
  }
}

/**
 * Unified Supabase Odds Service
 * Handles all odds data fetching, caching, and storage
 */
export class SupabaseOddsService {
  private get supabase() {
    return getSupabase();
  }

  /**
   * Fetch cached odds for a sport
   */
  async getCachedOdds(sport: string) {
    if (!this.supabase) return [];
    try {
      const { data, error } = await this.supabase
        .from('live_odds_cache')
        .select('*')
        .eq('sport_key', sport)
        .gt('expires_at', new Date().toISOString())
        .order('cached_at', { ascending: false })
        .limit(50);

      if (error) {
        // Silently handle 404 / missing table errors
        return [];
      }

      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Store odds in cache via process_odds_batch RPC.
   * Uses service-role client when available (required for RPC execute permission).
   */
  async storeOdds(_sport: string, _sportKey: string, games: any[]) {
    if (!games.length) return false;

    // Use service-role client when available — process_odds_batch is granted to service_role.
    // Fall back to anon client (will fail silently if permissions aren't extended).
    let client = this.supabase;
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && serviceKey) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createClient } = require('@supabase/supabase-js');
        client = createClient(url, serviceKey, { db: { schema: 'api' } });
      }
    } catch (_) {
      // fall through to anon client
    }

    if (!client) return false;

    const { error } = await client.rpc('process_odds_batch', { p_payload: games });

    if (error) {
      const msg: string = (error as any).message ?? '';
      // Silently skip known non-blocking error classes:
      //   - permission denied (42501) — service key absent
      //   - schema cache miss — process_odds_batch RPC not deployed to this DB
      //   - function not found — same as above, different pg error text
      const isSilent = msg.includes('permission')
        || msg.includes('42501')
        || msg.includes('schema cache')
        || msg.includes('Could not find the function')
        || msg.includes('function') && msg.includes('does not exist');
      if (!isSilent) {
        console.error('[Supabase] process_odds_batch error:', msg);
      }
      return false;
    }
    return true;
  }

  /**
   * Store odds in sport-specific table
   */
  async storeSportOdds(sport: string, games: any[]) {
    if (!this.supabase) return false;

    // Map sport API keys to actual table names in Supabase
    const SPORT_TABLE_MAP: Record<string, string> = {
      basketball_nba: 'nba_odds',
      basketball_ncaab: 'ncaab_odds',
      americanfootball_nfl: 'nfl_odds',
      americanfootball_ncaaf: 'ncaaf_odds',
      baseball_mlb: 'mlb_odds',
      icehockey_nhl: 'nhl_odds',
      // Soccer and others fall back to live_odds_cache only
    };

    const tableName = SPORT_TABLE_MAP[sport];
    if (!tableName) {
      // No dedicated table for this sport; silently skip
      return false;
    }

    // Map API data to the actual sport table schema:
    // game_id, home_team, away_team, commence_time,
    // h2h_odds (jsonb), spreads (jsonb), totals (jsonb), cached_at
    const records = games.map((game: any) => {
      // Aggregate all bookmakers' markets into JSONB blobs keyed by market type
      const h2hOdds: any[] = [];
      const spreadsOdds: any[] = [];
      const totalsOdds: any[] = [];

      for (const book of game.bookmakers || []) {
        for (const market of book.markets || []) {
          const entry = { bookmaker: book.key, outcomes: market.outcomes };
          if (market.key === 'h2h') h2hOdds.push(entry);
          else if (market.key === 'spreads') spreadsOdds.push(entry);
          else if (market.key === 'totals') totalsOdds.push(entry);
        }
      }

      return {
        game_id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        commence_time: game.commence_time,
        h2h_odds:  h2hOdds.length   ? h2hOdds   : null,
        spreads:   spreadsOdds.length ? spreadsOdds : null,
        totals:    totalsOdds.length  ? totalsOdds  : null,
        cached_at: new Date().toISOString(),
      };
    });

    try {
      const { error } = await this.supabase
        .from(tableName)
        .upsert(records, { onConflict: 'game_id' });

      if (error) {
        // Silently ignore permission / constraint / schema-cache errors.
        // PGRST204 = column not found in schema cache (table schema mismatch — non-blocking)
        // PGRST205 = ambiguous column, 42P10 = policy, 42501 = permission denied, 23505 = unique violation
        const code = (error as any).code;
        const msg: string = (error as any).message ?? '';
        if (!['PGRST204', 'PGRST205', '42P10', '42501', '23505'].includes(code) &&
            !msg.includes('policy') &&
            !msg.includes('fetch failed') &&
            !msg.includes('schema cache')) {
          console.error(`[Supabase] Sport odds store error (${tableName}):`, msg || error);
        }
        return false;
      }
    } catch (err) {
      // Network or other transient error — log and continue (non-blocking)
      console.warn(`[Supabase] storeSportOdds transient error (${tableName}):`, err instanceof Error ? err.message : err);
      return false;
    }
    return true;
  }

  /**
   * Fetch edge opportunities
   */
  async getEdgeOpportunities(sport?: string) {
    if (!this.supabase) return [];
    let query = this.supabase
      .from('arbitrage_opportunities')
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
    if (!this.supabase) return false;
    const { error } = await this.supabase
      .from('arbitrage_opportunities')
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
    if (!this.supabase) return [];
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
    if (!this.supabase) return false;
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
    if (!this.supabase) return null;
    const { data, error } = await this.supabase
      .from('capital_state')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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
    if (!this.supabase) return false;
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
    if (!this.supabase) return false;
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
