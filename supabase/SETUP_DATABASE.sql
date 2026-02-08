-- =============================================================================
-- LEVERAGE AI - Complete Database Setup
-- Copy and paste this entire file into Supabase SQL Editor
-- =============================================================================

-- 1. CREATE AI RESPONSE TRUST TABLE (Main table for storing AI predictions)
CREATE TABLE IF NOT EXISTS ai_response_trust (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  market_type TEXT NOT NULL,
  benford_score INTEGER NOT NULL CHECK (benford_score >= 0 AND benford_score <= 100),
  odds_alignment_score INTEGER NOT NULL CHECK (odds_alignment_score >= 0 AND odds_alignment_score <= 100),
  consensus_score INTEGER NOT NULL CHECK (consensus_score >= 0 AND consensus_score <= 100),
  historical_accuracy_score INTEGER NOT NULL CHECK (historical_accuracy_score >= 0 AND historical_accuracy_score <= 100),
  final_confidence INTEGER NOT NULL CHECK (final_confidence >= 0 AND final_confidence <= 100),
  flags JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_response ON ai_response_trust(response_id);
CREATE INDEX IF NOT EXISTS idx_trust_model ON ai_response_trust(model_id);
CREATE INDEX IF NOT EXISTS idx_trust_sport_market ON ai_response_trust(sport, market_type);
CREATE INDEX IF NOT EXISTS idx_trust_created ON ai_response_trust(created_at DESC);

-- 2. CREATE APP CONFIG TABLE (Dynamic configuration)
CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key, category)
);

CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_config(key);
CREATE INDEX IF NOT EXISTS idx_app_config_category ON app_config(category);

-- 3. CREATE USER PROFILES TABLE
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  total_invested DECIMAL(10, 2) DEFAULT 0,
  win_rate DECIMAL(5, 2),
  roi DECIMAL(5, 2),
  active_contests INTEGER DEFAULT 0,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- 4. INSERT DEFAULT CONFIGURATION VALUES
INSERT INTO app_config (key, value, category, description) VALUES
  ('default_invested_amount', '2500', 'insights', 'Default amount shown for total invested'),
  ('high_confidence_threshold', '80', 'insights', 'Threshold for high confidence predictions'),
  ('roi_scale_factor', '20', 'insights', 'Scaling factor for ROI calculations'),
  ('default_confidence', '75', 'insights', 'Default confidence level'),
  ('default_win_rate', '65', 'insights', 'Default win rate percentage')
ON CONFLICT (key, category) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE ai_response_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 6. CREATE POLICIES (Allow public read access)
CREATE POLICY IF NOT EXISTS "Allow read access to trust metrics"
  ON ai_response_trust FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Allow public read access to app_config"
  ON app_config FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (true);

-- 7. GRANT PERMISSIONS
GRANT SELECT ON ai_response_trust TO anon, authenticated;
GRANT SELECT ON app_config TO anon, authenticated;
GRANT SELECT ON user_profiles TO anon, authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Database setup complete! All tables created successfully.';
END $$;
