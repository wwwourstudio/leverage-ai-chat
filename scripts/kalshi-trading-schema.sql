-- ============================================================================
-- Kalshi Trading Schema Migration
-- Run in Supabase SQL Editor after master-schema.sql
-- Creates tables for order history, positions, and trading accounts
-- ============================================================================

-- ── Order history ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api.kalshi_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Kalshi identifiers
  ticker           TEXT NOT NULL,
  kalshi_order_id  TEXT,                         -- returned by Kalshi API after placement
  -- Order parameters
  action           TEXT NOT NULL CHECK (action IN ('buy', 'sell')),
  side             TEXT NOT NULL CHECK (side IN ('yes', 'no')),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  price            INTEGER NOT NULL CHECK (price BETWEEN 1 AND 99), -- cents
  type             TEXT NOT NULL DEFAULT 'limit' CHECK (type IN ('limit', 'market')),
  -- Lifecycle
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'resting', 'filled', 'cancelled', 'rejected')),
  filled_count     INTEGER NOT NULL DEFAULT 0,
  remaining_count  INTEGER,
  -- Timestamps
  filled_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Open positions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api.kalshi_positions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker           TEXT NOT NULL,
  side             TEXT NOT NULL CHECK (side IN ('yes', 'no')),
  quantity         INTEGER NOT NULL,
  avg_price        INTEGER NOT NULL,              -- weighted average entry price (cents)
  current_price    INTEGER,                       -- last known price (cents)
  unrealized_pnl   INTEGER,                       -- current P&L in cents
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, ticker, side)
);

-- ── Kalshi account linkage ───────────────────────────────────────────────────
-- Stores encrypted per-user Kalshi API credentials for Phase 2B (per-user keys)
CREATE TABLE IF NOT EXISTS api.kalshi_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  kalshi_member_id    TEXT,
  api_key_id          TEXT,                       -- KALSHI-ACCESS-KEY header value
  api_key_encrypted   TEXT,                       -- AES-256-CBC encrypted private key
  environment         TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'demo')),
  last_sync_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS kalshi_orders_user_id_idx    ON api.kalshi_orders (user_id);
CREATE INDEX IF NOT EXISTS kalshi_orders_ticker_idx     ON api.kalshi_orders (ticker);
CREATE INDEX IF NOT EXISTS kalshi_orders_status_idx     ON api.kalshi_orders (status);
CREATE INDEX IF NOT EXISTS kalshi_positions_user_id_idx ON api.kalshi_positions (user_id);
CREATE INDEX IF NOT EXISTS kalshi_positions_ticker_idx  ON api.kalshi_positions (ticker);

-- ── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE api.kalshi_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.kalshi_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.kalshi_accounts  ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own rows
DROP POLICY IF EXISTS "kalshi_orders_owner" ON api.kalshi_orders;
CREATE POLICY "kalshi_orders_owner"
  ON api.kalshi_orders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "kalshi_positions_owner" ON api.kalshi_positions;
CREATE POLICY "kalshi_positions_owner"
  ON api.kalshi_positions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "kalshi_accounts_owner" ON api.kalshi_accounts;
CREATE POLICY "kalshi_accounts_owner"
  ON api.kalshi_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Realtime subscriptions ───────────────────────────────────────────────────
-- Allows Supabase Realtime to push changes to subscribed clients
ALTER PUBLICATION supabase_realtime ADD TABLE api.kalshi_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE api.kalshi_positions;

-- ── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER kalshi_orders_updated_at
  BEFORE UPDATE ON api.kalshi_orders
  FOR EACH ROW EXECUTE FUNCTION api.set_updated_at();

CREATE OR REPLACE TRIGGER kalshi_positions_updated_at
  BEFORE UPDATE ON api.kalshi_positions
  FOR EACH ROW EXECUTE FUNCTION api.set_updated_at();
