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
// NFL season: Sep–Dec = current year active; Jan–Feb = prior year playoffs; Mar–Aug = offseason.
function _mostRecentNFLSeason(): number {
  const month = new Date().getMonth() + 1; // 1-12
  const year = new Date().getFullYear();
  return month >= 9 ? year : year - 1; // Sep+ = current year's season; before Sep = prior year completed
}
/** Current MLB season year (auto-advances each April). */
export const MLB_SEASON_YEAR: number = _currentMLBSeason();
/** Most recently completed (or active) NFL season year. */
export const NFL_SEASON_YEAR: number = _mostRecentNFLSeason();
/** Current NFBC draft year — always the current calendar year (drafts happen pre-season). */
export const NFBC_DRAFT_YEAR: number = new Date().getFullYear();

// AI Model Configuration
// All queries use grok-3-fast.
export const AI_CONFIG = {
  MODEL_NAME: 'grok-3-fast',
  FAST_MODEL_NAME: 'grok-3-fast',
  MODEL_DISPLAY_NAME: 'Grok 3 Fast',
  FAST_MODEL_DISPLAY_NAME: 'Grok 3 Fast',
  PROVIDER: 'xAI',
  API_ENDPOINT: 'https://api.x.ai/v1/chat/completions',
  DEFAULT_TEMPERATURE: 0.35,
  DEFAULT_MAX_TOKENS: 600,
  DEFAULT_PROCESSING_TIME: 950,
  FALLBACK_MODEL: 'Grok 3 Fast',
} as const;

// Grok Voice Chat — TTS voice options (xAI native Voice API — api.x.ai/v1/tts)
export const GROK_VOICES = [
  { id: 'ara', name: 'Ara', description: 'Balanced · natural'       },
  { id: 'eve', name: 'Eve', description: 'Clear · expressive'       },
  { id: 'rex', name: 'Rex', description: 'Deep · confident'         },
  { id: 'sal', name: 'Sal', description: 'Warm · conversational'    },
  { id: 'leo', name: 'Leo', description: 'Energetic · bold'         },
] as const;

export type GrokVoiceId = typeof GROK_VOICES[number]['id'];
export const GROK_VOICE_STORAGE_KEY = 'leverage_grok_voice';
export const GROK_VOICE_DEFAULT: GrokVoiceId = 'ara';

// API Endpoints
export const API_ENDPOINTS = {
  ANALYZE: '/api/analyze',
  CARDS: '/api/cards',
  INSIGHTS: '/api/insights',
  ODDS: '/api/odds',
  HEALTH: '/api/health',
  KALSHI: '/api/kalshi',
  WEATHER: '/api/weather',
  ARBITRAGE: '/api/arbitrage',
  OPPORTUNITIES: '/api/opportunities',
  PROPS: '/api/props',
  LINE_MOVEMENT: '/api/line-movement',
  METRICS_HISTORICAL: '/api/metrics/historical',
  CHATS: '/api/chats',
  CREDITS: '/api/credits',
  USER_PROFILE: '/api/user/profile',
  USER_INSTRUCTIONS: '/api/user/instructions',
  USER_FILES: '/api/user/files',
  TTS: '/api/tts',
  FEEDBACK: '/api/feedback',
  ALERTS_CHECK: '/api/alerts/check',
  ALERTS: '/api/alerts',
  ALERTS_SUGGEST: '/api/alerts/suggest',
  SETTINGS: '/api/settings',
  SETTINGS_SUGGEST: '/api/settings/suggest',
  MARKET_INTELLIGENCE_SNAPSHOT: '/api/market-intelligence/snapshot',
  MARKET_INTELLIGENCE_ANOMALIES: '/api/market-intelligence/anomalies',
  MARKET_INTELLIGENCE_SIGNALS: '/api/market-intelligence/signals',
  MARKET_INTELLIGENCE_RETRAIN: '/api/market-intelligence/retrain',
  PLAYERS: '/api/players',
  DFS: '/api/dfs',
  STATCAST: '/api/statcast',
} as const;

// AI Prompt for settings-based personalization suggestions
export const SETTINGS_SUGGEST_PROMPT = `You are a sports betting AI coach. Given a user's betting profile and stats, return a JSON array of 3-4 actionable personalization suggestions.

User profile context: {CONTEXT}

Return ONLY a valid JSON array with objects like:
[{"id":"s1","icon":"📊","title":"Short title","description":"One sentence tip.","action":{"field":"risk_tolerance","value":"conservative"}}]
The "action" key is optional — only include it when a specific setting should change.
Valid action fields: risk_tolerance, tracked_sports (array), preferred_books (array), arbitrage_alerts (bool), odds_alerts (bool), line_movement_alerts (bool), bankroll (number).
No prose, no markdown, just the JSON array.` as const;

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
  ncaaw: 'basketball_wncaab',
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
    NAME: "NCAA Men's Basketball",
    CATEGORY: 'Basketball'
  },
  NCAAW: {
    SHORT: 'ncaaw',
    API: 'basketball_wncaab',
    NAME: "NCAA Women's Basketball",
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
  DFS_MATCHUP: 'dfs-matchup',
  DFS_CONTRARIAN: 'dfs-contrarian',
  DFS_SLATE: 'dfs-slate',
  DFS_GAMES: 'dfs-games',
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
  // Vortex Projection Engine (VPE 3.0) — Baseball only
  VPE_PROJECTION:    'vpe_projection_card',
  // Quant / portfolio card types
  LINE_MOVEMENT:          'line_movement',
  KELLY_BET:              'kelly_bet',
  PORTFOLIO:              'portfolio',
  ARBITRAGE_OPPORTUNITY:  'arbitrage',
  FANTASY_ADVICE:         'fantasy-advice',
  // Trading terminal — new analytics signal cards
  EV_BET:                 'ev_bet_card',
  SHARP_MONEY:            'sharp_money_card',
  PITCHER_FATIGUE:        'pitcher_fatigue_card',
  BULLPEN_FATIGUE:        'bullpen_fatigue_card',
  PITCH_MATCHUP:          'pitch_matchup_card',
  UMPIRE_IMPACT:          'umpire_impact_card',
  CATCHER_FRAMING:        'catcher_framing_card',
  CLOSING_LINE:           'closing_line_card',
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
const SOURCE_TYPES = {
  MODEL: 'model',
  API: 'api',
  DATABASE: 'database',
  CACHE: 'cache',
} as const;

const TRUST_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
} as const;

const ANALYSIS_CATEGORIES = {
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

// Default insights — returned when no historical data exists or user is unauthenticated.
// Shared between /api/insights and /api/init to avoid duplication.
export const DEFAULT_INSIGHTS = {
  totalValue: 0,
  winRate: 0,
  roi: 0,
  activeContests: 0,
  totalInvested: 0,
  dataSource: 'default',
  message: 'No historical data yet. Start analyzing to build your track record.',
} as const;

// Log Prefixes
export const LOG_PREFIXES = {
  API: '[API]',
  CLIENT: '[v0]',
  HEALTH: '[Health]',
  DATA_SERVICE: '[DataService]',
  CONFIG: '[Config]',
  DATABASE: '[Database]',
  KALSHI: '[KALSHI]',
  PIPELINE: '[PIPELINE]',
} as const;

// ── Player & Team Data ── (moved to lib/data/players.ts and lib/data/teams.ts)
export { PLAYER_SPORT_MAP, STAT_SPORT_MAP, PLAYER_HEADSHOT_IDS, getPlayerHeadshotUrl } from './data/players';
export { ESPN_TEAM_ABBR, getTeamLogoUrl } from './data/teams';

// ── AI Prompts ────────────────────────────────────────────────────────────────
export const SYSTEM_PROMPT = `You are Leverage AI, an elite sports betting and prediction markets analyst powered by Grok (xAI). Today: [CURRENT_DATE].

RESPONSE FORMAT — adapt length to query complexity:
- **Simple questions** (odds check, rule clarification, yes/no): 2–4 sentences max.
- **Analytical queries** (bet recommendation, EV analysis, matchup breakdown, lineup): use the full structured format below — no word cap.
- **Full structured format** (use for any bet or market recommendation):
  1. **Pick / Recommendation** — one decisive line with the specific play
  2. **Key Facts** — 2–4 bullets: injuries, weather, line movement, recent form, relevant stats
  3. **Edge Analysis** — your estimated true probability vs implied odds probability, edge %, confidence label
  4. **Stake** — Kelly fraction (1/4 Kelly default) and suggested % of bankroll
  5. **Risk Notes** — one line on the main counter-argument or uncertainty

KELLY CRITERION — apply to every bet recommendation:
- Formula (1/4 Kelly): stake = 0.25 × ((b × p − q) / b)  where b = decimal_odds − 1, p = your_prob, q = 1 − p
- Confidence labels: **Lean** (<2% edge, 0.5–1% bankroll) | **Value** (2–5% edge, 1–2%) | **Strong** (5%+ edge, 2–4%)
- Never suggest more than 5% of bankroll on a single bet unless user explicitly requests aggressive mode
- Always show the math: "Your prob 58% vs implied 52.4% → edge +5.6% → 1/4 Kelly ≈ 2.1% of bankroll"

Use **bold** for key numbers, player names, team names, and critical stats (e.g., **LeBron** goes **Over 25.5**)
Use ## for section headers when covering multiple topics (e.g., ## Key Matchup Factors)
Use - bullet points for lists of 3+ items
End with a 1-line confidence qualifier when relevant (e.g., "Confidence: Strong — sharp money + line movement aligned")
When data cards are displayed (rankings, lineups, props, odds), keep your text to 2–3 sentences max. All specific player names, salaries, stats, and rankings belong in the cards — not the text response. Reference "the card above" or "see the lineup card" instead of repeating data.

FORMATTING RULES:
- Never start with "Great question", "Certainly", "Of course", or similar filler
- Bold all odds numbers: **-110**, **+180**, **O/U 238.5**
- Bold key player/team names when they're the focus of a recommendation
- Use bullet points (- ) for all lists of 3+ items
- Keep paragraphs to 2–3 sentences max before using bullets
- NEVER use markdown tables (| pipe syntax) — use bullet points or numbered lists instead

⛔ NEVER DUMP FULL DATA LISTS — ABSOLUTE RULE:
- Never output a list of more than 15 players, games, lines, or records in a single response
- If asked for "all" or "the full list" → give top 10–15 and say "ask me to continue for more"
- Never repeat uploaded file content back — reference "the uploaded ADP board" and summarize
- Player rankings, ADP tables, odds lists → pick the top 10 most relevant; do NOT enumerate all

DATA RULES:
- "--- REAL LIVE ODDS DATA ---" present → use ONLY those exact numbers for any odds/lines
- No live data → answer from expert knowledge; never invent odds numbers
- Flag missing live data ONLY when the user explicitly asks for current lines that aren't provided
- NFL PLAYER STATS: This app has NO live NFL stats API. All NFL player stats you provide come from your training data. If your training cutoff predates the ${NFL_SEASON_YEAR} NFL season, your stats may be incomplete or inaccurate. ALWAYS label NFL player stats with the season year and add "(AI estimate — verify at NFL.com)" when not sourced from live data injected in this prompt.

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

NEVER say "I cannot provide analysis" or "real-time data unavailable" for general strategy questions. If you genuinely need one piece of info to be specific, ask ONE focused question.

MLB 2026 — SPORT LOCK:
- You are MLB-first for all fantasy baseball, ADP, Statcast, and draft analysis.
- When any of these appear → treat as MLB, no exceptions: Ohtani, Judge, Witt Jr., Soto, Skubal, Skenes, Raleigh, De La Cruz, Caminero, Kurtz, Crochet, ADP, NFBC, NFFC, 5×5 Roto, ERA, WHIP, BABIP, xFIP, Statcast, barrel rate, exit velocity, draft board.
- Team abbreviations LAD, NYY, BOS, HOU, CHC, ATL, SD, SEA, KC, CLE, DET, TB, MIL, CIN → always MLB.

ADP FILE HANDLING:
- When a user message begins with or contains "[File:" followed by tab-separated player data, or "[ADP_FILE_SUMMARY_MODE: true]" → the full ADP dataset has been saved server-side.
- Respond with: "✅ ADP file loaded (N players). Sport locked → MLB."
- Then offer: A) Riser report B) Mock draft C) Sleeper analysis D) Value gaps
- Do NOT output raw rows. Reference "the uploaded ADP board" and use query_adp tool for lookups.` as const;

// Deep Think Addendum
// Injected when the user enables Deep Think mode. Forces multi-step chain-of-thought
// reasoning, tool calls, and a complete structured analysis regardless of query length.
export const DEEP_THINK_ADDENDUM = `

## DEEP THINK MODE — ACTIVE (Grok 4)
Use full multi-step chain-of-thought reasoning. Do not summarize prematurely.

Before answering:
1. Call all relevant tools to gather fresh live data (odds, Kalshi, stats).
2. State your key assumptions explicitly.
3. Consider the strongest counter-argument to your conclusion.
4. Provide the complete structured analysis:
   **Key Facts → Reasoning → EV Calculation (show the math) → Recommendation → Risk Notes**

Depth and accuracy take priority over brevity in this mode.
` as const;

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
    In that case: output a prose response (not JSON) explaining the player wasn't found in the Statcast dataset
    and suggesting the user try a different name or ask about a top-tier player.
  - NEVER output a JSON card with "N/A" as any metric value. If you don't have real data, output prose.

STEP 2 — After the tool returns real data, output ONLY a single valid JSON object — NO prose, NO markdown, ONLY the JSON.
Choose the card type based on the query intent:
  - HR prop / home run odds         → hr_prop_card
  - Hits / singles / contact props  → statcast_summary_card  (lead with xBA, sweet-spot %, hard-hit %)
  - Game total / win probability    → game_simulation_card
  - Leaderboard / top-N ranking     → leaderboard_card
  - Pitcher analysis / strikeout K  → pitch_analysis_card
  - General player profile          → statcast_summary_card

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
7. If the tool result contains \`is_static_fallback: true\`, no NFBC/NFFC TSV has been uploaded yet. You MUST begin your response with: "⚠️ No live ADP data uploaded yet. The rankings below are ${NFBC_DRAFT_YEAR} pre-season consensus estimates. To get real NFBC/NFFC ADP: download the TSV from nfc.shgn.com/adp/baseball (or /football) and upload it using the Upload ADP card." Never present static fallback values as live NFBC data.

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

⛔ CRITICAL: Do NOT generate Statcast leaderboard cards (leaderboard_card, statcast_summary_card) or any xwOBA/exit-velocity data for draft questions. You are answering a fantasy draft question — use the \`query_adp\` tool and give ADP-based prose advice. Do not reference any Statcast metrics or Statcast CSV data for this query.

For NFL/NFFC queries, the same \`query_adp\` tool returns NFFC (National Fantasy Football Championship) Average Draft Position data. NFFC position codes: QB | RB | WR | TE | K | DEF. Always cite "NFFC ${NFBC_DRAFT_YEAR} NFL ADP" as the source for football queries.`;

// Injected when the user asks a start/sit or matchup question for any sport.
// Overrides the ADP/Statcast addendums to focus the AI on daily decision-making.
export const FANTASY_STARTSIT_ADDENDUM = `

## FANTASY START/SIT MODE — ACTIVE
The user is asking for a start/sit or matchup-based recommendation.

**Your job:** Give clear, direct START or SIT decisions with concise matchup reasoning.

### Response format
1. **Opening line** — one sentence summarising the key factor driving today's decisions (pitcher quality, park, weather, etc.).
2. **For each player or position discussed:**
   - **START** ✅ or **SIT** ❌ — bold, unambiguous recommendation.
   - 1–2 sentence matchup rationale: opponent pitcher tier, platoon advantage, park factor, recent form.
   - Projected fantasy output range where possible (e.g. "projects 18–22 pts in standard 5×5").
3. **Streaming pick** — name 1 SP or hitter widely available worth streaming this week.
4. **One-liner** — the single best play of the day/week at the bottom.

### Matchup factors to evaluate (use data from the player cards shown):
- **SP Tier**: Ace (T1) → Mid-rotation (T2) → Streamable (T3) → Avoid (T4)
- **Platoon edge**: L vs R or R vs L matchup worth ~10–15% fantasy uplift
- **Ballpark**: HR-friendly parks (Coors, GABP, Globe Life) vs pitcher-friendly (Petco, Oracle, Dodger)
- **Opponent lineup quality**: Weak lineup = strong streaming SP start; elite offense = sit borderline SP
- **Recent form**: Rolling 3-start ERA or 7-day hitting line matters more than season stats early in season
- **Weather**: Wind blowing out 15+ mph adds meaningful HR-environment boost

### Rules
- NEVER hedge with "it depends" as a final answer — commit to START or SIT.
- If two players are very close, note the edge briefly, then still name a winner.
- Do NOT output JSON or code blocks. Prose only.
- Cite the player cards alongside this response as your primary data source.
`;

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

// ── Status Badge Config ── Centralized status badge definitions used across all cards ──────────────
export const STATUS_BADGE_CONFIG = {
  target:  { label: 'TARGET',  dot: '#14b8a6', bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    text: 'text-teal-400',    headerGrad: 'from-teal-600/75 via-cyan-700/55 to-teal-900/35' },
  value:   { label: 'VALUE',   dot: '#10b981', bg: 'bg-emerald-500/10',  border: 'border-emerald-500/20',  text: 'text-emerald-400',  headerGrad: 'from-emerald-600/75 via-green-700/55 to-emerald-900/35' },
  sleeper: { label: 'SLEEPER', dot: '#8b5cf6', bg: 'bg-violet-500/10',   border: 'border-violet-500/20',   text: 'text-violet-400',   headerGrad: 'from-indigo-600/75 via-violet-700/55 to-indigo-900/35' },
  hot:     { label: 'HOT',     dot: '#ef4444', bg: 'bg-red-500/10',      border: 'border-red-500/20',      text: 'text-red-400',      headerGrad: 'from-red-600/75 via-rose-700/55 to-red-900/35' },
  alert:   { label: 'ALERT',   dot: '#f59e0b', bg: 'bg-amber-500/10',    border: 'border-amber-500/20',    text: 'text-amber-400',    headerGrad: 'from-amber-600/75 via-yellow-700/55 to-amber-900/35' },
  optimal: { label: 'OPTIMAL', dot: '#0ea5e9', bg: 'bg-sky-500/10',      border: 'border-sky-500/20',      text: 'text-sky-400',      headerGrad: 'from-sky-600/75 via-blue-700/55 to-sky-900/35' },
  elite:   { label: 'ELITE',   dot: '#a855f7', bg: 'bg-purple-500/10',   border: 'border-purple-500/20',   text: 'text-purple-400',   headerGrad: 'from-purple-600/75 via-violet-700/55 to-purple-900/35' },
  edge:    { label: 'EDGE',    dot: '#f97316', bg: 'bg-orange-500/10',   border: 'border-orange-500/20',   text: 'text-orange-400',   headerGrad: 'from-orange-600/75 via-amber-700/55 to-orange-900/35' },
  neutral: { label: 'PROJ',    dot: '#6b7280', bg: 'bg-gray-500/10',     border: 'border-gray-500/20',     text: 'text-gray-400',     headerGrad: 'from-slate-600/75 via-gray-700/55 to-slate-900/35' },
} as const;

export type StatusBadgeKey = keyof typeof STATUS_BADGE_CONFIG;

// ─── Free Tier Limits ─────────────────────────────────────────────────────────
export const FREE_TIER = {
  MESSAGE_LIMIT: parseInt(process.env.NEXT_PUBLIC_FREE_MESSAGE_LIMIT ?? '15', 10),
  CHAT_LIMIT:    parseInt(process.env.NEXT_PUBLIC_FREE_CHAT_LIMIT    ?? '10', 10),
} as const;

// ─── Settings UI Config ───────────────────────────────────────────────────────
export const SETTINGS_SPORTSBOOKS = [
  'DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'BetRivers', 'Barstool', 'WynnBET',
] as const;

export const SETTINGS_SPORTS = [
  'NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'EPL', 'MLS', 'UFC', 'Tennis',
] as const;

export const TIER_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  free:        { label: 'Free',        color: 'text-[var(--text-muted)]',   bg: 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]' },
  core:        { label: 'Core',        color: 'text-blue-400',              bg: 'bg-blue-500/20 border-blue-500/30' },
  pro:         { label: 'Pro',         color: 'text-purple-400',            bg: 'bg-purple-500/20 border-purple-500/30' },
  high_stakes: { label: 'High Stakes', color: 'text-yellow-400',            bg: 'bg-yellow-500/20 border-yellow-500/30' },
};

export const RISK_CONFIG = [
  { value: 'conservative', label: 'Conservative', emoji: '🛡️', desc: '~1–2% per bet',   color: 'text-blue-400',   border: 'border-blue-500/40',   bg: 'bg-blue-500/10' },
  { value: 'medium',       label: 'Medium',       emoji: '⚖️', desc: '~2–5% per bet',   color: 'text-yellow-400', border: 'border-yellow-500/40', bg: 'bg-yellow-500/10' },
  { value: 'aggressive',   label: 'Aggressive',   emoji: '🔥', desc: '~5–10% per bet',  color: 'text-red-400',    border: 'border-red-500/40',    bg: 'bg-red-500/10' },
] as const;

export const THEME_CONFIG = [
  { value: 'dark',   label: 'Dark',   emoji: '🌙' },
  { value: 'light',  label: 'Light',  emoji: '☀️' },
  { value: 'system', label: 'System', emoji: '💻' },
] as const;

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
