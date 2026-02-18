/**
 * Line Movement Tracking System
 * Monitors odds changes to detect sharp money and market sentiment
 */

import { createClient } from '@/lib/supabase/client';

// Module-level guard: once we detect the table is missing, stop retrying
let tableAvailable: boolean | null = null;
let tableMissingLogged = false;

function handleTableMissing(context: string, error: unknown): void {
  if (!tableMissingLogged) {
    const errObj = error as Record<string, string> | null;
    console.warn(`[LINE-TRACKER] Table 'line_movement' does not exist. ${context} will be skipped until the table is created. Error: ${errObj?.code || errObj?.message || 'unknown'}`);
    tableMissingLogged = true;
  }
  tableAvailable = false;
}

function isTableMissingError(error: unknown): boolean {
  const errObj = error as Record<string, string> | null;
  return errObj?.code === 'PGRST205' || errObj?.code === '42P01' || (errObj?.message?.includes('line_movement') ?? false);
}

export interface LineSnapshot {
  id: string;
  gameId: string;
  sport: string;
  marketType: string; // 'h2h', 'spreads', 'totals'
  team: string;
  line?: number; // For spreads/totals
  odds: number;
  bookmaker: string;
  timestamp: string;
}

export interface LineMovement {
  gameId: string;
  sport: string;
  marketType: string;
  team: string;
  openingLine: number;
  currentLine: number;
  openingOdds: number;
  currentOdds: number;
  movement: number; // Percentage change
  direction: 'up' | 'down' | 'stable';
  movementType: 'steam' | 'reverse' | 'normal';
  bookmaker: string;
  firstSeen: string;
  lastUpdated: string;
}

/**
 * Track line movement by storing historical snapshots
 */
export async function trackLineSnapshot(snapshot: Omit<LineSnapshot, 'id' | 'timestamp'>): Promise<void> {
  if (tableAvailable === false) return;
  
  const supabase = createClient();
  
  try {
    const { error } = await supabase
      .from('line_movement')
      .insert({
        game_id: snapshot.gameId,
        sport: snapshot.sport,
        market_type: snapshot.marketType,
        team: snapshot.team,
        line: snapshot.line,
        odds: snapshot.odds,
        bookmaker: snapshot.bookmaker,
        timestamp: new Date().toISOString(),
      });
    
    if (error) {
      if (isTableMissingError(error)) {
        handleTableMissing('trackLineSnapshot', error);
        return;
      }
      console.error('[LINE-TRACKER] Failed to store snapshot:', error.message);
    } else {
      tableAvailable = true;
    }
  } catch (error) {
    console.error('[LINE-TRACKER] Storage exception:', error);
  }
}

/**
 * Analyze line movement for a specific game
 */
export async function analyzeLineMovement(gameId: string, marketType: string = 'h2h'): Promise<LineMovement[]> {
  if (tableAvailable === false) return [];
  
  const supabase = createClient();
  
  try {
    // Get all snapshots for this game and market
    const { data: snapshots, error } = await supabase
      .from('line_movement')
      .select('*')
      .eq('game_id', gameId)
      .eq('market_type', marketType)
      .order('timestamp', { ascending: true });
    
    if (error) {
      if (isTableMissingError(error)) {
        handleTableMissing('analyzeLineMovement', error);
      }
      return [];
    }
    
    if (!snapshots || snapshots.length === 0) {
      return [];
    }
    
    // Group by team/bookmaker
    const movements: Record<string, LineMovement> = {};
    
    for (const snapshot of snapshots) {
      const key = `${snapshot.team}-${snapshot.bookmaker}`;
      
      if (!movements[key]) {
        movements[key] = {
          gameId: snapshot.game_id,
          sport: snapshot.sport,
          marketType: snapshot.market_type,
          team: snapshot.team,
          openingLine: snapshot.line || 0,
          currentLine: snapshot.line || 0,
          openingOdds: snapshot.odds,
          currentOdds: snapshot.odds,
          movement: 0,
          direction: 'stable',
          movementType: 'normal',
          bookmaker: snapshot.bookmaker,
          firstSeen: snapshot.timestamp,
          lastUpdated: snapshot.timestamp,
        };
      } else {
        // Update current values
        movements[key].currentLine = snapshot.line || movements[key].currentLine;
        movements[key].currentOdds = snapshot.odds;
        movements[key].lastUpdated = snapshot.timestamp;
        
        // Calculate movement
        const oddsChange = snapshot.odds - movements[key].openingOdds;
        movements[key].movement = (oddsChange / Math.abs(movements[key].openingOdds)) * 100;
        
        // Determine direction
        if (oddsChange > 5) {
          movements[key].direction = 'up';
        } else if (oddsChange < -5) {
          movements[key].direction = 'down';
        }
        
        // Detect movement type
        const changeSpeed = oddsChange / (new Date(snapshot.timestamp).getTime() - new Date(movements[key].firstSeen).getTime());
        if (Math.abs(oddsChange) > 20 && changeSpeed > 0.001) {
          movements[key].movementType = 'steam'; // Rapid movement
        } else if (oddsChange > 0 && movements[key].movement < 0) {
          movements[key].movementType = 'reverse'; // Reverse line movement
        }
      }
    }
    
    return Object.values(movements);
  } catch (error) {
    console.error('[LINE-TRACKER] Analysis error:', error);
    return [];
  }
}

/**
 * Detect sharp money indicators
 */
export async function detectSharpMoney(sport: string, lookbackHours: number = 24): Promise<LineMovement[]> {
  if (tableAvailable === false) return [];
  
  const supabase = createClient();
  
  try {
    const cutoffTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
    
    const { data: recentGames, error } = await supabase
      .from('line_movement')
      .select('game_id')
      .eq('sport', sport)
      .gte('timestamp', cutoffTime)
      .order('timestamp', { ascending: false });
    
    if (error) {
      if (isTableMissingError(error)) {
        handleTableMissing('detectSharpMoney', error);
      }
      return [];
    }
    
    if (!recentGames) {
      return [];
    }
    
  // Get unique game IDs
  const gameIds = [...new Set(recentGames.map((g: Record<string, unknown>) => String(g.game_id || '')))];
  
  // Analyze each game
  const sharpMovements: LineMovement[] = [];
  
  for (const gameId of gameIds) {
    const movements = await analyzeLineMovement(gameId);
      
      // Filter for sharp indicators
      const sharpIndicators = movements.filter(m => 
        (m.movementType === 'steam' && Math.abs(m.movement) > 10) || // Strong steam
        (m.movementType === 'reverse') || // Reverse line movement
        (Math.abs(m.movement) > 15) // Significant movement
      );
      
      sharpMovements.push(...sharpIndicators);
    }
    
    return sharpMovements;
  } catch (error) {
    console.error('[LINE-TRACKER] Sharp money detection error:', error);
    return [];
  }
}

/**
 * Get line movement summary for display
 */
export function lineMovementToCard(movement: LineMovement): Record<string, unknown> {
  const movementLabel = movement.movementType === 'steam' 
    ? 'STEAM MOVE' 
    : movement.movementType === 'reverse'
    ? 'REVERSE'
    : 'LINE MOVE';
  
  const indicator = movement.movement > 0 ? '↑' : movement.movement < 0 ? '↓' : '→';
  
  return {
    type: 'LINE_MOVEMENT',
    title: `${movement.team} ${movementLabel}`,
    icon: 'TrendingUp',
    category: movement.sport.toUpperCase(),
    subcategory: 'Sharp Money',
    gradient: movement.movementType === 'steam' 
      ? 'from-red-600 to-orange-600'
      : 'from-yellow-600 to-amber-600',
    data: {
      team: movement.team,
      marketType: movement.marketType.toUpperCase(),
      opening: `${movement.openingOdds > 0 ? '+' : ''}${movement.openingOdds}`,
      current: `${movement.currentOdds > 0 ? '+' : ''}${movement.currentOdds}`,
      movement: `${indicator} ${Math.abs(movement.movement).toFixed(1)}%`,
      type: movementLabel,
      direction: movement.direction.toUpperCase(),
      bookmaker: movement.bookmaker,
      firstSeen: new Date(movement.firstSeen).toLocaleString(),
      lastUpdated: new Date(movement.lastUpdated).toLocaleString(),
      realData: true,
    },
    metadata: {
      realData: true,
      dataSource: 'Line Movement Tracker',
      timestamp: new Date().toISOString(),
    },
    status: movement.movementType === 'steam' ? 'ALERT' : 'VALUE',
  };
}

/**
 * Monitor and track odds automatically
 */
export async function monitorOddsChanges(oddsData: Array<Record<string, unknown>>, sport: string): Promise<void> {
  if (tableAvailable === false) return;
  
  console.log(`[LINE-TRACKER] Monitoring ${oddsData.length} games for ${sport}`);
  
  for (const game of oddsData) {
    const bookmakers = (game.bookmakers as Array<Record<string, unknown>>) || [];
    for (const bookmaker of bookmakers) {
      const markets = (bookmaker.markets as Array<Record<string, unknown>>) || [];
      for (const market of markets) {
        const outcomes = (market.outcomes as Array<Record<string, unknown>>) || [];
        for (const outcome of outcomes) {
          await trackLineSnapshot({
            gameId: String(game.id || ''),
            sport,
            marketType: String(market.key || ''),
            team: String(outcome.name || ''),
            line: outcome.point as number | undefined,
            odds: Number(outcome.price || 0),
            bookmaker: String(bookmaker.title || ''),
          });
        }
      }
    }
  }
  
  console.log(`[LINE-TRACKER] Completed odds monitoring for ${sport}`);
}
