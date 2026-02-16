/**
 * Player Props Service
 * Fetches and caches player prop betting markets from The Odds API
 */

import { createClient } from '@/lib/supabase/client';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
      
      if (!error && cached && cached.length > 0) {
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
      console.error('[v0] [PLAYER-PROPS] Cache read error:', error);
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
    const playerPropMarkets = [
      'player_points',
      'player_rebounds', 
      'player_assists',
      'player_threes',
      'player_pass_tds',
      'player_pass_yds',
      'player_rush_yds',
      'player_receptions'
    ];
    
    const allProps: PlayerProp[] = [];
    
    // Fetch each player prop market
    for (const market of playerPropMarkets) {
      const url = `${baseUrl}/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=${market}&oddsFormat=american`;
      
      console.log(`[v0] [PLAYER-PROPS] Fetching ${market}...`);
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[v0] [PLAYER-PROPS] API error for ${market}: ${response.status}`);
        continue;
      }
      
      const games = await response.json();
      
      // Parse props from each game
      for (const game of games) {
        if (!game.bookmakers || game.bookmakers.length === 0) continue;
        
        for (const bookmaker of game.bookmakers) {
          const propsMarket = bookmaker.markets?.find((m: any) => m.key === market);
          if (!propsMarket) continue;
          
          // Group outcomes by player
          const playerProps: Record<string, any> = {};
          for (const outcome of propsMarket.outcomes) {
            const playerName = outcome.description || outcome.name;
            if (!playerProps[playerName]) {
              playerProps[playerName] = {
                player: playerName,
                line: outcome.point,
                over: null,
                under: null,
              };
            }
            
            if (outcome.name === 'Over') {
              playerProps[playerName].over = outcome.price;
            } else if (outcome.name === 'Under') {
              playerProps[playerName].under = outcome.price;
            }
          }
          
          // Create prop objects
          for (const [playerName, propData] of Object.entries(playerProps)) {
            if (propData.over && propData.under) {
              allProps.push({
                id: `${game.id}-${playerName}-${market}`,
                sport,
                gameId: game.id,
                playerName,
                statType: market.replace('player_', ''),
                line: propData.line,
                overOdds: propData.over,
                underOdds: propData.under,
                bookmaker: bookmaker.title,
                gameTime: game.commence_time,
                homeTeam: game.home_team,
                awayTeam: game.away_team,
              });
            }
          }
        }
      }
    }
    
    console.log(`[v0] [PLAYER-PROPS] Fetched ${allProps.length} total props`);
    
    // Store in Supabase
    if (storeResults && allProps.length > 0) {
      try {
        const rows = allProps.map(prop => ({
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
        }));
        
        const { error } = await supabase
          .from('player_props_markets')
          .upsert(rows, { onConflict: 'id' });
        
        if (error) {
          console.error('[v0] [PLAYER-PROPS] Storage error:', error);
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
    points: 'Points',
    rebounds: 'Rebounds',
    assists: 'Assists',
    threes: '3-Pointers',
    pass_tds: 'Pass TDs',
    pass_yds: 'Pass Yards',
    rush_yds: 'Rush Yards',
    receptions: 'Receptions',
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
