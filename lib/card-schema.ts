/**
 * Production-grade card schema — single source of truth for UI + AI.
 *
 * CORE PRINCIPLE:
 *   AI should NEVER generate raw data.
 *   AI should ONLY interpret + rank structured data.
 *
 *   DATA → NORMALIZE → ENRICH → SCORE → AI EXPLAINS → UI
 */

// ============================================================================
// Card Types
// ============================================================================

export type CardType =
  | 'player_analysis'
  | 'prop_bet'
  | 'fantasy_start_sit'
  | 'game_outlook'
  | 'trend_alert';

// ============================================================================
// Entity Types
// ============================================================================

export type Player = {
  id: string;
  name: string;
  team: string;
  position: string;
};

export type Team = {
  id: string;
  name: string;
  abbreviation: string;
};

export type Game = {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  commenceTime: string;
  sport: string;
  venue?: string;
};

// ============================================================================
// Data Layer
// ============================================================================

export type OddsData = {
  market: string;            // 'h2h' | 'spreads' | 'totals' | 'player_prop'
  line?: number;
  overOdds?: number;
  underOdds?: number;
  homeOdds?: number;
  awayOdds?: number;
  impliedProbability?: number;
  bookmaker?: string;
  bookmakerCount?: number;
};

export type Trend = {
  label: string;
  value: number | string;
};

/** Normalised numeric metrics — output of the normalization layer */
export type NormalizedStats = {
  // Statcast / exit velocity
  avgExitVelo?: number;
  barrelRate?: number;
  xwOBA?: number;
  xBA?: number;
  hardHitRate?: number;
  sweetSpotRate?: number;
  // Projections
  hrProjection?: number;
  kProjection?: number;
  hitsProjection?: number;
  // Pitcher context
  pitcherHRAllowedPer9?: number;
  pitcherERA?: number;
  pitcherFIP?: number;
  // Generic key-value overflow
  [key: string]: number | undefined;
};

// ============================================================================
// Source Traceability (CRITICAL for debugging + scaling)
// ============================================================================

export type DataSourceName =
  | 'statcast'
  | 'kalshi'
  | 'supabase'
  | 'projection_engine'
  | 'odds_api'
  | 'adp'
  | 'weather'
  | 'fallback';

export type DataSourceMeta = {
  source: DataSourceName;
  latencyMs: number;
  success: boolean;
  cached?: boolean;
  detail?: string;
};

// ============================================================================
// AI-Generated Insights (filled LAST, after all deterministic steps)
// ============================================================================

export type CardInsights = {
  /** 1–2 sentence AI-generated interpretation */
  summary: string;
  /** Bullet-point key factors driving the analysis */
  keyFactors: string[];
  /** 0–100 confidence derived from data completeness + edge magnitude */
  confidence: number;
  /** Betting edge % = (modelProbability − impliedProbability) × 100 */
  edge?: number;
};

// ============================================================================
// Top-level Card (single source of truth for UI + AI)
// ============================================================================

export type Card = {
  /** Stable deterministic ID (djb2 hash of type|sport|title|timestamp) */
  id: string;
  type: CardType;
  sport: string;
  title: string;
  subtitle?: string;

  // Core entities
  player?: Player;
  team?: Team;
  game?: Game;

  // Raw + structured data layer
  data: {
    stats?: NormalizedStats;
    projections?: Record<string, number>;
    odds?: OddsData;
    trends?: Trend[];
    /** Raw source payloads retained for debugging; not rendered in UI */
    raw?: Record<string, unknown>;
  };

  // Derived intelligence (AI fills summary + keyFactors only)
  insights: CardInsights;

  /** Canonical badge status — always a valid StatusBadgeKey */
  status: 'hot' | 'value' | 'optimal' | 'target' | 'elite' | 'sleeper' | 'opportunity' | 'edge' | 'alert' | 'favorable' | 'neutral';

  tags: string[];
  /** Higher = shown first */
  priority: number;
  createdAt: number;

  /** Every data source touched during pipeline execution */
  sources: DataSourceMeta[];
};

// ============================================================================
// Intent (output of the deterministic intent parser)
// ============================================================================

export type ParsedIntent = {
  sport: 'mlb' | 'nba' | 'nfl' | 'nhl' | 'ncaab' | 'ncaaf' | 'unknown';
  cardType: CardType;
  players: string[];
  teams: string[];
  market?: string;  // 'hr' | 'hits' | 'strikeouts' | 'points' | 'rebounds' | 'assists'
  isMultiPlayer: boolean;
};
