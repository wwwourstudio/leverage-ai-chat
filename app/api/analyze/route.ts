import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
import { streamText, generateText, tool, stepCountIs, wrapLanguageModel, type ModelMessage } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { z } from 'zod';
import {
  AI_CONFIG,
  SYSTEM_PROMPT,
  MLB_ANALYSIS_ADDENDUM,
  NFBC_ADP_ADDENDUM,
  MLB_PROJECTION_ADDENDUM,
  FANTASY_STARTSIT_ADDENDUM,
  DEEP_THINK_ADDENDUM,
  DEFAULT_SOURCES,
  HTTP_STATUS,
  ERROR_MESSAGES,
  NFBC_DRAFT_YEAR,
  NFL_SEASON_YEAR,
  LOG_PREFIXES,
} from '@/lib/constants';
import { getADPData, queryADP, parseTSV, saveADPToSupabase, clearADPCache } from '@/lib/adp-data';
import { getNFLADPData, clearNFLADPCache } from '@/lib/nfl-adp-data';
import { getStatcastData, queryStatcast } from '@/lib/baseball-savant';
import type { StatcastPlayer } from '@/lib/baseball-savant';
import { generateContextualCards, oddsEventsToBettingCards, cardsToPromptContext, type InsightCard } from '@/lib/cards-generator';
import { parseIntent } from '@/lib/card-pipeline';
import { detectHallucinations } from '@/lib/hallucination-detector';
import { getGrokApiKey, getOddsApiKey } from '@/lib/config';
import { logger, LogCategory } from '@/lib/logger';
import { checkRateLimit, getRateLimitId } from '@/lib/middleware/rate-limit';
import { detectSportAndIntents } from '@/lib/analyze/sport-detection';
import { buildEnrichedPrompt } from '@/lib/analyze/prompt-enrichment';
import { extractToolResults, assembleFinalCards } from '@/lib/analyze/post-processor';
import { generateFallbackResponse } from '@/lib/analyze/fallback';
import type { AnalyzeRequestBody, AnalyzeContext, ImageAttachment } from '@/lib/analyze/types';

// ── Response deduplication cache ─────────────────────────────────────────────
// Prevents identical queries from hitting the Grok API a second time within TTL.
// Module-level: survives across requests on the same warm serverless instance.
const DEDUP_CACHE_TTL_MS = 15_000;
const DEDUP_CACHE_MAX = 50;
const dedupCache = new Map<number, { text: string; cards: unknown[]; confidence: number; ts: number }>();

/** djb2 hash — fast, good distribution, no external deps */
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Evict expired dedup entries; if still over max, remove the 5 oldest in one sort pass. */
function evictDedupCache(): void {
  const now = Date.now();
  for (const [k, v] of dedupCache) {
    if (now - v.ts > DEDUP_CACHE_TTL_MS) dedupCache.delete(k);
  }
  if (dedupCache.size > DEDUP_CACHE_MAX) {
    const overage = dedupCache.size - DEDUP_CACHE_MAX + 5;
    const byAge = [...dedupCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < Math.min(overage, byAge.length); i++) dedupCache.delete(byAge[i][0]);
  }
}

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// Model routing helpers
// ============================================================================

/**
 * Returns true for query types that use the fast path (grok-3-fast):
 * - Pure fantasy queries (hasFantasyIntent && !hasBettingIntent)
 * - CSV / file uploads (user's own data, not real-time odds)
 * - Off-season / no-games contexts
 * - Kalshi/political market queries
 */
function shouldUseFastModel(
  userMessage: string,
  context: AnalyzeRequestBody['context'],
): boolean {
  const lower = userMessage.toLowerCase();
  if (context?.hasFantasyIntent && !context?.hasBettingIntent) return true;
  if (userMessage.includes('[File:')) return true;
  if (context?.noGamesAvailable) return true;
  if (context?.isPoliticalMarket) return true;

  const kalshiKeywords = ['kalshi', 'prediction market', 'deeper analysis on:'];
  if (kalshiKeywords.some(k => lower.includes(k))) return true;
  if (/[,\s]yes\s+\w/i.test(userMessage)) return true;

  if (context?.sport === 'mlb' && (lower.includes('hr') || lower.includes('statcast') || lower.includes('pitch') || lower.includes('home run') || lower.includes('barrel'))) {
    return false;
  }
  return false;
}

// ============================================================================
// POST /api/analyze
// ============================================================================

// ── Request body schema ──────────────────────────────────────────────────────
const AnalyzeBodySchema = z.object({
  userMessage:        z.string().min(1, 'Message is required').max(24000, 'Message too long'),
  existingCards:      z.array(z.any()).max(50).optional().default([]),
  context:            z.record(z.any()).optional().default({}),
  customInstructions: z.string().max(2000).optional(),
  imageAttachments:   z.array(z.any()).max(5).optional().default([]),
  deepThink:          z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // ── Phase 1: Rate limiting ────────────────────────────────────────────────
  // Authenticated users get a per-user bucket (10 req/min).
  // Anonymous users get a per-IP bucket (30 req/hour).
  let rateLimitUserId: string | undefined;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    rateLimitUserId = user?.id;
  } catch {
    // Supabase unavailable — fall through to IP-based limiting
  }
  const rlIdentifier = getRateLimitId(request, rateLimitUserId);
  const rlResult = rateLimitUserId
    ? checkRateLimit('analyze:authed', rlIdentifier, { limit: 10, windowMs: 60_000 })
    : checkRateLimit('analyze:anon',   rlIdentifier, { limit: 30, windowMs: 3_600_000 });
  if (!rlResult.allowed) {
    return new Response(
      JSON.stringify({ success: false, error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rlResult.retryAfter ?? 3600) } },
    );
  }

  // Per-AI-call timeouts:
  //   grok-3-fast primary: ~15-30s first-token | fallback: 10s
  const PRIMARY_TIMEOUT_MS = (useFastPath: boolean) => useFastPath ? 28_000 : 46_000;
  const FALLBACK_TIMEOUT_MS = 10_000;

  try {
    // ── Phase 2: Parse + validate request ────────────────────────────────────
    const rawBody = await request.json();
    const parsed = AnalyzeBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Invalid request body';
      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const body = parsed.data as AnalyzeRequestBody;
    const { existingCards = [], context = {} as AnalyzeContext, customInstructions } = body;

    // xAI internally routes to Anthropic and adds cache_control to ALL content
    // blocks. When an assistant message has only tool calls (no text), xAI sends
    // content:"" which becomes an empty text block — Anthropic then rejects the
    // request with "cache_control cannot be set for empty text blocks". Fix: wrap
    // the model with middleware that injects a non-empty stub text.
    const xaiNoEmptyContent = (rawModel: ReturnType<ReturnType<typeof createXai>>) =>
      wrapLanguageModel({
        model: rawModel,
        middleware: {
          specificationVersion: 'v3' as const,
          transformParams: async ({ params }) => {
            const patched = params.prompt.map((msg) => {
              if (msg.role !== 'assistant') return msg;
              const parts = msg.content as Array<{ type: string; text?: string }>;
              const hasText = parts.some((p) => p.type === 'text' && p.text && p.text.length > 0);
              const hasToolCall = parts.some((p) => p.type === 'tool-call');
              if (!hasText && hasToolCall) {
                return { ...msg, content: [{ type: 'text', text: '.' }, ...parts] };
              }
              return msg;
            });
            return { ...params, prompt: patched } as typeof params;
          },
        },
      });

    // ── Guardrail 1: File-size guard ──────────────────────────────────────────
    // Replace inline file blocks > 50 data rows with a summary so the enriched
    // prompt stays well within the 12k-token budget.
    const userMessage = (() => {
      if (!body.userMessage.includes('[File:')) return body.userMessage;
      return body.userMessage.replace(
        /(\[File:\s*[^\]]+\s*\((\d+)\s+rows?\)\])([\s\S]*?)(?=\n\[File:|$)/gi,
        (_m, hdr, rowStr, content) => {
          const rowCount = parseInt(rowStr, 10);
          if (rowCount <= 50) return _m;
          const lines = content.trimStart().split('\n');
          const headerRow = lines[0] ?? '';
          const dataRows  = lines.slice(1, 51).join('\n');
          return `${hdr}\n${headerRow}\n${dataRows}\n[... ${rowCount - 50} more rows saved server-side — use query_adp tool for lookups]\n[ADP_FILE_SUMMARY_MODE: true]`;
        },
      );
    })();

    // ── Guardrail 4: Response deduplication ───────────────────────────────────
    const queryHash = djb2(`${rateLimitUserId ?? 'anon'}:${userMessage.slice(0, 600)}`);
    evictDedupCache();
    const dedupHit = dedupCache.get(queryHash);
    if (dedupHit) {
      console.log(`[API/analyze] Dedup cache hit (hash ${queryHash}) — skipping Grok call`);
      const enc = new TextEncoder();
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
      const writer = writable.getWriter();
      const payload = JSON.stringify({
        type: 'done', success: true,
        text: dedupHit.text + '\n\n*[Response cached — identical query within the last minute]*',
        cards: dedupHit.cards, confidence: dedupHit.confidence,
        sources: [{ name: 'Response Cache', type: 'cache', reliability: 95 }],
        modelUsed: 'cache',
      });
      writer.write(enc.encode(`data: ${payload}\n\n`));
      writer.close();
      return new Response(readable, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      });
    }

    // ── Phase 3: Build system prompt ──────────────────────────────────────────
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const baseSystemPrompt = SYSTEM_PROMPT.replace('[CURRENT_DATE]', dateStr);

    const msgLower = userMessage.toLowerCase();

    // Strip the [Fantasy League Context: ...]\n\n prefix so platform names
    // don't falsely trigger ADP/start-sit detection for every message.
    const rawQueryLower = (() => {
      if (userMessage.startsWith('[Fantasy League Context:')) {
        const closingIdx = userMessage.indexOf(']\n\n');
        if (closingIdx !== -1) return userMessage.slice(closingIdx + 3).toLowerCase();
      }
      return msgLower;
    })();

    // ── Phase 4: Sport + intent detection ────────────────────────────────────
    const detection = detectSportAndIntents(userMessage, context, msgLower, rawQueryLower);
    const {
      isMLBQuery,
      hasADPIntent,
      hasStartSitIntent,
      hasMLBProjectionIntent,
      hasHRPredictionIntent,
      hasKalshiToolIntent,
      isMLBStatcastMode,
      expectsStatcastJSON,
      category,
      isAmbiguous: isAmbiguousBase,
      needsFantasySport,
      needsDFSSport,
      needsBettingSport,
      hasLineMovementIntent,
      hasPropsToolIntent,
    } = detection;

    // customInstructions check is applied on top of the base ambiguity flag
    const isAmbiguous = isAmbiguousBase && !customInstructions?.trim();

    // Auto-save inline TSV/CSV ADP uploads
    if (hasADPIntent && body.userMessage.includes('[File:')) {
      const fileBlockRe = /\[File:\s*([^\]]+\.(?:tsv|csv))[^\]]*\]\n([\s\S]*?)(?=\n\[File:|$)/gi;
      let fileMatch;
      while ((fileMatch = fileBlockRe.exec(body.userMessage)) !== null) {
        const fileName = (fileMatch[1] ?? '').toLowerCase();
        const rawContent = fileMatch[2] ?? '';
        if (!rawContent.trim()) continue;
        const players = parseTSV(rawContent);
        if (players.length < 5) continue;
        const isNFLFile = fileName.includes('nfl') || fileName.includes('football') ||
          msgLower.includes('nfl') || msgLower.includes('nffc') || msgLower.includes('football');
        const sport = isNFLFile ? 'nfl' : 'mlb';
        try {
          await saveADPToSupabase(players, sport);
          if (sport === 'nfl') { clearNFLADPCache(); } else { clearADPCache(); }
          console.log(`[API/analyze] Auto-saved ${players.length} ${sport.toUpperCase()} ADP players from inline file upload`);
        } catch (saveErr) {
          console.warn('[API/analyze] Failed to auto-save inline ADP upload:', saveErr);
        }
        break;
      }
    }

    // Clarification options for ambiguous / no-sport / no-live-games queries
    let clarificationOptions: string[] = isAmbiguous
      ? [
          'NBA betting odds tonight',
          'NFL betting analysis',
          'MLB betting picks',
          'NHL betting lines',
          'Kalshi prediction markets',
          'DFS lineups today',
          'Fantasy advice',
        ]
      : needsFantasySport
        ? [
            'NFL fantasy football waiver wire and start sit advice this week',
            'NBA fantasy basketball pickups and trade value this week',
            'MLB fantasy baseball waiver wire and streamer targets this week',
            'NHL fantasy hockey pickups and power-play targets this week',
          ]
        : needsDFSSport
          ? [
              'NBA DFS optimal lineups and value plays for DraftKings tonight',
              'NFL DFS optimal lineups and GPP stacks for DraftKings this week',
              'MLB DFS optimal lineups and pitcher stacks for DraftKings tonight',
            ]
          : needsBettingSport
            ? [
                'NBA basketball betting odds and lines tonight',
                'NFL football betting odds and best lines this week',
                'MLB baseball betting odds and run lines tonight',
                'NHL hockey betting odds and puck lines tonight',
              ]
            : [];

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.INVALID_REQUEST },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const baseWithAddendum = hasStartSitIntent
      ? `${baseSystemPrompt}${FANTASY_STARTSIT_ADDENDUM}`
      : hasMLBProjectionIntent
        ? `${baseSystemPrompt}${MLB_PROJECTION_ADDENDUM}`
        : isMLBStatcastMode
          ? `${baseSystemPrompt}${MLB_ANALYSIS_ADDENDUM}`
          : hasADPIntent
            ? `${baseSystemPrompt}${NFBC_ADP_ADDENDUM}`
            : baseSystemPrompt;

    // ── Prompt-injection guard ────────────────────────────────────────────────
    const sanitizeCustomInstructions = (raw: string): string => {
      const sanitized = raw
        .slice(0, 2000)
        .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[filtered]')
        .replace(/forget\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[filtered]')
        .replace(/disregard\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[filtered]')
        .replace(/\bsystem\s*prompt\b/gi, '[filtered]')
        .replace(/\[INST\]|\[\/INST\]|<s>|<\/s>|<\|im_start\|>|<\|im_end\|>/g, '')
        .replace(/\bDAN\b|\bjailbreak\b/gi, '[filtered]')
        .trim();
      if (sanitized !== raw.trim().slice(0, 2000)) {
        console.warn('[API/analyze] Custom instructions sanitized — potential injection attempt filtered');
      }
      return sanitized;
    };

    const baseWithProfile = customInstructions?.trim()
      ? `${baseWithAddendum}\n\n## USER PROFILE & BETTING PREFERENCES\n${sanitizeCustomInstructions(customInstructions)}`
      : baseWithAddendum;
    const systemPrompt = body.deepThink
      ? `${baseWithProfile}${DEEP_THINK_ADDENDUM}`
      : baseWithProfile;

    // ── Prompt cache split ────────────────────────────────────────────────────
    // The cached body excludes the date line and per-user profile so the prefix
    // is stable across calls. The dynamic prefix carries the date + user profile.
    const cachedSystemBaseNoDate = SYSTEM_PROMPT.replace('Today: [CURRENT_DATE].', '').replace(/^\n+/, '');
    const cachedWithAddendum = hasStartSitIntent
      ? `${cachedSystemBaseNoDate}${FANTASY_STARTSIT_ADDENDUM}`
      : hasMLBProjectionIntent
        ? `${cachedSystemBaseNoDate}${MLB_PROJECTION_ADDENDUM}`
        : isMLBStatcastMode
          ? `${cachedSystemBaseNoDate}${MLB_ANALYSIS_ADDENDUM}`
          : hasADPIntent
            ? `${cachedSystemBaseNoDate}${NFBC_ADP_ADDENDUM}`
            : cachedSystemBaseNoDate;
    const cachedSystem = body.deepThink
      ? `${cachedWithAddendum}${DEEP_THINK_ADDENDUM}`
      : cachedWithAddendum;

    const dynamicSystemParts: string[] = [`Today: ${dateStr}.`];
    if (customInstructions?.trim()) {
      dynamicSystemParts.push(`## USER PROFILE & BETTING PREFERENCES\n${sanitizeCustomInstructions(customInstructions)}`);
    }
    const dynamicSystem = dynamicSystemParts.join('\n\n');

    // ── Phase 5: Prompt enrichment ────────────────────────────────────────────
    const enrichment = await buildEnrichedPrompt(userMessage, context, detection, dateStr);
    let { enrichedPrompt } = enrichment;
    const { kalshiSportsFallbackMarkets, kalshiPromptMarkets, serverFetchedOdds, noLiveGamesDetected } = enrichment;

    // Clarification pills for no-live-games scenarios
    if (noLiveGamesDetected && clarificationOptions.length === 0 && context.sport) {
      const sportClarifications: Record<string, string[]> = {
        basketball_ncaab: [
          'NCAA Tournament futures and Final Four odds',
          'College basketball conference betting trends and ATS records',
          'Best March Madness upset patterns and handicapping strategy',
          'Top college basketball player props and value bets',
        ],
        basketball_nba: [
          'NBA playoff picture, standings, and series odds',
          'NBA Finals futures and championship contenders',
          'Best NBA player props and over/under value tonight',
          'NBA betting trends and best ATS systems this season',
        ],
        americanfootball_nfl: [
          'NFL Super Bowl futures and offseason team outlooks',
          'NFL draft prospects and team needs for next season',
          'Best NFL historical ATS trends and betting systems',
          'NFL player props strategy and target values',
        ],
        americanfootball_ncaaf: [
          'College football futures, conference champions, and bowl odds',
          'Top college football ATS records and betting trends',
          'College football recruiting and team strength analysis',
          'Best CFB player props and value bets',
        ],
        baseball_mlb: [
          'MLB season futures and World Series odds',
          'MLB daily player props and run line value',
          'Baseball betting systems and best ATS trends',
          'Statcast leaders and pitching matchup analysis',
        ],
        icehockey_nhl: [
          'NHL playoff odds and Stanley Cup futures',
          'NHL puck line value and best betting systems',
          'Top NHL player props and goal-scorer odds',
          'NHL standings and playoff picture analysis',
        ],
      };
      const sportKey = context.sport as string;
      clarificationOptions = sportClarifications[sportKey] ?? [
        `${sportKey.replace(/^[a-z]+_/, '').toUpperCase()} futures and season-long analysis`,
        `${sportKey.replace(/^[a-z]+_/, '').toUpperCase()} betting strategy and historical trends`,
        `Best ${sportKey.replace(/^[a-z]+_/, '').toUpperCase()} player props and value bets`,
        `${sportKey.replace(/^[a-z]+_/, '').toUpperCase()} upcoming schedule and matchup previews`,
      ];
    }

    // ── Phase 6: Token budget guard ───────────────────────────────────────────
    const TOKEN_BUDGET_CHARS = 48_000;
    if (enrichedPrompt.length > TOKEN_BUDGET_CHARS) {
      const before = enrichedPrompt.length;
      enrichedPrompt = enrichedPrompt
        .replace(/\[File:[^\]]+\]\n[\s\S]*?\n\[\.\.\. \d+ more rows[^\]]*\]/g, '[File: (truncated — use query_adp tool)]')
        .slice(0, TOKEN_BUDGET_CHARS);
      enrichedPrompt += '\n\n[CONTEXT TRIMMED — token budget. Full data available via query_adp tool.]';
      console.warn(`[API/analyze] Token budget: trimmed ${before} → ${enrichedPrompt.length} chars (~${Math.ceil(before / 4)} → 12k tokens)`);
    }

    // ── Phase 7: Card generation ───────────────────────────────────────────────
    const hasExistingCards = Array.isArray(existingCards) && existingCards.length > 0
      && !context.sport
      && !context.isSportsQuery
      && !context.hasBettingIntent
      && !context.hasFantasyIntent
      && !context.isPoliticalMarket
      && context.selectedCategory !== 'kalshi'
      && context.selectedCategory !== 'dfs'
      && context.selectedCategory !== 'fantasy';

    let resolvedCards: InsightCard[] | null = null;
    let cardPromise: Promise<InsightCard[]>;

    // Case 1: Client sent live odds → cards built synchronously
    if (!context.isPoliticalMarket && context.selectedCategory !== 'kalshi' && !isAmbiguous && !context.hasPlayerIntent && !context.hasFantasyIntent && (context.isSportsQuery || context.hasBettingIntent) && context.oddsData?.events?.length > 0) {
      const sportKey = context.sport || context.oddsData.sport || 'sports';
      const builtCards = oddsEventsToBettingCards(
        context.oddsData.events,
        context.oddsData.sport || sportKey,
        6
      );
      resolvedCards = builtCards;
      cardPromise = Promise.resolve(builtCards);

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

      } else if (!context.isPoliticalMarket && context.selectedCategory !== 'kalshi' && ((context.hasFantasyIntent || hasADPIntent) || context.selectedCategory === 'fantasy') && (!context.hasBettingIntent || context.selectedCategory === 'fantasy' || hasADPIntent)) {
        if (context.playerName) {
          const intent = parseIntent(userMessage, context.sport ?? undefined);
          const resolvedPlayerName = context.playerName ?? (intent.players.length > 0 ? intent.players[0] : undefined);
          cardFetchPromise = generateContextualCards('player', context.sport ?? undefined, 1, false, undefined, { playerName: resolvedPlayerName })
            .catch(() => []);
        } else {
          const fantSport: 'mlb' | 'nfl' | 'nba' = context.sport === 'mlb' ? 'mlb'
            : context.sport === 'nba' ? 'nba'
            : 'nfl';
          import('@/lib/fantasy/projections-cache')
            .then(({ currentSeasonFor }) => {
              const season = currentSeasonFor(fantSport);
              return import('@/lib/fantasy/projections-seeder').then(({ seedProjectionsFromSupabase }) =>
                seedProjectionsFromSupabase(fantSport, season)
              );
            })
            .catch((err: unknown) => {
              console.warn('[API/analyze] Projection seeding failed:', err instanceof Error ? err.message : String(err));
            });
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
        const resolvedPlayerName = context.playerName
          ?? (intent.players.length > 0 ? intent.players[0] : undefined);
        if (resolvedPlayerName && !context.playerName) {
          console.log(`[API/analyze] parseIntent extracted playerName="${resolvedPlayerName}" from query`);
        }
        cardFetchPromise = generateContextualCards('player', context.sport ?? undefined, 1, false, undefined, { playerName: resolvedPlayerName }).catch(() => []);

      } else if (!context.isPoliticalMarket && context.selectedCategory !== 'kalshi' && (context.isSportsQuery || context.hasBettingIntent)) {
        const PROP_CARD_KEYWORDS = [
          'pitcher prop', 'pitcher props', 'batter prop', 'batter props',
          'player prop', 'player props', 'prop bet', 'prop bets', 'prop pick', 'prop picks',
          'best props', 'top props', 'strikeout prop', 'hr prop', 'k prop',
          'hits prop', 'rbi prop', 'points prop', 'assists prop', 'rebounds prop',
          'anytime td', 'td scorer', 'receiving yards prop', 'rushing yards prop',
        ];
        const hasPropCardIntent = PROP_CARD_KEYWORDS.some(k => rawQueryLower.includes(k));
        const sportKey = context.sport || undefined;

        if (hasPropCardIntent) {
          cardFetchPromise = generateContextualCards('props', sportKey, 7).catch(() =>
            generateContextualCards('betting', sportKey, 7).catch(() => [])
          );
        } else if (kalshiSportsFallbackMarkets && kalshiSportsFallbackMarkets.length > 0) {
          cardFetchPromise = import('@/lib/kalshi/index')
            .then(({ kalshiMarketToCard }) => {
              const kalshiCards = kalshiSportsFallbackMarkets!.map((m: any) => kalshiMarketToCard(m));
              console.log(`[KALSHI] Serving ${kalshiCards.length} prediction market cards (odds API fallback)`);
              return kalshiCards as InsightCard[];
            })
            .catch(() => generateContextualCards('betting', sportKey, 7).catch(() => []));
        } else {
          cardFetchPromise = generateContextualCards('betting', sportKey, 7).catch(() => []);
        }

      } else if (context.isPoliticalMarket || context.selectedCategory === 'kalshi' || (kalshiPromptMarkets && kalshiPromptMarkets.length > 0)) {
        cardFetchPromise = import('@/lib/kalshi/index')
          .then(({ kalshiMarketToCard }) => {
            const cards = kalshiPromptMarkets!.map((m: any) => kalshiMarketToCard(m));
            console.log(`[KALSHI] Cards from prompt bridge: ${cards.length} markets`);
            return cards as InsightCard[];
          })
          .catch(() => generateContextualCards('kalshi', context.sport ?? undefined, 6, false, context.kalshiSubcategory).catch(() => []));
      } else {
        const isFantasyOrDFSCategory = category === 'fantasy' || category === 'dfs';
        const hasFantasyOrADPIntent = context.hasFantasyIntent || hasADPIntent;
        const validSelectedCategory = context.selectedCategory && ['betting', 'dfs', 'fantasy', 'kalshi', 'props'].includes(context.selectedCategory) ? context.selectedCategory : undefined;
        const effectiveCategory = isFantasyOrDFSCategory && !hasFantasyOrADPIntent ? 'betting' : (validSelectedCategory ?? category);
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
          enrichedPrompt += `\n\n${cardCtx}`;
          console.log(`[v0] [ANALYZE] Injected ${realCards.length} card(s) into AI prompt context`);
        }
      }

      cardPromise = Promise.resolve(resolvedCards);
    }

    // ── Phase 8: Model selection + streamText ─────────────────────────────────
    const xaiApiKey = getGrokApiKey();
    const oddsApiKey = getOddsApiKey();
    const hasClientOddsData = !!(context.oddsData?.events?.length);
    const useFastPath = body.deepThink ? false : (hasADPIntent ? false : (isAmbiguous || shouldUseFastModel(userMessage, context)));
    const primaryModel = body.deepThink ? AI_CONFIG.MODEL_NAME : (useFastPath ? AI_CONFIG.FAST_MODEL_NAME : AI_CONFIG.MODEL_NAME);

    logger.info(LogCategory.AI, 'model_selected', {
      metadata: { model: primaryModel, fastPath: useFastPath, hasADPIntent, sport: context?.sport ?? null },
    });
    console.log(LOG_PREFIXES.PIPELINE, {
      sport:    context.sport  ?? 'none',
      category,
      model:    primaryModel,
      fastPath: useFastPath,
      sources: {
        odds:        hasClientOddsData || serverFetchedOdds,
        kalshi:      !!(kalshiSportsFallbackMarkets?.length) || context.isPoliticalMarket || context.selectedCategory === 'kalshi',
        adp:         hasADPIntent,
        statcast:    expectsStatcastJSON || enrichment.statcastInjected,
        projections:   hasMLBProjectionIntent,
        hrPrediction:  hasHRPredictionIntent,
        fantasy:       !!(context.hasFantasyIntent),
      },
      intent: {
        betting:       !!(context.hasBettingIntent),
        fantasy:       !!(context.hasFantasyIntent),
        player:        !!(context.hasPlayerIntent),
        political:     !!(context.isPoliticalMarket),
        adp:           hasADPIntent,
        hrPrediction:  hasHRPredictionIntent,
        ambiguous:     isAmbiguous,
      },
      keys: {
        XAI_API_KEY:    !!xaiApiKey,
        ODDS_API_KEY:   !!oddsApiKey,
      },
    });

    let aiText = '';
    let modelUsed: string = AI_CONFIG.MODEL_DISPLAY_NAME;
    let usedFallback = false;
    let sentDoneEvent = false;
    let tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;

    // ── Image attachment validation ────────────────────────────────────────────
    const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const validatedImageAttachments = (body.imageAttachments ?? []).filter((img: ImageAttachment) => {
      if (!ALLOWED_IMAGE_MIMES.has(img.mimeType)) {
        console.warn(`[API/analyze] Rejected image with unsupported MIME type: ${img.mimeType}`);
        return false;
      }
      const estimatedBytes = (img.base64?.length ?? 0) * 0.75;
      if (estimatedBytes > MAX_IMAGE_BYTES) {
        console.warn(`[API/analyze] Rejected image exceeding size limit: ~${Math.round(estimatedBytes / 1024)}KB`);
        return false;
      }
      return true;
    });
    const hasImages = validatedImageAttachments.length > 0;

    /** Build the generateText call options supporting both text-only and multimodal */
    const buildGenOptions = (prompt: string, imgs?: ImageAttachment[]) => {
      if (imgs?.length) {
        type ContentPart = { type: 'text'; text: string } | { type: 'image'; image: string; mimeType: string };
        const content: ContentPart[] = [{ type: 'text', text: prompt }];
        for (const img of imgs) {
          content.push({ type: 'image', image: img.base64, mimeType: img.mimeType });
        }
        return { messages: [{ role: 'user' as const, content }] };
      }
      return { prompt };
    };

    /**
     * Build streamText/generateText call options with conversation memory.
     * Returns { system, messages } where `system` is a plain string.
     */
    const buildMessagesWithCacheAndMemory = (
      cachedSystem: string,
      dynamicSystem: string,
      userPrompt: string,
      imgs: ImageAttachment[] | undefined,
      priorTurns: Array<{ role: string; content: string }> | undefined,
    ) => {
      const system = dynamicSystem.trim().length > 0
        ? `${cachedSystem}\n\n${dynamicSystem}`
        : cachedSystem;

      const memoryMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      if (Array.isArray(priorTurns) && priorTurns.length > 0) {
        const last6 = priorTurns.slice(-6);
        let totalChars = 0;
        for (const m of last6) {
          const role = m.role === 'user' || m.role === 'assistant' ? m.role : 'assistant';
          const content = (m.content ?? '').slice(0, 1500);
          if (!content) continue;
          if (totalChars + content.length > 4000) break;
          totalChars += content.length;
          memoryMessages.push({ role, content });
        }
      }

      let userMessageObj: { role: 'user'; content: string | Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mimeType: string }> };
      if (imgs?.length) {
        const content: Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mimeType: string }> = [
          { type: 'text', text: userPrompt },
        ];
        for (const img of imgs) {
          content.push({ type: 'image', image: img.base64, mimeType: img.mimeType });
        }
        userMessageObj = { role: 'user', content };
      } else {
        userMessageObj = { role: 'user', content: userPrompt };
      }

      const messages: ModelMessage[] = [
        ...memoryMessages,
        userMessageObj as unknown as ModelMessage,
      ];
      return { system, messages };
    };

    // ── TOOL DEFINITIONS ──────────────────────────────────────────────────────
    // These tools close over context/detection variables and cannot easily be
    // extracted without a significant interface refactor. They remain inline
    // but are grouped under this section comment for clarity.

    // ── ADP tool ─────────────────────────────────────────────────────────────
    const adpParams = z.object({
      player:    z.string().optional().describe('Partial player name — case-insensitive (e.g. "Judge", "Ohtani", "Trout")'),
      position:  z.string().optional().describe('Position filter: SP | RP | 1B | 2B | 3B | SS | OF | DH | C'),
      rankMin:   z.number().optional().describe('Minimum overall NFBC rank (inclusive)'),
      rankMax:   z.number().optional().describe('Maximum overall NFBC rank (inclusive)'),
      limit:     z.number().optional().describe('Number of players to return (default 10, max 25)'),
      team:      z.string().optional().describe('MLB team abbreviation — e.g. "NYY", "LAD", "BOS", "CHC"'),
      valueOnly: z.boolean().optional().describe('Return only value picks: players drafted 15+ spots later than their rank (sleepers)'),
    });
    const adpTool = tool({
      description:
        'Query NFBC MLB or NFFC NFL Average Draft Position (ADP) data. ' +
        'Use for any question about player draft rankings, average draft position (ADP), ' +
        'positional scarcity in fantasy drafts, or where a specific player is being drafted. ' +
        'Works for both baseball (NFBC) and football (NFFC).',
      inputSchema: adpParams,
      execute: async ({ player, position, rankMin, rankMax, limit, team, valueOnly }: z.infer<typeof adpParams>) => {
        console.log('[API/analyze] ADP tool called:', { player, position, rankMin, rankMax, limit, team, valueOnly });
        const isNFL = context?.sport?.includes('football') || context?.sport === 'nfl' ||
          rawQueryLower.includes('football') || rawQueryLower.includes('nfl') || rawQueryLower.includes('nffc');
        const data = isNFL ? await getNFLADPData() : await getADPData();
        const source = isNFL ? `NFFC ${NFBC_DRAFT_YEAR} NFL ADP` : `NFBC ${NFBC_DRAFT_YEAR} ADP`;
        if (data.length === 0) {
          return {
            players: [],
            total_players_in_dataset: 0,
            source,
            is_static_fallback: true,
            error: 'ADP data is temporarily unavailable. Please try again shortly or consult nfc.shgn.com.',
          };
        }
        const adpIsStatic = data.length <= 150;
        const results = queryADP(data, { player, position, rankMin, rankMax, limit, team, valueOnly });
        return {
          players: results,
          total_players_in_dataset: data.length,
          source,
          is_static_fallback: adpIsStatic,
        };
      },
    });

    // ── Statcast tool ─────────────────────────────────────────────────────────
    const statcastParams = z.object({
      player:     z.string().optional().describe('Partial player name — case-insensitive (e.g. "Judge", "Ohtani")'),
      playerType: z.enum(['batter', 'pitcher']).optional().describe('Restrict to batters or pitchers only'),
      limit:      z.number().optional().describe('Number of players to return (default 10, max 25)'),
    });
    const statcastTool = tool({
      description:
        'Query REAL Baseball Savant Statcast metrics (barrel rate, exit velocity, ' +
        'xwOBA, hard-hit %, sweet-spot %, xBA, xSLG) PLUS pitch-level recent 30-day ' +
        'aggregates from the Leverage AI Statcast database. ' +
        'Use for any MLB player question about Statcast performance or HR probability. ' +
        'Always call this tool FIRST — never invent Statcast numbers. ' +
        'db_recent_30d contains the most recent pitch-level data and should be prioritized ' +
        'over season averages when discussing recent form or hot/cold streaks.',
      inputSchema: statcastParams,
      execute: async ({ player, playerType, limit }: z.infer<typeof statcastParams>) => {
        console.log('[API/analyze] Statcast tool called:', { player, playerType, limit });
        const { players: allPlayers, isLiveData, season } = await getStatcastData();
        const results = allPlayers.length > 0
          ? queryStatcast(allPlayers, { player, playerType, limit })
          : [];
        let dbAggregate = null;
        if (player) {
          try {
            const { getPlayerAggregate } = await import('@/lib/statcastQuery');
            dbAggregate = await getPlayerAggregate(player, playerType ?? 'batter', 30);
          } catch {
            // non-fatal — DB may be empty if scraper hasn't run yet
          }
        }
        return {
          players: results,
          total_in_dataset: allPlayers.length,
          source: isLiveData ? `Baseball Savant ${season} (real data)` : `Baseball Savant ${season} (cached fallback)`,
          ...(dbAggregate && {
            db_recent_30d: {
              source: 'Leverage AI Statcast DB (Baseball Savant pitch-level)',
              playerName: dbAggregate.playerName,
              samplePitches: dbAggregate.samplePitches,
              sampleBIP: dbAggregate.sampleBIP,
              avgExitVelo: dbAggregate.avgExitVelo,
              barrelRate: dbAggregate.barrelRate,
              hardHitRate: dbAggregate.hardHitRate,
              sweetSpotRate: dbAggregate.sweetSpotRate,
              avgLaunchAngle: dbAggregate.avgLaunchAngle,
              avgReleaseSpeed: dbAggregate.avgReleaseSpeed,
              avgSpinRate: dbAggregate.avgSpinRate,
              dateRange: dbAggregate.dateRange,
            },
          }),
          ...(results.length === 0 && !dbAggregate && {
            error: 'Statcast data temporarily unavailable. Use model knowledge for analysis.',
          }),
        };
      },
    });

    // ── MLB Projection Engine tool ────────────────────────────────────────────
    const mlbProjectionParams = z.object({
      playerType: z.enum(['hitter', 'pitcher', 'all']).optional()
        .describe('Filter by player type: hitter, pitcher, or all (default: all)'),
      player:     z.string().optional()
        .describe('Specific player name — partial match (e.g. "Judge", "Cole")'),
      limit:      z.number().optional()
        .describe('Max cards to return (1–15, default 9)'),
      date:       z.string().optional()
        .describe('Date in YYYY-MM-DD format (default: today)'),
      outputFor:  z.enum(['projections', 'dfs', 'fantasy', 'betting']).optional()
        .describe('Output format: projections (MLBProjectionCard), dfs (DFSCard), fantasy (FantasyCard), betting (hr_prop_card edge cards)'),
    });
    const mlbProjectionTool = tool({
      description:
        'Run the LeverageMetrics MLB projection engine (Monte Carlo N=1,000, HR Super Model, ' +
        'K Model, Breakout Score, 9 DFS matchup variables). ' +
        'Use for ANY MLB question about DFS lineups, fantasy advice (waiver/streaming/ROS), ' +
        'HR prop betting edges, or player projections. ' +
        'Always call this tool FIRST — NEVER invent salaries, projections, or odds. ' +
        'Call this tool ONCE per query. When `player` is set, outputFor is ignored — ' +
        'single-player analysis covers all use cases (projections, betting edge, and fantasy).',
      inputSchema: mlbProjectionParams,
      execute: async ({ playerType, player, limit, date, outputFor }: z.infer<typeof mlbProjectionParams>) => {
        console.log('[API/analyze] MLB projection tool called:', { playerType, player, limit, date, outputFor });
        try {
          const resolvedOutputFor = outputFor ?? 'projections';
          let cards: unknown[];
          if (player) {
            const { projectSinglePlayer } = await import('@/lib/mlb-projections/projection-pipeline');
            const type = playerType === 'all' || !playerType ? 'hitter' : playerType;
            const card = await projectSinglePlayer(player, type);
            cards = card ? [card] : [];
          } else switch (resolvedOutputFor) {
            case 'dfs': {
              const { buildDFSSlate } = await import('@/lib/mlb-projections/slate-builder');
              cards = await buildDFSSlate({ limit: limit ?? 9, date });
              break;
            }
            case 'fantasy': {
              const { buildFantasyCards } = await import('@/lib/mlb-projections/fantasy-adapter');
              const raw = await buildFantasyCards({ limit: limit ?? 9, date });
              cards = raw.map(c => ({ ...c, ...c.data, type: c.type }));
              break;
            }
            case 'betting': {
              const { buildBettingEdgeCards } = await import('@/lib/mlb-projections/betting-edges');
              cards = await buildBettingEdgeCards({ limit: limit ?? 9, date });
              break;
            }
            default: {
              const { runProjectionPipeline } = await import('@/lib/mlb-projections/projection-pipeline');
              cards = await runProjectionPipeline({ playerType: playerType ?? 'all', limit: limit ?? 9, date });
              break;
            }
          }
          return {
            success: true,
            cards,
            count: cards.length,
            date: date ?? new Date().toISOString().slice(0, 10),
            source: 'LeverageMetrics MLB Projection Engine',
            outputFor: resolvedOutputFor,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error('[API/analyze] MLB projection tool error:', msg);
          return {
            success: false,
            error: msg,
            cards: [],
            count: 0,
            source: 'LeverageMetrics MLB Projection Engine',
          };
        }
      },
    });

    // ── HR Prediction tool ────────────────────────────────────────────────────
    const hrPredictionParams = z.object({
      player:  z.string().describe('Full or partial player name, e.g. "Aaron Judge", "Judge", "Ohtani"'),
      date:    z.string().optional().describe('Game date YYYY-MM-DD — defaults to today'),
    });
    const predictHRTool = tool({
      description:
        'Predict the probability that a specific MLB batter hits a home run in today\'s game, ' +
        'using the v3 LeverageMetrics HR engine (lineup slot, platoon split scores ±1, ' +
        'pitcher pitch mix vulnerability, park factor, weather, and live market edge). ' +
        'Use for ANY question asking about a player\'s HR probability, chance, or odds tonight. ' +
        'Returns probability (0–1), American odds equivalent, edge vs market, and component breakdown.',
      inputSchema: hrPredictionParams,
      execute: async ({ player, date }: z.infer<typeof hrPredictionParams>) => {
        console.log('[API/analyze] predictHR tool called:', { player, date });
        try {
          const { predictHRForPlayer } = await import('@/lib/engine/hr-prediction-bridge');
          const result = await predictHRForPlayer({ playerName: player, date });
          return { success: true, type: 'hr_prediction_card', player, ...result };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error('[API/analyze] predictHR tool error:', msg);
          return { success: false, error: msg, player, type: 'hr_prediction_card' };
        }
      },
    });

    // ── Kalshi Market Tools ────────────────────────────────────────────────────
    const kalshiGetMarketsParams = z.object({
      category: z.enum(['election', 'sports', 'weather', 'finance', 'trending', 'all'])
        .optional()
        .describe('Market category (default: all)'),
      search:   z.string().optional().describe('Free-text search in market titles'),
      limit:    z.number().optional().describe('Number of markets to return (default: 10, max: 50)'),
    });
    const kalshiGetMarketsTool = tool({
      description:
        'Fetch live Kalshi prediction market data. Use when user asks to "show Kalshi markets", ' +
        '"list election markets", "what are the top Kalshi markets", or any question about ' +
        'prediction market availability, categories, or current YES/NO prices across markets.',
      inputSchema: kalshiGetMarketsParams,
      execute: async ({ category = 'all', search, limit = 10 }: z.infer<typeof kalshiGetMarketsParams>) => {
        console.log('[API/analyze] kalshi_get_markets tool called:', { category, search, limit });
        try {
          const qs = new URLSearchParams({ category, limit: String(Math.min(limit, 50)) });
          if (search) qs.set('search', search);
          const res = await fetch(
            `${process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/kalshi/markets?${qs}`,
            { signal: AbortSignal.timeout(8000) },
          ).catch(() => null);
          if (!res?.ok) {
            const { fetchKalshiMarkets, fetchTopMarketsByVolume } = await import('@/lib/kalshi/index');
            const markets = category === 'trending'
              ? await fetchTopMarketsByVolume(limit)
              : await fetchKalshiMarkets({ search, limit });
            return { success: true, markets: markets.slice(0, limit), count: markets.length };
          }
          return res.json();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[API/analyze] kalshi_get_markets error:', msg);
          return { success: false, error: msg, markets: [] };
        }
      },
    });

    const kalshiGetPriceParams = z.object({
      ticker:    z.string().describe('Kalshi market ticker (e.g. KXBT-25DEC25-T45000, FED-25DEC-ABOVE)'),
      modelProb: z.number().optional().describe('Your model probability [0,1] for edge calculation'),
    });
    const kalshiGetPriceTool = tool({
      description:
        'Get the current YES/NO price for a specific Kalshi market by ticker. ' +
        'Use when user asks "current price on [ticker]", "what\'s [ticker] trading at", ' +
        '"what\'s the edge on [ticker]", or "should I buy yes/no on [market]". ' +
        'Provide modelProb to get an edge calculation vs the market price.',
      inputSchema: kalshiGetPriceParams,
      execute: async ({ ticker, modelProb }: z.infer<typeof kalshiGetPriceParams>) => {
        console.log('[API/analyze] kalshi_get_price tool called:', { ticker, modelProb });
        try {
          const { getMarketByTicker } = await import('@/lib/kalshi/index');
          const { KalshiClient }      = await import('@/lib/kalshi/kalshiClient');
          const market = await getMarketByTicker(ticker.toUpperCase());
          if (!market) return { success: false, error: `Market "${ticker}" not found`, market: null };
          const edge = (modelProb != null && modelProb >= 0 && modelProb <= 1)
            ? KalshiClient.computeEdge(modelProb, market.yesBid, market.yesAsk)
            : null;
          return {
            success: true,
            market,
            edge,
            kalshiUrl: `https://kalshi.com/markets/${market.eventTicker || ticker}/${ticker.toUpperCase()}`,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, error: msg, market: null };
        }
      },
    });

    // ── get_live_odds tool ─────────────────────────────────────────────────────
    const getLiveOddsParams = z.object({
      sport: z.string().describe('Sport key: basketball_nba | americanfootball_nfl | baseball_mlb | icehockey_nhl'),
    });
    const getLiveOddsTool = tool({
      description: "Fetch current sportsbook odds for a sport. Use when the user asks about a game, spread, moneyline, or total and live odds aren't already provided in the context.",
      inputSchema: getLiveOddsParams,
      execute: async ({ sport }: z.infer<typeof getLiveOddsParams>) => {
        console.log('[API/analyze] get_live_odds tool called:', { sport });
        try {
          const oddsKey = getOddsApiKey();
          if (!oddsKey) return { error: 'Odds API key not configured' };
          const { fetchLiveOdds, validateSportKey } = await import('@/lib/odds/index');
          const { normalizedKey: _sportKey = sport } = validateSportKey(sport);
          const data = await fetchLiveOdds(_sportKey, {
            apiKey: oddsKey,
            markets: ['h2h', 'spreads', 'totals'],
            regions: ['us'],
            oddsFormat: 'american',
          });
          return data;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { error: msg };
        }
      },
    });

    // ── Line movement / sharp money tool ──────────────────────────────────────
    const getOddsMoversTool = tool({
      description: 'Fetch the biggest game-level line movements (spreads, totals, h2h) in the last 24 hours. Use when the user asks about line movement, steam moves, sharp money, or biggest movers.',
      inputSchema: z.object({
        hours: z.number().optional().describe('Look-back window in hours (default 24)'),
      }),
      execute: async ({ hours = 24 }: { hours?: number }) => {
        console.log('[API/analyze] get_odds_movers tool called:', { hours });
        try {
          const baseOrigin = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
          const res = await fetch(`${baseOrigin}/api/odds/movers?hours=${hours}`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) return { movers: [] };
          return await res.json();
        } catch (err) {
          return { movers: [], error: err instanceof Error ? err.message : String(err) };
        }
      },
    });

    // ── Best props / prop picks tool ───────────────────────────────────────────
    // Pre-warn the AI when props are requested but no live game data exists
    if (hasPropsToolIntent && noLiveGamesDetected) {
      enrichedPrompt += `\n\n[Note: Player props data may be unavailable if no live games are currently scheduled. If the get_props_latest tool returns empty results, clearly acknowledge that live prop lines are not available for this sport today and offer alternatives: historical prop hit rates, season-long averages, or ask what the user wants to analyze instead.]`;
    }

    const getPropsLatestTool = tool({
      description: 'Fetch the latest player prop lines (over/under lines and prices). Use when the user asks about best props, prop picks, or player prop betting.',
      inputSchema: z.object({
        sport:  z.string().optional().describe('Sport key, e.g. basketball_nba'),
        market: z.string().optional().describe('Market key, e.g. batter_home_runs, player_points'),
      }),
      execute: async ({ sport, market }: { sport?: string; market?: string }) => {
        console.log('[API/analyze] get_props_latest tool called:', { sport, market });
        try {
          const baseOrigin = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
          const params = new URLSearchParams();
          if (sport)  params.set('sport', sport);
          if (market) params.set('market', market);
          const res = await fetch(`${baseOrigin}/api/props/latest?${params}`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) return { props: [] };
          return await res.json();
        } catch (err) {
          return { props: [], error: err instanceof Error ? err.message : String(err) };
        }
      },
    });

    // ── SSE streaming response ─────────────────────────────────────────────────
    const encoder = new TextEncoder();
    const sseChunk = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
    let streamClosed = false;
    const safeEnqueue = (ctrl: ReadableStreamDefaultController, chunk: Uint8Array) => {
      if (streamClosed) return;
      try { ctrl.enqueue(chunk); } catch { streamClosed = true; }
    };

    const toolResultSummary = (toolName: string, result: unknown): string => {
      try {
        const r = result as Record<string, unknown>;
        if (toolName === 'query_mlb_projections') return `${(r?.projections as unknown[] | undefined)?.length ?? 0} MLB projections`;
        if (toolName === 'query_adp')             return `${(r?.players as unknown[] | undefined)?.length ?? 0} ADP entries`;
        if (toolName === 'query_statcast')         return r?.count ? `${r.count} Statcast records` : 'Statcast data';
        if (toolName === 'kalshi_get_markets')     return `${(r?.markets as unknown[] | undefined)?.length ?? 0} Kalshi markets`;
        if (toolName === 'kalshi_get_price')       return r?.probability ? `${(Number(r.probability) * 100).toFixed(0)}% probability` : 'Kalshi price';
        if (toolName === 'get_live_odds')          return `${(r?.events as unknown[] | undefined)?.length ?? 0} live odds`;
        if (toolName === 'get_props_latest')       return `${(r?.props as unknown[] | undefined)?.length ?? (r?.total as number | undefined) ?? 0} player props`;
        if (toolName === 'get_odds_movers')        return `${(r?.movers as unknown[] | undefined)?.length ?? 0} line movers`;
        if (toolName === 'predict_hr')             return 'HR model computed';
      } catch { /* ignore */ }
      return 'data fetched';
    };

    const responseStream = new ReadableStream({
      async start(controller) {
        // Capture safeEnqueue for use in post-processor
        const enqueue = (chunk: Uint8Array) => safeEnqueue(controller, chunk);

        try {
          if (xaiApiKey) {
            const primaryTimeoutMs = PRIMARY_TIMEOUT_MS(useFastPath);
            const abortCtrl = new AbortController();
            const streamStartMs = Date.now();
            const VERCEL_BUDGET_MS = 56_000;

            const streamResult = streamText({
              model: xaiNoEmptyContent(createXai({ apiKey: xaiApiKey })(primaryModel)),
              ...buildMessagesWithCacheAndMemory(
                cachedSystem,
                dynamicSystem,
                enrichedPrompt,
                hasImages ? validatedImageAttachments : undefined,
                context?.previousMessages,
              ),
              temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
              maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
              maxRetries: 0,
              abortSignal: abortCtrl.signal,
              onStepFinish: ({ toolCalls, toolResults }) => {
                if (!toolCalls?.length) return;
                clearTimeout(firstTokenTimer);
                const elapsed = Date.now() - streamStartMs;
                const remaining = Math.max(8_000, VERCEL_BUDGET_MS - elapsed);
                firstTokenTimer = setTimeout(
                  () => abortCtrl.abort(new Error('Primary timeout (step 2)')),
                  remaining,
                );
                for (const tc of toolCalls) {
                  const result = (toolResults as any[])?.find((r: any) => r.toolCallId === tc.toolCallId)?.result;
                  const summary = toolResultSummary(tc.toolName, result);
                  safeEnqueue(controller, sseChunk({ type: 'tool_call', name: tc.toolName, summary }));
                }
              },
              // stepCountIs capped at 2 for all tools — xAI rejects messages[6]+
              ...(hasADPIntent && { tools: { query_adp: adpTool }, stopWhen: stepCountIs(2) }),
              ...(hasHRPredictionIntent && { tools: { predict_hr: predictHRTool }, stopWhen: stepCountIs(2) }),
              ...(hasKalshiToolIntent && !hasHRPredictionIntent && !hasADPIntent && { tools: { kalshi_get_markets: kalshiGetMarketsTool, kalshi_get_price: kalshiGetPriceTool }, stopWhen: stepCountIs(2) }),
              ...(!hasHRPredictionIntent && !hasKalshiToolIntent && hasMLBProjectionIntent && { tools: { query_mlb_projections: mlbProjectionTool }, stopWhen: stepCountIs(2) }),
              ...(!hasHRPredictionIntent && !hasKalshiToolIntent && !hasMLBProjectionIntent && isMLBStatcastMode && { tools: { query_statcast: statcastTool }, stopWhen: stepCountIs(2) }),
              ...(hasLineMovementIntent && { tools: { get_odds_movers: getOddsMoversTool }, stopWhen: stepCountIs(2) }),
              ...(hasPropsToolIntent && !hasLineMovementIntent && { tools: { get_props_latest: getPropsLatestTool }, stopWhen: stepCountIs(2) }),
              ...(!hasADPIntent && !hasHRPredictionIntent && !hasKalshiToolIntent && !hasMLBProjectionIntent && !isMLBStatcastMode && !hasLineMovementIntent && !hasPropsToolIntent && context.hasBettingIntent && !serverFetchedOdds && { tools: { get_live_odds: getLiveOddsTool }, stopWhen: stepCountIs(2) }),
              ...(body.deepThink && { maxSteps: 3 }),
            });

            // Emit card SSE frames as soon as cards resolve (concurrently with text stream)
            cardPromise.then(earlyCards => {
              for (const c of earlyCards) {
                safeEnqueue(controller, sseChunk({ type: 'card', card: c }));
              }
            }).catch((e: unknown) => {
              console.warn('[v0] [ANALYZE] card SSE emit failed:', e instanceof Error ? e.message : e);
            });

            // eslint-disable-next-line prefer-const
            let firstTokenTimer = setTimeout(() => abortCtrl.abort(new Error('Primary timeout')), primaryTimeoutMs);
            const RESPONSE_CHAR_LIMIT = 8_000;

            try {
              let gotFirstToken = false;
              let responseTruncated = false;
              for await (const delta of streamResult.textStream) {
                if (!gotFirstToken) { gotFirstToken = true; clearTimeout(firstTokenTimer); }
                if (responseTruncated) continue;
                if (aiText.length + delta.length > RESPONSE_CHAR_LIMIT) {
                  const remaining = RESPONSE_CHAR_LIMIT - aiText.length;
                  if (remaining > 0) {
                    const partial = delta.slice(0, remaining);
                    aiText += partial;
                    safeEnqueue(controller, sseChunk({ type: 'text', delta: partial }));
                  }
                  const notice = '\n\n---\n_Response truncated — ask me to continue or be more specific._';
                  aiText += notice;
                  safeEnqueue(controller, sseChunk({ type: 'text', delta: notice }));
                  responseTruncated = true;
                  console.warn(`[API/analyze] Response truncated at ${RESPONSE_CHAR_LIMIT} chars`);
                  continue;
                }
                aiText += delta;
                safeEnqueue(controller, sseChunk({ type: 'text', delta }));
              }
              clearTimeout(firstTokenTimer);
              modelUsed = useFastPath ? AI_CONFIG.FAST_MODEL_DISPLAY_NAME : AI_CONFIG.MODEL_DISPLAY_NAME;

              // ── Capture token usage ─────────────────────────────────────────
              try {
                const usage = await streamResult.usage;
                if (usage) {
                  tokenUsage = {
                    promptTokens: usage.inputTokens ?? 0,
                    completionTokens: usage.outputTokens ?? 0,
                    totalTokens: usage.totalTokens ?? 0,
                  };
                  const anthrUsage = usage as Record<string, unknown>;
                  const cacheRead = anthrUsage.cacheReadInputTokens as number | undefined;
                  const cacheWrite = anthrUsage.cacheCreationInputTokens as number | undefined;
                  if (typeof cacheRead === 'number' || typeof cacheWrite === 'number') {
                    console.log(
                      `[API/analyze] Cache: read=${cacheRead ?? 0} write=${cacheWrite ?? 0} ` +
                      `(input total=${usage.inputTokens ?? 0})`,
                    );
                  }
                }
              } catch {
                // Non-fatal
              }

              // ── Phase 9: Post-processing + done SSE ───────────────────────
              const allToolResults: any[] = await (streamResult as any).toolResults ?? [];
              const allToolCalls: any[] = await (streamResult as any).toolCalls ?? [];

              const toolOutput = extractToolResults(allToolResults, allToolCalls, detection, context);
              const { cards: finalCards, aiText: processedAiText } = assembleFinalCards(
                await cardPromise.catch(() => []),
                toolOutput,
                aiText,
                detection,
                context,
                noLiveGamesDetected,
                usedFallback,
                enqueue,
                sseChunk,
                logger,
                LogCategory,
              );
              aiText = processedAiText;

              const processingTime = Date.now() - startTime;
              logger.info(LogCategory.AI, 'response_complete', {
                metadata: { cardCount: finalCards.length, clarification: isAmbiguous, sport: context?.sport ?? null, latencyMs: processingTime },
              });

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
                    flags: [{ type: 'info', message: 'Using fallback mode — AI temporarily unavailable', severity: 'info' as const }],
                  }
                : detectHallucinations(aiText, userMessage, context.oddsData, { category, hasBettingIntent: context.hasBettingIntent });

              const trustMetrics = (hasRealOdds && !usedFallback)
                ? {
                    ...baseMetrics,
                    oddsAlignment: Math.min(99, (baseMetrics.oddsAlignment ?? 80) + 8),
                    marketConsensus: Math.min(99, (baseMetrics.marketConsensus ?? 80) + 6),
                    finalConfidence: Math.min(99, (baseMetrics.finalConfidence ?? 80) + 5),
                    adjustedTone: baseMetrics.finalConfidence >= 85 ? 'Strong signal — live data verified' : baseMetrics.adjustedTone,
                  }
                : baseMetrics;

              const sources: Array<{ name: string; type: string; reliability: number }> = [
                usedFallback
                  ? { name: 'Fallback Mode', type: 'cache' as const, reliability: 65 }
                  : DEFAULT_SOURCES.GROK_AI,
              ];
              if (hasRealOdds) sources.push(DEFAULT_SOURCES.ODDS_API);
              if (context.isPoliticalMarket) sources.push(DEFAULT_SOURCES.KALSHI);
              if (context.hasFantasyIntent && !context.hasBettingIntent) {
                sources.push({ name: 'Fantasy Projections Engine', type: 'database' as const, reliability: 91 });
              }
              if (hasADPIntent) {
                const isNFLContext = context?.sport?.includes('football') || context?.sport === 'nfl' || rawQueryLower.includes('nffc') || rawQueryLower.includes('nfl draft') || rawQueryLower.includes('fantasy football');
                const adpBoardName = isNFLContext
                  ? `NFFC ${new Date().getFullYear()} NFL ADP Board`
                  : `NFBC ${new Date().getFullYear()} ADP Board`;
                sources.push({ name: adpBoardName, type: 'api' as const, reliability: 97 });
              }

              // Store successful response in dedup cache
              if (aiText && !usedFallback) {
                dedupCache.set(queryHash, {
                  text: aiText,
                  cards: finalCards,
                  confidence: trustMetrics.finalConfidence,
                  ts: Date.now(),
                });
              }

              const responsePayloadSize = aiText.length + JSON.stringify(finalCards).length;
              console.log(
                `[API/analyze] done — text=${aiText.length}B cards=${finalCards.length} payload≈${responsePayloadSize}B` +
                (tokenUsage ? ` tokens=${tokenUsage.totalTokens}` : '') +
                ` time=${processingTime}ms`,
              );

              sentDoneEvent = true;
              safeEnqueue(controller, sseChunk({
                type: 'done',
                success: true,
                text: aiText,
                cards: finalCards,
                confidence: trustMetrics.finalConfidence,
                sources,
                modelUsed,
                trustMetrics,
                processingTime,
                useFallback: usedFallback,
                clarificationNeeded: isAmbiguous || noLiveGamesDetected,
                clarificationOptions,
                ...(tokenUsage && { tokenUsage }),
              }));

            } catch (streamErr) {
              clearTimeout(firstTokenTimer);
              const alreadyFast = useFastPath;
              const actualFallbackModel = alreadyFast ? AI_CONFIG.MODEL_NAME : AI_CONFIG.FAST_MODEL_NAME;
              const errBody = (() => {
                if (streamErr && typeof streamErr === 'object') {
                  const e = streamErr as Record<string, unknown>;
                  const responseBody = typeof e.responseBody === 'string' ? e.responseBody : '';
                  if (responseBody.includes('cache_control') || responseBody.includes('invalid_request_error')) {
                    return { summary: 'xAI 400 invalid_request_error (multi-step tool call exceeded safe depth)', isBadRequest: true };
                  }
                  if (e.statusCode) return { summary: `HTTP ${e.statusCode} from ${e.url ?? 'xAI'}`, isBadRequest: false };
                }
                return { summary: streamErr instanceof Error ? streamErr.message : String(streamErr), isBadRequest: false };
              })();
              console.error(`[API/analyze] Primary stream failed — ${errBody.summary} | Retrying with ${actualFallbackModel}`);
              try {
                const fallbackAbort = new AbortController();
                const fallbackTimer = setTimeout(() => fallbackAbort.abort(new Error('Fallback timeout')), FALLBACK_TIMEOUT_MS);
                const fallbackResult = await generateText({
                  model: createXai({ apiKey: xaiApiKey })(actualFallbackModel),
                  ...buildMessagesWithCacheAndMemory(
                    cachedSystem,
                    dynamicSystem,
                    enrichedPrompt,
                    undefined,
                    context?.previousMessages,
                  ),
                  temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
                  maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
                  maxRetries: 0,
                  abortSignal: fallbackAbort.signal,
                });
                clearTimeout(fallbackTimer);
                aiText = fallbackResult.text;
                modelUsed = alreadyFast ? `${AI_CONFIG.MODEL_DISPLAY_NAME} (fallback)` : `${AI_CONFIG.FAST_MODEL_DISPLAY_NAME} (fallback)`;
                console.log(`[API/analyze] Fallback succeeded with ${actualFallbackModel}`);
                safeEnqueue(controller, sseChunk({ type: 'text', delta: aiText }));
              } catch (fallbackErr) {
                const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
                console.error('[API/analyze] Fallback also failed:', fallbackMsg);
                const primaryStatus = (streamErr as Record<string, unknown>)?.statusCode as number | undefined;
                const isRateLimit = primaryStatus === 429 || fallbackMsg.includes('429') || fallbackMsg.toLowerCase().includes('rate limit');
                const isAuthError = primaryStatus === 401 || fallbackMsg.includes('401') || fallbackMsg.toLowerCase().includes('unauthorized');
                if (isRateLimit || isAuthError) {
                  const errMsg = isRateLimit
                    ? 'AI rate limit reached — please wait a moment and try again.'
                    : 'AI API key error — contact support if this persists.';
                  safeEnqueue(controller, sseChunk({ type: 'error', message: errMsg }));
                  aiText = errMsg;
                } else {
                  aiText = generateFallbackResponse(userMessage, context);
                  safeEnqueue(controller, sseChunk({ type: 'text', delta: aiText }));
                }
                modelUsed = isRateLimit ? 'Fallback (rate limited)' : isAuthError ? 'Fallback (auth error)' : fallbackMsg.includes('timeout') ? 'Fallback (timeout)' : 'Fallback (API error — check XAI_API_KEY)';
                usedFallback = true;
              }
            }
          } else {
            // No API key — use static fallback
            aiText = generateFallbackResponse(userMessage, context);
            modelUsed = 'Fallback';
            usedFallback = true;
            safeEnqueue(controller, sseChunk({ type: 'text', delta: aiText }));
          }

          // ── Post-processing when done event wasn't sent by the success path ──
          // Covers: (1) no API key, (2) primary stream failed + fallback succeeded,
          // (3) primary stream failed + fallback also failed (usedFallback=true).
          if (!sentDoneEvent) {
            let cards: InsightCard[] = await cardPromise.catch(() => []);
            const processingTime = Date.now() - startTime;
            const trustMetrics = {
              benfordIntegrity: 65, oddsAlignment: 65, marketConsensus: 65,
              historicalAccuracy: 68, finalConfidence: 65,
              trustLevel: 'medium' as const, riskLevel: 'medium' as const,
              adjustedTone: 'Limited data — AI unavailable',
              flags: [{ type: 'info', message: 'Using fallback mode — AI temporarily unavailable', severity: 'info' as const }],
            };
            const finalCards = noLiveGamesDetected
              ? cards.filter((c: InsightCard) => c.data?.realData !== false && c.metadata?.realData !== false)
              : cards;
            const sources = [{ name: 'Fallback Mode', type: 'cache' as const, reliability: 65 }];
            console.log(`[API/analyze] done (fallback) — text=${aiText.length}B cards=${finalCards.length} time=${processingTime}ms`);
            safeEnqueue(controller, sseChunk({
              type: 'done',
              success: true,
              text: aiText,
              cards: finalCards,
              confidence: 65,
              sources,
              modelUsed,
              trustMetrics,
              processingTime,
              useFallback: true,
              clarificationNeeded: isAmbiguous || noLiveGamesDetected,
              clarificationOptions,
            }));
          }

        } catch (innerError) {
          console.error('[API/analyze] Stream controller error:', innerError);
          try {
            safeEnqueue(controller, sseChunk({
              type: 'done',
              success: true,
              text: generateFallbackResponse(userMessage, context),
              cards: [],
              confidence: 65,
              sources: [{ name: 'Fallback Mode', type: 'cache', reliability: 65 }],
              modelUsed: 'Fallback',
              trustMetrics: {
                benfordIntegrity: 65, oddsAlignment: 65, marketConsensus: 65,
                historicalAccuracy: 68, finalConfidence: 65,
                trustLevel: 'medium', riskLevel: 'medium',
                adjustedTone: 'Error occurred — showing fallback', flags: [],
              },
              processingTime: Date.now() - startTime,
              useFallback: true,
              clarificationNeeded: false,
              clarificationOptions: [],
            }));
          } catch { /* ignore if controller already errored */ }
        } finally {
          streamClosed = true; try { controller.close(); } catch { /* ignore */ }
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[API/analyze] Unhandled error:', error);

    if (error instanceof Error && (error.message.includes('timeout') || error.name === 'AbortError')) {
      return NextResponse.json(
        {
          success: true,
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
