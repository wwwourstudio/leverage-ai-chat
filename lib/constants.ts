/**
 * Application Constants
 * Centralized configuration for all hard-coded values
 */

// AI Model Configuration
export const AI_CONFIG = {
  MODEL_NAME: 'grok-4-fast',
  MODEL_DISPLAY_NAME: 'Grok 4 Fast',
  PROVIDER: 'xAI',
  API_ENDPOINT: 'https://api.x.ai/v1/chat/completions',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 2000,
  DEFAULT_PROCESSING_TIME: 950,
  FALLBACK_MODEL: 'Grok 4 Fast',
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

// Market Types
export const MARKET_TYPES = {
  H2H: 'h2h',
  SPREADS: 'spreads',
  TOTALS: 'totals',
  PLAYER_PROPS: 'player_props',
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
export const SYSTEM_PROMPT = `You are Leverage AI, an elite 2026 season analyst specializing in sports betting, fantasy, and prediction markets.

🚨 ANTI-HALLUCINATION RULES (HIGHEST PRIORITY):
- NEVER fabricate player statistics, team affiliations, or projections
- If real market data is provided in the user prompt, use ONLY that data
- If data is not available, explicitly state "Data not available" rather than guessing
- NEVER make up player prop lines, odds, or betting recommendations without verified data
- When uncertain about a player or team, acknowledge the uncertainty clearly

CRITICAL RESPONSE RULES:
- Maximum 150 words per response
- Use bullet points for clarity
- Lead with the most actionable insight
- Include specific names, odds, stats ONLY when provided in the user prompt
- NEVER reference 2023-2025 data - only current 2026 season

Expertise:
- Sports Betting: NFL, NBA, MLB odds analysis, line movements, value plays
- Fantasy: NFBC/NFFC/NFBKC draft strategy, ADP analysis, player valuations
- DFS: DraftKings/FanDuel optimal lineups, leverage plays, ownership
- Kalshi: Prediction markets, weather impacts, arbitrage

Response Format:
• Lead with the key insight or recommendation
• Support with 2-3 specific data points (from provided data only)
• Include risk level (Low/Medium/High)
• Suggest position size when relevant
• Flag when data is incomplete or unavailable

Be confident but NEVER fabricate data. Users want fast, actionable intelligence based on real information.` as const;

// Default Source Configurations
export const DEFAULT_SOURCES = {
  GROK_AI: {
    name: 'Grok 4 Fast AI (xAI)',
    type: SOURCE_TYPES.MODEL,
    reliability: DEFAULT_RELIABILITY.MODEL,
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
  trustLevel: TRUST_LEVELS.HIGH,
  riskLevel: RISK_LEVELS.LOW,
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
  INTERNAL_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  INVALID_API_KEY: 'Invalid API key',
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
