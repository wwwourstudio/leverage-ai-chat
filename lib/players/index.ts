/**
 * Unified Players Module
 * Consolidates player-props-service and player-projections
 * Provides comprehensive player data, props, and projections
 */

import { createClient } from '@/lib/supabase/client';
import { getOddsApiKey, isOddsApiConfigured } from '@/lib/config';
import { EXTERNAL_APIS, LOG_PREFIXES } from '@/lib/constants';

// ============================================
// Types
// ============================================

export interface PlayerProp {
  id: string;
  sport: string;
  gameId: string;
  playerName: string;
  statType: string;
  line: number;
  overOdds: number;
  underOdds: number;
  bookmaker: string;
  gameTime: string;
  homeTeam: string;
  awayTeam: string;
}

export interface PlayerProjection {
  player: string;
  team: string;
  position: string;
  statType: string;
  projection: number;
  overOdds?: number;
  underOdds?: number;
  line?: number;
  bookmaker?: string;
  lastUpdate?: string;
}

export interface PlayerProjectionsResponse {
  success: boolean;
  player?: string;
  projections?: PlayerProjection[];
  error?: string;
  source: 'api' | 'fallback';
  timestamp: string;
}

// ============================================
// Constants
// ============================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const PLAYER_PROP_MARKETS = [
  'player_points',
  'player_rebounds', 
  'player_assists',
  'player_threes',
  'player_pass_tds',
  'player_pass_yds',
  'player_rush_yds',
  'player_receptions',
  'batter_home_runs',
  'batter_hits',
  'batter_rbis', 
  'batter_runs_scored',
  'batter_stolen_bases',
  'batter_total_bases'
] as const;

// ============================================
// Utility Functions
// ============================================

function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
}

function isPlayerMatch(targetName: string, candidateName: string): boolean {
  const normalizedTarget = normalizePlayerName(targetName);
  const normalizedCandidate = normalizePlayerName(candidateName);
  
  if (normalizedTarget === normalizedCandidate) return true;
  
  const targetParts = normalizedTarget.split(' ');
  return targetParts.every(part => normalizedCandidate.includes(part));
}

// ============================================
// Fetch Player Props (from Props Service)
// ============================================

export async function fetchPlayerProps(options: {
  sport: string;
  propType?: string;
  useCache?: boolean;
  storeResults?: boolean;
}): Promise<PlayerProp[]> {
  const { sport, useCache = true, storeResults = true } = options;
  
  console.log(`${LOG_PREFIXES.API} Fetching props for ${sport}`);
  
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
        console.log(`${LOG_PREFIXES.API} Cache hit: ${cached.length} props from Supabase`);
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
      console.error(`${LOG_PREFIXES.API} Cache read error:`, error);
    }
  }
  
  // Fetch from Odds API
  const apiKey = getOddsApiKey();
  if (!apiKey) {
    console.error(`${LOG_PREFIXES.API} No API key configured`);
    return [];
  }
  
  try {
    const allProps: PlayerProp[] = [];
    
    // Fetch each player prop market
    for (const market of PLAYER_PROP_MARKETS) {
      const url = `${EXTERNAL_APIS.ODDS_API.BASE_URL}/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=${market}&oddsFormat=american`;
      
      const response = await fetch(url);
      if (!response.ok) continue;
      
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
                statType: market.replace('player_', '').replace('batter_', ''),
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
    
    console.log(`${LOG_PREFIXES.API} Fetched ${allProps.length} total props`);
    
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
          console.error(`${LOG_PREFIXES.API} Storage error:`, error);
        } else {
          console.log(`${LOG_PREFIXES.API} Stored ${rows.length} props in Supabase`);
        }
      } catch (error) {
        console.error(`${LOG_PREFIXES.API} Storage exception:`, error);
      }
    }
    
    return allProps;
  } catch (error) {
    console.error(`${LOG_PREFIXES.API} Fetch error:`, error);
    return [];
  }
}

// ============================================
// Fetch Player Projections (from Projections Service)
// ============================================

export async function fetchPlayerProjections(
  playerName: string,
  sport: string = 'baseball_mlb'
): Promise<PlayerProjectionsResponse> {
  const timestamp = new Date().toISOString();

  if (!isOddsApiConfigured()) {
    return {
      success: false,
      error: 'Odds API key not configured. Player projections unavailable.',
      source: 'fallback',
      timestamp
    };
  }

  try {
    const apiKey = getOddsApiKey();
    const eventsUrl = `${EXTERNAL_APIS.ODDS_API.BASE_URL}/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=${PLAYER_PROP_MARKETS.join(',')}`;
    
    console.log(`${LOG_PREFIXES.API} Fetching player props for ${playerName}`);
    
    const response = await fetch(eventsUrl);

    if (!response.ok) {
      return {
        success: false,
        error: `API returned ${response.status}`,
        source: 'fallback',
        timestamp
      };
    }

    const events = await response.json();
    
    const projections: PlayerProjection[] = [];
    
    for (const event of events) {
      if (!event.bookmakers?.length) continue;
      
      const eventTeams = [event.home_team, event.away_team].filter(Boolean);
      
      for (const bookmaker of event.bookmakers) {
        if (!bookmaker.markets?.length) continue;
        
        for (const market of bookmaker.markets) {
          if (!market.outcomes?.length) continue;
          
          for (const outcome of market.outcomes) {
            const outcomeName = outcome.description || outcome.name || '';
            
            if (!isPlayerMatch(playerName, outcomeName)) continue;
            
            const underOutcome = market.outcomes.find((o: any) => 
              o.name === 'Under' && 
              isPlayerMatch(playerName, o.description || o.name || '')
            );
            
            const playerTeam = eventTeams.find(team => 
              outcomeName.toLowerCase().includes(team.toLowerCase())
            ) || eventTeams[0] || 'Unknown';
            
            projections.push({
              player: outcome.description || playerName,
              team: playerTeam,
              position: '',
              statType: market.key.replace('batter_', '').replace('player_', '').replace(/_/g, ' '),
              projection: outcome.point || 0,
              overOdds: outcome.price,
              underOdds: underOutcome?.price,
              line: outcome.point,
              bookmaker: bookmaker.title,
              lastUpdate: market.last_update || event.commence_time
            });
          }
        }
      }
    }

    if (projections.length === 0) {
      return {
        success: false,
        player: playerName,
        error: `No active prop bets found for ${playerName}`,
        source: 'api',
        timestamp
      };
    }

    console.log(`${LOG_PREFIXES.API} Found ${projections.length} projections for ${playerName}`);
    
    return {
      success: true,
      player: playerName,
      projections,
      source: 'api',
      timestamp
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      error: `Failed to fetch projections: ${errorMessage}`,
      source: 'fallback',
      timestamp
    };
  }
}

// ============================================
// Get Props for Specific Player
// ============================================

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
    console.error(`${LOG_PREFIXES.API} Error fetching props for ${playerName}:`, error);
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

// ============================================
// Formatting Functions
// ============================================

export function formatProjectionSummary(response: PlayerProjectionsResponse): string {
  if (!response.success || !response.projections?.length) {
    return response.error || 'No projections available';
  }

  const { player, projections } = response;
  
  const statGroups = projections.reduce<Record<string, PlayerProjection[]>>((acc, proj) => {
    const key = proj.statType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(proj);
    return acc;
  }, {});

  const lines: string[] = [];
  lines.push(`${player} (${projections[0].team}):`);
  
  for (const [statType, props] of Object.entries(statGroups)) {
    const avgLine = props.reduce((sum, p) => sum + (p.line || 0), 0) / props.length;
    const avgOverOdds = props.reduce((sum, p) => sum + (p.overOdds || 0), 0) / props.length;
    const bookmakerCount = props.length;
    
    const oddsStr = avgOverOdds ? ` (${avgOverOdds > 0 ? '+' : ''}${avgOverOdds.toFixed(0)})` : '';
    lines.push(
      `  • ${statType}: ${avgLine.toFixed(1)}${oddsStr} [${bookmakerCount} book${bookmakerCount > 1 ? 's' : ''}]`
    );
  }
  
  const bookmakers = [...new Set(projections.map(p => p.bookmaker))].slice(0, 3).join(', ');
  lines.push(`\nSource: The Odds API • ${bookmakers}`);
  
  return lines.join('\n');
}

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
    home_runs: 'Home Runs',
    hits: 'Hits',
    rbis: 'RBIs',
    runs_scored: 'Runs Scored',
    stolen_bases: 'Stolen Bases',
    total_bases: 'Total Bases',
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
