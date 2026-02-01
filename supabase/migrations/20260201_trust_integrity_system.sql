-- AI Trust & Integrity System Database Schema
-- Supports market-grounded validation of AI responses

-- 1. Odds Benford Baselines Table
-- Stores sport-specific and market-type-specific digit distributions from real market data
CREATE TABLE IF NOT EXISTS odds_benford_baselines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL,
  market_type TEXT NOT NULL,
  digit_distribution JSONB NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sport, market_type)
);

CREATE INDEX idx_benford_sport_market ON odds_benford_baselines(sport, market_type);

-- 2. AI Response Trust Table
-- Stores trust metrics for each AI response
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

CREATE INDEX idx_trust_response ON ai_response_trust(response_id);
CREATE INDEX idx_trust_model ON ai_response_trust(model_id);
CREATE INDEX idx_trust_sport_market ON ai_response_trust(sport, market_type);
CREATE INDEX idx_trust_created ON ai_response_trust(created_at DESC);

-- 3. AI Audit Log Table (append-only)
-- Comprehensive audit trail for all AI responses
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  raw_output TEXT NOT NULL,
  trust_breakdown JSONB NOT NULL,
  thresholds_used JSONB NOT NULL,
  throttle_state TEXT,
  final_user_output TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_response ON ai_audit_log(response_id);
CREATE INDEX idx_audit_model ON ai_audit_log(model_id);
CREATE INDEX idx_audit_created ON ai_audit_log(created_at DESC);

-- 4. Model Trust Scores View
-- Aggregated rolling trust metrics per model
CREATE OR REPLACE VIEW model_trust_scores AS
SELECT 
  model_id,
  sport,
  market_type,
  AVG(final_confidence) AS avg_final_confidence,
  AVG(benford_score) AS avg_benford_score,
  AVG(odds_alignment_score) AS avg_odds_alignment,
  AVG(consensus_score) AS avg_consensus,
  AVG(historical_accuracy_score) AS avg_historical_accuracy,
  COUNT(*) AS total_responses,
  COUNT(*) FILTER (WHERE benford_score >= 80) AS benford_pass_count,
  COUNT(*) FILTER (WHERE benford_score >= 80)::FLOAT / COUNT(*) AS benford_pass_rate,
  MAX(created_at) AS last_response_at
FROM ai_response_trust
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY model_id, sport, market_type;

-- 5. Sport-Specific Validation Thresholds Table
-- Configurable thresholds per sport and market type
CREATE TABLE IF NOT EXISTS validation_thresholds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL,
  market_type TEXT NOT NULL,
  odds_deviation_low NUMERIC(5,4) NOT NULL DEFAULT 0.02,
  odds_deviation_medium NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  odds_deviation_high NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  consensus_delta_low NUMERIC(5,4) NOT NULL DEFAULT 0.03,
  consensus_delta_medium NUMERIC(5,4) NOT NULL DEFAULT 0.07,
  consensus_delta_high NUMERIC(5,4) NOT NULL DEFAULT 0.12,
  benford_pass_threshold INTEGER NOT NULL DEFAULT 80,
  minimum_sample_size INTEGER NOT NULL DEFAULT 100,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sport, market_type)
);

-- Insert default thresholds for common sports/market types
INSERT INTO validation_thresholds (sport, market_type) VALUES
('nfl', 'main'),
('nba', 'main'),
('mlb', 'main'),
('nfl', 'props'),
('nba', 'props'),
('nfl', 'futures'),
('election', 'markets'),
('economic', 'events')
ON CONFLICT (sport, market_type) DO NOTHING;

-- 6. Live Odds Cache Table
-- Cache live odds from external APIs for faster validation
CREATE TABLE IF NOT EXISTS live_odds_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL,
  market_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  implied_probability NUMERIC(5,4) NOT NULL,
  decimal_odds NUMERIC(6,2) NOT NULL,
  source TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sport, market_type, event_id, source)
);

CREATE INDEX idx_odds_cache_expiry ON live_odds_cache(expires_at);
CREATE INDEX idx_odds_cache_sport_market ON live_odds_cache(sport, market_type);

-- 7. Functions for automatic baseline updates
CREATE OR REPLACE FUNCTION update_benford_baseline()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-update baselines when new odds are cached
  -- This would be expanded to actually compute digit distributions
  UPDATE odds_benford_baselines
  SET 
    sample_size = sample_size + 1,
    updated_at = NOW()
  WHERE sport = NEW.sport AND market_type = NEW.market_type;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_benford
AFTER INSERT ON live_odds_cache
FOR EACH ROW
EXECUTE FUNCTION update_benford_baseline();

-- 8. RLS Policies (if needed for multi-tenant)
ALTER TABLE ai_response_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_benford_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_odds_cache ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access to trust metrics"
  ON ai_response_trust FOR SELECT
  USING (true);

CREATE POLICY "Allow read access to audit log"
  ON ai_audit_log FOR SELECT
  USING (true);

CREATE POLICY "Allow read access to baselines"
  ON odds_benford_baselines FOR SELECT
  USING (true);

CREATE POLICY "Allow read access to thresholds"
  ON validation_thresholds FOR SELECT
  USING (true);

CREATE POLICY "Allow read access to odds cache"
  ON live_odds_cache FOR SELECT
  USING (true);

-- 9. Cleanup function for expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_odds()
RETURNS void AS $$
BEGIN
  DELETE FROM live_odds_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE odds_benford_baselines IS 'Stores sport-specific digit distributions from real market odds for Benford integrity validation';
COMMENT ON TABLE ai_response_trust IS 'Trust and integrity metrics for each AI response';
COMMENT ON TABLE ai_audit_log IS 'Append-only audit trail of all AI responses and trust calculations';
COMMENT ON TABLE validation_thresholds IS 'Configurable sport-specific and market-type-specific validation thresholds';
COMMENT ON TABLE live_odds_cache IS 'Cached live odds from external APIs to reduce API calls';
