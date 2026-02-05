-- Dynamic Configuration System Migration
-- Creates tables for storing app configuration and user profiles

-- Create app_config table for dynamic configuration values
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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_config(key);
CREATE INDEX IF NOT EXISTS idx_app_config_category ON app_config(category);

-- Create user_profiles table for user-specific data
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

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Insert default configuration values
INSERT INTO app_config (key, value, category, description) VALUES
  -- Insights Configuration
  ('default_invested_amount', '2500', 'insights', 'Default amount shown for total invested'),
  ('high_confidence_threshold', '80', 'insights', 'Threshold for high confidence predictions'),
  ('roi_scale_factor', '20', 'insights', 'Scaling factor for ROI calculations'),
  ('default_confidence', '75', 'insights', 'Default confidence level'),
  ('default_win_rate', '65', 'insights', 'Default win rate percentage'),
  
  -- Welcome Messages (dynamic)
  ('all', '"Welcome to **Leverage AI** - Your All-In-One Sports & Financial Intelligence Platform.\n\nI''m your AI companion powered by **Grok-3**, ready to provide data-driven insights across all platforms:\n\n**Sports Betting** - Real-time odds analysis\n**Fantasy Sports** - Draft strategy and ADP analysis\n**DFS** - Optimal lineup construction\n**Kalshi Markets** - Prediction market opportunities\n\n**What would you like to analyze?**"', 'welcome_messages', 'Welcome message for all categories'),
  ('betting', '"Welcome to **Sports Betting Analysis** powered by **Grok-3** AI.\n\nFind betting edges with live odds monitoring, value detection, and sharp money tracking.\n\n**What betting opportunities should we analyze today?**"', 'welcome_messages', 'Welcome message for sports betting'),
  ('fantasy', '"Welcome to **Fantasy Sports Strategy** powered by **Grok-3** AI.\n\nGet draft strategy, ADP analysis, and auction optimization.\n\n**What''s your draft strategy question?**"', 'welcome_messages', 'Welcome message for fantasy sports'),
  ('dfs', '"Welcome to **DFS Lineup Optimization** powered by **Grok-3** AI.\n\nBuild optimal lineups with leverage plays and ownership projections.\n\n**Which slate are you building for today?**"', 'welcome_messages', 'Welcome message for DFS'),
  ('kalshi', '"Welcome to **Kalshi Prediction Markets** powered by **Grok-3** AI.\n\nFind market inefficiencies and arbitrage opportunities.\n\n**Which prediction markets should we explore?**"', 'welcome_messages', 'Welcome message for Kalshi markets'),
  
  -- Rate Limits
  ('message_limit', '15', 'rate_limits', 'Daily message limit for free users'),
  ('chat_limit', '10', 'rate_limits', 'Daily chat creation limit'),
  ('limit_duration_hours', '24', 'rate_limits', 'Hours before rate limits reset'),
  
  -- Feature Flags
  ('enable_live_odds', 'true', 'features', 'Enable real-time odds fetching'),
  ('enable_ai_analysis', 'true', 'features', 'Enable AI-powered analysis'),
  ('enable_user_profiles', 'true', 'features', 'Enable user profile tracking')

ON CONFLICT (key, category) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for app_config (read-only for all users)
CREATE POLICY "Allow public read access to app_config"
  ON app_config FOR SELECT
  USING (true);

-- Create policies for user_profiles (users can only see their own)
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Grant permissions
GRANT SELECT ON app_config TO anon, authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- Create a view for easier configuration access
CREATE OR REPLACE VIEW config_by_category AS
SELECT 
  category,
  jsonb_object_agg(key, value) as settings
FROM app_config
GROUP BY category;

GRANT SELECT ON config_by_category TO anon, authenticated;

-- Add comment
COMMENT ON TABLE app_config IS 'Stores dynamic configuration values for the application';
COMMENT ON TABLE user_profiles IS 'Stores user-specific profile data and preferences';
