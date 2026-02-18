-- ============================================================================
-- LEVERAGE AI - UNIFIED DATABASE SCHEMA
-- Production-ready schema for sports betting intelligence platform
-- Execute ONCE in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. CORE ODDS TABLES
-- ============================================================================

-- Live odds cache (all sports, 5-minute TTL)
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
CREATE INDEX IF NOT EXISTS idx_live_odds_commence ON live_odds_cache(commence_time);

-- ============================================================================
-- 2. SPORT-SPECIFIC ODDS TABLES
-- ============================================================================

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

-- Indexes for sport-specific tables
CREATE INDEX IF NOT EXISTS idx_mlb_odds_game_id ON mlb_odds(game_id);
CREATE INDEX IF NOT EXISTS idx_nfl_odds_game_id ON nfl_odds(game_id);
CREATE INDEX IF NOT EXISTS idx_nba_odds_game_id ON nba_odds(game_id);
CREATE INDEX IF NOT EXISTS idx_nhl_odds_game_id ON nhl_odds(game_id);

-- ============================================================================
-- 3. LINE MOVEMENT TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS line_movement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  bookmaker VARCHAR(100) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  old_line NUMERIC,
  new_line NUMERIC,
  line_change NUMERIC,
  old_odds INTEGER,
  new_odds INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_movement_game_id ON line_movement(game_id);
CREATE INDEX IF NOT EXISTS idx_line_movement_sport ON line_movement(sport);
CREATE INDEX IF NOT EXISTS idx_line_movement_timestamp ON line_movement(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_line_movement_updated ON line_movement(updated_at DESC);

-- ============================================================================
-- 4. ARBITRAGE OPPORTUNITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  bookmaker_1 VARCHAR(100) NOT NULL,
  bookmaker_2 VARCHAR(100) NOT NULL,
  odds_1 INTEGER NOT NULL,
  odds_2 INTEGER NOT NULL,
  stake_1 NUMERIC NOT NULL,
  stake_2 NUMERIC NOT NULL,
  total_stake NUMERIC NOT NULL,
  profit_margin NUMERIC NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arb_sport ON arbitrage_opportunities(sport);
CREATE INDEX IF NOT EXISTS idx_arb_status ON arbitrage_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_arb_expires ON arbitrage_opportunities(expires_at);
CREATE INDEX IF NOT EXISTS idx_arb_profit ON arbitrage_opportunities(profit_margin DESC);

-- ============================================================================
-- 5. PLAYER PROPS MARKETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_props_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  prop_type VARCHAR(100) NOT NULL,
  line NUMERIC,
  over_odds INTEGER,
  under_odds INTEGER,
  bookmaker VARCHAR(100) NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE INDEX IF NOT EXISTS idx_player_props_game_id ON player_props_markets(game_id);
CREATE INDEX IF NOT EXISTS idx_player_props_player ON player_props_markets(player_name);
CREATE INDEX IF NOT EXISTS idx_player_props_type ON player_props_markets(prop_type);

-- ============================================================================
-- 6. KALSHI PREDICTION MARKETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS kalshi_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id VARCHAR(255) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category VARCHAR(100),
  yes_price NUMERIC,
  no_price NUMERIC,
  volume NUMERIC,
  close_time TIMESTAMPTZ,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE INDEX IF NOT EXISTS idx_kalshi_category ON kalshi_markets(category);
CREATE INDEX IF NOT EXISTS idx_kalshi_cached ON kalshi_markets(cached_at DESC);

-- ============================================================================
-- 7. HISTORICAL DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS historical_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL UNIQUE,
  sport VARCHAR(50) NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  game_date TIMESTAMPTZ NOT NULL,
  final_odds JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historical_sport ON historical_games(sport);
CREATE INDEX IF NOT EXISTS idx_historical_date ON historical_games(game_date DESC);

-- ============================================================================
-- 8. AI RESPONSE TRUST SCORES
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_response_trust (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash VARCHAR(64) NOT NULL,
  response_content TEXT NOT NULL,
  trust_score NUMERIC CHECK (trust_score >= 0 AND trust_score <= 1),
  consensus_score NUMERIC CHECK (consensus_score >= 0 AND consensus_score <= 1),
  data_sources JSONB,
  validation_method VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_trust_hash ON ai_response_trust(query_hash);
CREATE INDEX IF NOT EXISTS idx_ai_trust_score ON ai_response_trust(trust_score DESC);

-- ============================================================================
-- 9. QUANTITATIVE TRADING ENGINE
-- ============================================================================

-- Capital state management
CREATE TABLE IF NOT EXISTS capital_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_capital NUMERIC NOT NULL CHECK (total_capital > 0),
  risk_budget NUMERIC NOT NULL CHECK (risk_budget > 0 AND risk_budget <= 1),
  max_single_position NUMERIC NOT NULL CHECK (max_single_position > 0 AND max_single_position <= 1),
  kelly_scale NUMERIC DEFAULT 0.25 CHECK (kelly_scale > 0 AND kelly_scale <= 1),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capital_state_active ON capital_state(active) WHERE active = true;

-- Bet allocations
CREATE TABLE IF NOT EXISTS bet_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capital_state_id UUID REFERENCES capital_state(id),
  market_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  matchup TEXT NOT NULL,
  edge NUMERIC NOT NULL,
  kelly_fraction NUMERIC NOT NULL CHECK (kelly_fraction >= 0 AND kelly_fraction <= 1),
  allocated_capital NUMERIC NOT NULL CHECK (allocated_capital > 0),
  confidence_score NUMERIC NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'placed', 'won', 'lost', 'void')),
  actual_return NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bet_allocations_market ON bet_allocations(market_id);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_sport ON bet_allocations(sport);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_status ON bet_allocations(status);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_created ON bet_allocations(created_at DESC);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE live_odds_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlb_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfl_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhl_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_movement ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_props_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kalshi_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_response_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_allocations ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth required)
CREATE POLICY "Public read access" ON live_odds_cache FOR SELECT USING (true);
CREATE POLICY "Public read access" ON mlb_odds FOR SELECT USING (true);
CREATE POLICY "Public read access" ON nfl_odds FOR SELECT USING (true);
CREATE POLICY "Public read access" ON nba_odds FOR SELECT USING (true);
CREATE POLICY "Public read access" ON nhl_odds FOR SELECT USING (true);
CREATE POLICY "Public read access" ON line_movement FOR SELECT USING (true);
CREATE POLICY "Public read access" ON arbitrage_opportunities FOR SELECT USING (true);
CREATE POLICY "Public read access" ON player_props_markets FOR SELECT USING (true);
CREATE POLICY "Public read access" ON kalshi_markets FOR SELECT USING (true);
CREATE POLICY "Public read access" ON historical_games FOR SELECT USING (true);
CREATE POLICY "Public read access" ON ai_response_trust FOR SELECT USING (true);
CREATE POLICY "Public read access" ON capital_state FOR SELECT USING (true);
CREATE POLICY "Public read access" ON bet_allocations FOR SELECT USING (true);

-- Authenticated write access
CREATE POLICY "Auth write access" ON live_odds_cache FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write access" ON mlb_odds FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write access" ON nfl_odds FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write access" ON nba_odds FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write access" ON nhl_odds FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write access" ON line_movement FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write access" ON arbitrage_opportunities FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write access" ON player_props_markets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write access" ON kalshi_markets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write access" ON capital_state FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write access" ON bet_allocations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- 11. ENABLE REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Enable realtime on critical tables for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE live_odds_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE line_movement;
ALTER PUBLICATION supabase_realtime ADD TABLE arbitrage_opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE player_props_markets;
ALTER PUBLICATION supabase_realtime ADD TABLE kalshi_markets;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Leverage AI database schema created successfully';
  RAISE NOTICE '✓ 13 tables created with indexes and constraints';
  RAISE NOTICE '✓ RLS policies applied for security';
  RAISE NOTICE '✓ Realtime subscriptions enabled';
  RAISE NOTICE 'Next: Test with /api/health endpoint';
END $$;
