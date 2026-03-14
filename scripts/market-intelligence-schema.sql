-- ============================================================================
-- LEVERAGE AI - MARKET INTELLIGENCE SCHEMA
-- Adds institutional-grade market analysis tables to the existing api schema.
-- Run this AFTER master-schema.sql in Supabase SQL Editor.
-- ============================================================================

SET search_path TO api;

-- ============================================================================
-- 1. MARKET SNAPSHOTS
-- Point-in-time probability state across all sources for one market/event.
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  home_team VARCHAR(255),
  away_team VARCHAR(255),
  market_type VARCHAR(50) NOT NULL DEFAULT 'h2h',
  sportsbook_prob NUMERIC(5,4),     -- normalized sportsbook consensus [0,1]
  kalshi_prob NUMERIC(5,4),         -- Kalshi yes price / 100
  consensus_prob NUMERIC(5,4),      -- simple mean of sportsbook_prob values
  surface_prob NUMERIC(5,4),        -- Bayesian blend output
  raw_odds JSONB,                   -- raw bookmaker odds payload
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msnap_event_time ON market_snapshots(event_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_msnap_sport_time ON market_snapshots(sport, captured_at DESC);

-- ============================================================================
-- 2. MARKET ANOMALIES
-- Detected cross-market mispricings with severity scoring.
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  anomaly_score NUMERIC(6,4) NOT NULL,
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('none','low','medium','high')),
  affected_markets JSONB NOT NULL DEFAULT '[]',  -- [{source, probability, deviation, direction}]
  cluster_id VARCHAR(64),                        -- hash of event_id for grouping
  benford_trust NUMERIC(5,2) DEFAULT 100,        -- 0-100
  signal_strength NUMERIC(5,2) DEFAULT 0,        -- composite: anomaly × trust × velocity
  resolved_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manom_event_time ON market_anomalies(event_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_manom_severity_time ON market_anomalies(severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_manom_cluster ON market_anomalies(cluster_id);

-- ============================================================================
-- 3. MOVEMENT EVENTS
-- Velocity-classified line movement records (steam, drift, correction, stable).
-- ============================================================================
CREATE TABLE IF NOT EXISTS movement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  bookmaker VARCHAR(100),
  velocity_score NUMERIC(8,4),                 -- normalized 0-100
  direction VARCHAR(10) CHECK (direction IN ('up','down','flat')),
  movement_type VARCHAR(20) CHECK (movement_type IN ('steam','drift','correction','stable')),
  odds_delta NUMERIC(8,2),                     -- American odds change
  time_delta_seconds INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movevt_event_time ON movement_events(event_id, recorded_at DESC);

-- ============================================================================
-- 4. SIGNAL PERFORMANCE
-- Per-signal accuracy tracking for adaptive weight adjustment.
-- ============================================================================
CREATE TABLE IF NOT EXISTS signal_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_name VARCHAR(100) NOT NULL UNIQUE,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  accuracy NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  weight NUMERIC(6,4) NOT NULL DEFAULT 0.2,
  brier_score NUMERIC(6,4),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default signals so weights are always available
INSERT INTO signal_performance (signal_name, weight) VALUES
  ('sportsbook', 0.50),
  ('prediction_market', 0.30),
  ('historical', 0.20),
  ('anomaly_score', 0.25),
  ('velocity', 0.20),
  ('steam_move', 0.25),
  ('benford_trust', 0.15),
  ('kalshi_divergence', 0.15)
ON CONFLICT (signal_name) DO NOTHING;

-- ============================================================================
-- 5. MODEL VERSIONS
-- Snapshots of signal weight configs with performance metrics.
-- Supports rollback if new model performs worse.
-- ============================================================================
CREATE TABLE IF NOT EXISTS model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  performance_score NUMERIC(6,4),
  brier_score NUMERIC(6,4),
  signals_config JSONB NOT NULL DEFAULT '{}',  -- {signal_name: weight}
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mver_active ON model_versions(is_active, created_at DESC);

-- Seed version 1 (baseline)
INSERT INTO model_versions (version, performance_score, brier_score, signals_config, is_active)
VALUES (
  1,
  0.5,
  0.25,
  '{"sportsbook":0.50,"prediction_market":0.30,"historical":0.20}',
  TRUE
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. MARKET PREDICTIONS
-- AI-generated probability predictions before event resolution.
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL,
  market VARCHAR(100) NOT NULL DEFAULT 'h2h',
  predicted_probability NUMERIC(5,4) NOT NULL,
  confidence NUMERIC(5,4),
  signals_used JSONB,               -- snapshot of weights at prediction time
  model_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mpred_event ON market_predictions(event_id, created_at DESC);

-- ============================================================================
-- 7. MARKET OUTCOMES
-- Ground truth for resolved events. Used for Brier scoring + retraining.
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL UNIQUE,
  actual_result SMALLINT NOT NULL CHECK (actual_result IN (0, 1)),  -- 1=home win, 0=away win
  closing_probability NUMERIC(5,4),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mout_event ON market_outcomes(event_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_outcomes ENABLE ROW LEVEL SECURITY;

-- Public read-only (odds intelligence is public)
CREATE POLICY "market_snapshots_public_read" ON market_snapshots FOR SELECT USING (true);
CREATE POLICY "market_anomalies_public_read" ON market_anomalies FOR SELECT USING (true);
CREATE POLICY "movement_events_public_read" ON movement_events FOR SELECT USING (true);
CREATE POLICY "signal_performance_public_read" ON signal_performance FOR SELECT USING (true);
CREATE POLICY "model_versions_public_read" ON model_versions FOR SELECT USING (true);

-- Predictions/outcomes: authenticated users only
CREATE POLICY "market_predictions_auth_read" ON market_predictions
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "market_outcomes_auth_read" ON market_outcomes
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

-- ============================================================================
-- REALTIME PUBLICATIONS
-- Enables live anomaly feed in the UI without polling.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'market_anomalies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE market_anomalies;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'movement_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE movement_events;
  END IF;
END $$;
