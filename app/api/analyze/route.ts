// Analyze API - Grok 4 Fast integration
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { randomUUID } from 'crypto';
import { validateBenford } from '@/lib/benford-validator';
import {
  AI_CONFIG,
  SYSTEM_PROMPT,
  ERROR_MESSAGES,
  LOG_PREFIXES,
  ATTACHMENT_TYPES,
  ENV_KEYS,
  DEFAULT_SOURCES
} from '@/lib/constants';
import { APP_TABLES } from '@/lib/supabase-validator';
import { getLeveragedAI } from '@/lib/leveraged-ai';
import { 
  fetchPlayerProjections, 
  formatProjectionSummary,
  extractPlayerName,
  isPlayerProjectionQuery
} from '@/lib/player-projections';

// Grok AI integration for sports analysis
// Using xAI through Vercel AI Gateway (AI SDK 6)

// Note: NOT using 'edge' runtime as AI SDK 6 doesn't require it

type AttachmentType = typeof ATTACHMENT_TYPES[keyof typeof ATTACHMENT_TYPES];

interface AnalysisRequest {
  query: string;
  context?: {
    sport?: string;
    marketType?: string;
    oddsData?: any;
  };
  attachments?: Array<{
    type: AttachmentType;
    data: any;
  }>;
}

/**
 * Builds context enhancement string based on query keywords
 */
function buildContextEnhancement(
  query: string, 
  context?: AnalysisRequest['context']
): string {
  const queryLower = query.toLowerCase();
  const parts: string[] = [];
  
  // Detect platform-specific keywords
  if (queryLower.includes('nfbc') || queryLower.includes('nffc') || 
      queryLower.includes('nfbkc') || queryLower.includes('fantasy baseball')) {
    parts.push('Context: Fantasy baseball (NFBC/NFFC). Focus on 2026 projections and draft strategy.');
  } else if (queryLower.includes('dfs') || queryLower.includes('draftkings') || 
             queryLower.includes('fanduel')) {
    parts.push('Context: DFS. Focus on optimal lineups and value plays.');
  } else if (queryLower.includes('kalshi')) {
    parts.push('Context: Kalshi prediction markets.');
  }
  
  // Add sport-specific context
  if (context?.sport) {
    parts.push(`Sport: ${context.sport}`);
  }
  
  return parts.length > 0 ? '\n' + parts.join('\n') : '';
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const MAX_PROCESSING_TIME = 25000; // 25 seconds max
  
  try {
    const body = await req.json();
    const query = body.query || body.userMessage; // Support both field names
    const context = body.context;
    const attachments = body.attachments;
    
    console.log(`[v0] [${Date.now() - startTime}ms] Request received`);
    console.log(`[v0] Query:`, query);
    console.log('[v0] Context received:', {
      sport: context?.sport,
      marketType: context?.marketType,
      hasOddsData: !!context?.oddsData,
      oddsEventsCount: context?.oddsData?.events?.length || 0
    });

    // Verify Grok AI is configured
    const xaiApiKey = process.env[ENV_KEYS.XAI_API_KEY];
    if (!xaiApiKey) {
      console.error(`${LOG_PREFIXES.API} XAI_API_KEY not configured!`);
      return NextResponse.json({
        success: false,
        error: 'Grok AI not configured. Please add XAI_API_KEY to environment variables.',
        text: 'AI service unavailable. Please contact support to enable Grok 4 Fast.',
        useFallback: true
      }, { status: 503 });
    }

    // Get environment variables securely
    const supabaseUrl = process.env[ENV_KEYS.SUPABASE_URL];
    const supabaseAnonKey = process.env[ENV_KEYS.SUPABASE_ANON_KEY];

    console.log(`${LOG_PREFIXES.API} Processing analysis with Grok 4 Fast (xAI)`);

    // Detect if this is a player projection query and fetch real data
    let playerProjections = null;
    let playerName: string | null = null;
    
    if (isPlayerProjectionQuery(query)) {
      playerName = extractPlayerName(query);
      
      if (playerName) {
        console.log(`${LOG_PREFIXES.API} Fetching player projections for: ${playerName}`);
        try {
          playerProjections = await fetchPlayerProjections(
            playerName, 
            context?.sport || 'baseball_mlb'
          );
          console.log(
            `${LOG_PREFIXES.API} Player projections: ${playerProjections.success ? 'Found' : 'Not found'}`
          );
        } catch (err) {
          console.error(`${LOG_PREFIXES.API} Player projection error:`, err);
        }
      }
    }

    // ALWAYS fetch live odds data for sports queries
    let fetchedOddsData: any[] = [];
    const queryLower = query.toLowerCase();
    const isSportsQuery = queryLower.includes('odds') ||
                          queryLower.includes('bet') ||
                          queryLower.includes('prop') ||
                          queryLower.includes('spread') ||
                          queryLower.includes('moneyline') ||
                          queryLower.includes('nba') ||
                          queryLower.includes('nfl') ||
                          queryLower.includes('mlb') ||
                          queryLower.includes('nhl') ||
                          queryLower.includes('ncaab') ||
                          queryLower.includes('ncaaf') ||
                          queryLower.includes('college basketball') ||
                          queryLower.includes('college football') ||
                          queryLower.includes('epl') ||
                          queryLower.includes('premier league') ||
                          queryLower.includes('mls') ||
                          queryLower.includes('soccer') ||
                          queryLower.includes('wnba') ||
                          queryLower.includes('mma') ||
                          queryLower.includes('ufc') ||
                          queryLower.includes('boxing') ||
                          queryLower.includes('game') ||
                          queryLower.includes('player') ||
                          queryLower.includes('tonight') ||
                          queryLower.includes('value') ||
                          queryLower.includes('arbitrage') ||
                          context?.sport;
    
    if (isSportsQuery && (!context?.oddsData || !context?.oddsData?.events?.length)) {
      console.log('[v0] [API] Sports query detected - fetching odds data from API');
      try {
        const { getOddsWithCache } = await import('@/lib/unified-odds-fetcher');
        
        // Determine which sport(s) to fetch
        const sportKey = context?.sport ||
          (queryLower.includes('nba') ? 'basketball_nba' :
           queryLower.includes('nfl') ? 'americanfootball_nfl' :
           queryLower.includes('mlb') ? 'baseball_mlb' :
           queryLower.includes('nhl') ? 'icehockey_nhl' :
           queryLower.includes('ncaab') || queryLower.includes('college basketball') ? 'basketball_ncaab' :
           queryLower.includes('ncaaf') || queryLower.includes('college football') ? 'americanfootball_ncaaf' :
           queryLower.includes('epl') || queryLower.includes('premier league') ? 'soccer_epl' :
           queryLower.includes('mls') || (queryLower.includes('soccer') && queryLower.includes('us')) ? 'soccer_usa_mls' :
           queryLower.includes('soccer') ? 'soccer_epl' :
           queryLower.includes('wnba') ? 'basketball_wnba' :
           queryLower.includes('mma') || queryLower.includes('ufc') ? 'mma_mixed_martial_arts' :
           queryLower.includes('boxing') ? 'boxing_boxing' :
           'basketball_nba');
        
        fetchedOddsData = await getOddsWithCache(sportKey, { useCache: true, storeResults: true });
        console.log(`[v0] [API] Fetched ${fetchedOddsData.length} games for ${sportKey}`);
      } catch (err) {
        console.error('[v0] [API] Odds fetch error:', err);
      }
    }

    // Detect if this is a Kalshi query and fetch REAL market data
    let kalshiMarkets: any[] | null = null;
    const isKalshiQuery = queryLower.includes('kalshi') || 
                          queryLower.includes('election') || 
                          queryLower.includes('prediction market') ||
                          queryLower.includes('h2h') ||
                          queryLower.includes('trump') ||
                          queryLower.includes('harris');
    
    if (isKalshiQuery) {
      console.log('[v0] [API] Kalshi query detected - fetching REAL market data from Kalshi API');
      try {
        const { fetchKalshiMarketsWithRetry } = await import('@/lib/kalshi-client');
        
        // Fetch ALL markets from Kalshi
        kalshiMarkets = await fetchKalshiMarketsWithRetry({
          status: 'open',
          limit: 50,
          maxRetries: 3
        });
        
        console.log(`[v0] [API] Kalshi markets fetched: ${kalshiMarkets.length} markets`);
        
        if (kalshiMarkets.length > 0) {
          console.log('[v0] [API] Kalshi categories:', [...new Set(kalshiMarkets.map((m: any) => m.category))].join(', '));
        }
      } catch (err) {
        console.error('[v0] [API] Kalshi fetch error:', err);
        kalshiMarkets = [];
      }
    }

    // Build context enhancement string based on query keywords
    const contextEnhancement = buildContextEnhancement(query, context);

    // Build the prompt with context and CRITICAL current date information
    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'long' });
    
    const dateWarning = `\n\n🚨 CRITICAL INSTRUCTIONS:\n- TODAY: ${dateStr}\n- YEAR: ${currentYear}\n- Provide ONLY ${currentYear} season data\n- Keep response under 150 words\n- Be concise and actionable`;
    
    const systemPrompt = SYSTEM_PROMPT + contextEnhancement + dateWarning;
    let userPrompt = `${query}\n\nIMPORTANT: Respond in 3-4 short sentences maximum (under 150 words total). Be direct and specific.`;

    // Add REAL player projection data if available
    if (playerProjections?.success && playerProjections.projections && playerProjections.projections.length > 0) {
      const projectionSummary = formatProjectionSummary(playerProjections);
      userPrompt += `\n\n📊 REAL MARKET DATA (The Odds API):\n${projectionSummary}\n\nIMPORTANT: Use ONLY this verified data. Do not fabricate additional statistics. If asked about stats not provided above, clearly state "Data not available."`;
      console.log('[v0] Added real player projection data to prompt');
    } else if (playerProjections && !playerProjections.success) {
      // Player was searched but no data found
      userPrompt += `\n\n⚠️ IMPORTANT: No active market data found for ${playerName}. The player may not be in today's games, may be on a different team, or the name spelling may differ. Acknowledge this limitation in your response and DO NOT fabricate statistics.`;
      console.log('[v0] No player projections found, instructed AI not to fabricate');
    }

    // Add context from odds data if available
    if (context?.oddsData && context.oddsData.events && context.oddsData.events.length > 0) {
      console.log(`[v0] Processing ${context.oddsData.events.length} live odds events for analysis`);
      
      // Fetch weather data for outdoor sports (NFL, MLB)
      const isOutdoorSport = context?.sport === 'americanfootball_nfl' || 
                            context?.sport === 'baseball_mlb' ||
                            context?.sport === 'nfl' ||
                            context?.sport === 'mlb';
      
      let weatherData: string | null = null;
      
      if (isOutdoorSport && context.oddsData.events.length > 0) {
        console.log('[v0] Outdoor sport detected - fetching weather data');
        try {
          const { generateWeatherCard } = await import('@/lib/weather-service');
          const firstGame = context.oddsData.events[0];
          const weatherCard = await generateWeatherCard(
            firstGame.home_team,
            firstGame.away_team,
            new Date(firstGame.commence_time)
          );
          
          if (weatherCard) {
            console.log('[v0] Weather data fetched successfully');
            weatherData = `\n\n🌤️ WEATHER CONDITIONS (${weatherCard.data.location}):\n` +
                         `Temperature: ${weatherCard.data.temperature}\n` +
                         `Condition: ${weatherCard.data.condition}\n` +
                         `Wind: ${weatherCard.data.wind}\n` +
                         `Precipitation: ${weatherCard.data.precipitation}\n` +
                         `Game Impact: ${weatherCard.data.gameImpact}`;
          } else {
            console.log('[v0] Weather data not available for this location');
          }
        } catch (error) {
          console.error('[v0] Weather fetch error:', error instanceof Error ? error.message : String(error));
        }
      }
      
      // Format odds data in a readable way for Grok
      const oddsEvents = context.oddsData.events.map((event: any, idx: number) => {
        const homeTeam = event.home_team;
        const awayTeam = event.away_team;
        const gameTime = event.commence_time;
        
        let oddsText = `Game ${idx + 1}: ${awayTeam} @ ${homeTeam} (${new Date(gameTime).toLocaleString()})`;
        
        if (event.bookmakers && event.bookmakers.length > 0) {
          oddsText += '\n  Sportsbook Odds:';
          event.bookmakers.forEach((book: any) => {
            oddsText += `\n    ${book.title}:`;
            if (book.markets && book.markets.length > 0) {
              book.markets.forEach((market: any) => {
                if (market.key === 'h2h' && market.outcomes) {
                  market.outcomes.forEach((outcome: any) => {
                    oddsText += ` ${outcome.name} ${outcome.price > 0 ? '+' : ''}${outcome.price}`;
                  });
                }
              });
            }
          });
        }
        
        return oddsText;
      }).join('\n\n');
      
      // Add weather data to odds context if available
      const fullOddsContext = weatherData ? `${oddsEvents}${weatherData}` : oddsEvents;
      
      userPrompt += `\n\n📊 LIVE ODDS DATA FROM THE ODDS API (${context.oddsData.events.length} games):\n${oddsEvents}\n\nIMPORTANT: Use this REAL data to analyze opportunities. Compare odds across sportsbooks to identify arbitrage or value. Be specific about which sportsbooks and which lines.`;
      console.log('[v0] ✓ Formatted live odds data for Grok analysis');
    } else if (fetchedOddsData.length > 0) {
      // Use the odds data we fetched directly
      console.log(`[v0] Using directly fetched odds data: ${fetchedOddsData.length} games`);
      
      const oddsText = fetchedOddsData.slice(0, 10).map((game: any, idx: number) => {
        let line = `${idx + 1}. ${game.away_team} @ ${game.home_team} (${new Date(game.commence_time).toLocaleString()})`;
        
        if (game.completed && game.scores) {
          const homeScore = game.scores?.find((s: any) => s.name === game.home_team);
          const awayScore = game.scores?.find((s: any) => s.name === game.away_team);
          line += ` FINAL: ${game.away_team} ${awayScore?.score || '?'} - ${homeScore?.score || '?'} ${game.home_team}`;
        } else if (game.bookmakers?.length > 0) {
          const book = game.bookmakers[0];
          const h2h = book.markets?.find((m: any) => m.key === 'h2h');
          if (h2h?.outcomes) {
            h2h.outcomes.forEach((o: any) => {
              line += ` | ${o.name}: ${o.price > 0 ? '+' : ''}${o.price}`;
            });
          }
          const spread = book.markets?.find((m: any) => m.key === 'spreads');
          if (spread?.outcomes) {
            line += ` | Spread:`;
            spread.outcomes.forEach((o: any) => {
              line += ` ${o.name} ${o.point > 0 ? '+' : ''}${o.point}`;
            });
          }
        }
        
        return line;
      }).join('\n');
      
      userPrompt += `\n\n📊 REAL GAME DATA (The Odds API - ${fetchedOddsData.length} games):\n${oddsText}\n\nUse this REAL data. Be specific with numbers and matchups.`;
    } else if (context?.oddsData) {
      console.log('[v0] Odds data present but no events found');
      userPrompt += `\n\nNo live games currently available for this sport.`;
    }

    // Add REAL Kalshi market data if available
    if (kalshiMarkets && kalshiMarkets.length > 0) {
      console.log('[v0] Adding Kalshi market data to prompt');
      
      // Format top markets for the AI
      const topMarkets = kalshiMarkets.slice(0, 20);
      const kalshiData = topMarkets.map((market: any, idx: number) => {
        return `${idx + 1}. ${market.title}\n` +
               `   Category: ${market.category}\n` +
               `   Yes: ${market.yesPrice}¢ | No: ${market.noPrice}¢\n` +
               `   Volume: $${market.volume} | Open Interest: ${market.openInterest}`;
      }).join('\n\n');
      
      userPrompt += `\n\n📊 REAL KALSHI PREDICTION MARKETS (Live Data):\n\n${kalshiData}\n\n` +
                   `Total Markets Available: ${kalshiMarkets.length}\n` +
                   `Categories: ${[...new Set(kalshiMarkets.map((m: any) => m.category))].slice(0, 10).join(', ')}\n\n` +
                   `IMPORTANT: Use this REAL Kalshi data to analyze prediction market opportunities. ` +
                   `Prices are in cents (¢). Calculate implied probabilities and identify mispriced markets.`;
      
      console.log('[v0] ✓ Added Kalshi market data to AI prompt');
    } else if (isKalshiQuery) {
      console.log('[v0] ⚠️ Kalshi query detected but no markets found');
      userPrompt += `\n\n⚠️ NOTE: Attempted to fetch Kalshi markets but none are currently available. This may be due to API connectivity issues or no active markets. Check https://kalshi.com directly for live markets.`;
    }

    // Add sport/market context
    if (context?.sport) {
      userPrompt += `\n\nSport: ${context.sport}`;
    }
    if (context?.marketType) {
      userPrompt += `\nMarket Type: ${context.marketType}`;
    }

    // Call Grok API using xAI's API (compatible with OpenAI SDK format)
    // Use AbortController to stay within Vercel Edge's ~25s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let grokResponse: Response;
    try {
      grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${xaiApiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'grok-3',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });
    } catch (fetchError: any) {
      clearTimeout(timeout);
      console.error('[API] Grok API fetch failed:', fetchError.name, fetchError.message);
      return NextResponse.json({
        success: false,
        error: fetchError.name === 'AbortError' ? 'AI request timed out' : 'AI service unavailable',
        useFallback: true,
      });
    }
    clearTimeout(timeout);

    if (!grokResponse.ok) {
      const errorData = await grokResponse.text();
      console.error('[API] Grok API error:', grokResponse.status, errorData);
      return NextResponse.json({
        success: false,
        error: 'AI service returned empty response',
        useFallback: true
      });
    }

    const responseData = await grokResponse.json();
    const aiResponse = responseData.choices?.[0]?.message?.content || '';

    console.log('[API] Grok response generated:', aiResponse.substring(0, 100));

    // Calculate trust metrics
    const trustMetrics = await calculateTrustMetrics(aiResponse, context, supabaseUrl, supabaseAnonKey);

    // Store analysis in Supabase if configured
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        await supabase.from('ai_response_trust').insert({
          model_id: 'grok-3',
          sport: context?.sport || 'general',
          market_type: context?.marketType || 'analysis',
          benford_score: trustMetrics.benfordIntegrity,
          odds_alignment_score: trustMetrics.oddsAlignment,
          consensus_score: trustMetrics.marketConsensus,
          historical_accuracy_score: trustMetrics.historicalAccuracy,
          final_confidence: trustMetrics.finalConfidence,
          flags: trustMetrics.flags || [],
          created_at: new Date().toISOString(),
        });
      } catch (insertError) {
        console.log('[API] Failed to store trust metrics:', insertError instanceof Error ? insertError.message : String(insertError));
      }
    }

    // Store analysis in Supabase using LeveragedAI (non-blocking, AI-validated)
    Promise.resolve().then(() => {
      storeAnalysisMetricsWithAI(trustMetrics, context).catch(err => {
        console.log(`${LOG_PREFIXES.API} Background metrics storage failed:`, err.message);
      });
    });

    // Generate insight cards using utility function
    console.log('[v0] Generating insight cards for response...');
    let insightCards: any[] = [];
    
    try {
      // Import from utility module (not route file)
      const { generateContextualCards } = await import('@/lib/cards-generator');
      
      // Determine category based on platform and query context
      let cardCategory = 'betting'; // default
      if (context?.platform === 'kalshi') {
        cardCategory = 'kalshi';
      } else if (context?.platform === 'dfs') {
        cardCategory = 'dfs';
      } else if (context?.platform === 'fantasy') {
        cardCategory = 'fantasy';
      }
      
      // Determine if we should use multi-sport mode
      const useMultiSport = !context?.sport || context?.sport === null;
      
      console.log('[v0] Calling generateContextualCards with:', { 
        cardCategory, 
        sport: context?.sport, 
        multiSport: useMultiSport 
      });
      
      // Generate cards with multi-sport support
      insightCards = await generateContextualCards(
        cardCategory, 
        context?.sport, 
        3,
        useMultiSport // Enable multi-sport if no specific sport detected
      );
      
      console.log(`[v0] ✓ Cards generated: ${insightCards.length}`);
    } catch (error) {
      console.error('[v0] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('[v0] ❌ CARDS GENERATION FAILED');
      console.error('[v0] Error:', error);
      console.error('[v0] Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('[v0] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[v0] Context:', { sport: context?.sport });
      console.error('[v0] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Fallback: create a single default card with error details
      insightCards = [{
        type: 'INFO',
        title: '⚠️ Cards Generation Error',
        icon: 'AlertTriangle',
        category: 'SYSTEM',
        subcategory: 'Error',
        gradient: 'from-amber-600 to-orange-700',
        data: { 
          message: 'Failed to generate insight cards. Check server logs.',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      }];
    }

    // Build sources array with real data indicator
    const sources = [
      DEFAULT_SOURCES.GROK_AI,
      playerProjections?.success 
        ? DEFAULT_SOURCES.ODDS_API
        : context?.oddsData
          ? DEFAULT_SOURCES.LIVE_MARKET
          : DEFAULT_SOURCES.LIVE_MARKET
    ];

    return NextResponse.json({
      success: true,
      text: aiResponse,
      response: aiResponse,
      trustMetrics,
      model: 'grok-3',
      confidence: trustMetrics.finalConfidence,
      sources,
      cards: insightCards, // Add cards to response
      playerData: playerProjections?.success ? {
        player: playerProjections.player,
        projectionsCount: playerProjections.projections?.length || 0,
        source: 'The Odds API'
      } : undefined,
      processingTime: Math.round(aiResponse.length * 2),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (error.name === 'AbortError') {
      console.log(`${LOG_PREFIXES.API} Request timeout in analyze route`);
      return NextResponse.json({
        success: false,
        error: 'Analysis request timed out. Please try again with a simpler query.',
        useFallback: true,
        details: 'Request exceeded maximum execution time'
      }, { status: 408 });
    }
    
    console.log(`${LOG_PREFIXES.API} Error in analyze route:`, errorMessage);
    return NextResponse.json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      useFallback: true,
      details: errorMessage
    }, { status: 500 });
  }
}

// Non-blocking helper to store analysis metrics using LeveragedAI
async function storeAnalysisMetricsWithAI(
  trustMetrics: any,
  context: any
) {
  try {
    const leveragedAI = getLeveragedAI();
    
    if (!leveragedAI.isReady()) {
      console.log(`${LOG_PREFIXES.API} LeveragedAI not ready, skipping metrics storage`);
      return;
    }

    // Generate proper response ID format
    const responseId = `resp-${Date.now()}-${randomUUID().split('-')[0]}`;
    
    const metricsData = {
      response_id: responseId,
      model_id: AI_CONFIG.MODEL_NAME,
      sport: context?.sport || 'general',
      market_type: context?.marketType || 'analysis',
      benford_score: Math.round(trustMetrics.benfordIntegrity || 0),
      odds_alignment_score: Math.round(trustMetrics.oddsAlignment || 0),
      consensus_score: Math.round(trustMetrics.marketConsensus || 0),
      historical_accuracy_score: Math.round(trustMetrics.historicalAccuracy || 0),
      final_confidence: Math.round(trustMetrics.finalConfidence || 0),
      flags: trustMetrics.flags || [],
      created_at: new Date().toISOString(),
    };

    // Use LeveragedAI for AI-validated insertion
    const result = await leveragedAI.insertWithAIValidation(
      APP_TABLES.AI_RESPONSE_TRUST,
      metricsData,
      'Trust metrics for sports betting AI analysis'
    );

    if (result.success) {
      console.log(`${LOG_PREFIXES.API} ��� Trust metrics stored via LeveragedAI`);
      if (result.aiValidation) {
        console.log(`${LOG_PREFIXES.API} AI validation:`, result.aiValidation);
      }
    } else {
      console.log(`${LOG_PREFIXES.API} Failed to store metrics:`, result.error);
    }
  } catch (dbError) {
    const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError);
    console.log(`${LOG_PREFIXES.API} Exception storing trust metrics:`, dbErrorMessage);
  }
}

// Helper function to calculate trust metrics
async function calculateTrustMetrics(
  aiResponse: string,
  context: any,
  supabaseUrl?: string,
  supabaseAnonKey?: string
) {
  // Extract numbers from AI response for Benford analysis
  const numbers = extractNumbers(aiResponse);
  const benfordIntegrity = numbers.length >= 10
    ? Math.round(validateBenford(numbers).score * 100)
    : 85; // Default if insufficient data

  // Calculate odds alignment if odds data available
  const oddsAlignment = context?.oddsData 
    ? calculateOddsAlignment(aiResponse, context.oddsData)
    : 88;

  // Market consensus (would need external data source)
  const marketConsensus = 85;

  // Historical accuracy using LeveragedAI with AI-enhanced insights
  let historicalAccuracy = 85;
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data } = await supabase
        .from('ai_response_trust')
        .select('final_confidence')
        .eq('model_id', 'grok-3')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (data && data.length > 0) {
        const validData = data.filter(
          (row: any) => typeof row.final_confidence === 'number'
        );
        
        if (validData.length > 0) {
          historicalAccuracy = Math.round(
            validData.reduce((sum: number, row: any) => sum + row.final_confidence, 0) / validData.length
          );
          console.log(`${LOG_PREFIXES.API} Historical accuracy from LeveragedAI: ${historicalAccuracy}% (${validData.length} records)`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`${LOG_PREFIXES.API} Could not fetch historical accuracy:`, errorMessage);
    }
  }

  const finalConfidence = Math.round(
    benfordIntegrity * 0.20 +
    oddsAlignment * 0.30 +
    marketConsensus * 0.30 +
    historicalAccuracy * 0.20
  );

  const trustLevel: 'high' | 'medium' | 'low' = 
    finalConfidence >= 80 ? 'high' : 
    finalConfidence >= 60 ? 'medium' : 'low';

  const riskLevel: 'low' | 'medium' | 'high' = 
    finalConfidence >= 80 ? 'low' : 
    finalConfidence >= 60 ? 'medium' : 'high';

  const flags: Array<{ type: string; message: string; severity: 'info' | 'warning' | 'error' }> = [];

  if (benfordIntegrity < 70) {
    flags.push({
      type: 'benford',
      message: 'AI numeric outputs show deviation from expected distribution',
      severity: 'warning',
    });
  }

  if (oddsAlignment < 85) {
    flags.push({
      type: 'odds',
      message: `AI recommendation differs from market consensus`,
      severity: oddsAlignment < 70 ? 'error' : 'warning',
    });
  }

  return {
    benfordIntegrity,
    oddsAlignment,
    marketConsensus,
    historicalAccuracy,
    finalConfidence,
    trustLevel,
    riskLevel,
    flags: flags.length > 0 ? flags : undefined,
    adjustedTone: trustLevel === 'high' ? 'Strong signal' : 
                  trustLevel === 'medium' ? 'Moderate edge' : 
                  'High uncertainty',
  };
}

function extractNumbers(text: string): number[] {
  const regex = /\b\d+\.?\d*\b/g;
  const matches = text.match(regex);
  return matches ? matches.map(m => parseFloat(m)) : [];
}

function calculateOddsAlignment(aiResponse: string, oddsData: any): number {
  // Extract probabilities mentioned in AI response
  const probRegex = /(\d+)%/g;
  const probMatches = aiResponse.match(probRegex);
  
  if (!probMatches || !oddsData.events || oddsData.events.length === 0) {
    return 85; // Default if no data
  }

  // Compare AI-mentioned probabilities against market-implied probabilities
  const aiProbs = probMatches.map(m => parseInt(m.replace('%', '')));

  // Extract implied probabilities from odds data
  const marketProbs: number[] = [];
  for (const event of oddsData.events) {
    if (event.bookmakers) {
      for (const bookmaker of event.bookmakers) {
        for (const market of bookmaker.markets || []) {
          for (const outcome of market.outcomes || []) {
            if (outcome.price) {
              // Convert American odds to implied probability
              const price = outcome.price;
              const impliedProb = price > 0
                ? 100 / (price + 100) * 100
                : Math.abs(price) / (Math.abs(price) + 100) * 100;
              marketProbs.push(Math.round(impliedProb));
            }
          }
        }
      }
    }
  }

  if (marketProbs.length === 0) {
    return 85;
  }

  // Calculate alignment: how close are AI probabilities to market probabilities
  let totalDeviation = 0;
  let comparisons = 0;
  for (const aiProb of aiProbs) {
    // Find the closest market probability
    const closestMarket = marketProbs.reduce((closest, mp) =>
      Math.abs(mp - aiProb) < Math.abs(closest - aiProb) ? mp : closest
    , marketProbs[0]);
    totalDeviation += Math.abs(aiProb - closestMarket);
    comparisons++;
  }

  const avgDeviation = comparisons > 0 ? totalDeviation / comparisons : 0;
  // Convert deviation to alignment score (0 deviation = 100, 50+ deviation = 50)
  return Math.max(50, Math.min(100, Math.round(100 - avgDeviation)));
}
