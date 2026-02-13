/**
 * Cards Generator Utility
 * Generates contextual insight cards for betting analysis
 * Separated from route file for safe importing
 */

import { CARD_TYPES } from '@/lib/constants';

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
 * @param sport - Sport key (basketball_nba, americanfootball_nfl, etc.)
 * @param count - Number of cards to generate (default: 3)
 */
export function generateContextualCards(
  category?: string,
  sport?: string,
  count: number = 3
): InsightCard[] {
  const cards: InsightCard[] = [];

  console.log('[v0] [CARDS GENERATOR] Generating cards...');
  console.log('[v0] [CARDS GENERATOR] Category:', category, '| Sport:', sport, '| Count:', count);

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
    const sportName = sport ? sport.replace('_', ' ').toUpperCase() : 'MULTI-SPORT';
    cards.push({
      type: CARD_TYPES.LIVE_ODDS,
      title: `📈 ${sportName} Odds Analysis`,
      icon: 'LineChart',
      category: sportName,
      subcategory: 'Live Odds',
      gradient: 'from-slate-600 to-gray-700',
      data: {
        description: 'Real-time odds and line movements',
        note: 'Connect to The Odds API for live data'
      }
    });
  }

  console.log('[v0] [CARDS GENERATOR] ✓ Generated', cards.length, 'cards');
  console.log('[v0] [CARDS GENERATOR] Card titles:', cards.map(c => c.title).join(', '));

  return cards.slice(0, count);
}
