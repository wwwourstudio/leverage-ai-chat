-- ============================================================================
-- Migration 003: player_props_markets in the api schema
--
-- The app's Supabase client uses schema: 'api', so the table must live in
-- the api schema (not public). The old fix-player-props-table.sql created it
-- in public, which caused PGRST205 "table not found in schema cache" errors.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- Drop any stale copy in public schema (from old migration)
DROP TABLE IF EXISTS public.player_props_markets CASCADE;

-- Create in api schema to match the Supabase client config (db.schema = 'api')
CREATE TABLE IF NOT EXISTS api.player_props_markets (
  id TEXT PRIMARY KEY,            -- composite: "{eventId}-{playerName}-{marketKey}"
  sport VARCHAR(50) NOT NULL,
  game_id VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  stat_type VARCHAR(100) NOT NULL,
  line NUMERIC,
  over_odds INTEGER,
  under_odds INTEGER,
  bookmaker VARCHAR(100) NOT NULL,
  game_time TIMESTAMPTZ,
  home_team VARCHAR(255),
  away_team VARCHAR(255),
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_player_props_sport   ON api.player_props_markets(sport);
CREATE INDEX IF NOT EXISTS idx_api_player_props_game_id ON api.player_props_markets(game_id);
CREATE INDEX IF NOT EXISTS idx_api_player_props_player  ON api.player_props_markets(player_name);
CREATE INDEX IF NOT EXISTS idx_api_player_props_type    ON api.player_props_markets(stat_type);
CREATE INDEX IF NOT EXISTS idx_api_player_props_fetched ON api.player_props_markets(fetched_at DESC);

-- RLS
ALTER TABLE api.player_props_markets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read player props"   ON api.player_props_markets;
DROP POLICY IF EXISTS "Service write player props" ON api.player_props_markets;
DROP POLICY IF EXISTS "Service upsert player props" ON api.player_props_markets;

CREATE POLICY "Public read player props"
  ON api.player_props_markets FOR SELECT USING (true);

CREATE POLICY "Service write player props"
  ON api.player_props_markets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service upsert player props"
  ON api.player_props_markets FOR UPDATE
  USING (true);

-- Grant access to anon and authenticated roles (matches other api.* tables)
GRANT ALL ON api.player_props_markets TO anon, authenticated;

DO $$
BEGIN
  RAISE NOTICE '✓ api.player_props_markets created in api schema';
END $$;
