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
  DEEP_THINK_ADDENDUM,
  DEFAULT_SOURCES,
  HTTP_STATUS,
  ERROR_MESSAGES,
  NFBC_DRAFT_YEAR,
  NFL_SEASON_YEAR,
  PLAYER_SPORT_MAP,
  STAT_SPORT_MAP,
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
import { getMarketIntelligenceSummary } from '@/lib/market-intelligence';
import { checkRateLimit, getRateLimitId } from '@/lib/middleware/rate-limit';

// ── Prediction market / political detection constants ─────────────────────────
// Used by Layer -2 sport detection — checked FIRST before any sports signals.
// Prevents stale client sport context (e.g. 'nfl') from poisoning Kalshi queries.
const MARKET_SIGNALS = [
  'kalshi', 'polymarket', 'prediction market', 'prediction markets',
  'senate', 'senate seat', 'congress', 'house seat', 'governor',
  'election market', 'ballot', 'referendum',
  'fed rate', 'federal reserve', 'interest rate cut', 'fomc',
  'recession', 'gdp growth', 'inflation rate',
  'yes/no market', 'contract price', 'implied probability',
  'political market', 'event contract', 'will trump', 'will biden',
  'will democrats', 'will republicans',
];

// ── MLB parenthetical detection constants ────────────────────────────────────
// Used by Layer -1 sport detection to parse patterns like "Juan Soto (NYM OF)"
const MLB_TEAM_ABBREVS = new Set([
  'NYM','NYY','BOS','LAD','SFG','SF','CHC','CHW','HOU','ATL',
  'PHI','MIL','STL','ARI','SD','SDP','COL','CIN','PIT','MIA',
  'MIN','CLE','DET','KC','KCR','TEX','OAK','ATH','SEA',
  'TB','TBR','BAL','TOR','LAA','WSH','WSN',
]);
const MLB_POSITION_ABBREVS = new Set([
  'OF','SP','RP','CP','1B','2B','3B','SS','DH','LF','CF','RF','C',
]);

// ── Response deduplication cache ─────────────────────────────────────────────
// Prevents identical queries (e.g. double-taps, retry on same message) from
// hitting the Grok API a second time within the TTL window.
// Module-level: survives across requests on the same warm serverless instance.
const DEDUP_CACHE_TTL_MS = 60_000; // 1 minute
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
    const overage = dedupCache.size - DEDUP_CACHE_MAX + 5; // evict a small batch to amortise the sort cost
    const byAge = [...dedupCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < Math.min(overage, byAge.length); i++) dedupCache.delete(byAge[i][0]);
  }
}
import { createClient } from '@/lib/supabase/server';

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
  deepThink?: boolean;
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
    hasPlayerIntent?: boolean;
    playerName?: string;
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

// ── Request body schema ──────────────────────────────────────────────────────
// Validates at the HTTP boundary so malformed bodies fail fast with a clean 400
// instead of propagating undefined/oversized values deep into the pipeline.
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

  // ── Rate limiting: prefer user ID when authenticated ────────────────────────
  // Authenticated users get a per-user bucket (10 req/min) so shared IPs (office
  // NAT, VPN) don't exhaust a single anonymous quota.
  // Anonymous users get a per-IP bucket (30 req/hour) — same as before.
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

  // Per-AI-call timeouts (independent from each other and from card generation):
  //   grok-3 primary: 52s first-token | grok-3-mini primary: 28s | fallback: 10s
  // Vercel serverless functions have a 60s wall-clock limit. Keeping primary+fallback
  // to ≤58s gives a small buffer for the response serialisation overhead.
  const PRIMARY_TIMEOUT_MS = (useFastPath: boolean) => useFastPath ? 28_000 : 52_000;
  const FALLBACK_TIMEOUT_MS = 10_000;

  try {
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
    const { existingCards = [], context = {}, customInstructions } = body;

    // ── Guardrail 1: File-size guard ─────────────────────────────────────────
    // The client caps file rows at 100 (chat-input) but we add a server-side
    // safety net: replace inline file blocks > 50 data rows with a summary so
    // the enriched prompt stays well within the 12k-token budget.
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

    // ── Guardrail 4: Response deduplication ──────────────────────────────────
    // Hash the first 600 chars of the user message (enough to fingerprint intent
    // without being affected by file-content variance in long messages).
    const queryHash = djb2(userMessage.slice(0, 600));
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

    // Strip the [Fantasy League Context: ...]\n\n prefix the client injects so that
    // an NFBC user's platform name ("nfbc") in the context block doesn't falsely fire
    // hasADPIntent / hasStartSitIntent for every message they send.
    // Using explicit indexOf rather than a regex to avoid edge cases with brackets inside leagueCtx.
    const rawQueryLower = (() => {
      if (userMessage.startsWith('[Fantasy League Context:')) {
        const closingIdx = userMessage.indexOf(']\n\n');
        if (closingIdx !== -1) return userMessage.slice(closingIdx + 3).toLowerCase();
      }
      return msgLower;
    })();

    // Declare hasADPIntent early — used by sport-detection layer 0 and later
    // intent routing. Must be before the TEAM_TO_SPORT / inferredSport block to
    // avoid a TDZ ReferenceError.
    const hasADPIntent =
      ['adp', 'nfbc', 'nffc', 'average draft', 'draft position', 'draft rank', 'draft order', 'nfbc board', 'nffc board']
        .some(k => rawQueryLower.includes(k));

    // ── Team-name → sport inference ──────────────────────────────────────────
    // When context.sport is absent or 'none', scan the user message for known
    // team nicknames and infer the sport so card generation and model routing
    // use the correct sport context instead of falling through to 'all'.
    const TEAM_TO_SPORT: Record<string, string> = {
      // NBA — unambiguous team nicknames only
      cavaliers: 'nba', cavs: 'nba', mavericks: 'nba', mavs: 'nba',
      lakers: 'nba', celtics: 'nba', warriors: 'nba', bucks: 'nba',
      heat: 'nba', knicks: 'nba', nets: 'nba', sixers: 'nba',
      suns: 'nba', nuggets: 'nba', clippers: 'nba', thunder: 'nba',
      raptors: 'nba', timberwolves: 'nba', pelicans: 'nba', grizzlies: 'nba',
      rockets: 'nba', spurs: 'nba', jazz: 'nba', magic: 'nba',
      wizards: 'nba', pistons: 'nba', pacers: 'nba', hornets: 'nba',
      '76ers': 'nba', blazers: 'nba',
      // NFL — unambiguous nicknames only (giants/cardinals/panthers/rangers are ambiguous)
      cowboys: 'nfl', patriots: 'nfl', chiefs: 'nfl', eagles: 'nfl',
      packers: 'nfl', ravens: 'nfl', bills: 'nfl', rams: 'nfl',
      niners: 'nfl', '49ers': 'nfl', broncos: 'nfl', steelers: 'nfl',
      bengals: 'nfl', buccaneers: 'nfl', jaguars: 'nfl', titans: 'nfl',
      colts: 'nfl', texans: 'nfl', raiders: 'nfl', chargers: 'nfl',
      commanders: 'nfl', falcons: 'nfl', saints: 'nfl', seahawks: 'nfl',
      // MLB — unambiguous nicknames only (giants/cardinals removed — ambiguous with NFL)
      yankees: 'mlb', dodgers: 'mlb', cubs: 'mlb', astros: 'mlb',
      braves: 'mlb', mets: 'mlb', 'red sox': 'mlb',
      phillies: 'mlb', padres: 'mlb', mariners: 'mlb', guardians: 'mlb',
      brewers: 'mlb', reds: 'mlb', pirates: 'mlb', nationals: 'mlb',
      marlins: 'mlb', royals: 'mlb', twins: 'mlb', diamondbacks: 'mlb',
      rockies: 'mlb', orioles: 'mlb',
      // NHL — unambiguous nicknames only (panthers removed — ambiguous with NFL)
      penguins: 'nhl', bruins: 'nhl', lightning: 'nhl',
      oilers: 'nhl', avalanche: 'nhl', 'maple leafs': 'nhl', canucks: 'nhl',
      flames: 'nhl', jets: 'nhl', predators: 'nhl', blues: 'nhl',
      // Note: 'rangers' → NHL Rangers vs MLB Rangers (ambiguous, omitted)
      // Note: 'giants' → NFL Giants vs MLB Giants (ambiguous, omitted)
      // Note: 'cardinals' → NFL Cardinals vs MLB Cardinals (ambiguous, omitted)
      // Note: 'panthers' → NFL Panthers vs NHL Panthers (ambiguous, omitted)
    };

    // context.sport is a HINT from the client (persisted tab selection / previous query).
    // Always run all detection layers against the query text; if they produce a different
    // sport, the query text wins — this prevents stale NBA/etc. tab state from poisoning
    // sport routing for unambiguous queries like "Saquon Barkley against the Cowboys".
    let inferredSport = context?.sport && context.sport !== 'none' ? context.sport : undefined;

    const MLB_FORCE_TERMS = [
      // Fantasy / ADP meta-keywords
      'nfbc', 'nffc', '5x5', 'roto', 'saves+holds', 'shgn',
      'adp board', 'draft board', 'mock draft', 'fantasy baseball',
      // Statcast / baseball-specific stats not used in other sports
      'barrel rate', 'exit velocity', 'xwoba', 'babip', 'xfip', 'fip',
      'statcast', 'baseball savant', 'spin rate', 'whiff rate',
      // MLB team abbreviations (caps) — e.g. "LAD starter" or "NYY lineup"
      ' lad ', ' nyy ', ' bos ', ' hou ', ' chc ', ' atl ', ' sd ',
      ' sea ', ' kc ', ' cle ', ' det ', ' tb ', ' mil ', ' cin ',
      // Player names not yet in PLAYER_SPORT_MAP
      'witt jr', 'de la cruz', 'caminero', 'raleigh', 'skubal', 'skenes',
      'judge', 'crochet', 'kurtz',
    ];

    let detectedSport: string | undefined;

    // Layer -2: Prediction markets / political detection (absolute highest priority)
    // Prevents NFL/sports context bleed for Kalshi and political queries.
    // Must run before any sports-layer so "Senate seat markets" never routes to NFL.
    if (MARKET_SIGNALS.some(signal => msgLower.includes(signal))) {
      detectedSport = 'markets';
      console.log('[API/analyze] Detected category: prediction_markets (Layer -2)');
    }

    // Layer -1: Parenthetical MLB team/position abbreviation detection
    // Catches patterns like "Juan Soto (NYM OF)", "Gerrit Cole (NYY SP)", "Cal Raleigh (SEA C)"
    // Skip if Layer -2 already identified a prediction market (don't override 'markets' with 'mlb')
    if (!detectedSport) {
      const parenMatches = [...userMessage.matchAll(/\(([^)]+)\)/g)];
      for (const match of parenMatches) {
        const tokens = match[1].trim().split(/\s+/);
        for (const token of tokens) {
          if (MLB_TEAM_ABBREVS.has(token) || MLB_POSITION_ABBREVS.has(token)) {
            detectedSport = 'mlb';
            break;
          }
        }
        if (detectedSport) break;
      }
    }

    // Layer 0: MLB force-lock — highest priority
    if (!detectedSport && MLB_FORCE_TERMS.some(t => msgLower.includes(t))) {
      detectedSport = 'mlb';
    }
    // Layer 1: unambiguous team nicknames
    if (!detectedSport) {
      for (const [team, sportName] of Object.entries(TEAM_TO_SPORT)) {
        if (msgLower.includes(team)) { detectedSport = sportName; break; }
      }
    }
    // Layer 2: well-known player last names
    if (!detectedSport) {
      for (const [player, sportName] of Object.entries(PLAYER_SPORT_MAP)) {
        if (msgLower.includes(player)) { detectedSport = sportName; break; }
      }
    }
    // Layer 3: sport-specific statistical vocabulary (most-specific terms first)
    if (!detectedSport) {
      for (const { term, sport: sportName } of STAT_SPORT_MAP) {
        if (msgLower.includes(term)) { detectedSport = sportName; break; }
      }
    }

    // Override stale context sport when query text clearly signals a different sport
    if (detectedSport) {
      if (detectedSport !== inferredSport && inferredSport) {
        console.log(`[API/analyze] Sport override: context='${inferredSport}' → detected='${detectedSport}' from query signals`);
      }
      inferredSport = detectedSport;
    }

    // Merge inferred sport back into context so downstream handlers pick it up.
    // 'markets' is a virtual sport used only for routing — do NOT set context.sport
    // to 'markets' because sports-card handlers don't know that key. Instead,
    // flag as a political market and clear stale sport so Kalshi routing fires.
    if (inferredSport === 'markets') {
      context.isPoliticalMarket = true;
      context.sport = undefined;
      console.log('[API/analyze] Routing to Kalshi pipeline (sport=markets → isPoliticalMarket=true)');
    } else if (inferredSport) {
      context.sport = inferredSport;
    }
    // ADP queries with no explicit sport default to MLB — this app is MLB-first.
    // NFFC/football signals detected above already set inferredSport = 'nfl'.
    if (hasADPIntent && !context.sport) {
      context.sport = 'mlb';
      console.log('[API/analyze] ADP intent with no sport — defaulting to MLB');
    }

    // Start/sit intent: user wants daily matchup-based start or sit advice.
    const START_SIT_KEYWORDS = [
      'start/sit', 'start or sit', 'sit or start', 'who should i start',
      'who do i start', 'should i start', 'should i sit', 'matchup-based',
      'matchup based', 'streaming', 'stream this week', 'stream today',
      'must start', 'must sit', 'favorable matchup', 'tough matchup',
    ];
    // The hasFantasyIntent guard is intentionally absent: these keywords are
    // unambiguous in a sports context (e.g. "stream this week", "who should i start")
    // and the fantasy-intent classifier occasionally misses streaming questions.
    // Without the guard, isMLBStatcastMode is correctly suppressed so expectsStatcastJSON
    // stays false and no spurious "JSON not found" warning is logged for prose responses.
    const hasStartSitIntent = START_SIT_KEYWORDS.some(k => rawQueryLower.includes(k));

    // Statcast JSON mode applies to player-specific or non-betting MLB queries only.
    // General betting queries (hasBettingIntent && !hasPlayerIntent) get prose via baseSystemPrompt
    // — injecting MLB_ANALYSIS_ADDENDUM (which mandates JSON output) causes a prompt/response
    // mismatch: the AI correctly returns prose about odds, then we log a spurious JSON warning.
    // Similarly, general fantasy strategy questions (hasFantasyIntent && !hasPlayerIntent) —
    // e.g. "15-team roto draft strategy" — should return prose, not a JSON Statcast card.
    const isMLBStatcastMode =
      isMLBQuery &&
      !hasADPIntent &&
      !hasStartSitIntent &&
      (!context?.hasBettingIntent || !!context?.hasPlayerIntent) &&
      !(!!context?.hasFantasyIntent && !context?.hasPlayerIntent);

    // ── HR Prediction intent ────────────────────────────────────────────────
    // Fires when user asks about a specific player's HR probability for today.
    // Distinct from hasMLBProjectionIntent (slate-level DFS/fantasy) — this is
    // a single-player, probability-first query that calls the v3 prediction engine
    // with platoon scores ± 1, pitch mix vuln, and live market edge.
    const HR_PREDICTION_KEYWORDS = [
      'will he hit', 'will he homer', 'chance of', 'probability of',
      'hr tonight', 'homer tonight', 'home run tonight',
      'hit a hr', 'hit a homer', 'hit a home run',
      'odds of hitting', 'predict his hr', 'predict hr',
      'what are the odds', 'hr prediction', 'home run prediction',
      'hr probability', 'home run probability',
    ];
    const hasHRPredictionIntent =
      isMLBQuery &&
      !hasADPIntent &&
      !hasStartSitIntent &&
      HR_PREDICTION_KEYWORDS.some(k => rawQueryLower.includes(k)) &&
      (rawQueryLower.includes('hr') || rawQueryLower.includes('homer') || rawQueryLower.includes('home run'));

    // Kalshi tool intent: fires when user explicitly wants live market data or prices
    // via the tool (distinct from the existing isPoliticalMarket prompt-enrichment path
    // which injects Kalshi data as context without a tool call).
    const KALSHI_TOOL_KEYWORDS = [
      'kalshi market', 'prediction market', 'kalshi price', 'kalshi odds',
      'what\'s the price on', 'current price on', 'market price for',
      'show kalshi', 'list kalshi', 'kalshi election', 'kalshi trump',
      'yes price', 'no price', 'yes/no price', 'edge on yes', 'edge on no',
      'championship winner', 'contract pricing', 'championship contract',
      'winner contract', 'market contract', 'implied odds',
    ];
    const hasKalshiToolIntent =
      (context?.isPoliticalMarket || context?.selectedCategory === 'kalshi') &&
      KALSHI_TOOL_KEYWORDS.some(k => rawQueryLower.includes(k));

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
      MLB_PROJECTION_KEYWORDS.some(k => rawQueryLower.includes(k));

    // True only when MLB_ANALYSIS_ADDENDUM is the active system prompt — i.e. the model
    // was instructed to return a Statcast JSON card.  When hasMLBProjectionIntent is true
    // the system prompt switches to MLB_PROJECTION_ADDENDUM (prose), so we must NOT attempt
    // to parse JSON from that response or log a spurious "fell back to text extraction" warning.
    const expectsStatcastJSON = isMLBStatcastMode && !hasMLBProjectionIntent;

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

    const baseWithProfile = customInstructions?.trim()
      ? `${baseWithAddendum}\n\n## USER PROFILE & BETTING PREFERENCES\n${sanitizeCustomInstructions(customInstructions)}`
      : baseWithAddendum;
    const systemPrompt = body.deepThink
      ? `${baseWithProfile}${DEEP_THINK_ADDENDUM}`
      : baseWithProfile;

    // ── Auto-save inline TSV/CSV ADP uploads ─────────────────────────────────────
    // When a user drags a TSV file into the chat, the content is embedded inline
    // as "[File: ADP.tsv (N rows)]\nCol1\tCol2\t...\n...". If this message has
    // ADP intent we extract and save to Supabase right now so that the query_adp
    // tool (called later) returns the real uploaded data instead of static fallback.
    if (hasADPIntent && body.userMessage.includes('[File:')) {
      // Find all inline file blocks: "[File: name (N rows)]\n<content up to next [File: or end>"
      // IMPORTANT: use body.userMessage (original) not userMessage (truncated to 50 rows)
      // so we save the full file, not just the first 50 players.
      const fileBlockRe = /\[File:\s*([^\]]+\.(?:tsv|csv))[^\]]*\]\n([\s\S]*?)(?=\n\[File:|$)/gi;
      let fileMatch;
      while ((fileMatch = fileBlockRe.exec(body.userMessage)) !== null) {
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
    // Player-specific queries (e.g. "Aaron Judge") take priority before generic sports routing.
    const category = context.isPoliticalMarket
      ? 'kalshi'
      : context.selectedCategory === 'dfs'
        ? 'dfs'
        : context.hasPlayerIntent
          ? 'player'
          : context.hasFantasyIntent && !context.hasBettingIntent
            ? 'fantasy'
            : (context.hasBettingIntent || context.isSportsQuery)
              ? 'betting'
              : 'all';

    // ── Server-side cross-sport contamination guard ───────────────────────────
    // The client may send stale oddsData from a previous sport fetch (e.g., cached
    // NBA odds while the current query is about MLB). Validate sport match before
    // any prompt injection or card construction consumes the oddsData.
    // Normalizes both keys to their base form (strips prefix: 'baseball_mlb' → 'mlb').
    if (context.sport && context.oddsData?.sport) {
      const normalizeSportKey = (s: string) => s.toLowerCase().replace(/^[a-z]+_/, '');
      const ctxSportNorm  = normalizeSportKey(context.sport);
      const oddsSportNorm = normalizeSportKey(context.oddsData.sport);
      if (ctxSportNorm !== oddsSportNorm) {
        console.warn(
          `[v0] [CROSS-SPORT GUARD] Cleared oddsData: context.sport="${context.sport}" ≠ oddsData.sport="${context.oddsData.sport}" — fetching fresh data server-side`,
        );
        context.oddsData = undefined as any;
      }
    }

    // Build the enriched prompt with any real odds data or contextual info
    let enrichedPrompt = userMessage;
    // Holds Kalshi sports markets fetched during prompt enrichment so the card
    // pipeline can reuse them without a second API call.
    let kalshiSportsFallbackMarkets: any[] | null = null;
    // Track which data sources were actually injected into the AI prompt (for pipeline log)
    let serverFetchedOdds = false;
    let statcastInjected = false;

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
      // Pre-fetch actual Kalshi markets so the AI describes real data, not hallucinated markets.
      // Fetch 50 markets (matching the card generator's needs) so the 60s in-memory cache is
      // warm enough for card generation to reuse without a second API call.
      // A 3s timeout prevents blocking the AI call on a slow fetch.
      try {
        const { fetchElectionMarkets, fetchKalshiMarketsWithRetry } = await import('@/lib/kalshi/index');
        const sub = (context.kalshiSubcategory || '').toLowerCase();
        const fetchMarkets = sub === 'politics' || sub === 'elections' || sub === 'election'
          ? fetchElectionMarkets({ limit: 50 })
          : fetchKalshiMarketsWithRetry({ limit: 50, maxRetries: 3 });
        const markets = await Promise.race([
          fetchMarkets,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ]).catch(() => null);
        if (markets && (markets as any[]).length > 0) {
          const topMarkets = (markets as any[]).slice(0, 6);
          const marketSummary = topMarkets.map((m: any, i: number) => {
            // yesPrice is in cents (0–100). Treat directly as implied probability %.
            const yesCents = Math.min(100, Math.max(0, m.yesPrice ?? m.yesBid ?? m.yes_bid ?? 50));
            const noCents  = Math.min(100, Math.max(0, m.noPrice  ?? m.noAsk  ?? m.no_ask  ?? (100 - yesCents)));
            const spread   = m.spread ?? Math.abs(yesCents - (100 - noCents));
            const vol = m.volume24h ?? m.volume ?? 0;
            const volStr = vol > 1_000_000 ? `${(vol / 1_000_000).toFixed(1)}M` : vol > 1_000 ? `${(vol / 1_000).toFixed(0)}K` : `${vol}`;
            return `${i + 1}. "${m.title}" — YES: ${yesCents}% implied prob, NO: ${noCents}%, Spread: ${spread}¢, Vol: ${volStr}`;
          }).join('\n');
          console.log(`[KALSHI] Injected ${topMarkets.length} prediction markets into AI context`);
          enrichedPrompt += `\n\n--- LIVE KALSHI PREDICTION MARKETS ---\n${marketSummary}\n[YES % = market-implied probability. Edge = difference between your model probability and YES %. Ground analysis in these real prices — do not invent tickers or volumes.]\n--- END KALSHI DATA ---`;
        } else {
          enrichedPrompt += `\n\n[Context: Kalshi prediction market query. No live markets available — provide general prediction market analysis and strategy.]`;
        }
      } catch {
        enrichedPrompt += `\n\n[Context: This is a Kalshi prediction market query. Answer directly with prediction market analysis, probability edge, and trading recommendations. Do NOT ask the user to choose a sports platform or area — the user is already on the Kalshi tab. Analyze the specific market or topic asked about.]`;
      }
    } else if (context.hasBettingIntent && context.sport && !context.isPoliticalMarket && !hasADPIntent) {
      // Client didn't include live odds — try fetching from the Odds API server-side first.
      // This covers cases where the user typed directly in chat without the UI pre-fetching odds.
      const _oddsKey = getOddsApiKey();
      if (_oddsKey && context.sport !== 'none') {
        try {
          const { fetchLiveOdds } = await import('@/lib/odds/index');
          const _serverEvents = await Promise.race([
            fetchLiveOdds(context.sport, { apiKey: _oddsKey, markets: ['h2h', 'spreads', 'totals'], regions: ['us'], oddsFormat: 'american' }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
          ]).catch(() => null);
          if (Array.isArray(_serverEvents) && _serverEvents.length > 0) {
            const oddsPreview = (_serverEvents as any[])
              .slice(0, 8)
              .map((e: any) => {
                const lines: string[] = [`${e.away_team} @ ${e.home_team}`];
                for (const book of (e.bookmakers || []).slice(0, 2)) {
                  const h2h    = book.markets?.find((m: any) => m.key === 'h2h');
                  const spread = book.markets?.find((m: any) => m.key === 'spreads');
                  const total  = book.markets?.find((m: any) => m.key === 'totals');
                  if (h2h) {
                    const home = h2h.outcomes?.find((o: any) => o.name === e.home_team);
                    const away = h2h.outcomes?.find((o: any) => o.name === e.away_team);
                    lines.push(`  ML (${book.title}): ${e.away_team} ${(away?.price ?? 0) > 0 ? '+' : ''}${away?.price ?? 'N/A'} | ${e.home_team} ${(home?.price ?? 0) > 0 ? '+' : ''}${home?.price ?? 'N/A'}`);
                  }
                  if (spread) {
                    const home = spread.outcomes?.find((o: any) => o.name === e.home_team);
                    const away = spread.outcomes?.find((o: any) => o.name === e.away_team);
                    lines.push(`  Spread (${book.title}): ${e.away_team} ${(away?.point ?? 0) > 0 ? '+' : ''}${away?.point ?? ''} (${(away?.price ?? 0) > 0 ? '+' : ''}${away?.price ?? 'N/A'}) | ${e.home_team} ${(home?.point ?? 0) > 0 ? '+' : ''}${home?.point ?? ''} (${(home?.price ?? 0) > 0 ? '+' : ''}${home?.price ?? 'N/A'})`);
                  }
                  if (total) {
                    const over  = total.outcomes?.find((o: any) => o.name === 'Over');
                    const under = total.outcomes?.find((o: any) => o.name === 'Under');
                    lines.push(`  Total (${book.title}): O${over?.point ?? ''} (${(over?.price ?? 0) > 0 ? '+' : ''}${over?.price ?? 'N/A'}) | U${under?.point ?? ''} (${(under?.price ?? 0) > 0 ? '+' : ''}${under?.price ?? 'N/A'})`);
                  }
                }
                return lines.join('\n');
              })
              .join('\n\n');
            enrichedPrompt += `\n\n--- REAL LIVE ODDS DATA (use ONLY these numbers for odds/lines) ---\nSport: ${context.sport}\n\n${oddsPreview}\n--- END ODDS DATA ---`;
            serverFetchedOdds = true;
            console.log(`[v0] [ANALYZE] Server-fetched ${_serverEvents.length} ${context.sport} games from Odds API`);

            // Query Supabase for notable line movements in the last 4 hours for this sport.
            // These indicate where sharp money has been bet — valuable AI context.
            try {
              const { createClient: createSbClient } = await import('@/lib/supabase/server');
              const _sb = await createSbClient();
              const { data: _moves } = await _sb
                .from('line_movement')
                .select('game_id, market_type, bookmaker, old_odds, new_odds, updated_at')
                .eq('sport', context.sport)
                .gte('updated_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
                .order('updated_at', { ascending: false })
                .limit(10);
              if (_moves && _moves.length > 0) {
                const sharpLines = _moves.map((m: any) => {
                  const delta = (m.new_odds ?? 0) - (m.old_odds ?? 0);
                  const direction = delta < 0 ? 'shortening ▼' : 'lengthening ▲';
                  const isSharp  = Math.abs(delta) >= 20;
                  return `  ${m.market_type} (${m.bookmaker}): ${m.old_odds > 0 ? '+' : ''}${m.old_odds} → ${m.new_odds > 0 ? '+' : ''}${m.new_odds} (${direction}${isSharp ? ' 🔥 SHARP' : ''})`;
                }).join('\n');
                enrichedPrompt += `\n\n--- RECENT LINE MOVEMENT (last 4h, ${context.sport}) ---\n${sharpLines}\n[Shortening ≥20pts = likely sharp money. Factor into your confidence/recommendation.]\n--- END LINE MOVEMENT ---`;
                console.log(`[v0] [ANALYZE] Injected ${_moves.length} line movement signals`);
              }
            } catch {
              // Non-critical — skip if Supabase is unavailable
            }
          }
        } catch (oddsErr) {
          // Non-fatal — fall through to Kalshi fallback below.
          // Downgrade 4xx errors (invalid API key, quota exceeded) to warn
          // so they don't appear as error-level logs when the path is handled.
          const oddsStatus = (oddsErr as any)?.status ?? (oddsErr as any)?.statusCode;
          const oddsMsg = oddsErr instanceof Error ? oddsErr.message : String(oddsErr);
          if (oddsStatus && oddsStatus >= 400 && oddsStatus < 500) {
            console.warn('[v0] [ANALYZE] Odds API ' + oddsStatus + ' — ' + oddsMsg + '. Using Kalshi fallback.');
          }
        }
      }

      if (serverFetchedOdds) {
        // Odds API delivered real lines — no need for Kalshi fallback
      } else {
      // Odds API returned no games or key missing — use Kalshi sports markets as an
      // independent probability signal (win/loss futures, player props, championship markets).
      // Skip for ADP queries: the NFBC system prompt + ADP tool already provides the right context.
      // Maps the internal sport key to the search term Kalshi understands.
      const SPORT_TO_KALSHI_KW: Record<string, string> = {
        basketball_nba: 'NBA', basketball_ncaab: 'college basketball',
        americanfootball_nfl: 'NFL', americanfootball_ncaaf: 'college football',
        baseball_mlb: 'MLB', icehockey_nhl: 'NHL',
        soccer_epl: 'Premier League', soccer_mls: 'MLS',
        mma_mixed_martial_arts: 'UFC MMA',
      };
      const sportKw = SPORT_TO_KALSHI_KW[context.sport]
        ?? context.sport.replace(/^[a-z]+_/, '').toUpperCase();
      try {
        const { fetchKalshiMarketsWithRetry, generateKalshiCards } = await import('@/lib/kalshi/index');
        const markets = await Promise.race([
          fetchKalshiMarketsWithRetry({ search: sportKw, limit: 10, maxRetries: 3 }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
        ]).catch(() => null);
        if (markets && (markets as any[]).length > 0) {
          const top = (markets as any[]).slice(0, 6);
          kalshiSportsFallbackMarkets = top; // reused by card pipeline below
          const marketLines = top.map((m: any, i: number) => {
            const yesCents = Math.min(100, Math.max(0, m.yesPrice ?? m.yesBid ?? 50));
            const noCents  = Math.min(100, Math.max(0, 100 - yesCents));
            const vol = m.volume24h ?? m.volume ?? 0;
            const volStr = vol > 1_000_000 ? `${(vol / 1_000_000).toFixed(1)}M` : vol > 1_000 ? `${(vol / 1_000).toFixed(0)}K` : `${vol}`;
            return `${i + 1}. "${m.title}" — YES: ${yesCents}% (implied prob ${(yesCents / 100).toFixed(3)}), NO: ${noCents}%, Vol: ${volStr}`;
          }).join('\n');
          console.log(`[KALSHI] Injected ${top.length} ${sportKw} markets as odds fallback`);
          enrichedPrompt += `\n\n--- KALSHI ${sportKw.toUpperCase()} MARKETS (live market-implied probabilities — sportsbook odds unavailable) ---\n${marketLines}\n[YES % = market-implied probability. Use these as your probability baseline. Identify edge where your model probability diverges from market price.]\n--- END KALSHI DATA ---`;
        } else {
          enrichedPrompt += `\n\n[Context: Live ${context.sport.toUpperCase()} sportsbook odds are unavailable. Provide expert betting analysis, line expectations, and value picks based on your knowledge. Today: ${dateStr}.]`;
          console.log(`[KALSHI] No ${sportKw} markets found — falling back to model knowledge`);
        }
      } catch (err) {
        console.warn(`[KALSHI] Sports market fetch failed for ${sportKw}:`, err instanceof Error ? err.message : String(err));
        enrichedPrompt += `\n\n[Context: Live ${context.sport.toUpperCase()} sportsbook odds are unavailable. Provide expert betting analysis and value picks from your knowledge.]`;
      }
      } // end else (Kalshi fallback when Odds API had no data)
    } else if (hasADPIntent && context.sport) {
      // ADP/draft query — NFBC system prompt + ADP tool provide all context; no odds data needed
      enrichedPrompt += `\n\n[Context: Fantasy draft/ADP query for ${context.sport.toUpperCase()}. Use the query_adp tool and your NFBC expertise to answer. Focus on draft value, positional scarcity, and roster construction — not sportsbook odds.]`;
    } else if (!context.hasBettingIntent && !context.sport && !context.isPoliticalMarket) {
      // General question — answer from knowledge
      enrichedPrompt += `\n\n[Context: General question — answer with your full expert knowledge about sports betting, fantasy, DFS, or prediction markets as appropriate.]`;
    }

    // ── Statcast enrichment for MLB queries ───────────────────────────────────
    // Inject top barrel rate / exit velocity leaders so the AI has real Statcast
    // context for any MLB question, not just explicit Statcast-mode queries.
    // Skipped for ADP and non-MLB queries.
    //
    // Strategy: DB-first (instant, no external API) → fall back to Baseball Savant
    // when the statcast_daily table is empty (first ever request or after schema reset).
    // The fallback warms the DB so subsequent cold-starts skip the full 1546-row fetch.
    if (isMLBQuery && !hasADPIntent && !context.isPoliticalMarket) {
      const STATCAST_SEASON = new Date().getFullYear() - (new Date().getMonth() + 1 >= 4 ? 0 : 1);
      try {
        // ① Try DB first — avoids Baseball Savant API call and 1546-row upsert on warm runs
        const { getTopStatcastLeadersFromDB } = await import('@/lib/services/statcast-ingest');
        const { batters: dbBatters, pitchers: dbPitchers } = await Promise.race([
          getTopStatcastLeadersFromDB(STATCAST_SEASON, 5),
          new Promise<{ batters: never[]; pitchers: never[] }>(
            resolve => setTimeout(() => resolve({ batters: [], pitchers: [] }), 800)
          ),
        ]);

        if (dbBatters.length >= 3 && dbPitchers.length >= 3) {
          // DB warm — use cached leaders directly
          const fmtB = (p: Record<string, unknown>) =>
            `  ${p.player_name}: Barrel% ${Number(p.barrel_rate ?? 0).toFixed(1)}, xwOBA ${Number(p.xwoba ?? 0).toFixed(3)}, HardHit% ${Number(p.hard_hit_pct ?? 0).toFixed(1)}, ExitVelo ${Number(p.avg_exit_velocity ?? 0).toFixed(1)} mph`;
          const fmtP = (p: Record<string, unknown>) =>
            `  ${p.player_name}: xSLG-allowed ${Number(p.xslg ?? 0).toFixed(3)}, Barrel%-allowed ${Number(p.barrel_rate ?? 0).toFixed(1)}, xwOBA-against ${Number(p.xwoba ?? 0).toFixed(3)}`;
          enrichedPrompt += `\n\n${[
            `--- MLB STATCAST LEADERS (${STATCAST_SEASON} season) ---`,
            'Top Batters by Barrel Rate:',
            ...dbBatters.map(fmtB),
            'Top Pitchers (lowest xSLG allowed):',
            ...dbPitchers.map(fmtP),
            '--- END STATCAST ---',
          ].join('\n')}`;
          statcastInjected = true;
          console.log(`[v0] [ANALYZE] Injected Statcast leaders from DB: ${dbBatters.length} batters, ${dbPitchers.length} pitchers`);
        } else {
          // ② DB cold — fetch from Baseball Savant and warm the DB for next time
          const { getStatcastData, queryStatcast } = await import('@/lib/baseball-savant');
          const { players: statcastPlayers } = await Promise.race([
            getStatcastData(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
          ]);
          if (statcastPlayers.length > 0) {
            const batters = queryStatcast(statcastPlayers, { playerType: 'batter', limit: 5 })
              .sort((a, b) => b.barrelRate - a.barrelRate);
            const pitchers = queryStatcast(statcastPlayers, { playerType: 'pitcher', limit: 5 })
              .sort((a, b) => a.xslg - b.xslg);
            const fmtB = (p: (typeof batters)[0]) =>
              `  ${p.name}: Barrel% ${p.barrelRate.toFixed(1)}, xwOBA ${p.xwoba.toFixed(3)}, HardHit% ${p.hardHitPct.toFixed(1)}, ExitVelo ${p.exitVelocity.toFixed(1)} mph`;
            const fmtP = (p: (typeof pitchers)[0]) =>
              `  ${p.name}: xSLG-allowed ${p.xslg.toFixed(3)}, Barrel%-allowed ${p.barrelRate.toFixed(1)}, xwOBA-against ${p.xwoba.toFixed(3)}`;
            enrichedPrompt += `\n\n${[
              `--- MLB STATCAST LEADERS (${STATCAST_SEASON} season) ---`,
              'Top Batters by Barrel Rate:',
              ...batters.map(fmtB),
              'Top Pitchers (lowest xSLG allowed):',
              ...pitchers.map(fmtP),
              '--- END STATCAST ---',
            ].join('\n')}`;
            statcastInjected = true;
            console.log(`[v0] [ANALYZE] Injected Statcast leaders: ${batters.length} batters, ${pitchers.length} pitchers`);
            // Warm the DB so subsequent cold-starts skip this fetch (fire-and-forget)
            void import('@/lib/services/statcast-ingest').then(({ persistStatcastLeaders }) =>
              persistStatcastLeaders(statcastPlayers)
            ).catch(() => {/* non-critical */});
          }
        }
      } catch {
        // Non-critical — skip if DB and Baseball Savant are both unreachable
      }
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

    // ── NFL data-provenance context (fires for ANY NFL query with no live odds) ─────────────
    // This app has no live NFL stats API. Without live odds/props injected above, any NFL
    // player stats in the response come purely from Grok's training data, which may predate
    // or incompletely cover the most recent NFL season. Inject explicit framing so the AI
    // doesn't silently hallucinate stats or label stale data as current.
    const isNFLQuery = (context.sport ?? '').includes('football') || (context.sport ?? '') === 'nfl' || (context.sport ?? '') === '';
    const hasLiveNFLOdds = (context.oddsData?.events?.length ?? 0) > 0;
    if (isNFLQuery && !hasLiveNFLOdds && !context.isPoliticalMarket) {
      const now2 = new Date();
      const month = now2.getMonth() + 1;
      const isOffseason = month >= 3 && month <= 8; // Mar–Aug = NFL offseason
      const isPlayoffs = month === 1 || month === 2; // Jan–Feb = NFL playoffs/Super Bowl
      const isRegularSeason = month >= 9 || month === 12; // Sep–Dec = regular season
      const phaseLabel = isOffseason
        ? `${NFL_SEASON_YEAR} NFL season is complete (Super Bowl concluded ~Feb ${NFL_SEASON_YEAR + 1}). It is currently the ${NFL_SEASON_YEAR + 1} offseason (free agency, draft prep, rookie minis).`
        : isPlayoffs
        ? `The ${NFL_SEASON_YEAR} NFL regular season is complete; playoffs are in progress.`
        : isRegularSeason
        ? `The ${NFL_SEASON_YEAR} NFL regular season is in progress.`
        : `NFL offseason.`;
      enrichedPrompt += `\n\n[NFL Season Context — ${NFL_SEASON_YEAR}]\n${phaseLabel}\nIMPORTANT: No live NFL stats are available in this session. Any player stats, snap counts, yards, TDs, or performance metrics you provide are sourced from your training knowledge and may be incomplete for the ${NFL_SEASON_YEAR} season. Label all AI-sourced stats as "(${NFL_SEASON_YEAR} season — AI estimate)" and encourage the user to verify at NFL.com, Pro Football Reference, or ESPN for official figures.`;
    }

    // Fantasy-specific context injection — only when fantasy is the primary intent.
    // Mirrors the card-generation guard (line ~640): betting takes priority over fantasy
    // when both intents are detected, so don't pollute a live-odds betting prompt with
    // a Fantasy Context block that tells the AI to give fantasy advice instead.
    if (context.hasFantasyIntent && (!context.hasBettingIntent || context.selectedCategory === 'fantasy' || context.selectedCategory === 'dfs')) {
      const sport = context.sport || '';
      const isNFL = sport.includes('football') || sport === '';
      if (isNFL) {
        // NFL season complete — tell AI to focus on the upcoming offseason/draft cycle
        enrichedPrompt += `\n\n[Fantasy Context: The ${NFL_SEASON_YEAR} NFL regular season and playoffs are complete. Fantasy advice should address the ${NFL_SEASON_YEAR + 1} offseason: free agency moves, rookie targets, ADP for ${NFL_SEASON_YEAR + 1} redraft leagues, and dynasty/devy strategy. Any stats referenced are ${NFL_SEASON_YEAR} season figures from AI training data — label them as "(${NFL_SEASON_YEAR} — AI estimate)" and encourage verification.]`;
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

    // ── Card generation + AI prompt alignment ────────────────────────────────
    //
    // ARCHITECTURE: For queries where the client already sent live odds (context.oddsData),
    // cards are built synchronously from those odds AND the same odds are in enrichedPrompt
    // above — AI and cards are perfectly aligned with zero extra latency.
    //
    // For all other cases (server-fetched cards), we now AWAIT card generation before
    // building the final AI prompt, then inject a compact summary of the fetched card
    // data via cardsToPromptContext(). This ensures the AI response directly references
    // the same games, players, and odds shown in the UI cards below it.
    //
    // Trade-off: adds ~600-900ms sequential overhead for server-fetch cases, but
    // eliminates the mismatch between AI narrative and displayed card data.
    //
    const hasExistingCards = Array.isArray(existingCards) && existingCards.length > 0
      && !context.sport
      && !context.isSportsQuery
      && !context.hasBettingIntent
      && !context.isPoliticalMarket
      && context.selectedCategory !== 'kalshi'
      && context.selectedCategory !== 'dfs';

    // Cards we've already resolved (available for prompt injection before AI starts)
    let resolvedCards: InsightCard[] | null = null;
    let cardPromise: Promise<InsightCard[]>;

    // ── Case 1: Client sent live odds → cards built synchronously, AI already has data ──
    if (!context.isPoliticalMarket && !isAmbiguous && (context.isSportsQuery || context.hasBettingIntent) && context.oddsData?.events?.length > 0) {
      const sportKey = context.sport || context.oddsData.sport || 'sports';
      const builtCards = oddsEventsToBettingCards(
        context.oddsData.events,
        context.oddsData.sport || sportKey,
        6
      );
      resolvedCards = builtCards;
      cardPromise = Promise.resolve(builtCards);
      // enrichedPrompt already contains these odds from the earlier injection above

    // ── Case 2: Reuse existing cards for truly general queries ────────────────
    } else if (hasExistingCards) {
      cardPromise = Promise.resolve(existingCards as InsightCard[]);

    // ── Case 3: Server must fetch cards — await first so AI references same data ──
    } else {
      // Build the appropriate fetch promise for this query type
      let cardFetchPromise: Promise<InsightCard[]>;

      if (isAmbiguous) {
        // Ambiguous query: show multi-sport real games and tell AI what's displayed
        cardFetchPromise = generateContextualCards('all', undefined, 6).catch(() => []);

      } else if (!context.isPoliticalMarket && context.selectedCategory === 'dfs') {
        // DFS tab: fetch real player prop lines
        cardFetchPromise = generateContextualCards('dfs', context.sport ?? undefined, 6).catch(() => []);

      } else if (!context.isPoliticalMarket && (context.hasFantasyIntent || hasADPIntent) && (!context.hasBettingIntent || context.selectedCategory === 'fantasy' || hasADPIntent)) {
        // Fantasy: warm projection cache (fire-and-forget) then generate fantasy cards
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
              console.warn('[API/analyze] Projection seeding failed:', err instanceof Error ? err.message : String(err));
            });
        }
        cardFetchPromise = import('@/lib/fantasy/cards/fantasy-card-generator')
          .then(({ generateFantasyCards }) => generateFantasyCards(userMessage, 6, context.sport || undefined, {
            teamCount: context.leagueSize ?? undefined,
            scoringFormat: context.leagueScoringFormat ?? undefined,
            isStartSit: hasStartSitIntent,
          }))
          .catch(() => generateContextualCards('fantasy', context.sport ?? undefined, 6).catch(() => []));

      } else if (!context.isPoliticalMarket && context.hasPlayerIntent) {
        // Player-specific: Statcast/VPE cards.
        // Use parseIntent to extract a player name from the query text when the client
        // did not supply context.playerName (e.g. "Aaron Judge stats" with no playerName set).
        const intent = parseIntent(userMessage, context.sport ?? undefined);
        const resolvedPlayerName = context.playerName
          ?? (intent.players.length > 0 ? intent.players[0] : undefined);
        if (resolvedPlayerName && !context.playerName) {
          console.log(`[API/analyze] parseIntent extracted playerName="${resolvedPlayerName}" from query`);
        }
        cardFetchPromise = Promise.all([
          generateContextualCards('player', context.sport ?? undefined, 1, false, undefined, { playerName: resolvedPlayerName }),
          generateContextualCards('betting', context.sport ?? undefined, 3).catch(() => []),
        ]).then(([playerCards, supplementaryCards]) =>
          [...playerCards, ...supplementaryCards].slice(0, 6)
        ).catch(() => []);

      } else if (!context.isPoliticalMarket && (context.isSportsQuery || context.hasBettingIntent)) {
        // Betting/sports with no client odds: fetch from server
        const sportKey = context.sport || undefined;
        if (kalshiSportsFallbackMarkets && kalshiSportsFallbackMarkets.length > 0) {
          cardFetchPromise = import('@/lib/kalshi/index')
            .then(({ generateKalshiCards }) => {
              const kalshiCards = generateKalshiCards(kalshiSportsFallbackMarkets!);
              console.log(`[KALSHI] Serving ${kalshiCards.length} prediction market cards (odds API fallback)`);
              return kalshiCards as InsightCard[];
            })
            .catch(() => generateContextualCards('betting', sportKey, 6).catch(() => []));
        } else {
          cardFetchPromise = generateContextualCards('betting', sportKey, 6).catch(() => []);
        }

      } else {
        // General / fallback — avoid triggering ADP/fantasy cards when there's no fantasy intent
        const isFantasyOrDFSCategory = category === 'fantasy' || category === 'dfs';
        const hasFantasyOrADPIntent = context.hasFantasyIntent || hasADPIntent;
        const effectiveCategory = isFantasyOrDFSCategory && !hasFantasyOrADPIntent ? 'betting' : category;
        cardFetchPromise = generateContextualCards(effectiveCategory, context.sport ?? undefined, 6, false, context.kalshiSubcategory).catch(() => []);
      }

      // Await with a generous timeout — cards typically resolve in 600-900ms.
      // If they exceed 5s we start AI with whatever we have (or empty).
      resolvedCards = await Promise.race([
        cardFetchPromise,
        new Promise<InsightCard[]>(resolve => setTimeout(() => resolve([]), 5000)),
      ]);

      // Inject card context into enrichedPrompt so the AI knows what data the user sees.
      // Only inject for real-data cards — skip when cards are empty or all fallback.
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
    // ── Guardrail 3: Token budget guard ──────────────────────────────────────
    // Hard cap: 12k prompt tokens (~48k chars). If the enriched prompt exceeds
    // this, truncate inline file sections rather than cutting arbitrary content.
    const TOKEN_BUDGET_CHARS = 48_000;
    if (enrichedPrompt.length > TOKEN_BUDGET_CHARS) {
      const before = enrichedPrompt.length;
      // Prefer to shrink inline file blocks first (they're already summarised)
      enrichedPrompt = enrichedPrompt
        .replace(/\[File:[^\]]+\]\n[\s\S]*?\n\[\.\.\. \d+ more rows[^\]]*\]/g, '[File: (truncated — use query_adp tool)]')
        .slice(0, TOKEN_BUDGET_CHARS);
      enrichedPrompt += '\n\n[CONTEXT TRIMMED — token budget. Full data available via query_adp tool.]';
      console.warn(`[API/analyze] Token budget: trimmed ${before} → ${enrichedPrompt.length} chars (~${Math.ceil(before / 4)} → 12k tokens)`);
    }

    // ── AI generation starts now ──────────────────────────────────────────────

    const xaiApiKey = getGrokApiKey();
    const oddsApiKey = getOddsApiKey();
    const hasClientOddsData = !!(context.oddsData?.events?.length);
    // Route DFS, pure-fantasy, file-upload, off-season, and ambiguous queries directly to
    // grok-3-fast (3-6s). Reserve grok-3 for live-odds betting analysis.
    // deepThink overrides everything: always use grok-4 with extended reasoning.
    // ADP queries override to primary: reliable tool use requires the stronger model.
    // isAmbiguous queries only need a short clarification reply — no need for primary.
    const useFastPath = body.deepThink ? false : (hasADPIntent ? false : (isAmbiguous || shouldUseFastModel(userMessage, context)));
    const primaryModel = body.deepThink ? 'grok-4' : (useFastPath ? AI_CONFIG.FAST_MODEL_NAME : AI_CONFIG.MODEL_NAME);
    // Always log the resolved model so failures are immediately traceable in Vercel logs
    logger.info(LogCategory.AI, 'model_selected', {
      metadata: { model: primaryModel, fastPath: useFastPath, hasADPIntent, sport: context?.sport ?? null },
    });
    // ── Pipeline observability log ────────────────────────────────────────────
    // Single structured entry shows exactly which data sources are active for
    // this request — makes debugging silent failures fast.
    console.log(LOG_PREFIXES.PIPELINE, {
      sport:    context.sport  ?? 'none',
      category,
      model:    primaryModel,
      fastPath: useFastPath,
      sources: {
        odds:        hasClientOddsData || serverFetchedOdds,
        kalshi:      !!(kalshiSportsFallbackMarkets?.length) || context.isPoliticalMarket || context.selectedCategory === 'kalshi',
        adp:         hasADPIntent,
        statcast:    expectsStatcastJSON || statcastInjected,
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
        KALSHI_API_KEY: !!(process.env.KALSHI_API_KEY_ID && process.env.KALSHI_PRIVATE_KEY),
      },
    });
    let aiText = '';
    let modelUsed: string = AI_CONFIG.MODEL_DISPLAY_NAME;
    let usedFallback = false;
    let tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
    let pendingADPCard: InsightCard | null = null;
    let pendingADPUploadCard: InsightCard | null = null;
    let pendingStatcastCard: InsightCard | null = null;
    let pendingHRPredictionCard: InsightCard | null = null;
    let skipStatcastJSON = false;

    // Card types that can come from the MLB_ANALYSIS_ADDENDUM JSON output
    const STATCAST_CARD_TYPES = new Set([
      'statcast_summary_card', 'hr_prop_card', 'game_simulation_card',
      'leaderboard_card', 'pitch_analysis_card',
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

        // 1. Season-level xwOBA/xBA/xSLG from Baseball Savant public API
        const { players: allPlayers, isLiveData, season } = await getStatcastData();
        const results = allPlayers.length > 0
          ? queryStatcast(allPlayers, { player, playerType, limit })
          : [];

        // 2. Pitch-level aggregate from our Supabase statcast_events DB (recent 30 days)
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
        'Always call this tool FIRST — NEVER invent salaries, projections, or odds. ' +
        'Call this tool ONCE per query. When `player` is set, outputFor is ignored — ' +
        'single-player analysis covers all use cases (projections, betting edge, and fantasy).',
      inputSchema: mlbProjectionParams,
      execute: async ({ playerType, player, limit, date, outputFor }: z.infer<typeof mlbProjectionParams>) => {
        console.log('[API/analyze] MLB projection tool called:', { playerType, player, limit, date, outputFor });
        try {
          const resolvedOutputFor = outputFor ?? 'projections';
          let cards: unknown[];

          // Player-specific: always route to single-player projection regardless of outputFor.
          // This covers all use cases (projections, betting edge, fantasy) in one call and
          // prevents the AI from calling the tool twice with different outputFor values.
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

    // ── HR Prediction Tool (v3 engine: platoon scores + pitch mix vuln) ─────────
    // Called when user asks about a specific player's HR probability today.
    // Uses hr-prediction-bridge to resolve player name → game → pitcher → v3 output.
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
          return {
            success:      true,
            type:         'hr_prediction_card',
            player,
            ...result,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error('[API/analyze] predictHR tool error:', msg);
          return {
            success: false,
            error:   msg,
            player,
            type:    'hr_prediction_card',
          };
        }
      },
    });

    // ── Kalshi Market Tools ───────────────────────────────────────────────────────
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

    // ── get_live_odds tool — fetches real-time sportsbook odds on demand ─────────
    // Triggered as a fallback when the user has betting intent but the pre-fetch
    // did not inject odds (e.g. wrong sport detected, follow-up question, etc.).
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
          const { fetchLiveOdds } = await import('@/lib/odds/index');
          const data = await fetchLiveOdds(sport, {
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

    // ── Line movement / sharp money tool ─────────────────────────────────────
    const LINE_MOVEMENT_KEYWORDS = [
      'line movement', 'line move', 'line moves', 'steam move', 'steam',
      'sharp money', 'sharp action', 'sharp bet', 'sharps', 'movers',
      'reverse line movement', 'rlm', 'public money', 'biggest mover',
    ];
    const hasLineMovementIntent = LINE_MOVEMENT_KEYWORDS.some(k => rawQueryLower.includes(k));

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
            : 'http://localhost:3000';
          const res = await fetch(`${baseOrigin}/api/odds/movers?hours=${hours}`, { cache: 'no-store' });
          if (!res.ok) return { movers: [] };
          return await res.json();
        } catch (err) {
          return { movers: [], error: err instanceof Error ? err.message : String(err) };
        }
      },
    });

    // ── Best props / prop picks tool ──────────────────────────────────────────
    const PROPS_KEYWORDS = [
      'best props', 'prop picks', 'top props', 'player props', 'prop bets',
      'player prop', 'best bets props', 'prop value', 'favorite prop',
    ];
    const hasPropsToolIntent = PROPS_KEYWORDS.some(k => rawQueryLower.includes(k));

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
            : 'http://localhost:3000';
          const params = new URLSearchParams();
          if (sport)  params.set('sport', sport);
          if (market) params.set('market', market);
          const res = await fetch(`${baseOrigin}/api/props/latest?${params}`, { cache: 'no-store' });
          if (!res.ok) return { props: [] };
          return await res.json();
        } catch (err) {
          return { props: [], error: err instanceof Error ? err.message : String(err) };
        }
      },
    });

    // ── SSE streaming response — wraps AI generation + post-processing ──────────
    const encoder = new TextEncoder();
    const sseChunk = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          if (xaiApiKey) {
            const primaryTimeoutMs = PRIMARY_TIMEOUT_MS(useFastPath);
            const abortCtrl = new AbortController();

            // streamText returns immediately; tokens arrive via textStream async iterable
            const streamResult = streamText({
              model: createXai({ apiKey: xaiApiKey })(primaryModel),
              system: systemPrompt,
              ...buildGenOptions(enrichedPrompt, hasImages ? validatedImageAttachments : undefined),
              temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
              maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
              maxRetries: 0,
              abortSignal: abortCtrl.signal,
              ...(hasADPIntent && { tools: { query_adp: adpTool }, stopWhen: stepCountIs(3) }),
              ...(hasHRPredictionIntent && { tools: { predict_hr: predictHRTool }, stopWhen: stepCountIs(2) }),
              ...(hasKalshiToolIntent && !hasHRPredictionIntent && !hasADPIntent && { tools: { kalshi_get_markets: kalshiGetMarketsTool, kalshi_get_price: kalshiGetPriceTool }, stopWhen: stepCountIs(2) }),
              ...(!hasHRPredictionIntent && !hasKalshiToolIntent && hasMLBProjectionIntent && { tools: { query_mlb_projections: mlbProjectionTool }, stopWhen: stepCountIs(3) }),
              ...(!hasHRPredictionIntent && !hasKalshiToolIntent && !hasMLBProjectionIntent && isMLBStatcastMode && { tools: { query_statcast: statcastTool }, stopWhen: stepCountIs(3) }),
              // Line movement / sharp money queries
              ...(hasLineMovementIntent && { tools: { get_odds_movers: getOddsMoversTool }, stopWhen: stepCountIs(2) }),
              // Best props queries
              ...(hasPropsToolIntent && !hasLineMovementIntent && { tools: { get_props_latest: getPropsLatestTool }, stopWhen: stepCountIs(2) }),
              // Fallback: betting intent but no tool matched and no odds pre-injected → let Grok fetch live odds
              ...(!hasADPIntent && !hasHRPredictionIntent && !hasKalshiToolIntent && !hasMLBProjectionIntent && !isMLBStatcastMode && !hasLineMovementIntent && !hasPropsToolIntent && context.hasBettingIntent && !serverFetchedOdds && { tools: { get_live_odds: getLiveOddsTool }, stopWhen: stepCountIs(2) }),
              // Deep Think: raise tool round-trips so complex multi-step analysis can call multiple tools
              ...(body.deepThink && { maxSteps: 5 }),
            });

            // Abort if the first token doesn't arrive within the timeout budget
            const firstTokenTimer = setTimeout(() => abortCtrl.abort(new Error('Primary timeout')), primaryTimeoutMs);

            // Max chars to stream before truncating a runaway response
            const RESPONSE_CHAR_LIMIT = 8_000;

            try {
              let gotFirstToken = false;
              let responseTruncated = false;
              for await (const delta of streamResult.textStream) {
                if (!gotFirstToken) { gotFirstToken = true; clearTimeout(firstTokenTimer); }
                if (responseTruncated) continue; // drain the stream without emitting
                if (aiText.length + delta.length > RESPONSE_CHAR_LIMIT) {
                  // Emit the remaining chars up to the cap, then inject a notice
                  const remaining = RESPONSE_CHAR_LIMIT - aiText.length;
                  if (remaining > 0) {
                    const partial = delta.slice(0, remaining);
                    aiText += partial;
                    controller.enqueue(sseChunk({ type: 'text', delta: partial }));
                  }
                  const notice = '\n\n---\n_Response truncated — ask me to continue or be more specific._';
                  aiText += notice;
                  controller.enqueue(sseChunk({ type: 'text', delta: notice }));
                  responseTruncated = true;
                  console.warn(`[API/analyze] Response truncated at ${RESPONSE_CHAR_LIMIT} chars`);
                  continue;
                }
                aiText += delta;
                controller.enqueue(sseChunk({ type: 'text', delta }));
              }
              clearTimeout(firstTokenTimer);
              modelUsed = useFastPath ? AI_CONFIG.FAST_MODEL_DISPLAY_NAME : AI_CONFIG.MODEL_DISPLAY_NAME;

              // ── Capture token usage ────────────────────────────────────────────
              try {
                const usage = await streamResult.usage;
                if (usage) {
                  tokenUsage = {
                    promptTokens: usage.inputTokens ?? 0,
                    completionTokens: usage.outputTokens ?? 0,
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

              // HR Prediction tool results
              if (hasHRPredictionIntent) {
                const hrResult = allToolResults.find((tr: any) => tr.toolName === 'predict_hr');
                if (hrResult?.result) {
                  const hr = hrResult.result;
                  pendingHRPredictionCard = {
                    type:       'hr_prediction_card',
                    title:      `${hr.player ?? 'Player'} — HR Prediction`,
                    icon:       '💣',
                    category:   'MLB',
                    subcategory: 'HR Prop · v3 Engine',
                    gradient:   'from-rose-600/20 via-red-900/15 to-slate-900/40',
                    status:     hr.success ? 'edge' : 'neutral',
                    realData:   true,
                    data:       hr,
                  };
                  console.log('[API/analyze] HR prediction card built for:', hr.player);
                } else {
                  // Tool didn't fire or returned undefined — emit a degraded card so the
                  // UI slot is never silently empty when the user asked for a HR prediction.
                  pendingHRPredictionCard = {
                    type:       'hr_prediction_card',
                    title:      'HR Prediction',
                    icon:       '💣',
                    category:   'MLB',
                    subcategory: 'HR Prop · v3 Engine',
                    gradient:   'from-rose-600/20 via-red-900/15 to-slate-900/40',
                    status:     'neutral',
                    realData:   false,
                    data:       {
                      success: false,
                      error:   'Live MLB data unavailable — prediction could not be generated.',
                      player:  'Unknown',
                      type:    'hr_prediction_card',
                    },
                  };
                  console.warn('[API/analyze] HR prediction tool did not fire — emitting degraded card');
                }
              }

              // Statcast tool results — only relevant when MLB_ANALYSIS_ADDENDUM is active
              if (expectsStatcastJSON) {
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
              clearTimeout(firstTokenTimer);
              // Primary stream failed — fall back to generateText (no streaming for fallback)
              const alreadyFast = useFastPath;
              const actualFallbackModel = alreadyFast ? AI_CONFIG.MODEL_NAME : AI_CONFIG.FAST_MODEL_NAME;
              const errSummary = (() => {
                if (streamErr && typeof streamErr === 'object') {
                  const e = streamErr as Record<string, unknown>;
                  if (e.statusCode) return `HTTP ${e.statusCode} from ${e.url ?? 'xAI'}`;
                }
                return streamErr instanceof Error ? streamErr.message : String(streamErr);
              })();
              console.error(`[API/analyze] Primary stream failed — ${errSummary} | Retrying with ${actualFallbackModel}`);
              try {
                const fallbackAbort = new AbortController();
                const fallbackTimer = setTimeout(() => fallbackAbort.abort(new Error('Fallback timeout')), FALLBACK_TIMEOUT_MS);
                const fallbackResult = await generateText({
                  model: createXai({ apiKey: xaiApiKey })(actualFallbackModel),
                  system: systemPrompt,
                  prompt: enrichedPrompt,
                  temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
                  maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
                  maxRetries: 0,
                  abortSignal: fallbackAbort.signal,
                });
                clearTimeout(fallbackTimer);
                aiText = fallbackResult.text;
                modelUsed = alreadyFast ? `${AI_CONFIG.MODEL_DISPLAY_NAME} (fallback)` : `${AI_CONFIG.FAST_MODEL_DISPLAY_NAME} (fallback)`;
                console.log(`[API/analyze] Fallback succeeded with ${actualFallbackModel}`);
                controller.enqueue(sseChunk({ type: 'text', delta: aiText }));
              } catch (fallbackErr) {
                const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
                console.error('[API/analyze] Fallback also failed:', fallbackMsg);
                // Surface rate-limit and auth errors as SSE error events so the
                // client can show a meaningful message instead of a silent fallback.
                const primaryStatus = (streamErr as Record<string, unknown>)?.statusCode as number | undefined;
                const isRateLimit = primaryStatus === 429 || fallbackMsg.includes('429') || fallbackMsg.toLowerCase().includes('rate limit');
                const isAuthError = primaryStatus === 401 || fallbackMsg.includes('401') || fallbackMsg.toLowerCase().includes('unauthorized');
                if (isRateLimit || isAuthError) {
                  const errMsg = isRateLimit
                    ? 'AI rate limit reached — please wait a moment and try again.'
                    : 'AI API key error — contact support if this persists.';
                  controller.enqueue(sseChunk({ type: 'error', message: errMsg }));
                  aiText = errMsg;
                } else {
                  aiText = generateFallbackResponse(userMessage, context);
                  controller.enqueue(sseChunk({ type: 'text', delta: aiText }));
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
            controller.enqueue(sseChunk({ type: 'text', delta: aiText }));
          }

          // ── Post-processing: cards, trust metrics, done event ─────────────────
          let cards: InsightCard[] = await cardPromise.catch(() => []);

          if (pendingHRPredictionCard) cards = [pendingHRPredictionCard, ...cards.slice(0, 4)];
          if (pendingADPCard) {
            if (context.hasPlayerIntent) {
              // Player card stays as hero; ADP card goes after it as a thumbnail
              cards = [cards[0], pendingADPCard, ...cards.slice(1, 5)].filter(Boolean) as InsightCard[];
            } else {
              cards = [pendingADPCard, ...cards.slice(0, 5)];
            }
          }
          if (pendingADPUploadCard) cards = [...cards, pendingADPUploadCard];

          // MLB Statcast: parse Grok's JSON response into a card.
          // Runs for all MLB queries (not just expectsStatcastJSON) because the AI occasionally
          // generates a valid card JSON even when the ADP or projection addendum is active.
          // Projection / DFS / stack queries normally return prose — the inner type-check guard
          // (STATCAST_CARD_TYPES.has) prevents spurious parses of non-card JSON.
          if (isMLBQuery && !usedFallback && !skipStatcastJSON) {
            /** Attempt to parse a JSON string and return it if it has a valid Statcast card type. */
            const tryParseStatcastCard = (src: string): Record<string, unknown> | null => {
              try {
                const p = JSON.parse(src) as Record<string, unknown>;
                if (
                  p !== null &&
                  typeof p === 'object' &&
                  typeof p.type === 'string' &&
                  STATCAST_CARD_TYPES.has(p.type) &&
                  typeof p.title === 'string' &&
                  Array.isArray(p.summary_metrics)
                ) {
                  return p;
                }
              } catch {
                // not valid JSON — try next candidate
              }
              return null;
            };

            // Build candidate list ordered by specificity:
            // 1. ```json ... ``` or ``` ... ``` code fences (Grok sometimes wraps JSON despite instructions)
            // 2. Non-greedy {...} blocks (avoids merging adjacent objects)
            // 3. Full greedy {...} span as last resort (handles deeply-nested objects)
            const jsonCandidates: string[] = [];
            const codeFenceMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeFenceMatch) jsonCandidates.push(codeFenceMatch[1].trim());
            for (const m of aiText.matchAll(/\{[\s\S]*?\}/g)) jsonCandidates.push(m[0]);
            const fullSpanMatch = aiText.match(/\{[\s\S]*\}/);
            if (fullSpanMatch) jsonCandidates.push(fullSpanMatch[0]);

            let parsedStatcast: Record<string, unknown> | null = null;
            for (const candidate of jsonCandidates) {
              parsedStatcast = tryParseStatcastCard(candidate);
              if (parsedStatcast) break;
            }

            if (parsedStatcast) {
              const statcastCard: InsightCard = { icon: '⚾', ...parsedStatcast } as InsightCard;
              cards = [statcastCard, ...cards.slice(0, 5)];
              pendingStatcastCard = null;
              const metricLines = ((parsedStatcast.summary_metrics as { label: string; value: string }[] | undefined) ?? [])
                .slice(0, 3)
                .map((m: { label: string; value: string }) => `**${m.label}:** ${m.value}`)
                .join(' · ');
              const cleanText = [
                `**${parsedStatcast.title}** — MLB Statcast Analysis`,
                metricLines,
                'See the card below for the full breakdown and splits.',
              ].filter(Boolean).join('\n');
              aiText = cleanText;
              // Replace the raw JSON the client already received with readable prose
              controller.enqueue(sseChunk({ type: 'replace', text: cleanText }));
            } else if (expectsStatcastJSON) {
              // Grok returned markdown/text despite JSON instructions — log with context
              // so we can diagnose prompt-compliance issues without surface-level noise.
              // Only warn when expectsStatcastJSON=true; prose is correct for all other paths.
              const preview = aiText.slice(0, 120).replace(/\n/g, ' ');
              logger.warn(LogCategory.API, '[API/analyze] MLB Statcast JSON not found in response — prose fallback', {
                metadata: { previewChars: preview, responseLength: aiText.length, hasCodeFence: aiText.includes('```'), hasBrace: aiText.includes('{') },
              });
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
            const isNFLContext = context?.sport?.includes('football') || context?.sport === 'nfl' || rawQueryLower.includes('nffc') || rawQueryLower.includes('nfl draft') || rawQueryLower.includes('fantasy football');
            const adpBoardName = isNFLContext
              ? `NFFC ${new Date().getFullYear()} NFL ADP Board`
              : `NFBC ${new Date().getFullYear()} ADP Board`;
            sources.push({ name: adpBoardName, type: 'api' as const, reliability: 97 });
          }

          // ── Guardrail 4: store successful response in dedup cache ────────────
          if (aiText && !usedFallback) {
            dedupCache.set(queryHash, {
              text: aiText,
              cards,
              confidence: trustMetrics.finalConfidence,
              ts: Date.now(),
            });
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
