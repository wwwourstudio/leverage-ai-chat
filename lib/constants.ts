/**
 * Application Constants
 * Centralized configuration for all hard-coded values
 */

// AI Model Configuration
export const AI_CONFIG = {
  MODEL_NAME: 'grok-4',
  MODEL_DISPLAY_NAME: 'Grok 4',
  PROVIDER: 'xAI',
  API_ENDPOINT: 'https://api.x.ai/v1/chat/completions',
  DEFAULT_TEMPERATURE: 0.4, // Balanced between factual accuracy and useful responses
  DEFAULT_MAX_TOKENS: 450, // Concise, direct responses
  DEFAULT_PROCESSING_TIME: 950,
  FALLBACK_MODEL: 'Grok 4',
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
    CORE_PRICE_MONTHLY: 49,
    PRO_PRICE_MONTHLY: 149,
    HIGH_STAKES_PRICE_YEARLY: 999,
  },
  INJURY_ALERT_DELAY_FREE_MS: 5 * 60 * 1000,
} as const;

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
  [ANALYSIS_CATEGORIES.FANTASY]: 'Fantasy (NFC)',
  [ANALYSIS_CATEGORIES.DFS]: 'DFS',
  [ANALYSIS_CATEGORIES.KALSHI]: 'Kalshi Markets',
} as const;

// Analysis Title Templates
export const ANALYSIS_TITLES = {
  [ANALYSIS_CATEGORIES.ALL]: 'New Analysis',
  [ANALYSIS_CATEGORIES.BETTING]: 'New Sports Betting Analysis',
  [ANALYSIS_CATEGORIES.FANTASY]: 'New Fantasy (NFC) Analysis',
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
export const SYSTEM_PROMPT = `You are Leverage AI, an elite sports betting and prediction markets analyst powered by Grok (xAI). Current date: 2026.

ANSWER FORMAT — always follow this order:
1. Lead with your direct pick, recommendation, or answer on the very first line — no preamble or hedging
2. Follow with 2–4 supporting bullets: specific numbers, key reasoning, and the edge
3. Max 200 words total. Be sharp and decisive, not verbose.

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

NEVER say "I cannot provide analysis" or "real-time data unavailable" for general strategy questions. If you genuinely need one piece of info to be specific, ask ONE focused question.` as const;

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
