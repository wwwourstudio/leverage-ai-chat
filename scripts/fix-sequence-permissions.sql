-- =============================================================================
-- scripts/fix-sequence-permissions.sql
--
-- PURPOSE
--   Resolves "permission denied for sequence statcast_daily_id_seq" (and any
--   sibling sequence errors) that occur when the ingest service attempts to
--   INSERT rows into tables with BIGSERIAL primary keys inside the `api` schema.
--
-- ROOT CAUSE
--   PostgreSQL sequences are independent objects with their own ACL.  Granting
--   INSERT / ALL on a table does NOT cascade to the sequence that backs its
--   BIGSERIAL column.  The service_role therefore cannot call nextval() during
--   INSERT, even though it can otherwise write to the table.
--
--   Affected sequences (one per BIGSERIAL column in the api schema):
--     api.statcast_daily_id_seq        ← primary trigger of the error
--     api.statcast_pitches_raw_id_seq
--     api.hitter_splits_id_seq
--     api.daily_picks_id_seq
--
-- WHAT THIS SCRIPT DOES
--   1. Grants USAGE + SELECT on every existing BIGSERIAL sequence in `api`
--      to service_role, authenticated, and anon.
--      • USAGE  → allows nextval()  (required for INSERT)
--      • SELECT → allows currval()  (required for RETURNING id clauses)
--   2. Sets ALTER DEFAULT PRIVILEGES so any *future* sequences created in
--      the api schema automatically get the same grants — prevents recurrence.
--   3. Grants USAGE on the api schema itself (belt-and-suspenders; Supabase
--      usually handles this, but it's idempotent and harmless to repeat).
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → New Query → paste → Run
--   (Or via the Supabase CLI: supabase db execute < scripts/fix-sequence-permissions.sql)
--
-- SAFE TO RE-RUN: all GRANT statements are idempotent in PostgreSQL.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Ensure roles can resolve objects in the api schema
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA api TO service_role;
GRANT USAGE ON SCHEMA api TO authenticated;
GRANT USAGE ON SCHEMA api TO anon;

-- ---------------------------------------------------------------------------
-- 1. Grant on all EXISTING sequences in the api schema (covers current tables)
-- ---------------------------------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO anon;

-- ---------------------------------------------------------------------------
-- 2. Explicit per-sequence grants
--    Belt-and-suspenders: catches cases where the blanket GRANT above misses
--    a sequence whose schema search_path was different when it was created.
-- ---------------------------------------------------------------------------

-- statcast_daily (primary source of the reported error)
DO $$ BEGIN
  GRANT USAGE, SELECT ON SEQUENCE api.statcast_daily_id_seq TO service_role;
  GRANT USAGE, SELECT ON SEQUENCE api.statcast_daily_id_seq TO authenticated;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'api.statcast_daily_id_seq does not exist yet — skipping';
END $$;

-- statcast_pitches_raw
DO $$ BEGIN
  GRANT USAGE, SELECT ON SEQUENCE api.statcast_pitches_raw_id_seq TO service_role;
  GRANT USAGE, SELECT ON SEQUENCE api.statcast_pitches_raw_id_seq TO authenticated;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'api.statcast_pitches_raw_id_seq does not exist yet — skipping';
END $$;

-- hitter_splits
DO $$ BEGIN
  GRANT USAGE, SELECT ON SEQUENCE api.hitter_splits_id_seq TO service_role;
  GRANT USAGE, SELECT ON SEQUENCE api.hitter_splits_id_seq TO authenticated;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'api.hitter_splits_id_seq does not exist yet — skipping';
END $$;

-- daily_picks
DO $$ BEGIN
  GRANT USAGE, SELECT ON SEQUENCE api.daily_picks_id_seq TO service_role;
  GRANT USAGE, SELECT ON SEQUENCE api.daily_picks_id_seq TO authenticated;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'api.daily_picks_id_seq does not exist yet — skipping';
END $$;

-- ---------------------------------------------------------------------------
-- 3. Default privileges — prevents recurrence for any future BIGSERIAL tables
--    created in the api schema by the postgres superuser.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA api
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA api
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Verification — lists every sequence in api with its current grants
-- ---------------------------------------------------------------------------
SELECT
  n.nspname                                    AS schema,
  c.relname                                    AS sequence_name,
  array_to_string(c.relacl, ', ')              AS current_acl
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'S'           -- sequences only
  AND n.nspname = 'api'
ORDER BY c.relname;

DO $$
BEGIN
  RAISE NOTICE '✓ Sequence permission grants applied to api schema.';
  RAISE NOTICE '  All BIGSERIAL sequences now allow nextval() for service_role.';
  RAISE NOTICE '  Default privileges set — future sequences inherit grants automatically.';
END $$;
