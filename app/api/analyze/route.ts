import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateText, tool, stepCountIs } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { z } from 'zod';
import {
  AI_CONFIG,
  SYSTEM_PROMPT,
  MLB_ANALYSIS_ADDENDUM,
  NFBC_ADP_ADDENDUM,
  MLB_PROJECTION_ADDENDUM,
  DEFAULT_SOURCES,
  HTTP_STATUS,
  ERROR_MESSAGES,
  NFBC_DRAFT_YEAR,
} from '@/lib/constants';
import { getADPData, queryADP } from '@/lib/adp-data';
import { getNFLADPData } from '@/lib/nfl-adp-data';
import { getStatcastData, queryStatcast } from '@/lib/baseball-savant';
import { generateContextualCards, type InsightCard } from '@/lib/cards-generator';
import { detectHallucinations, buildRetryPrompt } from '@/lib/hallucination-detector';
import { getGrokApiKey } from '@/lib/config';

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
  const dfsKeywords = ['dfs', 'daily fantasy', 'draftkings lineup', 'fanduel lineup', 'optimal lineup'];
  if (dfsKeywords.some(k => lower.includes(k))) return true;
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  // Per-AI-call timeouts (independent from each other and from card generation):
  //   grok-4 primary: 45s | grok-3-mini primary: 25s | fallback: 12s
  // Total worst-case sequential: 45 + 12 = 57s (card generation runs concurrently so adds ~0s).
  const PRIMARY_TIMEOUT_MS = (useFastPath: boolean) => useFastPath ? 25000 : 45000;

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

    // ADP intent: user is asking about NFBC draft positions / rankings.
    // When true: use NFBC_ADP_ADDENDUM + query_adp tool instead of statcast JSON mode.
    const msgLower = userMessage.toLowerCase();
    const hasADPIntent =
      ['adp', 'nfbc', 'nffc', 'average draft', 'draft position', 'draft rank', 'draft order', 'nfbc board', 'nffc board']
        .some(k => msgLower.includes(k)) ||
      (context?.hasFantasyIntent === true && (context?.sport === 'mlb' || context?.sport === 'football'));

    // Statcast JSON mode only applies to non-ADP MLB queries
    const isMLBStatcastMode = isMLBQuery && !hasADPIntent;

    // MLB Projection Engine intent: projection/DFS/fantasy/betting queries that need
    // the LeverageMetrics algorithm (Monte Carlo, HR model, breakout scores).
    const MLB_PROJECTION_KEYWORDS = [
      'dfs', 'daily fantasy', 'draftkings lineup', 'fanduel lineup',
      'salary', 'stack', 'lineup',
      'waiver', 'streaming', 'ros', 'rest of season',
      'projection', 'project', 'breakout', 'monte carlo',
      'forecast', 'pace', 'park factor',
      'hr prop', 'k prop', 'strikeout prop',
    ];
    const hasMLBProjectionIntent =
      isMLBQuery &&
      !hasADPIntent &&
      MLB_PROJECTION_KEYWORDS.some(k => msgLower.includes(k));

    const baseWithAddendum = hasMLBProjectionIntent
      ? `${baseSystemPrompt}${MLB_PROJECTION_ADDENDUM}`
      : isMLBStatcastMode
        ? `${baseSystemPrompt}${MLB_ANALYSIS_ADDENDUM}`
        : hasADPIntent
          ? `${baseSystemPrompt}${NFBC_ADP_ADDENDUM}`
          : baseSystemPrompt;
    const systemPrompt = customInstructions?.trim()
      ? `${baseWithAddendum}\n\n## USER PROFILE & BETTING PREFERENCES\n${customInstructions.trim()}`
      : baseWithAddendum;

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
      cardPromise = import('@/lib/fantasy/cards/fantasy-card-generator')
        .then(({ generateFantasyCards }) => generateFantasyCards(userMessage, 3, context.sport ?? undefined, {
          teamCount: context.leagueSize ?? undefined,
          scoringFormat: context.leagueScoringFormat ?? undefined,
        }))
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
        generateContextualCards(category, context.sport ?? undefined, 6, false, context.kalshiSubcategory),
        new Promise<InsightCard[]>(resolve => setTimeout(() => resolve([]), 5000)),
      ]).catch(() => []);
    }
    // ── AI generation starts now (concurrently with card generation above) ──────

    // Attempt AI generation via Vercel AI Gateway
    const xaiApiKey = getGrokApiKey();
    const oddsApiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
    const kalshiApiKey = process.env.KALSHI_API_KEY_ID || process.env.KALSHI_API_KEY;
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
    let modelUsed: string = AI_CONFIG.MODEL_DISPLAY_NAME;
    let usedFallback = false;
    let pendingADPCard: InsightCard | null = null;
    let skipStatcastJSON = false; // set true when statcast tool returned empty players

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

    // Route DFS, pure-fantasy, file-upload, off-season, and ambiguous queries directly to
    // grok-3-mini (3-6s). Reserve grok-4 for live-odds betting analysis only.
    // ADP queries override to grok-4: reliable tool use requires the stronger model.
    // isAmbiguous queries only need a short clarification reply — no need for grok-4.
    const useFastPath = hasADPIntent ? false : (isAmbiguous || shouldUseFastModel(userMessage, context));
    const primaryModel = useFastPath ? AI_CONFIG.FAST_MODEL_NAME : AI_CONFIG.MODEL_NAME;
    // Always log the resolved model so failures are immediately traceable in Vercel logs
    console.log(`[API/analyze] Model selected: ${primaryModel} (fastPath=${useFastPath}, hasADPIntent=${hasADPIntent})`);
    if (useFastPath) {
      console.log(`[API/analyze] Fast-path routing → ${AI_CONFIG.FAST_MODEL_NAME} (intent: DFS/fantasy/file/offseason)`);
    }

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
            error: 'ADP data is temporarily unavailable. Please try again shortly or consult nfc.shgn.com.',
          };
        }
        const results = queryADP(data, { player, position, rankMin, rankMax, limit, team, valueOnly });
        return {
          players: results,
          total_players_in_dataset: data.length,
          source,
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
        const data = await getStatcastData();
        if (data.length === 0) {
          return {
            players: [],
            total_in_dataset: 0,
            source: 'Baseball Savant 2025',
            error: 'Statcast data temporarily unavailable. Use model knowledge for analysis.',
          };
        }
        const results = queryStatcast(data, { player, playerType, limit });
        return {
          players: results,
          total_in_dataset: data.length,
          source: 'Baseball Savant 2025 (real data)',
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

    if (xaiApiKey) {
      try {
        // Per-call timeout — only covers AI generation, not card fetches or JSON parsing
        const primaryTimeoutMs = PRIMARY_TIMEOUT_MS(useFastPath);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout - analysis taking too long')), primaryTimeoutMs);
        });
        // Initial generation with timeout protection
        const result = await Promise.race([
          generateText({
            model: createXai({ apiKey: xaiApiKey })(primaryModel),
            system: systemPrompt,
            ...buildGenOptions(enrichedPrompt, hasImages ? body.imageAttachments : undefined),
            temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
            maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
            maxRetries: 0, // No internal SDK retries — our outer Promise.race handles fallback
            // Inject ADP tool only when user is asking about NFBC draft positions.
            // stopWhen: stepCountIs(3) allows: step1=tool-call, step2=final-response, step3=safety
            // (default is stepCountIs(1) which would stop before the model sees tool results)
            ...(hasADPIntent && { tools: { query_adp: adpTool }, stopWhen: stepCountIs(3) }),
            // Inject MLB Projection Engine tool — supersedes Statcast for projection/DFS/fantasy/betting queries.
            ...(hasMLBProjectionIntent && { tools: { query_mlb_projections: mlbProjectionTool }, stopWhen: stepCountIs(3) }),
            // Inject Statcast tool for non-projection MLB queries (raw Statcast stats, barrel rates, etc.)
            ...(!hasMLBProjectionIntent && isMLBStatcastMode && { tools: { query_statcast: statcastTool }, stopWhen: stepCountIs(3) }),
          }),
          timeoutPromise
        ]);
        aiText = result.text;
        modelUsed = useFastPath ? 'Grok 3 Mini' : AI_CONFIG.MODEL_DISPLAY_NAME;

        // ── Capture ADP tool result for card injection (done after cards await) ──
        if (hasADPIntent) {
          const toolResults: any[] = (result as any).toolResults ?? [];
          const adpResult = toolResults.find((tr: any) => tr.toolName === 'query_adp');
          if (adpResult?.result?.players?.length > 0) {
            const tr = adpResult.result;
            const callArgs =
              ((result as any).toolCalls ?? []).find((tc: any) => tc.toolName === 'query_adp')?.args ?? {};
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
              realData: true,
              icon: isNFLResult ? '🏈' : '⚾',
              data: {
                players: JSON.stringify(tr.players),
                source: adpSource,
                totalInDataset: tr.total_players_in_dataset,
              },
            };
          }
        }

        // If statcast tool returned zero players, skip JSON card parsing.
        // The AI will have output prose (per the addendum instructions) rather than a broken N/A card.
        if (isMLBStatcastMode) {
          const toolResults: any[] = (result as any).toolResults ?? [];
          const statcastResult = toolResults.find((tr: any) => tr.toolName === 'query_statcast');
          if (statcastResult && statcastResult.result?.players?.length === 0) {
            skipStatcastJSON = true;
            console.warn('[API/analyze] Statcast tool returned no players — skipping JSON card mode');
          }
        }

        // Hallucination-detection retry loop (with timeout awareness)
        let detection = detectHallucinations(aiText, userMessage, context.oddsData, { category, hasBettingIntent: context.hasBettingIntent });
        let retryAttempt = 0;

        while (detection.shouldRetry && !isMLBQuery && !hasADPIntent && retryAttempt < MAX_HALLUCINATION_RETRIES) {
          // Limit retries to 8s remaining budget (using a fixed cap since TIMEOUT_MS is now per-call)
          const elapsed = Date.now() - startTime;
          if (elapsed > 20000) break; // >20s total elapsed — not safe to retry
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
              setTimeout(() => reject(new Error('Retry timeout')), 12000); // 12s per retry
            });

            const retryResult = await Promise.race([
              generateText({
                // Always use the fast model for retries — avoids double-timeout when
                // the primary model already consumed most of the time budget.
                model: createXai({ apiKey: xaiApiKey })(AI_CONFIG.FAST_MODEL_NAME),
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
            detection = detectHallucinations(aiText, userMessage, context.oddsData, { category, hasBettingIntent: context.hasBettingIntent });
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
        // If primary model fails (e.g. timeout or API error), try the fast model before giving up.
        // IMPORTANT: If we're already on the fast path, skip the fallback retry entirely —
        // it would just time out a second time and waste the remaining budget.
        const fallbackModel = AI_CONFIG.FAST_MODEL_NAME;
        const alreadyFast = useFastPath;
        // Log the full error object (not just message) so model-not-found / 401 / 404
        // errors from the xAI API are visible in Vercel logs — not silently swallowed.
        console.error(
          `[API/analyze] Primary model "${primaryModel}" failed — full error:`,
          aiError,
          '| Retrying with:',
          alreadyFast ? AI_CONFIG.MODEL_NAME : fallbackModel,
        );
        // Regardless of whether we were on the fast path, always try the other model
        // before giving up. Fast path (grok-3-mini) failure → retry with grok-4.
        // Slow path (grok-4) failure → retry with grok-3-mini.
        const actualFallbackModel = alreadyFast ? AI_CONFIG.MODEL_NAME : fallbackModel;
        try {
          const fallbackTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Fallback timeout')), 12000);
          });

          const fallbackResult = await Promise.race([
            generateText({
              model: createXai({ apiKey: xaiApiKey })(actualFallbackModel),
              system: systemPrompt,
              prompt: enrichedPrompt,
              temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
              maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
              maxRetries: 0,
            }),
            fallbackTimeoutPromise
          ]);
          aiText = fallbackResult.text;
          modelUsed = alreadyFast ? `${AI_CONFIG.MODEL_DISPLAY_NAME} (fallback)` : 'Grok 3 Mini (fallback)';
          console.log(`[API/analyze] ${actualFallbackModel} fallback succeeded`);
        } catch (fallbackError) {
          const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          console.error('[API/analyze] Fallback model also failed:', fallbackMsg);
          aiText = generateFallbackResponse(userMessage, context);
          // Surface the underlying API error in the model label so it's visible in the UI
          modelUsed = fallbackMsg.includes('timeout') ? 'Fallback (timeout)' : 'Fallback (API error — check XAI_API_KEY)';
          usedFallback = true;
        }
      }
    } else {
      aiText = generateFallbackResponse(userMessage, context);
      modelUsed = 'Fallback';
      usedFallback = true;
    }

    // Cards run concurrently with AI — always await regardless of AI outcome.
    // When AI falls back to static text, we still want contextual data cards
    // to render (they come from the live Odds/Kalshi APIs, not the AI model).
    let cards: InsightCard[] = await cardPromise.catch(() => []);

    // Inject ADP card at the front when the tool returned results
    if (pendingADPCard) {
      cards = [pendingADPCard, ...cards.slice(0, 5)];
    }

    // ── MLB Statcast: parse Grok's JSON response into a card ──────────────────
    // The MLB_ANALYSIS_ADDENDUM instructs Grok to return ONLY JSON for MLB queries.
    // Parse it here, inject it as a StatcastCard, and replace aiText with
    // human-readable prose so the chat doesn't display raw JSON to the user.
    if (isMLBStatcastMode && !usedFallback && !skipStatcastJSON) {
      const STATCAST_TYPES = new Set([
        'statcast_summary_card', 'hr_prop_card', 'game_simulation_card',
        'leaderboard_card', 'pitch_analysis_card',
      ]);
      // Extract the first {...} block — handles code fences, preamble text, and bare JSON
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed.type === 'string' && STATCAST_TYPES.has(parsed.type)) {
            // Spread ALL parsed fields at card top level so DynamicCardRenderer passes
            // summary_metrics + lightbox through to StatcastCard unchanged
            const statcastCard: InsightCard = { icon: '⚾', ...parsed };
            cards = [statcastCard, ...cards.slice(0, 5)];

            // Replace raw JSON with readable prose for the chat message
            const metricLines = (parsed.summary_metrics ?? [])
              .slice(0, 3)
              .map((m: { label: string; value: string }) => `**${m.label}:** ${m.value}`)
              .join(' · ');
            aiText = [
              `**${parsed.title}** — MLB Statcast Analysis`,
              metricLines,
              'See the card below for the full breakdown and splits.',
            ].filter(Boolean).join('\n');
          }
        } catch {
          console.warn('[API/analyze] MLB JSON parse failed — returning raw text');
        }
      }
    }

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
          flags: [{ type: 'info', message: 'Using fallback mode — AI temporarily unavailable', severity: 'info' as const }],
        }
      : detectHallucinations(aiText, userMessage, context.oddsData, { category, hasBettingIntent: context.hasBettingIntent });

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
