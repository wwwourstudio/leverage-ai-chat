-- ============================================================================
-- TRADING ENGINE DATABASE SCHEMA
-- Adds Kelly criterion, capital allocation, Bayesian updates, and more
-- ============================================================================

-- Capital State Management
CREATE TABLE IF NOT EXISTS capital_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_capital NUMERIC NOT NULL CHECK (total_capital > 0),
  risk_budget NUMERIC NOT NULL CHECK (risk_budget > 0 AND risk_budget <= 1), -- % of capital (e.g., 0.25 = 25%)
  max_single_position NUMERIC NOT NULL CHECK (max_single_position > 0 AND max_single_position <= 1), -- e.g., 0.05 = 5%
  kelly_scale NUMERIC DEFAULT 0.25 CHECK (kelly_scale > 0 AND kelly_scale <= 1), -- Fractional Kelly
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capital_state_active ON capital_state(active);

-- Bet Allocations (Kelly-based position sizing)
CREATE TABLE IF NOT EXISTS bet_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  matchup TEXT NOT NULL,
  edge NUMERIC NOT NULL,
  kelly_fraction NUMERIC NOT NULL CHECK (kelly_fraction >= 0),
  allocated_capital NUMERIC NOT NULL CHECK (allocated_capital >= 0),
  confidence_score NUMERIC NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  odds NUMERIC NOT NULL,
  model_prob NUMERIC NOT NULL CHECK (model_prob >= 0 AND model_prob <= 1),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'placed', 'won', 'lost', 'cancelled')),
  result NUMERIC, -- Actual P&L
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bet_allocations_status ON bet_allocations(status);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_sport ON bet_allocations(sport);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_created ON bet_allocations(created_at DESC);

-- Bayesian Priors for Player Projections
CREATE TABLE IF NOT EXISTS projection_priors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  stat_type TEXT NOT NULL, -- 'points', 'rebounds', 'assists', 'yards', etc.
  prior_mean NUMERIC NOT NULL,
  prior_variance NUMERIC NOT NULL CHECK (prior_variance > 0),
  posterior_mean NUMERIC,
  posterior_variance NUMERIC,
  credibility_score NUMERIC CHECK (credibility_score >= 0 AND credibility_score <= 1),
  sample_size INT DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projection_priors_player ON projection_priors(player_id, stat_type);
CREATE INDEX IF NOT EXISTS idx_projection_priors_sport ON projection_priors(sport);
CREATE INDEX IF NOT EXISTS idx_projection_priors_updated ON projection_priors(last_updated DESC);

-- Edge Opportunities (Real-time edge detection)
CREATE TABLE IF NOT EXISTS edge_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  matchup TEXT NOT NULL,
  market_type TEXT NOT NULL, -- 'h2h', 'spread', 'total', 'player_prop'
  model_prob NUMERIC NOT NULL CHECK (model_prob >= 0 AND model_prob <= 1),
  market_prob NUMERIC NOT NULL CHECK (market_prob >= 0 AND market_prob <= 1),
  edge NUMERIC NOT NULL,
  odds NUMERIC NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  integrity_score NUMERIC CHECK (integrity_score >= 0 AND integrity_score <= 100),
  sharp_signal BOOLEAN DEFAULT false,
  bookmaker TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_opportunities_edge ON edge_opportunities(edge DESC);
CREATE INDEX IF NOT EXISTS idx_edge_opportunities_sport ON edge_opportunities(sport);
CREATE INDEX IF NOT EXISTS idx_edge_opportunities_expires ON edge_opportunities(expires_at);

-- Arbitrage Opportunities
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id_a TEXT NOT NULL,
  market_id_b TEXT NOT NULL,
  sport TEXT NOT NULL,
  matchup TEXT NOT NULL,
  prob_a NUMERIC NOT NULL CHECK (prob_a >= 0 AND prob_a <= 1),
  prob_b NUMERIC NOT NULL CHECK (prob_b >= 0 AND prob_b <= 1),
  profit_percentage NUMERIC NOT NULL,
  bookmaker_a TEXT NOT NULL,
  bookmaker_b TEXT NOT NULL,
  odds_a NUMERIC NOT NULL,
  odds_b NUMERIC NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'taken', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arbitrage_profit ON arbitrage_opportunities(profit_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_arbitrage_status ON arbitrage_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_arbitrage_expires ON arbitrage_opportunities(expires_at);

-- Sharp Money Signals
CREATE TABLE IF NOT EXISTS sharp_money_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  matchup TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('line_move', 'cross_book_spread', 'kalshi_disagreement', 'benford_anomaly')),
  signal_strength NUMERIC NOT NULL CHECK (signal_strength >= 0 AND signal_strength <= 1),
  details JSONB,
  detected_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sharp_signals_market ON sharp_money_signals(market_id);
CREATE INDEX IF NOT EXISTS idx_sharp_signals_strength ON sharp_money_signals(signal_strength DESC);
CREATE INDEX IF NOT EXISTS idx_sharp_signals_detected ON sharp_money_signals(detected_at DESC);

-- Line Movement Tracking
CREATE TABLE IF NOT EXISTS line_movement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  market_type TEXT NOT NULL,
  odds_value NUMERIC NOT NULL,
  spread_value NUMERIC,
  total_value NUMERIC,
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_movement_market ON line_movement(market_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_line_movement_bookmaker ON line_movement(bookmaker);

-- Performance Tracking
CREATE TABLE IF NOT EXISTS allocation_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID REFERENCES bet_allocations(id),
  actual_result NUMERIC NOT NULL,
  expected_value NUMERIC NOT NULL,
  variance NUMERIC NOT NULL,
  roi NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_allocation_performance_roi ON allocation_performance(roi DESC);
CREATE INDEX IF NOT EXISTS idx_allocation_performance_recorded ON allocation_performance(recorded_at DESC);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to relevant tables
DROP TRIGGER IF EXISTS update_capital_state_updated_at ON capital_state;
CREATE TRIGGER update_capital_state_updated_at
    BEFORE UPDATE ON capital_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bet_allocations_updated_at ON bet_allocations;
CREATE TRIGGER update_bet_allocations_updated_at
    BEFORE UPDATE ON bet_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default capital state (if none exists)
INSERT INTO capital_state (total_capital, risk_budget, max_single_position, kelly_scale)
SELECT 10000, 0.25, 0.05, 0.25
WHERE NOT EXISTS (SELECT 1 FROM capital_state WHERE active = true);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active edge opportunities view
CREATE OR REPLACE VIEW active_edges AS
SELECT 
  eo.*,
  CASE 
    WHEN eo.edge > 0.05 THEN 'excellent'
    WHEN eo.edge > 0.03 THEN 'good'
    WHEN eo.edge > 0.02 THEN 'fair'
    ELSE 'marginal'
  END as edge_quality
FROM edge_opportunities eo
WHERE eo.expires_at > now()
  AND eo.edge > 0.02
  AND eo.integrity_score > 40
ORDER BY eo.edge DESC;

-- Portfolio summary view
CREATE OR REPLACE VIEW portfolio_summary AS
SELECT 
  sport,
  COUNT(*) as position_count,
  SUM(allocated_capital) as total_capital,
  AVG(edge) as avg_edge,
  AVG(confidence_score) as avg_confidence,
  SUM(CASE WHEN status = 'won' THEN result ELSE 0 END) as total_profit,
  SUM(CASE WHEN status = 'lost' THEN result ELSE 0 END) as total_loss
FROM bet_allocations
WHERE status IN ('pending', 'placed', 'won', 'lost')
GROUP BY sport;

COMMENT ON TABLE capital_state IS 'Manages total bankroll and risk parameters';
COMMENT ON TABLE bet_allocations IS 'Kelly-based position sizing for each bet';
COMMENT ON TABLE projection_priors IS 'Bayesian priors for player stat projections';
COMMENT ON TABLE edge_opportunities IS 'Real-time edge detection across markets';
COMMENT ON TABLE arbitrage_opportunities IS 'Cross-bookmaker arbitrage detection';
COMMENT ON TABLE sharp_money_signals IS 'Multi-signal sharp money detection';
COMMENT ON TABLE line_movement IS 'Historical odds movement tracking';
