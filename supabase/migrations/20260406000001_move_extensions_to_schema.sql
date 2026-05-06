-- =============================================================================
-- Migration: Move pg_trgm, moddatetime, vector from public → extensions schema
-- Generated: 2026-04-06
-- Project:   Leverage2 (xvhdomnjhlbxzocayocg)
-- =============================================================================
--
-- SECURITY RATIONALE
-- Extensions installed in the public schema expose their functions, operators,
-- and types to every user who has USAGE on public (which in Postgres 14+ is
-- all users by default). Moving them to the dedicated extensions schema limits
-- their surface area and follows Supabase's own security hardening guide.
--
-- SAFETY CHECKS (verified before applying)
-- • All three extensions have extrelocatable = true — the ALTER is supported.
-- • extensions schema exists and is already in search_path
--   ("$user", public, extensions), so all existing function/operator references
--   resolve correctly after the move without any query changes.
-- • Existing triggers that call moddatetime() reference the function by OID,
--   not by schema-qualified name, so they continue firing correctly.
-- • All trigram GIN indexes were dropped in the previous migration
--   (20260406000000_drop_unused_indexes.sql — idx_scan = 0). No index
--   rebuilds are required.
-- • vector similarity queries resolve via search_path unchanged.
--
-- =============================================================================

-- Move extensions into extensions schema (idempotent).
-- Handles three cases per extension:
--   1. Not installed → CREATE directly in extensions schema.
--   2. Installed in wrong schema → ALTER to move it.
--   3. Already in extensions schema → skip (no-op).
DO $$
DECLARE
  v_schema text;
BEGIN
  -- pg_trgm
  SELECT n.nspname INTO v_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  IF v_schema IS NULL THEN
    CREATE EXTENSION pg_trgm WITH SCHEMA extensions;
  ELSIF v_schema <> 'extensions' THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;

  -- moddatetime
  SELECT n.nspname INTO v_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'moddatetime';

  IF v_schema IS NULL THEN
    CREATE EXTENSION moddatetime WITH SCHEMA extensions;
  ELSIF v_schema <> 'extensions' THEN
    ALTER EXTENSION moddatetime SET SCHEMA extensions;
  END IF;

  -- vector
  SELECT n.nspname INTO v_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'vector';

  IF v_schema IS NULL THEN
    CREATE EXTENSION vector WITH SCHEMA extensions;
  ELSIF v_schema <> 'extensions' THEN
    ALTER EXTENSION vector SET SCHEMA extensions;
  END IF;
END
$$;
