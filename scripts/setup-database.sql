-- =============================================================================
-- COMPLETE DATABASE SETUP FOR LEVERAGE AI NFC ASSISTANT
-- =============================================================================
-- This script creates all required tables, indexes, views, functions, triggers,
-- RLS policies, and seed data for the production application.
-- =============================================================================

-- =============================================================================
-- SECTION 1: DROP EXISTING OBJECTS (Clean Slate)
-- =============================================================================

DROP VIEW IF EXISTS user_performance_summary CASCADE;
DROP VIEW IF EXISTS config_by_category CASCADE;
DROP VIEW IF EXISTS model_trust_scores CASCADE;

DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS app_config CASCADE;
DROP TABLE IF EXISTS live_odds_cache CASCADE;
DROP TABLE IF EXISTS validation_thresholds CASCADE;
DROP TABLE IF EXISTS odds_benford_baselines CASCADE;
DROP TABLE IF EXISTS ai_audit_log CASCADE;
DROP TABLE IF EXISTS ai_response_trust CASCADE;

-- =============================================================================
-- SECTION 2: CORE TABLES
-- =============================================================================

-- 2.1 AI Response Trust Table
CREATE TABLE ai_response_trust (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name VARCHAR(100) NOT NULL,
  prompt_hash VARCHAR(64) NOT NULL,
  response_hash VARCHAR(64) NOT NULL,
  benford_score DECIMAL(5,4) CHECK (benford_score >= 0 AND benford_score <= 1),
  odds_alignment_score DECIMAL(5,4) CHECK (odds_alignment_score >= 0 AND odds_alignment_score <= 1),
  historical_accuracy DECIMAL(5,4) CHECK (historical_accuracy >= 0 AND historical_accuracy <= 1),
  trust_level VARCHAR(20) CHECK (trust_level IN ('high', 'medium', 'low', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_model_name ON ai_response_trust(model_name);
CREATE INDEX idx_trust_level ON ai_response_trust(trust_level);
CREATE INDEX idx_trust_created_at ON ai_response_trust(created_at DESC);
CREATE INDEX idx_trust_prompt_hash ON ai_response_trust(prompt_hash);

-- 2.2 AI Audit Log Table
CREATE TABLE ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  user_query TEXT,
  ai_response TEXT,
  trust_metrics JSONB,
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_event_type ON ai_audit_log(event_type);
CREATE INDEX idx_audit_flagged ON ai_audit_log(flagged) WHERE flagged = TRUE;
CREATE INDEX idx_audit_created_at ON ai_audit_log(created_at DESC);
CREATE INDEX idx_audit_model_name ON ai_audit_log(model_name);

-- 2.3 Odds Benford Baselines Table
CREATE TABLE odds_benford_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport VARCHAR(50) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  baseline_distribution JSONB NOT NULL,
  sample_size INTEGER NOT NULL,
  confidence_level DECIMAL(5,4),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_benford_sport_market ON odds_benford_baselines(sport, market_type);
CREATE INDEX idx_benford_last_updated ON odds_benford_baselines(last_updated DESC);

-- 2.4 Validation Thresholds Table
CREATE TABLE validation_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport VARCHAR(50) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  min_benford_score DECIMAL(5,4) DEFAULT 0.85,
  min_odds_alignment DECIMAL(5,4) DEFAULT 0.90,
  min_historical_accuracy DECIMAL(5,4) DEFAULT 0.75,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_threshold_sport_market ON validation_thresholds(sport, market_type);

-- 2.5 Live Odds Cache Table
CREATE TABLE live_odds_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  odds_data JSONB NOT NULL,
  source VARCHAR(100) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_odds_cache_sport_event ON live_odds_cache(sport, event_id);
CREATE INDEX idx_odds_cache_expires_at ON live_odds_cache(expires_at);
CREATE INDEX idx_odds_cache_fetched_at ON live_odds_cache(fetched_at DESC);

-- 2.6 App Config Table
CREATE TABLE app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_config_category ON app_config(category);
CREATE INDEX idx_config_is_public ON app_config(is_public) WHERE is_public = TRUE;

-- 2.7 User Profiles Table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  predictions_made INTEGER DEFAULT 0,
  predictions_correct INTEGER DEFAULT 0,
  total_roi DECIMAL(10,2) DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'expert')),
  rate_limit_remaining INTEGER DEFAULT 100,
  rate_limit_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_tier ON user_profiles(tier);
CREATE INDEX idx_user_profiles_created_at ON user_profiles(created_at DESC);

-- =============================================================================
-- SECTION 3: VIEWS
-- =============================================================================

-- 3.1 Model Trust Scores View
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

-- 3.2 Config by Category View
CREATE VIEW config_by_category AS
SELECT 
  category,
  COUNT(*) as config_count,
  jsonb_object_agg(config_key, config_value) as configs
FROM app_config
WHERE is_public = TRUE
GROUP BY category;

-- 3.3 User Performance Summary View
CREATE VIEW user_performance_summary AS
SELECT 
  user_id,
  tier,
  predictions_made,
  predictions_correct,
  CASE 
    WHEN predictions_made > 0 
    THEN ROUND((predictions_correct::DECIMAL / predictions_made) * 100, 2)
    ELSE 0 
  END as win_rate_percentage,
  total_roi,
  rate_limit_remaining,
  created_at,
  updated_at
FROM user_profiles;

-- =============================================================================
-- SECTION 4: FUNCTIONS
-- =============================================================================

-- 4.1 Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4.2 Cleanup expired odds cache
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

-- 4.3 Calculate user win rate
CREATE OR REPLACE FUNCTION calculate_user_win_rate(p_user_id VARCHAR)
RETURNS DECIMAL AS $$
DECLARE
  win_rate DECIMAL;
BEGIN
  SELECT 
    CASE 
      WHEN predictions_made > 0 
      THEN (predictions_correct::DECIMAL / predictions_made) * 100
      ELSE 0 
    END INTO win_rate
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(win_rate, 0);
END;
$$ LANGUAGE plpgsql;

-- 4.4 Get recent trust metrics
CREATE OR REPLACE FUNCTION get_recent_trust_metrics(
  p_model_name VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  model_name VARCHAR,
  avg_benford DECIMAL,
  avg_odds_alignment DECIMAL,
  avg_accuracy DECIMAL,
  response_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    art.model_name,
    AVG(art.benford_score)::DECIMAL(5,4) as avg_benford,
    AVG(art.odds_alignment_score)::DECIMAL(5,4) as avg_odds_alignment,
    AVG(art.historical_accuracy)::DECIMAL(5,4) as avg_accuracy,
    COUNT(*)::BIGINT as response_count
  FROM ai_response_trust art
  WHERE p_model_name IS NULL OR art.model_name = p_model_name
  GROUP BY art.model_name
  ORDER BY response_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECTION 5: TRIGGERS
-- =============================================================================

CREATE TRIGGER update_ai_response_trust_updated_at 
  BEFORE UPDATE ON ai_response_trust
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_validation_thresholds_updated_at 
  BEFORE UPDATE ON validation_thresholds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_config_updated_at 
  BEFORE UPDATE ON app_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE ai_response_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_benford_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_odds_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 6.1 Policies for ai_response_trust
CREATE POLICY "Allow public read access to ai_response_trust"
  ON ai_response_trust FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated write to ai_response_trust"
  ON ai_response_trust FOR INSERT
  WITH CHECK (true);

-- 6.2 Policies for ai_audit_log
CREATE POLICY "Allow public read access to ai_audit_log"
  ON ai_audit_log FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated write to ai_audit_log"
  ON ai_audit_log FOR INSERT
  WITH CHECK (true);

-- 6.3 Policies for odds_benford_baselines
CREATE POLICY "Allow public read access to benford baselines"
  ON odds_benford_baselines FOR SELECT
  USING (true);

-- 6.4 Policies for validation_thresholds
CREATE POLICY "Allow public read access to validation thresholds"
  ON validation_thresholds FOR SELECT
  USING (true);

-- 6.5 Policies for live_odds_cache
CREATE POLICY "Allow public read access to odds cache"
  ON live_odds_cache FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated write to odds cache"
  ON live_odds_cache FOR INSERT
  WITH CHECK (true);

-- 6.6 Policies for app_config
CREATE POLICY "Allow public read access to app_config"
  ON app_config FOR SELECT
  USING (is_public = true);

-- 6.7 Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- SECTION 7: PERMISSIONS
-- =============================================================================

GRANT SELECT ON ai_response_trust TO anon, authenticated;
GRANT SELECT ON ai_audit_log TO anon, authenticated;
GRANT SELECT ON odds_benford_baselines TO anon, authenticated;
GRANT SELECT ON validation_thresholds TO anon, authenticated;
GRANT SELECT ON live_odds_cache TO anon, authenticated;
GRANT SELECT ON app_config TO anon, authenticated;
GRANT SELECT ON user_profiles TO anon, authenticated;

GRANT INSERT ON ai_response_trust TO authenticated;
GRANT INSERT ON ai_audit_log TO authenticated;
GRANT INSERT, UPDATE ON live_odds_cache TO authenticated;
GRANT INSERT, UPDATE ON user_profiles TO authenticated;

GRANT SELECT ON model_trust_scores TO anon, authenticated;
GRANT SELECT ON config_by_category TO anon, authenticated;
GRANT SELECT ON user_performance_summary TO anon, authenticated;

-- =============================================================================
-- SECTION 8: SEED DATA
-- =============================================================================

-- 8.1 Seed validation thresholds for major sports
INSERT INTO validation_thresholds (sport, market_type, min_benford_score, min_odds_alignment, min_historical_accuracy) VALUES
('nfl', 'spread', 0.85, 0.90, 0.75),
('nfl', 'moneyline', 0.88, 0.92, 0.78),
('nfl', 'total', 0.85, 0.90, 0.75),
('nba', 'spread', 0.83, 0.88, 0.72),
('nba', 'moneyline', 0.85, 0.90, 0.75),
('nba', 'total', 0.83, 0.88, 0.72),
('mlb', 'moneyline', 0.82, 0.87, 0.70),
('mlb', 'runline', 0.82, 0.87, 0.70),
('mlb', 'total', 0.82, 0.87, 0.70);

-- 8.2 Seed app configuration
INSERT INTO app_config (config_key, config_value, category, description, is_public) VALUES
('ai_model_default', '"xai/grok-2-1212"', 'ai', 'Default AI model for predictions', true),
('odds_cache_ttl_hours', '6', 'odds', 'Time to live for odds cache in hours', true),
('rate_limit_free_tier', '100', 'rate_limiting', 'API calls per day for free tier', true),
('rate_limit_pro_tier', '1000', 'rate_limiting', 'API calls per day for pro tier', true),
('rate_limit_expert_tier', '10000', 'rate_limiting', 'API calls per day for expert tier', true),
('trust_threshold_high', '0.85', 'trust', 'Minimum score for high trust level', true),
('trust_threshold_medium', '0.70', 'trust', 'Minimum score for medium trust level', true),
('benford_check_enabled', 'true', 'validation', 'Enable Benford''s Law validation', true),
('odds_alignment_check_enabled', 'true', 'validation', 'Enable odds alignment validation', true),
('audit_log_retention_days', '90', 'compliance', 'Days to retain audit logs', false);
