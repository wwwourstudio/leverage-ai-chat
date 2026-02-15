-- Complete Database Schema for Sports Betting AI Platform
-- Execute this in Supabase SQL Editor to create ALL required tables

-- ==========================================
-- 1. LIVE ODDS CACHE (All Sports)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.live_odds_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  commence_time TIMESTAMP WITH TIME ZONE NOT NULL,
  sport_key VARCHAR(100) NOT NULL,
  bookmaker_count INTEGER DEFAULT 0,
  
  -- Market data (JSONB for flexibility)
  h2h_odds JSONB,
  spreads_odds JSONB,
  totals_odds JSONB,
  player_props JSONB,
  
  -- Metadata
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  UNIQUE(event_id, sport_key)
);

CREATE INDEX IF NOT EXISTS idx_live_odds_sport ON public.live_odds_cache(sport_key);
CREATE INDEX IF NOT EXISTS idx_live_odds_commence ON public.live_odds_cache(commence_time);
CREATE INDEX IF NOT EXISTS idx_live_odds_updated ON public.live_odds_cache(updated_at);

-- ==========================================
-- 2. SPORT-SPECIFIC ODDS TABLES
-- ==========================================

-- MLB Odds
CREATE TABLE IF NOT EXISTS public.mlb_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE NOT NULL,
  stadium VARCHAR(255),
  weather_conditions JSONB,
  
  -- Starting Pitchers
  home_pitcher VARCHAR(255),
  away_pitcher VARCHAR(255),
  pitcher_stats JSONB,
  
  -- Odds
  moneyline JSONB,
  run_line JSONB,
  total JSONB,
  first_five_innings JSONB,
  player_props JSONB,
  
  -- Team Stats
  home_team_stats JSONB,
  away_team_stats JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NFL Odds
CREATE TABLE IF NOT EXISTS public.nfl_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE NOT NULL,
  stadium VARCHAR(255),
  weather_conditions JSONB,
  
  -- Odds
  moneyline JSONB,
  spread JSONB,
  total JSONB,
  player_props JSONB,
  team_props JSONB,
  
  -- Team Stats
  home_team_stats JSONB,
  away_team_stats JSONB,
  
  -- Game Info
  week INTEGER,
  season INTEGER,
  game_type VARCHAR(50), -- regular, playoff, superbowl
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NBA Odds
CREATE TABLE IF NOT EXISTS public.nba_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE NOT NULL,
  arena VARCHAR(255),
  
  -- Odds
  moneyline JSONB,
  spread JSONB,
  total JSONB,
  player_props JSONB,
  
  -- Team Stats
  home_team_stats JSONB,
  away_team_stats JSONB,
  
  -- Rest Days
  home_rest_days INTEGER,
  away_rest_days INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NHL Odds
CREATE TABLE IF NOT EXISTS public.nhl_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE NOT NULL,
  arena VARCHAR(255),
  
  -- Goalies
  home_goalie VARCHAR(255),
  away_goalie VARCHAR(255),
  goalie_stats JSONB,
  
  -- Odds
  moneyline JSONB,
  puck_line JSONB,
  total JSONB,
  player_props JSONB,
  
  -- Team Stats
  home_team_stats JSONB,
  away_team_stats JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. LINE MOVEMENT TRACKING
-- ==========================================

CREATE TABLE IF NOT EXISTS public.line_movement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL,
  sport_key VARCHAR(100) NOT NULL,
  market_type VARCHAR(50) NOT NULL, -- h2h, spreads, totals
  bookmaker VARCHAR(100) NOT NULL,
  
  -- Odds snapshot
  odds_snapshot JSONB NOT NULL,
  
  -- Tracking
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  FOREIGN KEY (event_id) REFERENCES public.live_odds_cache(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_line_movement_event ON public.line_movement(event_id);
CREATE INDEX IF NOT EXISTS idx_line_movement_time ON public.line_movement(recorded_at DESC);

-- ==========================================
-- 4. PLAYER STATS AND PROPS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name VARCHAR(255) NOT NULL,
  team VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  position VARCHAR(50),
  
  -- Season Stats (JSONB for flexibility across sports)
  season_stats JSONB,
  recent_games JSONB, -- Last 5-10 games
  vs_opponent JSONB, -- Historical performance vs current opponent
  home_away_splits JSONB,
  
  -- Injury Status
  injury_status VARCHAR(100),
  injury_notes TEXT,
  
  -- Metadata
  season INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(player_name, team, sport, season)
);

CREATE INDEX IF NOT EXISTS idx_player_stats_player ON public.player_stats(player_name);
CREATE INDEX IF NOT EXISTS idx_player_stats_team ON public.player_stats(team);
CREATE INDEX IF NOT EXISTS idx_player_stats_sport ON public.player_stats(sport);

-- Player Props Markets
CREATE TABLE IF NOT EXISTS public.player_props_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  prop_type VARCHAR(100) NOT NULL, -- points, rebounds, assists, touchdowns, etc.
  line DECIMAL(10, 2),
  over_odds INTEGER,
  under_odds INTEGER,
  bookmaker VARCHAR(100),
  
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  FOREIGN KEY (event_id) REFERENCES public.live_odds_cache(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_props_event ON public.player_props_markets(event_id);
CREATE INDEX IF NOT EXISTS idx_player_props_player ON public.player_props_markets(player_name);

-- ==========================================
-- 5. HISTORICAL GAMES (Completed)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.historical_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE NOT NULL,
  sport_key VARCHAR(100) NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Final Score
  home_score INTEGER,
  away_score INTEGER,
  
  -- Pre-game odds
  opening_odds JSONB,
  closing_odds JSONB,
  
  -- Results
  winner VARCHAR(255),
  covered_spread BOOLEAN,
  hit_over BOOLEAN,
  
  -- Game Stats
  game_stats JSONB,
  player_stats JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historical_sport ON public.historical_games(sport_key);
CREATE INDEX IF NOT EXISTS idx_historical_date ON public.historical_games(game_date DESC);

-- ==========================================
-- 6. KALSHI MARKETS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.kalshi_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_ticker VARCHAR(255) UNIQUE NOT NULL,
  market_title TEXT NOT NULL,
  category VARCHAR(100), -- sports, politics, economics
  sub_category VARCHAR(100), -- nfl, nba, presidential, etc.
  
  -- Market Details
  yes_price DECIMAL(10, 4),
  no_price DECIMAL(10, 4),
  volume INTEGER DEFAULT 0,
  open_interest INTEGER DEFAULT 0,
  
  -- Timing
  close_time TIMESTAMP WITH TIME ZONE,
  expiry_time TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status VARCHAR(50), -- active, closed, settled
  result VARCHAR(10), -- yes, no, null
  
  -- Related Event (if sports)
  related_event_id VARCHAR(255),
  
  -- Metadata
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kalshi_category ON public.kalshi_markets(category);
CREATE INDEX IF NOT EXISTS idx_kalshi_status ON public.kalshi_markets(status);
CREATE INDEX IF NOT EXISTS idx_kalshi_close ON public.kalshi_markets(close_time);

-- ==========================================
-- 7. ARBITRAGE OPPORTUNITIES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.arbitrage_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL,
  sport_key VARCHAR(100) NOT NULL,
  
  -- Opportunity Details
  home_team VARCHAR(255),
  away_team VARCHAR(255),
  profit_percentage DECIMAL(10, 4),
  
  -- Legs
  leg1_bookmaker VARCHAR(100),
  leg1_outcome VARCHAR(255),
  leg1_odds INTEGER,
  leg2_bookmaker VARCHAR(100),
  leg2_outcome VARCHAR(255),
  leg2_odds INTEGER,
  
  -- Timing
  identified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  still_valid BOOLEAN DEFAULT TRUE,
  
  FOREIGN KEY (event_id) REFERENCES public.live_odds_cache(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_arb_sport ON public.arbitrage_opportunities(sport_key);
CREATE INDEX IF NOT EXISTS idx_arb_profit ON public.arbitrage_opportunities(profit_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_arb_valid ON public.arbitrage_opportunities(still_valid, identified_at DESC);

-- ==========================================
-- 8. AI RESPONSE TRUST METRICS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.ai_response_trust (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  
  -- Trust Metrics
  consensus_score INTEGER DEFAULT 50,
  data_freshness VARCHAR(50),
  source_count INTEGER DEFAULT 0,
  conflicting_sources BOOLEAN DEFAULT FALSE,
  
  -- Context
  sport VARCHAR(100),
  market_type VARCHAR(100),
  had_real_data BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_sport ON public.ai_response_trust(sport);
CREATE INDEX IF NOT EXISTS idx_trust_created ON public.ai_response_trust(created_at DESC);

-- ==========================================
-- 9. USER PREDICTIONS AND TRACKING
-- ==========================================

CREATE TABLE IF NOT EXISTS public.user_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- Placeholder for future auth
  event_id VARCHAR(255) NOT NULL,
  
  -- Prediction
  predicted_outcome VARCHAR(255),
  confidence INTEGER, -- 1-100
  bet_amount DECIMAL(10, 2),
  predicted_odds INTEGER,
  
  -- Result
  actual_outcome VARCHAR(255),
  won BOOLEAN,
  profit_loss DECIMAL(10, 2),
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settled_at TIMESTAMP WITH TIME ZONE,
  
  FOREIGN KEY (event_id) REFERENCES public.live_odds_cache(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_predictions_user ON public.user_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_event ON public.user_predictions(event_id);

-- ==========================================
-- 10. ENABLE ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE public.live_odds_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mlb_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfl_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nba_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhl_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_movement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_props_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kalshi_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arbitrage_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_response_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_predictions ENABLE ROW LEVEL SECURITY;

-- Allow public read access (modify for production)
CREATE POLICY "Allow public read access" ON public.live_odds_cache FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.mlb_odds FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.nfl_odds FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.nba_odds FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.nhl_odds FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.line_movement FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.player_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.player_props_markets FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.historical_games FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.kalshi_markets FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.arbitrage_opportunities FOR SELECT USING (true);

-- ==========================================
-- 11. AUTOMATIC TIMESTAMP UPDATES
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_live_odds_updated_at BEFORE UPDATE ON public.live_odds_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mlb_odds_updated_at BEFORE UPDATE ON public.mlb_odds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nfl_odds_updated_at BEFORE UPDATE ON public.nfl_odds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nba_odds_updated_at BEFORE UPDATE ON public.nba_odds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nhl_odds_updated_at BEFORE UPDATE ON public.nhl_odds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kalshi_updated_at BEFORE UPDATE ON public.kalshi_markets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- DONE! 
-- ==========================================
-- All tables created successfully.
-- Next steps:
-- 1. Populate tables with data from APIs
-- 2. Set up scheduled jobs to refresh data
-- 3. Implement caching strategy
