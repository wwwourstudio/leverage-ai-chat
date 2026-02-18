-- ============================================================================
-- QUANTITATIVE SPORTS TRADING ENGINE - DATABASE SCHEMA
-- Safe additions - does NOT modify existing tables
-- ============================================================================

-- Capital State Management
CREATE TABLE IF NOT EXISTS capital_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_capital NUMERIC NOT NULL CHECK (total_capital > 0),
  risk_budget NUMERIC NOT NULL CHECK (risk_budget > 0 AND risk_budget <= 1), -- % of capital at risk (e.g., 0.25 = 25%)
  max_single_position NUMERIC NOT NULL CHECK (max_single_position > 0 AND max_single_position <= 1), -- Max per position (e.g., 0.05 = 5%)
  kelly_scale NUMERIC DEFAULT 0.25 CHECK (kelly_scale > 0 AND kelly_scale <= 1), -- Fractional Kelly
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for active capital state
CREATE INDEX IF NOT EXISTS idx_capital_state_active ON capital_state(active) WHERE active = true;

-- Bet Allocations
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
  actual_return NUMERIC, -- Filled when bet settles
  created_at TIMESTAMPTZ DEFAULT now(),
  settled_at TIMESTAMPTZ
);

-- Indexes for bet allocations
CREATE INDEX IF NOT EXISTS idx_bet_allocations_market ON bet_allocations(market_id);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_sport ON bet_allocations(sport);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_status ON bet_allocations(status);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_created ON bet_allocations(created_at DESC);

-- Bayesian Priors for Player Projections
CREATE TABLE IF NOT EXISTS projection_priors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  stat_type TEXT NOT NULL, -- 'points', 'assists', 'rebounds', 'yards', 'touchdowns', etc.
  prior_mean NUMERIC NOT NULL,
  prior_variance NUMERIC NOT NULL CHECK (prior_variance > 0),
  sample_size INTEGER DEFAULT 0, -- Number of games used to build prior
  last_updated TIMESTAMPTZ DEFAULT now(),
  season TEXT, -- e.g., '2025-26' or '2026'
  UNIQUE(player_id, stat_type, season)
);

-- Indexes for priors
CREATE INDEX IF NOT EXISTS idx_projection_priors_player ON projection_priors(player_id);
CREATE INDEX IF NOT EXISTS idx_projection_priors_sport ON projection_priors(sport);
CREATE INDEX IF NOT EXISTS idx_projection_priors_updated ON projection_priors(last_updated DESC);

-- Bayesian Updates Log
CREATE TABLE IF NOT EXISTS bayesian_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prior_id UUID REFERENCES projection_priors(id),
  player_id TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  prior_mean NUMERIC NOT NULL,
  prior_variance NUMERIC NOT NULL,
  sample_mean NUMERIC NOT NULL,
  sample_variance NUMERIC NOT NULL,
  sample_size INTEGER NOT NULL,
  posterior_mean NUMERIC NOT NULL,
  posterior_variance NUMERIC NOT NULL,
  credible_interval_lower NUMERIC NOT NULL,
  credible_interval_upper NUMERIC NOT NULL,
  update_strength NUMERIC, -- How much the data moved the prior (0-1)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bayesian_updates_player ON bayesian_updates(player_id);
CREATE INDEX IF NOT EXISTS idx_bayesian_updates_created ON bayesian_updates(created_at DESC);

-- Edge Opportunities
CREATE TABLE IF NOT EXISTS edge_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  event_id TEXT NOT NULL,
  matchup TEXT NOT NULL,
  market_type TEXT NOT NULL, -- 'h2h', 'spread', 'total', 'prop'
  model_prob NUMERIC NOT NULL CHECK (model_prob >= 0 AND model_prob <= 1),
  market_prob NUMERIC NOT NULL CHECK (market_prob >= 0 AND market_prob <= 1),
  edge NUMERIC NOT NULL, -- model_prob - market_prob
  odds NUMERIC NOT NULL,
  expected_value NUMERIC NOT NULL,
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
  integrity_score NUMERIC, -- Benford/validation score
  sharp_signal BOOLEAN DEFAULT false,
  arbitrage_detected BOOLEAN DEFAULT false,
  recommended BOOLEAN DEFAULT false, -- Meets all criteria for betting
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for edge opportunities
CREATE INDEX IF NOT EXISTS idx_edge_opportunities_sport ON edge_opportunities(sport);
CREATE INDEX IF NOT EXISTS idx_edge_opportunities_edge ON edge_opportunities(edge DESC);
CREATE INDEX IF NOT EXISTS idx_edge_opportunities_recommended ON edge_opportunities(recommended) WHERE recommended = true;
CREATE INDEX IF NOT EXISTS idx_edge_opportunities_expires ON edge_opportunities(expires_at);

-- Sharp Money Signals
CREATE TABLE IF NOT EXISTS sharp_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  event_id TEXT NOT NULL,
  signal_type TEXT NOT NULL, -- 'line_move', 'steam', 'reverse_line_move', 'cross_book_discrepancy'
  magnitude NUMERIC NOT NULL, -- Strength of signal
  opening_line NUMERIC,
  current_line NUMERIC,
  line_move NUMERIC, -- Change in line
  implied_prob_spread NUMERIC, -- Cross-book discrepancy
  kalshi_disagreement NUMERIC, -- Kalshi vs sportsbook diff
  benford_score NUMERIC,
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  direction TEXT CHECK (direction IN ('home', 'away', 'over', 'under')),
  detected_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for sharp signals
CREATE INDEX IF NOT EXISTS idx_sharp_signals_market ON sharp_signals(market_id);
CREATE INDEX IF NOT EXISTS idx_sharp_signals_detected ON sharp_signals(detected_at DESC);

-- ML Projections
CREATE TABLE IF NOT EXISTS ml_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  game_id TEXT NOT NULL,
  opponent TEXT NOT NULL,
  projected_value NUMERIC NOT NULL,
  confidence_interval_lower NUMERIC NOT NULL,
  confidence_interval_upper NUMERIC NOT NULL,
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
  model_version TEXT NOT NULL, -- Version tag for model
  features JSONB, -- Store feature values used
  historical_avg NUMERIC,
  opponent_adjusted NUMERIC,
  market_signal NUMERIC,
  sharp_signal NUMERIC,
  pace_weather_adj NUMERIC,
  game_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, stat_type, game_id, model_version)
);

-- Indexes for ML projections
CREATE INDEX IF NOT EXISTS idx_ml_projections_player ON ml_projections(player_id);
CREATE INDEX IF NOT EXISTS idx_ml_projections_game ON ml_projections(game_id);
CREATE INDEX IF NOT EXISTS idx_ml_projections_game_date ON ml_projections(game_date);

-- Arbitrage Opportunities
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_key TEXT NOT NULL, -- Unique identifier for the market
  sport TEXT NOT NULL,
  event_id TEXT NOT NULL,
  matchup TEXT NOT NULL,
  side1_bookmaker TEXT NOT NULL,
  side1_odds NUMERIC NOT NULL,
  side1_stake NUMERIC NOT NULL,
  side2_bookmaker TEXT NOT NULL,
  side2_odds NUMERIC NOT NULL,
  side2_stake NUMERIC NOT NULL,
  total_stake NUMERIC NOT NULL,
  guaranteed_profit NUMERIC NOT NULL,
  profit_margin NUMERIC NOT NULL, -- As percentage
  total_implied_prob NUMERIC NOT NULL CHECK (total_implied_prob < 1),
  risk_free BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'executed', 'expired', 'invalid')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  executed_at TIMESTAMPTZ
);

-- Indexes for arbitrage
CREATE INDEX IF NOT EXISTS idx_arbitrage_sport ON arbitrage_opportunities(sport);
CREATE INDEX IF NOT EXISTS idx_arbitrage_profit ON arbitrage_opportunities(profit_margin DESC);
CREATE INDEX IF NOT EXISTS idx_arbitrage_status ON arbitrage_opportunities(status) WHERE status = 'active';

-- Benford Analysis Results
CREATE TABLE IF NOT EXISTS benford_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_type TEXT NOT NULL, -- 'player_props', 'game_totals', 'spreads'
  sport TEXT NOT NULL,
  sample_size INTEGER NOT NULL,
  chi_squared NUMERIC NOT NULL,
  p_value NUMERIC NOT NULL,
  conformity_score NUMERIC NOT NULL CHECK (conformity_score >= 0 AND conformity_score <= 100),
  digit_distribution JSONB NOT NULL, -- First digit frequencies
  passed BOOLEAN NOT NULL, -- True if passes Benford test
  note TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benford_sport ON benford_results(sport);
CREATE INDEX IF NOT EXISTS idx_benford_analyzed ON benford_results(analyzed_at DESC);

-- Portfolio Performance Tracking
CREATE TABLE IF NOT EXISTS portfolio_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capital_state_id UUID REFERENCES capital_state(id),
  date DATE NOT NULL,
  starting_capital NUMERIC NOT NULL,
  ending_capital NUMERIC NOT NULL,
  daily_pnl NUMERIC NOT NULL,
  daily_return NUMERIC NOT NULL, -- As percentage
  bets_placed INTEGER DEFAULT 0,
  bets_won INTEGER DEFAULT 0,
  bets_lost INTEGER DEFAULT 0,
  win_rate NUMERIC,
  average_edge NUMERIC,
  sharpe_ratio NUMERIC,
  max_drawdown NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(capital_state_id, date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_date ON portfolio_performance(date DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_capital_state ON portfolio_performance(capital_state_id);

-- System Health Metrics
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL, -- 'api_latency', 'model_accuracy', 'edge_hit_rate', 'sharpe', 'kelly_adherence'
  metric_value NUMERIC NOT NULL,
  sport TEXT,
  context JSONB, -- Additional metadata
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded ON system_metrics(recorded_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get active capital state
CREATE OR REPLACE FUNCTION get_active_capital_state()
RETURNS TABLE (
  id UUID,
  total_capital NUMERIC,
  risk_budget NUMERIC,
  max_single_position NUMERIC,
  kelly_scale NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.total_capital,
    cs.risk_budget,
    cs.max_single_position,
    cs.kelly_scale
  FROM capital_state cs
  WHERE cs.active = true
  ORDER BY cs.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate portfolio stats
CREATE OR REPLACE FUNCTION calculate_portfolio_stats(state_id UUID)
RETURNS TABLE (
  total_bets INTEGER,
  total_allocated NUMERIC,
  total_returned NUMERIC,
  total_pnl NUMERIC,
  win_rate NUMERIC,
  roi NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_bets,
    SUM(allocated_capital) as total_allocated,
    SUM(COALESCE(actual_return, 0)) as total_returned,
    SUM(COALESCE(actual_return, 0) - allocated_capital) as total_pnl,
    (COUNT(*) FILTER (WHERE status = 'won')::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE status IN ('won', 'lost')), 0)) * 100 as win_rate,
    ((SUM(COALESCE(actual_return, 0)) - SUM(allocated_capital)) / NULLIF(SUM(allocated_capital), 0)) * 100 as roi
  FROM bet_allocations
  WHERE capital_state_id = state_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (Optional - Enable if needed)
-- ============================================================================

-- Enable RLS on sensitive tables
-- ALTER TABLE capital_state ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bet_allocations ENABLE ROW LEVEL SECURITY;

-- Example policy (adjust based on your auth setup)
-- CREATE POLICY "Users can view their own allocations"
--   ON bet_allocations FOR SELECT
--   USING (auth.uid() = user_id); -- Add user_id column if using auth

-- ============================================================================
-- INITIAL DATA (Optional)
-- ============================================================================

-- Insert default capital state (adjust values as needed)
INSERT INTO capital_state (total_capital, risk_budget, max_single_position, kelly_scale, active)
VALUES (10000, 0.25, 0.05, 0.25, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMPLETE
-- ============================================================================
-- This schema provides the foundation for:
-- ✅ Capital allocation with Kelly Criterion
-- ✅ Bayesian updating for player projections
-- ✅ Edge detection and opportunity tracking
-- ✅ Sharp money signal detection
-- ✅ ML projection storage
-- ✅ Arbitrage detection
-- ✅ Benford integrity analysis
-- ✅ Portfolio performance tracking
-- ✅ System health monitoring
-- ============================================================================
