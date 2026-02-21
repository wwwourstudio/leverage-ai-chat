/**
 * Player Props Service
 * Fetches and caches player prop betting markets from The Odds API
 * with sport-specific market validation and rate limiting
 */

import { createClient } from '@/lib/supabase/client';
import { playerPropsQueue } from '@/lib/api-request-manager';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Warn about missing table only once per process lifetime to avoid log spam
let tableWarnedMissing = false;

export interface PlayerProp {
  id: string;
  sport: string;
  gameId: string;
  playerName: string;
  statType: string; // 'points', 'rebounds', 'assists', 'passing_yards', etc.
  line: number;
  overOdds: number;
  underOdds: number;
  bookmaker: string;
  gameTime: string;
  homeTeam: string;
  awayTeam: string;
}

export interface PlayerPropsOptions {
  sport: string;
  propType?: string; // Optional filter for specific prop types (e.g., 'player_points', 'player_rebounds')
  useCache?: boolean;
  storeResults?: boolean;
}

/**
 * Fetch player props from The Odds API with Supabase caching
 */
export async function fetchPlayerProps(options: PlayerPropsOptions): Promise<PlayerProp[]> {
  const { sport, useCache = true, storeResults = true } = options;
  
  console.log(`[v0] [PLAYER-PROPS] Fetching props for ${sport}`);
  
  const supabase = createClient();
  
  // Try cache first
  if (useCache) {
    try {
      const { data: cached, error } = await supabase
        .from('player_props_markets')
        .select('*')
        .eq('sport', sport)
        .gte('fetched_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
        .order('game_time', { ascending: true })
        .limit(50);
      
      if (error) {
        if (error.code === 'PGRST205') {
          if (!tableWarnedMissing) {
            tableWarnedMissing = true;
            console.warn('[v0] [PLAYER-PROPS] player_props_markets table missing — POST /api/admin/migrate or run scripts/003-player-props-table.sql in Supabase (this warning will not repeat)');
          }
        } else {
          console.error('[v0] [PLAYER-PROPS] Cache read error:', error);
        }
      } else if (cached && cached.length > 0) {
        console.log(`[v0] [PLAYER-PROPS] Cache hit: ${cached.length} props from Supabase`);
        return cached.map((row: any) => ({
          id: row.id,
          sport: row.sport,
          gameId: row.game_id,
          playerName: row.player_name,
          statType: row.stat_type,
          line: row.line,
          overOdds: row.over_odds,
          underOdds: row.under_odds,
          bookmaker: row.bookmaker,
          gameTime: row.game_time,
          homeTeam: row.home_team,
          awayTeam: row.away_team,
        }));
      }
    } catch (error) {
      console.error('[v0] [PLAYER-PROPS] Cache read exception:', error);
    }
  }
  
  // Fetch from Odds API
  const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
  if (!apiKey) {
    console.error('[v0] [PLAYER-PROPS] No API key configured');
    return [];
  }
  
  try {
    const baseUrl = 'https://api.the-odds-api.com/v4';

    // Sport-specific player prop markets.
    // Player props require the event-level endpoint and are only valid when
    // there are upcoming events for the sport.
    const sportPropMarkets: Record<string, string[]> = {
      // Basketball
      'basketball_nba': ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_blocks', 'player_steals', 'player_turnovers', 'player_points_rebounds_assists', 'player_points_rebounds', 'player_points_assists', 'player_rebounds_assists', 'player_double_double', 'player_first_basket'],
      'basketball_ncaab': ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_blocks', 'player_steals'],
      'basketball_wnba': ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_blocks', 'player_steals'],
      // American Football
      'americanfootball_nfl': ['player_pass_tds', 'player_pass_yds', 'player_pass_completions', 'player_pass_attempts', 'player_pass_interceptions', 'player_rush_yds', 'player_rush_attempts', 'player_receptions', 'player_reception_yds', 'player_anytime_td', 'player_first_td', 'player_kicking_points', 'player_field_goals'],
      'americanfootball_ncaaf': ['player_pass_tds', 'player_pass_yds', 'player_rush_yds', 'player_receptions', 'player_reception_yds', 'player_anytime_td'],
      // Baseball
      'baseball_mlb': ['player_home_runs', 'player_hits', 'player_total_bases', 'player_rbis', 'player_runs', 'player_stolen_bases', 'player_hits_runs_rbis', 'player_singles', 'player_doubles', 'player_walks', 'player_strikeouts', 'pitcher_strikeouts', 'pitcher_hits_allowed', 'pitcher_walks', 'pitcher_earned_runs', 'pitcher_outs'],
      // Hockey
      'icehockey_nhl': ['player_points', 'player_goals', 'player_assists', 'player_shots_on_goal', 'player_blocked_shots', 'player_power_play_points', 'goalie_saves'],
      // Soccer
      'soccer_epl': ['player_anytime_goalscorer', 'player_first_goalscorer', 'player_last_goalscorer', 'player_shots_on_target', 'player_shots', 'player_assists'],
      'soccer_usa_mls': ['player_anytime_goalscorer', 'player_first_goalscorer', 'player_shots_on_target', 'player_shots', 'player_assists'],
      'soccer_spain_la_liga': ['player_anytime_goalscorer', 'player_first_goalscorer', 'player_shots_on_target'],
      'soccer_germany_bundesliga': ['player_anytime_goalscorer', 'player_first_goalscorer', 'player_shots_on_target'],
      'soccer_italy_serie_a': ['player_anytime_goalscorer', 'player_first_goalscorer', 'player_shots_on_target'],
      'soccer_france_ligue_one': ['player_anytime_goalscorer', 'player_first_goalscorer', 'player_shots_on_target'],
      'soccer_uefa_champs_league': ['player_anytime_goalscorer', 'player_first_goalscorer', 'player_shots_on_target'],
      // MMA / UFC
      'mma_mixed_martial_arts': ['player_method_of_victory', 'player_round_betting', 'player_fight_duration'],
      // Tennis
      'tennis_atp_french_open': ['player_total_games', 'player_sets'],
      'tennis_atp_us_open': ['player_total_games', 'player_sets'],
      'tennis_atp_wimbledon': ['player_total_games', 'player_sets'],
      'tennis_atp_australian_open': ['player_total_games', 'player_sets'],
      // Golf
      'golf_pga': ['player_top_5', 'player_top_10', 'player_top_20', 'player_make_cut'],
      'golf_masters': ['player_top_5', 'player_top_10', 'player_top_20'],
    };

    const playerPropMarkets = sportPropMarkets[sport] || [];

    if (playerPropMarkets.length === 0) {
      console.log(`[v0] [PLAYER-PROPS] No prop markets configured for ${sport}`);
      return [];
    }

    console.log(`[v0] [PLAYER-PROPS] Using ${playerPropMarkets.length} valid markets for ${sport}: ${playerPropMarkets.join(', ')}`);

    // Step 1: fetch upcoming events for this sport so we have event IDs.
    // Player props are only available via the event-level endpoint:
    //   GET /v4/sports/{sport}/events/{eventId}/odds?markets={market}
    // Calling the game odds endpoint with player prop markets returns HTTP 422.
    let events: any[] = [];
    try {
      const eventsUrl = `${baseUrl}/sports/${sport}/events?apiKey=${apiKey}`;
      // Route through the queue so parallel sport fetches don't all hit the
      // events endpoint simultaneously and trigger HTTP 429 rate limits.
      const eventsResp = await playerPropsQueue.enqueue(() => fetch(eventsUrl), 1);
      if (eventsResp.ok) {
        events = await eventsResp.json();
        console.log(`[v0] [PLAYER-PROPS] Found ${events.length} upcoming events for ${sport}`);
      } else if (eventsResp.status === 404) {
        console.log(`[v0] [PLAYER-PROPS] No active season for ${sport}, skipping props`);
        return [];
      } else if (eventsResp.status === 429) {
        console.warn(`[v0] [PLAYER-PROPS] Rate limited fetching events for ${sport}, skipping`);
        return [];
      } else {
        console.warn(`[v0] [PLAYER-PROPS] Events fetch failed for ${sport}: HTTP ${eventsResp.status}`);
        return [];
      }
    } catch (eventsError) {
      console.error(`[v0] [PLAYER-PROPS] Events fetch exception for ${sport}:`, eventsError);
      return [];
    }

    if (events.length === 0) {
      console.log(`[v0] [PLAYER-PROPS] No upcoming events for ${sport}, skipping props`);
      return [];
    }

    const allProps: PlayerProp[] = [];
    const marketsParam = playerPropMarkets.join(',');

    console.log(`[v0] [PLAYER-PROPS] Queue status: ${playerPropsQueue.getQueueLength()} pending, ${playerPropsQueue.getActiveRequests()} active`);

    // Step 2: For each event, fetch all prop markets in one request.
    // Limit to first 3 events to avoid burning too many API credits.
    const eventsToFetch = events.slice(0, 3);
    const fetchPromises = eventsToFetch.map((event: any, i: number) => {
      return playerPropsQueue.enqueue(async () => {
        const url = `${baseUrl}/sports/${sport}/events/${event.id}/odds?apiKey=${apiKey}&regions=us&markets=${marketsParam}&oddsFormat=american`;

        console.log(`[v0] [PLAYER-PROPS] Fetching props for event ${i + 1}/${eventsToFetch.length}: ${event.home_team} vs ${event.away_team}`);

        try {
          const response = await fetch(url);

          if (!response.ok) {
            if (response.status === 429) {
              console.warn(`[v0] [PLAYER-PROPS] Rate limited on event ${event.id} (HTTP 429)`);
              return null;
            } else if (response.status === 422) {
              console.log(`[v0] [PLAYER-PROPS] No player prop markets for event ${event.id} (HTTP 422) - props not yet available`);
              return null;
            }
            console.error(`[v0] [PLAYER-PROPS] API error for event ${event.id}: ${response.status}`);
            return null;
          }

          const data = await response.json();
          return { event, data };
        } catch (fetchError) {
          console.error(`[v0] [PLAYER-PROPS] Fetch exception for event ${event.id}:`, fetchError);
          return null;
        }
      }, 0);
    });

    // Wait for all requests to complete
    const results = await Promise.allSettled(fetchPromises);

    // Process results
    for (const result of results) {
      if (result.status === 'rejected' || !result.value) continue;

      const { event, data } = result.value as { event: any; data: any };
      if (!data.bookmakers || data.bookmakers.length === 0) continue;

      for (const bookmaker of data.bookmakers) {
        for (const market of (bookmaker.markets || [])) {
          // Group outcomes by player
          const playerProps: Record<string, any> = {};
          for (const outcome of market.outcomes || []) {
            const playerName = outcome.description || outcome.name;
            if (!playerProps[playerName]) {
              playerProps[playerName] = { player: playerName, line: outcome.point, over: null, under: null };
            }
            if (outcome.name === 'Over') playerProps[playerName].over = outcome.price;
            else if (outcome.name === 'Under') playerProps[playerName].under = outcome.price;
          }

          for (const [playerName, propData] of Object.entries(playerProps)) {
            if ((propData as any).over && (propData as any).under) {
              allProps.push({
                id: `${event.id}-${playerName}-${market.key}`,
                sport,
                gameId: event.id,
                playerName,
                statType: market.key.replace('player_', ''),
                line: (propData as any).line,
                overOdds: (propData as any).over,
                underOdds: (propData as any).under,
                bookmaker: bookmaker.title,
                gameTime: event.commence_time,
                homeTeam: event.home_team,
                awayTeam: event.away_team,
              });
            }
          }
        }
      }
    }

    console.log(`[v0] [PLAYER-PROPS] Successfully fetched ${allProps.length} total props from ${playerPropMarkets.length} markets`);
    
    // Store in Supabase
    if (storeResults && allProps.length > 0) {
      try {
        // Deduplicate by id within the batch — same player+market can appear
        // from multiple bookmakers generating identical ids, which causes
        // PostgreSQL error 21000 ("ON CONFLICT DO UPDATE cannot affect row
        // a second time") when two rows in the same upsert share a PK.
        const seenIds = new Map<string, object>();
        for (const prop of allProps) {
          seenIds.set(prop.id, {
            id: prop.id,
            sport: prop.sport,
            game_id: prop.gameId,
            player_name: prop.playerName,
            stat_type: prop.statType,
            line: prop.line,
            over_odds: prop.overOdds,
            under_odds: prop.underOdds,
            bookmaker: prop.bookmaker,
            game_time: prop.gameTime,
            home_team: prop.homeTeam,
            away_team: prop.awayTeam,
            fetched_at: new Date().toISOString(),
          });
        }
        const rows = Array.from(seenIds.values());

        const { error } = await supabase
          .from('player_props_markets')
          .upsert(rows, { onConflict: 'id' });
        
        if (error) {
          if (error.code === 'PGRST205') {
            if (!tableWarnedMissing) {
              tableWarnedMissing = true;
              console.warn('[v0] [PLAYER-PROPS] player_props_markets table missing — POST /api/admin/migrate or run scripts/003-player-props-table.sql in Supabase (this warning will not repeat)');
            }
          } else {
            console.error('[v0] [PLAYER-PROPS] Storage error:', error);
          }
        } else {
          console.log(`[v0] [PLAYER-PROPS] Stored ${rows.length} props in Supabase`);
        }
      } catch (error) {
        console.error('[v0] [PLAYER-PROPS] Storage exception:', error);
      }
    }
    
    return allProps;
  } catch (error) {
    console.error('[v0] [PLAYER-PROPS] Fetch error:', error);
    return [];
  }
}

/**
 * Get props for a specific player
 */
export async function getPlayerProps(playerName: string, sport: string): Promise<PlayerProp[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('player_props_markets')
    .select('*')
    .eq('sport', sport)
    .ilike('player_name', `%${playerName}%`)
    .gte('fetched_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
    .order('game_time', { ascending: true });
  
  if (error) {
    console.error(`[v0] [PLAYER-PROPS] Error fetching props for ${playerName}:`, error);
    return [];
  }
  
  return (data || []).map((row: any) => ({
    id: row.id,
    sport: row.sport,
    gameId: row.game_id,
    playerName: row.player_name,
    statType: row.stat_type,
    line: row.line,
    overOdds: row.over_odds,
    underOdds: row.under_odds,
    bookmaker: row.bookmaker,
    gameTime: row.game_time,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
  }));
}

/**
 * Convert player prop to card format
 */
export function playerPropToCard(prop: PlayerProp): any {
  const statTypeDisplay: Record<string, string> = {
    // Basketball
    points: 'Points', rebounds: 'Rebounds', assists: 'Assists', threes: '3-Pointers',
    blocks: 'Blocks', steals: 'Steals', turnovers: 'Turnovers',
    points_rebounds_assists: 'Pts+Reb+Ast', points_rebounds: 'Pts+Reb',
    points_assists: 'Pts+Ast', rebounds_assists: 'Reb+Ast',
    double_double: 'Double-Double', first_basket: 'First Basket',
    // Football
    pass_tds: 'Pass TDs', pass_yds: 'Pass Yards', pass_completions: 'Completions',
    pass_attempts: 'Pass Attempts', pass_interceptions: 'Interceptions',
    rush_yds: 'Rush Yards', rush_attempts: 'Rush Attempts',
    receptions: 'Receptions', reception_yds: 'Receiving Yards',
    anytime_td: 'Anytime TD', first_td: 'First TD',
    kicking_points: 'Kicking Points', field_goals: 'Field Goals',
    // Baseball
    home_runs: 'Home Runs', hits: 'Hits', total_bases: 'Total Bases',
    rbis: 'RBIs', runs: 'Runs', stolen_bases: 'Stolen Bases',
    hits_runs_rbis: 'H+R+RBI', singles: 'Singles', doubles: 'Doubles',
    walks: 'Walks', strikeouts: 'Strikeouts',
    // Pitcher stats
    pitcher_strikeouts: 'K (Pitcher)', pitcher_hits_allowed: 'Hits Allowed',
    pitcher_walks: 'BB (Pitcher)', pitcher_earned_runs: 'Earned Runs', pitcher_outs: 'Outs',
    // Hockey
    goals: 'Goals', shots_on_goal: 'Shots on Goal', blocked_shots: 'Blocked Shots',
    power_play_points: 'Power Play Points', goalie_saves: 'Saves',
    // Soccer
    anytime_goalscorer: 'Anytime Goal', first_goalscorer: 'First Goal',
    last_goalscorer: 'Last Goal', shots_on_target: 'Shots on Target', shots: 'Shots',
    // MMA
    method_of_victory: 'Method of Victory', round_betting: 'Round',
    fight_duration: 'Fight Duration',
    // Tennis
    total_games: 'Total Games', sets: 'Sets',
    // Golf
    top_5: 'Top 5 Finish', top_10: 'Top 10 Finish', top_20: 'Top 20 Finish',
    make_cut: 'Make Cut',
  };
  
  const statLabel = statTypeDisplay[prop.statType] || prop.statType;
  
  return {
    type: 'PLAYER_PROP',
    title: `${prop.playerName} - ${statLabel}`,
    icon: 'User',
    category: prop.sport.toUpperCase(),
    subcategory: 'Player Props',
    gradient: 'from-blue-600 to-cyan-600',
    data: {
      player: prop.playerName,
      stat: statLabel,
      line: prop.line,
      over: `${prop.overOdds > 0 ? '+' : ''}${prop.overOdds}`,
      under: `${prop.underOdds > 0 ? '+' : ''}${prop.underOdds}`,
      game: `${prop.awayTeam} @ ${prop.homeTeam}`,
      gameTime: new Date(prop.gameTime).toLocaleString(),
      bookmaker: prop.bookmaker,
      realData: true,
    },
    metadata: {
      realData: true,
      dataSource: 'The Odds API (Player Props)',
      timestamp: new Date().toISOString(),
    },
  };
}
