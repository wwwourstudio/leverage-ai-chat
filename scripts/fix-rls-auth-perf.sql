-- =============================================================================
-- fix-rls-auth-perf.sql
--
-- Fixes RLS policy performance warnings flagged by the Supabase advisor.
-- Root cause: calling auth.uid() / auth.role() directly in a policy USING /
-- WITH CHECK expression causes PostgreSQL to re-evaluate the function for
-- every row it inspects.  Wrapping each call in (select auth.<fn>()) turns it
-- into a scalar subquery that is evaluated once per statement, eliminating
-- the per-row overhead.
--
-- Reported: api.bet_allocations — "Auth write access" policy
-- Fix scope: all tables in master-schema.sql that had the same pattern.
--
-- Run in the Supabase SQL Editor (requires the schema to already exist).
-- Safe to re-run: every statement uses DROP … IF EXISTS before CREATE.
-- Each table is wrapped in its own DO block so missing tables are skipped
-- gracefully instead of aborting the whole script.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Shared / trading tables  (auth.role = 'authenticated')
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth write access" ON live_odds_cache;
  CREATE POLICY "Auth write access" ON live_odds_cache
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping live_odds_cache — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth write access" ON mlb_odds;
  CREATE POLICY "Auth write access" ON mlb_odds
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping mlb_odds — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth write access" ON nfl_odds;
  CREATE POLICY "Auth write access" ON nfl_odds
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping nfl_odds — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth write access" ON nba_odds;
  CREATE POLICY "Auth write access" ON nba_odds
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping nba_odds — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth write access" ON nhl_odds;
  CREATE POLICY "Auth write access" ON nhl_odds
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping nhl_odds — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth write access" ON line_movement;
  CREATE POLICY "Auth write access" ON line_movement
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping line_movement — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth write access" ON arbitrage_opportunities;
  CREATE POLICY "Auth write access" ON arbitrage_opportunities
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping arbitrage_opportunities — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth write access" ON player_props_markets;
  CREATE POLICY "Auth write access" ON player_props_markets
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping player_props_markets — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth write access" ON kalshi_markets;
  CREATE POLICY "Auth write access" ON kalshi_markets
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping kalshi_markets — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth write access" ON capital_state;
  CREATE POLICY "Auth write access" ON capital_state
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping capital_state — table does not exist';
END $$;

-- Primary target from the Supabase advisor report:
DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth write access" ON bet_allocations;
  CREATE POLICY "Auth write access" ON bet_allocations
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping bet_allocations — table does not exist';
END $$;

-- ---------------------------------------------------------------------------
-- 2. User-owned tables  (auth.uid() = user_id)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  DROP POLICY IF EXISTS "Own predictions only" ON ai_predictions;
  CREATE POLICY "Own predictions only" ON ai_predictions
    FOR ALL USING ((select auth.uid()) = user_id OR user_id IS NULL);
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping ai_predictions — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Own profile only" ON user_profiles;
  CREATE POLICY "Own profile only" ON user_profiles
    FOR ALL USING ((select auth.uid()) = user_id);
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping user_profiles — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Own preferences only" ON user_preferences;
  CREATE POLICY "Own preferences only" ON user_preferences
    FOR ALL USING ((select auth.uid()) = user_id);
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping user_preferences — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Own alerts only" ON user_alerts;
  CREATE POLICY "Own alerts only" ON user_alerts
    FOR ALL USING ((select auth.uid()) = user_id);
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping user_alerts — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Own stats only" ON user_stats;
  CREATE POLICY "Own stats only" ON user_stats
    FOR ALL USING ((select auth.uid()) = user_id);
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping user_stats — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Own insights only" ON user_insights;
  CREATE POLICY "Own insights only" ON user_insights
    FOR ALL USING ((select auth.uid()) = user_id);
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping user_insights — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Own subscription only" ON subscription_tiers;
  CREATE POLICY "Own subscription only" ON subscription_tiers
    FOR ALL USING ((select auth.uid()) = user_id);
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping subscription_tiers — table does not exist';
END $$;

-- ---------------------------------------------------------------------------
-- 3. Fantasy tables  (auth.uid() inside EXISTS subqueries + auth.role())
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  DROP POLICY IF EXISTS "League owner access" ON fantasy_leagues;
  CREATE POLICY "League owner access" ON fantasy_leagues
    FOR ALL USING ((select auth.uid()) = user_id);
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping fantasy_leagues — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "League member read" ON fantasy_teams;
  DROP POLICY IF EXISTS "League owner write" ON fantasy_teams;
  CREATE POLICY "League member read" ON fantasy_teams
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM fantasy_leagues
        WHERE fantasy_leagues.id = fantasy_teams.league_id
          AND fantasy_leagues.user_id = (select auth.uid())
      )
    );
  CREATE POLICY "League owner write" ON fantasy_teams
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM fantasy_leagues
        WHERE fantasy_leagues.id = fantasy_teams.league_id
          AND fantasy_leagues.user_id = (select auth.uid())
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping fantasy_teams — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Roster access" ON fantasy_rosters;
  CREATE POLICY "Roster access" ON fantasy_rosters
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM fantasy_teams
        JOIN fantasy_leagues ON fantasy_leagues.id = fantasy_teams.league_id
        WHERE fantasy_teams.id = fantasy_rosters.team_id
          AND fantasy_leagues.user_id = (select auth.uid())
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping fantasy_rosters — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Projections read"   ON fantasy_projections;
  DROP POLICY IF EXISTS "Projections write"  ON fantasy_projections;
  DROP POLICY IF EXISTS "Projections update" ON fantasy_projections;
  CREATE POLICY "Projections read" ON fantasy_projections
    FOR SELECT USING ((select auth.role()) = 'authenticated');
  CREATE POLICY "Projections write" ON fantasy_projections
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
  CREATE POLICY "Projections update" ON fantasy_projections
    FOR UPDATE USING ((select auth.role()) = 'authenticated');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping fantasy_projections — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Waiver access" ON waiver_transactions;
  CREATE POLICY "Waiver access" ON waiver_transactions
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM fantasy_leagues
        WHERE fantasy_leagues.id = waiver_transactions.league_id
          AND fantasy_leagues.user_id = (select auth.uid())
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping waiver_transactions — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Draft room access" ON draft_rooms;
  CREATE POLICY "Draft room access" ON draft_rooms
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM fantasy_leagues
        WHERE fantasy_leagues.id = draft_rooms.league_id
          AND fantasy_leagues.user_id = (select auth.uid())
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping draft_rooms — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Draft pick access" ON draft_picks;
  CREATE POLICY "Draft pick access" ON draft_picks
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM draft_rooms
        JOIN fantasy_leagues ON fantasy_leagues.id = draft_rooms.league_id
        WHERE draft_rooms.id = draft_picks.draft_room_id
          AND fantasy_leagues.user_id = (select auth.uid())
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping draft_picks — table does not exist';
END $$;

-- ---------------------------------------------------------------------------
-- 4. Credits & chat tables
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  DROP POLICY IF EXISTS "User can read own credits"      ON api.user_credits;
  DROP POLICY IF EXISTS "Service role can manage credits" ON api.user_credits;
  CREATE POLICY "User can read own credits" ON api.user_credits
    FOR SELECT USING ((select auth.uid()) = user_id);
  CREATE POLICY "Service role can manage credits" ON api.user_credits
    FOR ALL USING ((select auth.role()) = 'service_role');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping api.user_credits — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Own threads only" ON chat_threads;
  CREATE POLICY "Own threads only" ON chat_threads
    FOR ALL USING ((select auth.uid()) = user_id);
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping chat_threads — table does not exist';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Thread owner messages" ON chat_messages;
  CREATE POLICY "Thread owner messages" ON chat_messages
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM chat_threads
        WHERE chat_threads.id = chat_messages.thread_id
          AND chat_threads.user_id = (select auth.uid())
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipping chat_messages — table does not exist';
END $$;
