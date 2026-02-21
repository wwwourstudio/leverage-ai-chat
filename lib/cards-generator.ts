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
import { generateNoDataMessage, getSeasonInfo } from '@/lib/seasonal-context';

/**
 * Generate sport-specific cards with REAL odds data
 */
// FORCE REFRESH: 2026-02-15-03:00
async function generateSportSpecificCards(
  sport: string,
  count: number,
  category?: string
): Promise<InsightCard[]> {
  // FORCE MINIMUM 3 CARDS - OVERRIDE ANY COUNT PARAMETER
  const actualCount = Math.max(count, 3);
  console.log(`[v0] [CARDS-GEN] ENTRY: sport=${sport} requestedCount=${count} OVERRIDING TO actualCount=${actualCount}`);
  
  const cards: InsightCard[] = [];
  const displaySport = apiToSport(sport).toUpperCase();
  console.log(`[v0] [SPORT CARDS] Display sport: ${displaySport}`);
  
  // Fetch real live odds for this sport using unified service
  if (category === 'betting' || category === 'all' || !category) {
    console.log(`[v0] [CARDS-GEN] ===== FETCHING ODDS FOR ${displaySport} =====`);
    console.log(`[v0] [CARDS-GEN] Sport key: ${sport}`);
    console.log(`[v0] [CARDS-GEN] Category: ${category || 'default (betting)'}`);
    console.log(`[v0] [CARDS-GEN] Requested count: ${count}, Actual count: ${actualCount}`);
    
    try {
      const { getOddsWithCache } = await import('@/lib/unified-odds-fetcher');
      
      // Check API key availability
      const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
      console.log(`[v0] [CARDS-GEN] API Key present: ${!!apiKey}`);
      
      if (!apiKey) {
        console.error(`[v0] [CARDS-GEN] ❌ CRITICAL: No ODDS_API_KEY found in environment!`);
        throw new Error('ODDS_API_KEY not configured');
      }
      
      // Use unified service - automatically handles API + Supabase caching + storage
      console.log(`[v0] [CARDS-GEN] Calling getOddsWithCache...`);
      const oddsData = await getOddsWithCache(sport, {
        useCache: false, // Skip cache to get fresh data with all markets
        storeResults: true // Store in Supabase for realtime sync
      });
      
      console.log(`[v0] [CARDS-GEN] ✓ Unified service returned ${oddsData?.length || 0} games`);
      console.log(`[v0] [CARDS-GEN] Data is array: ${Array.isArray(oddsData)}`);
      console.log(`[v0] [CARDS-GEN] Data is null/undefined: ${oddsData == null}`);
      
      if (oddsData && oddsData.length > 0) {
        console.log(`[v0] [CARDS-GEN] SUCCESS: Found ${oddsData.length} games for ${displaySport}`);
          
          const gamesToShow = Math.min(actualCount, oddsData.length);
          for (let i = 0; i < gamesToShow; i++) {
            const game = oddsData[i];
            const isCompleted = game.completed === true;
            const hasBookmakers = game.bookmakers && game.bookmakers.length > 0;
            const firstBook = hasBookmakers ? game.bookmakers[0] : null;
            
            // For completed games with scores
            if (isCompleted && game.scores) {
              const homeScore = game.scores?.find((s: any) => s.name === game.home_team);
              const awayScore = game.scores?.find((s: any) => s.name === game.away_team);
              
              cards.push({
                type: CARD_TYPES.LIVE_ODDS,
                title: `${game.away_team} @ ${game.home_team}`,
                icon: 'CheckCircle',
                category: displaySport,
                subcategory: 'Final Score',
                gradient: getSportGradient(sport),
                data: {
                  matchup: `${game.away_team} @ ${game.home_team}`,
                  gameTime: new Date(game.commence_time).toLocaleString(),
                  finalScore: `${game.away_team} ${awayScore?.score || '?'} - ${homeScore?.score || '?'} ${game.home_team}`,
                  homeScore: homeScore?.score || '?',
                  awayScore: awayScore?.score || '?',
                  completed: true,
                  realData: true,
                  status: 'FINAL'
                },
                metadata: { realData: true, dataSource: 'The Odds API Scores', gameId: game.id }
              });
              continue;
            }
            
            // For upcoming games with odds
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
            
            const subcategory = hasBookmakers ? 'H2H Markets' : 'Upcoming';
            
            cards.push({
              type: CARD_TYPES.LIVE_ODDS,
              title: `${game.away_team} @ ${game.home_team}`,
              icon: 'TrendingUp',
              category: displaySport,
              subcategory,
              gradient: getSportGradient(sport),
              data: {
                matchup: `${game.away_team} @ ${game.home_team}`,
                gameTime: new Date(game.commence_time).toLocaleString(),
                homeOdds: homeOdds ? (homeOdds.price > 0 ? `+${homeOdds.price}` : `${homeOdds.price}`) : 'N/A',
                awayOdds: awayOdds ? (awayOdds.price > 0 ? `+${awayOdds.price}` : `${awayOdds.price}`) : 'N/A',
                homeSpread: homeSpread ? `${homeSpread.point > 0 ? '+' : ''}${homeSpread.point} (${homeSpread.price > 0 ? '+' : ''}${homeSpread.price})` : 'N/A',
                awaySpread: awaySpread ? `${awaySpread.point > 0 ? '+' : ''}${awaySpread.point} (${awaySpread.price > 0 ? '+' : ''}${awaySpread.price})` : 'N/A',
                overUnder: over && under ? `O/U ${over.point}: Over ${over.price > 0 ? '+' : ''}${over.price} / Under ${under.price > 0 ? '+' : ''}${under.price}` : 'N/A',
                bookmaker: firstBook?.title || 'N/A',
                bookmakerCount: game.bookmakers?.length || 0,
                realData: true,
                status: hasBookmakers ? 'VALUE' : 'UPCOMING'
              },
              metadata: { realData: true, dataSource: 'The Odds API', gameId: game.id }
            });
        }
        
        console.log(`[v0] [CARDS-GEN] Created ${cards.length} cards with real data`);
        return cards;
      } else {
        const seasonInfo = getSeasonInfo(sport);
        if (!seasonInfo.isInSeason) {
          console.log(`[v0] [CARDS-GEN] ⏸ ${displaySport} is off-season — 0 games expected. ${seasonInfo.context}`);
        } else {
          console.warn(`[v0] [CARDS-GEN] ⚠ API returned 0 games for ${displaySport}. Possible causes:`);
          console.warn(`[v0] [CARDS-GEN]   1. No games currently live/scheduled (normal for off-days)`);
          console.warn(`[v0] [CARDS-GEN]   2. API key invalid or quota exceeded`);
          console.warn(`[v0] [CARDS-GEN]   3. Transient API error`);
        }
      }
    } catch (error) {
      console.error(`[v0] [CARDS-GEN] ❌ EXCEPTION in unified service for ${displaySport}:`);
      console.error(error);
      console.error(`[v0] [CARDS-GEN] Stack trace:`, (error as Error).stack);
      
      // Detect specific error types
      const errorMsg = (error as Error).message || '';
      const isCircuitBreakerOpen = (error as any).isCircuitBreakerOpen === true;
      const isRateLimited = errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit');
      
      if (isCircuitBreakerOpen) {
        console.error(`[v0] [CARDS-GEN] Circuit breaker is open - too many recent failures`);
      } else if (isRateLimited) {
        console.error(`[v0] [CARDS-GEN] Rate limited - API quota exceeded`);
      }
    }
  }
  
  // Fallback: Add informative card if no real data
  if (cards.length < count) {
    console.log(`[v0] [CARDS-GEN] FALLBACK: No real data for ${displaySport}, creating context-aware placeholder`);
    
    // Get seasonal context for smart messaging
    const noDataMessage = generateNoDataMessage(sport);
    
    cards.push({
      type: CARD_TYPES.LIVE_ODDS,
      title: `${displaySport} - ${noDataMessage.title}`,
      icon: 'Calendar',
      category: displaySport,
      subcategory: 'No Games Available',
      gradient: getSportGradient(sport),
      data: {
        description: noDataMessage.description,
        note: noDataMessage.suggestion,
        sport: sport,
        apiResponse: 'API returned 0 games for this sport',
        suggestion: 'Try a different sport or check back during the season',
        status: 'NO_DATA',
        realData: false
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
  if (sport.includes('soccer')) return 'from-green-500 to-teal-600';
  if (sport.includes('mma') || sport.includes('boxing')) return 'from-red-600 to-rose-700';
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
 * @param multiSport - If true, generates cards from ALL major sports (default: true when no sport specified)
 */
export async function generateContextualCards(
  category?: string,
  sport?: string,
  count: number = 3,
  multiSport: boolean = !sport // DEFAULT TO TRUE WHEN NO SPORT SPECIFIED
): Promise<InsightCard[]> {
  const cards: InsightCard[] = [];
  
  console.log(`[v0] [CARDS-GEN] Starting with multiSport=${multiSport}, sport=${sport}, category=${category}`);

  // Normalize sport to API format, then get display name
  const normalizedSport = sport ? sportToApi(sport) : undefined;
  const displaySport = normalizedSport ? apiToSport(normalizedSport).toUpperCase() : 'MULTI-SPORT';

  console.log('[v0] [CARDS GENERATOR] Generating cards...');
  console.log('[v0] [CARDS GENERATOR] Input:', { category, sport, normalizedSport, displaySport, multiSport });
  console.log('[v0] [CARDS GENERATOR] Category:', category, '| Display Sport:', displaySport, '| Count:', count);
  
  // If multiSport requested, generate variety from ALL major sports with REAL data
  if (multiSport) {
    console.log('[v0] [CARDS GENERATOR] Multi-sport mode - fetching from ALL MAJOR SPORTS (NFL, NBA, MLB, NHL)');
    
    // FORCE query ALL major sports - don't rely on "active sports detector"
    const allMajorSports = [
      SPORT_KEYS.NFL.API,      // americanfootball_nfl
      SPORT_KEYS.NBA.API,      // basketball_nba
      SPORT_KEYS.MLB.API,      // baseball_mlb
      SPORT_KEYS.NHL.API,      // icehockey_nhl
      SPORT_KEYS.NCAAB.API,   // basketball_ncaab
      SPORT_KEYS.NCAAF.API,   // americanfootball_ncaaf
      SPORT_KEYS.EPL.API,     // soccer_epl
      SPORT_KEYS.MLS.API,     // soccer_usa_mls
    ];
    
    // Sort: in-season sports first, off-season sports last (to avoid wasting API quota)
    const baseSports = normalizedSport
      ? [normalizedSport, ...allMajorSports.filter(s => s !== normalizedSport)]
      : allMajorSports;
    const orderedSports = [
      ...baseSports.filter(s => getSeasonInfo(s).isInSeason),
      ...baseSports.filter(s => !getSeasonInfo(s).isInSeason),
    ];

    console.log('[v0] [CARDS GENERATOR] Will query sports in order:', orderedSports.map(s => {
      const inSeason = getSeasonInfo(s).isInSeason;
      return `${apiToSport(s).toUpperCase()}${inSeason ? '' : '(off-season)'}`;
    }).join(', '));
    
    // Fetch from ALL sports in parallel for speed
    console.log('[v0] [MULTI-SPORT] Fetching odds from all sports in PARALLEL...');
    const allSportCards = await Promise.all(
      orderedSports.map(async (sportKey) => {
        console.log(`[v0] [MULTI-SPORT] Starting fetch for ${apiToSport(sportKey).toUpperCase()}`);
        try {
          const sportCards = await generateSportSpecificCards(sportKey, 5, category);
          console.log(`[v0] [MULTI-SPORT] ✓ ${apiToSport(sportKey).toUpperCase()}: ${sportCards.length} cards`);
          return { sport: sportKey, cards: sportCards };
        } catch (error) {
          console.error(`[v0] [MULTI-SPORT] ✗ ${apiToSport(sportKey).toUpperCase()} failed:`, error);
          return { sport: sportKey, cards: [] };
        }
      })
    );
    
    console.log('[v0] [MULTI-SPORT] All fetches complete');
    
    // Collect cards from sports that returned data
    for (const { sport: sportKey, cards: sportCards } of allSportCards) {
      if (cards.length >= count) break;
      
      if (sportCards.length > 0) {
        const cardsNeeded = count - cards.length;
        const cardsToAdd = sportCards.slice(0, cardsNeeded);
        cards.push(...cardsToAdd);
        console.log(`[v0] [MULTI-SPORT] Added ${cardsToAdd.length} ${apiToSport(sportKey).toUpperCase()} cards`);
      }
    }
    
    // Try to add player props if we still need more cards
    if (cards.length < count) {
      console.log('[v0] [MULTI-SPORT] Not enough game cards, trying player props...');
      try {
        const { fetchPlayerProps, playerPropToCard } = await import('@/lib/player-props-service');
        
        for (const sportKey of orderedSports) {
          if (cards.length >= count) break;
          
          try {
            const props = await fetchPlayerProps({ 
              sport: sportKey, 
              useCache: true, 
              storeResults: true 
            });
            
            if (props.length > 0) {
              const propsNeeded = count - cards.length;
              const propCards = props.slice(0, propsNeeded).map(playerPropToCard);
              cards.push(...propCards);
              console.log(`[v0] [MULTI-SPORT] Added ${propCards.length} ${apiToSport(sportKey).toUpperCase()} prop cards`);
            }
          } catch (error) {
            console.error(`[v0] [MULTI-SPORT] Failed to fetch props for ${apiToSport(sportKey).toUpperCase()}:`, error);
          }
        }
      } catch (error) {
        console.error('[v0] [MULTI-SPORT] Player props import failed:', error);
      }
    }
    
    // If we still don't have enough cards, add placeholder cards
    while (cards.length < count) {
      const remainingSports = orderedSports.filter(s => !cards.some(c => c.data?.sport === s));
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
    
    console.log(`[v0] [MULTI-SPORT] Final result: ${cards.length} cards from ${[...new Set(cards.map(c => c.category))].join(', ')}`);
    
    return cards.slice(0, count);
  }

  // Dedicated Arbitrage category - when user explicitly asks for arbitrage
  if (category === 'arbitrage' || category === 'arb') {
    console.log('[v0] [CARDS-GEN] Arbitrage category - fetching from Supabase with realtime');
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      
      // Fetch active arbitrage opportunities from Supabase (stored by API cron)
      const { data: opportunities } = await supabase
        .from('arbitrage_opportunities')
        .select('*')
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('profit_margin', { ascending: false })
        .limit(count);
      
      if (opportunities && opportunities.length > 0) {
        console.log(`[v0] [CARDS-GEN] Found ${opportunities.length} arbitrage opportunities`);
        
        opportunities.forEach((opp: any) => {
          cards.push({
            type: 'ARBITRAGE',
            title: `${opp.away_team} @ ${opp.home_team}`,
            icon: 'DollarSign',
            category: 'ARBITRAGE',
            subcategory: `${(opp.profit_margin * 100).toFixed(2)}% Profit`,
            gradient: 'from-emerald-600 to-green-700',
            data: {
              matchup: `${opp.away_team} @ ${opp.home_team}`,
              profitMargin: `${(opp.profit_margin * 100).toFixed(2)}%`,
              totalStake: `$${opp.total_stake.toFixed(2)}`,
              guaranteedProfit: `$${(opp.total_stake * opp.profit_margin).toFixed(2)}`,
              side1: {
                bookmaker: opp.bookmaker_1,
                odds: opp.odds_1 > 0 ? `+${opp.odds_1}` : opp.odds_1,
                stake: `$${opp.stake_1.toFixed(2)}`
              },
              side2: {
                bookmaker: opp.bookmaker_2,
                odds: opp.odds_2 > 0 ? `+${opp.odds_2}` : opp.odds_2,
                stake: `$${opp.stake_2.toFixed(2)}`
              },
              expiresIn: Math.round((new Date(opp.expires_at).getTime() - Date.now()) / 60000) + ' min',
              realData: true,
              status: 'ACTIVE'
            },
            metadata: {
              realData: true,
              dataSource: 'Supabase Arbitrage Detector',
              timestamp: opp.detected_at,
              expiresAt: opp.expires_at
            }
          });
        });
        
        return cards;
      } else {
        console.log('[v0] [CARDS-GEN] No active arbitrage opportunities');
      }
    } catch (error) {
      console.error('[v0] [CARDS-GEN] Arbitrage fetch error:', error);
    }
    
    // Fallback if no opportunities found
    cards.push({
      type: 'ARBITRAGE',
      title: 'Arbitrage Scanner',
      icon: 'DollarSign',
      category: 'ARBITRAGE',
      subcategory: 'No Opportunities',
      gradient: 'from-emerald-600 to-teal-700',
      data: {
        description: 'Continuously scanning for risk-free profit opportunities',
        note: 'No arbitrage opportunities currently available',
        checkingMarkets: 'Monitoring all sportsbooks in real-time',
        realData: true,
        status: 'SCANNING'
      }
    });
    
    return cards;
  }
  
  // Betting/Arbitrage cards (default)
  if (category === 'betting' || !category) {
    // Try to detect real arbitrage opportunities
    console.log('[v0] [CARDS GENERATOR] Checking for arbitrage opportunities');
    try {
      const { detectArbitrageFromContext } = await import('@/lib/arbitrage');
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

  // Line Movement category - when user asks about line moves, steam, sharp money
  if (category === 'lines' || category === 'line_movement' || category === 'steam') {
    console.log('[v0] [CARDS-GEN] Line movement category - fetching recent movements');
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      
      // Fetch recent significant line movements (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: movements } = await supabase
        .from('line_movement')
        .select('*')
        .gt('updated_at', oneDayAgo)
        .order('updated_at', { ascending: false })
        .limit(count * 3);
      
      if (movements && movements.length > 0) {
        console.log(`[v0] [CARDS-GEN] Found ${movements.length} line movements`);
        
        // Group by game and show most significant movements
        const gameMovements = new Map();
        movements.forEach((move: any) => {
          const key = `${move.away_team}_${move.home_team}`;
          if (!gameMovements.has(key) || Math.abs(move.line_change || 0) > Math.abs(gameMovements.get(key).line_change || 0)) {
            gameMovements.set(key, move);
          }
        });
        
        const topMovements = Array.from(gameMovements.values()).slice(0, count);
        
        topMovements.forEach(move => {
          const lineChange = move.line_change || 0;
          const direction = lineChange > 0 ? 'UP' : 'DOWN';
          const isSteam = Math.abs(lineChange) > 2;
          
          cards.push({
            type: 'LINE_MOVEMENT',
            title: `${move.away_team} @ ${move.home_team}`,
            icon: isSteam ? 'TrendingUp' : 'Activity',
            category: 'LINE MOVEMENT',
            subcategory: isSteam ? `STEAM ${direction}` : `${direction} ${Math.abs(lineChange).toFixed(1)} pts`,
            gradient: isSteam ? 'from-red-600 to-orange-600' : 'from-blue-600 to-indigo-600',
            data: {
              matchup: `${move.away_team} @ ${move.home_team}`,
              lineChange: `${lineChange > 0 ? '+' : ''}${lineChange.toFixed(1)} points`,
              oldLine: move.old_line ? `${move.old_line > 0 ? '+' : ''}${move.old_line}` : 'N/A',
              newLine: move.new_line ? `${move.new_line > 0 ? '+' : ''}${move.new_line}` : 'N/A',
              bookmaker: move.bookmaker || 'Multiple Books',
              timestamp: new Date(move.updated_at).toLocaleString(),
              isSteamMove: isSteam,
              direction: direction,
              sharpMoney: isSteam ? `Heavy ${direction === 'UP' ? 'home' : 'away'} action` : 'Moderate movement',
              realData: true,
              status: isSteam ? 'STEAM' : 'MOVEMENT'
            },
            metadata: {
              realData: true,
              dataSource: 'Line Movement Tracker',
              timestamp: move.updated_at,
              gameId: move.game_id
            }
          });
        });
        
        return cards;
      } else {
        console.log('[v0] [CARDS-GEN] No recent line movements');
      }
    } catch (error) {
      console.error('[v0] [CARDS-GEN] Line movement fetch error:', error);
    }
    
    // Fallback
    cards.push({
      type: 'LINE_MOVEMENT',
      title: 'Line Movement Tracker',
      icon: 'Activity',
      category: 'LINE MOVEMENT',
      subcategory: 'No Recent Movements',
      gradient: 'from-blue-600 to-indigo-600',
      data: {
        description: 'Monitoring odds movements across all sportsbooks',
        note: 'No significant line movements in the last 24 hours',
        tracking: 'All major sports and markets',
        realData: true,
        status: 'MONITORING'
      }
    });
    
    return cards;
  }
  
  // Kalshi/Prediction Markets - Fetch ALL markets (sports, elections, politics, everything)
  if (category === 'kalshi') {
    console.log('[v0] [CARDS-GEN] Kalshi category - fetching ALL markets from API with retry logic');
    try {
      const { fetchKalshiMarketsWithRetry, kalshiMarketToCard } = await import('@/lib/kalshi-client');
      
      // Fetch ALL open markets from Kalshi with retry logic (no category filter)
      console.log('[v0] [CARDS-GEN] Calling Kalshi API for all open markets (with 3 retry attempts)...');
      const markets = await fetchKalshiMarketsWithRetry({ 
        status: 'open', 
        limit: Math.max(count, 50), // Fetch more to ensure variety
        maxRetries: 3
      });
      
      console.log(`[v0] [CARDS-GEN] Kalshi API returned ${markets.length} total markets`);
      
      if (markets.length > 0) {
        // Convert to cards and take requested count
        const kalshiCards = markets.slice(0, count).map(kalshiMarketToCard);
        cards.push(...kalshiCards);
        console.log(`[v0] [CARDS-GEN] Added ${kalshiCards.length} Kalshi market cards`);
        console.log('[v0] [CARDS-GEN] Market categories:', [...new Set(markets.map(m => m.category))].join(', '));
        return cards;
      } else {
        console.warn('[v0] [CARDS-GEN] Kalshi API returned 0 markets - may be connectivity issue');
      }
    } catch (error) {
      console.error('[v0] [CARDS-GEN] Kalshi API error:', error);
    }
    
    // Fallback to placeholder if no markets available
    cards.push({
      type: 'PREDICTION_MARKET',
      title: 'Kalshi Markets Unavailable',
      icon: 'BarChart',
      category: 'KALSHI',
      subcategory: 'Connection Issue',
      gradient: 'from-purple-600 to-indigo-700',
      data: {
        description: 'Unable to fetch Kalshi markets',
        note: 'Check API connectivity and try again',
        marketType: 'All Categories',
        realData: false
      }
    });
  }

  // Portfolio/Kelly Sizing - when user asks about bet sizing, bankroll management, Kelly criterion
  if (category === 'portfolio' || category === 'kelly' || category === 'sizing' || category === 'bankroll') {
    console.log('[v0] [CARDS-GEN] Portfolio/Kelly category - calculating optimal bet sizes');
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      
      // Get current capital state
      const { data: capitalState } = await supabase
        .from('capital_state')
        .select('*')
        .eq('active', true)
        .single();
      
      if (capitalState) {
        // Get current bet allocations
        const { data: allocations } = await supabase
          .from('bet_allocations')
          .select('*')
          .in('status', ['pending', 'placed'])
          .order('allocated_capital', { ascending: false })
          .limit(count);
        
        const totalAllocated = allocations?.reduce((sum: number, bet: any) => sum + bet.allocated_capital, 0) || 0;
        const utilization = (totalAllocated / capitalState.total_capital) * 100;
        
        // Portfolio summary card
        cards.push({
          type: 'PORTFOLIO',
          title: 'Portfolio Overview',
          icon: 'Wallet',
          category: 'PORTFOLIO',
          subcategory: `${utilization.toFixed(1)}% Deployed`,
          gradient: 'from-purple-600 to-pink-600',
          data: {
            totalBankroll: `$${capitalState.total_capital.toFixed(2)}`,
            deployed: `$${totalAllocated.toFixed(2)}`,
            available: `$${(capitalState.total_capital - totalAllocated).toFixed(2)}`,
            utilizationRate: `${utilization.toFixed(1)}%`,
            riskBudget: `${(capitalState.risk_budget * 100).toFixed(0)}%`,
            kellyScale: `${(capitalState.kelly_scale * 100).toFixed(0)}% (${capitalState.kelly_scale === 0.25 ? 'Quarter Kelly' : capitalState.kelly_scale === 0.5 ? 'Half Kelly' : 'Custom'})`,
            maxSinglePosition: `${(capitalState.max_single_position * 100).toFixed(0)}%`,
            activeBets: allocations?.length || 0,
            realData: true,
            status: utilization > 80 ? 'HIGH_UTILIZATION' : utilization > 50 ? 'MODERATE' : 'CONSERVATIVE'
          },
          metadata: {
            realData: true,
            dataSource: 'Capital State Manager',
            timestamp: capitalState.updated_at
          }
        });
        
        // Show top allocations if any exist
        if (allocations && allocations.length > 0) {
          allocations.slice(0, Math.min(2, count - 1)).forEach((bet: any) => {
            const kellyPct = (bet.kelly_fraction * 100).toFixed(2);
            cards.push({
              type: 'KELLY_BET',
              title: bet.matchup || 'Bet Allocation',
              icon: 'Target',
              category: 'KELLY SIZING',
              subcategory: `${kellyPct}% Kelly`,
              gradient: 'from-indigo-600 to-purple-600',
              data: {
                matchup: bet.matchup,
                sport: bet.sport?.toUpperCase(),
                edge: `${(bet.edge * 100).toFixed(2)}%`,
                confidence: `${(bet.confidence_score * 100).toFixed(0)}%`,
                kellyFraction: `${kellyPct}%`,
                recommendedStake: `$${bet.allocated_capital.toFixed(2)}`,
                expectedValue: `$${(bet.allocated_capital * bet.edge).toFixed(2)}`,
                status: bet.status?.toUpperCase(),
                realData: true
              },
              metadata: {
                realData: true,
                dataSource: 'Capital Allocator',
                timestamp: bet.created_at
              }
            });
          });
        }
        
        return cards;
      }
    } catch (error) {
      console.error('[v0] [CARDS-GEN] Portfolio fetch error:', error);
    }
    
    // Fallback
    cards.push({
      type: 'PORTFOLIO',
      title: 'Portfolio Manager',
      icon: 'Wallet',
      category: 'PORTFOLIO',
      subcategory: 'Kelly Criterion',
      gradient: 'from-purple-600 to-pink-600',
      data: {
        description: 'Optimal bet sizing using Kelly Criterion with fractional scaling',
        features: ['Risk Management', 'Capital Allocation', 'Bankroll Protection'],
        note: 'Initialize capital state to start tracking',
        realData: false,
        status: 'SETUP_REQUIRED'
      }
    });
    
    return cards;
  }
  
  // Player Props - Fetch real player prop markets
  if (category === 'props' || category === 'player_props') {
    console.log('[v0] [CARDS-GEN] Player props category - fetching live markets');
    try {
      const { fetchPlayerProps, playerPropToCard } = await import('@/lib/player-props-service');
      
      if (normalizedSport) {
        const props = await fetchPlayerProps({ 
          sport: normalizedSport, 
          useCache: true, 
          storeResults: true 
        });
        
        console.log(`[v0] [CARDS-GEN] Fetched ${props.length} player props`);
        
        if (props.length > 0) {
          const propCards = props.slice(0, count).map(playerPropToCard);
          cards.push(...propCards);
          console.log(`[v0] [CARDS-GEN] Added ${propCards.length} player prop cards`);
          return cards;
        }
      }
    } catch (error) {
      console.error('[v0] [CARDS-GEN] Player props error:', error);
    }
    
    // Fallback placeholder
    cards.push({
      type: 'PLAYER_PROP',
      title: 'Player Props',
      icon: 'User',
      category: displaySport,
      subcategory: 'Player Props',
      gradient: 'from-blue-600 to-cyan-600',
      data: {
        description: 'Player-specific betting markets',
        note: 'Loading prop markets...',
        realData: false
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

  // If we have a sport and still need cards, try fetching sport-specific data
  // (handles category='all' with a specific sport, e.g. "MLB Offseason" query)
  if (cards.length < count && normalizedSport) {
    console.log(`[v0] [CARDS-GEN] Still need cards, attempting sport-specific fetch for ${displaySport}`);
    try {
      const sportCards = await generateSportSpecificCards(normalizedSport, count - cards.length, 'betting');
      // Only add cards with real data (not placeholders) to avoid duplicates
      const realCards = sportCards.filter(c => c.data?.realData === true);
      if (realCards.length > 0) {
        cards.push(...realCards.slice(0, count - cards.length));
        console.log(`[v0] [CARDS-GEN] Added ${realCards.length} real ${displaySport} cards`);
      }
    } catch (err) {
      console.error(`[v0] [CARDS-GEN] Sport-specific fallback failed:`, err);
    }
  }

  // Final fallback: add informative placeholder cards (deduplicated by index)
  const fallbackLabels = [
    `${displaySport} Futures Markets`,
    `${displaySport} Line Movement`,
    `${displaySport} Schedule`,
  ];
  let fallbackIdx = 0;
  while (cards.length < count) {
    const label = fallbackLabels[fallbackIdx % fallbackLabels.length];
    fallbackIdx++;
    cards.push({
      type: CARD_TYPES.LIVE_ODDS,
      title: `📈 ${label}`,
      icon: 'LineChart',
      category: displaySport,
      subcategory: 'Market Overview',
      gradient: getSportGradient(normalizedSport || 'default'),
      data: {
        description: `${displaySport} markets — no live games currently scheduled`,
        sport: normalizedSport,
        note: 'Odds post 24–48 hours before game time. Futures markets available year-round.',
        status: 'OFFSEASON'
      }
    });
  }
  
  console.log('[v0] [CARDS GENERATOR] ✓ Generated', cards.length, 'cards (before weather enrichment)');
  console.log('[v0] [CARDS GENERATOR] Card titles:', cards.map((c: InsightCard) => c.title).join(', '));

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
