-- ============================================================================
-- Fix: Recreate player_props_markets with correct schema
--
-- The original master-schema.sql defined this table with wrong column names
-- (prop_type/cached_at/expires_at/UUID id) that don't match what the app writes
-- (stat_type/fetched_at/game_time/home_team/away_team/TEXT id).
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================================

-- Drop the incorrectly-defined table (and its dependent policies/indexes)
DROP TABLE IF EXISTS player_props_markets CASCADE;

-- Recreate with columns matching player-props-service.ts
CREATE TABLE player_props_markets (
  id TEXT PRIMARY KEY,          -- composite: "{eventId}-{playerName}-{marketKey}"
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

CREATE INDEX idx_player_props_game_id ON player_props_markets(game_id);
CREATE INDEX idx_player_props_player  ON player_props_markets(player_name);
CREATE INDEX idx_player_props_type    ON player_props_markets(stat_type);
CREATE INDEX idx_player_props_sport   ON player_props_markets(sport);
CREATE INDEX idx_player_props_fetched ON player_props_markets(fetched_at DESC);

-- Row-Level Security
ALTER TABLE player_props_markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"  ON player_props_markets FOR SELECT USING (true);
CREATE POLICY "Service write access" ON player_props_markets FOR INSERT
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "Service upsert access" ON player_props_markets FOR UPDATE
  USING (auth.role() IN ('authenticated', 'service_role'));

-- Re-enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE player_props_markets;

DO $$
BEGIN
  RAISE NOTICE '✓ player_props_markets recreated with correct schema';
  RAISE NOTICE '  Columns: id (TEXT), sport, game_id, player_name, stat_type,';
  RAISE NOTICE '           line, over_odds, under_odds, bookmaker, game_time,';
  RAISE NOTICE '           home_team, away_team, fetched_at';
END $$;
