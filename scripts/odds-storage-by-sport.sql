-- =============================================================================
-- SPORTS ODDS DATA STORAGE - SPORT-SPECIFIC TABLES
-- =============================================================================
-- Purpose: Store live odds data for each major sport separately
-- Created: 2026-02-14
-- Database: PostgreSQL 15+ / Supabase
-- =============================================================================

-- =============================================================================
-- NBA ODDS STORAGE
-- =============================================================================

CREATE TABLE IF NOT EXISTS nba_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Identification
  event_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  
  -- Market Data
  market_type VARCHAR(50) NOT NULL DEFAULT 'h2h',
  sportsbook VARCHAR(100) NOT NULL,
  
  -- Odds Data (H2H)
  home_odds DECIMAL(8,2),
  away_odds DECIMAL(8,2),
  home_implied_prob DECIMAL(5,4),
  away_implied_prob DECIMAL(5,4),
  
  -- Odds Data (Spreads)
  home_spread DECIMAL(6,2),
  home_spread_odds DECIMAL(8,2),
  away_spread DECIMAL(6,2),
  away_spread_odds DECIMAL(8,2),
  
  -- Odds Data (Totals)
  over_total DECIMAL(6,2),
  over_odds DECIMAL(8,2),
  under_total DECIMAL(6,2),
  under_odds DECIMAL(8,2),
  
  -- Full odds JSON for flexibility
  raw_odds_data JSONB,
  
  -- Metadata
  source VARCHAR(100) NOT NULL DEFAULT 'the-odds-api',
  api_requests_remaining INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_nba_event_book UNIQUE(event_id, sportsbook, market_type, fetched_at)
);

CREATE INDEX idx_nba_odds_event_id ON nba_odds(event_id);
CREATE INDEX idx_nba_odds_commence_time ON nba_odds(commence_time);
CREATE INDEX idx_nba_odds_fetched_at ON nba_odds(fetched_at DESC);
CREATE INDEX idx_nba_odds_expires_at ON nba_odds(expires_at);
CREATE INDEX idx_nba_odds_sportsbook ON nba_odds(sportsbook);

-- =============================================================================
-- NFL ODDS STORAGE
-- =============================================================================

CREATE TABLE IF NOT EXISTS nfl_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Identification
  event_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  
  -- Market Data
  market_type VARCHAR(50) NOT NULL DEFAULT 'h2h',
  sportsbook VARCHAR(100) NOT NULL,
  
  -- Odds Data
  home_odds DECIMAL(8,2),
  away_odds DECIMAL(8,2),
  home_implied_prob DECIMAL(5,4),
  away_implied_prob DECIMAL(5,4),
  home_spread DECIMAL(6,2),
  home_spread_odds DECIMAL(8,2),
  away_spread DECIMAL(6,2),
  away_spread_odds DECIMAL(8,2),
  over_total DECIMAL(6,2),
  over_odds DECIMAL(8,2),
  under_total DECIMAL(6,2),
  under_odds DECIMAL(8,2),
  raw_odds_data JSONB,
  
  -- Metadata
  source VARCHAR(100) NOT NULL DEFAULT 'the-odds-api',
  api_requests_remaining INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_nfl_event_book UNIQUE(event_id, sportsbook, market_type, fetched_at)
);

CREATE INDEX idx_nfl_odds_event_id ON nfl_odds(event_id);
CREATE INDEX idx_nfl_odds_commence_time ON nfl_odds(commence_time);
CREATE INDEX idx_nfl_odds_fetched_at ON nfl_odds(fetched_at DESC);
CREATE INDEX idx_nfl_odds_expires_at ON nfl_odds(expires_at);

-- =============================================================================
-- MLB ODDS STORAGE
-- =============================================================================

CREATE TABLE IF NOT EXISTS mlb_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Identification
  event_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  
  -- Market Data
  market_type VARCHAR(50) NOT NULL DEFAULT 'h2h',
  sportsbook VARCHAR(100) NOT NULL,
  
  -- Odds Data
  home_odds DECIMAL(8,2),
  away_odds DECIMAL(8,2),
  home_implied_prob DECIMAL(5,4),
  away_implied_prob DECIMAL(5,4),
  home_spread DECIMAL(6,2),
  home_spread_odds DECIMAL(8,2),
  away_spread DECIMAL(6,2),
  away_spread_odds DECIMAL(8,2),
  over_total DECIMAL(6,2),
  over_odds DECIMAL(8,2),
  under_total DECIMAL(6,2),
  under_odds DECIMAL(8,2),
  raw_odds_data JSONB,
  
  -- Metadata
  source VARCHAR(100) NOT NULL DEFAULT 'the-odds-api',
  api_requests_remaining INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_mlb_event_book UNIQUE(event_id, sportsbook, market_type, fetched_at)
);

CREATE INDEX idx_mlb_odds_event_id ON mlb_odds(event_id);
CREATE INDEX idx_mlb_odds_commence_time ON mlb_odds(commence_time);
CREATE INDEX idx_mlb_odds_fetched_at ON mlb_odds(fetched_at DESC);
CREATE INDEX idx_mlb_odds_expires_at ON mlb_odds(expires_at);

-- =============================================================================
-- NHL ODDS STORAGE
-- =============================================================================

CREATE TABLE IF NOT EXISTS nhl_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Identification
  event_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  
  -- Market Data
  market_type VARCHAR(50) NOT NULL DEFAULT 'h2h',
  sportsbook VARCHAR(100) NOT NULL,
  
  -- Odds Data
  home_odds DECIMAL(8,2),
  away_odds DECIMAL(8,2),
  home_implied_prob DECIMAL(5,4),
  away_implied_prob DECIMAL(5,4),
  home_spread DECIMAL(6,2),
  home_spread_odds DECIMAL(8,2),
  away_spread DECIMAL(6,2),
  away_spread_odds DECIMAL(8,2),
  over_total DECIMAL(6,2),
  over_odds DECIMAL(8,2),
  under_total DECIMAL(6,2),
  under_odds DECIMAL(8,2),
  raw_odds_data JSONB,
  
  -- Metadata
  source VARCHAR(100) NOT NULL DEFAULT 'the-odds-api',
  api_requests_remaining INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_nhl_event_book UNIQUE(event_id, sportsbook, market_type, fetched_at)
);

CREATE INDEX idx_nhl_odds_event_id ON nhl_odds(event_id);
CREATE INDEX idx_nhl_odds_commence_time ON nhl_odds(commence_time);
CREATE INDEX idx_nhl_odds_fetched_at ON nhl_odds(fetched_at DESC);
CREATE INDEX idx_nhl_odds_expires_at ON nhl_odds(expires_at);

-- =============================================================================
-- NCAAB (COLLEGE BASKETBALL) ODDS STORAGE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ncaab_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Identification
  event_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  
  -- Market Data
  market_type VARCHAR(50) NOT NULL DEFAULT 'h2h',
  sportsbook VARCHAR(100) NOT NULL,
  
  -- Odds Data
  home_odds DECIMAL(8,2),
  away_odds DECIMAL(8,2),
  home_implied_prob DECIMAL(5,4),
  away_implied_prob DECIMAL(5,4),
  home_spread DECIMAL(6,2),
  home_spread_odds DECIMAL(8,2),
  away_spread DECIMAL(6,2),
  away_spread_odds DECIMAL(8,2),
  over_total DECIMAL(6,2),
  over_odds DECIMAL(8,2),
  under_total DECIMAL(6,2),
  under_odds DECIMAL(8,2),
  raw_odds_data JSONB,
  
  -- Metadata
  source VARCHAR(100) NOT NULL DEFAULT 'the-odds-api',
  api_requests_remaining INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_ncaab_event_book UNIQUE(event_id, sportsbook, market_type, fetched_at)
);

CREATE INDEX idx_ncaab_odds_event_id ON ncaab_odds(event_id);
CREATE INDEX idx_ncaab_odds_commence_time ON ncaab_odds(commence_time);
CREATE INDEX idx_ncaab_odds_fetched_at ON ncaab_odds(fetched_at DESC);
CREATE INDEX idx_ncaab_odds_expires_at ON ncaab_odds(expires_at);

-- =============================================================================
-- NCAAF (COLLEGE FOOTBALL) ODDS STORAGE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ncaaf_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Identification
  event_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  
  -- Market Data
  market_type VARCHAR(50) NOT NULL DEFAULT 'h2h',
  sportsbook VARCHAR(100) NOT NULL,
  
  -- Odds Data
  home_odds DECIMAL(8,2),
  away_odds DECIMAL(8,2),
  home_implied_prob DECIMAL(5,4),
  away_implied_prob DECIMAL(5,4),
  home_spread DECIMAL(6,2),
  home_spread_odds DECIMAL(8,2),
  away_spread DECIMAL(6,2),
  away_spread_odds DECIMAL(8,2),
  over_total DECIMAL(6,2),
  over_odds DECIMAL(8,2),
  under_total DECIMAL(6,2),
  under_odds DECIMAL(8,2),
  raw_odds_data JSONB,
  
  -- Metadata
  source VARCHAR(100) NOT NULL DEFAULT 'the-odds-api',
  api_requests_remaining INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_ncaaf_event_book UNIQUE(event_id, sportsbook, market_type, fetched_at)
);

CREATE INDEX idx_ncaaf_odds_event_id ON ncaaf_odds(event_id);
CREATE INDEX idx_ncaaf_odds_commence_time ON ncaaf_odds(commence_time);
CREATE INDEX idx_ncaaf_odds_fetched_at ON ncaaf_odds(fetched_at DESC);
CREATE INDEX idx_ncaaf_odds_expires_at ON ncaaf_odds(expires_at);

-- =============================================================================
-- COLLEGE BASEBALL ODDS STORAGE
-- =============================================================================

CREATE TABLE IF NOT EXISTS college_baseball_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Identification
  event_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  
  -- Market Data
  market_type VARCHAR(50) NOT NULL DEFAULT 'h2h',
  sportsbook VARCHAR(100) NOT NULL,
  
  -- Odds Data
  home_odds DECIMAL(8,2),
  away_odds DECIMAL(8,2),
  home_implied_prob DECIMAL(5,4),
  away_implied_prob DECIMAL(5,4),
  home_spread DECIMAL(6,2),
  home_spread_odds DECIMAL(8,2),
  away_spread DECIMAL(6,2),
  away_spread_odds DECIMAL(8,2),
  over_total DECIMAL(6,2),
  over_odds DECIMAL(8,2),
  under_total DECIMAL(6,2),
  under_odds DECIMAL(8,2),
  raw_odds_data JSONB,
  
  -- Metadata
  source VARCHAR(100) NOT NULL DEFAULT 'the-odds-api',
  api_requests_remaining INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_college_baseball_event_book UNIQUE(event_id, sportsbook, market_type, fetched_at)
);

CREATE INDEX idx_college_baseball_odds_event_id ON college_baseball_odds(event_id);
CREATE INDEX idx_college_baseball_odds_commence_time ON college_baseball_odds(commence_time);
CREATE INDEX idx_college_baseball_odds_fetched_at ON college_baseball_odds(fetched_at DESC);
CREATE INDEX idx_college_baseball_odds_expires_at ON college_baseball_odds(expires_at);

-- =============================================================================
-- CLEANUP FUNCTION FOR EXPIRED ODDS
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_odds() RETURNS void AS $$
BEGIN
  DELETE FROM nba_odds WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM nfl_odds WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM mlb_odds WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM nhl_odds WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM ncaab_odds WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM ncaaf_odds WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM college_baseball_odds WHERE expires_at < NOW() - INTERVAL '1 hour';
  
  RAISE NOTICE 'Expired odds cleaned up successfully';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- GRANT PERMISSIONS (for authenticated users)
-- =============================================================================

-- Allow authenticated users to read odds data
GRANT SELECT ON nba_odds TO authenticated;
GRANT SELECT ON nfl_odds TO authenticated;
GRANT SELECT ON mlb_odds TO authenticated;
GRANT SELECT ON nhl_odds TO authenticated;
GRANT SELECT ON ncaab_odds TO authenticated;
GRANT SELECT ON ncaaf_odds TO authenticated;
GRANT SELECT ON college_baseball_odds TO authenticated;

-- Allow service role full access
GRANT ALL ON nba_odds TO service_role;
GRANT ALL ON nfl_odds TO service_role;
GRANT ALL ON mlb_odds TO service_role;
GRANT ALL ON nhl_odds TO service_role;
GRANT ALL ON ncaab_odds TO service_role;
GRANT ALL ON ncaaf_odds TO service_role;
GRANT ALL ON college_baseball_odds TO service_role;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
