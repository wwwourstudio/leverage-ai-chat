-- Supabase Edge Function Schema for AI Trust & Integrity Validation
-- This schema supports market-grounded validation of AI predictions

-- Table: odds_benford_baselines
-- Stores rolling Benford distributions from real sportsbook odds
CREATE TABLE IF NOT EXISTS odds_benford_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport VARCHAR(50) NOT NULL,
  market_type VARCHAR(100) NOT NULL,
  digit_distribution JSONB NOT NULL, -- First digit distribution (1-9)
  sample_size INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, market_type)
);

CREATE INDEX idx_benford_sport_market ON odds_benford_baselines(sport, market_type);

-- Table: ai_response_trust
-- Tracks trust metrics for each AI response
CREATE TABLE IF NOT EXISTS ai_response_trust (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL,
  model_id VARCHAR(100) NOT NULL,
  sport VARCHAR(50),
  market_type VARCHAR(100),
  benford_score DECIMAL(5,2) NOT NULL,
  odds_alignment_score DECIMAL(5,2) NOT NULL,
  consensus_score DECIMAL(5,2) NOT NULL,
  historical_accuracy_score DECIMAL(5,2) NOT NULL,
  final_confidence DECIMAL(5,2) NOT NULL,
  trust_level VARCHAR(20) NOT NULL, -- 'high', 'medium', 'low'
  risk_level VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high'
  flags JSONB, -- Array of validation warnings
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trust_response ON ai_response_trust(response_id);
CREATE INDEX idx_trust_model ON ai_response_trust(model_id);
CREATE INDEX idx_trust_created ON ai_response_trust(created_at DESC);

-- Table: ai_audit_log
-- Append-only audit trail for all AI responses
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL,
  model_id VARCHAR(100) NOT NULL,
  raw_output TEXT NOT NULL,
  trust_breakdown JSONB NOT NULL, -- Full trust metric calculation details
  thresholds_used JSONB NOT NULL, -- Sport-specific thresholds applied
  throttle_state VARCHAR(50), -- 'none', 'adjusted', 'blocked'
  final_user_output TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_response ON ai_audit_log(response_id);
CREATE INDEX idx_audit_model ON ai_audit_log(model_id);
CREATE INDEX idx_audit_created ON ai_audit_log(created_at DESC);

-- Table: sport_validation_thresholds
-- Sport and market-type specific validation thresholds
CREATE TABLE IF NOT EXISTS sport_validation_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport VARCHAR(50) NOT NULL,
  market_type VARCHAR(100) NOT NULL,
  odds_deviation_tolerance DECIMAL(5,2) DEFAULT 3.0, -- % tolerance
  consensus_delta_tolerance DECIMAL(5,2) DEFAULT 5.0, -- % tolerance
  min_benford_samples INTEGER DEFAULT 100,
  benford_threshold DECIMAL(5,2) DEFAULT 80.0, -- Minimum pass score
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, market_type)
);

-- Default thresholds for common markets
INSERT INTO sport_validation_thresholds (sport, market_type, odds_deviation_tolerance, consensus_delta_tolerance, min_benford_samples)
VALUES
  ('NFL', 'main_lines', 2.5, 3.0, 300),
  ('NBA', 'main_lines', 2.5, 3.0, 300),
  ('MLB', 'main_lines', 3.0, 4.0, 200),
  ('NFL', 'player_props', 5.0, 7.0, 100),
  ('NBA', 'player_props', 5.0, 7.0, 100),
  ('MLB', 'player_props', 6.0, 8.0, 100),
  ('NFL', 'futures', 10.0, 12.0, 150),
  ('NBA', 'futures', 10.0, 12.0, 150),
  ('ELECTION', 'prediction_markets', 8.0, 10.0, 200),
  ('KALSHI', 'event_markets', 7.0, 9.0, 150)
ON CONFLICT (sport, market_type) DO NOTHING;

-- Table: model_trust_scores
-- Per-model rolling trust metrics
CREATE TABLE IF NOT EXISTS model_trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id VARCHAR(100) UNIQUE NOT NULL,
  avg_final_confidence DECIMAL(5,2),
  benford_pass_rate DECIMAL(5,2),
  avg_odds_deviation DECIMAL(5,2),
  avg_consensus_delta DECIMAL(5,2),
  total_predictions INTEGER DEFAULT 0,
  last_30d_accuracy DECIMAL(5,2),
  last_90d_accuracy DECIMAL(5,2),
  lifetime_accuracy DECIMAL(5,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_model_scores ON model_trust_scores(model_id);

-- Comments for documentation
COMMENT ON TABLE odds_benford_baselines IS 'Stores rolling Benford distributions calculated from real sportsbook odds, sport and market-type specific';
COMMENT ON TABLE ai_response_trust IS 'Trust metrics for each AI response, used for validation and transparency';
COMMENT ON TABLE ai_audit_log IS 'Append-only audit trail preserving all AI outputs and trust calculations';
COMMENT ON TABLE sport_validation_thresholds IS 'Configurable validation thresholds per sport and market type';
COMMENT ON TABLE model_trust_scores IS 'Rolling trust metrics per AI model for model selection and weighting';
