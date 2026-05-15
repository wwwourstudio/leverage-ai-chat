/**
 * Sport and intent detection for the /api/analyze pipeline.
 *
 * Runs multi-layer detection against the raw query text and mutates
 * context.sport / context.isPoliticalMarket as a side effect (preserving the
 * existing behaviour). Returns a fully-typed SportDetectionResult that all
 * downstream pipeline stages can consume without re-deriving signals.
 */

import { PLAYER_SPORT_MAP, STAT_SPORT_MAP, NFBC_DRAFT_YEAR, NFL_SEASON_YEAR } from '@/lib/constants';
import type { AnalyzeContext, SportDetectionResult } from './types';

// ── Prediction market / political detection constants ─────────────────────────
// Used by Layer -2 sport detection — checked FIRST before any sports signals.
// Prevents stale client sport context (e.g. 'nfl') from poisoning Kalshi queries.
export const MARKET_SIGNALS = [
  'kalshi', 'polymarket', 'prediction market', 'prediction markets',
  'senate', 'senate seat', 'congress', 'house seat', 'governor',
  'election market', 'ballot', 'referendum',
  'fed rate', 'federal reserve', 'interest rate cut', 'fomc',
  'recession', 'gdp growth', 'inflation rate',
  'yes/no market', 'contract price', 'implied probability',
  'political market', 'event contract', 'will trump', 'will biden',
  'will democrats', 'will republicans',
];

// ── MLB parenthetical detection constants ─────────────────────────────────────
// Used by Layer -1 sport detection to parse patterns like "Juan Soto (NYM OF)"
export const MLB_TEAM_ABBREVS = new Set([
  'NYM','NYY','BOS','LAD','SFG','SF','CHC','CHW','HOU','ATL',
  'PHI','MIL','STL','ARI','SD','SDP','COL','CIN','PIT','MIA',
  'MIN','CLE','DET','KC','KCR','TEX','OAK','ATH','SEA',
  'TB','TBR','BAL','TOR','LAA','WSH','WSN',
]);

export const MLB_POSITION_ABBREVS = new Set([
  'OF','SP','RP','CP','1B','2B','3B','SS','DH','LF','CF','RF','C',
]);

export const MLB_FORCE_TERMS = [
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

// ── Team-name → sport inference ───────────────────────────────────────────────
// When context.sport is absent or 'none', scan the user message for known
// team nicknames and infer the sport.
export const TEAM_TO_SPORT: Record<string, string> = {
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

export const START_SIT_KEYWORDS = [
  'start/sit', 'start or sit', 'sit or start', 'who should i start',
  'who do i start', 'should i start', 'should i sit', 'matchup-based',
  'matchup based', 'streaming', 'stream this week', 'stream today',
  'must start', 'must sit', 'favorable matchup', 'tough matchup',
];

export const HR_PREDICTION_KEYWORDS = [
  'will he hit', 'will he homer', 'chance of', 'probability of',
  'hr tonight', 'homer tonight', 'home run tonight',
  'hit a hr', 'hit a homer', 'hit a home run',
  'odds of hitting', 'predict his hr', 'predict hr',
  'what are the odds', 'hr prediction', 'home run prediction',
  'hr probability', 'home run probability',
];

export const KALSHI_TOOL_KEYWORDS = [
  'kalshi market', 'prediction market', 'kalshi price', 'kalshi odds',
  'what\'s the price on', 'current price on', 'market price for',
  'show kalshi', 'list kalshi', 'kalshi election', 'kalshi trump',
  'yes price', 'no price', 'yes/no price', 'edge on yes', 'edge on no',
  'championship winner', 'contract pricing', 'championship contract',
  'winner contract', 'market contract', 'implied odds',
];

export const MLB_PROJECTION_KEYWORDS = [
  'dfs', 'daily fantasy', 'draftkings lineup', 'fanduel lineup',
  'salary', 'stack', 'lineup',
  'waiver', 'ros', 'rest of season',
  'projection', 'project', 'breakout', 'monte carlo',
  'forecast', 'pace', 'park factor',
  'hr prop', 'k prop', 'strikeout prop',
];

const LINE_MOVEMENT_KEYWORDS = [
  'line movement', 'line move', 'line moves', 'steam move', 'steam',
  'sharp money', 'sharp action', 'sharp bet', 'sharps', 'movers',
  'reverse line movement', 'rlm', 'public money', 'biggest mover',
];

const PROPS_KEYWORDS = [
  'best props', 'prop picks', 'top props', 'player props', 'prop bets',
  'player prop', 'best bets props', 'prop value', 'favorite prop',
  'pitcher props', 'pitcher prop', 'batter props', 'batter prop',
  'strikeout prop', 'hr prop', 'k prop', 'hits prop', 'rbi prop',
];

const PROPS_KEYWORDS_EARLY = [
  'props', 'player prop', 'player props', 'prop bet', 'prop bets',
  'strikeout prop', 'hr prop', 'anytime td', 'receptions prop',
  'points prop', 'assists prop', 'hits prop', 'rbi prop', 'k prop',
  'over/under prop', 'player over', 'player under',
];

/**
 * Detect sport and intent signals from the query text.
 *
 * Side effects:
 *   - Mutates context.sport when a clearer sport is inferred from text.
 *   - Mutates context.isPoliticalMarket when a prediction-market signal is found.
 *   - Mutates context.oddsData to undefined when sport ≠ oddsData.sport (cross-sport guard).
 *
 * @param userMessage  Raw user message (may include file blocks, fantasy context prefix)
 * @param context      Mutable context object from the client
 * @param msgLower     userMessage.toLowerCase() — pre-computed by the caller
 * @param rawQueryLower  msgLower stripped of the "[Fantasy League Context: …]\n\n" prefix
 */
export function detectSportAndIntents(
  userMessage: string,
  context: AnalyzeContext,
  msgLower: string,
  rawQueryLower: string,
): SportDetectionResult {
  // ── ADP intent ───────────────────────────────────────────────────────────────
  // Declared early — used by sport-detection layer 0 and later intent routing.
  const hasADPIntent =
    ['adp', 'nfbc', 'nffc', 'average draft', 'draft position', 'draft rank', 'draft order', 'nfbc board', 'nffc board']
      .some(k => rawQueryLower.includes(k));

  // context.sport is a HINT from the client. Always run all detection layers
  // against the query text; if they produce a different sport the query text wins.
  let inferredSport = context?.sport && context.sport !== 'none' ? context.sport : undefined;
  let detectedSport: string | undefined;

  // Layer -2: Prediction markets / political detection (absolute highest priority)
  if (MARKET_SIGNALS.some(signal => msgLower.includes(signal))) {
    detectedSport = 'markets';
    console.log('[API/analyze] Detected category: prediction_markets (Layer -2)');
  }

  // Layer -1: Parenthetical MLB team/position abbreviation detection
  // Catches patterns like "Juan Soto (NYM OF)", "Gerrit Cole (NYY SP)"
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

  // Layer 0: MLB force-lock — highest priority among sports
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

  // Layer 3: sport-specific statistical vocabulary
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
  // 'markets' is a virtual sport — flag as political market and clear stale sport.
  if (inferredSport === 'markets') {
    context.isPoliticalMarket = true;
    context.sport = undefined;
    console.log('[API/analyze] Routing to Kalshi pipeline (sport=markets → isPoliticalMarket=true)');
  } else if (inferredSport) {
    context.sport = inferredSport;
  }

  // ADP queries with no explicit sport default to MLB
  if (hasADPIntent && !context.sport) {
    context.sport = 'mlb';
    console.log('[API/analyze] ADP intent with no sport — defaulting to MLB');
  }

  // DFS with no explicit sport defaults to NBA
  if (context.selectedCategory === 'dfs' && !context.sport) {
    context.sport = 'basketball_nba';
    console.log('[API/analyze] DFS with no sport — defaulting to NBA');
  }

  // ── Cross-sport contamination guard ──────────────────────────────────────────
  // Clear stale oddsData when the detected sport doesn't match.
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

  const isMLBQuery = context?.sport === 'mlb';

  // Start/sit intent
  const hasStartSitIntent = START_SIT_KEYWORDS.some(k => rawQueryLower.includes(k));

  // Statcast JSON mode — only for player-specific or non-betting MLB queries
  const isMLBStatcastMode =
    isMLBQuery &&
    !hasADPIntent &&
    !hasStartSitIntent &&
    !context?.hasPlayerIntent &&
    (!context?.hasBettingIntent || !!context?.hasPlayerIntent) &&
    !(!!context?.hasFantasyIntent && !context?.hasPlayerIntent);

  // HR Prediction intent
  const hasHRPredictionIntent =
    isMLBQuery &&
    !hasADPIntent &&
    !hasStartSitIntent &&
    HR_PREDICTION_KEYWORDS.some(k => rawQueryLower.includes(k)) &&
    (rawQueryLower.includes('hr') || rawQueryLower.includes('homer') || rawQueryLower.includes('home run'));

  // Kalshi tool intent
  const hasKalshiToolIntent =
    (context?.isPoliticalMarket || context?.selectedCategory === 'kalshi') &&
    KALSHI_TOOL_KEYWORDS.some(k => rawQueryLower.includes(k));

  // MLB Projection Engine intent
  const hasMLBProjectionIntent =
    isMLBQuery &&
    !hasADPIntent &&
    !hasStartSitIntent &&
    MLB_PROJECTION_KEYWORDS.some(k => rawQueryLower.includes(k));

  // expectsStatcastJSON: true only when MLB_ANALYSIS_ADDENDUM is the active prompt
  const expectsStatcastJSON = isMLBStatcastMode && !hasMLBProjectionIntent;

  // ── Category derivation ───────────────────────────────────────────────────────
  const hasPropsIntentEarly = PROPS_KEYWORDS_EARLY.some(k => rawQueryLower.includes(k));
  const hasKellyIntentEarly =
    rawQueryLower.includes('kelly') ||
    rawQueryLower.includes('bet sizing') ||
    rawQueryLower.includes('kelly criterion') ||
    rawQueryLower.includes('bankroll management') ||
    rawQueryLower.includes('optimal stake') ||
    rawQueryLower.includes('fractional kelly');

  const category = context.isPoliticalMarket
    ? 'kalshi'
    : context.selectedCategory === 'dfs'
      ? 'dfs'
      : hasKellyIntentEarly
        ? 'kelly'
        : hasPropsIntentEarly
          ? 'props'
          : context.hasPlayerIntent
            ? 'player'
            : context.hasFantasyIntent && !context.hasBettingIntent
              ? 'fantasy'
              : (context.hasBettingIntent || context.isSportsQuery)
                ? 'betting'
                : 'all';

  // ── Ambiguity detection ───────────────────────────────────────────────────────
  const isAmbiguous = !context?.sport
    && !context?.isSportsQuery
    && !context?.hasFantasyIntent
    && !context?.isPoliticalMarket
    && !context?.hasBettingIntent
    && context?.selectedCategory !== 'kalshi'
    // customInstructions check omitted here — caller adds it as an additional guard
    ;

  const needsFantasySport = !!(context?.hasFantasyIntent && !context?.sport
    && context?.selectedCategory === 'fantasy' && !context?.isPoliticalMarket);
  const needsDFSSport = !!(context?.selectedCategory === 'dfs' && !context?.sport);
  const needsBettingSport = !!(context?.hasBettingIntent && !context?.sport
    && !context?.isPoliticalMarket && context?.selectedCategory === 'betting');

  const hasLineMovementIntent = LINE_MOVEMENT_KEYWORDS.some(k => rawQueryLower.includes(k));
  const hasPropsToolIntent = PROPS_KEYWORDS.some(k => rawQueryLower.includes(k));

  return {
    inferredSport,
    isMLBQuery,
    hasADPIntent,
    hasStartSitIntent,
    hasMLBProjectionIntent,
    hasHRPredictionIntent,
    hasKalshiToolIntent,
    isMLBStatcastMode,
    expectsStatcastJSON,
    category,
    isAmbiguous,
    needsFantasySport,
    needsDFSSport,
    needsBettingSport,
    hasPropsIntentEarly,
    hasKellyIntentEarly,
    hasLineMovementIntent,
    hasPropsToolIntent,
    rawQueryLower,
  };
}

// Re-export NFL_SEASON_YEAR for use in route.ts without an extra import
export { NFL_SEASON_YEAR, NFBC_DRAFT_YEAR };
