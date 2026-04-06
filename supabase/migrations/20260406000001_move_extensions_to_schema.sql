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

-- Move extensions out of public schema
-- Note: pg_trgm triggers GIN/trigram indexes — verify those still work after move
ALTER EXTENSION pg_trgm     SET SCHEMA extensions;
ALTER EXTENSION moddatetime SET SCHEMA extensions;
ALTER EXTENSION vector      SET SCHEMA extensions;
