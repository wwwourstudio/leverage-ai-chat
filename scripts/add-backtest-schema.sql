-- =============================================================================
-- scripts/add-backtest-schema.sql
--
-- Creates the backtest_results table in the api schema.
-- Run ONCE in Supabase Dashboard → SQL Editor → New Query.
-- Idempotent: safe to re-run (uses IF NOT EXISTS).
--
-- Also adds the calibration_beta column to model_metrics if it doesn't exist
-- (older schema had only calibration_alpha).
-- =============================================================================

SET search_path TO api;

-- ---------------------------------------------------------------------------
-- 1. backtest_results
--    One row per daily backtest run.  Stores summary stats + JSONB segments
--    so the dashboard can render per-segment diagnostics without a join.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS backtest_results (
  id                    BIGSERIAL     PRIMARY KEY,

  -- Window metadata
  window_days           INTEGER       NOT NULL,
  total_picks           INTEGER       NOT NULL,

  -- Overall metrics
  hit_rate              NUMERIC(6,4)  NOT NULL,
  avg_predicted         NUMERIC(6,4)  NOT NULL,
  brier_score           NUMERIC(8,6)  NOT NULL,
  log_loss              NUMERIC(8,6),
  calibration_error     NUMERIC(7,4), -- positive = overconfident
  roi                   NUMERIC(8,4), -- % return on flat-unit staking

  -- Platt calibration output
  calibration_alpha     NUMERIC(8,5)  NOT NULL DEFAULT 1.0,
  calibration_beta      NUMERIC(8,5)  NOT NULL DEFAULT 0.0,
  calibration_log_loss  NUMERIC(8,6),
  calibration_n         INTEGER,

  -- Per-segment breakdown (array of SegmentReport objects)
  segments              JSONB,

  -- Human-readable bias summary
  diagnostics           TEXT[],

  -- Timestamps
  generated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Most recent run first (dashboard query)
CREATE INDEX IF NOT EXISTS idx_backtest_results_created
  ON backtest_results (created_at DESC);

-- Fast lookup of latest run within a window size
CREATE INDEX IF NOT EXISTS idx_backtest_results_window
  ON backtest_results (window_days, created_at DESC);

ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backtest_results_public_read"   ON backtest_results;
DROP POLICY IF EXISTS "backtest_results_service_write" ON backtest_results;

CREATE POLICY "backtest_results_public_read"
  ON backtest_results FOR SELECT USING (true);

CREATE POLICY "backtest_results_service_write"
  ON backtest_results FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Grant sequence permissions (mirrors fix-sequence-permissions.sql pattern)
DO $$ BEGIN
  GRANT USAGE, SELECT ON SEQUENCE api.backtest_results_id_seq TO service_role;
  GRANT USAGE, SELECT ON SEQUENCE api.backtest_results_id_seq TO authenticated;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'api.backtest_results_id_seq not yet available — skipping';
END $$;

-- ---------------------------------------------------------------------------
-- 2. model_metrics — add calibration_beta column if missing
--    cron/train only wrote calibration_alpha; cron/backtest also writes beta.
-- ---------------------------------------------------------------------------

ALTER TABLE model_metrics
  ADD COLUMN IF NOT EXISTS calibration_beta NUMERIC(8,5) DEFAULT 0.0;

-- ---------------------------------------------------------------------------
-- 3. pick_results — add segmentation metadata columns if missing
--    These are populated by the picks-engine when a pick is recorded.
--    Null-safe: older picks without metadata simply skip those segments.
-- ---------------------------------------------------------------------------

ALTER TABLE pick_results
  ADD COLUMN IF NOT EXISTS park_factor           NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS platoon               TEXT
    CHECK (platoon IN ('L-vs-R', 'Same', 'Switch')),
  ADD COLUMN IF NOT EXISTS exit_velocity_bucket  TEXT
    CHECK (exit_velocity_bucket IN ('High', 'Mid', 'Low')),
  ADD COLUMN IF NOT EXISTS weather_bucket        TEXT
    CHECK (weather_bucket IN ('Favorable', 'Neutral', 'Unfavorable'));

-- Index to speed up backtest window queries
CREATE INDEX IF NOT EXISTS idx_pick_results_date_settled
  ON pick_results (pick_date DESC)
  WHERE actual_result IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Sequence grants — apply blanket grant in case new sequences were created
-- ---------------------------------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Verification
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '✓ Backtest schema applied:';
  RAISE NOTICE '  New table:   backtest_results';
  RAISE NOTICE '  New columns: model_metrics.calibration_beta';
  RAISE NOTICE '  New columns: pick_results.{park_factor, platoon, exit_velocity_bucket, weather_bucket}';
END $$;
