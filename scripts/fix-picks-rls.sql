-- =============================================================================
-- Fix: Enable RLS on api.picks
-- Lint: "RLS Disabled in Public Entity: api.picks"
-- =============================================================================
-- api.picks stores model-generated picks (player_name, tier, edge,
-- model_probability, factors JSONB) linked to api.games via game_id.
-- No user_id column — shared catalog data, not user-owned.
-- Access model mirrors api.daily_picks and api.backup_daily_picks:
--   • SELECT — public (anon + authenticated) — picks are not sensitive
--   • INSERT / UPDATE / DELETE — service_role only (model / cron jobs)
-- =============================================================================

-- Step 1: Enable RLS (idempotent — no-op if already enabled)
ALTER TABLE api.picks ENABLE ROW LEVEL SECURITY;

-- Step 2: Public read access
DROP POLICY IF EXISTS "picks_read" ON api.picks;
CREATE POLICY "picks_read"
  ON api.picks
  FOR SELECT
  USING (true);

-- Step 3: Restrict writes to service_role only
DROP POLICY IF EXISTS "picks_write" ON api.picks;
CREATE POLICY "picks_write"
  ON api.picks
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
  AND c.relname = 'picks'
ORDER BY p.polname;

DO $$
BEGIN
  RAISE NOTICE 'RLS enabled on api.picks with read=public, write=service_role.';
END $$;
