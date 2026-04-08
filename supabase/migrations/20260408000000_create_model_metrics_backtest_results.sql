-- =============================================================================
-- Migration: Create model_metrics and backtest_results tables
-- Generated: 2026-04-08
-- Project:   Leverage2 (xvhdomnjhlbxzocayocg)
-- =============================================================================
--
-- BACKGROUND
-- cron/train and cron/backtest both write calibration and accuracy metrics but
-- had no destination tables. Both crons were silently logging insert errors and
-- continuing. These tables complete the daily ML pipeline:
--
--   cron/picks  → api.daily_picks
--   cron/settle → api.pick_outcomes (outcomes)
--   cron/train  → api.model_metrics (accuracy window)
--   cron/backtest → api.backtest_results (full Platt calibration report)
--                    api.model_metrics   (live calibration_alpha/beta)
-- =============================================================================

-- model_metrics: written by cron/train after each daily calibration run.
-- Also written by cron/backtest (window_days=0 sentinel row = live calibration).
CREATE TABLE IF NOT EXISTS api.model_metrics (
  id                bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  window_days       integer NOT NULL,
  sample_size       integer NOT NULL DEFAULT 0,
  accuracy          numeric,
  brier_score       numeric,
  calibration_alpha numeric,
  calibration_beta  numeric,
  total_bet         numeric,
  total_return      numeric,
  roi               numeric,
  elite_accuracy    numeric,
  strong_accuracy   numeric,
  lean_accuracy     numeric,
  notes             text,
  computed_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api.model_metrics ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; anon/authenticated roles cannot read calibration data
CREATE POLICY model_metrics_service_only ON api.model_metrics
  USING (false)
  WITH CHECK (false);

-- backtest_results: full BacktestReport written by cron/backtest per window.
CREATE TABLE IF NOT EXISTS api.backtest_results (
  id                   bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  window_days          integer NOT NULL,
  total_picks          integer NOT NULL DEFAULT 0,
  hit_rate             numeric,
  avg_predicted        numeric,
  brier_score          numeric,
  log_loss             numeric,
  calibration_error    numeric,
  roi                  numeric,
  calibration_alpha    numeric,
  calibration_beta     numeric,
  calibration_log_loss numeric,
  calibration_n        integer,
  segments             jsonb,
  diagnostics          jsonb,
  generated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api.backtest_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY backtest_results_service_only ON api.backtest_results
  USING (false)
  WITH CHECK (false);
