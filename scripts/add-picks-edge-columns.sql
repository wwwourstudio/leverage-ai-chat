-- Migration: add park_factor, umpire_boost, bullpen_factor, home_umpire to daily_picks
-- Run this in Supabase SQL Editor if the table already exists.
-- Safe to re-run (uses IF NOT EXISTS / column existence check).

DO $$
BEGIN
  -- home_umpire (game context)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'api' AND table_name = 'daily_picks' AND column_name = 'home_umpire'
  ) THEN
    ALTER TABLE api.daily_picks ADD COLUMN home_umpire TEXT;
  END IF;

  -- park_factor
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'api' AND table_name = 'daily_picks' AND column_name = 'park_factor'
  ) THEN
    ALTER TABLE api.daily_picks ADD COLUMN park_factor NUMERIC(5,3) NOT NULL DEFAULT 1.0;
  END IF;

  -- umpire_boost (raw hrBoost additive, e.g. 0.03 means +3pp)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'api' AND table_name = 'daily_picks' AND column_name = 'umpire_boost'
  ) THEN
    ALTER TABLE api.daily_picks ADD COLUMN umpire_boost NUMERIC(5,3) NOT NULL DEFAULT 0.0;
  END IF;

  -- bullpen_factor
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'api' AND table_name = 'daily_picks' AND column_name = 'bullpen_factor'
  ) THEN
    ALTER TABLE api.daily_picks ADD COLUMN bullpen_factor NUMERIC(5,3) NOT NULL DEFAULT 1.0;
  END IF;
END
$$;
