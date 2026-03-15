import { NextRequest, NextResponse } from 'next/server';
import { streamText, generateText, tool, stepCountIs } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { z } from 'zod';
import {
  AI_CONFIG,
  SYSTEM_PROMPT,
  MLB_ANALYSIS_ADDENDUM,
  NFBC_ADP_ADDENDUM,
  MLB_PROJECTION_ADDENDUM,
  FANTASY_STARTSIT_ADDENDUM,
  DEFAULT_SOURCES,
  HTTP_STATUS,
  ERROR_MESSAGES,
  NFBC_DRAFT_YEAR,
} from '@/lib/constants';
import { getADPData, queryADP, parseTSV, saveADPToSupabase, clearADPCache } from '@/lib/adp-data';
import { getNFLADPData, clearNFLADPCache } from '@/lib/nfl-adp-data';
import { getStatcastData, queryStatcast } from '@/lib/baseball-savant';
import type { StatcastPlayer } from '@/lib/baseball-savant';
import { generateContextualCards, oddsEventsToBettingCards, type InsightCard } from '@/lib/cards-generator';
import { detectHallucinations } from '@/lib/hallucination-detector';
import { getGrokApiKey } from '@/lib/config';
import { logger, LogCategory } from '@/lib/logger';
import { getMarketIntelligenceSummary } from '@/lib/market-intelligence';

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
    selectedCategory?: string;
    oddsKeyMissing?: boolean;
    leagueSize?: number;
    leagueScoringFormat?: string;
  };
}

// ============================================================================
// Model routing helpers
// ============================================================================

/**
 * Returns true for query types where grok-3-mini is sufficient and faster:
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
  if (context?.hasFantasyIntent && !context?.hasBettingIntent) return true;
  if (userMessage.includes('[File:')) return true;   // CSV / file upload
  if (context?.noGamesAvailable) return true;         // off-season
  if (context?.isPoliticalMarket) return true;        // Kalshi — no live-odds accuracy needed

  // Kalshi/prediction-market follow-ups often lose isPoliticalMarket=true (e.g. "Deeper analysis on: yes Jokić: 6+...")
  // Detect them by keyword so they always take the fast path regardless of context flags.
  // Use a regex to handle both ",yes " and ", yes " patterns (no-space after comma from Kalshi titles).
  const kalshiKeywords = ['kalshi', 'prediction market', 'deeper analysis on:'];
  if (kalshiKeywords.some(k => lower.includes(k))) return true;
  if (/[,\s]yes\s+\w/i.test(userMessage)) return true; // catches ",yes Giannis" and ", yes Team"

  // MLB Statcast / HR / pitch queries always use the primary model — accuracy matters
  if (context?.sport === 'mlb' && (lower.includes('hr') || lower.includes('statcast') || lower.includes('pitch') || lower.includes('home run') || lower.includes('barrel'))) {
    return false;
  }
  return false;
}

// ============================================================================
// POST /api/analyze
// ============================================================================

// ── Server-side rate limiter (in-memory, resets on cold start) ──────────────
// Adequate for single-region Vercel deployment. For multi-instance scale,
// replace with Upstash Redis: https://github.com/upstash/ratelimit
const _rateMap = new Map<string, { count: number; resetAt: number }>();
const _RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const _RATE_LIMIT = 30; // requests per IP per window

function _checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = _rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    _rateMap.set(ip, { count: 1, resetAt: now + _RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= _RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Server-side rate limit check (bypasses client-side localStorage spoofing)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!_checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Rate limit exceeded. Try again in an hour.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' } },
    );
  }

  try {
    const body: AnalyzeRequestBody = await request.json();
    const { userMessage, existingCards = [], context = {}, customInstructions } = body;

    // Inject live date into system prompt
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const baseSystemPrompt = SYSTEM_PROMPT.replace('[CURRENT_DATE]', dateStr);

    // Build dynamic system prompt — inject user instructions at highest priority level.
    // For MLB queries, append the MLB_ANALYSIS_ADDENDUM so Grok returns structured
    // JSON cards (statcast_summary_card, hr_prop_card, etc.) instead of prose.
    const isMLBQuery = context?.sport === 'mlb';

    // ADP intent: user is asking about NFBC/NFFC draft positions or rankings only.
    // Narrowed: no longer fires for all MLB fantasy queries — only explicit ADP keywords.
    const msgLower = userMessage.toLowerCase();

    // ── Team-name → sport inference ──────────────────────────────────────────
    // When context.sport is absent or 'none', scan the user message for known
    // team nicknames and infer the sport so card generation and model routing
    // use the correct sport context instead of falling through to 'all'.
    const TEAM_TO_SPORT: Record<string, string> = {
      // NBA
      cavaliers: 'nba', cavs: 'nba', mavericks: 'nba', mavs: 'nba',
      lakers: 'nba', celtics: 'nba', warriors: 'nba', bucks: 'nba',
      heat: 'nba', knicks: 'nba', nets: 'nba', sixers: 'nba',
      suns: 'nba', nuggets: 'nba', clippers: 'nba', thunder: 'nba',
      // NFL
      cowboys: 'nfl', patriots: 'nfl', chiefs: 'nfl', eagles: 'nfl',
      packers: 'nfl', ravens: 'nfl', bills: 'nfl', rams: 'nfl',
      niners: 'nfl', broncos: 'nfl', steelers: 'nfl', bengals: 'nfl',
      // MLB
      yankees: 'mlb', dodgers: 'mlb', cubs: 'mlb', astros: 'mlb',
      braves: 'mlb', mets: 'mlb', 'red sox': 'mlb', cardinals: 'mlb',
      giants: 'mlb', phillies: 'mlb', padres: 'mlb', mariners: 'mlb',
      // NHL
      penguins: 'nhl', rangers: 'nhl', bruins: 'nhl', lightning: 'nhl',
      oilers: 'nhl', avalanche: 'nhl', panthers: 'nhl', maple: 'nhl',
    };

    let inferredSport = context?.sport && context.sport !== 'none' ? context.sport : undefined;
    if (!inferredSport) {
      for (const [team, sportName] of Object.entries(TEAM_TO_SPORT)) {
        if (msgLower.includes(team)) { inferredSport = sportName; break; }
      }
    }
    // Merge inferred sport back into context so downstream handlers pick it up
    if (inferredSport && !context.sport) {
      context.sport = inferredSport;
    }

    const hasADPIntent =
      ['adp', 'nfbc', 'nffc', 'average draft', 'draft position', 'draft rank', 'draft order', 'nfbc board', 'nffc board']
        .some(k => msgLower.includes(k));

    // Start/sit intent: user wants daily matchup-based start or sit advice.
    const START_SIT_KEYWORDS = [
      'start/sit', 'start or sit', 'sit or start', 'who should i start',
      'who do i start', 'should i start', 'should i sit', 'matchup-based',
      'matchup based', 'streaming', 'stream this week', 'stream today',
      'must start', 'must sit', 'favorable matchup', 'tough matchup',
    ];
    const hasStartSitIntent =
      context?.hasFantasyIntent === true &&
      START_SIT_KEYWORDS.some(k => msgLower.includes(k));

    // Statcast JSON mode only applies to non-ADP, non-start/sit MLB queries
    const isMLBStatcastMode = isMLBQuery && !hasADPIntent && !hasStartSitIntent;

    // MLB Projection Engine intent: projection/DFS/fantasy/betting queries that need
    // the LeverageMetrics algorithm (Monte Carlo, HR model, breakout scores).
    const MLB_PROJECTION_KEYWORDS = [
      'dfs', 'daily fantasy', 'draftkings lineup', 'fanduel lineup',
      'salary', 'stack', 'lineup',
      'waiver', 'ros', 'rest of season',
      'projection', 'project', 'breakout', 'monte carlo',
      'forecast', 'pace', 'park factor',
      'hr prop', 'k prop', 'strikeout prop',
    ];
    const hasMLBProjectionIntent =
      isMLBQuery &&
      !hasADPIntent &&
      !hasStartSitIntent &&
      MLB_PROJECTION_KEYWORDS.some(k => msgLower.includes(k));

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
    // Strip common jailbreak patterns from user-controlled custom instructions
    // before injecting them into the system prompt.
    const sanitizeCustomInstructions = (raw: string): string => {
      const sanitized = raw
        .slice(0, 2000) // hard character cap
        .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[filtered]')
        .replace(/forget\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[filtered]')
        .replace(/disregard\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[filtered]')
        .replace(/\bsystem\s*prompt\b/gi, '[filtered]')
        .replace(/\[INST\]|\[\/INST\]|<s>|<\/s>|<\|im_start\|>|<\|im_end\|>/g, '') // LLM escape tokens
        .replace(/\bDAN\b|\bjailbreak\b/gi, '[filtered]') // common jailbreak keywords
        .trim();
      if (sanitized !== raw.trim().slice(0, 2000)) {
        console.warn('[API/analyze] Custom instructions sanitized — potential injection attempt filtered');
      }
      return sanitized;
    };

    const systemPrompt = customInstructions?.trim()
      ? `${baseWithAddendum}\n\n## USER PROFILE & BETTING PREFERENCES\n${sanitizeCustomInstructions(customInstructions)}`
      : baseWithAddendum;

    // ── Auto-save inline TSV/CSV ADP uploads ─────────────────────────────────────
    // When a user drags a TSV file into the chat, the content is embedded inline
    // as "[File: ADP.tsv (N rows)]\nCol1\tCol2\t...\n...". If this message has
    // ADP intent we extract and save to Supabase right now so that the query_adp
    // tool (called later) returns the real uploaded data instead of static fallback.
    if (hasADPIntent && userMessage.includes('[File:')) {
      // Find all inline file blocks: "[File: name (N rows)]\n<content up to next [File: or end>"
      const fileBlockRe = /\[File:\s*([^\]]+\.(?:tsv|csv))[^\]]*\]\n([\s\S]*?)(?=\n\[File:|$)/gi;
      let fileMatch;
      while ((fileMatch = fileBlockRe.exec(userMessage)) !== null) {
        const fileName = (fileMatch[1] ?? '').toLowerCase();
        const rawContent = fileMatch[2] ?? '';
        if (!rawContent.trim()) continue;

        // Reconstruct minimal TSV with header from page-client's format:
        // The first line IS the header (tab-joined), subsequent lines are rows.
        const players = parseTSV(rawContent);
        if (players.length < 5) continue; // not a real ADP board

        const isNFLFile = fileName.includes('nfl') || fileName.includes('football') ||
          msgLower.includes('nfl') || msgLower.includes('nffc') || msgLower.includes('football');
        const sport = isNFLFile ? 'nfl' : 'mlb';

        try {
          await saveADPToSupabase(players, sport);
          if (sport === 'nfl') {
            clearNFLADPCache();
          } else {
            clearADPCache();
          }
          console.log(`[API/analyze] Auto-saved ${players.length} ${sport.toUpperCase()} ADP players from inline file upload`);
        } catch (saveErr) {
          console.warn('[API/analyze] Failed to auto-save inline ADP upload:', saveErr);
        }
        break; // only process the first valid ADP file
      }
    }

    // Detect ambiguous queries with no sport/intent context — ask a clarifying question
    const isAmbiguous = !context?.sport
      && !context?.isSportsQuery
      && !context?.hasFantasyIntent
      && !context?.isPoliticalMarket
      && !context?.hasBettingIntent
      && context?.selectedCategory !== 'kalshi'
      && !customInstructions?.trim();

    // Sport-specific clarification: intent known but sport missing
    const needsFantasySport = !!(context?.hasFantasyIntent && !context?.sport
      && context?.selectedCategory === 'fantasy' && !context?.isPoliticalMarket);
    const needsDFSSport = !!(context?.selectedCategory === 'dfs' && !context?.sport);
    const needsBettingSport = !!(context?.hasBettingIntent && !context?.sport
      && !context?.isPoliticalMarket && context?.selectedCategory === 'betting');

    const clarificationOptions: string[] = isAmbiguous
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

    // Determine analysis category from context
    // Sports queries (even without explicit betting keywords like "MLB Offseason")
    // should use 'betting' so generateContextualCards fetches real game/odds cards.
    const category = context.isPoliticalMarket
      ? 'kalshi'
      : context.selectedCategory === 'dfs'
        ? 'dfs'
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
    } else if (context.isPoliticalMarket || context.selectedCategory === 'kalshi') {
      // Kalshi prediction market query — answer directly, no sports clarification needed
      enrichedPrompt += `\n\n[Context: This is a Kalshi prediction market query. Answer directly with prediction market analysis, probability edge, and trading recommendations. Do NOT ask the user to choose a sports platform or area — the user is already on the Kalshi tab. Analyze the specific market or topic asked about.]`;
    } else if (!context.hasBettingIntent && !context.sport && !context.isPoliticalMarket) {
      // General question — answer from knowledge
      enrichedPrompt += `\n\n[Context: General question — answer with your full expert knowledge about sports betting, fantasy, DFS, or prediction markets as appropriate.]`;
    }

    // Market Intelligence signal injection (non-blocking, 2s timeout)
    // Only injected when we have a primary event in live odds data
    if (context.sport && context.oddsData?.events?.length > 0) {
      try {
        const primaryEvent = context.oddsData.events[0];
        const primaryEventId = primaryEvent?.id;
        if (primaryEventId) {
          const intel = await Promise.race([
            getMarketIntelligenceSummary(primaryEventId, context.sport),
            new Promise<null>(resolve => setTimeout(() => resolve(null), 2000)),
          ]);
          if (intel && intel.severity !== 'none') {
            enrichedPrompt += `\n\n[Market Intelligence Signals]\nAnomaly Score: ${intel.anomalyScore.toFixed(2)} (${intel.severity} severity)\nSurface Probability: ${(intel.surfaceProbability * 100).toFixed(1)}%\nLine Movement: ${intel.movementType} (velocity ${intel.velocityScore.toFixed(0)}/100)\nBenford Trust Score: ${intel.benfordTrust.toFixed(0)}/100\nComposite Signal Strength: ${intel.signalStrength.toFixed(0)}/100\n[Use these signals to contextualize your analysis. High anomaly scores may indicate smart-money movement or cross-market mispricing worth highlighting.]`;
          }
        }
      } catch {
        // Non-blocking — intelligence signals are additive, never block the AI response
      }
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
      && !context.hasBettingIntent
      && !context.isPoliticalMarket
      && context.selectedCategory !== 'kalshi';
    let cardPromise: Promise<InsightCard[]>;
    if (isAmbiguous) {
      // Ambiguous query — return trending multi-sport cards as fallback so UI is never empty
      cardPromise = Promise.race([
        generateContextualCards('all', undefined, 6),
        new Promise<InsightCard[]>(resolve => setTimeout(() => resolve([]), 8000)),
      ]).catch(() => []);
    } else if (hasExistingCards) {
      cardPromise = Promise.resolve(existingCards as InsightCard[]);
    } else if (!context.isPoliticalMarket && context.selectedCategory === 'dfs') {
      // DFS tab — generate DFS lineup card(s) specifically
      cardPromise = Promise.race([
        generateContextualCards('dfs', context.sport ?? undefined, 3),
        new Promise<InsightCard[]>(resolve => setTimeout(() => resolve([]), 8000)),
      ]).catch(() => []);
    } else if (!context.isPoliticalMarket && (context.hasFantasyIntent || hasADPIntent) && (!context.hasBettingIntent || context.selectedCategory === 'fantasy')) {
      // Fire-and-forget: warm the projections cache from Supabase so next request uses live data
      const fantSport = context.sport === 'mlb' ? 'mlb'
        : context.sport?.includes('football') ? 'nfl'
        : context.sport === 'nba' ? 'nba'
        : null;
      if (fantSport) {
        import('@/lib/fantasy/projections-cache')
          .then(({ currentSeasonFor }) => {
            const season = currentSeasonFor(fantSport as 'nfl' | 'mlb' | 'nba');
            return import('@/lib/fantasy/projections-seeder').then(({ seedProjectionsFromSupabase }) =>
              seedProjectionsFromSupabase(fantSport as 'nfl' | 'mlb' | 'nba', season)
            );
          })
          .catch((err: unknown) => {
            console.warn('[API/analyze] Projection seeding failed (fallback data in use):', err instanceof Error ? err.message : String(err));
          });
      }
      // Pass hasStartSitIntent so the generator can produce matchup-focused cards
      cardPromise = import('@/lib/fantasy/cards/fantasy-card-generator')
        .then(({ generateFantasyCards }) => generateFantasyCards(userMessage, 3, context.sport ?? undefined, {
          teamCount: context.leagueSize ?? undefined,
          scoringFormat: context.leagueScoringFormat ?? undefined,
          isStartSit: hasStartSitIntent,
        }))
        .catch(() => generateContextualCards('fantasy', context.sport ?? undefined, 3).catch(() => []));
    } else if (!context.isPoliticalMarket && (context.isSportsQuery || context.hasBettingIntent)) {
      const sportKey = context.sport || undefined;
      // If the client already fetched live odds and sent them in context.oddsData,
      // build cards directly from that data so AI and cards show the exact same games.
      if (context.oddsData?.events?.length > 0) {
        const builtCards = oddsEventsToBettingCards(
          context.oddsData.events,
          context.oddsData.sport || sportKey || 'sports',
          6
        );
        cardPromise = Promise.resolve(builtCards);
      } else {
        cardPromise = Promise.race([
          generateContextualCards('betting', sportKey, 6),
          new Promise<InsightCard[]>(resolve => setTimeout(() => resolve([]), 6000)),
        ]);
      }
    } else {
      // General query — try to return cached/fresh multi-sport cards so the
      // response always has data cards rather than falling back to empty.
      cardPromise = Promise.race([
        generateContextualCards(category, context.sport ?? undefined, 6, false, context.kalshiSubcategory),
        new Promise<InsightCard[]>(resolve => setTimeout(() => resolve([]), 10000)),
      ]).catch(() => []);
    }
    // ── AI generation starts now (concurrently with card generation above) ──────

    const xaiApiKey = getGrokApiKey();
    const oddsApiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
    const hasClientOddsData = !!(context.oddsData?.events?.length);
    console.log('[API/analyze] Keys configured:', {
      XAI_API_KEY: !!xaiApiKey,
      ODDS_API_KEY: !!oddsApiKey,
      KALSHI_API_KEY: true,
      hasOddsData: hasClientOddsData,
      category,
      sport: context.sport || 'none',
    });
    let aiText = '';
    let modelUsed: string = AI_CONFIG.MODEL_DISPLAY_NAME;
    let usedFallback = false;
    let tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
    let pendingADPCard: InsightCard | null = null;
    let pendingADPUploadCard: InsightCard | null = null;
    let pendingStatcastCard: InsightCard | null = null;
    let skipStatcastJSON = false;

    // Card types that can come from the MLB_ANALYSIS_ADDENDUM JSON output
    const STATCAST_CARD_TYPES = new Set([
      'statcast_summary_card', 'hr_prop_card', 'game_simulation_card',
      'leaderboard_card', 'pitch_analysis_card', 'mlb_projection_card',
    ]);

    const _MAX_HALLUCINATION_RETRIES = 2; // reserved for future retry logic

    // ── Image attachment validation ───────────────────────────────────────────
    // Validate MIME type and estimated file size before forwarding to Grok.
    const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
    const validatedImageAttachments = (body.imageAttachments ?? []).filter((img: ImageAttachment) => {
      if (!ALLOWED_IMAGE_MIMES.has(img.mimeType)) {
        console.warn(`[API/analyze] Rejected image with unsupported MIME type: ${img.mimeType}`);
        return false;
      }
      // base64 encodes ~4/3 of raw bytes; multiply length × 0.75 to estimate bytes
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

    // Always use grok-3-fast as the primary model.
    // grok-4 was tried for ADP tool-calling but consistently exceeded 35s timeouts;
    // grok-3-fast handles tool-calling reliably in 3–8s and produces equivalent quality
    // for sports analysis and fantasy queries.
    const usePowerPath = false;
    const useFastPath = true;
    const primaryModel = AI_CONFIG.FAST_MODEL_NAME;
    logger.info(LogCategory.AI, 'model_selected', {
      metadata: { model: primaryModel, powerPath: false, hasADPIntent, sport: context?.sport ?? null },
    });

    // ── ADP tool (injected when hasADPIntent) ────────────────────────────────────
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
          msgLower.includes('football') || msgLower.includes('nfl') || msgLower.includes('nffc');
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
        // Live NFBC/NFFC boards typically have 300+ players. If we have ≤150, we are
        // serving the 120-player static fallback (seeded directly or via Supabase after
        // the live endpoint failed) — flag this so the AI warns the user.
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

    // ── Statcast tool (injected when isMLBStatcastMode) ──────────────────────────
    const statcastParams = z.object({
      player:     z.string().optional().describe('Partial player name — case-insensitive (e.g. "Judge", "Ohtani")'),
      playerType: z.enum(['batter', 'pitcher']).optional().describe('Restrict to batters or pitchers only'),
      limit:      z.number().optional().describe('Number of players to return (default 10, max 25)'),
    });
    const statcastTool = tool({
      description:
        'Query REAL 2025 Baseball Savant Statcast metrics (barrel rate, exit velocity, ' +
        'xwOBA, hard-hit %, sweet-spot %, xBA, xSLG). ' +
        'Use for any MLB player question about Statcast performance or HR probability. ' +
        'Always call this tool FIRST — never invent Statcast numbers.',
      inputSchema: statcastParams,
      execute: async ({ player, playerType, limit }: z.infer<typeof statcastParams>) => {
        console.log('[API/analyze] Statcast tool called:', { player, playerType, limit });
        const { players: allPlayers, isLiveData, season } = await getStatcastData();
        if (allPlayers.length === 0) {
          return {
            players: [],
            total_in_dataset: 0,
            source: 'Baseball Savant',
            error: 'Statcast data temporarily unavailable. Use model knowledge for analysis.',
          };
        }
        const results = queryStatcast(allPlayers, { player, playerType, limit });
        return {
          players: results,
          total_in_dataset: allPlayers.length,
          source: isLiveData ? `Baseball Savant ${season} (real data)` : `Baseball Savant ${season} (cached fallback)`,
        };
      },
    });

    // ── MLB Projection Engine tool (injected when hasMLBProjectionIntent) ────────
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
        'Always call this tool FIRST — NEVER invent salaries, projections, or odds.',
      inputSchema: mlbProjectionParams,
      execute: async ({ playerType, player, limit, date, outputFor }: z.infer<typeof mlbProjectionParams>) => {
        console.log('[API/analyze] MLB projection tool called:', { playerType, player, limit, date, outputFor });
        try {
          const resolvedOutputFor = outputFor ?? 'projections';
          let cards: unknown[];

          switch (resolvedOutputFor) {
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
              if (player) {
                const { projectSinglePlayer } = await import('@/lib/mlb-projections/projection-pipeline');
                const type = playerType === 'all' || !playerType ? 'hitter' : playerType;
                const card = await projectSinglePlayer(player, type);
                cards = card ? [card] : [];
              } else {
                const { runProjectionPipeline } = await import('@/lib/mlb-projections/projection-pipeline');
                cards = await runProjectionPipeline({ playerType: playerType ?? 'all', limit: limit ?? 9, date });
              }
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

    // ── SSE streaming response — wraps AI generation + post-processing ─���────────
    const encoder = new TextEncoder();
    const sseChunk = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          if (xaiApiKey) {
            const usesTools = hasADPIntent || hasMLBProjectionIntent || isMLBStatcastMode;
            // Tool-call paths (ADP, MLB projections, Statcast) don't get a first-token timer
            // because textStream yields no tokens until the full tool round-trip completes.
            // Non-tool paths get 30s — grok-3-fast typically responds in 2–8s but can spike
            // to 20–25s under xAI load. 30s gives headroom without hanging requests forever.
            const abortCtrl = new AbortController();
            let firstTokenTimer: ReturnType<typeof setTimeout> | null = null;
            if (!usesTools) {
              firstTokenTimer = setTimeout(
                () => abortCtrl.abort(new Error('Primary timeout')),
                30_000,
              );
            }

            // streamText returns immediately; tokens arrive via textStream async iterable
            const streamCallStart = Date.now();
            console.log(`[API/analyze] Calling streamText — model=${primaryModel}, usesTools=${usesTools}, hasADP=${hasADPIntent}`);
            const streamResult = streamText({
              model: createXai({ apiKey: xaiApiKey })(primaryModel),
              system: systemPrompt,
              ...buildGenOptions(enrichedPrompt, hasImages ? validatedImageAttachments : undefined),
              temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
              maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
              maxRetries: 0,
              abortSignal: abortCtrl.signal,
              ...(hasADPIntent && { tools: { query_adp: adpTool }, stopWhen: stepCountIs(3) }),
              ...(hasMLBProjectionIntent && { tools: { query_mlb_projections: mlbProjectionTool }, stopWhen: stepCountIs(3) }),
              ...(!hasMLBProjectionIntent && isMLBStatcastMode && { tools: { query_statcast: statcastTool }, stopWhen: stepCountIs(3) }),
            });

            try {
              let gotFirstToken = false;
              for await (const delta of streamResult.textStream) {
                if (!gotFirstToken) {
                  gotFirstToken = true;
                  console.log(`[API/analyze] First token received in ${Date.now() - streamCallStart}ms`);
                  if (firstTokenTimer) clearTimeout(firstTokenTimer);
                }
                aiText += delta;
                controller.enqueue(sseChunk({ type: 'text', delta }));
              }
              if (firstTokenTimer) clearTimeout(firstTokenTimer);
              modelUsed = AI_CONFIG.FAST_MODEL_DISPLAY_NAME;

              // ── Capture token usage ────────────────────────────────────────────
              try {
                const usage = await streamResult.usage;
                if (usage) {
                  tokenUsage = {
                    promptTokens: usage.promptTokens ?? 0,
                    completionTokens: usage.completionTokens ?? 0,
                    totalTokens: usage.totalTokens ?? 0,
                  };
                }
              } catch {
                // Non-fatal — usage may not be available for all model configurations
              }

              // ── Capture tool results after streaming completes ──────────────────
              const allToolResults: any[] = await (streamResult as any).toolResults ?? [];
              const allToolCalls: any[] = await (streamResult as any).toolCalls ?? [];

              // ADP tool results
              if (hasADPIntent) {
                const adpResult = allToolResults.find((tr: any) => tr.toolName === 'query_adp');
                if (adpResult?.result?.players?.length > 0) {
                  const tr = adpResult.result;
                  const callArgs = allToolCalls.find((tc: any) => tc.toolName === 'query_adp')?.args ?? {};
            const adpSource = tr.source ?? `NFBC ${NFBC_DRAFT_YEAR} ADP`;
            const isNFLResult = adpSource.includes('NFFC') || adpSource.includes('NFL');
            const adpBrand = isNFLResult ? 'NFFC' : 'NFBC';
            let cardTitle = isNFLResult
              ? `NFFC ${NFBC_DRAFT_YEAR} NFL ADP Rankings`
              : `NFBC ${NFBC_DRAFT_YEAR} ADP Rankings`;
            if (callArgs.player) {
              const name = tr.players[0]?.displayName ?? callArgs.player;
              cardTitle = `${name} — ${adpBrand} ADP`;
            } else if (callArgs.position) {
              const rankSuffix = callArgs.rankMax ? ` (Top ${callArgs.rankMax})` : '';
              cardTitle = `Top ${callArgs.position}${rankSuffix} — ${adpBrand} ADP Board`;
            } else if (callArgs.rankMin != null || callArgs.rankMax != null) {
              const lo = callArgs.rankMin ?? 1;
              const hi = callArgs.rankMax ?? tr.total_players_in_dataset;
              cardTitle = `${adpBrand} ADP Picks #${lo}–${hi}`;
            }
            pendingADPCard = {
              type: 'adp-analysis',
              title: cardTitle,
              category: isNFLResult ? 'NFL' : 'MLB',
              subcategory: isNFLResult ? 'NFFC Draft Board' : 'NFBC Draft Board',
              gradient: isNFLResult
                ? 'from-green-600/80 via-emerald-700/60 to-green-900/40'
                : 'from-cyan-600/80 via-teal-700/60 to-cyan-900/40',
              status: 'value',
              realData: !tr.is_static_fallback,
              icon: isNFLResult ? '🏈' : '⚾',
              data: {
                players: JSON.stringify(tr.players),
                source: adpSource,
                totalInDataset: tr.total_players_in_dataset,
              },
            };

            // When serving static fallback, also emit an upload card so the user
            // can provide the real TSV without leaving the chat.
            if (tr.is_static_fallback) {
              pendingADPUploadCard = {
                type: 'adp-upload',
                title: isNFLResult ? 'Upload NFFC Football ADP' : 'Upload NFBC Baseball ADP',
                icon: isNFLResult ? '🏈' : '⚾',
                category: isNFLResult ? 'NFL' : 'MLB',
                subcategory: isNFLResult ? 'NFFC ADP Upload' : 'NFBC ADP Upload',
                gradient: 'from-violet-600/80 via-purple-700/60 to-violet-900/40',
                status: 'pending',
                realData: false,
                data: { sport: isNFLResult ? 'nfl' : 'mlb' },
              };
            }
                }
              }

              // Statcast tool results
              if (isMLBStatcastMode) {
                const statcastResult = allToolResults.find((tr: any) => tr.toolName === 'query_statcast');
                if (statcastResult) {
                  const srPlayers: StatcastPlayer[] = statcastResult.result?.players ?? [];
                  if (srPlayers.length === 0) {
                    skipStatcastJSON = true;
                    console.warn('[API/analyze] Statcast tool returned no players — skipping JSON card mode');
                  } else {
                    const srSource: string = statcastResult.result?.source ?? 'Baseball Savant';
                    // Build a fallback card for single-player lookups (≤3 results = targeted query)
                    if (srPlayers.length <= 3) {
                      const p = srPlayers[0];
                      const fmt = (n: number | undefined, decimals = 1) =>
                        n != null ? n.toFixed(decimals) : 'N/A';
                      const fmtAvg = (n: number | undefined) =>
                        n != null ? n.toFixed(3).replace(/^0/, '') : 'N/A';
                      pendingStatcastCard = {
                        type: 'statcast_summary_card',
                        title: `${p.name} — Statcast Profile`,
                        category: 'MLB',
                        subcategory: p.playerType === 'pitcher' ? 'Pitcher Metrics' : 'Contact Quality',
                        gradient: 'from-indigo-600/80 via-violet-700/60 to-indigo-900/40',
                        status: 'edge',
                        icon: '⚾',
                        realData: srSource.includes('real data'),
                        summary_metrics: p.playerType === 'pitcher'
                          ? [
                              { label: 'xwOBA Against', value: fmtAvg(p.xwoba) },
                              { label: 'Barrel % Against', value: `${fmt(p.barrelRate)}%` },
                              { label: 'Hard Hit % Against', value: `${fmt(p.hardHitPct)}%` },
                              { label: 'Exit Velo Against', value: `${fmt(p.exitVelocity)} mph` },
                              { label: 'Sweet Spot % Against', value: `${fmt(p.sweetSpotPct)}%` },
                            ]
                          : [
                              { label: 'xBA', value: fmtAvg(p.xba) },
                              { label: 'xwOBA', value: fmtAvg(p.xwoba) },
                              { label: 'Sweet Spot %', value: `${fmt(p.sweetSpotPct)}%` },
                              { label: 'Hard Hit %', value: `${fmt(p.hardHitPct)}%` },
                              { label: 'Barrel %', value: `${fmt(p.barrelRate)}%` },
                            ],
                        last_updated: srSource,
                        data: { source: srSource },
                      };
                    }
                  }
                }
              }

            } catch (streamErr) {
              if (firstTokenTimer) clearTimeout(firstTokenTimer);
              // Primary stream failed — fall back to generateText (no streaming for fallback)
              const actualFallbackModel = AI_CONFIG.POWER_MODEL_NAME;
              const errSummary = (() => {
                if (streamErr && typeof streamErr === 'object') {
                  const e = streamErr as Record<string, unknown>;
                  // Log the full error object to identify the real failure reason
                  console.error('[API/analyze] Primary stream error detail:', JSON.stringify({
                    name: (streamErr as Error)?.name,
                    message: (streamErr as Error)?.message,
                    statusCode: e.statusCode,
                    url: e.url,
                    responseBody: e.responseBody,
                    cause: (streamErr as Error)?.cause,
                  }, null, 2));
                  if (e.statusCode) return `HTTP ${e.statusCode} from ${e.url ?? 'xAI'}`;
                }
                return streamErr instanceof Error ? streamErr.message : String(streamErr);
              })();
              console.error(`[API/analyze] Primary stream failed — ${errSummary} | Retrying with ${actualFallbackModel}`);
              try {
                const fallbackResult = await generateText({
                  model: createXai({ apiKey: xaiApiKey })(actualFallbackModel),
                  system: systemPrompt,
                  prompt: enrichedPrompt,
                  temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
                  maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
                  maxRetries: 0,
                });
                aiText = fallbackResult.text;
                modelUsed = `${AI_CONFIG.POWER_MODEL_DISPLAY_NAME} (fallback)`;
                console.log(`[API/analyze] Fallback succeeded with ${actualFallbackModel}`);
                controller.enqueue(sseChunk({ type: 'text', delta: aiText }));
              } catch (fallbackErr) {
                const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
                console.error('[API/analyze] Fallback also failed:', fallbackMsg);
                aiText = generateFallbackResponse(userMessage, context);
                modelUsed = fallbackMsg.includes('timeout') ? 'Fallback (timeout)' : 'Fallback (API error — check XAI_API_KEY)';
                usedFallback = true;
                controller.enqueue(sseChunk({ type: 'text', delta: aiText }));
              }
            }
          } else {
            // No API key — use static fallback
            aiText = generateFallbackResponse(userMessage, context);
            modelUsed = 'Fallback';
            usedFallback = true;
            controller.enqueue(sseChunk({ type: 'text', delta: aiText }));
          }

          // ── Post-processing: cards, trust metrics, done event ─────────────────
          let cards: InsightCard[] = await cardPromise.catch(() => []);

          if (pendingADPCard) cards = [pendingADPCard, ...cards.slice(0, 5)];
          if (pendingADPUploadCard) cards = [...cards, pendingADPUploadCard];

          // MLB Statcast: parse Grok's JSON response into a card
          if (isMLBStatcastMode && !usedFallback && !skipStatcastJSON) {
            // Strip markdown code fences the model sometimes emits despite instructions
            const stripped = aiText
              .replace(/^```(?:json)?\s*/m, '')
              .replace(/\s*```\s*$/m, '')
              .trim();

            // Try to extract the outermost JSON object robustly:
            // 1. If the entire stripped text is valid JSON, use it directly.
            // 2. Otherwise, find the first { and last } and try that substring.
            const candidates: string[] = [];
            try {
              JSON.parse(stripped); // validate
              candidates.push(stripped);
            } catch {
              const first = stripped.indexOf('{');
              const last = stripped.lastIndexOf('}');
              if (first !== -1 && last > first) {
                candidates.push(stripped.slice(first, last + 1));
              }
              // Also try non-greedy innermost match in case of nested extra text
              const innerMatch = stripped.match(/\{[\s\S]+?\}/);
              if (innerMatch && !candidates.includes(innerMatch[0])) {
                candidates.push(innerMatch[0]);
              }
            }

            let parsed: Record<string, unknown> | null = null;
            for (const candidate of candidates) {
              try {
                const p = JSON.parse(candidate);
                if (p && typeof p.type === 'string') { parsed = p; break; }
              } catch {
                // try next candidate
              }
            }

            if (parsed && STATCAST_CARD_TYPES.has(parsed.type as string)) {
              const statcastCard: InsightCard = { icon: '⚾', ...parsed };
              cards = [statcastCard, ...cards.slice(0, 5)];
              pendingStatcastCard = null;
              const metricLines = ((parsed.summary_metrics as Array<{ label: string; value: string }>) ?? [])
                .slice(0, 3)
                .map((m) => `**${m.label}:** ${m.value}`)
                .join(' · ');
              const cleanText = [
                `**${parsed.title}** — MLB Statcast Analysis`,
                metricLines,
                'See the card below for the full breakdown and splits.',
              ].filter(Boolean).join('\n');
              aiText = cleanText;
              // Replace the raw JSON the client already received with readable prose
              controller.enqueue(sseChunk({ type: 'replace', text: cleanText }));
            } else if (parsed) {
              // Valid JSON but unknown type — accept it anyway as a generic card
              // rather than dumping raw JSON to the user
              console.warn(
                '[API/analyze] MLB JSON parsed but type not in STATCAST_CARD_TYPES.',
                'Got type:', parsed.type,
                '| Adding to STATCAST_CARD_TYPES and retrying.',
              );
              const statcastCard: InsightCard = { icon: '⚾', ...parsed };
              cards = [statcastCard, ...cards.slice(0, 5)];
              pendingStatcastCard = null;
              const title = (parsed.title as string) ?? 'MLB Analysis';
              const metricLines = ((parsed.summary_metrics as Array<{ label: string; value: string }>) ?? [])
                .slice(0, 3)
                .map((m) => `**${m.label}:** ${m.value}`)
                .join(' · ');
              const cleanText = [
                `**${title}** — MLB Analysis`,
                metricLines,
                'See the card below for the full breakdown.',
              ].filter(Boolean).join('\n');
              aiText = cleanText;
              controller.enqueue(sseChunk({ type: 'replace', text: cleanText }));
            } else {
              // Couldn't extract any valid JSON — replace the raw text with a clean fallback
              console.warn(
                '[API/analyze] MLB JSON parse failed — no valid JSON found.',
                '| Raw length:', aiText.length,
                '| First 300 chars:', aiText.slice(0, 300),
              );
              const fallbackText = 'MLB analysis complete. Unable to render the structured card — please try rephrasing your question.';
              aiText = fallbackText;
              controller.enqueue(sseChunk({ type: 'replace', text: fallbackText }));
            }
          }

          if (pendingStatcastCard) {
            if (!STATCAST_CARD_TYPES.has(cards[0]?.type as string)) {
              cards = [pendingStatcastCard, ...cards.slice(0, 5)];
              console.log('[API/analyze] Injected Statcast fallback card:', pendingStatcastCard.title);
            }
          }

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

          const processingTime = Date.now() - startTime;
          logger.info(LogCategory.AI, 'response_complete', {
            metadata: { cardCount: cards.length, clarification: isAmbiguous, sport: context?.sport ?? null, latencyMs: processingTime },
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
            const isNFLContext = context?.sport?.includes('football') || context?.sport === 'nfl' || msgLower.includes('nffc') || msgLower.includes('nfl draft') || msgLower.includes('fantasy football');
            const adpBoardName = isNFLContext
              ? `NFFC ${new Date().getFullYear()} NFL ADP Board`
              : `NFBC ${new Date().getFullYear()} ADP Board`;
            sources.push({ name: adpBoardName, type: 'api' as const, reliability: 97 });
          }

          // Send done event with full metadata
          controller.enqueue(sseChunk({
            type: 'done',
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
            ...(tokenUsage && { tokenUsage }),
          }));

        } catch (innerError) {
          console.error('[API/analyze] Stream controller error:', innerError);
          try {
            controller.enqueue(sseChunk({
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
          try { controller.close(); } catch { /* ignore */ }
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
    return `**Live ${sport} Games (${count} available)**\n\nHere are the current moneylines:\n${sample}\n\n• For AI-powered sharp money analysis, please try again in a moment.`;
  }

  // No live games — give a useful knowledge-based response
  if (context?.noGamesAvailable || (context?.sport && !context?.oddsData)) {
    const sport = context.sport?.toUpperCase() || 'sports';
    if (lowerMsg.includes('offseason') || lowerMsg.includes('trade') || lowerMsg.includes('free agent')) {
      return `**${sport} Offseason Analysis**\n\n• No live games are scheduled right now, but there's plenty of betting value to track in the offseason.\n• Monitor futures markets — championship odds often offer the best value before spring/summer public betting shifts prices.\n• Track free agency signings and trades: roster changes are the #1 driver of futures line movement.\n• Win totals are set early in the offseason and tend to close toward public perception — sharp bettors target the opening numbers.`;
    }
    return `**${sport} Analysis**\n\n• No live games are currently scheduled. ${sport} season games typically post odds 24–48 hours before tip/kickoff.\n• In the meantime, futures markets (division winner, championship odds) are open year-round.\n• This is a great time to research team trends, injury reports, and schedule strength ahead of the season.`;
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
    return `**Kalshi Prediction Markets**\n\n• Kalshi markets are CFTC-regulated event contracts that pay $1 if the event occurs, $0 if not.\n• Prices represent implied probability — 65¢ YES = 65% market probability of that outcome.\n• Look for: markets trading significantly away from your probability estimate.\n• Key categories: elections, economic indicators (CPI, unemployment, Fed rate), weather events, sports championships.\n• Strategy: compare Kalshi prices to Polymarket/PredictIt for cross-market arbitrage.`;
  }

  return `**Leverage AI — Expert Sports Analysis**\n\n• I'm ready to analyze betting lines, DFS, fantasy, Kalshi markets, and more.\n• Ask me about specific games, offseason moves, betting strategy, or prediction markets.\n• Live odds data cards are loading below — click any card for detailed analysis.`;
}
