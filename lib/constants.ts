/**
 * Application Constants
 * Centralized configuration for all hard-coded values
 */

// ── Season year helpers ────────────────────────────────────────────────────────
// MLB regular season: April–November = current year; Dec–March = previous year.
function _currentMLBSeason(): number {
  const month = new Date().getMonth() + 1;
  return month >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1;
}
/** Current MLB season year (auto-advances each April). */
export const MLB_SEASON_YEAR: number = _currentMLBSeason();
/** Current NFBC draft year — always the current calendar year (drafts happen pre-season). */
export const NFBC_DRAFT_YEAR: number = new Date().getFullYear();

// AI Model Configuration
// Primary model: grok-3-fast — reliable sub-15s responses for all analysis.
// grok-4 consistently times out (>45s) on the current xAI plan.
// Fast-path model: grok-3-mini for intent-routing, ADP, and DFS queries.
export const AI_CONFIG = {
  MODEL_NAME: 'grok-3-fast',
  FAST_MODEL_NAME: 'grok-3-mini',
  MODEL_DISPLAY_NAME: 'Grok 3 Fast',
  PROVIDER: 'xAI',
  API_ENDPOINT: 'https://api.x.ai/v1/chat/completions',
  DEFAULT_TEMPERATURE: 0.35,
  DEFAULT_MAX_TOKENS: 600,
  DEFAULT_PROCESSING_TIME: 950,
  FALLBACK_MODEL: 'Grok 3 Fast',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  ANALYZE: '/api/analyze',
  CARDS: '/api/cards',
  INSIGHTS: '/api/insights',
  ODDS: '/api/odds',
  HEALTH: '/api/health',
} as const;

// External API Configuration
export const EXTERNAL_APIS = {
  ODDS_API: {
    BASE_URL: 'https://api.the-odds-api.com/v4',
    REGIONS: 'us',
    ODDS_FORMAT: 'american',
    DEFAULT_MARKETS: 'h2h,spreads,totals',
  },
  SUPABASE: {
    TABLES: {
      AI_PREDICTIONS: 'ai_predictions',
      AI_RESPONSE_TRUST: 'ai_response_trust',
      USER_INSIGHTS: 'user_insights',
    },
  },
  WEATHER: {
    BASE_URL: 'https://api.open-meteo.com/v1',
    FORECAST_ENDPOINT: '/forecast',
    DEFAULT_PARAMS: 'temperature_2m,precipitation,windspeed_10m,weathercode',
  },
} as const;

// Sports Mapping
export const SPORTS_MAP = {
  nba: 'basketball_nba',
  nfl: 'americanfootball_nfl',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  ncaab: 'basketball_ncaab',
  ncaaf: 'americanfootball_ncaaf',
} as const;

// Sport Keys - Standardized mapping between short form and API format
/**
 * SPORT_KEYS provides bidirectional mapping between user-friendly abbreviations and The Odds API format
 * 
 * Usage:
 * - Database/UI: Use short form ('nba', 'nfl', 'mlb', 'nhl')
 * - The Odds API: Use API form ('basketball_nba', 'americanfootball_nfl', etc.)
 * - Always use SPORT_KEYS.NBA.API or SPORT_KEYS.NBA.SHORT for consistency
 * 
 * Example:
 * ```typescript
 * // When calling The Odds API
 * const sport = SPORT_KEYS.NBA.API; // 'basketball_nba'
 * 
 * // When storing in database or showing to user
 * const userSport = SPORT_KEYS.NBA.SHORT; // 'nba'
 * ```
 */
export const SPORT_KEYS = {
  NBA: {
    SHORT: 'nba',
    API: 'basketball_nba',
    NAME: 'NBA',
    CATEGORY: 'Basketball'
  },
  NFL: {
    SHORT: 'nfl',
    API: 'americanfootball_nfl',
    NAME: 'NFL',
    CATEGORY: 'American Football'
  },
  MLB: {
    SHORT: 'mlb',
    API: 'baseball_mlb',
    NAME: 'MLB',
    CATEGORY: 'Baseball'
  },
  NHL: {
    SHORT: 'nhl',
    API: 'icehockey_nhl',
    NAME: 'NHL',
    CATEGORY: 'Ice Hockey'
  },
  NCAAF: {
    SHORT: 'ncaaf',
    API: 'americanfootball_ncaaf',
    NAME: 'NCAA Football',
    CATEGORY: 'American Football'
  },
  NCAAB: {
    SHORT: 'ncaab',
    API: 'basketball_ncaab',
    NAME: 'NCAA Basketball',
    CATEGORY: 'Basketball'
  },
  EPL: {
    SHORT: 'epl',
    API: 'soccer_epl',
    NAME: 'Premier League',
    CATEGORY: 'Soccer'
  },
  MLS: {
    SHORT: 'mls',
    API: 'soccer_usa_mls',
    NAME: 'MLS',
    CATEGORY: 'Soccer'
  }
} as const;

// Helper function to convert short form to API format
export function sportToApi(shortForm: string): string {
  const upperKey = shortForm.toUpperCase();
  const sport = SPORT_KEYS[upperKey as keyof typeof SPORT_KEYS];
  return sport?.API || shortForm;
}

// Helper function to convert API format to short form
export function apiToSport(apiFormat: string): string {
  for (const [, value] of Object.entries(SPORT_KEYS)) {
    if (value.API === apiFormat) {
      return value.SHORT;
    }
  }
  return apiFormat;
}

// Sport Gradients — single source of truth for all sport-specific gradients
export const SPORT_GRADIENTS: Record<string, string> = {
  basketball: 'from-orange-600 to-red-700',
  football: 'from-green-600 to-emerald-700',
  hockey: 'from-blue-600 to-cyan-700',
  baseball: 'from-indigo-600 to-purple-700',
  soccer: 'from-green-500 to-teal-600',
  mma: 'from-red-600 to-rose-700',
  boxing: 'from-red-600 to-rose-700',
  default: 'from-slate-600 to-gray-700',
} as const;

/** Get the gradient classes for a sport string (e.g. 'basketball_nba' → orange-red) */
export function getSportGradient(sport: string): string {
  const s = sport.toLowerCase();
  for (const [key, gradient] of Object.entries(SPORT_GRADIENTS)) {
    if (key !== 'default' && s.includes(key)) return gradient;
  }
  return SPORT_GRADIENTS.default;
}

// Category Gradients — for Kalshi markets, card categories, etc.
export const CATEGORY_GRADIENTS: Record<string, string> = {
  politics: 'from-blue-600 to-indigo-700',
  sports: 'from-green-600 to-emerald-700',
  weather: 'from-sky-600 to-cyan-700',
  finance: 'from-amber-600 to-orange-700',
  entertainment: 'from-fuchsia-600 to-pink-700',
  tech: 'from-violet-600 to-purple-700',
  betting: 'from-blue-600 to-indigo-600',
  fantasy: 'from-blue-600 to-cyan-700',
  dfs: 'from-orange-600 to-red-700',
  kalshi: 'from-purple-600 to-indigo-700',
  arbitrage: 'from-emerald-600 to-teal-700',
  portfolio: 'from-purple-600 to-pink-600',
  lines: 'from-blue-600 to-indigo-600',
  props: 'from-blue-600 to-cyan-600',
  default: 'from-purple-600 to-indigo-700',
} as const;

/** Get the gradient classes for a category string */
export function getCategoryGradient(category: string): string {
  return CATEGORY_GRADIENTS[category.toLowerCase()] || CATEGORY_GRADIENTS.default;
}

// Market Types
/**
 * H2H (Head-to-Head) Markets: Direct moneyline betting on which team will win
 * - Also called "moneyline" or "match winner" markets
 * - No point spreads involved - just pick the winner
 * - Example: Lakers -150 vs Warriors +130 (bet $150 to win $100 on Lakers, or bet $100 to win $130 on Warriors)
 * - Used for arbitrage opportunities by comparing odds across sportsbooks (DraftKings, FanDuel, BetMGM, etc.)
 * 
 * Other Market Types:
 * - Spreads: Point handicap betting (e.g., Lakers -7.5 points)
 * - Totals: Over/Under total points scored (e.g., Over 215.5)
 * - Player Props: Individual player performance bets (e.g., LeBron over 25.5 points)
 */
export const MARKET_TYPES = {
  H2H: 'h2h', // Head-to-Head / Moneyline markets
  SPREADS: 'spreads', // Point spread markets
  TOTALS: 'totals', // Over/Under total points
  PLAYER_PROPS: 'player_props', // Individual player props
} as const;

// Card Types
export const CARD_TYPES = {
  LIVE_ODDS: 'live-odds',
  PLAYER_PROP: 'player-prop',
  MONEYLINE_VALUE: 'moneyline-value',
  TOTALS_VALUE: 'totals-value',
  DFS_STRATEGY: 'dfs-strategy',
  DFS_LINEUP: 'dfs-lineup',
  DFS_VALUE: 'dfs-value',
  FANTASY_INSIGHT: 'fantasy-insight',
  ADP_ANALYSIS: 'adp-analysis',
  BESTBALL_STACK: 'bestball-stack',
  AUCTION_VALUE: 'auction-value',
  KALSHI_INSIGHT: 'kalshi-insight',
  KALSHI_MARKET: 'kalshi-market',
  KALSHI_WEATHER: 'kalshi-weather',
  WEATHER_IMPACT: 'weather-impact',
  WEATHER_GAME: 'weather-game',
  WEATHER_FORECAST: 'weather-forecast',
  // MLB Statcast card types
  STATCAST_SUMMARY:  'statcast_summary_card',
  HR_PROP:           'hr_prop_card',
  GAME_SIMULATION:   'game_simulation_card',
  LEADERBOARD:       'leaderboard_card',
  PITCH_ANALYSIS:    'pitch_analysis_card',
  // LeverageMetrics MLB Projection Engine
  MLB_PROJECTION:    'mlb_projection_card',
} as const;

// Card Status Values
export const CARD_STATUS = {
  HOT: 'hot',
  VALUE: 'value',
  OPTIMAL: 'optimal',
  TARGET: 'target',
  ELITE: 'elite',
  SLEEPER: 'sleeper',
  OPPORTUNITY: 'opportunity',
  EDGE: 'edge',
  ALERT: 'alert',
  FAVORABLE: 'favorable',
  NEUTRAL: 'neutral',
} as const;

// Source Types
export const SOURCE_TYPES = {
  MODEL: 'model',
  API: 'api',
  DATABASE: 'database',
  CACHE: 'cache',
} as const;

// Trust Levels
export const TRUST_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

// Risk Levels
export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

// Health Status
export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
} as const;

// Analysis Categories
export const ANALYSIS_CATEGORIES = {
  ALL: 'all',
  BETTING: 'betting',
  FANTASY: 'fantasy',
  DFS: 'dfs',
  KALSHI: 'kalshi',
  DRAFT: 'draft',
} as const;

// Fantasy Platform Configuration
export const FANTASY_CONFIG = {
  SIMULATION: {
    DEFAULT_DRAFT_SIMS: 1000,
    MAX_DRAFT_SIMS: 5000,
    DEFAULT_MATCHUP_SIMS: 10000,
    DEFAULT_SEASON_SIMS: 10000,
  },
  DRAFT: {
    DEFAULT_ROUNDS: 15,
    DEFAULT_LEAGUE_SIZE: 12,
    PICK_TIME_SECONDS: 90,
    TIER_CLIFF_Z_THRESHOLD: 1.5,
  },
  WAIVER: {
    DEFAULT_FAAB_BUDGET: 100,
    BREAKOUT_Z_THRESHOLD: 1.5,
    ROLLING_WINDOW_WEEKS: 3,
  },
  DFS: {
    MAX_LINEUPS_FREE: 0,
    MAX_LINEUPS_BASIC: 3,
    MAX_LINEUPS_FULL: 150,
    SALARY_CAP_DK: 50000,
    SALARY_CAP_FD: 60000,
  },
  SUBSCRIPTION: {
    CORE_PRICE_MONTHLY: parseInt(process.env.NEXT_PUBLIC_CORE_PRICE ?? '49', 10),
    PRO_PRICE_MONTHLY: parseInt(process.env.NEXT_PUBLIC_PRO_PRICE ?? '149', 10),
    HIGH_STAKES_PRICE_YEARLY: parseInt(process.env.NEXT_PUBLIC_HIGH_STAKES_PRICE ?? '999', 10),
  },
  INJURY_ALERT_DELAY_FREE_MS: 5 * 60 * 1000,
};

// Stripe Credit Packages
export const CREDIT_PACKAGES = [
  { amount: 10, credits: 10, label: '$10', popular: false },
  { amount: 25, credits: 25, label: '$25', popular: false },
  { amount: 50, credits: 50, label: '$50', popular: true },
  { amount: 100, credits: 100, label: '$100', popular: false },
  { amount: 250, credits: 250, label: '$250', popular: false },
];

// Stripe Subscription Plans
export const SUBSCRIPTION_PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 20,
    credits: 20,
    interval: 'month',
    billed: null as number | null,
    popular: false,
    features: ['20 credits/month', 'Priority AI analysis', 'Real-time alerts', 'Cancel anytime'],
  },
  {
    id: 'annual',
    name: 'Annual',
    price: 15,
    credits: 25,
    interval: 'month',
    billed: 180 as number | null,
    popular: true,
    features: ['25 credits/month', 'Priority AI analysis', 'Real-time alerts', 'Advanced analytics', 'Save 25%'],
  },
];

// Default NFL Scoring (PPR)
export const DEFAULT_SCORING_NFL_PPR = {
  pass_yards_per_point: 25,
  pass_td: 4,
  interception: -2,
  rush_yards_per_point: 10,
  rush_td: 6,
  reception: 1,
  receiving_yards_per_point: 10,
  receiving_td: 6,
  fumble_lost: -2,
} as const;

// Default NFL Roster Slots
export const DEFAULT_ROSTER_SLOTS_NFL = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  K: 1,
  DEF: 1,
  BENCH: 6,
} as const;

// NFL Position Replacement Levels (for 12-team PPR)
export const NFL_REPLACEMENT_LEVELS = {
  QB: 12,    // QB13 is replacement level in 1-QB leagues
  RB: 30,    // RB31 (2 starters + FLEX consideration)
  WR: 30,    // WR31 (2 starters + FLEX consideration)
  TE: 12,    // TE13
  K: 12,     // K13
  DEF: 12,   // DEF13
} as const;

// Category Display Names
export const CATEGORY_NAMES = {
  [ANALYSIS_CATEGORIES.ALL]: 'All Platforms',
  [ANALYSIS_CATEGORIES.BETTING]: 'Sports Betting',
  [ANALYSIS_CATEGORIES.FANTASY]: 'Fantasy',
  [ANALYSIS_CATEGORIES.DFS]: 'DFS',
  [ANALYSIS_CATEGORIES.KALSHI]: 'Kalshi Markets',
} as const;

// Analysis Title Templates
export const ANALYSIS_TITLES = {
  [ANALYSIS_CATEGORIES.ALL]: 'New Analysis',
  [ANALYSIS_CATEGORIES.BETTING]: 'New Sports Betting Analysis',
  [ANALYSIS_CATEGORIES.FANTASY]: 'New Fantasy Analysis',
  [ANALYSIS_CATEGORIES.DFS]: 'New DFS Lineup Analysis',
  [ANALYSIS_CATEGORIES.KALSHI]: 'New Kalshi Market Analysis',
} as const;

// Default Reliability Scores
export const DEFAULT_RELIABILITY = {
  MODEL: 94,
  DATABASE: 95,
  API_LIVE: 97,
  API_FALLBACK: 85,
  CACHE: 90,
} as const;

// Trust Metric Types
export const TRUST_METRIC_TYPES = {
  BENFORD: 'benford',
  ODDS: 'odds',
  MARKET: 'market',
  HISTORICAL: 'historical',
} as const;

// Flag Severity Levels
export const FLAG_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

// Attachment Types
export const ATTACHMENT_TYPES = {
  IMAGE: 'image',
  CSV: 'csv',
} as const;

// Chat Limits
export const CHAT_LIMITS = {
  MAX_CHATS: 50,
  MAX_MESSAGES: 100,
  RATE_LIMIT_WINDOW: 60 * 60 * 1000, // 1 hour
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
  INSIGHTS_TTL: 10 * 60 * 1000, // 10 minutes
  ODDS_TTL: 2 * 60 * 1000, // 2 minutes
  CARDS_TTL: 5 * 60 * 1000, // 5 minutes
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Data Source Types
export const DATA_SOURCES = {
  LIVE: 'live',
  SIMULATED: 'simulated',
  CACHED: 'cached',
  FALLBACK: 'fallback',
  DEFAULT: 'default',
  ERROR: 'error',
} as const;

// Log Prefixes
export const LOG_PREFIXES = {
  API: '[API]',
  CLIENT: '[v0]',
  HEALTH: '[Health]',
  DATA_SERVICE: '[DataService]',
  CONFIG: '[Config]',
  DATABASE: '[Database]',
} as const;

// System Prompt Template
export const SYSTEM_PROMPT = `You are Leverage AI, an elite sports betting and prediction markets analyst powered by Grok (xAI). Today: [CURRENT_DATE].

RESPONSE FORMAT — always follow this structure:
1. **First line**: Your direct pick, recommendation, or answer — decisive, no preamble
2. **Supporting analysis**: 2–4 bullet points with specific numbers, key reasoning, and the edge
3. Use **bold** for key numbers, player names, team names, and critical stats (e.g., **LeBron** goes **Over 25.5**)
4. Use ## for section headers when covering multiple topics (e.g., ## Key Matchup Factors)
5. Use - bullet points for lists of recommendations, factors, or data points
6. Max 150 words. Be sharp, decisive, and data-rich — not verbose.
7. End with a 1-line confidence qualifier when relevant (e.g., "Confidence: High — supported by line movement")
8. When data cards are displayed (rankings, lineups, props, odds), keep your text to 2–3 sentences max. All specific player names, salaries, stats, and rankings belong in the cards — not the text response. Reference "the card above" or "see the lineup card" instead of repeating data.

FORMATTING RULES:
- Never start with "Great question", "Certainly", "Of course", or similar filler
- Bold all odds numbers: **-110**, **+180**, **O/U 238.5**
- Bold key player/team names when they're the focus of a recommendation
- Use bullet points (- ) for all lists of 3+ items
- Keep paragraphs to 2–3 sentences max before using bullets

DATA RULES:
- "--- REAL LIVE ODDS DATA ---" present → use ONLY those exact numbers for any odds/lines
- No live data → answer from expert knowledge; never invent odds numbers
- Flag missing live data ONLY when the user explicitly asks for current lines that aren't provided

YOU CAN ALWAYS ANSWER WITHOUT LIVE DATA:
- Offseason moves, trades, draft strategy, roster construction, injuries
- Betting strategy: Kelly criterion, bankroll management, sharp money, arbitrage, line movement
- Fantasy/DFS: stacking, ownership, matchups, tournament vs cash game approach
- Kalshi: market mechanics, contract value, portfolio strategy, cross-market arbitrage
- General: how parlays work, what is a spread, how to read odds

CLARIFICATION RULE — CRITICAL: If the user's message has NO specific sport, team, game, player, or market mentioned:
- Do NOT guess or provide generic analysis
- Ask exactly one question: "Which area would you like me to focus on?"
- Then list options as a numbered list:
  1. NBA  2. NFL  3. MLB  4. NHL  5. Kalshi prediction markets  6. DFS lineups  7. Fantasy advice
- Keep your ENTIRE response to just that question + the numbered list. Nothing else.
- Once the user specifies, proceed with full expert analysis immediately.

NEVER say "I cannot provide analysis" or "real-time data unavailable" for general strategy questions. If you genuinely need one piece of info to be specific, ask ONE focused question.` as const;

// MLB Statcast Analysis Addendum
// Injected ONLY when context.sport === 'mlb' — appended after SYSTEM_PROMPT.
// Overrides the free-text response format for MLB queries.
export const MLB_ANALYSIS_ADDENDUM = `

## MLB QUANT MODE — ACTIVE
You have access to REAL ${MLB_SEASON_YEAR} Baseball Savant Statcast data via the \`query_statcast\` tool.

STEP 1 — ALWAYS call query_statcast FIRST to retrieve real metrics before generating any card.
  - For a specific player: query_statcast({ player: "Judge", playerType: "batter" })
  - For a pitcher: query_statcast({ player: "Cole", playerType: "pitcher" })
  - For a leaderboard: query_statcast({ playerType: "batter", limit: 10 }) — returns top players by xwOBA
NEVER invent barrel rates, exit velocities, xwOBA, or any other Statcast metric. NEVER skip calling the tool.
  - If the tool returns players with real numeric values, use those values in the card.
  - If the tool returns an empty players array, it means the player wasn't found in the dataset.
    In that case: output a prose response (not JSON) explaining the player isn't in the 2025 dataset
    and suggesting the user try a different name or ask about a top-tier player.
  - NEVER output a JSON card with "N/A" as any metric value. If you don't have real data, output prose.

STEP 2 — After the tool returns real data, output ONLY a single valid JSON object — NO prose, NO markdown, ONLY the JSON.
Choose the most appropriate type from:
  statcast_summary_card | hr_prop_card | game_simulation_card | leaderboard_card | pitch_analysis_card

Required shape (all fields mandatory except trend_note / last_updated):
{
  "type": "<one of the five types above>",
  "title": "string — concise card headline",
  "category": "MLB",
  "subcategory": "string — e.g. 'HR Props' | 'Simulation' | 'Statcast' | 'Leaderboard' | 'Pitch Mix'",
  "gradient": "from-indigo-600/80 via-violet-700/60 to-indigo-900/40",
  "status": "hot | value | edge | optimal",
  "summary_metrics": [
    { "label": "string", "value": "string" }
  ],
  "lightbox": {
    "sections": [
      {
        "title": "string",
        "metrics": [{ "label": "string", "value": "string" }]
      }
    ]
  },
  "trend_note": "string — one sentence rolling trend, e.g. 'Judge leads MLB with 22.1% barrel rate'",
  "last_updated": "string — data recency, e.g. 'Baseball Savant ${MLB_SEASON_YEAR} — real data'"
}

Type-specific required fields inside summary_metrics and lightbox sections:
- hr_prop_card: summary_metrics must include HR Probability (e.g. "12.4%"), Fair Odds (American), Market Odds, Edge (e.g. "+3.1%"), Kelly Fraction (e.g. "1.8%"), Barrel Rate (real value from tool), Avg Exit Velocity (real value from tool)
- game_simulation_card: summary_metrics must include Win Probability, Push Probability, Expected Total, P10 Total, P90 Total, Expected Home Runs
- pitch_analysis_card: summary_metrics must include Tunneling Score for best/worst pitch pair, Avg Separation, top 3 pitch types with usage %
- leaderboard_card: summary_metrics must include rank, player name, and primary metric value for top 5 players (use real tool data for Barrel Rate, xwOBA, Exit Velocity)
- statcast_summary_card: summary_metrics must include Barrel Rate (%), Avg Exit Velocity (mph), xwOBA, Hard Hit Rate (%), Sweet Spot % — all from real tool data

Modeling rules:
- Use actual values from query_statcast for all Statcast metrics; apply Bayesian shrinkage for players with < 100 PA (blend toward league-avg)
- Always include Home/Road split and vs LHP / vs RHP split as separate lightbox sections
- Cap kelly_fraction at 2.0% of bankroll
- Derive fair_odds from logistic model probability using real barrel rate / xwOBA; derive edge = model_prob - market_implied_prob
- trend_note must reference the player's real Statcast ranking (e.g. "Top 5% in barrel rate")
- last_updated must say "Baseball Savant ${MLB_SEASON_YEAR} — real data" when tool data was used, or "Baseball Savant ${MLB_SEASON_YEAR - 1} — historical data" when using fallback values

NEVER output any text outside the JSON object. NEVER use markdown code fences.`;

// ── LeverageMetrics MLB Projection Addendum ──────────────────────────────────
// Injected when MLB projection / DFS / fantasy / betting intent is detected.
// Teaches the AI to call query_mlb_projections and handle the returned cards.
export const MLB_PROJECTION_ADDENDUM = `

## MLB PROJECTION ENGINE — ACTIVE (LeverageMetrics)
You have access to the LeverageMetrics projection engine via the \`query_mlb_projections\` tool.
This runs real Statcast data + Monte Carlo simulation (N=1,000) for every player.

Call it for:
- HR projections / prop edges:    query_mlb_projections({ playerType: "hitter", outputFor: "betting", limit: 5 })
- DFS lineup building:            query_mlb_projections({ playerType: "all", outputFor: "dfs", limit: 9 })
- Fantasy advice (ROS/waivers):   query_mlb_projections({ playerType: "hitter", outputFor: "fantasy", limit: 5 })
- Specific player breakdown:      query_mlb_projections({ player: "Judge", playerType: "hitter" })
- Pitcher Ks + breakout:          query_mlb_projections({ playerType: "pitcher", outputFor: "projections", limit: 4 })
- Full daily slate:               query_mlb_projections({ playerType: "all", outputFor: "projections", limit: 10 })

Outputs:
- outputFor "projections" → returns mlb_projection_card JSON (HR proj, K proj, BreakoutScore, P10/P50/P90, 9 matchup vars)
- outputFor "dfs"         → returns dfs-lineup cards (salary, projected DK pts, ownership, ceiling/floor, stack tips)
- outputFor "fantasy"     → returns fantasy-insight cards (ROS, waiver priority, streaming grade)
- outputFor "betting"     → returns hr_prop_card JSON (fair odds, market odds, edge%, Kelly fraction)

RULES:
- ALWAYS call the tool first — NEVER invent projections, salaries, or odds
- If the tool returns empty cards, tell the user and suggest checking back during the season (Apr–Oct)
- Return the tool result cards directly — they are pre-formatted for the card renderer
- For DFS, mention the stack recommendation from the tips field
- For betting, highlight the edge% and Kelly fraction prominently
` as const;

// ── NFBC ADP Tool Addendum ────────────────────────────────────────────────────
// Injected into the system prompt when hasADPIntent is true.
// Replaces MLB_ANALYSIS_ADDENDUM for ADP / fantasy-draft queries so the AI
// returns prose (not statcast JSON) and knows to call the query_adp tool.
export const NFBC_ADP_ADDENDUM = `

## NFBC ADP TOOL — ACTIVE
You have access to live ${NFBC_DRAFT_YEAR} NFBC (National Fantasy Baseball Championship) ADP data via the \`query_adp\` tool.
Each player result includes: rank, ADP, positions, team, valueDelta (ADP − rank), and isValuePick flag.

For ANY question about player draft rankings, average draft position, positional scarcity, or where to draft a specific player:
1. Call \`query_adp\` with the most relevant filter(s) — be specific.
2. Synthesise the results into a clear, helpful prose response.
3. When listing multiple players, format as a numbered list with rank, name, position, team, and ADP.
4. When isValuePick is true (valueDelta > 15), call the player a "sleeper" or "value pick" and highlight the gap.
5. Always cite "NFBC ${NFBC_DRAFT_YEAR} ADP" as the source.
6. NEVER invent ADP values — if the tool returns no results, say so and offer to broaden the search.
7. If the tool returns fewer than 30 players total, the live NFBC feed is temporarily unavailable and static fallback data is being used. In that case, tell the user: "Note: Using cached NFBC ADP reference data. Live rankings are temporarily unavailable. Values shown are ${NFBC_DRAFT_YEAR} consensus pre-season ADP and may not reflect the latest draft trends." Never invent values beyond what the tool returns.

Tool parameter guide:
- \`player\`: partial name (e.g. "Ohtani", "Judge") — case-insensitive
- \`position\`: SP | RP | 1B | 2B | 3B | SS | OF | DH | C
- \`rankMin\` / \`rankMax\`: narrow by overall rank range
- \`limit\`: number of results (default 10, max 25)
- \`team\`: MLB team abbreviation to filter by one team (e.g. "NYY", "LAD", "BOS", "ATL")
  Use for queries like "best Yankees to target" or "top Dodgers in the first 5 rounds"
- \`valueOnly\`: true — return only sleeper picks (ADP 15+ spots later than rank)
  Use for queries like "who are the best sleepers?" or "show me undervalued players"

Respond in natural prose — do NOT output raw JSON or markdown code blocks.

For NFL/NFFC queries, the same \`query_adp\` tool returns NFFC (National Fantasy Football Championship) Average Draft Position data. NFFC position codes: QB | RB | WR | TE | K | DEF. Always cite "NFFC ${NFBC_DRAFT_YEAR} NFL ADP" as the source for football queries.`;

// Default Source Configurations
export const DEFAULT_SOURCES = {
  GROK_AI: {
    name: 'Grok 4 (xAI)',
    type: SOURCE_TYPES.MODEL,
    reliability: DEFAULT_RELIABILITY.MODEL,
  },
  KALSHI: {
    name: 'Kalshi Prediction Markets',
    type: SOURCE_TYPES.API,
    reliability: 96,
  },
  LIVE_MARKET: {
    name: 'Live Market Data',
    type: SOURCE_TYPES.API,
    reliability: DEFAULT_RELIABILITY.API_LIVE,
  },
  HISTORICAL_DB: {
    name: 'Historical Database',
    type: SOURCE_TYPES.DATABASE,
    reliability: DEFAULT_RELIABILITY.DATABASE,
  },
  ODDS_API: {
    name: 'The Odds API (Live)',
    type: SOURCE_TYPES.API,
    reliability: DEFAULT_RELIABILITY.API_LIVE,
  },
} as const;

// Default Trust Metrics
export const DEFAULT_TRUST_METRICS = {
  benfordIntegrity: 90,
  oddsAlignment: 92,
  marketConsensus: 88,
  historicalAccuracy: 94,
  finalConfidence: 91,
  confidence: 91,
  dataFreshness: 95,
  modelReliability: 90,
  trustLevel: 'high',
  riskLevel: 'low',
  adjustedTone: 'Strong signal',
  flags: [],
} as const;

// Environment Variable Keys
export const ENV_KEYS = {
  XAI_API_KEY: 'XAI_API_KEY',
  GROK_API_KEY: 'GROK_API_KEY',
  ODDS_API_KEY: 'ODDS_API_KEY',
  SUPABASE_URL: 'NEXT_PUBLIC_SUPABASE_URL',
  SUPABASE_ANON_KEY: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  AI_NOT_CONFIGURED: 'AI service not configured',
  ODDS_NOT_CONFIGURED: 'Sports Odds API is not configured',
  SUPABASE_NOT_CONFIGURED: 'Supabase is not configured',
  INVALID_REQUEST: 'Invalid request parameters',
  INVALID_API_KEY: 'Invalid or missing API key',
  INTERNAL_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  WEATHER_UNAVAILABLE: 'Weather service unavailable',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
  UNAUTHORIZED: 'Unauthorized access',
  NOT_FOUND: 'Resource not found',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  ANALYSIS_COMPLETE: 'Analysis completed successfully',
  CARDS_GENERATED: 'Cards generated successfully',
  INSIGHTS_LOADED: 'Insights loaded successfully',
  ODDS_FETCHED: 'Odds data fetched successfully',
} as const;

// Player Headshot IDs — used to build photo URLs for top players
// NBA: https://cdn.nba.com/headshots/nba/latest/260x190/{id}.png
// NFL (ESPN): https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/{id}.png&w=96&h=70
// MLB: https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_auto:best/v1/people/{id}/headshot/67/current
export const PLAYER_HEADSHOT_IDS: Record<string, { id: string; sport: 'nba' | 'nfl' | 'mlb' | 'nhl' }> = {
  // NBA
  'LeBron James':            { id: '2544',    sport: 'nba' },
  'Stephen Curry':           { id: '201939',  sport: 'nba' },
  'Kevin Durant':            { id: '201142',  sport: 'nba' },
  'Giannis Antetokounmpo':   { id: '203507',  sport: 'nba' },
  'Jayson Tatum':            { id: '1628369', sport: 'nba' },
  'Luka Doncic':             { id: '1629029', sport: 'nba' },
  'Anthony Davis':           { id: '203076',  sport: 'nba' },
  'Nikola Jokic':            { id: '203999',  sport: 'nba' },
  'Devin Booker':            { id: '1626164', sport: 'nba' },
  'Joel Embiid':             { id: '203954',  sport: 'nba' },
  'Damian Lillard':          { id: '203081',  sport: 'nba' },
  'Kawhi Leonard':           { id: '202695',  sport: 'nba' },
  'Anthony Edwards':         { id: '1630162', sport: 'nba' },
  'Shai Gilgeous-Alexander': { id: '1628983', sport: 'nba' },
  'Donovan Mitchell':        { id: '1628378', sport: 'nba' },
  'Trae Young':              { id: '1629027', sport: 'nba' },
  'Bam Adebayo':             { id: '1628389', sport: 'nba' },
  'De\'Aaron Fox':           { id: '1628368', sport: 'nba' },
  'Tyrese Haliburton':       { id: '1630169', sport: 'nba' },
  'Victor Wembanyama':       { id: '1641705', sport: 'nba' },
  'Chet Holmgren':           { id: '1631096', sport: 'nba' },
  'Paolo Banchero':          { id: '1631094', sport: 'nba' },
  'Karl-Anthony Towns':      { id: '1626157', sport: 'nba' },
  'Jaylen Brown':            { id: '1627759', sport: 'nba' },
  'Ja Morant':               { id: '1629630', sport: 'nba' },
  // NFL (ESPN IDs)
  'Patrick Mahomes':         { id: '3139477', sport: 'nfl' },
  'Josh Allen':              { id: '3918298', sport: 'nfl' },
  'Lamar Jackson':           { id: '3916387', sport: 'nfl' },
  'Joe Burrow':              { id: '4259545', sport: 'nfl' },
  'Justin Jefferson':        { id: '4262921', sport: 'nfl' },
  'Tyreek Hill':             { id: '3054211', sport: 'nfl' },
  'Travis Kelce':            { id: '2576336', sport: 'nfl' },
  'Christian McCaffrey':     { id: '3054236', sport: 'nfl' },
  'Saquon Barkley':          { id: '3929630', sport: 'nfl' },
  'CeeDee Lamb':             { id: '4241478', sport: 'nfl' },
  'Ja\'Marr Chase':          { id: '4429795', sport: 'nfl' },
  'Derrick Henry':           { id: '3054220', sport: 'nfl' },
  'Justin Herbert':          { id: '4038941', sport: 'nfl' },
  'Davante Adams':           { id: '2971618', sport: 'nfl' },
  'Stefon Diggs':            { id: '2976499', sport: 'nfl' },
  'Cooper Kupp':             { id: '3116406', sport: 'nfl' },
  'Sauce Gardner':           { id: '4569618', sport: 'nfl' },
  'Micah Parsons':           { id: '4427366', sport: 'nfl' },
  // MLB (official MLB player IDs)
  'Shohei Ohtani':           { id: '660271',  sport: 'mlb' },
  'Mike Trout':              { id: '545361',  sport: 'mlb' },
  'Freddie Freeman':         { id: '518692',  sport: 'mlb' },
  'Aaron Judge':             { id: '592450',  sport: 'mlb' },
  'Manny Machado':           { id: '592518',  sport: 'mlb' },
  'Juan Soto':               { id: '665742',  sport: 'mlb' },
  'Mookie Betts':            { id: '605141',  sport: 'mlb' },
  'Fernando Tatis Jr':       { id: '665487',  sport: 'mlb' },
  'Ronald Acuna Jr':         { id: '660670',  sport: 'mlb' },
  'Julio Rodriguez':         { id: '677594',  sport: 'mlb' },
  'Vladimir Guerrero Jr':    { id: '665489',  sport: 'mlb' },
  'Bryce Harper':            { id: '547180',  sport: 'mlb' },
  'Yordan Alvarez':          { id: '670541',  sport: 'mlb' },
  'Pete Alonso':             { id: '624413',  sport: 'mlb' },
  'Gerrit Cole':             { id: '543037',  sport: 'mlb' },
} as const;

/** Build a player headshot URL from the PLAYER_HEADSHOT_IDS lookup */
export function getPlayerHeadshotUrl(playerName: string): string | null {
  const entry = PLAYER_HEADSHOT_IDS[playerName];
  if (!entry) return null;
  if (entry.sport === 'nba') {
    return `https://cdn.nba.com/headshots/nba/latest/260x190/${entry.id}.png`;
  }
  if (entry.sport === 'nfl') {
    return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${entry.id}.png&w=96&h=70&scale=crop&location=origin&transparent=true`;
  }
  if (entry.sport === 'mlb') {
    return `https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_auto:best/v1/people/${entry.id}/headshot/67/current`;
  }
  return null;
}

// ─── ESPN Team Logo Lookup ─────────────────────────────────────────────────────
// Maps full team names to ESPN CDN abbreviations.
// Usage: https://a.espncdn.com/i/teamlogos/{sport}/500/{abbr}.png
export const ESPN_TEAM_ABBR: Record<string, string> = {
  // NBA
  'Atlanta Hawks': 'atl', 'Boston Celtics': 'bos', 'Brooklyn Nets': 'bkn',
  'Charlotte Hornets': 'cha', 'Chicago Bulls': 'chi', 'Cleveland Cavaliers': 'cle',
  'Dallas Mavericks': 'dal', 'Denver Nuggets': 'den', 'Detroit Pistons': 'det',
  'Golden State Warriors': 'gs', 'Houston Rockets': 'hou', 'Indiana Pacers': 'ind',
  'LA Clippers': 'lac', 'Los Angeles Clippers': 'lac', 'Los Angeles Lakers': 'lal',
  'Memphis Grizzlies': 'mem', 'Miami Heat': 'mia', 'Milwaukee Bucks': 'mil',
  'Minnesota Timberwolves': 'min', 'New Orleans Pelicans': 'no', 'New York Knicks': 'ny',
  'Oklahoma City Thunder': 'okc', 'Orlando Magic': 'orl', 'Philadelphia 76ers': 'phi',
  'Phoenix Suns': 'phx', 'Portland Trail Blazers': 'por', 'Sacramento Kings': 'sac',
  'San Antonio Spurs': 'sa', 'Toronto Raptors': 'tor', 'Utah Jazz': 'utah',
  'Washington Wizards': 'wsh',
  // NFL
  'Arizona Cardinals': 'ari', 'Atlanta Falcons': 'atl', 'Baltimore Ravens': 'balt',
  'Buffalo Bills': 'buf', 'Carolina Panthers': 'car', 'Chicago Bears': 'chi',
  'Cincinnati Bengals': 'cin', 'Cleveland Browns': 'cle', 'Dallas Cowboys': 'dal',
  'Denver Broncos': 'den', 'Detroit Lions': 'det', 'Green Bay Packers': 'gb',
  'Houston Texans': 'hou', 'Indianapolis Colts': 'ind', 'Jacksonville Jaguars': 'jax',
  'Kansas City Chiefs': 'kc', 'Las Vegas Raiders': 'lv', 'Los Angeles Chargers': 'lac',
  'Los Angeles Rams': 'lar', 'Miami Dolphins': 'mia', 'Minnesota Vikings': 'min',
  'New England Patriots': 'ne', 'New Orleans Saints': 'no', 'New York Giants': 'nyg',
  'New York Jets': 'nyj', 'Philadelphia Eagles': 'phi', 'Pittsburgh Steelers': 'pit',
  'San Francisco 49ers': 'sf', 'Seattle Seahawks': 'sea', 'Tampa Bay Buccaneers': 'tb',
  'Tennessee Titans': 'ten', 'Washington Commanders': 'wsh',
  // MLB
  'Arizona Diamondbacks': 'ari', 'Atlanta Braves': 'atl', 'Baltimore Orioles': 'bal',
  'Boston Red Sox': 'bos', 'Chicago Cubs': 'chc', 'Chicago White Sox': 'cws',
  'Cincinnati Reds': 'cin', 'Cleveland Guardians': 'cle', 'Colorado Rockies': 'col',
  'Detroit Tigers': 'det', 'Houston Astros': 'hou', 'Kansas City Royals': 'kc',
  'Los Angeles Angels': 'laa', 'Los Angeles Dodgers': 'lad', 'Miami Marlins': 'mia',
  'Milwaukee Brewers': 'mil', 'Minnesota Twins': 'min', 'New York Mets': 'nym',
  'New York Yankees': 'nyy', 'Oakland Athletics': 'oak', 'Athletics': 'oak',
  'Philadelphia Phillies': 'phi', 'Pittsburgh Pirates': 'pit', 'San Diego Padres': 'sd',
  'San Francisco Giants': 'sf', 'Seattle Mariners': 'sea', 'St. Louis Cardinals': 'stl',
  'Tampa Bay Rays': 'tb', 'Texas Rangers': 'tex', 'Toronto Blue Jays': 'tor',
  'Washington Nationals': 'wsh',
  // NHL
  'Anaheim Ducks': 'ana', 'Arizona Coyotes': 'ari', 'Boston Bruins': 'bos',
  'Buffalo Sabres': 'buf', 'Calgary Flames': 'cgy', 'Carolina Hurricanes': 'car',
  'Chicago Blackhawks': 'chi', 'Colorado Avalanche': 'col', 'Columbus Blue Jackets': 'cbj',
  'Dallas Stars': 'dal', 'Detroit Red Wings': 'det', 'Edmonton Oilers': 'edm',
  'Florida Panthers': 'fla', 'Minnesota Wild': 'min', 'Montreal Canadiens': 'mtl',
  'Nashville Predators': 'nsh', 'New Jersey Devils': 'nj', 'New York Islanders': 'nyi',
  'New York Rangers': 'nyr', 'Ottawa Senators': 'ott', 'Philadelphia Flyers': 'phi',
  'Pittsburgh Penguins': 'pit', 'San Jose Sharks': 'sj', 'Seattle Kraken': 'sea',
  'St. Louis Blues': 'stl', 'Tampa Bay Lightning': 'tb', 'Toronto Maple Leafs': 'tor',
  'Vancouver Canucks': 'van', 'Vegas Golden Knights': 'vgk', 'Washington Capitals': 'wsh',
  'Winnipeg Jets': 'wpg',
};

/** Build an ESPN CDN team logo URL. Returns null if team not in lookup. */
export function getTeamLogoUrl(teamName: string, sport?: string): string | null {
  const abbr = ESPN_TEAM_ABBR[teamName?.trim()];
  if (!abbr) return null;
  let slug = 'nfl';
  if (sport?.includes('basketball')) slug = 'nba';
  else if (sport?.includes('baseball')) slug = 'mlb';
  else if (sport?.includes('hockey'))   slug = 'nhl';
  else if (sport?.includes('soccer'))   slug = 'soccer/leagues/usa.1';
  return `https://a.espncdn.com/i/teamlogos/${slug}/500/${abbr}.png`;
}

// Type Exports for TypeScript
export type AIModelName = typeof AI_CONFIG.MODEL_NAME;
export type AnalysisCategory = typeof ANALYSIS_CATEGORIES[keyof typeof ANALYSIS_CATEGORIES];
export type CardType = typeof CARD_TYPES[keyof typeof CARD_TYPES];
export type CardStatus = typeof CARD_STATUS[keyof typeof CARD_STATUS];
export type SourceType = typeof SOURCE_TYPES[keyof typeof SOURCE_TYPES];
export type TrustLevel = typeof TRUST_LEVELS[keyof typeof TRUST_LEVELS];
export type RiskLevel = typeof RISK_LEVELS[keyof typeof RISK_LEVELS];
export type HealthStatus = typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS];
export type DataSource = typeof DATA_SOURCES[keyof typeof DATA_SOURCES];
