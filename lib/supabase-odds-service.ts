const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Convert American odds to implied probability (0-1) */
function oddsToImpliedProb(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  }
  return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

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
        .eq('sport', sport)
        .gt('expires_at', new Date().toISOString())
        .order('fetched_at', { ascending: false })
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
   * Store odds in cache
   */
  async storeOdds(sport: string, sportKey: string, games: any[]) {
    if (!this.supabase) return false;

    // Map API response to actual live_odds_cache schema:
    // event_id, event_name, sport, sportsbook, market_type, odds_data,
    // commence_time, implied_probability, fetched_at, expires_at, source
    const records: any[] = [];
    for (const game of games) {
      const firstBook = game.bookmakers?.[0];
      if (!firstBook) continue;

      for (const market of firstBook.markets || []) {
        records.push({
          event_id: game.id,
          event_name: `${game.away_team} @ ${game.home_team}`,
          sport: sportKey,
          sportsbook: firstBook.key || firstBook.title,
          market_type: market.key, // h2h, spreads, totals
          odds_data: { outcomes: market.outcomes, bookmakers: game.bookmakers },
          commence_time: game.commence_time,
          implied_probability: null,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CACHE_TTL).toISOString(),
          source: 'the-odds-api',
        });
      }
    }

    if (records.length === 0) return false;

    // Delete stale entries for this sport, then insert fresh data.
    // This avoids upsert conflict issues since there's no unique constraint
    // on (event_id, market_type, sportsbook).
    try {
      await this.supabase
        .from('live_odds_cache')
        .delete()
        .eq('sport', sportKey)
        .lt('expires_at', new Date().toISOString());
    } catch (_) {
      // Non-critical cleanup; continue with insert
    }

    const { error } = await this.supabase
      .from('live_odds_cache')
      .insert(records);

    if (error) {
      // Silently ignore duplicate key, constraint, and schema-cache violations.
      // PGRST204 = column not found in schema cache (live_odds_cache schema mismatch — non-blocking)
      const code = (error as any).code as string;
      const msg: string = (error as any).message ?? '';
      if (!['23505', 'PGRST204', 'PGRST205', '42P10'].includes(code) &&
          !msg.includes('schema cache')) {
        console.error('[Supabase] Error storing odds:', error);
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
    // event_id, event_name, home_team, away_team, commence_time,
    // home_odds, away_odds, home_implied_prob, away_implied_prob,
    // home_spread, home_spread_odds, away_spread, away_spread_odds,
    // over_total, over_odds, under_total, under_odds,
    // sportsbook, market_type, source, raw_odds_data,
    // api_requests_remaining, fetched_at, expires_at
    const records = games.map((game: any) => {
      const firstBook = game.bookmakers?.[0];
      const h2h = firstBook?.markets?.find((m: any) => m.key === 'h2h');
      const spreads = firstBook?.markets?.find((m: any) => m.key === 'spreads');
      const totals = firstBook?.markets?.find((m: any) => m.key === 'totals');

      const homeH2h = h2h?.outcomes?.find((o: any) => o.name === game.home_team);
      const awayH2h = h2h?.outcomes?.find((o: any) => o.name === game.away_team);
      const homeSpread = spreads?.outcomes?.find((o: any) => o.name === game.home_team);
      const awaySpread = spreads?.outcomes?.find((o: any) => o.name === game.away_team);
      const overTotal = totals?.outcomes?.find((o: any) => o.name === 'Over');
      const underTotal = totals?.outcomes?.find((o: any) => o.name === 'Under');

      return {
        event_id: game.id,
        event_name: `${game.away_team} @ ${game.home_team}`,
        home_team: game.home_team,
        away_team: game.away_team,
        commence_time: game.commence_time,
        home_odds: homeH2h?.price ?? null,
        away_odds: awayH2h?.price ?? null,
        home_implied_prob: homeH2h?.price ? oddsToImpliedProb(homeH2h.price) : null,
        away_implied_prob: awayH2h?.price ? oddsToImpliedProb(awayH2h.price) : null,
        home_spread: homeSpread?.point ?? null,
        home_spread_odds: homeSpread?.price ?? null,
        away_spread: awaySpread?.point ?? null,
        away_spread_odds: awaySpread?.price ?? null,
        over_total: overTotal?.point ?? null,
        over_odds: overTotal?.price ?? null,
        under_total: underTotal?.point ?? null,
        under_odds: underTotal?.price ?? null,
        sportsbook: firstBook?.key || firstBook?.title || 'unknown',
        market_type: 'h2h', // primary market type
        source: 'the-odds-api',
        raw_odds_data: { bookmakers: game.bookmakers },
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + CACHE_TTL).toISOString(),
      };
    });

    try {
      const { error } = await this.supabase
        .from(tableName)
        .upsert(records, { onConflict: 'event_id' });

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
