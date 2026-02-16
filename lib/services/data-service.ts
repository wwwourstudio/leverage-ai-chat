import { createClient } from '@/lib/supabase/server';
import { fetchLiveOdds } from '@/lib/odds-api-client';

/**
 * Unified Data Service Layer
 * Handles data fetching, caching, and synchronization with Supabase
 */
export class DataService {
  private supabase: any;

  constructor() {
    this.supabase = null;
  }

  async init() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
  }

  /**
   * Get odds for a sport - checks cache first, then fetches from API
   */
  async getOdds(sport: string, forceRefresh = false) {
    await this.init();

    const sportKey = this.normalizeSportKey(sport);
    console.log(`[DataService] Getting odds for ${sportKey}, forceRefresh=${forceRefresh}`);

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const { data: cached, error } = await this.supabase
        .from('live_odds_cache')
        .select('*')
        .eq('sport_key', sportKey)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (!error && cached && cached.length > 0) {
        console.log(`[DataService] Cache HIT for ${sportKey}: ${cached.length} games`);
        return cached.map((record: any) => record.odds_data);
      }
      
      console.log(`[DataService] Cache MISS for ${sportKey}`);
    }

    // Fetch from API
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) {
      console.error('[DataService] ODDS_API_KEY not configured');
      return [];
    }

    console.log(`[DataService] Fetching fresh odds from API for ${sportKey}`);
    const oddsData = await fetchLiveOdds(sportKey, {
      markets: ['h2h', 'spreads', 'totals'],
      regions: ['us'],
      oddsFormat: 'american',
      apiKey,
      skipCache: true
    });

    // Store in database cache
    if (oddsData && oddsData.length > 0) {
      const records = oddsData.map((game: any) => ({
        sport_key: sportKey,
        game_id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        commence_time: game.commence_time,
        odds_data: game,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min TTL
      }));

      const { error: upsertError } = await this.supabase
        .from('live_odds_cache')
        .upsert(records, { onConflict: 'game_id' });

      if (upsertError) {
        console.error('[DataService] Error caching odds:', upsertError);
      } else {
        console.log(`[DataService] Cached ${records.length} games for ${sportKey}`);
      }
    }

    return oddsData;
  }

  /**
   * Store player statistics in database
   */
  async storePlayerStats(playerId: string, stats: any) {
    await this.init();

    const { data, error } = await this.supabase
      .from('player_stats')
      .upsert({
        player_id: playerId,
        player_name: stats.name,
        sport: stats.sport,
        team: stats.team,
        season: stats.season,
        ppg: stats.ppg,
        apg: stats.apg,
        rpg: stats.rpg,
        games_played: stats.gamesPlayed,
        updated_at: new Date().toISOString()
      }, { onConflict: 'player_id' });

    if (error) {
      console.error('[DataService] Error storing player stats:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get player statistics from database
   */
  async getPlayerStats(playerId: string) {
    await this.init();

    const { data, error } = await this.supabase
      .from('player_stats')
      .select('*')
      .eq('player_id', playerId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[DataService] Error fetching player stats:', error);
      throw error;
    }

    return data;
  }

  /**
   * Store edge opportunities in database
   */
  async storeEdgeOpportunities(opportunities: any[]) {
    await this.init();

    const records = opportunities.map((opp: { market_id: string; sport: string; matchup: string; market_type: string; model_prob: number; market_prob: number; edge: number; confidence: number; expected_value: number; odds: number; bookmaker: string; created_at: string; expires_at?: string }) => ({
      market_id: opp.market_id,
      sport: opp.sport,
      matchup: opp.matchup,
      market_type: opp.market_type,
      model_prob: opp.model_prob,
      market_prob: opp.market_prob,
      edge: opp.edge,
      confidence_score: opp.confidence,
      expected_value: opp.expected_value,
      odds: opp.odds,
      expires_at: opp.expires_at
    }));

    const { error } = await this.supabase
      .from('edge_opportunities')
      .upsert(records, { onConflict: 'market_id' });

    if (error) {
      console.error('[DataService] Error storing edge opportunities:', error);
      throw error;
    }

    console.log(`[DataService] Stored ${records.length} edge opportunities`);
  }

  /**
   * Get active edge opportunities
   */
  async getEdgeOpportunities(minEdge = 0.02) {
    await this.init();

    const { data, error } = await this.supabase
      .from('edge_opportunities')
      .select('*')
      .gte('edge', minEdge)
      .gt('expires_at', new Date().toISOString())
      .order('edge', { ascending: false });

    if (error) {
      console.error('[DataService] Error fetching edge opportunities:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Normalize sport key to match Odds API format
   */
  private normalizeSportKey(sport: string): string {
    const sportMap: Record<string, string> = {
      'nba': 'basketball_nba',
      'nfl': 'americanfootball_nfl',
      'mlb': 'baseball_mlb',
      'nhl': 'icehockey_nhl',
      'ncaab': 'basketball_ncaab',
      'ncaaf': 'americanfootball_ncaaf'
    };

    return sportMap[sport.toLowerCase()] || sport;
  }
}

export const dataService = new DataService();
