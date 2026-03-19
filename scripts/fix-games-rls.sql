-- =============================================================================
-- Fix: Enable RLS on api.games
-- Lint: "RLS Disabled in Public Entity: api.games"
-- =============================================================================
-- api.games is a game schedule/reference table (sport, home_team, away_team,
-- commence_time). No user_id column — shared catalog data, not user-owned.
-- Access model mirrors live_odds_cache and historical_games:
--   • SELECT — public (anon + authenticated) — game schedules are not sensitive
--   • INSERT / UPDATE / DELETE — service_role only (cron / ingest jobs)
-- =============================================================================

-- Step 1: Enable RLS (idempotent — no-op if already enabled)
ALTER TABLE api.games ENABLE ROW LEVEL SECURITY;

-- Step 2: Public read access
DROP POLICY IF EXISTS "games_read" ON api.games;
CREATE POLICY "games_read"
  ON api.games
  FOR SELECT
  USING (true);

-- Step 3: Restrict writes to service_role only
DROP POLICY IF EXISTS "games_write" ON api.games;
CREATE POLICY "games_write"
  ON api.games
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
  AND c.relname = 'games'
ORDER BY p.polname;

DO $$
BEGIN
  RAISE NOTICE 'RLS enabled on api.games with read=public, write=service_role.';
END $$;
