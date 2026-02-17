-- Create the line_movement table for tracking odds changes over time
-- Used by lib/line-movement-tracker.ts to detect sharp money and market sentiment

CREATE TABLE IF NOT EXISTS line_movement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  market_type TEXT NOT NULL,
  team TEXT NOT NULL,
  line NUMERIC,
  odds NUMERIC NOT NULL,
  bookmaker TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_line_movement_game_id ON line_movement(game_id);
CREATE INDEX IF NOT EXISTS idx_line_movement_sport ON line_movement(sport);
CREATE INDEX IF NOT EXISTS idx_line_movement_timestamp ON line_movement(timestamp);
CREATE INDEX IF NOT EXISTS idx_line_movement_game_market ON line_movement(game_id, market_type);

-- Enable RLS
ALTER TABLE line_movement ENABLE ROW LEVEL SECURITY;

-- Allow anonymous reads and inserts (odds data is public)
CREATE POLICY "Allow public read access on line_movement"
  ON line_movement FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access on line_movement"
  ON line_movement FOR INSERT
  WITH CHECK (true);
