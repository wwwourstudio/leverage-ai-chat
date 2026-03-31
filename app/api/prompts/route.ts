import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { getGrokApiKey, getOddsApiKey } from '@/lib/config';
import { AI_CONFIG } from '@/lib/constants';

// ── In-memory cache (10-minute TTL) ─────────────────────────────────────────

interface CacheEntry {
  prompts: Array<{ label: string; query: string }>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): Array<{ label: string; query: string }> | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.prompts;
}

function setCached(key: string, prompts: Array<{ label: string; query: string }>): void {
  cache.set(key, { prompts, expiresAt: Date.now() + 10 * 60 * 1000 });
}

// ── Sport key mapping (user-facing → Odds API) ───────────────────────────────

const SPORT_API_MAP: Record<string, string> = {
  mlb: 'baseball_mlb',
  nba: 'basketball_nba',
  nfl: 'americanfootball_nfl',
  nhl: 'icehockey_nhl',
  ncaa: 'americanfootball_ncaaf',
  'ncaa-football': 'americanfootball_ncaaf',
  'ncaa-basketball': 'basketball_ncaab',
};

function getDefaultApiSport(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 10) return 'baseball_mlb';
  if (month >= 9 || month <= 2) return 'americanfootball_nfl';
  return 'basketball_nba';
}

/** Fetch today's real scheduled games from the Odds API (max 3s) */
async function fetchTodaysGames(sport: string): Promise<string[]> {
  const oddsKey = getOddsApiKey();
  if (!oddsKey) return [];

  const sportKey = SPORT_API_MAP[sport.toLowerCase()] ?? getDefaultApiSport();
  const cutoff = Date.now() + 48 * 60 * 60 * 1000;

  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${oddsKey}&dateFormat=iso`,
      { signal: AbortSignal.timeout(3000) },
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

// ── Static fallback prompts (returned instantly on cold cache) ────────────────
// These are action-oriented and never reference specific team matchups,
// so they're safe to show even when no live schedule is available.

const STATIC_FALLBACKS: Record<string, Array<{ label: string; query: string }>> = {
  betting: [
    { label: 'Best line value today', query: 'Which games today have the best line value and where is sharp money pointing?' },
    { label: 'Fade public picks', query: 'Which teams are heavily bet by the public but have weak value according to the closing line?' },
    { label: 'Over/under edges', query: 'What totals are best to target today based on pace stats and weather?' },
    { label: 'Live line movement', query: 'Which lines have moved the most in the last 24 hours and what is driving the move?' },
    { label: 'Parlay value picks', query: "Build a 3-leg parlay with positive EV based on today's schedule and closing line value." },
  ],
  dfs: [
    { label: 'Top value plays', query: "Who are the best value plays under $6,000 for today's main DFS slate?" },
    { label: 'Optimal GPP stack', query: "What is the best 3-player stack for a GPP tournament on today's slate?" },
    { label: 'Cash game lineup', query: "Build a safe cash game lineup for today's DFS slate with high floors." },
    { label: 'Contrarian pivots', query: 'Who are the best contrarian plays to differentiate a GPP lineup today?' },
    { label: 'Pitcher targets', query: 'Which starting pitchers offer the best strikeout upside at affordable salary today?' },
  ],
  fantasy: [
    { label: 'Start/sit decisions', query: 'Who are the best start/sit decisions for this week based on matchups and recent usage?' },
    { label: 'Waiver wire adds', query: 'Who should I pick up off waivers this week based on upcoming schedule and injury reports?' },
    { label: 'Trade value targets', query: 'Which players have the best buy-low trade value right now based on recent performance vs. targets?' },
    { label: 'Breakout candidates', query: 'Which players are showing breakout indicators in Statcast or advanced metrics this season?' },
    { label: 'Streaming options', query: "Who are the best streaming options at each position for this week's schedule?" },
  ],
  mlb: [
    { label: 'Statcast edge plays', query: "Which MLB hitters have the best barrel rate and hard-hit data vs. today's pitching matchups?" },
    { label: 'Pitcher strikeout props', query: "Which starting pitchers have the best strikeout upside versus tonight's opponent?" },
    { label: 'Run line value', query: "Which run lines offer the best value on today's MLB slate based on lineup and bullpen strength?" },
    { label: 'Park factor targets', query: 'Which games tonight are in the most hitter-friendly parks and which stacks benefit most?' },
    { label: 'NRFI or YRFI', query: 'Which games tonight are best for a NRFI or YRFI bet based on pitching and first-inning stats?' },
  ],
  nfl: [
    { label: 'ADP value targets', query: 'Which skill players are going significantly later than their projected production in 2026 NFBC ADP?' },
    { label: 'Futures value', query: 'Which team futures (Super Bowl odds, division winner) offer the best value heading into the 2026 season?' },
    { label: 'Sleeper RBs', query: 'Which RBs are undervalued in current ADP due to backfield competition resolving in their favor?' },
    { label: 'Dynasty targets', query: 'Which dynasty prospects should I target in the 2026 offseason based on opportunity and age curve?' },
    { label: 'Free agency impact', query: 'How do recent free agency signings change fantasy and betting values for the 2026 season?' },
  ],
  nba: [
    { label: 'Prop value plays', query: 'Which NBA player props offer the best value tonight based on recent usage trends and matchup data?' },
    { label: 'Pace-up matchups', query: 'Which games tonight have the highest projected pace and which players benefit most?' },
    { label: 'Back-to-back fades', query: 'Which teams on a back-to-back tonight are best to fade against the spread?' },
    { label: 'Points total edge', query: 'Which game totals are best to target tonight based on defensive ratings and pace?' },
    { label: 'Assist prop targets', query: 'Which point guards have the highest floor for assist totals tonight based on injury reports?' },
  ],
  nhl: [
    { label: 'Goalie prop plays', query: "Which goalies have the best save prop value tonight based on opponent shot quality?" },
    { label: 'Power play units', query: 'Which teams have the strongest power play matchups tonight for scoring prop targets?' },
    { label: 'Game total value', query: 'Which NHL totals offer the best over/under value tonight based on goalie matchups?' },
    { label: 'Puck line targets', query: 'Which puck lines offer the best value on the road favorite or home underdog tonight?' },
    { label: 'Anytime goal scorers', query: 'Who are the best value anytime goal scorer props tonight based on shooting percentage trends?' },
  ],
};

function getStaticFallback(category: string, sport: string): Array<{ label: string; query: string }> {
  if (sport && STATIC_FALLBACKS[sport.toLowerCase()]) return STATIC_FALLBACKS[sport.toLowerCase()];
  if (STATIC_FALLBACKS[category]) return STATIC_FALLBACKS[category];
  return STATIC_FALLBACKS.betting;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const AI_TIMEOUT_MS = 7000;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get('category') || 'all';
  const sport = searchParams.get('sport') || '';

  const cacheKey = `${category}:${sport}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, prompts: cached, cached: true });
  }

  const apiKey = getGrokApiKey();
  if (!apiKey) {
    return NextResponse.json({ success: true, prompts: getStaticFallback(category, sport), cached: false, source: 'static' });
  }

  // Fetch real today's schedule (max 3s) before constructing the AI prompt
  const gamesRace = Promise.race([
    fetchTodaysGames(sport || category),
    new Promise<string[]>(resolve => setTimeout(() => resolve([]), 3000)),
  ]);
  const games = await gamesRace;

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const sportLabel = sport ? sport.toUpperCase() : 'any sport';
  const categoryLabel = category === 'all' ? 'sports betting and fantasy' : category === 'dfs' ? 'Daily Fantasy Sports (DFS)' : category;

  const scheduleText = games.length > 0
    ? `Today's confirmed scheduled games:\n${games.map(g => `- ${g}`).join('\n')}`
    : 'No confirmed game schedule available for today.';

  const systemPrompt = `You generate quick-action prompt suggestions for a sports AI chat application called Leverage AI. Your suggestions must be specific, timely, and directly useful to bettors and fantasy players. Only reference teams and matchups from the provided game schedule — never invent or hallucinate matchups that are not on the list. If no schedule is provided, generate action-oriented prompts without specific team names. Return ONLY valid JSON with no markdown.`;

  const userPrompt = `Today is ${today}. The user is in the "${categoryLabel}" section${sport ? `, focused on ${sportLabel}` : ''}.

${scheduleText}

Generate exactly 5 suggested questions that a serious sports bettor or fantasy player would want to ask right now. Make them specific and action-oriented. For DFS, include lineup-building angles. For fantasy, include waiver wire and start/sit decisions. For betting, include line value, sharp money, and player prop angles.${games.length > 0 ? ' Reference specific games or teams from the schedule above where relevant.' : ' Since no schedule is confirmed, focus on analysis strategies without naming specific matchups.'}

Return a JSON array of 5 objects: [{"label": "Short label (3-5 words)", "query": "Full question the user wants answered (1-2 sentences, specific and actionable)"}]`;

  const aiPromise = generateText({
    model: createXai({ apiKey })(AI_CONFIG.MODEL_NAME),
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: 600,
    temperature: 0.7,
  }).then(({ text }) => {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;
    const parsed: Array<{ label: string; query: string }> = JSON.parse(jsonMatch[0]);
    const valid = Array.isArray(parsed) && parsed.every(p => typeof p.label === 'string' && typeof p.query === 'string');
    return valid ? parsed : null;
  }).catch(() => null);

  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), AI_TIMEOUT_MS));
  const aiResult = await Promise.race([aiPromise, timeout]);

  if (aiResult) {
    setCached(cacheKey, aiResult);
    return NextResponse.json({ success: true, prompts: aiResult, gamesFound: games.length });
  }

  // AI was slow or failed — return static prompts, let AI warm cache in background
  const staticPrompts = getStaticFallback(category, sport);
  aiPromise.then(result => {
    if (result) setCached(cacheKey, result);
  }).catch(() => {});

  console.log(`[v0] [prompts] AI timeout (>${AI_TIMEOUT_MS}ms) — serving static fallback for ${cacheKey}`);
  return NextResponse.json({ success: true, prompts: staticPrompts, cached: false, source: 'static' });
}
