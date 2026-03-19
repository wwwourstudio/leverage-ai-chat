-- =============================================================================
-- Fix: RLS policies with USING (true) / WITH CHECK (true) on write operations
-- Supabase lint: "RLS Policy Always True" (×18 policies across 10 tables)
--
-- Root cause: service-role write policies used bare `true` expressions,
-- meaning any role (including anon/authenticated) could INSERT or UPDATE
-- these rows — defeating the purpose of RLS.
--
-- Fix: replace true with (select auth.role()) = 'service_role' so only
-- server-side service_role clients (API routes, cron jobs) can write.
-- auth.role() is wrapped in SELECT to evaluate once per statement, not
-- once per row (avoids the companion per-row re-evaluation advisory).
--
-- HIBP / Leaked password protection: requires Supabase Pro plan.
-- Cannot be enabled on Free tier via SQL or dashboard toggle.
-- =============================================================================

-- api.player_props_markets
DROP POLICY IF EXISTS "Service upsert player props" ON api.player_props_markets;
CREATE POLICY "Service upsert player props"
  ON api.player_props_markets FOR UPDATE
  USING      ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service write player props" ON api.player_props_markets;
CREATE POLICY "Service write player props"
  ON api.player_props_markets FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- api.user_preferences
DROP POLICY IF EXISTS "Service inserts preferences" ON api.user_preferences;
CREATE POLICY "Service inserts preferences"
  ON api.user_preferences FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- api.user_profiles
DROP POLICY IF EXISTS "Service inserts profiles" ON api.user_profiles;
CREATE POLICY "Service inserts profiles"
  ON api.user_profiles FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- public.live_odds_cache
DROP POLICY IF EXISTS "Service can update odds cache" ON public.live_odds_cache;
CREATE POLICY "Service can update odds cache"
  ON public.live_odds_cache FOR UPDATE
  USING      ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service can write odds cache" ON public.live_odds_cache;
CREATE POLICY "Service can write odds cache"
  ON public.live_odds_cache FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- public.mlb_odds
DROP POLICY IF EXISTS "Service can update mlb_odds" ON public.mlb_odds;
CREATE POLICY "Service can update mlb_odds"
  ON public.mlb_odds FOR UPDATE
  USING      ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service can write mlb_odds" ON public.mlb_odds;
CREATE POLICY "Service can write mlb_odds"
  ON public.mlb_odds FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- public.nba_odds
DROP POLICY IF EXISTS "Service can update nba_odds" ON public.nba_odds;
CREATE POLICY "Service can update nba_odds"
  ON public.nba_odds FOR UPDATE
  USING      ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service can write nba_odds" ON public.nba_odds;
CREATE POLICY "Service can write nba_odds"
  ON public.nba_odds FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- public.ncaab_odds
DROP POLICY IF EXISTS "Service can update ncaab_odds" ON public.ncaab_odds;
CREATE POLICY "Service can update ncaab_odds"
  ON public.ncaab_odds FOR UPDATE
  USING      ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service can write ncaab_odds" ON public.ncaab_odds;
CREATE POLICY "Service can write ncaab_odds"
  ON public.ncaab_odds FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- public.ncaaf_odds
DROP POLICY IF EXISTS "Service can update ncaaf_odds" ON public.ncaaf_odds;
CREATE POLICY "Service can update ncaaf_odds"
  ON public.ncaaf_odds FOR UPDATE
  USING      ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service can write ncaaf_odds" ON public.ncaaf_odds;
CREATE POLICY "Service can write ncaaf_odds"
  ON public.ncaaf_odds FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- public.nfl_odds
DROP POLICY IF EXISTS "Service can update nfl_odds" ON public.nfl_odds;
CREATE POLICY "Service can update nfl_odds"
  ON public.nfl_odds FOR UPDATE
  USING      ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service can write nfl_odds" ON public.nfl_odds;
CREATE POLICY "Service can write nfl_odds"
  ON public.nfl_odds FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- public.nhl_odds
DROP POLICY IF EXISTS "Service can update nhl_odds" ON public.nhl_odds;
CREATE POLICY "Service can update nhl_odds"
  ON public.nhl_odds FOR UPDATE
  USING      ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service can write nhl_odds" ON public.nhl_odds;
CREATE POLICY "Service can write nhl_odds"
  ON public.nhl_odds FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');
