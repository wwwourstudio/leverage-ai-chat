-- Create tables in the api schema (the only exposed schema)

-- Users / profiles
CREATE TABLE IF NOT EXISTS api.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid UNIQUE,
  email text,
  full_name text,
  avatar_url text,
  credits integer DEFAULT 50,
  subscription_tier text DEFAULT 'free',
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Chat history
CREATE TABLE IF NOT EXISTS api.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES api.profiles(id),
  title text NOT NULL DEFAULT 'New Chat',
  category text DEFAULT 'all',
  sport text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS api.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES api.chats(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  cards jsonb,
  trust_metrics jsonb,
  sources jsonb,
  created_at timestamptz DEFAULT now()
);

-- Live odds cache
CREATE TABLE IF NOT EXISTS api.live_odds_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport text NOT NULL,
  sport_key text NOT NULL,
  game_id text UNIQUE NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  commence_time timestamptz,
  bookmakers jsonb,
  markets jsonb,
  scores jsonb,
  completed boolean DEFAULT false,
  cached_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Line movement snapshots
CREATE TABLE IF NOT EXISTS api.line_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  sport text NOT NULL,
  home_team text,
  away_team text,
  bookmaker text,
  market_type text,
  odds_data jsonb,
  snapshot_at timestamptz DEFAULT now()
);

-- Edge opportunities
CREATE TABLE IF NOT EXISTS api.edge_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id text NOT NULL,
  sport text NOT NULL,
  matchup text,
  model_prob numeric,
  market_prob numeric,
  edge numeric,
  confidence_score numeric,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Arbitrage opportunities
CREATE TABLE IF NOT EXISTS api.arbitrage_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id text NOT NULL,
  sport text NOT NULL,
  matchup text,
  side_a_book text,
  side_a_odds numeric,
  side_a_stake numeric,
  side_b_book text,
  side_b_odds numeric,
  side_b_stake numeric,
  profit_margin numeric,
  total_implied_prob numeric,
  status text DEFAULT 'active',
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- AI response trust tracking
CREATE TABLE IF NOT EXISTS api.ai_response_trust (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text,
  response text,
  trust_score numeric,
  consensus_score numeric,
  data_sources jsonb,
  created_at timestamptz DEFAULT now()
);

-- User settings
CREATE TABLE IF NOT EXISTS api.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES api.profiles(id) ON DELETE CASCADE,
  preferred_books text[] DEFAULT '{}',
  preferred_sports text[] DEFAULT '{}',
  bankroll numeric DEFAULT 0,
  risk_tolerance text DEFAULT 'medium',
  notifications_enabled boolean DEFAULT true,
  dark_mode boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_live_odds_sport ON api.live_odds_cache(sport_key);
CREATE INDEX IF NOT EXISTS idx_live_odds_expires ON api.live_odds_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_line_snapshots_game ON api.line_snapshots(game_id);
CREATE INDEX IF NOT EXISTS idx_chats_user ON api.chats(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON api.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_edge_sport ON api.edge_opportunities(sport);
CREATE INDEX IF NOT EXISTS idx_arb_sport ON api.arbitrage_opportunities(sport);

-- Grant access to authenticated and anon roles
GRANT USAGE ON SCHEMA api TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA api TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA api TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON SEQUENCES TO anon, authenticated;
