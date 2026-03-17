-- Performance Optimization Indexes
-- Run this script AFTER master-schema.sql to improve query performance
-- All tables live in the 'api' schema
-- Date: February 2026

SET search_path TO api;

-- ============================================
-- ai_response_trust Optimization
-- Columns: id, query_hash, response_content, trust_score, consensus_score,
--          data_sources, validation_method, created_at
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ai_response_trust_query_hash
  ON ai_response_trust(query_hash);

CREATE INDEX IF NOT EXISTS idx_ai_response_trust_score
  ON ai_response_trust(trust_score DESC);

CREATE INDEX IF NOT EXISTS idx_ai_response_trust_created_at
  ON ai_response_trust(created_at DESC);

-- ============================================
-- live_odds_cache Optimization
-- Columns: id, sport, sport_key, game_id, home_team, away_team,
--          commence_time, bookmakers, markets, cached_at, expires_at
-- NOTE: no market_type column (data lives in markets JSONB); no updated_at
-- ============================================

CREATE INDEX IF NOT EXISTS idx_live_odds_cache_sport_key
  ON live_odds_cache(sport_key);

CREATE INDEX IF NOT EXISTS idx_live_odds_cache_sport
  ON live_odds_cache(sport);

CREATE INDEX IF NOT EXISTS idx_live_odds_cache_expires_at
  ON live_odds_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_live_odds_cache_cached_at
  ON live_odds_cache(cached_at DESC);

-- ============================================
-- user_profiles Optimization
-- Columns: id, user_id, subscription_tier, credits_remaining, created_at, updated_at
-- NOTE: no email column
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id
  ON user_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_tier
  ON user_profiles(subscription_tier);

-- ============================================
-- bet_allocations Optimization
-- ============================================

CREATE INDEX IF NOT EXISTS idx_bet_allocations_status
  ON bet_allocations(status);

CREATE INDEX IF NOT EXISTS idx_bet_allocations_sport
  ON bet_allocations(sport);

CREATE INDEX IF NOT EXISTS idx_bet_allocations_market
  ON bet_allocations(market_id);

-- ============================================
-- historical_games Optimization
-- ============================================

CREATE INDEX IF NOT EXISTS idx_historical_sport
  ON historical_games(sport);

CREATE INDEX IF NOT EXISTS idx_historical_date
  ON historical_games(game_date DESC);

-- ============================================
-- line_movement Optimization
-- ============================================

CREATE INDEX IF NOT EXISTS idx_line_movement_game_id
  ON line_movement(game_id);

CREATE INDEX IF NOT EXISTS idx_line_movement_sport
  ON line_movement(sport);

-- ============================================
-- odds_history Table + Indexes
-- (Optional historical price tracking table)
-- ============================================

CREATE TABLE IF NOT EXISTS odds_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     TEXT        NOT NULL,
  sport        TEXT        NOT NULL,
  bookmaker    TEXT        NOT NULL,
  market_type  TEXT        NOT NULL,
  outcome      TEXT,
  price        DECIMAL     NOT NULL,
  point        DECIMAL,
  timestamp    TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odds_history_event_id
  ON odds_history(event_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_odds_history_sport
  ON odds_history(sport, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_odds_history_bookmaker
  ON odds_history(bookmaker, timestamp DESC);

-- ============================================
-- nfbc_adp Optimization
-- Columns: id, rank, player_name, display_name, adp, positions, team,
--          value_delta, is_value_pick, auction_value, sport, fetched_at
-- ============================================

-- Primary access pattern: fetch all rows for a sport ordered by rank
-- (loadADPFromSupabase → .eq('sport', sport).order('rank').limit(300))
CREATE INDEX IF NOT EXISTS idx_nfbc_adp_sport_rank
  ON api.nfbc_adp (sport, rank ASC);

-- Full-text search on display_name for AI tool player lookups
CREATE INDEX IF NOT EXISTS idx_nfbc_adp_display_name
  ON api.nfbc_adp USING gin (to_tsvector('english', display_name));

-- Value-pick filter (queryADP valueOnly path)
CREATE INDEX IF NOT EXISTS idx_nfbc_adp_value_pick
  ON api.nfbc_adp (sport, is_value_pick) WHERE is_value_pick = true;

-- ============================================
-- Update table statistics for query planner
-- ============================================

ANALYZE ai_response_trust;
ANALYZE live_odds_cache;
ANALYZE bet_allocations;
ANALYZE historical_games;
ANALYZE line_movement;
ANALYZE api.nfbc_adp;
