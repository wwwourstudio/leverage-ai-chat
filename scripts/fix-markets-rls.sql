-- =============================================================================
-- Fix: Enable RLS on api.markets
-- Lint: "RLS Disabled in Public Entity: api.markets"
-- =============================================================================
-- api.markets stores betting market data (market_type, outcome, price,
-- probability) linked to api.games via game_id. No user_id column —
-- shared catalog data, not user-owned.
-- Access model mirrors live_odds_cache and kalshi_markets:
--   • SELECT — public (anon + authenticated) — market odds are not sensitive
--   • INSERT / UPDATE / DELETE — service_role only (cron / ingest jobs)
-- =============================================================================

-- Step 1: Enable RLS (idempotent — no-op if already enabled)
ALTER TABLE api.markets ENABLE ROW LEVEL SECURITY;

-- Step 2: Public read access
DROP POLICY IF EXISTS "markets_read" ON api.markets;
CREATE POLICY "markets_read"
  ON api.markets
  FOR SELECT
  USING (true);

-- Step 3: Restrict writes to service_role only
DROP POLICY IF EXISTS "markets_write" ON api.markets;
CREATE POLICY "markets_write"
  ON api.markets
  FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- Verify
-- =============================================================================
SELECT
  c.relname                                          AS table_name,
  c.relrowsecurity                                   AS rls_enabled,
  p.polname                                          AS policy_name,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    ELSE 'ALL'
  END                                                AS command,
  pg_get_expr(p.polqual, p.polrelid)                AS using_expr
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'api'
  AND c.relname = 'markets'
ORDER BY p.polname;

DO $$
BEGIN
  RAISE NOTICE 'RLS enabled on api.markets with read=public, write=service_role.';
END $$;
