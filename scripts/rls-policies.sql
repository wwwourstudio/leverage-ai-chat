-- Row-Level Security Policies
-- Execute this in Supabase SQL Editor after creating tables

-- ========================================
-- PUBLIC DATA (Read-only for authenticated users)
-- ========================================

-- Live odds cache
ALTER TABLE live_odds_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read odds"
  ON live_odds_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage odds"
  ON live_odds_cache FOR ALL
  TO service_role
  USING (true);

-- Sport-specific odds tables
ALTER TABLE mlb_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfl_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhl_odds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read mlb_odds"
  ON mlb_odds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read nfl_odds"
  ON nfl_odds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read nba_odds"
  ON nba_odds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read nhl_odds"
  ON nhl_odds FOR SELECT TO authenticated USING (true);

-- Edge opportunities (public but read-only)
ALTER TABLE edge_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read opportunities"
  ON edge_opportunities FOR SELECT
  TO authenticated
  USING (true);

-- Arbitrage opportunities (public but read-only)
ALTER TABLE arbitrage_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read arbitrage"
  ON arbitrage_opportunities FOR SELECT
  TO authenticated
  USING (true);

-- ========================================
-- USER DATA (Isolated by user_id)
-- ========================================

-- Bet allocations (users can only see/manage their own)
ALTER TABLE bet_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own allocations"
  ON bet_allocations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own allocations"
  ON bet_allocations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own allocations"
  ON bet_allocations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own allocations"
  ON bet_allocations FOR DELETE
  USING (auth.uid() = user_id);

-- User predictions
ALTER TABLE user_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own predictions"
  ON user_predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictions"
  ON user_predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Capital state (users can only see their own)
ALTER TABLE capital_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own capital state"
  ON capital_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own capital state"
  ON capital_state FOR UPDATE
  USING (auth.uid() = user_id);

-- Portfolio performance (users can only see their own)
ALTER TABLE portfolio_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own portfolio"
  ON portfolio_performance FOR SELECT
  USING (auth.uid() = user_id);

-- ========================================
-- ADMIN/SERVICE ROLE ACCESS
-- ========================================

-- Allow service role to bypass RLS for background jobs
CREATE POLICY "Service role has full access"
  ON edge_opportunities FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full arbitrage access"
  ON arbitrage_opportunities FOR ALL
  TO service_role
  USING (true);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'RLS policies created successfully. Public data is read-only, user data is isolated by user_id.';
END $$;
