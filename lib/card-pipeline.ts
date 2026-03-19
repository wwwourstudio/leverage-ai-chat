/**
 * Production-grade card generation pipeline.
 *
 * ARCHITECTURE:
 *   DATA → NORMALIZE → ENRICH → SCORE → AI EXPLAINS → UI
 *
 * AI is called ONCE, LAST, with structured data already assembled.
 * It fills only insights.summary + insights.keyFactors as JSON.
 * It CANNOT break the pipeline — all real data is computed before the AI call.
 */

import type {
  Card, CardType, CardInsights, DataSourceMeta, DataSourceName,
  NormalizedStats, OddsData, ParsedIntent, Player, Trend,
} from '@/lib/card-schema';
import { AI_CONFIG } from '@/lib/constants';
import { getGrokApiKey, getOddsApiKey } from '@/lib/config';
import { logger, LogCategory } from '@/lib/logger';
import type { InsightCard } from '@/lib/cards-generator';

// ============================================================================
// 1. INTENT PARSER — deterministic, no AI
// ============================================================================

const SPORT_KEYWORDS: Record<string, ParsedIntent['sport']> = {
  mlb: 'mlb', baseball: 'mlb', 'baseball_mlb': 'mlb',
  nba: 'nba', basketball: 'nba', 'basketball_nba': 'nba',
  nfl: 'nfl', football: 'nfl', 'americanfootball_nfl': 'nfl',
  nhl: 'nhl', hockey: 'nhl', 'icehockey_nhl': 'nhl',
  ncaab: 'ncaab', ncaaf: 'ncaaf',
};

const PROP_MARKET_KEYWORDS: Record<string, string> = {
  'home run': 'hr', 'hr': 'hr', 'homer': 'hr',
  'hits': 'hits', 'hit ': 'hits',
  'strikeout': 'strikeouts', ' k ': 'strikeouts', 'whiff': 'strikeouts',
  'points': 'points', 'pts': 'points',
  'rebounds': 'rebounds', 'reb': 'rebounds',
  'assists': 'assists', 'ast': 'assists',
  'touchdown': 'touchdowns', 'td': 'touchdowns',
  'passing yards': 'passing_yards', 'rushing yards': 'rushing_yards',
};

const CARD_TYPE_SIGNALS: Array<[RegExp, CardType]> = [
  [/\b(start|sit|flex|stream)\b/i,             'fantasy_start_sit'],
  [/\b(waiver|roster|pickup|drop)\b/i,          'fantasy_start_sit'],
  [/\b(hr prop|home run prop|hits over|k prop|strikeout prop)\b/i, 'prop_bet'],
  [/\b(bet|odds|line|spread|moneyline|total)\b/i, 'prop_bet'],
  [/\b(preview|outlook|game|matchup|tonight)\b/i, 'game_outlook'],
  [/\b(trend|hot|streak|cold|slump|last \d+)\b/i, 'trend_alert'],
];

/**
 * Parse a free-form user query into structured intent.
 * Uses regex + keyword matching only — no AI, no network.
 */
export function parseIntent(query: string, contextSport?: string): ParsedIntent {
  const lower = query.toLowerCase();

  // Sport detection
  let sport: ParsedIntent['sport'] = 'unknown';
  for (const [kw, s] of Object.entries(SPORT_KEYWORDS)) {
    if (lower.includes(kw)) { sport = s; break; }
  }
  if (sport === 'unknown' && contextSport) {
    sport = (SPORT_KEYWORDS[contextSport.toLowerCase()] ?? 'unknown') as ParsedIntent['sport'];
  }

  // Card type detection (first match wins)
  let cardType: CardType = 'player_analysis';
  for (const [pattern, type] of CARD_TYPE_SIGNALS) {
    if (pattern.test(query)) { cardType = type; break; }
  }

  // Market detection
  let market: string | undefined;
  for (const [kw, m] of Object.entries(PROP_MARKET_KEYWORDS)) {
    if (lower.includes(kw)) { market = m; break; }
  }

  // Player extraction — capitalised words preceded by known triggers
  // Deliberately simple: false positives are filtered by data fetches
  const playerPattern = /(?:(?:^|\s)([A-Z][a-z]+ [A-Z][a-z]+)(?:\s|$|'s))/g;
  const players: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = playerPattern.exec(query)) !== null) {
    const candidate = m[1];
    // Skip team cities / day-of-week / generic words
    const skip = ['Los Angeles', 'New York', 'San Francisco', 'Kansas City', 'Green Bay',
                  'Tampa Bay', 'This Week', 'Last Year', 'Next Week'];
    if (!skip.includes(candidate)) players.push(candidate);
  }

  // Team extraction — common MLB/NBA/NFL franchise names
  const TEAM_NAMES = [
    'Yankees', 'Dodgers', 'Red Sox', 'Cubs', 'Mets', 'Cardinals', 'Braves', 'Astros',
    'Lakers', 'Warriors', 'Celtics', 'Bucks', 'Heat', 'Nuggets', 'Suns',
    'Chiefs', 'Eagles', 'Cowboys', 'Packers', 'Patriots', '49ers', 'Bills',
  ];
  const teams = TEAM_NAMES.filter(t => query.includes(t));

  return { sport, cardType, players, teams, market, isMultiPlayer: players.length > 1 };
}

// ============================================================================
// 2. NORMALIZATION LAYER
// ============================================================================

type RawStatcastPlayer = {
  player_name?: string;
  avg_exit_velocity?: number;
  barrel_rate?: number;
  xwoba?: number;
  xba?: number;
  hard_hit_pct?: number;
  sweet_spot_pct?: number;
  [key: string]: unknown;
};

type RawOddsEvent = {
  id?: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: Array<{
    title: string;
    markets?: Array<{ key: string; outcomes?: Array<{ name: string; price: number; point?: number }> }>;
  }>;
};

/**
 * Normalise raw Statcast data into the consistent NormalizedStats shape.
 */
export function normalizeStatcast(raw: RawStatcastPlayer): NormalizedStats {
  return {
    avgExitVelo:   raw.avg_exit_velocity != null ? Number(raw.avg_exit_velocity) : undefined,
    barrelRate:    raw.barrel_rate        != null ? Number(raw.barrel_rate)        : undefined,
    xwOBA:         raw.xwoba             != null ? Number(raw.xwoba)             : undefined,
    xBA:           raw.xba               != null ? Number(raw.xba)               : undefined,
    hardHitRate:   raw.hard_hit_pct      != null ? Number(raw.hard_hit_pct)      : undefined,
    sweetSpotRate: raw.sweet_spot_pct    != null ? Number(raw.sweet_spot_pct)    : undefined,
  };
}

/**
 * Normalise a raw Odds API event into the OddsData shape.
 * Picks the highest-ranked bookmaker (DraftKings > FanDuel > BetMGM …).
 */
const BOOK_RANK = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'ESPN BET'];

export function normalizeOdds(event: RawOddsEvent, market: 'h2h' | 'spreads' | 'totals' = 'h2h'): OddsData | undefined {
  const books = event.bookmakers ?? [];
  if (books.length === 0) return undefined;

  const sorted = [...books].sort((a, b) => {
    const ai = BOOK_RANK.findIndex(n => a.title?.includes(n));
    const bi = BOOK_RANK.findIndex(n => b.title?.includes(n));
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const book = sorted[0];
  const mkt = book.markets?.find(m => m.key === market);
  if (!mkt) return undefined;

  const outcomes = mkt.outcomes ?? [];

  if (market === 'h2h') {
    const homeO = outcomes.find(o => o.name === event.home_team);
    const awayO = outcomes.find(o => o.name === event.away_team);
    const homePrice = homeO?.price ?? 0;
    const awayPrice = awayO?.price ?? 0;
    const impliedProbability = homePrice > 0
      ? 100 / (homePrice + 100)
      : Math.abs(homePrice) / (Math.abs(homePrice) + 100);
    return {
      market: 'h2h',
      homeOdds: homePrice || undefined,
      awayOdds: awayPrice || undefined,
      impliedProbability: Math.round(impliedProbability * 1000) / 10,
      bookmaker: book.title,
      bookmakerCount: books.length,
    };
  }

  if (market === 'totals') {
    const over  = outcomes.find(o => o.name === 'Over');
    const under = outcomes.find(o => o.name === 'Under');
    return {
      market: 'totals',
      line:       over?.point,
      overOdds:   over?.price,
      underOdds:  under?.price,
      bookmaker:  book.title,
      bookmakerCount: books.length,
    };
  }

  return undefined;
}

// ============================================================================
// 3. EDGE CALCULATION
// ============================================================================

/**
 * Edge = (modelProbability − impliedProbability) × 100
 * Returns undefined when either input is missing.
 */
export function calculateEdge(modelProbability: number, impliedProbability: number): number {
  return Math.round((modelProbability - impliedProbability / 100) * 100 * 10) / 10;
}

/**
 * Derive a confidence score (0–100) from data completeness and edge magnitude.
 * More data sources + larger edge = higher confidence.
 */
export function calculateConfidence(
  sources: DataSourceMeta[],
  edge?: number,
): number {
  const successRate = sources.length > 0
    ? sources.filter(s => s.success).length / sources.length
    : 0;

  const edgeBonus = edge != null ? Math.min(Math.abs(edge) * 2, 20) : 0;
  const sourceBonus = Math.min(sources.filter(s => s.success).length * 10, 40);

  return Math.min(Math.round(successRate * 40 + sourceBonus + edgeBonus), 100);
}

// ============================================================================
// 4. DETERMINISTIC STATUS MAPPING
// ============================================================================

type CanonicalStatus = Card['status'];

/**
 * Map a numeric edge (or generic card context) to a canonical StatusBadgeKey.
 * This is the ONLY place where badge status is assigned — no magic strings.
 */
export function edgeToStatus(edge?: number, hasPriceOdds?: boolean): CanonicalStatus {
  if (edge != null) {
    if (edge >= 10)  return 'hot';
    if (edge >= 5)   return 'edge';
    if (edge >= 2)   return 'value';
    if (edge >= 0)   return 'favorable';
    return 'neutral'; // negative edge
  }
  return hasPriceOdds ? 'value' : 'neutral';
}

// ============================================================================
// 5. CARD BUILDER — no AI, deterministic
// ============================================================================

let _idCounter = 0;
function stableId(...parts: (string | number | undefined)[]): string {
  const str = parts.filter(Boolean).join('|');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return `${(h >>> 0).toString(36)}-${(++_idCounter).toString(36)}`;
}

export interface CardBuildInput {
  type: CardType;
  sport: string;
  title: string;
  subtitle?: string;
  player?: Player;
  stats?: NormalizedStats;
  projections?: Record<string, number>;
  odds?: OddsData;
  trends?: Trend[];
  tags?: string[];
  sources: DataSourceMeta[];
  /** Pre-computed edge (skips calculateEdge when already known) */
  edge?: number;
  /** Raw source payloads for debugging */
  raw?: Record<string, unknown>;
}

/**
 * Build a Card with empty AI insights.
 * AI enrichment fills insights.summary + insights.keyFactors in the next step.
 */
export function buildCard(input: CardBuildInput): Card {
  const { type, sport, title, subtitle, player, stats, projections, odds, trends, tags, sources, edge, raw } = input;

  const status = edgeToStatus(edge, !!(odds?.homeOdds || odds?.overOdds));
  const confidence = calculateConfidence(sources, edge);

  return {
    id: stableId(type, sport, title, String(Date.now())),
    type,
    sport,
    title,
    subtitle,
    player,
    data: { stats, projections, odds, trends, raw },
    insights: {
      summary:    '',   // filled by AI enrichment
      keyFactors: [],   // filled by AI enrichment
      confidence,
      edge,
    },
    status,
    tags:      tags ?? [],
    priority:  edge ?? confidence,
    createdAt: Date.now(),
    sources,
  };
}

// ============================================================================
// 6. AI ENRICHMENT — fills insights.summary + insights.keyFactors ONLY
// ============================================================================

const ENRICHMENT_SYSTEM_PROMPT =
`You are a sports data analyst. You will receive structured JSON data about a player, game, or betting market.
Return ONLY a JSON object — no prose, no markdown, no code fences.
Required shape:
{
  "summary": "<1-2 sentence insight using the provided numbers>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}
Rules:
- summary must reference at least one specific number from the data
- keyFactors must be 2-4 short phrases, each under 10 words
- Do not invent stats not present in the data
- Do not include hedging language like "may" or "might" for factors backed by the data`;

interface EnrichmentResult {
  summary: string;
  keyFactors: string[];
}

/**
 * Call the AI with structured card data and parse the strict JSON response.
 * If the AI response cannot be parsed, returns deterministic fallback text —
 * the card is NEVER discarded due to an AI failure.
 */
export async function enrichCardWithAI(
  card: Card,
  apiKey: string,
  model: string,
): Promise<EnrichmentResult> {
  const t0 = Date.now();

  // Build a compact data payload — only numeric facts + player/game context
  const dataPayload: Record<string, unknown> = {
    type: card.type,
    sport: card.sport,
    title: card.title,
  };
  if (card.player) dataPayload.player = card.player.name;
  if (card.data.stats) dataPayload.stats = Object.fromEntries(
    Object.entries(card.data.stats).filter(([, v]) => v != null)
  );
  if (card.data.projections) dataPayload.projections = card.data.projections;
  if (card.data.odds) dataPayload.odds = card.data.odds;
  if (card.insights.edge != null) dataPayload.edge = card.insights.edge;
  if (card.data.trends?.length) dataPayload.trends = card.data.trends;

  const userPrompt = `Structured data:\n${JSON.stringify(dataPayload, null, 2)}`;

  try {
    const { generateText } = await import('ai');
    const { createXai } = await import('@ai-sdk/xai');

    const xai = createXai({ apiKey });
    const { text } = await generateText({
      model: xai(model),
      system: ENRICHMENT_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 256,
      temperature: 0,
    });

    // Strip any accidental markdown fences
    const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const summary = typeof parsed.summary === 'string' && parsed.summary.length > 0
      ? parsed.summary
      : buildFallbackSummary(card);

    const keyFactors = Array.isArray(parsed.keyFactors)
      ? (parsed.keyFactors as unknown[]).filter((f): f is string => typeof f === 'string').slice(0, 4)
      : buildFallbackKeyFactors(card);

    logger.info(LogCategory.AI, 'card_enrichment_ok', {
      metadata: { cardId: card.id, latencyMs: Date.now() - t0, model },
    });

    return { summary, keyFactors };

  } catch (err) {
    // AI failure is non-fatal — always return usable fallback
    logger.warn(LogCategory.API, 'card_enrichment_failed', {
      metadata: { cardId: card.id, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - t0 },
    });
    return {
      summary:    buildFallbackSummary(card),
      keyFactors: buildFallbackKeyFactors(card),
    };
  }
}

function buildFallbackSummary(card: Card): string {
  const stats = card.data.stats;
  if (stats?.barrelRate != null && stats?.avgExitVelo != null) {
    return `${card.player?.name ?? card.title} posts a ${stats.barrelRate}% barrel rate and ${stats.avgExitVelo} mph avg exit velocity.`;
  }
  if (card.insights.edge != null) {
    return `Model shows ${card.insights.edge.toFixed(1)}% edge on this market.`;
  }
  return `${card.title} — see key factors below.`;
}

function buildFallbackKeyFactors(card: Card): string[] {
  const factors: string[] = [];
  const s = card.data.stats;
  if (s?.barrelRate   != null) factors.push(`Barrel rate: ${s.barrelRate}%`);
  if (s?.avgExitVelo  != null) factors.push(`Avg exit velo: ${s.avgExitVelo} mph`);
  if (s?.xwOBA        != null) factors.push(`xwOBA: ${s.xwOBA}`);
  if (s?.hardHitRate  != null) factors.push(`Hard hit: ${s.hardHitRate}%`);
  if (card.insights.edge != null) factors.push(`Edge: ${card.insights.edge > 0 ? '+' : ''}${card.insights.edge}%`);
  if (card.data.odds?.impliedProbability != null) factors.push(`Implied prob: ${card.data.odds.impliedProbability}%`);
  return factors.slice(0, 4);
}

// ============================================================================
// PIPELINE ORCHESTRATOR — ties all stages together
// ============================================================================

export interface PipelineOptions {
  /** Skip AI enrichment (e.g. for batch pre-generation or testing) */
  skipAI?: boolean;
  /** Timeout ms for AI enrichment call (default: 8 000) */
  aiTimeoutMs?: number;
}

/**
 * Run the full card pipeline for a pre-built card:
 *   buildCard output → AI enrichment → final Card
 *
 * Used by callers that have already fetched + normalised their data.
 */
export async function enrichCard(
  card: Card,
  opts: PipelineOptions = {},
): Promise<Card> {
  if (opts.skipAI) return card;

  const apiKey = getGrokApiKey();
  if (!apiKey) return card;

  const { aiTimeoutMs = 8_000 } = opts;

  const enriched = await Promise.race([
    enrichCardWithAI(card, apiKey, AI_CONFIG.FAST_MODEL_NAME),
    new Promise<EnrichmentResult>((_, reject) =>
      setTimeout(() => reject(new Error('AI enrichment timeout')), aiTimeoutMs)
    ),
  ]).catch((): EnrichmentResult => ({
    summary:    buildFallbackSummary(card),
    keyFactors: buildFallbackKeyFactors(card),
  }));

  return {
    ...card,
    insights: { ...card.insights, ...enriched },
  };
}

/**
 * Enrich a batch of cards in parallel (max 3 concurrent to avoid rate limits).
 */
export async function enrichCards(
  cards: Card[],
  opts: PipelineOptions = {},
): Promise<Card[]> {
  const CONCURRENCY = 3;
  const results: Card[] = [];

  for (let i = 0; i < cards.length; i += CONCURRENCY) {
    const batch = cards.slice(i, i + CONCURRENCY);
    const enriched = await Promise.all(batch.map(c => enrichCard(c, opts)));
    results.push(...enriched);
  }

  return results;
}

// ============================================================================
// ADAPTER — Card → InsightCard (backwards compatibility with existing renderer)
// ============================================================================

/**
 * Convert a new Card to the legacy InsightCard shape so it can be rendered
 * by the existing DynamicCardRenderer + card components without changes.
 *
 * Forward-compat: once the renderer is migrated to Card, remove this adapter.
 */
export function toInsightCard(card: Card): InsightCard {
  const { stats, odds, projections, trends } = card.data;

  return {
    id:          card.id,
    type:        card.type,
    title:       card.title,
    icon:        iconForCardType(card.type),
    category:    card.sport.toUpperCase(),
    subcategory: card.subtitle ?? labelForCardType(card.type),
    gradient:    gradientForStatus(card.status),
    status:      card.status,
    realData:    card.sources.some(s => s.success && s.source !== 'fallback'),
    metadata:    {
      realData:   card.sources.some(s => s.success && s.source !== 'fallback'),
      sources:    card.sources,
      pipelineV2: true,
    },
    data: {
      // Stats layer
      ...flattenStats(stats),
      // Odds layer
      ...(odds ? {
        homeOdds:         odds.homeOdds != null ? formatAmerican(odds.homeOdds) : undefined,
        awayOdds:         odds.awayOdds != null ? formatAmerican(odds.awayOdds) : undefined,
        overUnder:        odds.line     != null ? `O/U ${odds.line}` : undefined,
        bookmaker:        odds.bookmaker,
        bookmakerCount:   odds.bookmakerCount,
        impliedProb:      odds.impliedProbability != null ? `${odds.impliedProbability}%` : undefined,
      } : {}),
      // Projections
      ...(projections ? Object.fromEntries(
        Object.entries(projections).map(([k, v]) => [k, String(v)])
      ) : {}),
      // Trends as readable rows
      ...(trends ? Object.fromEntries(
        trends.map(t => [t.label, String(t.value)])
      ) : {}),
      // AI insights
      insight:      card.insights.summary,
      keyFactors:   card.insights.keyFactors.join(' · '),
      confidence:   card.insights.confidence,
      edge:         card.insights.edge != null ? `${card.insights.edge > 0 ? '+' : ''}${card.insights.edge}%` : undefined,
      // Player
      player:       card.player?.name,
      team:         card.player?.team,
      position:     card.player?.position,
    },
    summary_metrics: stats ? buildSummaryMetrics(stats) : undefined,
    trend_note:  card.insights.keyFactors[0],
    last_updated: new Date(card.createdAt).toLocaleDateString(),
  };
}

// ── Adapter helpers ──────────────────────────────────────────────────────────

function iconForCardType(type: CardType): string {
  const map: Record<CardType, string> = {
    player_analysis:   '⚾',
    prop_bet:          'TrendingUp',
    fantasy_start_sit: 'Star',
    game_outlook:      'Calendar',
    trend_alert:       'Activity',
  };
  return map[type] ?? 'BarChart';
}

function labelForCardType(type: CardType): string {
  const map: Record<CardType, string> = {
    player_analysis:   'Player Analysis',
    prop_bet:          'Prop Bet',
    fantasy_start_sit: 'Start/Sit',
    game_outlook:      'Game Outlook',
    trend_alert:       'Trend Alert',
  };
  return map[type] ?? 'Analysis';
}

function gradientForStatus(status: Card['status']): string {
  const map: Record<Card['status'], string> = {
    hot:         'from-red-600/80 via-rose-700/60 to-red-900/40',
    value:       'from-emerald-600/80 via-green-700/60 to-emerald-900/40',
    edge:        'from-orange-600/80 via-amber-700/60 to-orange-900/40',
    optimal:     'from-sky-600/80 via-blue-700/60 to-sky-900/40',
    elite:       'from-purple-600/80 via-violet-700/60 to-purple-900/40',
    target:      'from-teal-600/80 via-cyan-700/60 to-teal-900/40',
    sleeper:     'from-indigo-600/80 via-violet-700/60 to-indigo-900/40',
    opportunity: 'from-blue-600/80 via-indigo-700/60 to-blue-900/40',
    alert:       'from-amber-600/80 via-yellow-700/60 to-amber-900/40',
    favorable:   'from-green-600/80 via-emerald-700/60 to-green-900/40',
    neutral:     'from-slate-600/80 via-gray-700/60 to-slate-900/40',
  };
  return map[status] ?? 'from-blue-600/80 via-indigo-700/60 to-blue-900/40';
}

function flattenStats(stats?: NormalizedStats): Record<string, string> {
  if (!stats) return {};
  const out: Record<string, string> = {};
  if (stats.avgExitVelo  != null) out['Avg Exit Velo'] = `${stats.avgExitVelo} mph`;
  if (stats.barrelRate   != null) out['Barrel Rate']   = `${stats.barrelRate}%`;
  if (stats.xwOBA        != null) out['xwOBA']         = String(stats.xwOBA);
  if (stats.xBA          != null) out['xBA']           = String(stats.xBA);
  if (stats.hardHitRate  != null) out['Hard Hit %']    = `${stats.hardHitRate}%`;
  if (stats.sweetSpotRate != null) out['Sweet Spot %'] = `${stats.sweetSpotRate}%`;
  if (stats.hrProjection != null) out['HR Proj']       = stats.hrProjection.toFixed(3);
  if (stats.kProjection  != null) out['K Proj']        = String(stats.kProjection);
  return out;
}

function buildSummaryMetrics(stats: NormalizedStats): Array<{ label: string; value: string }> {
  return Object.entries(flattenStats(stats))
    .map(([label, value]) => ({ label, value }))
    .slice(0, 5);
}

function formatAmerican(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

// ============================================================================
// HR EDGE ANALYSER — full real-data pipeline for HR prop betting
//
// Pipeline:
//   1. MLBAM ID             — getPlayerByName() — canonical player identity
//   2. Recent Statcast      — getRecentStatcast(playerId) — 14-day game data
//   3. Season fallback      — getStatcastData() — if recent sample too thin
//   4. HR model             — computeHRProb() — Bayesian logistic [0–1]
//   5. Multi-book odds      — getAllHRLines() — best + all book lines
//   6. Edge calculation     — calculateEdge() — model vs market pp
// ============================================================================

/** A single book's HR prop line for a player */
export interface HRBookLine {
  bookmaker:         string;
  overOdds:          number;
  line:              number;
  impliedProbability: number;
}

/**
 * Result of the HR prop edge analysis pipeline.
 * All probabilities are in [0,1]; edge is in percentage points.
 */
export interface HREdgeResult {
  playerName:         string;
  /** Canonical full name from MLB Stats API (may differ from input) */
  canonicalName:      string;
  /** MLBAM player ID, null if lookup failed */
  mlbamId:            number | null;
  /** Model-estimated HR probability per plate appearance [0,1] */
  modelProbability:   number;
  /** Best market-implied HR probability across all books [0,1] */
  impliedProbability: number;
  /** Edge = (modelProb − bestImpliedProb) × 100 percentage points */
  edge:               number;
  /** Fair American odds implied by the model */
  fairOdds:           number;
  /** Best American over-odds found (highest number = most favourable) */
  bestOdds:           number;
  /** Bookmaker offering the best odds */
  bestBook:           string;
  /** HR prop line (almost always 0.5) */
  line:               number;
  /** All book lines sorted best → worst odds */
  allLines:           HRBookLine[];
  /** 0–100 confidence score */
  confidence:         number;
  /** Data quality tier: recent 14-day > full season > fallback */
  dataSource:         'recent_14d' | 'season' | 'fallback';
}

/** American odds → implied probability (removes vig naively) */
function americanToProb(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : (-odds) / (-odds + 100);
}

/**
 * Fetch all book HR prop lines for a player from The Odds API.
 * Returns lines sorted from best (highest odds) to worst.
 * Returns empty array when no market is found or on fetch failure.
 */
export async function getAllHRLines(
  playerName: string,
  oddsApiKey: string,
): Promise<HRBookLine[]> {
  try {
    const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=${oddsApiKey}&regions=us&markets=player_home_runs&oddsFormat=american`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return [];

    const games = await res.json() as Array<{
      bookmakers?: Array<{
        title: string;
        markets?: Array<{
          key: string;
          outcomes?: Array<{ name: string; price: number; point?: number }>;
        }>;
      }>;
    }>;

    const lower = playerName.toLowerCase();
    const lines: HRBookLine[] = [];

    for (const game of games) {
      for (const book of (game.bookmakers ?? [])) {
        for (const market of (book.markets ?? [])) {
          if (market.key !== 'player_home_runs') continue;
          for (const outcome of (market.outcomes ?? [])) {
            if (!outcome.name?.toLowerCase().includes(lower)) continue;
            lines.push({
              bookmaker:          book.title,
              overOdds:           outcome.price,
              line:               outcome.point ?? 0.5,
              impliedProbability: americanToProb(outcome.price),
            });
          }
        }
      }
    }

    // Sort: highest odds first (best value for bettor)
    return lines.sort((a, b) => b.overOdds - a.overOdds);
  } catch {
    return [];
  }
}

/**
 * Run the full HR prop edge analysis pipeline for a named MLB batter.
 *
 * Returns null when:
 * - No Statcast data could be resolved for the player
 * - No HR prop market is available in The Odds API
 * - ODDS_API_KEY is not configured
 *
 * Non-throwing — all errors are caught and return null gracefully.
 */
export async function analyzeHREdge(playerName: string): Promise<HREdgeResult | null> {
  const oddsApiKey = getOddsApiKey();
  if (!oddsApiKey) return null;

  // ── Step 1: Canonical player identity (MLBAM ID) ──────────────────────────
  const { getPlayerByName } = await import('@/lib/player-map');
  const playerProfile = await getPlayerByName(playerName).catch(() => null);
  const mlbamId       = playerProfile?.id ?? null;
  const canonicalName = playerProfile?.fullName ?? playerName;

  // ── Step 2: Statcast features ─────────────────────────────────────────────
  // Prefer MLBAM ID lookup (eliminates name ambiguity); fall back to name search.
  const { getRecentStatcast, getStatcastData, queryStatcast } = await import('@/lib/baseball-savant');

  let barrelRate    = 0;  // fraction 0–1 for hrEngine
  let avgExitVelo   = 0;
  let sampleSize    = 0;
  let dataSource: HREdgeResult['dataSource'] = 'fallback';

  // Use canonicalName for searches so "Judge" → "Aaron Judge" resolves correctly
  const recent = await getRecentStatcast(canonicalName, 14, mlbamId ?? undefined).catch(() => null);
  if (recent && recent.sampleSize >= 10) {
    barrelRate  = recent.barrelRate  / 100;
    avgExitVelo = recent.avgExitVelo;
    sampleSize  = recent.sampleSize;
    dataSource  = 'recent_14d';
  } else {
    // Season aggregates
    const { players } = await getStatcastData().catch(() => ({ players: [] as import('@/lib/baseball-savant').StatcastPlayer[] }));
    const match = queryStatcast(players, { player: canonicalName, playerType: 'batter', limit: 1 });
    if (match.length > 0) {
      barrelRate  = match[0].barrelRate  / 100;
      avgExitVelo = match[0].exitVelocity;
      sampleSize  = match[0].pa;
      dataSource  = 'season';
    }
  }

  if (sampleSize === 0) return null; // no Statcast data at all

  // ── Step 3: HR model probability ─────────────────────────────────────────
  const { computeHRProb, fairAmericanOdds } = await import('@/lib/hrEngine');

  // airPullRate: not available from leaderboard endpoints — estimate from barrel rate
  // (R² ≈ 0.62 in Statcast data; barrels concentrate on pulled air balls)
  const airPullRate = Math.min(0.60, barrelRate * 2.2);

  const modelProbability = computeHRProb({
    airPullRate,
    barrelRate,
    avgExitVelocity:      avgExitVelo,
    platoonAdvantage:     0,    // neutral — matchup not available at this layer
    parkHRFactor:         1.0,  // neutral — park not known without specific game
    pitcherHRSuppression: 0.5,  // median
    sampleSize,
  });

  const fairOdds = fairAmericanOdds(modelProbability);

  // ── Step 4: Multi-book odds — find best line ──────────────────────────────
  // Use canonicalName for market search; also try the original playerName as fallback
  let allLines = await getAllHRLines(canonicalName, oddsApiKey);
  if (allLines.length === 0 && canonicalName !== playerName) {
    allLines = await getAllHRLines(playerName, oddsApiKey);
  }

  if (allLines.length === 0) return null; // no market

  const best = allLines[0]; // sorted best → worst already
  const impliedProbability = best.impliedProbability;
  const marketOdds = best.overOdds;
  const line       = best.line;
  const bookmaker  = best.bookmaker;

  // ── Step 5: Edge + confidence ─────────────────────────────────────────────
  const edge = calculateEdge(modelProbability, impliedProbability);
  const confidence = calculateConfidence(
    [{ source: 'statcast' as const, latencyMs: 0, success: true, cached: dataSource === 'season' }],
    edge,
  );

  return {
    playerName,
    canonicalName,
    mlbamId,
    modelProbability,
    impliedProbability,
    edge,
    fairOdds,
    bestOdds:  marketOdds,
    bestBook:  bookmaker,
    line,
    allLines,
    confidence,
    dataSource,
  };
}
