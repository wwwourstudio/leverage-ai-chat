import { NextRequest, NextResponse } from 'next/server';
import {
  SPORTS_MAP,
  EXTERNAL_APIS,
  ENV_KEYS,
  LOG_PREFIXES,
  DATA_SOURCES,
  CARD_TYPES,
  CARD_STATUS,
  type CardType,
  type CardStatus
} from '@/lib/constants';
import { validateSportKey, getSportInfo } from '@/lib/sports-validator';
import {
  fetchLiveOdds,
  fetchHistoricalOdds,
  fetchOutrights,
  getActiveSports,
  ODDS_MARKETS,
  BETTING_REGIONS
} from '@/lib/odds-api-client';
import {
  transformOddsEvents,
  filterEventsByTimeRange,
  sortEventsByValue,
  formatAmericanOdds,
  type OddsEvent,
  type TransformedOdds
} from '@/lib/odds-transformer';
import { enrichCardsWithWeather } from '@/lib/weather-service';

export const runtime = 'edge';

interface CardRequest {
  sport?: string;
  category?: string;
  userContext?: {
    sport?: string | null;
    marketType?: string;
    platform?: string;
    previousMessages?: Array<{
      role: string;
      content: string;
    }>;
    previousQueries?: string[];
    preferences?: string[];
  };
  limit?: number;
}

/**
 * Analyzes user context from previous messages to determine actual sport intent
 */
function analyzeContextForSport(userContext?: CardRequest['userContext']): string | null {
  if (!userContext) return null;
  
  console.log(`${LOG_PREFIXES.API} [Context Analyzer] Analyzing user context for sport detection`);
  
  // First check if sport is directly provided in context
  if (userContext.sport) {
    console.log(`${LOG_PREFIXES.API} [Context Analyzer] ✓ Sport from context.sport: ${userContext.sport}`);
    return userContext.sport;
  }
  
  // Analyze previous messages to extract sport intent
  if (userContext.previousMessages && userContext.previousMessages.length > 0) {
    console.log(`${LOG_PREFIXES.API} [Context Analyzer] Analyzing ${userContext.previousMessages.length} previous messages`);
    
    // Combine all message content
    const combinedText = userContext.previousMessages
      .map(msg => msg.content)
      .join(' ')
      .toLowerCase();
    
    console.log(`${LOG_PREFIXES.API} [Context Analyzer] Combined text sample: ${combinedText.substring(0, 150)}...`);
    
    // Enhanced sport detection including fantasy baseball keywords
    if (combinedText.includes('nfbc') || combinedText.includes('nffc') || 
        combinedText.includes('nfbkc') || combinedText.includes('tgfbi') ||
        combinedText.includes('baseball') || combinedText.includes('mlb')) {
      console.log(`${LOG_PREFIXES.API} [Context Analyzer] ✓ Detected MLB from fantasy baseball keywords`);
      return 'mlb';
    }
    
    if (combinedText.includes('nba') || combinedText.includes('basketball')) {
      console.log(`${LOG_PREFIXES.API} [Context Analyzer] ✓ Detected NBA`);
      return 'nba';
    }
    
    if (combinedText.includes('nfl') || combinedText.includes('football')) {
      console.log(`${LOG_PREFIXES.API} [Context Analyzer] ✓ Detected NFL`);
      return 'nfl';
    }
    
    if (combinedText.includes('nhl') || combinedText.includes('hockey')) {
      console.log(`${LOG_PREFIXES.API} [Context Analyzer] ✓ Detected NHL`);
      return 'nhl';
    }
  }
  
  // Check platform to infer sport (e.g., fantasy platform might indicate baseball)
  if (userContext.platform === 'fantasy') {
    console.log(`${LOG_PREFIXES.API} [Context Analyzer] Platform is 'fantasy' - defaulting to MLB for fantasy baseball`);
    return 'mlb';
  }
  
  console.log(`${LOG_PREFIXES.API} [Context Analyzer] ✗ No sport detected from context`);
  return null;
}

/**
 * Dynamic Card Generation API
 * Generates insight cards based on real odds data and AI analysis
 */
export async function POST(req: NextRequest) {
  try {
    console.log(`${LOG_PREFIXES.API} ========================================`);
    console.log(`${LOG_PREFIXES.API} CARDS API: POST REQUEST RECEIVED`);
    console.log(`${LOG_PREFIXES.API} Timestamp:`, new Date().toISOString());
    
    const body: CardRequest = await req.json();
    console.log(`${LOG_PREFIXES.API} Request body parsed:`, JSON.stringify(body, null, 2));
    
    const { sport, category, userContext, limit = 3 } = body;
    console.log(`${LOG_PREFIXES.API} Extracted parameters:`);
    console.log(`${LOG_PREFIXES.API} - Sport (direct): ${sport || 'not specified'}`);
    console.log(`${LOG_PREFIXES.API} - Category: ${category || 'not specified'}`);
    console.log(`${LOG_PREFIXES.API} - Limit: ${limit}`);
    console.log(`${LOG_PREFIXES.API} - User context:`, userContext ? 'provided' : 'not provided');
    
    // Analyze context to determine actual sport intent
    const contextualSport = analyzeContextForSport(userContext);
    const finalSport = sport || contextualSport || undefined;
    
    console.log(`${LOG_PREFIXES.API} - Sport (from context): ${contextualSport || 'none'}`);
    console.log(`${LOG_PREFIXES.API} - Sport (final): ${finalSport || 'none - will show variety'}`);

    const oddsApiKey = process.env[ENV_KEYS.ODDS_API_KEY];
    console.log(`${LOG_PREFIXES.API} Odds API Key configured:`, oddsApiKey ? 'YES' : 'NO');
    
    // Fetch real odds data if available
    let liveOddsData: any[] = [];
    let validationResult = null;
    
    // If no specific sport requested, fetch from multiple sports for variety
    // Always fetch multiple sports to show variety in cards
    const sportsToFetch = finalSport ? [finalSport] : ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb'];
    console.log(`${LOG_PREFIXES.API} Sports to fetch: ${sportsToFetch.join(', ')}${!finalSport ? ' (showing variety from all active sports)' : ''}`);
    
    if (oddsApiKey) {
      console.log(`[v0] Starting odds fetch for ${sportsToFetch.length} sport(s) to ensure variety`);
      
      // Fetch odds from all specified sports in parallel
      const fetchPromises = sportsToFetch.map(async (sportKey) => {
        try {
          console.log(`[v0] Fetching odds for: ${sportKey}`);
          const validation = validateSportKey(sportKey);
          
          if (!validation.isValid) {
            console.log(`${LOG_PREFIXES.API} Skipping invalid sport: ${sportKey}`);
            return [];
          }
          
          const normalizedKey = validation.normalizedKey;
          const sportInfo = getSportInfo(normalizedKey);
          
          console.log(`[v0] Fetching ${sportInfo.name} odds...`);
          const oddsData = await fetchLiveOdds(normalizedKey, {
            markets: [ODDS_MARKETS.H2H, ODDS_MARKETS.SPREADS, ODDS_MARKETS.TOTALS],
            regions: [BETTING_REGIONS.US],
            apiKey: oddsApiKey
          });
          
          console.log(`${LOG_PREFIXES.API} ✓ Fetched ${oddsData?.length || 0} ${sportInfo.name} events`);
          return Array.isArray(oddsData) ? oddsData : [];
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`${LOG_PREFIXES.API} ✗ Error fetching ${sportKey}:`, errorMessage);
          return [];
        }
      });
      
      try {
        const results = await Promise.all(fetchPromises);
        liveOddsData = results.flat(); // Combine all sports into one array
        console.log(`${LOG_PREFIXES.API} ✓ Combined total: ${liveOddsData.length} events from ${sportsToFetch.length} sports`);
        
        // Store validation result from first sport for response
        if (sport) {
          validationResult = validateSportKey(sport);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`${LOG_PREFIXES.API} Error in multi-sport fetch:`, errorMessage);
      }
    } else {
      console.log(`[v0] No odds API key found - skipping odds fetch`);
    }

    // Generate cards based on category and available data
    console.log(`${LOG_PREFIXES.API} → Calling generateDynamicCards...`);
    console.log(`${LOG_PREFIXES.API} Generation parameters:`, {
      category,
      sport,
      hasOddsData: !!liveOddsData,
      oddsEventsCount: liveOddsData?.length || 0,
      hasUserContext: !!userContext,
      limit
    });
    
    let cards = await generateDynamicCards({
      category,
      sport: finalSport ?? undefined,
      oddsData: liveOddsData,
      userContext,
      limit
    });

    console.log(`${LOG_PREFIXES.API} ✓ Generated ${cards.length} cards`);
    
    // Enrich cards with weather data for NFL/MLB games
    if (cards.length > 0 && (sport?.includes('nfl') || sport?.includes('mlb'))) {
      console.log(`${LOG_PREFIXES.API} → Enriching cards with weather data...`);
      try {
        const enrichedCards = await enrichCardsWithWeather(cards);
        if (enrichedCards.length > cards.length) {
          console.log(`${LOG_PREFIXES.API} ✓ Added ${enrichedCards.length - cards.length} weather cards`);
          cards = enrichedCards;
        }
      } catch (error) {
        console.error(`${LOG_PREFIXES.API} Weather enrichment failed:`, error);
      }
    }
    
    if (cards.length === 0) {
      console.log(`${LOG_PREFIXES.API} ⚠ WARNING: Zero cards generated!`);
      console.log(`${LOG_PREFIXES.API} Possible causes:`);
      console.log(`${LOG_PREFIXES.API} 1. No odds data available (had ${liveOddsData?.length || 0} events)`);
      console.log(`${LOG_PREFIXES.API} 2. Sport not recognized: ${sport}`);
      console.log(`${LOG_PREFIXES.API} 3. Category filtering too strict: ${category}`);
      console.log(`${LOG_PREFIXES.API} 4. generateDynamicCards logic issue`);
    } else {
      console.log(`${LOG_PREFIXES.API} Card summary:`);
      cards.forEach((card, idx) => {
        console.log(`${LOG_PREFIXES.API}   ${idx + 1}. ${card.type} - ${card.title} [${card.category}]`);
      });
    }

    // Track actual data sources with weather for outdoor sports
    const dataSources: string[] = [];
    if (liveOddsData.length > 0) {
      dataSources.push('The Odds API (real-time odds from 15+ sportsbooks)');
    }
    
    // Add weather data source for outdoor sports
    const outdoorSports = ['nfl', 'mlb', 'ncaaf'];
    if (outdoorSports.includes(finalSport || '')) {
      dataSources.push('Open-Meteo Weather API (live conditions & forecasts)');
      console.log(`${LOG_PREFIXES.API} Weather data relevant for ${finalSport} - marked as source`);
    }
    
    if (dataSources.length === 0) {
      dataSources.push('Grok 4 Fast AI (xAI)');
      dataSources.push('Statistical Models & Historical Data');
    }
    
    // Ensure we always have exactly 3 cards
    if (cards.length < 3) {
      console.log(`${LOG_PREFIXES.API} ⚠ Only ${cards.length} cards, generating more`);
      const { generateContextualCards } = await import('@/lib/cards-generator');
      const additionalCards = await generateContextualCards(
        category, 
        finalSport, 
        3 - cards.length,
        !finalSport // Use multi-sport if no specific sport
      );
      cards.push(...additionalCards);
    }
    console.log(`${LOG_PREFIXES.API} ✓ Final card count: ${cards.length}`);
    
    const response = {
      success: true,
      cards: cards.slice(0, limit),
      dataSources,
      dataSource: oddsApiKey ? DATA_SOURCES.LIVE : DATA_SOURCES.SIMULATED,
      sportValidation: validationResult,
      timestamp: new Date().toISOString()
    };
    
    console.log(`${LOG_PREFIXES.API} ← Sending ${response.cards.length} cards`);
    console.log(`${LOG_PREFIXES.API} Sources: ${dataSources.join(', ')}`);
    console.log(`${LOG_PREFIXES.API} ========================================`);
    
    return NextResponse.json(response);

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`${LOG_PREFIXES.API} Error in cards route:`, errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage,
      cards: [] // Return empty array on error
    });
  }
}

// Sport validation is now handled by sports-validator.ts

async function generateDynamicCards(params: {
  category?: string;
  sport?: string;
  oddsData?: any;
  userContext?: any;
  limit: number;
}) {
  // Destructure parameters FIRST before using them
  const { category, sport, oddsData, limit } = params;
  const cards: any[] = [];
  
  console.log(`${LOG_PREFIXES.API} ----------------------------------------`);
  console.log(`${LOG_PREFIXES.API} generateDynamicCards() called`);
  console.log(`${LOG_PREFIXES.API} Input parameters:`, {
    category,
    sport,
    hasOddsData: !!oddsData,
    oddsDataIsArray: Array.isArray(oddsData),
    oddsDataLength: oddsData?.length || 0,
    limit
  });

  // Generate betting cards from live odds using transformer
  if (oddsData && Array.isArray(oddsData) && oddsData.length > 0) {
    console.log(`${LOG_PREFIXES.API} ✓ Odds data validation passed`);
    console.log(`${LOG_PREFIXES.API} Processing ${oddsData.length} live odds events`);
    
    // Transform and enhance the odds data
    console.log(`${LOG_PREFIXES.API} → Step 1: Filtering events by time range (48 hours)...`);
    const filteredEvents = filterEventsByTimeRange(oddsData, 48);
    console.log(`${LOG_PREFIXES.API}   Filtered to ${filteredEvents.length} upcoming events`);
    
    console.log(`${LOG_PREFIXES.API} → Step 2: Transforming odds events...`);
    const transformedOdds = transformOddsEvents(filteredEvents);
    console.log(`${LOG_PREFIXES.API}   Transformed ${transformedOdds.length} events`);
    
    console.log(`${LOG_PREFIXES.API} → Step 3: Sorting by value...`);
    const sortedByValue = sortEventsByValue(transformedOdds);
    console.log(`${LOG_PREFIXES.API}   Sorted ${sortedByValue.length} events by market value`);
    
    // Take top events by value
    const topEvents = sortedByValue.slice(0, limit * 2); // Get more to filter
    console.log(`${LOG_PREFIXES.API} → Step 4: Selected top ${topEvents.length} events for card generation`)
    
    console.log(`${LOG_PREFIXES.API} → Step 5: Generating cards from top events...`);
    
    for (const transformed of topEvents) {
      const event = transformed.event;
      console.log(`${LOG_PREFIXES.API}   Processing: ${event.home_team} vs ${event.away_team}`);
      
      // Generate spread card if available
      if (transformed.bestSpread && cards.length < limit) {
        console.log(`${LOG_PREFIXES.API}     ✓ Adding spread card`)
        const spread = transformed.bestSpread;
        const edge = spread.edge;
        const confidence = Math.round((1 - spread.impliedProbability) * 100);
        
        cards.push({
          type: CARD_TYPES.LIVE_ODDS,
          title: 'Live Spread Analysis',
          icon: 'Zap',
          category: event.sport_title.toUpperCase(),
          subcategory: 'Point Spread',
          gradient: edge > 3 ? 'from-orange-500 to-red-600' : 'from-blue-500 to-indigo-600',
          data: {
            matchup: `${event.home_team} vs ${event.away_team}`,
            bestLine: `${spread.outcome.name} ${spread.outcome.point && spread.outcome.point > 0 ? '+' : ''}${spread.outcome.point || ''} (${formatAmericanOdds(spread.outcome.price)})`,
            book: spread.bookmaker,
            edge: `${edge > 0 ? '+' : ''}${edge.toFixed(1)}%`,
            movement: transformed.lineMovement,
            confidence: confidence,
            gameTime: new Date(event.commence_time).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }),
            marketEfficiency: `${transformed.marketEfficiency.toFixed(1)}% inefficiency`
          },
          status: edge > 3 ? CARD_STATUS.HOT : CARD_STATUS.VALUE,
          realData: true
        });
      }

      // Generate moneyline card if available
      if (transformed.bestMoneyline && cards.length < limit) {
        const ml = transformed.bestMoneyline;
        const impliedWin = (ml.impliedProbability * 100).toFixed(1);
        
        cards.push({
          type: CARD_TYPES.MONEYLINE_VALUE,
          title: 'Moneyline Opportunity',
          icon: 'Target',
          category: event.sport_title.toUpperCase(),
          subcategory: 'Moneyline',
          gradient: 'from-purple-500 to-pink-600',
          data: {
            matchup: `${event.home_team} vs ${event.away_team}`,
            team: ml.outcome.name,
            line: formatAmericanOdds(ml.outcome.price),
            impliedWin: `${impliedWin}%`,
            book: ml.bookmaker,
            recommendation: ml.outcome.price < -200 
              ? 'Heavy favorite - consider parlay' 
              : ml.outcome.price > 150 
              ? 'Underdog value opportunity'
              : 'Competitive matchup',
            gameTime: new Date(event.commence_time).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })
          },
          status: CARD_STATUS.VALUE,
          realData: true
        });
      }

      // Generate totals card if available
      if (transformed.bestTotal && cards.length < limit) {
        const total = transformed.bestTotal;
        
        cards.push({
          type: CARD_TYPES.TOTALS_VALUE,
          title: 'Total Points Analysis',
          icon: 'BarChart3',
          category: event.sport_title.toUpperCase(),
          subcategory: 'Over/Under',
          gradient: 'from-green-500 to-emerald-600',
          data: {
            matchup: `${event.home_team} vs ${event.away_team}`,
            line: `${total.outcome.name} ${total.outcome.point}`,
            odds: formatAmericanOdds(total.outcome.price),
            book: total.bookmaker,
            impliedProb: `${(total.impliedProbability * 100).toFixed(1)}%`,
            recommendation: 'Check team pace and defensive ratings',
            gameTime: new Date(event.commence_time).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })
          },
          status: CARD_STATUS.VALUE,
          realData: true
        });
      }

      if (cards.length >= limit) {
        console.log(`${LOG_PREFIXES.API}   ✓ Reached limit of ${limit} cards, stopping`);
        break;
      }
    }
    
    console.log(`${LOG_PREFIXES.API} ✓ Generated ${cards.length} cards from live odds data`);
  } else {
    console.log(`${LOG_PREFIXES.API} ⚠ No odds data available for card generation`);
    console.log(`${LOG_PREFIXES.API} Reasons: oddsData=${!!oddsData}, isArray=${Array.isArray(oddsData)}, length=${oddsData?.length || 0}`);
  }

  // If no live data or need more cards, generate contextual recommendations
  if (cards.length < limit) {
    const contextualCount = limit - cards.length;
    console.log(`${LOG_PREFIXES.API} → Step 6: Need ${contextualCount} more cards, generating contextual cards...`);
    const { generateContextualCards: genCards } = await import('@/lib/cards-generator');
    const contextualCards = await genCards(category, sport, contextualCount, !sport);
    console.log(`${LOG_PREFIXES.API}   Generated ${contextualCards.length} contextual cards`);
    cards.push(...contextualCards);
  }

  console.log(`${LOG_PREFIXES.API} �� Final result: ${cards.length} total cards`);
  console.log(`${LOG_PREFIXES.API} ----------------------------------------`);
  return cards.slice(0, limit);
}

// Helper functions moved to odds-transformer.ts and cards-generator.ts for reusability
