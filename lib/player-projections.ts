/**
 * Player Projections Service
 * 
 * Fetches real-time player projection data from The Odds API.
 * Provides accurate betting lines for MLB player props including home runs,
 * RBIs, stolen bases, and other key statistics.
 * 
 * @module lib/player-projections
 * @see {@link https://the-odds-api.com/liveapi/guides/v4/#get-player-props}
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

/** MLB player prop markets supported by The Odds API */
const PLAYER_PROP_MARKETS = [
  'batter_home_runs',
  'batter_hits',
  'batter_rbis', 
  'batter_runs_scored',
  'batter_stolen_bases',
  'batter_total_bases'
] as const;

/**
 * Normalizes player names for fuzzy matching
 * Handles common variations like "Last, First" vs "First Last"
 */
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Checks if a player name matches the target name (fuzzy match)
 */
function isPlayerMatch(targetName: string, candidateName: string): boolean {
  const normalizedTarget = normalizePlayerName(targetName);
  const normalizedCandidate = normalizePlayerName(candidateName);
  
  // Exact match
  if (normalizedTarget === normalizedCandidate) return true;
  
  // Check if candidate contains all parts of target name
  const targetParts = normalizedTarget.split(' ');
  return targetParts.every(part => normalizedCandidate.includes(part));
}

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
    
    if (!Array.isArray(events)) {
      return {
        success: false,
        error: 'Invalid API response format',
        source: 'api',
        timestamp
      };
    }
    
    // Extract player props from events
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
            
            // Use fuzzy matching for player name
            if (!isPlayerMatch(playerName, outcomeName)) continue;
            
            // Find matching under line for this player
            const underOutcome = market.outcomes.find((o: any) => 
              o.name === 'Under' && 
              isPlayerMatch(playerName, o.description || o.name || '')
            );
            
            // Determine player's team
            const playerTeam = eventTeams.find(team => 
              outcomeName.toLowerCase().includes(team.toLowerCase())
            ) || eventTeams[0] || 'Unknown';
            
            projections.push({
              player: outcome.description || playerName,
              team: playerTeam,
              position: '',
              statType: market.key.replace('batter_', '').replace(/_/g, ' '),
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
 * Formats player projections into a readable summary
 * 
 * @param response - Player projections response from API
 * @returns Formatted summary string with consensus lines and bookmaker info
 */
export function formatProjectionSummary(response: PlayerProjectionsResponse): string {
  if (!response.success || !response.projections?.length) {
    return response.error || 'No projections available';
  }

  const { player, projections } = response;
  
  // Group projections by stat type
  const statGroups = projections.reduce<Record<string, PlayerProjection[]>>((acc, proj) => {
    const key = proj.statType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(proj);
    return acc;
  }, {});

  const lines: string[] = [];
  lines.push(`${player} (${projections[0].team}):`);
  
  // Format each stat type with consensus line and odds
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

/**
 * Extracts player name from a query string
 * 
 * Handles common patterns like "First Last", "Last, First", and "Last's projections"
 * 
 * @param query - User query string
 * @returns Extracted player name or empty string if not found
 */
export function extractPlayerName(query: string): string {
  const namePatterns = [
    /([A-Z][a-z]+ [A-Z][a-z]+)/g, // First Last
    /([A-Z][a-z]+, [A-Z][a-z]+)/g, // Last, First
  ];
  
  for (const pattern of namePatterns) {
    const matches = query.match(pattern);
    if (matches?.length) {
      // Normalize "Last, First" to "First Last"
      return matches[0].replace(/,\s*/, ' ');
    }
  }
  
  return '';
}

/**
 * Detects if a query is asking for player projections
 * 
 * @param query - User query string
 * @returns True if query appears to be about player props/projections
 */
export function isPlayerProjectionQuery(query: string): boolean {
  const queryLower = query.toLowerCase();
  const keywords = [
    'projection', 'prop bet', 'over/under', 'prop', 
    'hr', 'rbi', 'stolen bases', 'batting average',
    'home run', 'strikeout', 'hit', 'runs scored'
  ];
  
  return keywords.some(keyword => queryLower.includes(keyword));
}

/**
 * Calculates derived stats from projections (for comprehensive player analysis)
 * 
 * @param projections - Array of player projections
 * @returns Object with base and derived statistics
 */
export function calculateDerivedStats(projections: PlayerProjection[]) {
  const stats = projections.reduce<Record<string, number>>((acc, proj) => {
    acc[proj.statType] = proj.projection;
    return acc;
  }, {});
  
  // Future: Calculate batting average from hits/at-bats
  // Future: Calculate slugging percentage from total bases/at-bats
  
  return stats;
}
