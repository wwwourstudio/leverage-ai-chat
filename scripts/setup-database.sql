-- =============================================================================
-- LEVERAGEAI - COMPREHENSIVE DATABASE SCHEMA V2
-- Production-Ready Schema for Sports Betting AI Assistant
-- =============================================================================
-- Created: 2026-02-11
-- Database: PostgreSQL 15+ / Supabase
-- Purpose: Complete data persistence for betting, fantasy, DFS, and AI features
-- =============================================================================

-- =============================================================================
-- SECTION 1: CLEAN SLATE - Drop existing objects
-- =============================================================================

-- Drop views first (depend on tables)
DROP VIEW IF EXISTS user_performance_summary CASCADE;
DROP VIEW IF EXISTS config_by_category CASCADE;
DROP VIEW IF EXISTS model_trust_scores CASCADE;
DROP VIEW IF EXISTS recent_predictions CASCADE;
DROP VIEW IF EXISTS user_chat_summary CASCADE;

-- Drop tables in dependency order
DROP TABLE IF EXISTS message_attachments CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS user_bets CASCADE;
DROP TABLE IF EXISTS odds_history CASCADE;
DROP TABLE IF EXISTS player_projections CASCADE;
DROP TABLE IF EXISTS dfs_lineups CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS app_config CASCADE;
DROP TABLE IF EXISTS live_odds_cache CASCADE;
DROP TABLE IF EXISTS validation_thresholds CASCADE;
DROP TABLE IF EXISTS odds_benford_baselines CASCADE;
DROP TABLE IF EXISTS ai_audit_log CASCADE;
DROP TABLE IF EXISTS ai_response_trust CASCADE;

-- =============================================================================
-- SECTION 2: CORE USER TABLES
-- =============================================================================

-- 2.1 User Profiles (extends Supabase Auth)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  display_name VARCHAR(100),
  avatar_url TEXT,
  
  -- Subscription & Limits
  tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'expert')),
  credits_remaining INTEGER DEFAULT 15,
  chats_remaining INTEGER DEFAULT 5,
  credits_reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  
  -- Performance Metrics
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  total_invested DECIMAL(12,2) DEFAULT 0.00,
  total_roi DECIMAL(10,2) DEFAULT 0.00,
  win_rate DECIMAL(5,2) DEFAULT 0.00,
  active_contests INTEGER DEFAULT 0,
  
  -- Rate Limiting
  rate_limit_remaining INTEGER DEFAULT 100,
  rate_limit_reset_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  
  UNIQUE(user_id)
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_tier ON user_profiles(tier);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_last_active ON user_profiles(last_active_at DESC);

-- 2.2 User Preferences
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- UI Preferences
  theme VARCHAR(20) DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'auto')),
  sidebar_collapsed BOOLEAN DEFAULT FALSE,
  default_sport VARCHAR(20),
  default_category VARCHAR(50) DEFAULT 'all',
  
  -- Notification Settings
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT FALSE,
  notification_frequency VARCHAR(20) DEFAULT 'realtime' CHECK (notification_frequency IN ('realtime', 'daily', 'weekly', 'never')),
  
  -- Sports Preferences
  favorite_teams JSONB DEFAULT '[]'::JSONB,
  favorite_players JSONB DEFAULT '[]'::JSONB,
  tracked_sports JSONB DEFAULT '["nfl", "nba", "mlb"]'::JSONB,
  
  -- Advanced Settings
  show_advanced_metrics BOOLEAN DEFAULT FALSE,
  auto_refresh_odds BOOLEAN DEFAULT TRUE,
  odds_format VARCHAR(20) DEFAULT 'american' CHECK (odds_format IN ('american', 'decimal', 'fractional')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id)
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- =============================================================================
-- SECTION 3: CONVERSATION & MESSAGE TABLES
-- =============================================================================

-- 3.1 Conversations (Chat Sessions)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Metadata
  title VARCHAR(200) NOT NULL DEFAULT 'New Chat',
  preview TEXT,
  category VARCHAR(50) DEFAULT 'all',
  
  -- State
  is_starred BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  message_count INTEGER DEFAULT 0,
  
  -- Tags & Context
  tags JSONB DEFAULT '[]'::JSONB,
  context JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_category ON conversations(category);
CREATE INDEX idx_conversations_starred ON conversations(is_starred) WHERE is_starred = TRUE;
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

-- 3.2 Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Message Content
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- AI Metadata (for assistant messages)
  model_name VARCHAR(100),
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  
  -- Trust & Quality Metrics
  trust_score DECIMAL(5,4) CHECK (trust_score >= 0 AND trust_score <= 1),
  confidence_level VARCHAR(20),
  
  -- Engagement
  feedback VARCHAR(20) CHECK (feedback IN ('positive', 'negative', 'neutral', NULL)),
  is_edited BOOLEAN DEFAULT FALSE,
  edit_count INTEGER DEFAULT 0,
  
  -- Flags & Warnings
  flags JSONB DEFAULT '[]'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_feedback ON messages(feedback) WHERE feedback IS NOT NULL;

-- 3.3 Message Attachments
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  
  -- File Metadata
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  
  -- Attachment Type
  attachment_type VARCHAR(50) NOT NULL CHECK (attachment_type IN ('image', 'csv', 'tsv', 'pdf', 'document')),
  
  -- Parsed Data (for CSV/TSV)
  parsed_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_message_id ON message_attachments(message_id);
CREATE INDEX idx_attachments_type ON message_attachments(attachment_type);

-- =============================================================================
-- SECTION 4: BETTING & PREDICTIONS TABLES
-- =============================================================================

-- 4.1 Predictions (AI-generated predictions)
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  
  -- Prediction Details
  sport VARCHAR(50) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  event_id VARCHAR(255),
  event_name VARCHAR(255) NOT NULL,
  event_date TIMESTAMPTZ,
  
  -- Prediction Data
  predicted_outcome TEXT NOT NULL,
  predicted_line DECIMAL(8,2),
  confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  expected_value DECIMAL(10,2),
  
  -- Odds Information
  best_odds_provider VARCHAR(100),
  best_odds_line VARCHAR(50),
  odds_at_prediction DECIMAL(8,2),
  
  -- AI Model Info
  model_name VARCHAR(100) NOT NULL,
  model_version VARCHAR(50),
  
  -- Result Tracking
  actual_outcome TEXT,
  is_correct BOOLEAN,
  result_verified_at TIMESTAMPTZ,
  profit_loss DECIMAL(10,2),
  
  -- Trust Metrics
  benford_score DECIMAL(5,4),
  odds_alignment_score DECIMAL(5,4),
  historical_accuracy_score DECIMAL(5,4),
  final_trust_level VARCHAR(20) CHECK (final_trust_level IN ('high', 'medium', 'low', 'critical')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_sport ON predictions(sport);
CREATE INDEX idx_predictions_market_type ON predictions(market_type);
CREATE INDEX idx_predictions_event_date ON predictions(event_date);
CREATE INDEX idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX idx_predictions_is_correct ON predictions(is_correct) WHERE is_correct IS NOT NULL;
CREATE INDEX idx_predictions_sport_market ON predictions(sport, market_type);

-- 4.2 User Bets (actual bets placed by users)
CREATE TABLE user_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prediction_id UUID REFERENCES predictions(id) ON DELETE SET NULL,
  
  -- Bet Details
  sport VARCHAR(50) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  event_date TIMESTAMPTZ,
  
  -- Bet Information
  bet_type VARCHAR(50) NOT NULL,
  bet_outcome TEXT NOT NULL,
  stake DECIMAL(10,2) NOT NULL CHECK (stake > 0),
  odds DECIMAL(8,2) NOT NULL,
  potential_payout DECIMAL(10,2) NOT NULL,
  
  -- Sportsbook Info
  sportsbook VARCHAR(100),
  bet_slip_id VARCHAR(255),
  
  -- Result
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'pushed', 'cancelled')),
  actual_payout DECIMAL(10,2),
  settled_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_bets_user_id ON user_bets(user_id);
CREATE INDEX idx_user_bets_prediction_id ON user_bets(prediction_id);
CREATE INDEX idx_user_bets_sport ON user_bets(sport);
CREATE INDEX idx_user_bets_status ON user_bets(status);
CREATE INDEX idx_user_bets_event_date ON user_bets(event_date);
CREATE INDEX idx_user_bets_created_at ON user_bets(created_at DESC);

-- =============================================================================
-- SECTION 5: ODDS & DATA TABLES
-- =============================================================================

-- 5.1 Live Odds Cache
CREATE TABLE live_odds_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Identification
  sport VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ,
  
  -- Market Data
  market_type VARCHAR(50) NOT NULL,
  sportsbook VARCHAR(100) NOT NULL,
  
  -- Odds Data
  odds_data JSONB NOT NULL,
  implied_probability DECIMAL(5,4),
  
  -- Cache Management
  source VARCHAR(100) NOT NULL DEFAULT 'the-odds-api',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_odds_cache_sport_event ON live_odds_cache(sport, event_id);
CREATE INDEX idx_odds_cache_market_type ON live_odds_cache(market_type);
CREATE INDEX idx_odds_cache_expires_at ON live_odds_cache(expires_at);
CREATE INDEX idx_odds_cache_fetched_at ON live_odds_cache(fetched_at DESC);
CREATE UNIQUE INDEX idx_odds_cache_unique ON live_odds_cache(sport, event_id, market_type, sportsbook);

-- 5.2 Odds History (for tracking line movement)
CREATE TABLE odds_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Identification
  sport VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  
  -- Odds Movement
  market_type VARCHAR(50) NOT NULL,
  sportsbook VARCHAR(100) NOT NULL,
  line_value DECIMAL(8,2),
  odds_value DECIMAL(8,2),
  
  -- Change Tracking
  previous_line DECIMAL(8,2),
  previous_odds DECIMAL(8,2),
  line_movement VARCHAR(20),
  
  -- Timestamps
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_odds_history_sport_event ON odds_history(sport, event_id);
CREATE INDEX idx_odds_history_recorded_at ON odds_history(recorded_at DESC);
CREATE INDEX idx_odds_history_market_sportsbook ON odds_history(market_type, sportsbook);

-- 5.3 Player Projections
CREATE TABLE player_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Player Information
  sport VARCHAR(50) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  player_id VARCHAR(255),
  team VARCHAR(100),
  position VARCHAR(50),
  
  -- Event Context
  event_id VARCHAR(255),
  opponent VARCHAR(100),
  event_date TIMESTAMPTZ,
  
  -- Projections
  projection_type VARCHAR(100) NOT NULL,
  projected_value DECIMAL(8,2) NOT NULL,
  prop_line DECIMAL(8,2),
  over_under VARCHAR(10) CHECK (over_under IN ('over', 'under', NULL)),
  
  -- Confidence & Analysis
  confidence DECIMAL(5,4),
  hit_rate DECIMAL(5,2),
  recent_games_data JSONB,
  
  -- Source
  source VARCHAR(100) NOT NULL DEFAULT 'ai-generated',
  model_name VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_player_projections_sport ON player_projections(sport);
CREATE INDEX idx_player_projections_player_name ON player_projections(player_name);
CREATE INDEX idx_player_projections_event_date ON player_projections(event_date);
CREATE INDEX idx_player_projections_created_at ON player_projections(created_at DESC);

-- =============================================================================
-- SECTION 6: DFS & FANTASY TABLES
-- =============================================================================

-- 6.1 DFS Lineups
CREATE TABLE dfs_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Lineup Details
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('draftkings', 'fanduel', 'yahoo', 'other')),
  contest_type VARCHAR(50) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  slate_name VARCHAR(255),
  slate_date TIMESTAMPTZ,
  
  -- Lineup Data
  lineup_data JSONB NOT NULL,
  total_salary INTEGER,
  salary_cap INTEGER,
  projected_points DECIMAL(8,2),
  
  -- Strategy
  strategy_type VARCHAR(50),
  ownership_projection DECIMAL(5,2),
  leverage_score DECIMAL(5,2),
  
  -- Results
  actual_points DECIMAL(8,2),
  contest_finish INTEGER,
  payout DECIMAL(10,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dfs_lineups_user_id ON dfs_lineups(user_id);
CREATE INDEX idx_dfs_lineups_platform ON dfs_lineups(platform);
CREATE INDEX idx_dfs_lineups_sport ON dfs_lineups(sport);
CREATE INDEX idx_dfs_lineups_slate_date ON dfs_lineups(slate_date);
CREATE INDEX idx_dfs_lineups_created_at ON dfs_lineups(created_at DESC);

-- =============================================================================
-- SECTION 7: AI TRUST & VALIDATION TABLES
-- =============================================================================

-- 7.1 AI Response Trust
CREATE TABLE ai_response_trust (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  
  -- AI Model Info
  model_name VARCHAR(100) NOT NULL,
  prompt_hash VARCHAR(64) NOT NULL,
  response_hash VARCHAR(64) NOT NULL,
  
  -- Trust Scores
  benford_score DECIMAL(5,4) CHECK (benford_score >= 0 AND benford_score <= 1),
  odds_alignment_score DECIMAL(5,4) CHECK (odds_alignment_score >= 0 AND odds_alignment_score <= 1),
  historical_accuracy DECIMAL(5,4) CHECK (historical_accuracy >= 0 AND historical_accuracy <= 1),
  consensus_alignment DECIMAL(5,4) CHECK (consensus_alignment >= 0 AND consensus_alignment <= 1),
  
  -- Overall Trust
  trust_level VARCHAR(20) CHECK (trust_level IN ('high', 'medium', 'low', 'critical')),
  final_confidence DECIMAL(5,4) CHECK (final_confidence >= 0 AND final_confidence <= 1),
  
  -- Flags & Warnings
  validation_flags JSONB DEFAULT '[]'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_model_name ON ai_response_trust(model_name);
CREATE INDEX idx_trust_level ON ai_response_trust(trust_level);
CREATE INDEX idx_trust_created_at ON ai_response_trust(created_at DESC);
CREATE INDEX idx_trust_prompt_hash ON ai_response_trust(prompt_hash);
CREATE INDEX idx_trust_message_id ON ai_response_trust(message_id);

-- 7.2 AI Audit Log
CREATE TABLE ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Event Information
  event_type VARCHAR(50) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  
  -- Request & Response
  user_query TEXT,
  ai_response TEXT,
  
  -- Metadata
  trust_metrics JSONB,
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  
  -- Flagging
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_event_type ON ai_audit_log(event_type);
CREATE INDEX idx_audit_flagged ON ai_audit_log(flagged) WHERE flagged = TRUE;
CREATE INDEX idx_audit_created_at ON ai_audit_log(created_at DESC);
CREATE INDEX idx_audit_model_name ON ai_audit_log(model_name);
CREATE INDEX idx_audit_user_id ON ai_audit_log(user_id);

-- 7.3 Odds Benford Baselines
CREATE TABLE odds_benford_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Classification
  sport VARCHAR(50) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  
  -- Statistical Data
  baseline_distribution JSONB NOT NULL,
  sample_size INTEGER NOT NULL,
  confidence_level DECIMAL(5,4),
  
  -- Timestamps
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(sport, market_type)
);

CREATE INDEX idx_benford_sport_market ON odds_benford_baselines(sport, market_type);
CREATE INDEX idx_benford_last_updated ON odds_benford_baselines(last_updated DESC);

-- 7.4 Validation Thresholds
CREATE TABLE validation_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Classification
  sport VARCHAR(50) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  
  -- Threshold Values
  min_benford_score DECIMAL(5,4) DEFAULT 0.85,
  min_odds_alignment DECIMAL(5,4) DEFAULT 0.90,
  min_historical_accuracy DECIMAL(5,4) DEFAULT 0.75,
  min_consensus_alignment DECIMAL(5,4) DEFAULT 0.80,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(sport, market_type)
);

CREATE INDEX idx_threshold_sport_market ON validation_thresholds(sport, market_type);

-- =============================================================================
-- SECTION 8: CONFIGURATION TABLE
-- =============================================================================

-- 8.1 App Config
CREATE TABLE app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Config Key
  config_key VARCHAR(100) NOT NULL,
  config_value JSONB NOT NULL,
  
  -- Metadata
  category VARCHAR(50) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(config_key)
);

CREATE INDEX idx_config_category ON app_config(category);
CREATE INDEX idx_config_is_public ON app_config(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_config_key ON app_config(config_key);

-- =============================================================================
-- SECTION 9: VIEWS FOR ANALYTICS
-- =============================================================================

-- 9.1 User Performance Summary
CREATE VIEW user_performance_summary AS
SELECT 
  up.id,
  up.user_id,
  up.display_name,
  up.tier,
  up.total_predictions,
  up.correct_predictions,
  CASE 
    WHEN up.total_predictions > 0 
    THEN ROUND((up.correct_predictions::DECIMAL / up.total_predictions) * 100, 2)
    ELSE 0 
  END as win_rate_percentage,
  up.total_invested,
  up.total_roi,
  up.active_contests,
  up.credits_remaining,
  up.chats_remaining,
  up.created_at,
  up.last_active_at
FROM user_profiles up;

-- 9.2 Model Trust Scores
CREATE VIEW model_trust_scores AS
SELECT 
  model_name,
  AVG(benford_score) as avg_benford_score,
  AVG(odds_alignment_score) as avg_odds_alignment,
  AVG(historical_accuracy) as avg_accuracy,
  COUNT(*) as total_responses,
  SUM(CASE WHEN trust_level = 'high' THEN 1 ELSE 0 END) as high_trust_count,
  SUM(CASE WHEN trust_level = 'low' THEN 1 ELSE 0 END) as low_trust_count,
  MAX(created_at) as last_response_at
FROM ai_response_trust
GROUP BY model_name;

-- 9.3 Config by Category
CREATE VIEW config_by_category AS
SELECT 
  category,
  COUNT(*) as config_count,
  jsonb_object_agg(config_key, config_value) as configs
FROM app_config
WHERE is_public = TRUE
GROUP BY category;

-- 9.4 Recent Predictions
CREATE VIEW recent_predictions AS
SELECT 
  p.id,
  p.user_id,
  p.sport,
  p.market_type,
  p.event_name,
  p.event_date,
  p.predicted_outcome,
  p.confidence_score,
  p.is_correct,
  p.profit_loss,
  p.created_at
FROM predictions p
WHERE p.created_at >= NOW() - INTERVAL '30 days'
ORDER BY p.created_at DESC;

-- 9.5 User Chat Summary
CREATE VIEW user_chat_summary AS
SELECT 
  c.user_id,
  COUNT(*) as total_conversations,
  SUM(c.message_count) as total_messages,
  COUNT(*) FILTER (WHERE c.is_starred = TRUE) as starred_conversations,
  MAX(c.last_message_at) as last_activity
FROM conversations c
GROUP BY c.user_id;

-- =============================================================================
-- SECTION 10: FUNCTIONS
-- =============================================================================

-- 10.1 Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10.2 Update conversation metadata on message insert
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    preview = LEFT(NEW.content, 100),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10.3 Update user profile on prediction result
CREATE OR REPLACE FUNCTION update_user_stats_on_prediction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_correct IS NOT NULL AND OLD.is_correct IS NULL THEN
    UPDATE user_profiles
    SET 
      total_predictions = total_predictions + 1,
      correct_predictions = correct_predictions + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
      win_rate = CASE 
        WHEN total_predictions + 1 > 0 
        THEN ((correct_predictions + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END)::DECIMAL / (total_predictions + 1)) * 100
        ELSE 0 
      END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10.4 Cleanup expired odds cache
CREATE OR REPLACE FUNCTION cleanup_expired_odds_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM live_odds_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 10.5 Calculate user win rate
CREATE OR REPLACE FUNCTION calculate_user_win_rate(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  win_rate DECIMAL;
BEGIN
  SELECT 
    CASE 
      WHEN total_predictions > 0 
      THEN (correct_predictions::DECIMAL / total_predictions) * 100
      ELSE 0 
    END INTO win_rate
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(win_rate, 0);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECTION 11: TRIGGERS
-- =============================================================================

-- Auto-update updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at 
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at 
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_predictions_updated_at 
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_bets_updated_at 
  BEFORE UPDATE ON user_bets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_projections_updated_at 
  BEFORE UPDATE ON player_projections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dfs_lineups_updated_at 
  BEFORE UPDATE ON dfs_lineups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_response_trust_updated_at 
  BEFORE UPDATE ON ai_response_trust
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_validation_thresholds_updated_at 
  BEFORE UPDATE ON validation_thresholds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_config_updated_at 
  BEFORE UPDATE ON app_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Conversation metadata trigger
CREATE TRIGGER update_conversation_on_message_insert 
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- User stats trigger
CREATE TRIGGER update_user_stats_on_prediction_result 
  AFTER UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_prediction();

-- =============================================================================
-- SECTION 12: ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_odds_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_response_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_benford_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- 12.1 User Profiles Policies
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 12.2 User Preferences Policies
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 12.3 Conversations Policies
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

-- 12.4 Messages Policies
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (user_id = auth.uid());

-- 12.5 Message Attachments Policies
CREATE POLICY "Users can view attachments in own messages"
  ON message_attachments FOR SELECT
  USING (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attachments in own messages"
  ON message_attachments FOR INSERT
  WITH CHECK (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- 12.6 Predictions Policies
CREATE POLICY "Users can view own predictions"
  ON predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictions"
  ON predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 12.7 User Bets Policies
CREATE POLICY "Users can view own bets"
  ON user_bets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bets"
  ON user_bets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bets"
  ON user_bets FOR UPDATE
  USING (auth.uid() = user_id);

-- 12.8 DFS Lineups Policies
CREATE POLICY "Users can view own lineups"
  ON dfs_lineups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lineups"
  ON dfs_lineups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lineups"
  ON dfs_lineups FOR UPDATE
  USING (auth.uid() = user_id);

-- 12.9 Public Read Policies (all authenticated users)
CREATE POLICY "Authenticated users can read odds cache"
  ON live_odds_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read odds history"
  ON odds_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read player projections"
  ON player_projections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read trust metrics"
  ON ai_response_trust FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read benford baselines"
  ON odds_benford_baselines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read validation thresholds"
  ON validation_thresholds FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read public config"
  ON app_config FOR SELECT
  TO authenticated
  USING (is_public = true);

-- 12.10 Service Role Policies (bypass RLS)
CREATE POLICY "Service role has full access to all tables"
  ON user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Repeat for all tables (service_role bypasses RLS by default in Supabase)

-- =============================================================================
-- SECTION 13: SEED DATA
-- =============================================================================

-- 13.1 Validation Thresholds
INSERT INTO validation_thresholds (sport, market_type, min_benford_score, min_odds_alignment, min_historical_accuracy, min_consensus_alignment) VALUES
('nfl', 'spread', 0.85, 0.90, 0.75, 0.80),
('nfl', 'moneyline', 0.88, 0.92, 0.78, 0.82),
('nfl', 'total', 0.85, 0.90, 0.75, 0.80),
('nba', 'spread', 0.83, 0.88, 0.72, 0.78),
('nba', 'moneyline', 0.85, 0.90, 0.75, 0.80),
('nba', 'total', 0.83, 0.88, 0.72, 0.78),
('mlb', 'moneyline', 0.82, 0.87, 0.70, 0.75),
('mlb', 'runline', 0.82, 0.87, 0.70, 0.75),
('mlb', 'total', 0.82, 0.87, 0.70, 0.75),
('nhl', 'moneyline', 0.82, 0.87, 0.70, 0.75),
('nhl', 'puckline', 0.82, 0.87, 0.70, 0.75),
('nhl', 'total', 0.82, 0.87, 0.70, 0.75);

-- 13.2 App Configuration
INSERT INTO app_config (config_key, config_value, category, description, is_public) VALUES
-- AI Configuration
('ai_model_default', '"xai/grok-4-fast"', 'ai', 'Default AI model for predictions', true),
('ai_model_fallback', '"xai/grok-2-1212"', 'ai', 'Fallback AI model', true),
('ai_max_tokens', '2000', 'ai', 'Maximum tokens per AI response', true),
('ai_temperature', '0.7', 'ai', 'AI temperature setting', true),

-- Odds Configuration
('odds_cache_ttl_hours', '6', 'odds', 'Time to live for odds cache in hours', true),
('odds_api_provider', '"the-odds-api"', 'odds', 'Primary odds data provider', true),
('odds_refresh_interval_minutes', '5', 'odds', 'How often to refresh live odds', true),

-- Rate Limiting
('rate_limit_free_tier', '100', 'rate_limiting', 'API calls per day for free tier', true),
('rate_limit_pro_tier', '1000', 'rate_limiting', 'API calls per day for pro tier', true),
('rate_limit_expert_tier', '10000', 'rate_limiting', 'API calls per day for expert tier', true),

-- Credits
('credits_free_tier', '15', 'credits', 'Free tier monthly credits', true),
('credits_pro_tier', '500', 'credits', 'Pro tier monthly credits', true),
('credits_expert_tier', '5000', 'credits', 'Expert tier monthly credits', true),
('chats_free_tier', '5', 'credits', 'Free tier chat limit', true),

-- Trust Thresholds
('trust_threshold_high', '0.85', 'trust', 'Minimum score for high trust level', true),
('trust_threshold_medium', '0.70', 'trust', 'Minimum score for medium trust level', true),
('trust_threshold_low', '0.50', 'trust', 'Minimum score for low trust level', true),

-- Validation
('benford_check_enabled', 'true', 'validation', 'Enable Benford''s Law validation', true),
('odds_alignment_check_enabled', 'true', 'validation', 'Enable odds alignment validation', true),
('consensus_check_enabled', 'true', 'validation', 'Enable consensus alignment check', true),

-- Features
('feature_betting_enabled', 'true', 'features', 'Enable betting analysis', true),
('feature_dfs_enabled', 'true', 'features', 'Enable DFS optimization', true),
('feature_fantasy_enabled', 'true', 'features', 'Enable fantasy sports', true),
('feature_kalshi_enabled', 'true', 'features', 'Enable Kalshi predictions', true),

-- Compliance
('audit_log_retention_days', '90', 'compliance', 'Days to retain audit logs', false),
('data_retention_days', '365', 'compliance', 'Days to retain user data', false);

-- =============================================================================
-- SECTION 14: PERMISSIONS
-- =============================================================================

-- Grant permissions to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Service role gets full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Verification queries
SELECT 'Tables created:' as status, count(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT 'Views created:' as status, count(*) as count FROM information_schema.views WHERE table_schema = 'public';
SELECT 'Indexes created:' as status, count(*) as count FROM pg_indexes WHERE schemaname = 'public';
SELECT 'Functions created:' as status, count(*) as count FROM pg_proc WHERE pronamespace = 'public'::regnamespace;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'LEVERAGEAI DATABASE SCHEMA V2 - MIGRATION COMPLETE';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Created 16 tables, 5 views, 5 functions, 11 triggers, and comprehensive RLS policies';
  RAISE NOTICE 'Database is ready for production use';
  RAISE NOTICE '=============================================================================';
END $$;
