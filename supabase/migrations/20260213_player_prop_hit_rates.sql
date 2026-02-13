-- =============================================================================
-- PLAYER PROP HIT RATES TRACKING SYSTEM
-- Version: 2026-02-13
-- Description: Tracks historical player prop outcomes for hit rate analysis
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PLAYER PROP HISTORY TABLE
-- Stores historical prop line data and actual game results
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_prop_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL CHECK (player_name != ''),
  sport TEXT NOT NULL CHECK (sport IN ('mlb', 'nba', 'nfl', 'nhl')),
  stat_type TEXT NOT NULL CHECK (stat_type != ''), -- home_runs, points, touchdowns, etc.
  prop_line NUMERIC(10,2) NOT NULL CHECK (prop_line >= 0),
  actual_result NUMERIC(10,2), -- NULL until game completes
  game_date DATE NOT NULL,
  opponent TEXT,
  home_away TEXT CHECK (home_away IN ('home', 'away', NULL)),
  bookmaker TEXT,
  over_odds NUMERIC(6,2),
  under_odds NUMERIC(6,2),
  hit BOOLEAN, -- TRUE if over hit, FALSE if under hit, NULL if pending
  game_completed BOOLEAN DEFAULT FALSE,
  weather_conditions JSONB, -- Temperature, wind, precipitation for outdoor sports
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_prop_history_player ON player_prop_history(player_name);
CREATE INDEX IF NOT EXISTS idx_prop_history_sport_stat ON player_prop_history(sport, stat_type);
CREATE INDEX IF NOT EXISTS idx_prop_history_game_date ON player_prop_history(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_prop_history_completed ON player_prop_history(game_completed, game_date);
CREATE INDEX IF NOT EXISTS idx_prop_history_player_stat ON player_prop_history(player_name, stat_type);

COMMENT ON TABLE player_prop_history IS 
  'Historical player prop lines and outcomes for hit rate analysis';

-- =============================================================================
-- PLAYER PROP HIT RATE STATS (MATERIALIZED VIEW)
-- Pre-computed hit rate statistics by player and stat type
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS player_prop_hit_rate_stats AS
SELECT 
  player_name,
  sport,
  stat_type,
  COUNT(*) as total_props,
  COUNT(*) FILTER (WHERE hit = TRUE) as hits,
  COUNT(*) FILTER (WHERE hit = FALSE) as misses,
  ROUND(
    (COUNT(*) FILTER (WHERE hit = TRUE)::NUMERIC / 
     NULLIF(COUNT(*) FILTER (WHERE hit IS NOT NULL), 0)) * 100, 
    2
  ) as hit_rate_percentage,
  AVG(prop_line) as avg_line,
  AVG(actual_result) as avg_actual,
  AVG(actual_result - prop_line) as avg_differential,
  MAX(game_date) as last_game_date,
  COUNT(*) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '30 days') as last_30_days_count,
  ROUND(
    (COUNT(*) FILTER (WHERE hit = TRUE AND game_date >= CURRENT_DATE - INTERVAL '30 days')::NUMERIC / 
     NULLIF(COUNT(*) FILTER (WHERE hit IS NOT NULL AND game_date >= CURRENT_DATE - INTERVAL '30 days'), 0)) * 100,
    2
  ) as hit_rate_last_30_days
FROM player_prop_history
WHERE hit IS NOT NULL
GROUP BY player_name, sport, stat_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hit_rate_stats_unique 
  ON player_prop_hit_rate_stats(player_name, sport, stat_type);

COMMENT ON MATERIALIZED VIEW player_prop_hit_rate_stats IS 
  'Pre-computed player prop hit rate statistics for fast querying';

-- =============================================================================
-- PROP LINE HISTORY (SEPARATE TABLE FOR TRACKING LINE MOVEMENTS)
-- Tracks how prop lines change over time before game starts
-- =============================================================================

CREATE TABLE IF NOT EXISTS prop_line_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prop_history_id UUID REFERENCES player_prop_history(id) ON DELETE CASCADE,
  bookmaker TEXT NOT NULL,
  line_value NUMERIC(10,2) NOT NULL,
  over_odds NUMERIC(6,2),
  under_odds NUMERIC(6,2),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_movements_prop ON prop_line_movements(prop_history_id);
CREATE INDEX IF NOT EXISTS idx_line_movements_timestamp ON prop_line_movements(timestamp DESC);

COMMENT ON TABLE prop_line_movements IS 
  'Tracks prop line movements over time for market analysis';

-- =============================================================================
-- PLAYER METADATA TABLE
-- Additional player information for enhanced analysis
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL UNIQUE,
  sport TEXT NOT NULL,
  team TEXT,
  position TEXT,
  jersey_number INTEGER,
  active BOOLEAN DEFAULT TRUE,
  injury_status TEXT,
  career_stats JSONB, -- Career averages, records, etc.
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_meta_name ON player_metadata(player_name);
CREATE INDEX IF NOT EXISTS idx_player_meta_sport_team ON player_metadata(sport, team);

COMMENT ON TABLE player_metadata IS 
  'Player information and career statistics for context';

-- =============================================================================
-- FUNCTIONS FOR AUTOMATED CALCULATIONS
-- =============================================================================

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_prop_hit_rate_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY player_prop_hit_rate_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate hit rate for specific player/stat
CREATE OR REPLACE FUNCTION calculate_player_hit_rate(
  p_player_name TEXT,
  p_stat_type TEXT,
  p_days_back INTEGER DEFAULT 365
)
RETURNS TABLE (
  hit_rate NUMERIC,
  total_count INTEGER,
  hits INTEGER,
  misses INTEGER,
  avg_line NUMERIC,
  avg_actual NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(
      (COUNT(*) FILTER (WHERE hit = TRUE)::NUMERIC / 
       NULLIF(COUNT(*) FILTER (WHERE hit IS NOT NULL), 0)) * 100,
      2
    ) as hit_rate,
    COUNT(*)::INTEGER as total_count,
    COUNT(*) FILTER (WHERE hit = TRUE)::INTEGER as hits,
    COUNT(*) FILTER (WHERE hit = FALSE)::INTEGER as misses,
    ROUND(AVG(prop_line), 2) as avg_line,
    ROUND(AVG(actual_result), 2) as avg_actual
  FROM player_prop_history
  WHERE player_name = p_player_name
    AND stat_type = p_stat_type
    AND hit IS NOT NULL
    AND game_date >= CURRENT_DATE - (p_days_back || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to update hit/miss based on actual result
CREATE OR REPLACE FUNCTION update_prop_outcome()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if actual_result is set and game is completed
  IF NEW.actual_result IS NOT NULL AND NEW.game_completed = TRUE THEN
    NEW.hit = (NEW.actual_result > NEW.prop_line);
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate hit/miss
CREATE TRIGGER trigger_update_prop_outcome
  BEFORE UPDATE ON player_prop_history
  FOR EACH ROW
  WHEN (NEW.actual_result IS NOT NULL AND NEW.game_completed = TRUE)
  EXECUTE FUNCTION update_prop_outcome();

-- =============================================================================
-- SAMPLE DATA INSERTION (FOR TESTING)
-- =============================================================================

-- Example: Insert sample MLB prop data
INSERT INTO player_prop_history (
  player_name, sport, stat_type, prop_line, actual_result,
  game_date, opponent, bookmaker, over_odds, under_odds,
  game_completed, hit
) VALUES
  ('Shohei Ohtani', 'mlb', 'home_runs', 0.5, 2, '2026-02-10', 'Yankees', 'DraftKings', -110, -110, TRUE, TRUE),
  ('Shohei Ohtani', 'mlb', 'home_runs', 0.5, 0, '2026-02-09', 'Red Sox', 'FanDuel', -120, -100, TRUE, FALSE),
  ('Aaron Judge', 'mlb', 'total_bases', 2.5, 4, '2026-02-10', 'Angels', 'DraftKings', -115, -105, TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- Refresh the materialized view after sample data
SELECT refresh_prop_hit_rate_stats();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) - OPTIONAL FOR USER-SPECIFIC DATA
-- =============================================================================

-- Enable RLS if you want user-specific tracking
-- ALTER TABLE player_prop_history ENABLE ROW LEVEL SECURITY;

-- Example policy for public read access
-- CREATE POLICY "Public read access" ON player_prop_history
--   FOR SELECT USING (true);

-- =============================================================================
-- GRANTS FOR API ACCESS
-- =============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON player_prop_history TO authenticated;
GRANT SELECT ON player_prop_hit_rate_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON prop_line_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON player_metadata TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_prop_hit_rate_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_player_hit_rate(TEXT, TEXT, INTEGER) TO authenticated;

-- Grant access to anon users (read-only)
GRANT SELECT ON player_prop_history TO anon;
GRANT SELECT ON player_prop_hit_rate_stats TO anon;
GRANT SELECT ON prop_line_movements TO anon;
GRANT SELECT ON player_metadata TO anon;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
