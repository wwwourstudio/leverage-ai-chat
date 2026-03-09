-- Migration: Add app_settings table
-- Run this in Supabase SQL Editor if you already ran master-schema.sql.
-- Required for the ADP circuit-breaker to survive serverless cold starts.

CREATE TABLE IF NOT EXISTS api.app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION api.set_app_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON api.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON api.app_settings
  FOR EACH ROW EXECUTE FUNCTION api.set_app_settings_updated_at();

ALTER TABLE api.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api' AND tablename = 'app_settings' AND policyname = 'app_settings_read'
  ) THEN
    CREATE POLICY "app_settings_read" ON api.app_settings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api' AND tablename = 'app_settings' AND policyname = 'app_settings_service_write'
  ) THEN
    CREATE POLICY "app_settings_service_write" ON api.app_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT ON api.app_settings TO anon, authenticated;
GRANT ALL ON api.app_settings TO service_role;

DO $$ BEGIN
  RAISE NOTICE '✓ app_settings table ready';
END $$;
