-- Migration: add missing columns to api.user_preferences
-- Run this in the Supabase SQL Editor if settings PATCH fails with
-- "Could not find the 'bankroll' column" or "arbitrage_alerts column missing".

ALTER TABLE api.user_preferences
  ADD COLUMN IF NOT EXISTS bankroll          NUMERIC  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arbitrage_alerts  BOOLEAN  NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS default_sport     TEXT     NOT NULL DEFAULT 'NBA',
  ADD COLUMN IF NOT EXISTS custom_instructions TEXT   NOT NULL DEFAULT '';

-- Refresh PostgREST schema cache so the new columns are visible immediately
NOTIFY pgrst, 'reload schema';
