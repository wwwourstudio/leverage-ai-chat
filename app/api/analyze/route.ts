import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import {
  AI_CONFIG,
  SYSTEM_PROMPT,
  DEFAULT_TRUST_METRICS,
  DEFAULT_SOURCES,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from '@/lib/constants';
import { generateContextualCards, type InsightCard } from '@/lib/cards-generator';

// ============================================================================
// Types
// ============================================================================

interface AnalyzeRequestBody {
  userMessage: string;
  context?: {
    sport?: string | null;
    marketType?: string | null;
    platform?: string | null;
    isSportsQuery?: boolean;
    isPoliticalMarket?: boolean;
    hasBettingIntent?: boolean;
    oddsData?: any;
    noGamesAvailable?: boolean;
    noGamesMessage?: string;
    previousMessages?: Array<{ role: string; content: string }>;
  };
}

// ============================================================================
// POST /api/analyze
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: AnalyzeRequestBody = await request.json();
    const { userMessage, context = {} } = body;

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.INVALID_REQUEST },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Determine analysis category from context
    const category = context.isPoliticalMarket
      ? 'kalshi'
      : context.hasBettingIntent
        ? 'betting'
        : 'all';

    // Build the enriched prompt with any real odds data
    let enrichedPrompt = userMessage;

    if (context.oddsData?.events?.length > 0) {
      const oddsPreview = context.oddsData.events
        .slice(0, 5)
        .map((e: any) => {
          const book = e.bookmakers?.[0];
          const h2h = book?.markets?.find((m: any) => m.key === 'h2h');
          const outcomes = h2h?.outcomes || [];
          const home = outcomes.find((o: any) => o.name === e.home_team);
          const away = outcomes.find((o: any) => o.name === e.away_team);
          return `${e.away_team} @ ${e.home_team} | ${away?.price ?? 'N/A'} / ${home?.price ?? 'N/A'} (${book?.title ?? 'N/A'})`;
        })
        .join('\n');

      enrichedPrompt += `\n\n--- REAL LIVE ODDS DATA (use ONLY this data) ---\nSport: ${context.oddsData.sport}\n${oddsPreview}\n--- END ODDS DATA ---`;
    }

    if (context.noGamesAvailable) {
      enrichedPrompt += `\n\nNote: ${context.noGamesMessage}`;
    }

    // Attempt AI generation via Vercel AI Gateway
    const xaiApiKey = process.env.XAI_API_KEY;
    const oddsApiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
    const kalshiApiKey = process.env.KALSHI_API_KEY;
    console.log('[API/analyze] Keys configured:', {
      XAI_API_KEY: !!xaiApiKey,
      ODDS_API_KEY: !!oddsApiKey,
      KALSHI_API_KEY: !!kalshiApiKey,
      hasOddsData: !!(context.oddsData?.events?.length),
    });
    let aiText: string;
    let modelUsed = AI_CONFIG.MODEL_DISPLAY_NAME;
    let usedFallback = false;

    if (xaiApiKey) {
      try {
        const result = await generateText({
          model: createXai({ apiKey: xaiApiKey })('grok-3-fast'),
          system: SYSTEM_PROMPT,
          prompt: enrichedPrompt,
          temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
          maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
          maxRetries: 2,
        });

        aiText = result.text;
      } catch (aiError) {
        console.error('[API/analyze] AI generation failed:', aiError);
        aiText = generateFallbackResponse(userMessage, context);
        modelUsed = 'Fallback';
        usedFallback = true;
      }
    } else {
      aiText = generateFallbackResponse(userMessage, context);
      modelUsed = 'Fallback';
      usedFallback = true;
    }

    // Generate contextual insight cards
    let cards: InsightCard[] = [];
    try {
      cards = await generateContextualCards(
        category,
        context.sport ?? undefined,
        3
      );
    } catch (cardError) {
      console.error('[API/analyze] Card generation failed:', cardError);
    }

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      text: aiText,
      cards,
      confidence: usedFallback ? 70 : 88,
      sources: [
        usedFallback
          ? { name: 'Cached Data', type: 'cache', reliability: 70 }
          : DEFAULT_SOURCES.GROK_AI,
        ...(context.oddsData ? [DEFAULT_SOURCES.ODDS_API] : []),
      ],
      modelUsed,
      trustMetrics: usedFallback
        ? {
            ...DEFAULT_TRUST_METRICS,
            finalConfidence: 70,
            confidence: 70,
            trustLevel: 'medium',
            riskLevel: 'medium',
            adjustedTone: 'Limited data',
            flags: [{ type: 'info', message: 'Using fallback mode', severity: 'info' }],
          }
        : DEFAULT_TRUST_METRICS,
      processingTime,
      useFallback: usedFallback,
    });
  } catch (error) {
    console.error('[API/analyze] Unhandled error:', error);
    return NextResponse.json(
      {
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

// ============================================================================
// Fallback response when AI is unavailable
// ============================================================================

function generateFallbackResponse(
  userMessage: string,
  context: AnalyzeRequestBody['context'] = {}
): string {
  const lowerMsg = userMessage.toLowerCase();

  if (context?.isPoliticalMarket) {
    return 'Prediction market analysis requires a configured AI service. Please ensure XAI_API_KEY is set to enable Kalshi and prediction market insights.';
  }

  if (context?.noGamesAvailable) {
    return context.noGamesMessage || 'No live games are currently scheduled for this sport.';
  }

  if (context?.oddsData?.events?.length) {
    const count = context.oddsData.events.length;
    return `Found ${count} live games with odds data. Configure XAI_API_KEY for detailed AI-powered analysis of these matchups.`;
  }

  if (context?.hasBettingIntent) {
    return 'Sports betting analysis is available when the AI service is configured. Set up XAI_API_KEY for real-time odds analysis, arbitrage detection, and betting recommendations.';
  }

  return 'AI analysis is currently unavailable. Please configure XAI_API_KEY to enable Grok-powered insights. In the meantime, you can browse the live data cards below.';
}
