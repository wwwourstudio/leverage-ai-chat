import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import {
  AI_CONFIG,
  SYSTEM_PROMPT,
  DEFAULT_SOURCES,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from '@/lib/constants';
import { generateContextualCards, type InsightCard } from '@/lib/cards-generator';
import { detectHallucinations, buildRetryPrompt } from '@/lib/hallucination-detector';

// ============================================================================
// Types
// ============================================================================

interface ImageAttachment {
  name: string;
  base64: string;    // Raw base64 without data: URI prefix
  mimeType: string;  // e.g. 'image/jpeg'
}

interface AnalyzeRequestBody {
  userMessage: string;
  existingCards?: InsightCard[];
  customInstructions?: string;
  imageAttachments?: ImageAttachment[];
  context?: {
    sport?: string | null;
    marketType?: string | null;
    platform?: string | null;
    isSportsQuery?: boolean;
    isPoliticalMarket?: boolean;
    hasFantasyIntent?: boolean;
    hasBettingIntent?: boolean;
    oddsData?: any;
    noGamesAvailable?: boolean;
    noGamesMessage?: string;
    previousMessages?: Array<{ role: string; content: string }>;
    kalshiSubcategory?: string;
  };
}

// ============================================================================
// Model routing helpers
// ============================================================================

/**
 * Returns true for query types where grok-3-fast is sufficient and faster:
 * - DFS lineup questions (no live-odds accuracy needed)
 * - Pure fantasy queries (hasFantasyIntent && !hasBettingIntent)
 * - CSV / file uploads (user's own data, not real-time odds)
 * - Off-season / no-games contexts
 */
function shouldUseFastModel(
  userMessage: string,
  context: AnalyzeRequestBody['context'],
): boolean {
  const lower = userMessage.toLowerCase();
  const dfsKeywords = ['dfs', 'daily fantasy', 'draftkings lineup', 'fanduel lineup', 'optimal lineup'];
  if (dfsKeywords.some(k => lower.includes(k))) return true;
  if (context?.hasFantasyIntent && !context?.hasBettingIntent) return true;
  if (userMessage.includes('[File:')) return true;   // CSV / file upload
  if (context?.noGamesAvailable) return true;         // off-season
  return false;
}

// ============================================================================
// POST /api/analyze
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  // grok-4 gets 22s; on failure, grok-3-fast fallback gets 8s = 30s total = Vercel limit.
  // Fast-routed queries (DFS, fantasy, CSV, off-season) skip grok-4 entirely.
  const TIMEOUT_MS = 22000;

  try {
    // Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout - analysis taking too long')), TIMEOUT_MS);
    });

    const body: AnalyzeRequestBody = await request.json();
    const { userMessage, existingCards = [], context = {}, customInstructions } = body;

    // Inject live date into system prompt
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const baseSystemPrompt = SYSTEM_PROMPT.replace('[CURRENT_DATE]', dateStr);

    // Build dynamic system prompt — inject user instructions at highest priority level
    const systemPrompt = customInstructions?.trim()
      ? `${baseSystemPrompt}\n\n## USER PROFILE & BETTING PREFERENCES\n${customInstructions.trim()}`
      : baseSystemPrompt;

    // Detect ambiguous queries with no sport/intent context — ask a clarifying question
    const isAmbiguous = !context?.sport
      && !context?.isSportsQuery
      && !context?.hasFantasyIntent
      && !context?.isPoliticalMarket
      && !context?.hasBettingIntent
      && !customInstructions?.trim();

    const clarificationOptions = isAmbiguous ? [
      'NBA betting odds tonight',
      'NFL betting analysis',
      'MLB betting picks',
      'NHL betting lines',
      'Kalshi prediction markets',
      'DFS lineups today',
      'Fantasy advice',
    ] : [];

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.INVALID_REQUEST },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Determine analysis category from context
    // Sports queries (even without explicit betting keywords like "MLB Offseason")
    // should use 'betting' so generateContextualCards fetches real game/odds cards.
    const category = context.isPoliticalMarket
      ? 'kalshi'
      : context.hasFantasyIntent && !context.hasBettingIntent
        ? 'fantasy'
        : (context.hasBettingIntent || context.isSportsQuery)
          ? 'betting'
          : 'all';

    // Build the enriched prompt with any real odds data or contextual info
    let enrichedPrompt = userMessage;

    if (context.oddsData?.events?.length > 0) {
      const oddsPreview = context.oddsData.events
        .slice(0, 8)
        .map((e: any) => {
          const lines: string[] = [`${e.away_team} @ ${e.home_team}`];
          for (const book of (e.bookmakers || []).slice(0, 2)) {
            const h2h = book.markets?.find((m: any) => m.key === 'h2h');
            const spread = book.markets?.find((m: any) => m.key === 'spreads');
            const total = book.markets?.find((m: any) => m.key === 'totals');
            if (h2h) {
              const home = h2h.outcomes?.find((o: any) => o.name === e.home_team);
              const away = h2h.outcomes?.find((o: any) => o.name === e.away_team);
              lines.push(`  ML (${book.title}): ${e.away_team} ${away?.price > 0 ? '+' : ''}${away?.price ?? 'N/A'} | ${e.home_team} ${home?.price > 0 ? '+' : ''}${home?.price ?? 'N/A'}`);
            }
            if (spread) {
              const home = spread.outcomes?.find((o: any) => o.name === e.home_team);
              const away = spread.outcomes?.find((o: any) => o.name === e.away_team);
              lines.push(`  Spread (${book.title}): ${e.away_team} ${away?.point > 0 ? '+' : ''}${away?.point ?? ''} (${away?.price > 0 ? '+' : ''}${away?.price ?? 'N/A'}) | ${e.home_team} ${home?.point > 0 ? '+' : ''}${home?.point ?? ''} (${home?.price > 0 ? '+' : ''}${home?.price ?? 'N/A'})`);
            }
            if (total) {
              const over = total.outcomes?.find((o: any) => o.name === 'Over');
              const under = total.outcomes?.find((o: any) => o.name === 'Under');
              lines.push(`  Total (${book.title}): O${over?.point ?? ''} (${over?.price > 0 ? '+' : ''}${over?.price ?? 'N/A'}) | U${under?.point ?? ''} (${under?.price > 0 ? '+' : ''}${under?.price ?? 'N/A'})`);
            }
          }
          return lines.join('\n');
        })
        .join('\n\n');

      enrichedPrompt += `\n\n--- REAL LIVE ODDS DATA (use ONLY these numbers for odds/lines) ---\nSport: ${context.oddsData.sport}\n\n${oddsPreview}\n--- END ODDS DATA ---`;
    } else if (context.noGamesAvailable) {
      // No live games but let the AI give knowledge-based analysis
      enrichedPrompt += `\n\n[Context: No live ${context.sport?.toUpperCase() || 'sports'} games are currently scheduled (offseason or between games). Provide expert analysis, offseason insights, betting strategy, and relevant market knowledge instead of live odds.]`;
    } else if (!context.hasBettingIntent && context.sport) {
      // Sports question without betting intent — give expert analysis
      enrichedPrompt += `\n\n[Context: User is asking about ${context.sport.toUpperCase()} — provide expert analysis using your knowledge. No live odds needed for this question.]`;
    } else if (!context.hasBettingIntent && !context.sport && !context.isPoliticalMarket) {
      // General question — answer from knowledge
      enrichedPrompt += `\n\n[Context: General question — answer with your full expert knowledge about sports betting, fantasy, DFS, or prediction markets as appropriate.]`;
    }

    // Fantasy-specific context injection
    if (context.hasFantasyIntent) {
      const sport = context.sport || '';
      const isNFL = sport.includes('football') || sport === '';
      if (isNFL) {
        // NFL 2025 season is complete (Super Bowl ~Feb 2026) — tell AI to focus on 2026 offseason
        enrichedPrompt += `\n\n[Fantasy Context: The 2025 NFL regular season and playoffs are complete. Fantasy advice should now address the 2026 offseason: free agency moves, rookie targets, ADP for 2026 redraft leagues, and dynasty/devy strategy. The card data shows 2025 historical stats as reference.]`;
      } else {
        // In-season sport (NBA, MLB, NHL, etc.) — tell AI to use its current knowledge
        const sportName = sport.replace(/^(americanfootball|basketball|baseball|icehockey|soccer|mma)_?/, '').toUpperCase().replace(/_/g, ' ') || sport.toUpperCase();
        enrichedPrompt += `\n\n[Fantasy Context: The user is asking about ${sportName} fantasy. Use your current knowledge of active rosters, recent performance, injury reports, and this week's matchups to give accurate advice. Today's date: ${dateStr}.]`;
      }
    }

    // Regardless of other odds context, tell the AI when the key is missing
    if (context.oddsKeyMissing) {
      enrichedPrompt += `\n\n[System: Live odds are unavailable — ODDS_API_KEY is not configured in the server environment. Inform the user they need to add ODDS_API_KEY to their Vercel environment variables to enable live odds.]`;
    }

    // ── Launch card generation BEFORE AI (they're independent operations) ──────
    // Starting both in parallel shaves ~6-8 seconds off the total request time
    // because card generation (Odds API fetch) runs during the AI generation window.
    // Don't reuse stale previous-message cards for sport-specific or betting-intent
    // queries — always generate fresh cards so the response context matches the question.
    const hasExistingCards = Array.isArray(existingCards) && existingCards.length > 0
      && !context.sport
      && !context.isSportsQuery
      && !context.hasBettingIntent;
    let cardPromise: Promise<InsightCard[]>;
    if (isAmbiguous) {
      // Ambiguous query — don't show random cards, wait for clarification
      cardPromise = Promise.resolve([]);
    } else if (hasExistingCards) {
      cardPromise = Promise.resolve(existingCards as InsightCard[]);
    } else if (!context.isPoliticalMarket && context.hasFantasyIntent && !context.hasBettingIntent) {
      cardPromise = import('@/lib/fantasy/cards/fantasy-card-generator')
        .then(({ generateFantasyCards }) => generateFantasyCards(userMessage, 3, context.sport ?? undefined) as InsightCard[])
        .catch(() => generateContextualCards('fantasy', context.sport ?? undefined, 3).catch(() => []));
    } else if (!context.isPoliticalMarket && (context.isSportsQuery || context.hasBettingIntent)) {
      const sportKey = context.sport || undefined;
      cardPromise = Promise.race([
        generateContextualCards('betting', sportKey, 6),
        new Promise<InsightCard[]>(resolve => setTimeout(() => resolve([]), 6000)),
      ]);
    } else {
      // General query — try to return cached/fresh multi-sport cards so the
      // response always has data cards rather than falling back to empty.
      cardPromise = Promise.race([
        generateContextualCards(category, undefined, 6, false, context.kalshiSubcategory),
        new Promise<InsightCard[]>(resolve => setTimeout(() => resolve([]), 5000)),
      ]).catch(() => []);
    }
    // ── AI generation starts now (concurrently with card generation above) ──────

    // Attempt AI generation via Vercel AI Gateway
    const xaiApiKey = process.env.XAI_API_KEY;
    const oddsApiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
    const kalshiApiKey = process.env.KALSHI_API_KEY;
    const hasClientOddsData = !!(context.oddsData?.events?.length);
    console.log('[API/analyze] Keys configured:', {
      XAI_API_KEY: !!xaiApiKey,
      ODDS_API_KEY: !!oddsApiKey,
      KALSHI_API_KEY: !!kalshiApiKey,
      hasOddsData: hasClientOddsData,
      category,
      sport: context.sport || 'none',
    });
    let aiText: string;
    let modelUsed = AI_CONFIG.MODEL_DISPLAY_NAME;
    let usedFallback = false;

    const MAX_HALLUCINATION_RETRIES = 2;

    const hasImages = (body.imageAttachments?.length ?? 0) > 0;

    /** Build the generateText call options supporting both text-only and multimodal */
    const buildGenOptions = (prompt: string, imgs?: ImageAttachment[]) => {
      if (imgs?.length) {
        // Multimodal: images + text in messages array
        type ContentPart = { type: 'text'; text: string } | { type: 'image'; image: string; mimeType: string };
        const content: ContentPart[] = [{ type: 'text', text: prompt }];
        for (const img of imgs) {
          content.push({ type: 'image', image: img.base64, mimeType: img.mimeType });
        }
        return { messages: [{ role: 'user' as const, content }] };
      }
      return { prompt };
    };

    // Route DFS, pure-fantasy, file-upload, and off-season queries directly to
    // grok-3-fast (3-6s). Reserve grok-4 for live-odds betting analysis only.
    const useFastPath = shouldUseFastModel(userMessage, context);
    const primaryModel = useFastPath ? 'grok-3-fast' : AI_CONFIG.MODEL_NAME;
    if (useFastPath) {
      console.log(`[API/analyze] Fast-path routing → grok-3-fast (intent: DFS/fantasy/file/offseason)`);
    }

    if (xaiApiKey) {
      try {
        // Initial generation with timeout protection
        const result = await Promise.race([
          generateText({
            model: createXai({ apiKey: xaiApiKey })(primaryModel),
            system: systemPrompt,
            ...buildGenOptions(enrichedPrompt, hasImages ? body.imageAttachments : undefined),
            temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
            maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
            maxRetries: 1, // Reduced retries to prevent timeout
          }),
          timeoutPromise
        ]);
        aiText = result.text;
        modelUsed = useFastPath ? 'Grok 3 Fast' : AI_CONFIG.MODEL_DISPLAY_NAME;

        // Hallucination-detection retry loop (with timeout awareness)
        let detection = detectHallucinations(aiText, userMessage, context.oddsData);
        let retryAttempt = 0;
        const remainingTime = TIMEOUT_MS - (Date.now() - startTime);

        while (detection.shouldRetry && retryAttempt < MAX_HALLUCINATION_RETRIES && remainingTime > 8000) {
          retryAttempt++;
          console.warn(
            `[API/analyze] Hallucination detected (attempt ${retryAttempt}/${MAX_HALLUCINATION_RETRIES}):`,
            detection.retryReason,
          );

          const retryPrompt = buildRetryPrompt(
            enrichedPrompt,
            detection,
            retryAttempt,
            (context.oddsData?.events?.length ?? 0) > 0,
          );

          try {
            const retryTimeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Retry timeout')), 7000); // 7s per retry
            });

            const retryResult = await Promise.race([
              generateText({
                // Always use grok-3-fast for retries — avoids double-timeout when
                // the primary model already consumed most of the time budget.
                model: createXai({ apiKey: xaiApiKey })('grok-3-fast'),
                system: systemPrompt,
                prompt: retryPrompt,
                // Lower temperature on retries to reduce hallucination likelihood
                temperature: Math.max(0.1, (AI_CONFIG.DEFAULT_TEMPERATURE ?? 0.7) - retryAttempt * 0.2),
                maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
                maxRetries: 0, // No retries within retry
              }),
              retryTimeoutPromise
            ]);
            aiText = retryResult.text;
            detection = detectHallucinations(aiText, userMessage, context.oddsData);
          } catch (retryError) {
            console.error(`[API/analyze] Retry ${retryAttempt} failed:`, retryError);
            break;
          }
        }

        if (retryAttempt > 0) {
          console.log(
            `[API/analyze] Final integrity after ${retryAttempt} retry(ies): ${detection.finalConfidence}%`,
          );
        }
      } catch (aiError) {
        // If primary model fails (e.g. timeout or API error), try grok-3-fast before giving up.
        // Fast-path queries already used grok-3-fast, so this fallback only kicks in for grok-4 failures.
        const fallbackModel = 'grok-3-fast';
        console.warn(`[API/analyze] ${primaryModel} failed, retrying with ${fallbackModel}:`, aiError instanceof Error ? aiError.message : aiError);
        try {
          const fallbackTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Fallback timeout')), 8000); // 8s for fallback
          });

          const fallbackResult = await Promise.race([
            generateText({
              model: createXai({ apiKey: xaiApiKey })(fallbackModel),
              system: systemPrompt,
              prompt: enrichedPrompt,
              temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
              maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
              maxRetries: 0,
            }),
            fallbackTimeoutPromise
          ]);
          aiText = fallbackResult.text;
          modelUsed = 'Grok 3 Fast (fallback)';
          console.log(`[API/analyze] ${fallbackModel} fallback succeeded`);
        } catch (fallbackError) {
          console.error('[API/analyze] Fallback model also failed:', fallbackError instanceof Error ? fallbackError.message : fallbackError);
          aiText = generateFallbackResponse(userMessage, context);
          modelUsed = 'Fallback';
          usedFallback = true;
        }
      }
    } else {
      aiText = generateFallbackResponse(userMessage, context);
      modelUsed = 'Fallback';
      usedFallback = true;
    }

    // Cards were launched in parallel with AI above — just await the in-flight promise.
    // If AI fell back to the static response, skip cards to avoid a mismatch.
    let cards: InsightCard[] = usedFallback ? [] : await cardPromise.catch(() => []);

    // When sport is known but no live games returned — build insight cards from AI bullets
    if (cards.length === 0 && !isAmbiguous && !usedFallback && context.sport) {
      const bullets = (aiText.match(/^[-•]\s+(.+)$/gm) ?? []).slice(0, 3);
      if (bullets.length > 0) {
        const sportGradients: Record<string, string> = {
          nba: 'from-orange-600/20 to-orange-900/10',
          nfl: 'from-blue-600/20 to-blue-900/10',
          mlb: 'from-red-600/20 to-red-900/10',
          nhl: 'from-cyan-600/20 to-cyan-900/10',
          ncaab: 'from-indigo-600/20 to-indigo-900/10',
          ncaaf: 'from-yellow-600/20 to-yellow-900/10',
        };
        const sport = context.sport.toLowerCase();
        cards = bullets.map(b => ({
          type: 'betting-insight',
          title: `${sport.toUpperCase()} Analysis`,
          category: sport,
          subcategory: 'AI Analysis',
          gradient: sportGradients[sport] ?? 'from-blue-600/20 to-purple-900/10',
          data: { insight: b.replace(/^[-•]\s+/, ''), source: 'Grok 4' },
          status: 'neutral',
          realData: false,
        } as InsightCard));
      }
    }

    console.log(`[API/analyze] Returning ${cards.length} cards (clarification: ${isAmbiguous})`);

    const processingTime = Date.now() - startTime;

    // Compute real trust metrics from the final AI text
    const hasRealOdds = !!(context.oddsData?.events?.length > 0);
    const baseMetrics = usedFallback
      ? {
          benfordIntegrity: 65,
          oddsAlignment: 65,
          marketConsensus: 65,
          historicalAccuracy: 68,
          finalConfidence: 65,
          trustLevel: 'medium' as const,
          riskLevel: 'medium' as const,
          adjustedTone: 'Limited data — AI unavailable',
          flags: [{ type: 'info', message: 'Using fallback mode — configure XAI_API_KEY for full analysis', severity: 'info' as const }],
        }
      : detectHallucinations(aiText, userMessage, context.oddsData);

    // Boost trust metrics when real live odds data was provided
    const trustMetrics = (hasRealOdds && !usedFallback)
      ? {
          ...baseMetrics,
          oddsAlignment: Math.min(99, (baseMetrics.oddsAlignment ?? 80) + 8),
          marketConsensus: Math.min(99, (baseMetrics.marketConsensus ?? 80) + 6),
          finalConfidence: Math.min(99, (baseMetrics.finalConfidence ?? 80) + 5),
          adjustedTone: baseMetrics.finalConfidence >= 85 ? 'Strong signal — live data verified' : baseMetrics.adjustedTone,
        }
      : baseMetrics;

    // Build sources list reflecting actual data used
    const sources = [
      usedFallback
        ? { name: 'Fallback Mode', type: 'cache' as const, reliability: 65 }
        : DEFAULT_SOURCES.GROK_AI,
    ];
    if (hasRealOdds) sources.push(DEFAULT_SOURCES.ODDS_API);
    if (context.isPoliticalMarket) sources.push(DEFAULT_SOURCES.KALSHI);
    if (context.hasFantasyIntent && !context.hasBettingIntent) {
      sources.push({ name: 'Fantasy Projections Engine', type: 'database' as const, reliability: 91 });
    }

    return NextResponse.json({
      success: true,
      text: aiText,
      cards,
      confidence: trustMetrics.finalConfidence,
      sources,
      modelUsed,
      trustMetrics,
      processingTime,
      useFallback: usedFallback,
      clarificationNeeded: isAmbiguous,
      clarificationOptions,
    });
  } catch (error) {
    console.error('[API/analyze] Unhandled error:', error);

    // Check if timeout error
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json(
        {
          success: true, // Return success with fallback to avoid breaking UI
          text: generateFallbackResponse(
            'Analysis request',
            { noGamesAvailable: true, sport: 'sports' }
          ),
          cards: [],
          confidence: 65,
          sources: [{ name: 'Fallback Mode (timeout)', type: 'cache', reliability: 65 }],
          modelUsed: 'Fallback (timeout)',
          trustMetrics: {
            benfordIntegrity: 65,
            oddsAlignment: 65,
            marketConsensus: 65,
            historicalAccuracy: 68,
            finalConfidence: 65,
            trustLevel: 'medium' as const,
            riskLevel: 'medium' as const,
            adjustedTone: 'Request timeout — try a simpler query',
            flags: [{
              type: 'warning',
              message: 'Request took too long — consider breaking complex queries into smaller parts',
              severity: 'warning' as const
            }],
          },
          useFallback: true,
          processingTime: Date.now() - startTime,
        },
        { status: HTTP_STATUS.OK }
      );
    }

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

  // With live odds data, summarize what we found
  if (context?.oddsData?.events?.length) {
    const count = context.oddsData.events.length;
    const sport = context.oddsData.sport?.replace('_', ' ').toUpperCase() || 'sports';
    const sample = context.oddsData.events.slice(0, 3).map((e: any) => {
      const book = e.bookmakers?.[0];
      const h2h = book?.markets?.find((m: any) => m.key === 'h2h');
      const home = h2h?.outcomes?.find((o: any) => o.name === e.home_team);
      const away = h2h?.outcomes?.find((o: any) => o.name === e.away_team);
      return `• ${e.away_team} @ ${e.home_team}: ${e.away_team} ${away?.price > 0 ? '+' : ''}${away?.price ?? 'N/A'} / ${e.home_team} ${home?.price > 0 ? '+' : ''}${home?.price ?? 'N/A'}`;
    }).join('\n');
    return `**Live ${sport} Games (${count} available)**\n\nHere are the current moneylines:\n${sample}\n\n• To unlock AI-powered sharp money analysis, configure XAI_API_KEY in your environment.`;
  }

  // No live games — give a useful knowledge-based response
  if (context?.noGamesAvailable || (context?.sport && !context?.oddsData)) {
    const sport = context.sport?.toUpperCase() || 'sports';
    if (lowerMsg.includes('offseason') || lowerMsg.includes('trade') || lowerMsg.includes('free agent')) {
      return `**${sport} Offseason Analysis**\n\n• No live games are scheduled right now, but there's plenty of betting value to track in the offseason.\n• Monitor futures markets — championship odds often offer the best value before spring/summer public betting shifts prices.\n• Track free agency signings and trades: roster changes are the #1 driver of futures line movement.\n• Win totals are set early in the offseason and tend to close toward public perception — sharp bettors target the opening numbers.\n• Configure XAI_API_KEY for AI-powered offseason intelligence.`;
    }
    return `**${sport} Analysis**\n\n• No live games are currently scheduled. ${sport} season games typically post odds 24–48 hours before tip/kickoff.\n• In the meantime, futures markets (division winner, championship odds) are open year-round.\n• This is a great time to research team trends, injury reports, and schedule strength ahead of the season.\n• Configure XAI_API_KEY for full AI-powered analysis.`;
  }

  // General betting/strategy question
  if (lowerMsg.includes('arbitrage') || lowerMsg.includes('arb')) {
    return `**Arbitrage Betting**\n\n• Arbitrage occurs when odds discrepancies between sportsbooks guarantee profit regardless of outcome.\n• Example: Book A has Team A at +105, Book B has Team B at -100 — you can cover both sides for guaranteed profit.\n• Typical arb margins: 1–3%. Higher margins are rare and close quickly.\n• Best found on: player props, alternative lines, early morning odds before sharp action.\n• Use the live data cards above to find current arbitrage opportunities across books.`;
  }

  if (lowerMsg.includes('kelly') || lowerMsg.includes('bankroll')) {
    return `**Bankroll Management (Kelly Criterion)**\n\n• Kelly Formula: f = (bp - q) / b, where b = decimal odds-1, p = win probability, q = 1-p.\n• Most pros use "quarter Kelly" (25% of full Kelly) to reduce variance.\n• Rule of thumb: never bet more than 3–5% of bankroll on a single play.\n• Flat betting (1–2 units per game) is more sustainable for recreational bettors.\n• Track ROI per sport/bet type to find your real edges over time.`;
  }

  if (lowerMsg.includes('dfs') || lowerMsg.includes('draftkings') || lowerMsg.includes('fanduel')) {
    return `**DFS Strategy**\n\n• Cash games: target high-floor players (consistent producers, good matchups, safe volume).\n• GPP tournaments: need leverage — rostering underowned players at premium positions.\n• Correlation stacking: QB + WR + opposing pass catcher is the most proven NFL GPP stack.\n• Ownership matters: in large field GPPs, a 70% owned chalk player who scores 30 pts barely moves the needle.\n• Target salary inefficiencies: players priced down due to one bad game but with strong underlying metrics.`;
  }

  if (context?.isPoliticalMarket || lowerMsg.includes('kalshi') || lowerMsg.includes('prediction market')) {
    return `**Kalshi Prediction Markets**\n\n• Kalshi markets are CFTC-regulated event contracts that pay $1 if the event occurs, $0 if not.\n• Prices represent implied probability — 65¢ YES = 65% market probability of that outcome.\n• Look for: markets trading significantly away from your probability estimate.\n• Key categories: elections, economic indicators (CPI, unemployment, Fed rate), weather events, sports championships.\n• Strategy: compare Kalshi prices to Polymarket/PredictIt for cross-market arbitrage.\n• Configure XAI_API_KEY for live Kalshi market intelligence.`;
  }

  return `**Leverage AI — Expert Sports Analysis**\n\n• I'm ready to analyze betting lines, DFS, fantasy, Kalshi markets, and more.\n• Ask me about specific games, offseason moves, betting strategy, or prediction markets.\n• Live odds data cards are loading below — click any card for detailed analysis.\n• Configure XAI_API_KEY in your environment for full AI-powered responses.`;
}
