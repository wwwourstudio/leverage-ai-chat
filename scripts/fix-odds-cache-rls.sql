-- Add RLS policies for live_odds_cache to allow anon reads and service writes.
-- The current table only allows authenticated SELECT. We need:
-- 1. Public read access (anon + authenticated) for odds data
-- 2. Anon insert/update for the server-side fetcher (runs with anon key)

-- Enable broader read access
DROP POLICY IF EXISTS "Authenticated users can read odds cache" ON live_odds_cache;
CREATE POLICY "Anyone can read odds cache"
  ON live_odds_cache FOR SELECT
  USING (true);

-- Allow server-side writes (anon key used by the odds fetcher)
CREATE POLICY "Service can write odds cache"
  ON live_odds_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update odds cache"
  ON live_odds_cache FOR UPDATE
  USING (true);

CREATE POLICY "Service can delete expired odds cache"
  ON live_odds_cache FOR DELETE
  USING (expires_at < now());

-- Also add write policies for sport-specific odds tables
-- These tables have RLS enabled but 0 policies (blocking all access)

-- NBA
CREATE POLICY "Anyone can read nba_odds" ON nba_odds FOR SELECT USING (true);
CREATE POLICY "Service can write nba_odds" ON nba_odds FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update nba_odds" ON nba_odds FOR UPDATE USING (true);

-- NHL
CREATE POLICY "Anyone can read nhl_odds" ON nhl_odds FOR SELECT USING (true);
CREATE POLICY "Service can write nhl_odds" ON nhl_odds FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update nhl_odds" ON nhl_odds FOR UPDATE USING (true);

-- NCAAB
CREATE POLICY "Anyone can read ncaab_odds" ON ncaab_odds FOR SELECT USING (true);
CREATE POLICY "Service can write ncaab_odds" ON ncaab_odds FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update ncaab_odds" ON ncaab_odds FOR UPDATE USING (true);

-- NFL
CREATE POLICY "Anyone can read nfl_odds" ON nfl_odds FOR SELECT USING (true);
CREATE POLICY "Service can write nfl_odds" ON nfl_odds FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update nfl_odds" ON nfl_odds FOR UPDATE USING (true);

-- MLB
CREATE POLICY "Anyone can read mlb_odds" ON mlb_odds FOR SELECT USING (true);
CREATE POLICY "Service can write mlb_odds" ON mlb_odds FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update mlb_odds" ON mlb_odds FOR UPDATE USING (true);

-- NCAAF
CREATE POLICY "Anyone can read ncaaf_odds" ON ncaaf_odds FOR SELECT USING (true);
CREATE POLICY "Service can write ncaaf_odds" ON ncaaf_odds FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update ncaaf_odds" ON ncaaf_odds FOR UPDATE USING (true);
