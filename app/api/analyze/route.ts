import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
import { streamText, generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import {
  AI_CONFIG,
  DEFAULT_SOURCES,
  HTTP_STATUS,
  ERROR_MESSAGES,
  LOG_PREFIXES,
} from '@/lib/constants';
import { parseTSV, saveADPToSupabase, clearADPCache } from '@/lib/adp-data';
import { clearNFLADPCache } from '@/lib/nfl-adp-data';
import { generateContextualCards, oddsEventsToBettingCards, cardsToPromptContext, type InsightCard } from '@/lib/cards-generator';
import { parseIntent } from '@/lib/card-pipeline';
import { detectHallucinations } from '@/lib/hallucination-detector';
import { getGrokApiKey, getOddsApiKey } from '@/lib/config';
import { logger, LogCategory } from '@/lib/logger';
import { checkRateLimit, getRateLimitId } from '@/lib/middleware/rate-limit';
import { createClient } from '@/lib/supabase/server';

// lib/analyze/* helpers
import { AnalyzeBodySchema, shouldUseFastModel, validateImageAttachments, applyFileSizeGuard } from '@/lib/analyze/validation';
import { buildSystemPrompt } from '@/lib/analyze/prompt';
import { buildEnrichedPrompt } from '@/lib/analyze/prompt-enrichment';
import { detectSportAndIntents } from '@/lib/analyze/sport-detection';
import { createTools, selectTools } from '@/lib/analyze/tools';
import { createXaiMiddleware, buildMessagesWithCacheAndMemory, createSSEHelpers, toolResultSummary } from '@/lib/analyze/streaming';
import { extractToolResults, assembleFinalCards } from '@/lib/analyze/post-processor';
import { generateFallbackResponse } from '@/lib/analyze/fallback';
import type { AnalyzeRequestBody, AnalyzeContext, ImageAttachment } from '@/lib/analyze/types';

// ── Response deduplication cache ──────────────────────────────────────────────
// Prevents identical queries from hitting the Grok API a second time within TTL.
// Module-level: survives across requests on the same warm serverless instance.
const DEDUP_CACHE_TTL_MS = 15_000;
const DEDUP_CACHE_MAX    = 50;
const dedupCache = new Map<number, { text: string; cards: unknown[]; confidence: number; ts: number }>();

/** djb2 hash — fast, good distribution, no external deps */
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Evict expired dedup entries; if still over max, remove the 5 oldest in one pass. */
function evictDedupCache(): void {
  const now = Date.now();
  for (const [k, v] of dedupCache) {
    if (now - v.ts > DEDUP_CACHE_TTL_MS) dedupCache.delete(k);
  }
  if (dedupCache.size > DEDUP_CACHE_MAX) {
    const overage = dedupCache.size - DEDUP_CACHE_MAX + 5;
    const byAge   = [...dedupCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < Math.min(overage, byAge.length); i++) dedupCache.delete(byAge[i][0]);
  }
}

// ── Timeout constants ─────────────────────────────────────────────────────────
// primary(46s non-fast / 28s fast) + fallback(10s) + overhead(4s) = 60s max
const PRIMARY_TIMEOUT_MS  = (fast: boolean) => fast ? 28_000 : 46_000;
const FALLBACK_TIMEOUT_MS = 10_000;

// ── Per-request streaming state ───────────────────────────────────────────────
// Single mutable accumulator (const reference) vs five scattered let vars.
interface ProcessingState {
  aiText: string;
  modelUsed: string;
  usedFallback: boolean;
  sentDoneEvent: boolean;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}

// =============================================================================
// POST /api/analyze
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // ── Phase 1: Rate limiting ─────────────────────────────────────────────────
  // Authenticated users get a per-user bucket (10 req/min).
  // Anonymous users get a per-IP bucket (30 req/hour).
  let rateLimitUserId: string | undefined;
  try {
    const supabase = await createClient();
    // getSession() reads the cookie locally — no Supabase server round-trip needed for rate limiting
    const { data: { session } } = await supabase.auth.getSession();
    rateLimitUserId = session?.user?.id;
  } catch {
    // Supabase unavailable — fall through to IP-based limiting
  }
  const rlIdentifier = getRateLimitId(request, rateLimitUserId);
  const rlResult     = rateLimitUserId
    ? checkRateLimit('analyze:authed', rlIdentifier, { limit: 10, windowMs: 60_000 })
    : checkRateLimit('analyze:anon',   rlIdentifier, { limit: 30, windowMs: 3_600_000 });
  if (!rlResult.allowed) {
    return new Response(
      JSON.stringify({ success: false, error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rlResult.retryAfter ?? 3600) } },
    );
  }

  try {
    // ── Phase 2: Parse + validate ──────────────────────────────────────────────
    const rawBody = await request.json();
    const parsed  = AnalyzeBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Invalid request body';
      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const body = parsed.data as AnalyzeRequestBody;
    const { existingCards = [], context = {} as AnalyzeContext } = body;
    const customInstructions = body.customInstructions
      ? body.customInstructions.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 500)
      : undefined;

    // File-size guard: truncate inline file blocks > 50 rows server-side
    const userMessage = applyFileSizeGuard(body.userMessage);

    // Deduplication: hash first 600 chars scoped to user so different users never share cache
    const queryHash = djb2(`${rateLimitUserId ?? 'anon'}:${userMessage.slice(0, 600)}`);
    evictDedupCache();
    const dedupHit = dedupCache.get(queryHash);
    if (dedupHit) {
      console.log(`[API/analyze] Dedup cache hit (hash ${queryHash}) — skipping Grok call`);
      const enc = new TextEncoder();
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
      const writer = writable.getWriter();
      writer.write(enc.encode(`data: ${JSON.stringify({
        type: 'done', success: true,
        text: dedupHit.text + '\n\n*[Response cached — identical query within the last minute]*',
        cards: dedupHit.cards, confidence: dedupHit.confidence,
        sources: [{ name: 'Response Cache', type: 'cache', reliability: 95 }],
        modelUsed: 'cache',
      })}\n\n`));
      writer.close();
      return new Response(readable, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      });
    }

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.INVALID_REQUEST },
        { status: HTTP_STATUS.BAD_REQUEST },
      );
    }

    // ── Phase 3: Sport + intent detection ─────────────────────────────────────
    const msgLower = userMessage.toLowerCase();
    const rawQueryLower = (() => {
      // Strip [Fantasy League Context: ...]\n\n prefix so platform names don't
      // falsely trigger ADP/start-sit detection for every message.
      if (userMessage.startsWith('[Fantasy League Context:')) {
        const idx = userMessage.indexOf(']\n\n');
        if (idx !== -1) return userMessage.slice(idx + 3).toLowerCase();
      }
      return msgLower;
    })();

    const detection = detectSportAndIntents(userMessage, context, msgLower, rawQueryLower);
    const {
      isMLBQuery, hasADPIntent, hasStartSitIntent, hasMLBProjectionIntent,
      hasHRPredictionIntent, hasKalshiToolIntent, isMLBStatcastMode, expectsStatcastJSON,
      category, isAmbiguous: isAmbiguousBase,
      needsFantasySport, needsDFSSport, needsBettingSport,
      hasLineMovementIntent, hasPropsToolIntent,
    } = detection;

    // customInstructions guard applied on top of the base ambiguity flag
    const isAmbiguous = isAmbiguousBase && !customInstructions?.trim();

    // Auto-save inline TSV/CSV ADP uploads before tool execution
    if (hasADPIntent && body.userMessage.includes('[File:')) {
      const fileBlockRe = /\[File:\s*([^\]]+\.(?:tsv|csv))[^\]]*\]\n([\s\S]*?)(?=\n\[File:|$)/gi;
      let fm;
      while ((fm = fileBlockRe.exec(body.userMessage)) !== null) {
        const fileName   = (fm[1] ?? '').toLowerCase();
        const rawContent = fm[2] ?? '';
        if (!rawContent.trim()) continue;
        const players = parseTSV(rawContent);
        if (players.length < 5) continue;
        const isNFLFile = fileName.includes('nfl') || fileName.includes('football') ||
          msgLower.includes('nfl') || msgLower.includes('nffc') || msgLower.includes('football');
        const sport = isNFLFile ? 'nfl' : 'mlb';
        // Fire-and-forget — ADP save must not block the AI response
        void saveADPToSupabase(players, sport).then(() => {
          if (sport === 'nfl') { clearNFLADPCache(); } else { clearADPCache(); }
          console.log(`[API/analyze] Auto-saved ${players.length} ${sport.toUpperCase()} ADP players`);
        }).catch(e => {
          console.warn('[API/analyze] Failed to auto-save inline ADP upload:', e);
        });
        break;
      }
    }

    // Base clarification options — may be extended after enrichment reveals no live games
    const baseClarificationOptions: string[] = isAmbiguous
      ? ['NBA betting odds tonight', 'NFL betting analysis', 'MLB betting picks', 'NHL betting lines',
         'Kalshi prediction markets', 'DFS lineups today', 'Fantasy advice']
      : needsFantasySport
        ? ['NFL fantasy football waiver wire and start sit advice this week',
           'NBA fantasy basketball pickups and trade value this week',
           'MLB fantasy baseball waiver wire and streamer targets this week',
           'NHL fantasy hockey pickups and power-play targets this week']
        : needsDFSSport
          ? ['NBA DFS optimal lineups and value plays for DraftKings tonight',
             'NFL DFS optimal lineups and GPP stacks for DraftKings this week',
             'MLB DFS optimal lineups and pitcher stacks for DraftKings tonight']
          : needsBettingSport
            ? ['NBA basketball betting odds and lines tonight',
               'NFL football betting odds and best lines this week',
               'MLB baseball betting odds and run lines tonight',
               'NHL hockey betting odds and puck lines tonight']
            : [];

    // ── Phase 4: Build system prompt ───────────────────────────────────────────
    const now     = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const { cachedSystem, dynamicSystem } = buildSystemPrompt(detection, dateStr, customInstructions, body.deepThink);

    // ── Phase 5: Prompt enrichment + speculative card fetch (parallel) ────────
    // Pre-compute prop-card intent here so Phase 7 reuses the same result and the
    // early-fetch guard can exclude prop queries (which need a different card type).
    const PROP_CARD_KEYWORDS = [
      'pitcher prop','pitcher props','batter prop','batter props','player prop','player props',
      'prop bet','prop bets','prop pick','prop picks','best props','top props','strikeout prop',
      'hr prop','k prop','hits prop','rbi prop','points prop','assists prop','rebounds prop',
      'anytime td','td scorer','receiving yards prop','rushing yards prop',
    ];
    const hasPropCardIntent = PROP_CARD_KEYWORDS.some(k => rawQueryLower.includes(k));

    const enrichmentPromise = buildEnrichedPrompt(userMessage, context, detection, dateStr);

    // For non-Kalshi, non-prop, non-player, non-fantasy betting/sports queries the card
    // type is fully determined by detection — kick off the fetch now, in parallel with
    // the odds/schedule/Statcast fetches inside buildEnrichedPrompt.  This saves the
    // serial wait (typically 2–5 s) before the AI call begins.
    let speculativeCardPromise: Promise<InsightCard[]> | null = null;
    if (
      !context.isPoliticalMarket && context.selectedCategory !== 'kalshi' &&
      !isAmbiguous && !context.hasPlayerIntent && !context.hasFantasyIntent && !hasADPIntent &&
      !context.oddsData?.events?.length && !hasPropCardIntent &&
      (context.isSportsQuery || context.hasBettingIntent)
    ) {
      speculativeCardPromise = generateContextualCards('betting', context.sport ?? undefined, 7).catch(() => []);
    }

    const enrichment = await enrichmentPromise;
    const {
      enrichedPrompt: rawEnrichedPrompt,
      kalshiSportsFallbackMarkets, kalshiPromptMarkets,
      serverFetchedOdds, noLiveGamesDetected,
    } = enrichment;

    // Sport-specific clarification pills for no-live-game scenarios; computed
    // after enrichment so noLiveGamesDetected is known.
    const sportClarificationMap: Record<string, string[]> = {
      basketball_ncaab: ['NCAA Tournament futures and Final Four odds', 'College basketball conference betting trends and ATS records', 'Best March Madness upset patterns and handicapping strategy', 'Top college basketball player props and value bets'],
      basketball_nba:   ['NBA playoff picture, standings, and series odds', 'NBA Finals futures and championship contenders', 'Best NBA player props and over/under value tonight', 'NBA betting trends and best ATS systems this season'],
      americanfootball_nfl:  ['NFL Super Bowl futures and offseason team outlooks', 'NFL draft prospects and team needs for next season', 'Best NFL historical ATS trends and betting systems', 'NFL player props strategy and target values'],
      americanfootball_ncaaf: ['College football futures, conference champions, and bowl odds', 'Top college football ATS records and betting trends', 'College football recruiting and team strength analysis', 'Best CFB player props and value bets'],
      baseball_mlb:    ['MLB season futures and World Series odds', 'MLB daily player props and run line value', 'Baseball betting systems and best ATS trends', 'Statcast leaders and pitching matchup analysis'],
      icehockey_nhl:   ['NHL playoff odds and Stanley Cup futures', 'NHL puck line value and best betting systems', 'Top NHL player props and goal-scorer odds', 'NHL standings and playoff picture analysis'],
    };
    const clarificationOptions: string[] = (() => {
      if (!noLiveGamesDetected || baseClarificationOptions.length > 0 || !context.sport) {
        return baseClarificationOptions;
      }
      const sk = context.sport as string;
      return sportClarificationMap[sk] ?? [
        `${sk.replace(/^[a-z]+_/, '').toUpperCase()} futures and season-long analysis`,
        `${sk.replace(/^[a-z]+_/, '').toUpperCase()} betting strategy and historical trends`,
        `Best ${sk.replace(/^[a-z]+_/, '').toUpperCase()} player props and value bets`,
        `${sk.replace(/^[a-z]+_/, '').toUpperCase()} upcoming schedule and matchup previews`,
      ];
    })();

    // ── Phase 6: Token budget guard ────────────────────────────────────────────
    const TOKEN_BUDGET_CHARS = 48_000;
    const budgetedPrompt = rawEnrichedPrompt.length > TOKEN_BUDGET_CHARS
      ? (() => {
          const before  = rawEnrichedPrompt.length;
          const trimmed = rawEnrichedPrompt
            .replace(/\[File:[^\]]+\]\n[\s\S]*?\n\[\.\.\. \d+ more rows[^\]]*\]/g, '[File: (truncated — use query_adp tool)]')
            .slice(0, TOKEN_BUDGET_CHARS);
          console.warn(`[API/analyze] Token budget: trimmed ${before} → ${trimmed.length} chars`);
          return trimmed + '\n\n[CONTEXT TRIMMED — token budget. Full data available via query_adp tool.]';
        })()
      : rawEnrichedPrompt;

    // Append props-unavailable warning before card generation so it's in the final prompt
    const enrichedPrompt = (hasPropsToolIntent && noLiveGamesDetected)
      ? budgetedPrompt + `\n\n[Note: Player props data may be unavailable if no live games are currently scheduled. If the get_props_latest tool returns empty results, clearly acknowledge that live prop lines are not available for this sport today and offer alternatives: historical prop hit rates, season-long averages, or ask what the user wants to analyze instead.]`
      : budgetedPrompt;

    // ── Phase 7: Card generation ───────────────────────────────────────────────
    // aiPrompt extends enrichedPrompt with any card context injected during card fetch
    let aiPrompt = enrichedPrompt;
    const hasExistingCards =
      Array.isArray(existingCards) && existingCards.length > 0 &&
      !context.sport && !context.isSportsQuery && !context.hasBettingIntent &&
      !context.hasFantasyIntent && !context.isPoliticalMarket &&
      context.selectedCategory !== 'kalshi' && context.selectedCategory !== 'dfs' &&
      context.selectedCategory !== 'fantasy';

    let resolvedCards: InsightCard[] | null = null;
    let cardPromise: Promise<InsightCard[]>;

    // Case 1: Client sent live odds — cards built synchronously, AI already has them
    if (
      !context.isPoliticalMarket && context.selectedCategory !== 'kalshi' &&
      !isAmbiguous && !context.hasPlayerIntent && !context.hasFantasyIntent &&
      (context.isSportsQuery || context.hasBettingIntent) && context.oddsData?.events?.length > 0
    ) {
      const sportKey  = context.sport || context.oddsData.sport || 'sports';
      const builtCards = oddsEventsToBettingCards(context.oddsData.events, context.oddsData.sport || sportKey, 6);
      resolvedCards   = builtCards;
      cardPromise     = Promise.resolve(builtCards);

    // Case 2: Reuse existing cards for truly general queries
    } else if (hasExistingCards) {
      cardPromise = Promise.resolve(existingCards as InsightCard[]);

    // Case 3: Server must fetch cards — await first so AI references same data
    } else {
      let cardFetchPromise: Promise<InsightCard[]>;

      if (isAmbiguous) {
        cardFetchPromise = generateContextualCards('all', undefined, 7).catch(() => []);

      } else if (!context.isPoliticalMarket && context.selectedCategory === 'dfs') {
        cardFetchPromise = generateContextualCards('dfs', context.sport ?? undefined, 7).catch(() => []);

      } else if (
        !context.isPoliticalMarket && context.selectedCategory !== 'kalshi' &&
        ((context.hasFantasyIntent || hasADPIntent) || context.selectedCategory === 'fantasy') &&
        (!context.hasBettingIntent || context.selectedCategory === 'fantasy' || hasADPIntent)
      ) {
        if (context.playerName) {
          const intent = parseIntent(userMessage, context.sport ?? undefined);
          const name   = context.playerName ?? (intent.players.length > 0 ? intent.players[0] : undefined);
          cardFetchPromise = generateContextualCards('player', context.sport ?? undefined, 1, false, undefined, { playerName: name }).catch(() => []);
        } else {
          const fantSport: 'mlb' | 'nfl' | 'nba' = context.sport === 'mlb' ? 'mlb' : context.sport === 'nba' ? 'nba' : 'nfl';
          import('@/lib/fantasy/projections-cache')
            .then(({ currentSeasonFor }) => {
              const season = currentSeasonFor(fantSport);
              return import('@/lib/fantasy/projections-seeder').then(({ seedProjectionsFromSupabase }) =>
                seedProjectionsFromSupabase(fantSport, season));
            })
            .catch((e: unknown) => { console.warn('[API/analyze] Projection seeding failed:', e instanceof Error ? e.message : String(e)); });
          cardFetchPromise = import('@/lib/fantasy/cards/fantasy-card-generator')
            .then(({ generateFantasyCards }) => generateFantasyCards(userMessage, 6, context.sport || undefined, {
              teamCount: context.leagueSize ?? undefined,
              scoringFormat: context.leagueScoringFormat ?? undefined,
              isStartSit: hasStartSitIntent,
            }))
            .catch(() => generateContextualCards('fantasy', context.sport ?? undefined, 7).catch(() => []));
        }

      } else if (!context.isPoliticalMarket && context.hasPlayerIntent) {
        const intent = parseIntent(userMessage, context.sport ?? undefined);
        const name   = context.playerName ?? (intent.players.length > 0 ? intent.players[0] : undefined);
        if (name && !context.playerName) console.log(`[API/analyze] parseIntent extracted playerName="${name}"`);
        cardFetchPromise = generateContextualCards('player', context.sport ?? undefined, 1, false, undefined, { playerName: name }).catch(() => []);

      } else if (!context.isPoliticalMarket && context.selectedCategory !== 'kalshi' && (context.isSportsQuery || context.hasBettingIntent)) {
        // hasPropCardIntent and PROP_CARD_KEYWORDS are hoisted to Phase 5 for parallel early-fetch
        const sportKey = context.sport || undefined;
        if (hasPropCardIntent) {
          cardFetchPromise = generateContextualCards('props', sportKey, 7).catch(() => generateContextualCards('betting', sportKey, 7).catch(() => []));
        } else if (kalshiSportsFallbackMarkets?.length) {
          cardFetchPromise = import('@/lib/kalshi/index')
            .then(({ kalshiMarketToCard }) => {
              const kalshiCards = kalshiSportsFallbackMarkets!.map((m: any) => kalshiMarketToCard(m));
              console.log(`[KALSHI] Serving ${kalshiCards.length} prediction market cards (odds API fallback)`);
              return kalshiCards as InsightCard[];
            })
            .catch(() => generateContextualCards('betting', sportKey, 7).catch(() => []));
        } else {
          // Reuse the speculative fetch started in parallel with enrichment (Phase 5)
          cardFetchPromise = speculativeCardPromise ?? generateContextualCards('betting', sportKey, 7).catch(() => []);
        }

      } else if (context.isPoliticalMarket || context.selectedCategory === 'kalshi' || kalshiPromptMarkets?.length) {
        cardFetchPromise = import('@/lib/kalshi/index')
          .then(({ kalshiMarketToCard }) => {
            const cards = kalshiPromptMarkets!.map((m: any) => kalshiMarketToCard(m));
            console.log(`[KALSHI] Cards from prompt bridge: ${cards.length} markets`);
            return cards as InsightCard[];
          })
          .catch(() => generateContextualCards('kalshi', context.sport ?? undefined, 6, false, context.kalshiSubcategory).catch(() => []));
      } else {
        const isFantasyOrDFS    = category === 'fantasy' || category === 'dfs';
        const hasFantasyOrADP   = context.hasFantasyIntent || hasADPIntent;
        const validSelected     = context.selectedCategory && ['betting','dfs','fantasy','kalshi','props'].includes(context.selectedCategory) ? context.selectedCategory : undefined;
        const effectiveCategory = isFantasyOrDFS && !hasFantasyOrADP ? 'betting' : (validSelected ?? category);
        cardFetchPromise = generateContextualCards(effectiveCategory, context.sport ?? undefined, 6, false, context.kalshiSubcategory).catch(() => []);
      }

      resolvedCards = await Promise.race([
        cardFetchPromise,
        new Promise<InsightCard[]>(resolve => setTimeout(() => resolve([]), 5000)),
      ]);

      const realCards = resolvedCards.filter(c => c.data?.realData === true || c.metadata?.realData === true);
      if (realCards.length > 0) {
        const cardCtx = cardsToPromptContext(realCards);
        if (cardCtx) {
          aiPrompt += `\n\n${cardCtx}`;
          console.log(`[v0] [ANALYZE] Injected ${realCards.length} card(s) into AI prompt context`);
        }
      }
      cardPromise = Promise.resolve(resolvedCards);
    }

    // ── Phase 8: Model selection + AI generation ───────────────────────────────
    const xaiApiKey       = getGrokApiKey();
    const oddsApiKey      = getOddsApiKey();
    const hasClientOddsData = !!(context.oddsData?.events?.length);
    const useFastPath     = body.deepThink ? false : (hasADPIntent ? false : (isAmbiguous || shouldUseFastModel(userMessage, context)));
    const primaryModel    = body.deepThink ? AI_CONFIG.MODEL_NAME : (useFastPath ? AI_CONFIG.FAST_MODEL_NAME : AI_CONFIG.MODEL_NAME);

    logger.info(LogCategory.AI, 'model_selected', {
      metadata: { model: primaryModel, fastPath: useFastPath, hasADPIntent, sport: context?.sport ?? null },
    });
    console.log(LOG_PREFIXES.PIPELINE, {
      sport: context.sport ?? 'none', category, model: primaryModel, fastPath: useFastPath,
      sources: {
        odds: hasClientOddsData || serverFetchedOdds,
        kalshi: !!(kalshiSportsFallbackMarkets?.length) || context.isPoliticalMarket || context.selectedCategory === 'kalshi',
        adp: hasADPIntent, statcast: expectsStatcastJSON || enrichment.statcastInjected,
        projections: hasMLBProjectionIntent, hrPrediction: hasHRPredictionIntent, fantasy: !!(context.hasFantasyIntent),
      },
      intent: {
        betting: !!(context.hasBettingIntent), fantasy: !!(context.hasFantasyIntent),
        player: !!(context.hasPlayerIntent), political: !!(context.isPoliticalMarket),
        adp: hasADPIntent, hrPrediction: hasHRPredictionIntent, ambiguous: isAmbiguous,
      },
      keys: { XAI_API_KEY: !!xaiApiKey, ODDS_API_KEY: !!oddsApiKey },
    });

    const validatedImages  = validateImageAttachments(body.imageAttachments ?? [] as ImageAttachment[]);
    const hasImages        = validatedImages.length > 0;
    const tools            = createTools(context, rawQueryLower);
    const toolSelection    = selectTools(tools, detection, serverFetchedOdds, context.hasBettingIntent, body.deepThink ?? false);

    // Single mutable accumulator for all state built up during the stream
    const state: ProcessingState = {
      aiText:       '',
      modelUsed:    AI_CONFIG.MODEL_DISPLAY_NAME,
      usedFallback: false,
      sentDoneEvent: false,
      tokenUsage:   null,
    };

    const sse = createSSEHelpers();
    const { sseChunk, safeEnqueue } = sse;

    const responseStream = new ReadableStream({
      async start(controller) {
        const enq = (chunk: Uint8Array) => safeEnqueue(controller, chunk);

        try {
          if (xaiApiKey) {
            const primaryTimeoutMs = PRIMARY_TIMEOUT_MS(useFastPath);
            const abortCtrl        = new AbortController();
            const streamStartMs    = Date.now();
            const VERCEL_BUDGET_MS = 56_000;

            const streamResult = streamText({
              model: createXaiMiddleware(createXai({ apiKey: xaiApiKey })(primaryModel)),
              ...buildMessagesWithCacheAndMemory(
                cachedSystem, dynamicSystem, aiPrompt,
                hasImages ? validatedImages : undefined,
                context?.previousMessages,
              ),
              temperature:     AI_CONFIG.DEFAULT_TEMPERATURE,
              maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
              maxRetries:      0,
              abortSignal:     abortCtrl.signal,
              onStepFinish: ({ toolCalls, toolResults }) => {
                if (!toolCalls?.length) return;
                // Reset first-token timer after each tool step so the next synthesis
                // step gets its own deadline vs. the total Vercel function budget.
                clearTimeout(firstTokenTimer);
                const elapsed   = Date.now() - streamStartMs;
                const remaining = Math.max(8_000, VERCEL_BUDGET_MS - elapsed);
                firstTokenTimer = setTimeout(() => abortCtrl.abort(new Error('Primary timeout (step 2)')), remaining);
                for (const tc of toolCalls) {
                  const result  = (toolResults as any[])?.find((r: any) => r.toolCallId === tc.toolCallId)?.result;
                  const summary = toolResultSummary(tc.toolName, result);
                  enq(sseChunk({ type: 'tool_call', name: tc.toolName, summary }));
                }
              },
              ...toolSelection,
            });

            // Emit card SSE frames concurrently with the text stream (cards often resolve first)
            cardPromise.then(earlyCards => {
              for (const c of earlyCards) enq(sseChunk({ type: 'card', card: c }));
            }).catch((e: unknown) => {
              console.warn('[v0] [ANALYZE] card SSE emit failed:', e instanceof Error ? e.message : e);
            });

            // eslint-disable-next-line prefer-const
            let firstTokenTimer = setTimeout(() => abortCtrl.abort(new Error('Primary timeout')), primaryTimeoutMs);
            const RESPONSE_CHAR_LIMIT = 8_000;

            try {
              let gotFirstToken    = false;
              let responseTruncated = false;
              for await (const delta of streamResult.textStream) {
                if (!gotFirstToken) { gotFirstToken = true; clearTimeout(firstTokenTimer); }
                if (responseTruncated) continue;
                if (state.aiText.length + delta.length > RESPONSE_CHAR_LIMIT) {
                  const rem = RESPONSE_CHAR_LIMIT - state.aiText.length;
                  if (rem > 0) { state.aiText += delta.slice(0, rem); enq(sseChunk({ type: 'text', delta: delta.slice(0, rem) })); }
                  const notice = '\n\n---\n_Response truncated — ask me to continue or be more specific._';
                  state.aiText += notice;
                  enq(sseChunk({ type: 'text', delta: notice }));
                  responseTruncated = true;
                  console.warn(`[API/analyze] Response truncated at ${RESPONSE_CHAR_LIMIT} chars`);
                  continue;
                }
                state.aiText += delta;
                enq(sseChunk({ type: 'text', delta }));
              }
              clearTimeout(firstTokenTimer);
              state.modelUsed = useFastPath ? AI_CONFIG.FAST_MODEL_DISPLAY_NAME : AI_CONFIG.MODEL_DISPLAY_NAME;

              // Capture token usage (Anthropic cache metrics may flow through xAI)
              try {
                const usage = await streamResult.usage;
                if (usage) {
                  state.tokenUsage = { promptTokens: usage.inputTokens ?? 0, completionTokens: usage.outputTokens ?? 0, totalTokens: usage.totalTokens ?? 0 };
                  const au = usage as Record<string, unknown>;
                  const cR = au.cacheReadInputTokens as number | undefined;
                  const cW = au.cacheCreationInputTokens as number | undefined;
                  if (typeof cR === 'number' || typeof cW === 'number') {
                    console.log(`[API/analyze] Cache: read=${cR ?? 0} write=${cW ?? 0} (input=${usage.inputTokens ?? 0})`);
                  }
                }
              } catch { /* non-fatal */ }

              // ── Phase 9: Post-processing + done SSE ─────────────────────────
              const allToolResults: any[] = await (streamResult as any).toolResults ?? [];
              const allToolCalls:   any[] = await (streamResult as any).toolCalls   ?? [];

              const toolOutput = extractToolResults(allToolResults, allToolCalls, detection, context);
              const { cards: finalCards, aiText: processedText } = assembleFinalCards(
                await cardPromise.catch(() => []),
                toolOutput, state.aiText, detection, context, noLiveGamesDetected, state.usedFallback,
                enq, sseChunk, logger, LogCategory,
              );
              state.aiText = processedText;

              const processingTime = Date.now() - startTime;
              logger.info(LogCategory.AI, 'response_complete', {
                metadata: { cardCount: finalCards.length, clarification: isAmbiguous, sport: context?.sport ?? null, latencyMs: processingTime },
              });

              const hasRealOdds  = !!(context.oddsData?.events?.length > 0);
              const baseMetrics  = state.usedFallback
                ? { benfordIntegrity: 65, oddsAlignment: 65, marketConsensus: 65, historicalAccuracy: 68, finalConfidence: 65, trustLevel: 'medium' as const, riskLevel: 'medium' as const, adjustedTone: 'Limited data — AI unavailable', flags: [{ type: 'info', message: 'Using fallback mode — AI temporarily unavailable', severity: 'info' as const }] }
                : detectHallucinations(state.aiText, userMessage, context.oddsData, { category, hasBettingIntent: context.hasBettingIntent });
              const trustMetrics = (hasRealOdds && !state.usedFallback)
                ? { ...baseMetrics, oddsAlignment: Math.min(99, (baseMetrics.oddsAlignment ?? 80) + 8), marketConsensus: Math.min(99, (baseMetrics.marketConsensus ?? 80) + 6), finalConfidence: Math.min(99, (baseMetrics.finalConfidence ?? 80) + 5), adjustedTone: baseMetrics.finalConfidence >= 85 ? 'Strong signal — live data verified' : baseMetrics.adjustedTone }
                : baseMetrics;

              const sources: Array<{ name: string; type: string; reliability: number }> = [
                state.usedFallback ? { name: 'Fallback Mode', type: 'cache', reliability: 65 } : DEFAULT_SOURCES.GROK_AI,
              ];
              if (hasRealOdds)                                     sources.push(DEFAULT_SOURCES.ODDS_API);
              if (context.isPoliticalMarket)                        sources.push(DEFAULT_SOURCES.KALSHI);
              if (context.hasFantasyIntent && !context.hasBettingIntent) sources.push({ name: 'Fantasy Projections Engine', type: 'database', reliability: 91 });
              if (hasADPIntent) {
                const isNFLC = context?.sport?.includes('football') || context?.sport === 'nfl' || rawQueryLower.includes('nffc') || rawQueryLower.includes('nfl draft') || rawQueryLower.includes('fantasy football');
                sources.push({ name: isNFLC ? `NFFC ${new Date().getFullYear()} NFL ADP Board` : `NFBC ${new Date().getFullYear()} ADP Board`, type: 'api', reliability: 97 });
              }

              if (state.aiText && !state.usedFallback) {
                dedupCache.set(queryHash, { text: state.aiText, cards: finalCards, confidence: trustMetrics.finalConfidence, ts: Date.now() });
              }

              console.log(`[API/analyze] done — text=${state.aiText.length}B cards=${finalCards.length} payload≈${state.aiText.length + JSON.stringify(finalCards).length}B${state.tokenUsage ? ` tokens=${state.tokenUsage.totalTokens}` : ''} time=${processingTime}ms`);
              state.sentDoneEvent = true;
              enq(sseChunk({
                type: 'done', success: true, text: state.aiText, cards: finalCards,
                confidence: trustMetrics.finalConfidence, sources, modelUsed: state.modelUsed, trustMetrics,
                processingTime, useFallback: state.usedFallback,
                clarificationNeeded: isAmbiguous || noLiveGamesDetected, clarificationOptions,
                ...(state.tokenUsage && { tokenUsage: state.tokenUsage }),
              }));

            } catch (streamErr) {
              clearTimeout(firstTokenTimer);
              // Primary stream failed — fall back to generateText (no streaming for fallback)
              const alreadyFast         = useFastPath;
              const actualFallbackModel = alreadyFast ? AI_CONFIG.MODEL_NAME : AI_CONFIG.FAST_MODEL_NAME;
              const errBody = (() => {
                if (streamErr && typeof streamErr === 'object') {
                  const e = streamErr as Record<string, unknown>;
                  const rb = typeof e.responseBody === 'string' ? e.responseBody : '';
                  if (rb.includes('cache_control') || rb.includes('invalid_request_error')) return { summary: 'xAI 400 invalid_request_error (multi-step tool call)', isBadRequest: true };
                  if (e.statusCode) return { summary: `HTTP ${e.statusCode} from ${e.url ?? 'xAI'}`, isBadRequest: false };
                }
                return { summary: streamErr instanceof Error ? streamErr.message : String(streamErr), isBadRequest: false };
              })();
              console.error(`[API/analyze] Primary stream failed — ${errBody.summary} | Retrying with ${actualFallbackModel}`);
              try {
                const fbAbort = new AbortController();
                const fbTimer = setTimeout(() => fbAbort.abort(new Error('Fallback timeout')), FALLBACK_TIMEOUT_MS);
                const fbResult = await generateText({
                  model: createXai({ apiKey: xaiApiKey })(actualFallbackModel),
                  ...buildMessagesWithCacheAndMemory(cachedSystem, dynamicSystem, aiPrompt, undefined, context?.previousMessages),
                  temperature: AI_CONFIG.DEFAULT_TEMPERATURE, maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS, maxRetries: 0, abortSignal: fbAbort.signal,
                });
                clearTimeout(fbTimer);
                state.aiText    = fbResult.text;
                state.modelUsed = alreadyFast ? `${AI_CONFIG.MODEL_DISPLAY_NAME} (fallback)` : `${AI_CONFIG.FAST_MODEL_DISPLAY_NAME} (fallback)`;
                console.log(`[API/analyze] Fallback succeeded with ${actualFallbackModel}`);
                enq(sseChunk({ type: 'text', delta: state.aiText }));
              } catch (fbErr) {
                const fbMsg = fbErr instanceof Error ? fbErr.message : String(fbErr);
                console.error('[API/analyze] Fallback also failed:', fbMsg);
                const primaryStatus = (streamErr as Record<string, unknown>)?.statusCode as number | undefined;
                const isRL   = primaryStatus === 429 || fbMsg.includes('429') || fbMsg.toLowerCase().includes('rate limit');
                const isAuth = primaryStatus === 401 || fbMsg.includes('401') || fbMsg.toLowerCase().includes('unauthorized');
                if (isRL || isAuth) {
                  const errMsg = isRL ? 'AI rate limit reached — please wait a moment and try again.' : 'AI API key error — contact support if this persists.';
                  enq(sseChunk({ type: 'error', message: errMsg }));
                  state.aiText = errMsg;
                } else {
                  state.aiText = generateFallbackResponse(userMessage, context);
                  enq(sseChunk({ type: 'text', delta: state.aiText }));
                }
                state.modelUsed    = isRL ? 'Fallback (rate limited)' : isAuth ? 'Fallback (auth error)' : fbMsg.includes('timeout') ? 'Fallback (timeout)' : 'Fallback (API error — check XAI_API_KEY)';
                state.usedFallback = true;
              }
            }
          } else {
            // No API key — static fallback
            state.aiText       = generateFallbackResponse(userMessage, context);
            state.modelUsed    = 'Fallback';
            state.usedFallback = true;
            enq(sseChunk({ type: 'text', delta: state.aiText }));
          }

          // Covers: no API key / primary-failed+fallback-succeeded / both-failed paths
          if (!state.sentDoneEvent) {
            const cards          = await cardPromise.catch(() => [] as InsightCard[]);
            const processingTime = Date.now() - startTime;
            const trustMetrics   = { benfordIntegrity: 65, oddsAlignment: 65, marketConsensus: 65, historicalAccuracy: 68, finalConfidence: 65, trustLevel: 'medium' as const, riskLevel: 'medium' as const, adjustedTone: 'Limited data — AI unavailable', flags: [{ type: 'info', message: 'Using fallback mode — AI temporarily unavailable', severity: 'info' as const }] };
            const finalCards     = noLiveGamesDetected ? cards.filter((c: InsightCard) => c.data?.realData !== false && c.metadata?.realData !== false) : cards;
            console.log(`[API/analyze] done (fallback) — text=${state.aiText.length}B cards=${finalCards.length} time=${processingTime}ms`);
            enq(sseChunk({
              type: 'done', success: true, text: state.aiText, cards: finalCards,
              confidence: 65, sources: [{ name: 'Fallback Mode', type: 'cache', reliability: 65 }],
              modelUsed: state.modelUsed, trustMetrics, processingTime, useFallback: true,
              clarificationNeeded: isAmbiguous || noLiveGamesDetected, clarificationOptions,
            }));
          }

        } catch (innerError) {
          console.error('[API/analyze] Stream controller error:', innerError);
          try {
            enq(sseChunk({
              type: 'done', success: true, text: generateFallbackResponse(userMessage, context),
              cards: [], confidence: 65,
              sources: [{ name: 'Fallback Mode', type: 'cache', reliability: 65 }],
              modelUsed: 'Fallback',
              trustMetrics: { benfordIntegrity: 65, oddsAlignment: 65, marketConsensus: 65, historicalAccuracy: 68, finalConfidence: 65, trustLevel: 'medium', riskLevel: 'medium', adjustedTone: 'Error occurred — showing fallback', flags: [] },
              processingTime: Date.now() - startTime, useFallback: true, clarificationNeeded: false, clarificationOptions: [],
            }));
          } catch { /* ignore if controller already errored */ }
        } finally {
          sse.closeStream(controller);
        }
      },
    });

    return new Response(responseStream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });

  } catch (error) {
    console.error('[API/analyze] Unhandled error:', error);

    if (error instanceof Error && (error.message.includes('timeout') || error.name === 'AbortError')) {
      return NextResponse.json({
        success: true,
        text: generateFallbackResponse('Analysis request', { noGamesAvailable: true, sport: 'sports' }),
        cards: [], confidence: 65,
        sources: [{ name: 'Fallback Mode (timeout)', type: 'cache', reliability: 65 }],
        modelUsed: 'Fallback (timeout)',
        trustMetrics: { benfordIntegrity: 65, oddsAlignment: 65, marketConsensus: 65, historicalAccuracy: 68, finalConfidence: 65, trustLevel: 'medium' as const, riskLevel: 'medium' as const, adjustedTone: 'Request timeout — try a simpler query', flags: [{ type: 'warning', message: 'Request took too long — consider breaking complex queries into smaller parts', severity: 'warning' as const }] },
        useFallback: true, processingTime: Date.now() - startTime,
      }, { status: HTTP_STATUS.OK });
    }

    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.INTERNAL_ERROR, details: error instanceof Error ? error.message : 'Unknown error' },
      { status: HTTP_STATUS.INTERNAL_ERROR },
    );
  }
}
