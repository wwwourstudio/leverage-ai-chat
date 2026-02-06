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
    previousQueries?: string[];
    preferences?: string[];
  };
  limit?: number;
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
    console.log(`${LOG_PREFIXES.API} - Sport: ${sport || 'not specified'}`);
    console.log(`${LOG_PREFIXES.API} - Category: ${category || 'not specified'}`);
    console.log(`${LOG_PREFIXES.API} - Limit: ${limit}`);
    console.log(`${LOG_PREFIXES.API} - User context:`, userContext ? 'provided' : 'not provided');

    const oddsApiKey = process.env[ENV_KEYS.ODDS_API_KEY];
    console.log(`${LOG_PREFIXES.API} Odds API Key configured:`, oddsApiKey ? 'YES' : 'NO');
    
    // Fetch real odds data if available
    let liveOddsData = null;
    let validationResult = null;
    
    // Use NBA as default sport if no sport specified
    const sportToFetch = sport || 'nba';
    console.log(`${LOG_PREFIXES.API} Sport to fetch: ${sportToFetch}${!sport ? ' (default)' : ''}`);
    
    if (oddsApiKey) {
      try {
        // Validate and normalize the sport key
        validationResult = validateSportKey(sportToFetch);
        
        if (!validationResult.isValid) {
          console.log(`${LOG_PREFIXES.API} Invalid sport key:`, validationResult.error, validationResult.suggestion);
        }
        
        const sportKey = validationResult.normalizedKey;
        const sportInfo = getSportInfo(sportKey);
        
        console.log(`${LOG_PREFIXES.API} Fetching odds for ${sportInfo.name} (${sportInfo.apiKey})`);
        
        const oddsUrl = `${EXTERNAL_APIS.ODDS_API.BASE_URL}/sports/${sportKey}/odds?apiKey=${oddsApiKey}&regions=${EXTERNAL_APIS.ODDS_API.REGIONS}&markets=${EXTERNAL_APIS.ODDS_API.DEFAULT_MARKETS}&oddsFormat=${EXTERNAL_APIS.ODDS_API.ODDS_FORMAT}`;
        
        const oddsResponse = await fetch(oddsUrl);
        if (oddsResponse.ok) {
          liveOddsData = await oddsResponse.json();
          console.log(`${LOG_PREFIXES.API} Fetched live odds:`, liveOddsData?.length || 0, 'events for', sportInfo.name);
        } else {
          const errorText = await oddsResponse.text();
          console.log(`${LOG_PREFIXES.API} Odds API returned ${oddsResponse.status}:`, errorText.substring(0, 100));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`${LOG_PREFIXES.API} Error fetching odds for cards:`, errorMessage);
      }
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
      sport,
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

    const response = {
      success: true,
      cards,
      dataSource: oddsApiKey ? DATA_SOURCES.LIVE : DATA_SOURCES.SIMULATED,
      sportValidation: validationResult,
      timestamp: new Date().toISOString()
    };
    
    console.log(`${LOG_PREFIXES.API} ← Sending response with ${cards.length} cards`);
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
    const contextualCards = generateContextualCards(category, sport, contextualCount);
    console.log(`${LOG_PREFIXES.API}   Generated ${contextualCards.length} contextual cards`);
    cards.push(...contextualCards);
  }

  console.log(`${LOG_PREFIXES.API} �� Final result: ${cards.length} total cards`);
  console.log(`${LOG_PREFIXES.API} ----------------------------------------`);
  return cards.slice(0, limit);
}

// Helper functions moved to odds-transformer.ts for reusability

function generateContextualCards(category?: string, sport?: string, count: number = 3): any[] {
  const cards: any[] = [];
  
  // DFS contextual card
  if (category === 'dfs' || !category) {
    cards.push({
      type: CARD_TYPES.DFS_STRATEGY,
      title: 'DFS Strategy Insight',
      icon: 'Award',
      category: sport?.toUpperCase() || 'DFS',
      subcategory: 'Lineup Building',
      gradient: 'from-green-500 to-emerald-600',
      data: {
        focus: 'Value identification in today\'s slate',
        approach: 'Target game environments with high totals',
        strategy: 'Leverage ownership discrepancies',
        recommendation: 'Stack correlated plays in GPPs'
      },
      status: CARD_STATUS.OPTIMAL,
      realData: false
    });
  }

  // Fantasy contextual card
  if (category === 'fantasy' || !category) {
    cards.push({
      type: CARD_TYPES.FANTASY_INSIGHT,
      title: 'Draft Strategy',
      icon: 'TrendingUp',
      category: 'FANTASY',
      subcategory: 'Value Targets',
      gradient: 'from-green-600 to-teal-600',
      data: {
        focus: 'ADP inefficiencies in current market',
        approach: 'Target players with usage trajectory',
        timing: 'Mid-rounds offer best value',
        recommendation: 'Monitor news for injury replacements'
      },
      status: CARD_STATUS.TARGET,
      realData: false
    });
  }

  // Kalshi contextual card
  if (category === 'kalshi' || !category) {
    cards.push({
      type: CARD_TYPES.KALSHI_INSIGHT,
      title: 'Prediction Market Analysis',
      icon: 'BarChart3',
      category: 'KALSHI',
      subcategory: 'Market Opportunities',
      gradient: 'from-cyan-500 to-blue-600',
      data: {
        focus: 'Event-based market inefficiencies',
        approach: 'Cross-reference with betting markets',
        edge: 'Arbitrage opportunities available',
        recommendation: 'Monitor for pricing discrepancies'
      },
      status: CARD_STATUS.OPPORTUNITY,
      realData: false
    });
  }

  return cards.slice(0, count);
}
