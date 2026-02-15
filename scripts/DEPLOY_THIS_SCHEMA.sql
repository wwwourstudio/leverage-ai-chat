-- =====================================================
-- PRODUCTION-READY SUPABASE SCHEMA
-- Execute this ONCE in Supabase SQL Editor
-- =====================================================

-- 1. CORE ODDS TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS live_odds_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport VARCHAR(50) NOT NULL,
  sport_key VARCHAR(100) NOT NULL,
  game_id VARCHAR(255) NOT NULL UNIQUE,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  bookmakers JSONB NOT NULL,
  markets JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
  CONSTRAINT valid_sport_key CHECK (sport_key ~ '^[a-z_]+$')
);

CREATE INDEX IF NOT EXISTS idx_live_odds_sport_key ON live_odds_cache(sport_key);
CREATE INDEX IF NOT EXISTS idx_live_odds_game_id ON live_odds_cache(game_id);
CREATE INDEX IF NOT EXISTS idx_live_odds_expires ON live_odds_cache(expires_at);

-- Sport-specific tables
CREATE TABLE IF NOT EXISTS mlb_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL UNIQUE,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  h2h_odds JSONB,
  spreads JSONB,
  totals JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nfl_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL UNIQUE,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  h2h_odds JSONB,
  spreads JSONB,
  totals JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nba_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL UNIQUE,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  h2h_odds JSONB,
  spreads JSONB,
  totals JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nhl_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL UNIQUE,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  h2h_odds JSONB,
  spreads JSONB,
  totals JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AI RESPONSE TRUST TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_response_trust (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  trust_score DECIMAL(3,2) DEFAULT 0.5,
  consensus_score DECIMAL(3,2) DEFAULT 0.5,
  data_sources JSONB,
  verification_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_trust_status ON ai_response_trust(verification_status);
CREATE INDEX IF NOT EXISTS idx_ai_trust_score ON ai_response_trust(trust_score);

-- 3. CAPITAL STATE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS capital_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_capital DECIMAL(12,2) NOT NULL CHECK (total_capital > 0),
  risk_budget DECIMAL(5,4) NOT NULL DEFAULT 0.25 CHECK (risk_budget >= 0 AND risk_budget <= 1),
  max_single_position DECIMAL(5,4) NOT NULL DEFAULT 0.05 CHECK (max_single_position >= 0 AND max_single_position <= 1),
  kelly_scale DECIMAL(5,4) NOT NULL DEFAULT 0.25 CHECK (kelly_scale >= 0 AND kelly_scale <= 1),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default capital state
INSERT INTO capital_state (total_capital, risk_budget, max_single_position, kelly_scale, active)
VALUES (10000, 0.25, 0.05, 0.25, true)
ON CONFLICT DO NOTHING;

-- 4. BET ALLOCATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS bet_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capital_state_id UUID REFERENCES capital_state(id),
  market_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  matchup TEXT NOT NULL,
  edge DECIMAL(5,4) NOT NULL,
  kelly_fraction DECIMAL(5,4) NOT NULL,
  allocated_capital DECIMAL(12,2) NOT NULL CHECK (allocated_capital > 0),
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  status VARCHAR(50) DEFAULT 'pending',
  actual_return DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bet_allocations_status ON bet_allocations(status);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_sport ON bet_allocations(sport);

-- 5. EDGE OPPORTUNITIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS edge_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  matchup TEXT NOT NULL,
  model_prob DECIMAL(5,4) NOT NULL,
  market_prob DECIMAL(5,4) NOT NULL,
  edge DECIMAL(5,4) NOT NULL,
  expected_value DECIMAL(12,2),
  confidence_score DECIMAL(3,2) NOT NULL,
  integrity_score INTEGER,
  is_arbitrage BOOLEAN DEFAULT FALSE,
  sharp_signal BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_opps_sport ON edge_opportunities(sport);
CREATE INDEX IF NOT EXISTS idx_edge_opps_expires ON edge_opportunities(expires_at);
CREATE INDEX IF NOT EXISTS idx_edge_opps_edge ON edge_opportunities(edge DESC);

-- 6. ARBITRAGE OPPORTUNITIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  matchup TEXT NOT NULL,
  side_a_book VARCHAR(100) NOT NULL,
  side_a_odds DECIMAL(8,2) NOT NULL,
  side_a_stake DECIMAL(12,2) NOT NULL,
  side_b_book VARCHAR(100) NOT NULL,
  side_b_odds DECIMAL(8,2) NOT NULL,
  side_b_stake DECIMAL(12,2) NOT NULL,
  profit_margin DECIMAL(5,4) NOT NULL,
  total_implied_prob DECIMAL(5,4) NOT NULL CHECK (total_implied_prob < 1),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_arb_opps_status ON arbitrage_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_arb_opps_sport ON arbitrage_opportunities(sport);

-- 7. PLAYER STATS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id VARCHAR(100) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  team VARCHAR(100),
  season VARCHAR(20) NOT NULL,
  games_played INTEGER DEFAULT 0,
  season_avg JSONB,
  recent_games JSONB,
  vs_opponent JSONB,
  home_away_splits JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season)
);

CREATE INDEX IF NOT EXISTS idx_player_stats_player_id ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_sport ON player_stats(sport);

-- 8. LINE MOVEMENT TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS line_movement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  bookmaker VARCHAR(100) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  opening_line JSONB NOT NULL,
  current_line JSONB NOT NULL,
  line_change DECIMAL(8,2),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_movement_game_id ON line_movement(game_id);
CREATE INDEX IF NOT EXISTS idx_line_movement_timestamp ON line_movement(timestamp DESC);

-- 9. ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE live_odds_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlb_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfl_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhl_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_response_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_opportunities ENABLE ROW LEVEL SECURITY;

-- Public read access for odds data
CREATE POLICY "Public read access for live_odds_cache" ON live_odds_cache FOR SELECT USING (true);
CREATE POLICY "Public read access for mlb_odds" ON mlb_odds FOR SELECT USING (true);
CREATE POLICY "Public read access for nfl_odds" ON nfl_odds FOR SELECT USING (true);
CREATE POLICY "Public read access for nba_odds" ON nba_odds FOR SELECT USING (true);
CREATE POLICY "Public read access for nhl_odds" ON nhl_odds FOR SELECT USING (true);
CREATE POLICY "Public read access for ai_response_trust" ON ai_response_trust FOR SELECT USING (true);
CREATE POLICY "Public read access for edge_opportunities" ON edge_opportunities FOR SELECT USING (true);
CREATE POLICY "Public read access for arbitrage_opportunities" ON arbitrage_opportunities FOR SELECT USING (true);

-- 10. ENABLE REALTIME
-- =====================================================

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE live_odds_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE edge_opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE arbitrage_opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE bet_allocations;

-- =====================================================
-- SCHEMA DEPLOYMENT COMPLETE
-- =====================================================

-- Verify tables were created
SELECT 
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'live_odds_cache',
    'mlb_odds',
    'nfl_odds',
    'nba_odds',
    'nhl_odds',
    'ai_response_trust',
    'capital_state',
    'bet_allocations',
    'edge_opportunities',
    'arbitrage_opportunities',
    'player_stats',
    'line_movement'
  )
ORDER BY tablename;
