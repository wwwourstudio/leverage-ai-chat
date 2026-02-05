/**
 * Client-side API utilities for secure API calls
 * All API keys are managed server-side via Route Handlers
 */

export interface OddsResponse {
  sport: string;
  marketType: string;
  events: any[];
  timestamp: string;
  remainingRequests?: string;
  usedRequests?: string;
}

export interface AnalysisResponse {
  response: string;
  trustMetrics: {
    benfordIntegrity: number;
    oddsAlignment: number;
    marketConsensus: number;
    historicalAccuracy: number;
    finalConfidence: number;
    trustLevel: 'high' | 'medium' | 'low';
    riskLevel: 'low' | 'medium' | 'high';
    flags?: Array<{
      type: string;
      message: string;
      severity: 'info' | 'warning' | 'error';
    }>;
    adjustedTone?: string;
  };
  model: string;
  processingTime: number;
  timestamp: string;
}

export interface InsightCard {
  type: string;
  title: string;
  icon: any;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, string | number>;
  status: string;
}

/**
 * Fetch odds data from Sports Odds API
 * @param sport - Sport identifier (e.g., 'nfl', 'nba', 'mlb')
 * @param marketType - Market type (e.g., 'h2h', 'spreads', 'totals')
 * @param eventId - Optional specific event ID
 */
export async function fetchOdds(
  sport: string,
  marketType?: string,
  eventId?: string
): Promise<OddsResponse> {
  try {
    const response = await fetch('/api/odds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sport,
        marketType,
        eventId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch odds');
    }

    return await response.json();
  } catch (error: any) {
    console.error('[API Client] Error fetching odds:', error);
    throw error;
  }
}

/**
 * Get AI analysis using Grok
 * @param query - User query/question
 * @param context - Optional context including sport, market type, and odds data
 * @param attachments - Optional file attachments
 */
export async function getAIAnalysis(
  query: string,
  context?: {
    sport?: string;
    marketType?: string;
    oddsData?: any;
  },
  attachments?: Array<{
    type: 'image' | 'csv';
    data: any;
  }>
): Promise<AnalysisResponse> {
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000); // 28 second client timeout
    
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        context,
        attachments,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'AI analysis failed');
    }

    return await response.json();
  } catch (error: any) {
    // Handle timeout errors
    if (error.name === 'AbortError') {
      console.error('[API Client] Request timeout getting AI analysis');
      throw new Error('Analysis request timed out. Please try again with a simpler query.');
    }
    
    console.error('[API Client] Error getting AI analysis:', error);
    throw error;
  }
}

/**
 * Parse AI response to extract insight cards
 * @param response - Raw AI response text
 * @param category - Category to filter cards
 */
export function parseInsightCards(response: string, category?: string): InsightCard[] {
  // This is a placeholder - in production, you'd parse structured data from the AI
  // The AI should be prompted to return JSON-structured insight cards
  const cards: InsightCard[] = [];
  
  // For now, return empty array - cards would be extracted from AI response
  // or requested in a specific format from the AI model
  
  return cards;
}

/**
 * Validate trust metrics and determine if recommendation should be shown
 * @param trustMetrics - Trust metrics from AI response
 * @param minimumConfidence - Minimum confidence threshold (default 60)
 */
export function shouldShowRecommendation(
  trustMetrics: AnalysisResponse['trustMetrics'],
  minimumConfidence: number = 60
): boolean {
  return trustMetrics.finalConfidence >= minimumConfidence;
}

/**
 * Format trust metrics for display
 */
export function formatTrustMetrics(trustMetrics: AnalysisResponse['trustMetrics']) {
  return {
    confidence: `${trustMetrics.finalConfidence}%`,
    level: trustMetrics.trustLevel.toUpperCase(),
    risk: trustMetrics.riskLevel.toUpperCase(),
    tone: trustMetrics.adjustedTone,
    hasWarnings: trustMetrics.flags && trustMetrics.flags.length > 0,
    warnings: trustMetrics.flags || [],
  };
}

/**
 * Cache manager for odds data
 * Prevents excessive API calls by caching recent odds data
 */
class OddsCache {
  private cache: Map<string, { data: OddsResponse; expiry: number }> = new Map();
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  getCacheKey(sport: string, marketType?: string, eventId?: string): string {
    return `${sport}:${marketType || 'default'}:${eventId || 'all'}`;
  }

  get(sport: string, marketType?: string, eventId?: string): OddsResponse | null {
    const key = this.getCacheKey(sport, marketType, eventId);
    const cached = this.cache.get(key);

    if (cached && Date.now() < cached.expiry) {
      console.log('[API Client] Returning cached odds data');
      return cached.data;
    }

    if (cached) {
      this.cache.delete(key);
    }

    return null;
  }

  set(data: OddsResponse, sport: string, marketType?: string, eventId?: string): void {
    const key = this.getCacheKey(sport, marketType, eventId);
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheDuration,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const oddsCache = new OddsCache();

/**
 * Fetch odds with automatic caching
 */
export async function fetchOddsWithCache(
  sport: string,
  marketType?: string,
  eventId?: string
): Promise<OddsResponse> {
  // Check cache first
  const cached = oddsCache.get(sport, marketType, eventId);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchOdds(sport, marketType, eventId);
  
  // Cache for future use
  oddsCache.set(data, sport, marketType, eventId);
  
  return data;
}
