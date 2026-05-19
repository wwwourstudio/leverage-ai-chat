import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { getGrokApiKey, getOddsApiKey } from '@/lib/config';
import { AI_CONFIG, SPORT_KEYS } from '@/lib/constants';
import { getDefaultSport } from '@/lib/utils/index';
import { cacheGet, cacheSet, bucket } from '@/lib/cache/redis-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// ── Types ────────────────────────────────────────────────────────────────────

type Prompt = { label: string; query: string };

// ── Redis / in-memory cache ───────────────────────────────────────────────────
// Key pattern: prompts:v1:{category}:{sport}:{15min-bucket}
// Three caching layers:
//   1. CDN   — s-maxage=60, swr=840 (only on AI-generated responses)
//   2. Redis — 15-min TTL (shared across all instances + deploys)
//   3. Memory— per-instance Map via redis-cache.ts fallback

const BUCKET_MS   = 15 * 60 * 1_000; // 15-minute cache window
const REDIS_TTL_S = 14 * 60;          // 14 min (slightly under bucket width)

function redisKey(category: string, sport: string): string {
  return `prompts:v1:${category}:${sport}:${bucket(BUCKET_MS)}`;
}

// ── In-request warm-lock (prevents duplicate background AI calls per instance) -

const _warming = new Set<string>();

// ── Sport key mapping ────────────────────────────────────────────────────────

const SPORT_API_MAP: Record<string, string> = Object.fromEntries([
  ...Object.values(SPORT_KEYS).map(s => [s.SHORT, s.API] as [string, string]),
  ['ncaa', SPORT_KEYS.NCAAF.API],
  ['ncaa-football', SPORT_KEYS.NCAAF.API],
  ['ncaa-basketball', SPORT_KEYS.NCAAB.API],
]);

// ── Schedule fetch ───────────────────────────────────────────────────────────

async function fetchTodaysGames(sport: string): Promise<string[]> {
  const oddsKey = getOddsApiKey();
  if (!oddsKey) return [];
  const sportKey = SPORT_API_MAP[sport.toLowerCase()] ?? getDefaultSport();
  const cutoff   = Date.now() + 48 * 60 * 60 * 1_000;
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${oddsKey}&dateFormat=iso`,
      { signal: AbortSignal.timeout(3_000) },
    );
    if (!res.ok) return [];
    const events: Array<{ home_team: string; away_team: string; commence_time: string }> = await res.json();
    if (!Array.isArray(events)) return [];
    return events
      .filter(e => new Date(e.commence_time).getTime() <= cutoff)
      .slice(0, 8)
      .map(e => `${e.away_team} @ ${e.home_team}`);
  } catch {
    return [];
  }
}

// ── AI prompt generator ──────────────────────────────────────────────────────

async function generateAIPrompts(
  apiKey: string,
  category: string,
  sport: string,
  games: string[],
): Promise<Prompt[] | null> {
  const today         = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const sportLabel    = sport ? sport.toUpperCase() : 'any sport';
  const categoryLabel = category === 'all'  ? 'sports betting and fantasy'
                      : category === 'dfs'  ? 'Daily Fantasy Sports (DFS)'
                      : category;
  const scheduleText  = games.length > 0
    ? `Today's confirmed scheduled games:\n${games.map(g => `- ${g}`).join('\n')}`
    : 'No confirmed game schedule available for today.';

  try {
    const { text } = await generateText({
      model:           createXai({ apiKey })(AI_CONFIG.FAST_MODEL_NAME),
      maxOutputTokens: 400,
      temperature:     0.7,
      system: `You generate quick-action prompt suggestions for a sports AI chat application called Leverage AI. Your suggestions must be specific, timely, and directly useful to bettors and fantasy players. Only reference teams and matchups from the provided game schedule — never invent or hallucinate matchups. If no schedule is provided, generate action-oriented prompts without specific team names. Return ONLY valid JSON with no markdown.`,
      prompt: `Today is ${today}. The user is in the "${categoryLabel}" section${sport ? `, focused on ${sportLabel}` : ''}.

${scheduleText}

Generate exactly 5 suggested questions that a serious sports bettor or fantasy player would want to ask right now. Make them specific and action-oriented.${games.length > 0 ? ' Reference specific games or teams from the schedule above where relevant.' : ''}

Return a JSON array of 5 objects: [{"label": "Short label (3-5 words)", "query": "Full question (1-2 sentences, specific and actionable)"}]`,
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed: Prompt[] = JSON.parse(match[0]);
    const valid = Array.isArray(parsed) && parsed.length > 0 &&
      parsed.every(p => typeof p.label === 'string' && typeof p.query === 'string');
    return valid ? parsed : null;
  } catch {
    return null;
  }
}

// ── Background cache warm ─────────────────────────────────────────────────────

async function warmCache(rKey: string, category: string, sport: string): Promise<void> {
  if (_warming.has(rKey)) return;
  _warming.add(rKey);
  try {
    const apiKey = getGrokApiKey();
    if (!apiKey) return;
    const games  = await fetchTodaysGames(sport || category).catch(() => [] as string[]);
    const result = await generateAIPrompts(apiKey, category, sport, games);
    if (result?.length) {
      await cacheSet(rKey, result, REDIS_TTL_S);
      console.log(`[prompts] Warmed cache for ${rKey} (${result.length} prompts, ${games.length} games)`);
    }
  } catch (e) {
    console.warn('[prompts] Cache warm failed:', e instanceof Error ? e.message : e);
  } finally {
    _warming.delete(rKey);
  }
}

// ── Static fallbacks ──────────────────────────────────────────────────────────

const STATIC_FALLBACKS: Record<string, Prompt[]> = {
  betting: [
    { label: 'Best line value today',  query: 'Which games today have the best line value and where is sharp money pointing?' },
    { label: 'Fade public picks',       query: 'Which teams are heavily bet by the public but have weak value according to the closing line?' },
    { label: 'Over/under edges',        query: 'What totals are best to target today based on pace stats and weather?' },
    { label: 'Live line movement',      query: 'Which lines have moved the most in the last 24 hours and what is driving the move?' },
    { label: 'Parlay value picks',      query: "Build a 3-leg parlay with positive EV based on today's schedule and closing line value." },
  ],
  dfs: [
    { label: 'Top value plays',         query: "Who are the best value plays under $6,000 for today's main DFS slate?" },
    { label: 'Optimal GPP stack',       query: "What is the best 3-player stack for a GPP tournament on today's slate?" },
    { label: 'Cash game lineup',        query: "Build a safe cash game lineup for today's DFS slate with high floors." },
    { label: 'Contrarian pivots',       query: 'Who are the best contrarian plays to differentiate a GPP lineup today?' },
    { label: 'Pitcher targets',         query: 'Which starting pitchers offer the best strikeout upside at affordable salary today?' },
  ],
  fantasy: [
    { label: 'Start/sit decisions',     query: 'Who are the best start/sit decisions for this week based on matchups and recent usage?' },
    { label: 'Waiver wire adds',        query: 'Who should I pick up off waivers this week based on upcoming schedule and injury reports?' },
    { label: 'Trade value targets',     query: 'Which players have the best buy-low trade value right now based on recent performance vs. targets?' },
    { label: 'Breakout candidates',     query: 'Which players are showing breakout indicators in Statcast or advanced metrics this season?' },
    { label: 'Streaming options',       query: "Who are the best streaming options at each position for this week's schedule?" },
  ],
  mlb: [
    { label: 'Statcast edge plays',     query: "Which MLB hitters have the best barrel rate and hard-hit data vs. today's pitching matchups?" },
    { label: 'Pitcher strikeout props', query: "Which starting pitchers have the best strikeout upside versus tonight's opponent?" },
    { label: 'Run line value',          query: "Which run lines offer the best value on today's MLB slate based on lineup and bullpen strength?" },
    { label: 'Park factor targets',     query: 'Which games tonight are in the most hitter-friendly parks and which stacks benefit most?' },
    { label: 'NRFI or YRFI',           query: 'Which games tonight are best for a NRFI or YRFI bet based on pitching and first-inning stats?' },
  ],
  nfl: [
    { label: 'ADP value targets',       query: 'Which skill players are going significantly later than their projected production in 2026 NFBC ADP?' },
    { label: 'Futures value',           query: 'Which team futures (Super Bowl odds, division winner) offer the best value heading into the 2026 season?' },
    { label: 'Sleeper RBs',             query: 'Which RBs are undervalued in current ADP due to backfield competition resolving in their favor?' },
    { label: 'Dynasty targets',         query: 'Which dynasty prospects should I target in the 2026 offseason based on opportunity and age curve?' },
    { label: 'Free agency impact',      query: 'How do recent free agency signings change fantasy and betting values for the 2026 season?' },
  ],
  nba: [
    { label: 'Prop value plays',        query: 'Which NBA player props offer the best value tonight based on recent usage trends and matchup data?' },
    { label: 'Pace-up matchups',        query: 'Which games tonight have the highest projected pace and which players benefit most?' },
    { label: 'Back-to-back fades',      query: 'Which teams on a back-to-back tonight are best to fade against the spread?' },
    { label: 'Points total edge',       query: 'Which game totals are best to target tonight based on defensive ratings and pace?' },
    { label: 'Assist prop targets',     query: 'Which point guards have the highest floor for assist totals tonight based on injury reports?' },
  ],
  nhl: [
    { label: 'Goalie prop plays',       query: "Which goalies have the best save prop value tonight based on opponent shot quality?" },
    { label: 'Power play units',        query: 'Which teams have the strongest power play matchups tonight for scoring prop targets?' },
    { label: 'Game total value',        query: 'Which NHL totals offer the best over/under value tonight based on goalie matchups?' },
    { label: 'Puck line targets',       query: 'Which puck lines offer the best value on the road favorite or home underdog tonight?' },
    { label: 'Anytime goal scorers',    query: 'Who are the best value anytime goal scorer props tonight based on shooting percentage trends?' },
  ],
};

function getStaticFallback(category: string, sport: string): Prompt[] {
  if (sport && STATIC_FALLBACKS[sport.toLowerCase()]) return STATIC_FALLBACKS[sport.toLowerCase()];
  if (STATIC_FALLBACKS[category]) return STATIC_FALLBACKS[category];
  return STATIC_FALLBACKS.betting;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get('category') || 'all';
  const sport    = searchParams.get('sport')    || '';
  const rKey     = redisKey(category, sport);

  // ── Layer 1: Redis (shared across all instances) ───────────────────────────
  try {
    const hit = await cacheGet<Prompt[]>(rKey);
    if (hit?.length) {
      return NextResponse.json(
        { success: true, prompts: hit, cached: true, source: 'redis' },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=840' } },
      );
    }
  } catch {
    // Redis unavailable — continue
  }

  // ── Layer 2 + 3: Return static immediately, warm Redis in background ───────
  // The first response on a cold cache is always instant (static fallback).
  // The background warm populates Redis so every subsequent request is fast.
  void warmCache(rKey, category, sport);

  return NextResponse.json({
    success: true,
    prompts: getStaticFallback(category, sport),
    cached:  false,
    source:  'static',
  });
}
