/**
 * Cards Generator Utility
 * Generates contextual insight cards for betting analysis
 * Separated from route file for safe importing
 * 
 * Sport Key Standardization:
 * - Accepts both short form ('nba') and API format ('basketball_nba')
 * - Normalizes to API format internally using SPORT_KEYS
 * - Converts back to display format for user-facing text
 */

import { CARD_TYPES, SPORT_KEYS, sportToApi, apiToSport } from '@/lib/constants';

export interface InsightCard {
  type: string;
  title: string;
  icon: string;
  category: string;
  subcategory: string;
  gradient: string;
  data?: any;
  metadata?: any;
}

/**
 * Generate contextual cards based on category and sport
 * @param category - Type of analysis (betting, kalshi, dfs, fantasy)
 * @param sport - Sport key in either short form ('nba') or API format ('basketball_nba')
 * @param count - Number of cards to generate (default: 3)
 */
export function generateContextualCards(
  category?: string,
  sport?: string,
  count: number = 3
): InsightCard[] {
  const cards: InsightCard[] = [];

  // Normalize sport to API format, then get display name
  const normalizedSport = sport ? sportToApi(sport) : undefined;
  const displaySport = normalizedSport ? apiToSport(normalizedSport).toUpperCase() : 'MULTI-SPORT';

  console.log('[v0] [CARDS GENERATOR] Generating cards...');
  console.log('[v0] [CARDS GENERATOR] Input:', { category, sport, normalizedSport, displaySport });
  console.log('[v0] [CARDS GENERATOR] Category:', category, '| Display Sport:', displaySport, '| Count:', count);

  // Betting/Arbitrage cards (default)
  if (category === 'betting' || !category) {
    cards.push({
      type: CARD_TYPES.LIVE_ODDS,
      title: '🎯 Cross-Platform Arbitrage',
      icon: 'TrendingUp',
      category: 'BETTING',
      subcategory: 'Arbitrage',
      gradient: 'from-emerald-600 to-teal-700',
      data: {
        description: 'Find guaranteed profit opportunities across sportsbooks',
        examples: ['DraftKings +150 vs FanDuel -130', 'Profit margin: 2.3%']
      }
    });
  }

  // Kalshi/Prediction Markets
  if (category === 'kalshi') {
    cards.push({
      type: 'PREDICTION_MARKET',
      title: '📊 Kalshi Market Analysis',
      icon: 'BarChart',
      category: 'KALSHI',
      subcategory: 'Prediction Markets',
      gradient: 'from-purple-600 to-indigo-700',
      data: {
        description: 'Real-time prediction market probabilities',
        markets: ['Election outcomes', 'Economic indicators', 'Sports championships']
      }
    });
  }

  // DFS cards
  if (category === 'dfs') {
    cards.push({
      type: 'DFS_LINEUP',
      title: '👥 Optimal DFS Lineup',
      icon: 'Users',
      category: 'DFS',
      subcategory: 'Daily Fantasy',
      gradient: 'from-orange-600 to-red-700',
      data: {
        description: 'Mathematically optimized lineups for daily fantasy contests',
        platforms: ['DraftKings', 'FanDuel']
      }
    });
  }

  // Fantasy cards
  if (category === 'fantasy') {
    cards.push({
      type: 'FANTASY_ADVICE',
      title: '🏆 Fantasy Insights',
      icon: 'Trophy',
      category: 'FANTASY',
      subcategory: 'Season-Long',
      gradient: 'from-blue-600 to-cyan-700',
      data: {
        description: 'Trade recommendations and waiver wire targets',
        tips: ['Start/sit decisions', 'Rest-of-season projections']
      }
    });
  }

  // Add general sports odds card if we have fewer than requested
  while (cards.length < count) {
    cards.push({
      type: CARD_TYPES.LIVE_ODDS,
      title: `📈 ${displaySport} Odds Analysis`,
      icon: 'LineChart',
      category: displaySport,
      subcategory: 'Live Odds',
      gradient: 'from-slate-600 to-gray-700',
      data: {
        description: 'Real-time odds and line movements',
        sport: normalizedSport,
        note: 'Connect to The Odds API for live data'
      }
    });
  }

  console.log('[v0] [CARDS GENERATOR] ✓ Generated', cards.length, 'cards (before weather enrichment)');
  console.log('[v0] [CARDS GENERATOR] Card titles:', cards.map(c => c.title).join(', '));

  // Add weather cards for outdoor sports if betting category
  if ((category === 'betting' || !category) && normalizedSport) {
    const isOutdoorSport = normalizedSport === 'americanfootball_nfl' || 
                          normalizedSport === 'baseball_mlb';
    
    if (isOutdoorSport) {
      console.log('[v0] [CARDS GENERATOR] Outdoor sport detected, attempting weather enrichment');
      try {
        const { enrichCardsWithWeather } = await import('@/lib/weather-service');
        const enrichedCards = await enrichCardsWithWeather(cards);
        console.log('[v0] [CARDS GENERATOR] Weather enrichment complete:', enrichedCards.length - cards.length, 'weather cards added');
        return enrichedCards.slice(0, count + 1); // Allow 1 extra for weather card
      } catch (error) {
        console.error('[v0] [CARDS GENERATOR] Weather enrichment failed:', error);
        // Fall through to return original cards
      }
    }
  }

  return cards.slice(0, count);
}
