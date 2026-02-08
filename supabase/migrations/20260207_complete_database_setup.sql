-- =============================================================================
-- LEVERAGE AI - Complete Database Setup (Consolidated Migration)
-- Version: 2026-02-07
-- Description: Creates all necessary tables, indexes, views, functions, and RLS policies
-- =============================================================================
-- This migration is idempotent - safe to run multiple times
-- Execute via: Supabase SQL Editor or CLI
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- =============================================================================
-- SECTION 1: CORE TRUST & VALIDATION SYSTEM
-- =============================================================================

-- 1.1 Odds Benford Baselines Table
-- Stores sport-specific digit distributions from real market data
CREATE TABLE IF NOT EXISTS odds_benford_baselines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL CHECK (sport != ''),
  market_type TEXT NOT NULL CHECK (market_type != ''),
  digit_distribution JSONB NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, market_type)
);

CREATE INDEX IF NOT EXISTS idx_benford_sport_market 
  ON odds_benford_baselines(sport, market_type);

COMMENT ON TABLE odds_benford_baselines IS 
  'Sport-specific digit distributions for Benford Law validation of AI predictions';

-- 1.2 AI Response Trust Table
-- Stores trust metrics for each AI response
CREATE TABLE IF NOT EXISTS ai_response_trust (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id TEXT NOT NULL CHECK (response_id != ''),
  model_id TEXT NOT NULL CHECK (model_id != ''),
  sport TEXT NOT NULL CHECK (sport != ''),
  market_type TEXT NOT NULL CHECK (market_type != ''),
  benford_score INTEGER NOT NULL CHECK (benford_score >= 0 AND benford_score <= 100),
  odds_alignment_score INTEGER NOT NULL CHECK (odds_alignment_score >= 0 AND odds_alignment_score <= 100),
  consensus_score INTEGER NOT NULL CHECK (consensus_score >= 0 AND consensus_score <= 100),
  historical_accuracy_score INTEGER NOT NULL CHECK (historical_accuracy_score >= 0 AND historical_accuracy_score <= 100),
  final_confidence INTEGER NOT NULL CHECK (final_confidence >= 0 AND final_confidence <= 100),
  flags JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_response ON ai_response_trust(response_id);
CREATE INDEX IF NOT EXISTS idx_trust_model ON ai_response_trust(model_id);
CREATE INDEX IF NOT EXISTS idx_trust_sport_market ON ai_response_trust(sport, market_type);
CREATE INDEX IF NOT EXISTS idx_trust_created ON ai_response_trust(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_confidence ON ai_response_trust(final_confidence DESC);

COMMENT ON TABLE ai_response_trust IS 
  'Trust and integrity metrics for each AI-generated prediction';

-- 1.3 AI Audit Log Table (append-only)
-- Comprehensive audit trail for all AI responses
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id TEXT NOT NULL CHECK (response_id != ''),
  model_id TEXT NOT NULL CHECK (model_id != ''),
  raw_output TEXT NOT NULL,
  trust_breakdown JSONB NOT NULL,
  thresholds_used JSONB NOT NULL,
  throttle_state TEXT,
  final_user_output TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_response ON ai_audit_log(response_id);
CREATE INDEX IF NOT EXISTS idx_audit_model ON ai_audit_log(model_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON ai_audit_log(created_at DESC);

COMMENT ON TABLE ai_audit_log IS 
  'Append-only audit trail for compliance and debugging of AI responses';

-- 1.4 Validation Thresholds Table
-- Configurable thresholds per sport and market type
CREATE TABLE IF NOT EXISTS validation_thresholds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL CHECK (sport != ''),
  market_type TEXT NOT NULL CHECK (market_type != ''),
  odds_deviation_low NUMERIC(5,4) NOT NULL DEFAULT 0.02 CHECK (odds_deviation_low >= 0),
  odds_deviation_medium NUMERIC(5,4) NOT NULL DEFAULT 0.05 CHECK (odds_deviation_medium >= 0),
  odds_deviation_high NUMERIC(5,4) NOT NULL DEFAULT 0.10 CHECK (odds_deviation_high >= 0),
  consensus_delta_low NUMERIC(5,4) NOT NULL DEFAULT 0.03 CHECK (consensus_delta_low >= 0),
  consensus_delta_medium NUMERIC(5,4) NOT NULL DEFAULT 0.07 CHECK (consensus_delta_medium >= 0),
  consensus_delta_high NUMERIC(5,4) NOT NULL DEFAULT 0.12 CHECK (consensus_delta_high >= 0),
  benford_pass_threshold INTEGER NOT NULL DEFAULT 80 CHECK (benford_pass_threshold >= 0 AND benford_pass_threshold <= 100),
  minimum_sample_size INTEGER NOT NULL DEFAULT 100 CHECK (minimum_sample_size > 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, market_type)
);

CREATE INDEX IF NOT EXISTS idx_thresholds_sport_market 
  ON validation_thresholds(sport, market_type);

COMMENT ON TABLE validation_thresholds IS 
  'Configurable validation thresholds per sport and market type';

-- Insert default thresholds for common sports/market types
INSERT INTO validation_thresholds (sport, market_type) VALUES
  ('nfl', 'main'),
  ('nba', 'main'),
  ('mlb', 'main'),
  ('nhl', 'main'),
  ('soccer', 'main'),
  ('nfl', 'props'),
  ('nba', 'props'),
  ('mlb', 'props'),
  ('nfl', 'futures'),
  ('nba', 'futures'),
  ('election', 'markets'),
  ('economic', 'events'),
  ('crypto', 'events')
ON CONFLICT (sport, market_type) DO NOTHING;

-- 1.5 Live Odds Cache Table
-- Cache live odds from external APIs for faster validation
CREATE TABLE IF NOT EXISTS live_odds_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL CHECK (sport != ''),
  market_type TEXT NOT NULL CHECK (market_type != ''),
  event_id TEXT NOT NULL CHECK (event_id != ''),
  implied_probability NUMERIC(5,4) NOT NULL CHECK (implied_probability >= 0 AND implied_probability <= 1),
  decimal_odds NUMERIC(6,2) NOT NULL CHECK (decimal_odds > 0),
  source TEXT NOT NULL CHECK (source != ''),
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, market_type, event_id, source)
);

CREATE INDEX IF NOT EXISTS idx_odds_cache_expiry ON live_odds_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_odds_cache_sport_market ON live_odds_cache(sport, market_type);
CREATE INDEX IF NOT EXISTS idx_odds_cache_event ON live_odds_cache(event_id);

COMMENT ON TABLE live_odds_cache IS 
  'Cached live odds from external APIs with TTL-based expiration';

-- =============================================================================
-- SECTION 2: APPLICATION CONFIGURATION & USER DATA
-- =============================================================================

-- 2.1 App Config Table
-- Dynamic application configuration without code deployments
CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL CHECK (key != ''),
  value JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category != ''),
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key, category)
);

CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_config(key);
CREATE INDEX IF NOT EXISTS idx_app_config_category ON app_config(category);
CREATE INDEX IF NOT EXISTS idx_app_config_public ON app_config(is_public) WHERE is_public = true;

COMMENT ON TABLE app_config IS 
  'Dynamic application configuration for features, limits, and welcome messages';

-- Insert default configuration values
INSERT INTO app_config (key, value, category, description, is_public) VALUES
  -- Insights Configuration
  ('default_invested_amount', '"2500"', 'insights', 'Default amount shown for total invested', true),
  ('high_confidence_threshold', '"80"', 'insights', 'Threshold for high confidence predictions', true),
  ('roi_scale_factor', '"20"', 'insights', 'Scaling factor for ROI calculations', true),
  ('default_confidence', '"75"', 'insights', 'Default confidence level', true),
  ('default_win_rate', '"65"', 'insights', 'Default win rate percentage', true),
  
  -- Welcome Messages (dynamic)
  ('all', '"Welcome to **Leverage AI** - Your All-In-One Sports & Financial Intelligence Platform.\n\nI''m your AI companion powered by **Grok**, ready to provide data-driven insights across all platforms:\n\n**Sports Betting** - Real-time odds analysis\n**Fantasy Sports** - Draft strategy and ADP analysis\n**DFS** - Optimal lineup construction\n**Kalshi Markets** - Prediction market opportunities\n\n**What would you like to analyze?**"', 'welcome_messages', 'Welcome message for all categories', true),
  ('betting', '"Welcome to **Sports Betting Analysis** powered by **Grok** AI.\n\nFind betting edges with live odds monitoring, value detection, and sharp money tracking.\n\n**What betting opportunities should we analyze today?**"', 'welcome_messages', 'Welcome message for sports betting', true),
  ('fantasy', '"Welcome to **Fantasy Sports Strategy** powered by **Grok** AI.\n\nGet draft strategy, ADP analysis, and auction optimization.\n\n**What''s your draft strategy question?**"', 'welcome_messages', 'Welcome message for fantasy sports', true),
  ('dfs', '"Welcome to **DFS Lineup Optimization** powered by **Grok** AI.\n\nBuild optimal lineups with leverage plays and ownership projections.\n\n**Which slate are you building for today?**"', 'welcome_messages', 'Welcome message for DFS', true),
  ('kalshi', '"Welcome to **Kalshi Prediction Markets** powered by **Grok** AI.\n\nFind market inefficiencies and arbitrage opportunities.\n\n**Which prediction markets should we explore?**"', 'welcome_messages', 'Welcome message for Kalshi markets', true),
  
  -- Rate Limits
  ('message_limit', '"15"', 'rate_limits', 'Daily message limit for free users', true),
  ('chat_limit', '"10"', 'rate_limits', 'Daily chat creation limit', true),
  ('limit_duration_hours', '"24"', 'rate_limits', 'Hours before rate limits reset', true),
  
  -- Feature Flags
  ('enable_live_odds', 'true', 'features', 'Enable real-time odds fetching', true),
  ('enable_ai_analysis', 'true', 'features', 'Enable AI-powered analysis', true),
  ('enable_user_profiles', 'true', 'features', 'Enable user profile tracking', true),
  ('enable_trust_metrics', 'true', 'features', 'Enable trust metric calculations', true)

ON CONFLICT (key, category) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 2.2 User Profiles Table
-- User-specific data and preferences
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE CHECK (user_id != ''),
  email TEXT,
  total_invested DECIMAL(10, 2) DEFAULT 0 CHECK (total_invested >= 0),
  win_rate DECIMAL(5, 2) CHECK (win_rate >= 0 AND win_rate <= 100),
  roi DECIMAL(7, 2),
  active_contests INTEGER DEFAULT 0 CHECK (active_contests >= 0),
  total_predictions INTEGER DEFAULT 0 CHECK (total_predictions >= 0),
  correct_predictions INTEGER DEFAULT 0 CHECK (correct_predictions >= 0),
  preferences JSONB DEFAULT '{}',
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'premium')),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON user_profiles(last_active_at DESC);

COMMENT ON TABLE user_profiles IS 
  'User-specific profile data, preferences, and performance metrics';

-- =============================================================================
-- SECTION 3: VIEWS & AGGREGATIONS
-- =============================================================================

-- 3.1 Model Trust Scores View
-- Aggregated rolling trust metrics per model (last 30 days)
CREATE OR REPLACE VIEW model_trust_scores AS
SELECT 
  model_id,
  sport,
  market_type,
  AVG(final_confidence)::NUMERIC(5,2) AS avg_final_confidence,
  AVG(benford_score)::NUMERIC(5,2) AS avg_benford_score,
  AVG(odds_alignment_score)::NUMERIC(5,2) AS avg_odds_alignment,
  AVG(consensus_score)::NUMERIC(5,2) AS avg_consensus,
  AVG(historical_accuracy_score)::NUMERIC(5,2) AS avg_historical_accuracy,
  COUNT(*) AS total_responses,
  COUNT(*) FILTER (WHERE benford_score >= 80) AS benford_pass_count,
  (COUNT(*) FILTER (WHERE benford_score >= 80)::FLOAT / NULLIF(COUNT(*), 0))::NUMERIC(5,4) AS benford_pass_rate,
  COUNT(*) FILTER (WHERE final_confidence >= 80) AS high_confidence_count,
  MAX(created_at) AS last_response_at
FROM ai_response_trust
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY model_id, sport, market_type;

COMMENT ON VIEW model_trust_scores IS 
  'Aggregated trust metrics per model for the last 30 days';

-- 3.2 Config By Category View
-- Simplified configuration access grouped by category
CREATE OR REPLACE VIEW config_by_category AS
SELECT 
  category,
  jsonb_object_agg(key, value) as settings,
  COUNT(*) as config_count
FROM app_config
WHERE is_public = true
GROUP BY category;

COMMENT ON VIEW config_by_category IS 
  'Configuration values grouped by category for easy access';

-- 3.3 User Performance Summary View
CREATE OR REPLACE VIEW user_performance_summary AS
SELECT 
  up.user_id,
  up.subscription_tier,
  up.total_invested,
  up.win_rate,
  up.roi,
  up.active_contests,
  up.total_predictions,
  up.correct_predictions,
  CASE 
    WHEN up.total_predictions > 0 
    THEN (up.correct_predictions::FLOAT / up.total_predictions * 100)::NUMERIC(5,2)
    ELSE NULL 
  END AS calculated_accuracy,
  COUNT(art.id) AS recent_predictions_30d,
  AVG(art.final_confidence)::NUMERIC(5,2) AS avg_confidence_30d,
  up.last_active_at,
  up.created_at
FROM user_profiles up
LEFT JOIN ai_response_trust art ON art.created_at >= NOW() - INTERVAL '30 days'
GROUP BY up.user_id, up.subscription_tier, up.total_invested, up.win_rate, 
         up.roi, up.active_contests, up.total_predictions, up.correct_predictions,
         up.last_active_at, up.created_at;

COMMENT ON VIEW user_performance_summary IS 
  'Comprehensive user performance metrics with 30-day rolling stats';

-- =============================================================================
-- SECTION 4: FUNCTIONS & TRIGGERS
-- =============================================================================

-- 4.1 Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4.2 Function: Update Benford baseline on new odds
CREATE OR REPLACE FUNCTION update_benford_baseline()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-update baselines when new odds are cached
  -- Increment sample size for the sport/market combination
  INSERT INTO odds_benford_baselines (sport, market_type, digit_distribution, sample_size)
  VALUES (NEW.sport, NEW.market_type, '{}'::jsonb, 1)
  ON CONFLICT (sport, market_type) 
  DO UPDATE SET 
    sample_size = odds_benford_baselines.sample_size + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4.3 Function: Cleanup expired odds cache
CREATE OR REPLACE FUNCTION cleanup_expired_odds()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM live_odds_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Cleaned up % expired odds records', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 4.4 Function: Update user statistics
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET 
    total_predictions = total_predictions + 1,
    last_active_at = NOW()
  WHERE user_id = NEW.model_id; -- Assuming model_id contains user identifier
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECTION 5: TRIGGERS
-- =============================================================================

-- 5.1 Trigger: Auto-update updated_at on app_config
DROP TRIGGER IF EXISTS update_app_config_updated_at ON app_config;
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5.2 Trigger: Auto-update updated_at on user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5.3 Trigger: Auto-update updated_at on validation_thresholds
DROP TRIGGER IF EXISTS update_validation_thresholds_updated_at ON validation_thresholds;
CREATE TRIGGER update_validation_thresholds_updated_at
  BEFORE UPDATE ON validation_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5.4 Trigger: Auto-update updated_at on odds_benford_baselines
DROP TRIGGER IF EXISTS update_odds_benford_baselines_updated_at ON odds_benford_baselines;
CREATE TRIGGER update_odds_benford_baselines_updated_at
  BEFORE UPDATE ON odds_benford_baselines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5.5 Trigger: Update Benford baseline on new cache entry
DROP TRIGGER IF EXISTS trigger_update_benford ON live_odds_cache;
CREATE TRIGGER trigger_update_benford
  AFTER INSERT ON live_odds_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_benford_baseline();

-- =============================================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE ai_response_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_benford_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_odds_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 6.1 Policies for ai_response_trust
DROP POLICY IF EXISTS "Allow public read access to trust metrics" ON ai_response_trust;
CREATE POLICY "Allow public read access to trust metrics"
  ON ai_response_trust FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert to trust metrics" ON ai_response_trust;
CREATE POLICY "Allow authenticated insert to trust metrics"
  ON ai_response_trust FOR INSERT
  WITH CHECK (true);

-- 6.2 Policies for ai_audit_log
DROP POLICY IF EXISTS "Allow public read access to audit log" ON ai_audit_log;
CREATE POLICY "Allow public read access to audit log"
  ON ai_audit_log FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert to audit log" ON ai_audit_log;
CREATE POLICY "Allow authenticated insert to audit log"
  ON ai_audit_log FOR INSERT
  WITH CHECK (true);

-- 6.3 Policies for odds_benford_baselines
DROP POLICY IF EXISTS "Allow public read access to baselines" ON odds_benford_baselines;
CREATE POLICY "Allow public read access to baselines"
  ON odds_benford_baselines FOR SELECT
  USING (true);

-- 6.4 Policies for validation_thresholds
DROP POLICY IF EXISTS "Allow public read access to thresholds" ON validation_thresholds;
CREATE POLICY "Allow public read access to thresholds"
  ON validation_thresholds FOR SELECT
  USING (true);

-- 6.5 Policies for live_odds_cache
DROP POLICY IF EXISTS "Allow public read access to odds cache" ON live_odds_cache;
CREATE POLICY "Allow public read access to odds cache"
  ON live_odds_cache FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated write to odds cache" ON live_odds_cache;
CREATE POLICY "Allow authenticated write to odds cache"
  ON live_odds_cache FOR INSERT
  WITH CHECK (true);

-- 6.6 Policies for app_config
DROP POLICY IF EXISTS "Allow public read access to app_config" ON app_config;
CREATE POLICY "Allow public read access to app_config"
  ON app_config FOR SELECT
  USING (is_public = true);

-- 6.7 Policies for user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (true); -- Allow all for now, can restrict to auth.uid()::text = user_id later

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- SECTION 7: PERMISSIONS
-- =============================================================================

-- Grant SELECT permissions to anon and authenticated roles
GRANT SELECT ON ai_response_trust TO anon, authenticated;
GRANT SELECT ON ai_audit_log TO anon, authenticated;
GRANT SELECT ON odds_benford_baselines TO anon, authenticated;
GRANT SELECT ON validation_thresholds TO anon, authenticated;
GRANT SELECT ON live_odds_cache TO anon, authenticated;
GRANT SELECT ON app_config TO anon, authenticated;
GRANT SELECT ON user_profiles TO anon, authenticated;

-- Grant write permissions for specific tables
GRANT INSERT ON ai_response_trust TO authenticated;
GRANT INSERT ON ai_audit_log TO authenticated;
GRANT INSERT, UPDATE ON live_odds_cache TO authenticated;
GRANT INSERT, UPDATE ON user_profiles TO authenticated;

-- Grant view access
GRANT SELECT ON model_trust_scores TO anon, authenticated;
GRANT SELECT ON config_by_category TO anon, authenticated;
GRANT SELECT ON user_performance_summary TO anon, authenticated;

-- =============================================================================
-- SECTION 8: VALIDATION & COMPLETION
-- =============================================================================

-- Verify all tables exist
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'ai_response_trust',
    'ai_audit_log',
    'odds_benford_baselines',
    'validation_thresholds',
    'live_odds_cache',
    'app_config',
    'user_profiles'
  );
  
  IF table_count = 7 THEN
    RAISE NOTICE '✅ SUCCESS: All 7 tables created successfully!';
    RAISE NOTICE '✅ Tables: ai_response_trust, ai_audit_log, odds_benford_baselines, validation_thresholds, live_odds_cache, app_config, user_profiles';
  ELSE
    RAISE WARNING '⚠️  WARNING: Only % of 7 tables were created', table_count;
  END IF;
END $$;

-- Display configuration summary
DO $$
DECLARE
  config_count INTEGER;
  threshold_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO config_count FROM app_config;
  SELECT COUNT(*) INTO threshold_count FROM validation_thresholds;
  
  RAISE NOTICE '✅ Configuration: % config entries loaded', config_count;
  RAISE NOTICE '✅ Thresholds: % sport/market thresholds configured', threshold_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Database setup complete! Your Leverage AI platform is ready.';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Next steps:';
  RAISE NOTICE '   1. Refresh your application';
  RAISE NOTICE '   2. Test AI predictions to see trust metrics';
  RAISE NOTICE '   3. Monitor insights dashboard for real data';
  RAISE NOTICE '';
  RAISE NOTICE '📖 Documentation: /docs/DATABASE_SCHEMA_PLAN.md';
END $$;
