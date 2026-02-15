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
 * Generate sport-specific cards with REAL odds data
 */
async function generateSportSpecificCards(
  sport: string,
  count: number,
  category?: string
): Promise<InsightCard[]> {
  console.log(`[v0] [SPORT CARDS FUNCTION] === CALLED === sport=${sport} count=${count} category=${category}`);
  
  const cards: InsightCard[] = [];
  const displaySport = apiToSport(sport).toUpperCase();
  console.log(`[v0] [SPORT CARDS] Display sport: ${displaySport}`);
  
  // Fetch real live odds for this sport
  if (category === 'betting' || !category) {
    console.log(`[v0] [CARDS GENERATOR] Betting category detected, attempting to fetch real odds`);
    try {
      console.log(`[v0] [CARDS GENERATOR] Importing odds-api-client...`);
      const { fetchLiveOdds } = await import('@/lib/odds-api-client');
      const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
      
      console.log(`[v0] [CARDS GENERATOR] API Key available: ${!!apiKey}`);
      
      if (apiKey) {
        console.log(`[v0] [CARDS GENERATOR] Calling fetchLiveOdds for ${displaySport}...`);
        const oddsData = await fetchLiveOdds(sport, {
          markets: ['h2h', 'spreads', 'totals'], // Fetch ALL available markets
          regions: ['us'],
          oddsFormat: 'american',
          apiKey,
          skipCache: true // Force fresh data to get all markets
        });
        
        console.log(`[v0] [CARDS GENERATOR] fetchLiveOdds returned:`, {
          isArray: Array.isArray(oddsData),
          length: oddsData?.length || 0,
          hasData: !!(oddsData && oddsData.length > 0)
        });
        
        if (oddsData && oddsData.length > 0) {
          console.log(`[v0] [CARDS GENERATOR] SUCCESS: Found ${oddsData.length} live games for ${displaySport}`);
          
          // Create cards from actual live games
          const gamesToShow = Math.min(count, oddsData.length);
          for (let i = 0; i < gamesToShow; i++) {
            const game = oddsData[i];
            const firstBook = game.bookmakers?.[0];
            
            // Extract h2h, spreads, and totals
            const h2hMarket = firstBook?.markets?.find((m: any) => m.key === 'h2h');
            const spreadsMarket = firstBook?.markets?.find((m: any) => m.key === 'spreads');
            const totalsMarket = firstBook?.markets?.find((m: any) => m.key === 'totals');
            
            const h2hOutcomes = h2hMarket?.outcomes || [];
            const homeOdds = h2hOutcomes.find((o: any) => o.name === game.home_team);
            const awayOdds = h2hOutcomes.find((o: any) => o.name === game.away_team);
            
            const spreadOutcomes = spreadsMarket?.outcomes || [];
            const homeSpread = spreadOutcomes.find((o: any) => o.name === game.home_team);
            const awaySpread = spreadOutcomes.find((o: any) => o.name === game.away_team);
            
            const totalOutcomes = totalsMarket?.outcomes || [];
            const over = totalOutcomes.find((o: any) => o.name === 'Over');
            const under = totalOutcomes.find((o: any) => o.name === 'Under');
            
            cards.push({
              type: CARD_TYPES.LIVE_ODDS,
              title: `${game.away_team} @ ${game.home_team}`,
              icon: 'TrendingUp',
              category: displaySport,
              subcategory: 'Full Market Analysis',
              gradient: getSportGradient(sport),
              data: {
                matchup: `${game.away_team} @ ${game.home_team}`,
                gameTime: new Date(game.commence_time).toLocaleString(),
                // Moneyline
                homeOdds: homeOdds ? (homeOdds.price > 0 ? `+${homeOdds.price}` : `${homeOdds.price}`) : 'N/A',
                awayOdds: awayOdds ? (awayOdds.price > 0 ? `+${awayOdds.price}` : `${awayOdds.price}`) : 'N/A',
                // Spreads
                homeSpread: homeSpread ? `${homeSpread.point > 0 ? '+' : ''}${homeSpread.point} (${homeSpread.price > 0 ? '+' : ''}${homeSpread.price})` : 'N/A',
                awaySpread: awaySpread ? `${awaySpread.point > 0 ? '+' : ''}${awaySpread.point} (${awaySpread.price > 0 ? '+' : ''}${awaySpread.price})` : 'N/A',
                // Totals
                overUnder: over && under ? `O/U ${over.point}: Over ${over.price > 0 ? '+' : ''}${over.price} / Under ${under.price > 0 ? '+' : ''}${under.price}` : 'N/A',
                bookmaker: firstBook?.title || 'Multiple Books',
                bookmakerCount: game.bookmakers?.length || 0,
                realData: true,
                status: 'VALUE',
                allMarkets: {
                  h2h: h2hMarket ? true : false,
                  spreads: spreadsMarket ? true : false,
                  totals: totalsMarket ? true : false
                }
              },
              metadata: {
                realData: true,
                dataSource: 'The Odds API',
                timestamp: new Date().toISOString(),
                gameId: game.id
              }
            });
          }
          
          console.log('[v0] [CARDS GENERATOR] Created', cards.length, 'cards with real odds data');
          return cards;
        } else {
          console.log('[v0] [CARDS GENERATOR] No live games found for', displaySport);
        }
      } else {
        console.log('[v0] [CARDS GENERATOR] No Odds API key configured');
      }
    } catch (error) {
      console.error('[v0] [CARDS GENERATOR] Failed to fetch live odds for', displaySport, error);
    }
  }
  
  // Fallback: Add general odds card if no real data
  if (cards.length < count) {
    cards.push({
      type: CARD_TYPES.LIVE_ODDS,
      title: `${displaySport} Live Odds`,
      icon: 'TrendingUp',
      category: displaySport,
      subcategory: 'H2H Markets',
      gradient: getSportGradient(sport),
      data: {
        description: `No live ${displaySport} games currently available`,
        note: 'Games typically appear 24-48 hours before start time',
        sport: sport,
        markets: ['Moneyline', 'Spreads', 'Totals'],
        status: 'NO_DATA'
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
  
  // If multiSport requested, generate variety from multiple sports with REAL data
  if (multiSport) {
    console.log('[v0] [CARDS GENERATOR] Multi-sport mode - fetching real odds from all sports');
    
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
    
    // Try each sport until we have enough cards with real data
    for (const sportKey of orderedSports) {
      if (cards.length >= count) break;
      
      const cardsNeeded = count - cards.length;
      console.log(`[v0] [MULTI-SPORT] Requesting 3 cards from ${apiToSport(sportKey).toUpperCase()}`);
      const sportCards = await generateSportSpecificCards(sportKey, 3, category); // Request 3 cards per sport
      console.log(`[v0] [MULTI-SPORT] Received ${sportCards.length} cards from ${apiToSport(sportKey).toUpperCase()}`);
      
      // Use ALL returned cards - they should already be properly structured
      if (sportCards.length > 0) {
        const cardsToAdd = sportCards.slice(0, cardsNeeded);
        cards.push(...cardsToAdd);
        console.log(`[v0] [MULTI-SPORT] Added ${cardsToAdd.length} cards for ${apiToSport(sportKey).toUpperCase()}`);
        
        // Log first card details for verification
        if (cardsToAdd[0]) {
          console.log(`[v0] [MULTI-SPORT] First card:`, {
            title: cardsToAdd[0].title,
            category: cardsToAdd[0].category,
            hasData: !!cardsToAdd[0].data
          });
        }
      } else {
        console.log(`[v0] [MULTI-SPORT] No cards returned for ${apiToSport(sportKey).toUpperCase()}`);
      }
    }
    
    // If we still don't have enough cards, add placeholder cards
    while (cards.length < count) {
      const remainingSports = allSports.filter(s => !cards.some(c => c.data?.sport === s));
      const sportToUse = remainingSports[0] || SPORT_KEYS.NBA.API;
      const displaySport = apiToSport(sportToUse).toUpperCase();
      
      cards.push({
        type: CARD_TYPES.LIVE_ODDS,
        title: `${displaySport} Live Odds`,
        icon: 'TrendingUp',
        category: displaySport,
        subcategory: 'H2H Markets',
        gradient: getSportGradient(sportToUse),
        data: {
          description: `No live ${displaySport} games scheduled`,
          note: 'Check back 24-48 hours before game time',
          sport: sportToUse,
          status: 'NO_DATA'
        }
      });
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
      
      console.log('[v0] [CARDS GENERATOR] Arbitrage cards returned:', {
        isArray: Array.isArray(arbitrageCards),
        length: arbitrageCards?.length || 0,
        firstCard: arbitrageCards?.[0]?.title || 'none'
      });
      
      if (arbitrageCards && arbitrageCards.length > 0) {
        console.log('[v0] [CARDS GENERATOR] Adding', arbitrageCards.length, 'cards (arbitrage or live odds)');
        cards.push(...arbitrageCards.slice(0, 3)); // Add up to 3 cards (arbitrage or live odds)
      } else {
        console.log('[v0] [CARDS GENERATOR] No cards returned, using placeholder');
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
