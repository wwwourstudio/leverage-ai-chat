-- ============================================================
-- Trading Tables Migration
-- Run in Supabase SQL Editor (schema: api)
-- ============================================================

-- Portfolios — user bankroll tracking
CREATE TABLE IF NOT EXISTS api.portfolios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  name          TEXT NOT NULL DEFAULT 'Main Portfolio',
  bankroll      NUMERIC(12, 2) NOT NULL DEFAULT 1000.00,
  currency      TEXT NOT NULL DEFAULT 'USD',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON api.portfolios (user_id);

-- Positions — individual bet legs attached to a portfolio
CREATE TABLE IF NOT EXISTS api.positions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    UUID NOT NULL REFERENCES api.portfolios(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  label           TEXT NOT NULL,
  sport           TEXT NOT NULL DEFAULT '',
  american_odds   INTEGER NOT NULL,
  model_prob      NUMERIC(6, 4) NOT NULL,  -- 0.0000 to 1.0000
  implied_prob    NUMERIC(6, 4) NOT NULL,
  edge            NUMERIC(6, 4) NOT NULL,  -- model_prob - implied_prob
  stake           NUMERIC(10, 2) NOT NULL,
  kelly_fraction  NUMERIC(6, 4),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'void', 'pending')),
  placed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at      TIMESTAMPTZ,
  pnl             NUMERIC(10, 2),          -- Populated on settlement
  source          TEXT DEFAULT 'manual',   -- 'manual' | 'kalshi' | 'sportsbook'
  external_id     TEXT,                    -- Book order ID if applicable
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_positions_portfolio_id ON api.positions (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON api.positions (user_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON api.positions (status);
CREATE INDEX IF NOT EXISTS idx_positions_placed_at ON api.positions (placed_at DESC);

-- Trades — immutable audit log of all order events
CREATE TABLE IF NOT EXISTS api.trades (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id   UUID NOT NULL REFERENCES api.positions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('open', 'close', 'hedge', 'void')),
  stake         NUMERIC(10, 2) NOT NULL,
  american_odds INTEGER NOT NULL,
  source        TEXT DEFAULT 'manual',
  external_id   TEXT,
  executed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_trades_position_id ON api.trades (position_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON api.trades (user_id);
CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON api.trades (executed_at DESC);

-- Risk Snapshots — periodic portfolio risk captures for time-series analysis
CREATE TABLE IF NOT EXISTS api.risk_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id          UUID NOT NULL REFERENCES api.portfolios(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL,
  bankroll              NUMERIC(12, 2) NOT NULL,
  total_exposure        NUMERIC(12, 2) NOT NULL,
  open_positions        INTEGER NOT NULL DEFAULT 0,
  portfolio_edge        NUMERIC(6, 4),       -- Weighted average edge
  var_95                NUMERIC(10, 2),      -- Value-at-Risk at 95%
  sharpe_ratio          NUMERIC(8, 4),
  kelly_fraction_used   NUMERIC(6, 4),
  monte_carlo_median    NUMERIC(8, 4),       -- Median ROI from Monte Carlo
  monte_carlo_p5        NUMERIC(8, 4),       -- 5th percentile ROI
  monte_carlo_p95       NUMERIC(8, 4),       -- 95th percentile ROI
  snapped_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_snapshots_portfolio_id ON api.risk_snapshots (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_user_id ON api.risk_snapshots (user_id);
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_snapped_at ON api.risk_snapshots (snapped_at DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Enable RLS on all new tables (required for user-scoped queries)

ALTER TABLE api.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.risk_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see/modify their own data
CREATE POLICY "portfolios_own" ON api.portfolios
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "positions_own" ON api.positions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "trades_own" ON api.trades
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "risk_snapshots_own" ON api.risk_snapshots
  FOR ALL USING (auth.uid() = user_id);

-- ─── Auto-update timestamps ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON api.portfolios
  FOR EACH ROW EXECUTE FUNCTION api.set_updated_at();

CREATE TRIGGER positions_updated_at
  BEFORE UPDATE ON api.positions
  FOR EACH ROW EXECUTE FUNCTION api.set_updated_at();

-- ─── user_credits table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api.user_credits (
  user_id     UUID PRIMARY KEY,
  credits     INTEGER NOT NULL DEFAULT 10,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE api.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credits_own" ON api.user_credits
  FOR ALL USING (auth.uid() = user_id);

-- ─── Add saved_files column to user_preferences ───────────────────────────────
ALTER TABLE api.user_preferences
  ADD COLUMN IF NOT EXISTS saved_files JSONB DEFAULT '[]'::jsonb;
