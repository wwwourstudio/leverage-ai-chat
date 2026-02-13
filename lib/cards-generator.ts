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

/**
 * Generate sport-specific cards
 */
async function generateSportSpecificCards(
  sport: string,
  count: number,
  category?: string
): Promise<InsightCard[]> {
  const cards: InsightCard[] = [];
  const displaySport = apiToSport(sport).toUpperCase();
  
  // Try arbitrage detection for this sport
  if (category === 'betting' || !category) {
    try {
      const { detectArbitrageFromContext } = await import('@/lib/arbitrage-detector');
      const arbitrageCards = await detectArbitrageFromContext(sport);
      
      if (arbitrageCards && arbitrageCards.length > 0) {
        cards.push(...arbitrageCards.slice(0, 1));
      }
    } catch (error) {
      console.error('[v0] [CARDS GENERATOR] Arbitrage detection failed for', sport);
    }
  }
  
  // Add general odds card for this sport
  if (cards.length < count) {
    cards.push({
      type: CARD_TYPES.LIVE_ODDS,
      title: `${displaySport} Live Odds`,
      icon: 'TrendingUp',
      category: displaySport,
      subcategory: 'H2H Markets',
      gradient: getSportGradient(sport),
      data: {
        description: 'Real-time odds from multiple sportsbooks',
        sport: sport,
        markets: ['Moneyline', 'Spreads', 'Totals']
      }
    });
  }
  
  return cards;
}

/**
 * Get gradient colors by sport
 */
function getSportGradient(sport: string): string {
  if (sport.includes('basketball')) return 'from-orange-600 to-red-700';
  if (sport.includes('football')) return 'from-green-600 to-emerald-700';
  if (sport.includes('hockey')) return 'from-blue-600 to-cyan-700';
  if (sport.includes('baseball')) return 'from-indigo-600 to-purple-700';
  return 'from-slate-600 to-gray-700';
}

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
 * @param multiSport - If true, generates cards from multiple sports (default: false)
 */
export async function generateContextualCards(
  category?: string,
  sport?: string,
  count: number = 3,
  multiSport: boolean = false
): Promise<InsightCard[]> {
  const cards: InsightCard[] = [];

  // Normalize sport to API format, then get display name
  const normalizedSport = sport ? sportToApi(sport) : undefined;
  const displaySport = normalizedSport ? apiToSport(normalizedSport).toUpperCase() : 'MULTI-SPORT';

  console.log('[v0] [CARDS GENERATOR] Generating cards...');
  console.log('[v0] [CARDS GENERATOR] Input:', { category, sport, normalizedSport, displaySport, multiSport });
  console.log('[v0] [CARDS GENERATOR] Category:', category, '| Display Sport:', displaySport, '| Count:', count);
  
  // If multiSport requested, generate variety from multiple sports
  if (multiSport) {
    console.log('[v0] [CARDS GENERATOR] Multi-sport mode - generating diverse cards');
    
    // Prioritize sport from query if provided, otherwise use popular sports
    const primarySport = normalizedSport || SPORT_KEYS.NBA.API;
    const allSports = [
      SPORT_KEYS.NBA.API, 
      SPORT_KEYS.NFL.API, 
      SPORT_KEYS.NHL.API,
      SPORT_KEYS.MLB.API
    ];
    
    // Reorder to put primary sport first
    const orderedSports = [
      primarySport,
      ...allSports.filter(s => s !== primarySport)
    ].slice(0, 3); // Top 3 sports
    
    console.log('[v0] [CARDS GENERATOR] Sport priority order:', orderedSports.map(s => apiToSport(s).toUpperCase()));
    
    // Generate more cards for primary sport (40% of total)
    const primaryCount = Math.ceil(count * 0.4);
    const secondaryCount = Math.floor((count - primaryCount) / 2);
    const remainingCount = count - primaryCount - (secondaryCount * 2);
    
    const sportCounts = [primaryCount, secondaryCount + remainingCount, secondaryCount];
    
    for (let i = 0; i < orderedSports.length && cards.length < count; i++) {
      const sportKey = orderedSports[i];
      const cardsToGenerate = sportCounts[i] || 1;
      
      const sportCards = await generateSportSpecificCards(sportKey, cardsToGenerate, category);
      cards.push(...sportCards);
      console.log('[v0] [CARDS GENERATOR] Added', sportCards.length, 'cards for', apiToSport(sportKey).toUpperCase());
    }
    
    return cards.slice(0, count);
  }

  // Betting/Arbitrage cards (default)
  if (category === 'betting' || !category) {
    // Try to detect real arbitrage opportunities
    console.log('[v0] [CARDS GENERATOR] Checking for arbitrage opportunities');
    try {
      const { detectArbitrageFromContext } = await import('@/lib/arbitrage-detector');
      const arbitrageCards = await detectArbitrageFromContext(normalizedSport);
      
      if (arbitrageCards && arbitrageCards.length > 0) {
        console.log('[v0] [CARDS GENERATOR] Found', arbitrageCards.length, 'arbitrage opportunities');
        cards.push(...arbitrageCards.slice(0, 2)); // Add up to 2 arbitrage cards
      } else {
        // Fallback placeholder card
        cards.push({
          type: CARD_TYPES.LIVE_ODDS,
          title: 'Cross-Platform Arbitrage',
          icon: 'TrendingUp',
          category: 'BETTING',
          subcategory: 'Arbitrage Scanner',
          gradient: 'from-emerald-600 to-teal-700',
          data: {
            description: 'Scanning for guaranteed profit opportunities across sportsbooks',
            note: 'No arbitrage opportunities currently available',
            markets: ['Moneyline', 'Spreads', 'Totals']
          }
        });
      }
    } catch (error) {
      console.error('[v0] [CARDS GENERATOR] Arbitrage detection failed:', error);
      // Fallback placeholder card
      cards.push({
        type: CARD_TYPES.LIVE_ODDS,
        title: 'Cross-Platform Arbitrage',
        icon: 'TrendingUp',
        category: 'BETTING',
        subcategory: 'Arbitrage Scanner',
        gradient: 'from-emerald-600 to-teal-700',
        data: {
          description: 'Find guaranteed profit opportunities across sportsbooks',
          note: 'Arbitrage detection temporarily unavailable'
        }
      });
    }
  }

  // Kalshi/Prediction Markets - Fetch real market data
  if (category === 'kalshi') {
    console.log('[v0] [CARDS GENERATOR] Kalshi category detected, fetching live markets');
    try {
      const { enrichCardsWithKalshi } = await import('@/lib/kalshi-api-client');
      const enrichedCards = await enrichCardsWithKalshi(cards, 'sports');
      console.log('[v0] [CARDS GENERATOR] Kalshi enrichment complete:', enrichedCards.length - cards.length, 'markets added');
      return enrichedCards;
    } catch (error) {
      console.error('[v0] [CARDS GENERATOR] Kalshi enrichment failed:', error);
      // Fallback to placeholder card
      cards.push({
        type: 'PREDICTION_MARKET',
        title: 'Prediction Markets',
        icon: 'BarChart',
        category: 'KALSHI',
        subcategory: 'Live Markets',
        gradient: 'from-purple-600 to-indigo-700',
        data: {
          description: 'Real-time prediction market probabilities',
          note: 'Live data temporarily unavailable',
          marketType: 'Binary Outcome'
        }
      });
    }
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
