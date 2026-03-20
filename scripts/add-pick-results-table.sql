-- Migration: add pick_results table for profitability tracking
-- Run in Supabase SQL Editor (schema: api)

-- ── pick_results ────────────────────────────────────────────────────────────────
-- Stores outcome data for every daily_pick so we can compute:
--   • Model accuracy / Brier score
--   • ROI per bet (flat-unit and Kelly-sized)
--   • Rolling calibration stats fed back into the training pipeline

CREATE TABLE IF NOT EXISTS api.pick_results (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to the source pick
  pick_id          BIGINT      NOT NULL REFERENCES api.daily_picks(id) ON DELETE CASCADE,
  player_id        BIGINT,
  pick_date        DATE        NOT NULL,

  -- Model output at time of pick generation
  predicted_prob   NUMERIC(6,4) NOT NULL CHECK (predicted_prob >= 0 AND predicted_prob <= 1),
  edge             NUMERIC(6,2),           -- edge in percentage points
  score            NUMERIC(6,2),           -- composite pick score
  tier             TEXT,                   -- ELITE / STRONG / LEAN / PASS
  sharp_boosted    BOOLEAN      DEFAULT FALSE,

  -- Market data at time of pick
  odds             INTEGER,                -- American odds (e.g. +145, -110)
  best_book        TEXT,

  -- Kelly Criterion sizing (fraction of bankroll)
  kelly_stake      NUMERIC(8,6),           -- e.g. 0.025 = 2.5% of bankroll

  -- Settlement (filled after game completes)
  actual_result    BOOLEAN,                -- TRUE = HR hit, FALSE = no HR, NULL = pending
  settled_at       TIMESTAMPTZ,

  -- P&L (flat $100 unit basis)
  pnl              NUMERIC(10,2),          -- positive = win, negative = loss

  recorded_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT pick_results_unique_pick UNIQUE (pick_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pick_results_pick_date
  ON api.pick_results (pick_date DESC);

CREATE INDEX IF NOT EXISTS idx_pick_results_unsettled
  ON api.pick_results (pick_date)
  WHERE actual_result IS NULL;

CREATE INDEX IF NOT EXISTS idx_pick_results_settled
  ON api.pick_results (settled_at DESC)
  WHERE actual_result IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pick_results_tier
  ON api.pick_results (tier, pick_date DESC);

-- ── model_metrics ───────────────────────────────────────────────────────────────
-- One row per daily training run — stores rolling accuracy / Brier / ROI stats
-- so we can track model drift over time.

CREATE TABLE IF NOT EXISTS api.model_metrics (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Rolling window (default 30 days of settled picks)
  window_days      INTEGER     NOT NULL DEFAULT 30,
  sample_size      INTEGER     NOT NULL DEFAULT 0,

  -- Accuracy metrics
  accuracy         NUMERIC(6,4),           -- fraction of correct picks
  brier_score      NUMERIC(8,6),           -- lower = better calibrated

  -- ROI metrics (flat $100 unit)
  total_bet        NUMERIC(12,2),
  total_return     NUMERIC(12,2),
  roi              NUMERIC(8,4),           -- (total_return - total_bet) / total_bet

  -- Breakdown by tier
  elite_accuracy   NUMERIC(6,4),
  strong_accuracy  NUMERIC(6,4),
  lean_accuracy    NUMERIC(6,4),

  -- Calibration correction factor (applied to future picks)
  calibration_alpha NUMERIC(8,6) DEFAULT 1.0,

  notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_model_metrics_computed
  ON api.model_metrics (computed_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────────
ALTER TABLE api.pick_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.model_metrics ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by cron routes)
CREATE POLICY "service_role_full_access_pick_results"
  ON api.pick_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_full_access_model_metrics"
  ON api.model_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read results (no PII involved)
CREATE POLICY "authenticated_read_pick_results"
  ON api.pick_results
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_model_metrics"
  ON api.model_metrics
  FOR SELECT
  TO authenticated
  USING (true);
