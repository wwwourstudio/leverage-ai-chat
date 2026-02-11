/**
 * Player Projections Service
 * Fetches real player projection data from The Odds API
 * Documentation: https://the-odds-api.com/liveapi/guides/v4/#get-player-props
 */

import { getOddsApiKey, isOddsApiConfigured } from '@/lib/config';
import { EXTERNAL_APIS, LOG_PREFIXES } from '@/lib/constants';

export interface PlayerProjection {
  player: string;
  team: string;
  position: string;
  statType: string; // e.g., 'batting_average', 'home_runs', 'rbis', 'stolen_bases'
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

const PLAYER_PROP_MARKETS = [
  'batter_home_runs',
  'batter_hits',
  'batter_rbis', 
  'batter_runs_scored',
  'batter_stolen_bases',
  'batter_total_bases'
];

/**
 * Fetch player projections from The Odds API
 */
export async function fetchPlayerProjections(
  playerName: string,
  sport: string = 'baseball_mlb'
): Promise<PlayerProjectionsResponse> {
  const timestamp = new Date().toISOString();

  // Check if API is configured
  if (!isOddsApiConfigured()) {
    console.log(`${LOG_PREFIXES.API} Odds API not configured, cannot fetch player projections`);
    return {
      success: false,
      error: 'Odds API key not configured. Player projections unavailable.',
      source: 'fallback',
      timestamp
    };
  }

  try {
    const oddsApiKey = getOddsApiKey();
    
    // The Odds API provides player props via events endpoint
    // We need to fetch events and filter for player props
    const eventsUrl = `${EXTERNAL_APIS.ODDS_API.BASE_URL}/sports/${sport}/odds?apiKey=${oddsApiKey}&regions=us&markets=${PLAYER_PROP_MARKETS.join(',')}`;
    
    console.log(`${LOG_PREFIXES.API} Fetching player props for ${playerName} in ${sport}`);
    
    const response = await fetch(eventsUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`${LOG_PREFIXES.API} Player props API error: ${response.status}`);
      return {
        success: false,
        error: `API returned ${response.status}`,
        source: 'fallback',
        timestamp
      };
    }

    const events = await response.json();
    
    // Extract player props from events
    const projections: PlayerProjection[] = [];
    
    for (const event of events) {
      if (!event.bookmakers || event.bookmakers.length === 0) continue;
      
      for (const bookmaker of event.bookmakers) {
        if (!bookmaker.markets) continue;
        
        for (const market of bookmaker.markets) {
          if (!market.outcomes) continue;
          
          for (const outcome of market.outcomes) {
            // Check if this outcome is for our player
            const outcomeName = outcome.description || outcome.name || '';
            if (outcomeName.toLowerCase().includes(playerName.toLowerCase())) {
              // Extract team from event
              const teams = [event.home_team, event.away_team];
              const playerTeam = teams.find(team => 
                outcomeName.toLowerCase().includes(team.toLowerCase())
              ) || 'Unknown';
              
              projections.push({
                player: outcome.description || playerName,
                team: playerTeam,
                position: '', // Not provided by odds API
                statType: market.key.replace('batter_', '').replace(/_/g, ' '),
                projection: outcome.point || 0,
                overOdds: outcome.price,
                underOdds: market.outcomes.find((o: any) => 
                  o.name === 'Under' && o.description === outcome.description
                )?.price,
                line: outcome.point,
                bookmaker: bookmaker.title,
                lastUpdate: market.last_update || event.commence_time
              });
            }
          }
        }
      }
    }

    if (projections.length === 0) {
      console.log(`${LOG_PREFIXES.API} No player props found for ${playerName}`);
      return {
        success: false,
        player: playerName,
        error: `No active prop bets found for ${playerName}. Player may not be in today's games or name spelling differs.`,
        source: 'api',
        timestamp
      };
    }

    console.log(`${LOG_PREFIXES.API} Found ${projections.length} player props for ${playerName}`);
    
    return {
      success: true,
      player: playerName,
      projections,
      source: 'api',
      timestamp
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`${LOG_PREFIXES.API} Error fetching player projections:`, errorMessage);
    
    return {
      success: false,
      error: `Failed to fetch projections: ${errorMessage}`,
      source: 'fallback',
      timestamp
    };
  }
}

/**
 * Format player projections into a readable summary
 */
export function formatProjectionSummary(response: PlayerProjectionsResponse): string {
  if (!response.success || !response.projections || response.projections.length === 0) {
    return response.error || 'No projections available';
  }

  const { player, projections } = response;
  
  // Group by stat type
  const statGroups: Record<string, PlayerProjection[]> = {};
  for (const proj of projections) {
    if (!statGroups[proj.statType]) {
      statGroups[proj.statType] = [];
    }
    statGroups[proj.statType].push(proj);
  }

  // Build summary
  const lines: string[] = [];
  lines.push(`${player} (${projections[0].team}):`);
  
  for (const [statType, props] of Object.entries(statGroups)) {
    // Use consensus (average) if multiple bookmakers
    const avgLine = props.reduce((sum, p) => sum + (p.line || 0), 0) / props.length;
    const bookmakerCount = props.length;
    
    lines.push(`  • ${statType}: ${avgLine.toFixed(1)} (${bookmakerCount} book${bookmakerCount > 1 ? 's' : ''})`);
  }
  
  lines.push(`\nData from The Odds API • ${projections[0].bookmaker} and others`);
  
  return lines.join('\n');
}

/**
 * Calculate derived stats from projections (for comprehensive player analysis)
 */
export function calculateDerivedStats(projections: PlayerProjection[]) {
  const stats: Record<string, number> = {};
  
  for (const proj of projections) {
    stats[proj.statType] = proj.projection;
  }
  
  // Calculate derived metrics if base stats are available
  const derived: any = { ...stats };
  
  // Estimate batting average if we have hits and at-bats info
  // This would require additional data not in player props
  
  return derived;
}
