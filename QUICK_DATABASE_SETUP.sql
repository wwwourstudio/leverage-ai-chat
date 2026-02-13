-- =============================================================================
-- QUICK DATABASE SETUP - Run this in Supabase SQL Editor
-- =============================================================================
-- This creates the minimum required tables to fix the current errors
-- For full schema, see scripts/setup-database.sql
-- =============================================================================

-- 1. AI Response Trust Table (REQUIRED - fixes current error)
CREATE TABLE IF NOT EXISTS ai_response_trust (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id TEXT NOT NULL CHECK (response_id != ''),
  model_id TEXT NOT NULL CHECK (model_id != ''),
  sport VARCHAR(50),
  market_type VARCHAR(50),
  
  -- Trust Scores (0-100 scale) - matching app/api/analyze/route.ts insert format
  benford_score INTEGER DEFAULT 0 CHECK (benford_score >= 0 AND benford_score <= 100),
  odds_alignment_score INTEGER DEFAULT 0 CHECK (odds_alignment_score >= 0 AND odds_alignment_score <= 100),
  consensus_score INTEGER DEFAULT 0 CHECK (consensus_score >= 0 AND consensus_score <= 100),
  historical_accuracy_score INTEGER DEFAULT 0 CHECK (historical_accuracy_score >= 0 AND historical_accuracy_score <= 100),
  final_confidence INTEGER DEFAULT 0 CHECK (final_confidence >= 0 AND final_confidence <= 100),
  
  -- Classification
  trust_level VARCHAR(20) CHECK (trust_level IN ('low', 'medium', 'high')),
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
  
  -- Metadata
  flags JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trust_response ON ai_response_trust(response_id);
CREATE INDEX IF NOT EXISTS idx_trust_model ON ai_response_trust(model_id);
CREATE INDEX IF NOT EXISTS idx_trust_sport_market ON ai_response_trust(sport, market_type);
CREATE INDEX IF NOT EXISTS idx_trust_created ON ai_response_trust(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_confidence ON ai_response_trust(final_confidence DESC);

-- Enable Row Level Security
ALTER TABLE ai_response_trust ENABLE ROW LEVEL SECURITY;

-- Allow public read access to trust metrics
DROP POLICY IF EXISTS "Allow public read access to trust metrics" ON ai_response_trust;
CREATE POLICY "Allow public read access to trust metrics"
ON ai_response_trust FOR SELECT
USING (true);

-- Allow authenticated insert to trust metrics
DROP POLICY IF EXISTS "Allow authenticated insert to trust metrics" ON ai_response_trust;
CREATE POLICY "Allow authenticated insert to trust metrics"
ON ai_response_trust FOR INSERT
WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON ai_response_trust TO anon, authenticated;
GRANT INSERT ON ai_response_trust TO authenticated;

-- 2. User Profiles Table (connects to Supabase Auth)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  display_name VARCHAR(100),
  
  -- Performance Metrics
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  total_invested DECIMAL(12,2) DEFAULT 0.00,
  total_roi DECIMAL(10,2) DEFAULT 0.00,
  win_rate DECIMAL(5,2) DEFAULT 0.00,
  active_contests INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
ON user_profiles FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;

-- 3. App Config Table (for dynamic settings)
CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  category VARCHAR(50),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_key ON app_config(key);
CREATE INDEX IF NOT EXISTS idx_config_category ON app_config(category);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read config" ON app_config;
CREATE POLICY "Public can read config"
ON app_config FOR SELECT
USING (true);

GRANT SELECT ON app_config TO anon, authenticated;

-- =============================================================================
-- BACKWARD COMPATIBILITY VIEWS
-- =============================================================================
-- Create view with old column names for any code using the old schema
CREATE OR REPLACE VIEW ai_response_trust_legacy AS
SELECT 
  id,
  response_id,
  model_id,
  sport,
  market_type,
  benford_score,
  benford_score as benford_integrity,  -- alias
  odds_alignment_score,
  odds_alignment_score as odds_alignment,  -- alias
  consensus_score,
  consensus_score as market_consensus,  -- alias
  historical_accuracy_score,
  historical_accuracy_score as historical_accuracy,  -- alias
  final_confidence,
  trust_level,
  risk_level,
  flags,
  created_at
FROM ai_response_trust;

-- Grant access to the view
GRANT SELECT ON ai_response_trust_legacy TO anon, authenticated;

-- Insert default config values
INSERT INTO app_config (key, value, category, description) VALUES
('default_invested_amount', '2500', 'insights', 'Default investment amount for calculations'),
('high_confidence_threshold', '80', 'insights', 'Threshold for high confidence predictions'),
('roi_scale_factor', '20', 'insights', 'ROI calculation scale factor'),
('default_confidence', '75', 'insights', 'Default confidence level'),
('default_win_rate', '65', 'insights', 'Default win rate percentage')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('ai_response_trust', 'user_profiles', 'app_config');
  
  IF table_count = 3 THEN
    RAISE NOTICE '✅ SUCCESS: All 3 core tables created!';
    RAISE NOTICE '✅ Tables: ai_response_trust, user_profiles, app_config';
    RAISE NOTICE '✅ The application should now work without database errors';
    RAISE NOTICE 'ℹ️  For full schema with conversations, predictions, etc., run scripts/setup-database.sql';
  ELSE
    RAISE WARNING '⚠️  WARNING: Only % of 3 tables were created', table_count;
  END IF;
END $$;
