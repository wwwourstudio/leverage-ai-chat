
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

    let error: any;
    try {
      ({ error } = await client.rpc('process_odds_batch', { p_payload: games }));
    } catch (e) {
      // Network-level failure (e.g. fetch failed) — treat as transient, don't log
      return false;
    }

    if (error) {
      const msg: string = (error as any).message ?? '';
      // Silently skip known non-blocking error classes:
      //   - permission denied (42501) — service key absent
      //   - schema cache miss — process_odds_batch RPC not deployed to this DB
      //   - function not found — same as above, different pg error text
      //   - fetch failed — transient network error, Supabase temporarily unreachable
      const isSilent = msg.includes('permission')
        || msg.includes('42501')
        || msg.includes('schema cache')
        || msg.includes('Could not find the function')
        || msg.includes('fetch failed')
        || msg.includes('network')
        || (msg.includes('function') && msg.includes('does not exist'));
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

}

// Export singleton instance
export const supabaseOddsService = new SupabaseOddsService();
