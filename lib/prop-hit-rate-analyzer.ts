/**
 * Player Prop Hit Rate Analyzer
 * Analyzes historical player prop outcomes to calculate hit rates and trends
 * @module lib/prop-hit-rate-analyzer
 */

import { createClient } from '@/lib/supabase/server';

export interface PropHitRateData {
  playerName: string;
  sport: string;
  statType: string;
  totalProps: number;
  hits: number;
  misses: number;
  hitRatePercentage: number;
  avgLine: number;
  avgActual: number;
  avgDifferential: number;
  lastGameDate: string;
  last30DaysCount: number;
  hitRateLast30Days: number;
}

export interface PropHistoryEntry {
  id: string;
  playerName: string;
  sport: string;
  statType: string;
  propLine: number;
  actualResult: number | null;
  gameDate: string;
  opponent: string | null;
  hit: boolean | null;
  gameCompleted: boolean;
  overOdds: number | null;
  underOdds: number | null;
}

export interface PropAnalysis {
  success: boolean;
  playerName: string;
  statType: string;
  hitRate: PropHitRateData | null;
  recentGames: PropHistoryEntry[];
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
  error?: string;
}

/**
 * Fetches hit rate statistics for a player and stat type
 */
export async function getPlayerHitRate(
  playerName: string,
  statType: string
): Promise<PropHitRateData | null> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('player_prop_hit_rate_stats')
      .select('*')
      .eq('player_name', playerName)
      .eq('stat_type', statType)
      .single();
    
    if (error || !data) {
      console.log('[PROP ANALYZER] No hit rate data found:', error?.message);
      return null;
    }
    
    return {
      playerName: data.player_name,
      sport: data.sport,
      statType: data.stat_type,
      totalProps: data.total_props,
      hits: data.hits,
      misses: data.misses,
      hitRatePercentage: data.hit_rate_percentage || 0,
      avgLine: data.avg_line || 0,
      avgActual: data.avg_actual || 0,
      avgDifferential: data.avg_differential || 0,
      lastGameDate: data.last_game_date,
      last30DaysCount: data.last_30_days_count || 0,
      hitRateLast30Days: data.hit_rate_last_30_days || 0
    };
  } catch (error) {
    console.error('[PROP ANALYZER] Error fetching hit rate:', error);
    return null;
  }
}

/**
 * Fetches recent prop history for a player
 */
export async function getRecentPropHistory(
  playerName: string,
  statType: string,
  limit: number = 10
): Promise<PropHistoryEntry[]> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('player_prop_history')
      .select('*')
      .eq('player_name', playerName)
      .eq('stat_type', statType)
      .order('game_date', { ascending: false })
      .limit(limit);
    
    if (error || !data) {
      console.log('[PROP ANALYZER] No history found:', error?.message);
      return [];
    }
    
    return data.map(row => ({
      id: row.id,
      playerName: row.player_name,
      sport: row.sport,
      statType: row.stat_type,
      propLine: row.prop_line,
      actualResult: row.actual_result,
      gameDate: row.game_date,
      opponent: row.opponent,
      hit: row.hit,
      gameCompleted: row.game_completed,
      overOdds: row.over_odds,
      underOdds: row.under_odds
    }));
  } catch (error) {
    console.error('[PROP ANALYZER] Error fetching history:', error);
    return [];
  }
}

/**
 * Analyzes trend in hit rate over time
 */
function analyzeTrend(
  recentGames: PropHistoryEntry[]
): 'improving' | 'declining' | 'stable' | 'insufficient_data' {
  const completedGames = recentGames.filter(g => g.hit !== null);
  
  if (completedGames.length < 5) {
    return 'insufficient_data';
  }
  
  // Split into first half and second half
  const midpoint = Math.floor(completedGames.length / 2);
  const firstHalf = completedGames.slice(midpoint);
  const secondHalf = completedGames.slice(0, midpoint);
  
  const firstHalfHitRate = 
    firstHalf.filter(g => g.hit).length / firstHalf.length;
  const secondHalfHitRate = 
    secondHalf.filter(g => g.hit).length / secondHalf.length;
  
  const difference = secondHalfHitRate - firstHalfHitRate;
  
  if (difference > 0.15) return 'improving';
  if (difference < -0.15) return 'declining';
  return 'stable';
}

/**
 * Calculates confidence level based on sample size
 */
function calculateConfidence(totalProps: number): 'high' | 'medium' | 'low' {
  if (totalProps >= 30) return 'high';
  if (totalProps >= 15) return 'medium';
  return 'low';
}

/**
 * Generates recommendation based on analysis
 */
function generateRecommendation(
  hitRate: PropHitRateData,
  trend: string,
  confidence: string
): string {
  const { hitRatePercentage, avgDifferential, last30DaysCount } = hitRate;
  
  if (confidence === 'low') {
    return `Limited data (${hitRate.totalProps} games). Monitor for more history before betting.`;
  }
  
  if (hitRatePercentage >= 65) {
    if (trend === 'improving') {
      return `Strong over trend (${hitRatePercentage.toFixed(1)}%) and improving. Consider OVER bets.`;
    }
    return `Consistent over performer (${hitRatePercentage.toFixed(1)}%). OVER has value.`;
  }
  
  if (hitRatePercentage <= 35) {
    if (trend === 'improving') {
      return `Under trend (${hitRatePercentage.toFixed(1)}%) but showing improvement. Wait for confirmation.`;
    }
    return `Strong under trend (${(100 - hitRatePercentage).toFixed(1)}%). Consider UNDER bets.`;
  }
  
  if (Math.abs(avgDifferential) < 0.5) {
    return `Line tracking closely (${hitRatePercentage.toFixed(1)}% hit rate). Market efficient, look for value elsewhere.`;
  }
  
  if (last30DaysCount < 5) {
    return `Recent activity low. Check if player is active/healthy before betting.`;
  }
  
  return `Moderate hit rate (${hitRatePercentage.toFixed(1)}%). Consider matchup and recent form.`;
}

/**
 * Performs complete prop analysis for a player
 */
export async function analyzePlayerProp(
  playerName: string,
  statType: string
): Promise<PropAnalysis> {
  try {
    console.log(`[PROP ANALYZER] Analyzing ${playerName} - ${statType}`);
    
    // Fetch hit rate stats and recent history
    const [hitRate, recentGames] = await Promise.all([
      getPlayerHitRate(playerName, statType),
      getRecentPropHistory(playerName, statType, 20)
    ]);
    
    if (!hitRate) {
      return {
        success: false,
        playerName,
        statType,
        hitRate: null,
        recentGames: [],
        trend: 'insufficient_data',
        confidence: 'low',
        recommendation: `No historical data found for ${playerName} ${statType} props. This may be a new market or player name mismatch.`,
        error: 'No data available'
      };
    }
    
    // Analyze trend and confidence
    const trend = analyzeTrend(recentGames);
    const confidence = calculateConfidence(hitRate.totalProps);
    const recommendation = generateRecommendation(hitRate, trend, confidence);
    
    console.log(`[PROP ANALYZER] Analysis complete: ${hitRate.hitRatePercentage.toFixed(1)}% hit rate, ${trend} trend, ${confidence} confidence`);
    
    return {
      success: true,
      playerName,
      statType,
      hitRate,
      recentGames: recentGames.slice(0, 10),
      trend,
      confidence,
      recommendation
    };
  } catch (error) {
    console.error('[PROP ANALYZER] Analysis error:', error);
    return {
      success: false,
      playerName,
      statType,
      hitRate: null,
      recentGames: [],
      trend: 'insufficient_data',
      confidence: 'low',
      recommendation: 'Analysis failed due to system error',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Formats hit rate analysis as readable text
 */
export function formatHitRateAnalysis(analysis: PropAnalysis): string {
  if (!analysis.success || !analysis.hitRate) {
    return `❌ ${analysis.recommendation}`;
  }
  
  const { hitRate, trend, confidence, recommendation, recentGames } = analysis;
  const recentHits = recentGames.filter(g => g.hit).length;
  const recentTotal = recentGames.filter(g => g.hit !== null).length;
  
  const lines = [
    `📊 ${hitRate.playerName} - ${hitRate.statType.toUpperCase()}`,
    ``,
    `Hit Rate: ${hitRate.hitRatePercentage.toFixed(1)}% (${hitRate.hits}/${hitRate.totalProps} games)`,
    `Avg Line: ${hitRate.avgLine.toFixed(1)} | Avg Actual: ${hitRate.avgActual.toFixed(1)}`,
    `Differential: ${hitRate.avgDifferential >= 0 ? '+' : ''}${hitRate.avgDifferential.toFixed(1)}`,
    ``,
    `Recent Form (Last ${recentTotal} games): ${recentHits}/${recentTotal} hits`,
    `Trend: ${trend.toUpperCase()} | Confidence: ${confidence.toUpperCase()}`,
    `Last 30 Days: ${hitRate.last30DaysCount} games, ${hitRate.hitRateLast30Days.toFixed(1)}% hit rate`,
    ``,
    `💡 Recommendation: ${recommendation}`
  ];
  
  return lines.join('\n');
}

/**
 * Batch analyze multiple players/stats
 */
export async function batchAnalyze(
  requests: Array<{ playerName: string; statType: string }>
): Promise<PropAnalysis[]> {
  const analyses = await Promise.all(
    requests.map(({ playerName, statType }) => 
      analyzePlayerProp(playerName, statType)
    )
  );
  
  return analyses;
}
