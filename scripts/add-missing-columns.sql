-- Migration: Add missing columns to user_preferences tables
-- Fixes: "Could not find the 'custom_instructions' column of 'user_preferences' in the schema cache"
-- Also adds saved_files to both public and api schema tables

-- ── public.user_preferences ────────────────────────────────────────────────
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS custom_instructions TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS saved_files JSONB DEFAULT '[]'::jsonb;

-- ── api.user_preferences (if exists in api schema) ─────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'api' AND table_name = 'user_preferences'
  ) THEN
    EXECUTE 'ALTER TABLE api.user_preferences
      ADD COLUMN IF NOT EXISTS custom_instructions TEXT DEFAULT '''',
      ADD COLUMN IF NOT EXISTS saved_files JSONB DEFAULT ''[]''::jsonb';
  END IF;
END;
$$;
