-- User tables migration: user_profiles, user_alerts, credit_transactions
-- Run AFTER 001-create-tables.sql

-- ============================================================
-- 1. Ensure api.profiles has all needed columns
-- ============================================================
ALTER TABLE api.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS credits_purchased integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"email": true, "push": true, "odds_alerts": true, "line_movement": true, "arbitrage": true}';

-- ============================================================
-- 2. User alerts table
-- ============================================================
CREATE TABLE IF NOT EXISTS api.user_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES api.profiles(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN (
    'odds_change', 'line_movement', 'player_prop', 'arbitrage',
    'kalshi_price', 'weather_impact', 'game_start', 'custom'
  )),
  sport text,
  team text,
  player text,
  condition jsonb NOT NULL DEFAULT '{}',
  -- condition examples:
  -- {"operator": "gt", "value": -110, "field": "spread"}
  -- {"operator": "crosses", "value": 50, "field": "yes_price"}
  threshold numeric,
  is_active boolean DEFAULT true,
  is_triggered boolean DEFAULT false,
  triggered_at timestamptz,
  trigger_count integer DEFAULT 0,
  max_triggers integer DEFAULT 1,
  expires_at timestamptz,
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. Credit transactions table (audit log for all credit changes)
-- ============================================================
CREATE TABLE IF NOT EXISTS api.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES api.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL, -- positive = add, negative = consume
  balance_after integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'signup_bonus', 'daily_reset', 'purchase', 'subscription',
    'consume', 'refund', 'admin_adjustment', 'promo'
  )),
  stripe_payment_id text,
  stripe_invoice_id text,
  description text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_alerts_user ON api.user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_active ON api.user_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_alerts_type ON api.user_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_user_alerts_sport ON api.user_alerts(sport);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON api.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON api.credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON api.credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe ON api.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ============================================================
-- 5. RLS policies
-- ============================================================
ALTER TABLE api.user_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own alerts
CREATE POLICY "Users manage own alerts"
  ON api.user_alerts
  FOR ALL
  USING (user_id IN (
    SELECT id FROM api.profiles WHERE auth_id = auth.uid()
  ))
  WITH CHECK (user_id IN (
    SELECT id FROM api.profiles WHERE auth_id = auth.uid()
  ));

-- Users can only read their own transactions
CREATE POLICY "Users read own transactions"
  ON api.credit_transactions
  FOR SELECT
  USING (user_id IN (
    SELECT id FROM api.profiles WHERE auth_id = auth.uid()
  ));

-- Only server-side (service role) can insert transactions
CREATE POLICY "Service inserts transactions"
  ON api.credit_transactions
  FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 6. Auto-create profile on auth signup (trigger function)
-- ============================================================
CREATE OR REPLACE FUNCTION api.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO api.profiles (auth_id, email, full_name, credits, subscription_tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    50,
    'free'
  )
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create the trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION api.handle_new_user();
  END IF;
END;
$$;

-- Grant access
GRANT ALL ON api.user_alerts TO anon, authenticated;
GRANT ALL ON api.credit_transactions TO anon, authenticated;
