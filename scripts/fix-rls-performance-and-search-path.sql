-- =============================================================================
-- Fix: mutable search_path, RLS auth() per-row re-evaluation,
--      multiple permissive SELECT policies
-- Supabase lint issues resolved:
--   • public.update_user_stats_on_prediction — mutable search_path
--   • api.ai_feedback          — auth.jwt()  re-evaluated per row
--   • api.ai_predictions       — auth.uid()  re-evaluated per row
--   • api.arbitrage_opportunities — auth.role() re-evaluated per row
--   • api.backup_daily_picks   — auth.role() re-evaluated per row
--                              — multiple permissive SELECT policies
--   • api.backup_live_odds     — auth.role() re-evaluated per row
--                              (latent multiple-SELECT issue also resolved)
--
-- NOTE — Auth / Leaked Password Protection (HaveIBeenPwned):
--   This cannot be changed via SQL. Enable it in the Supabase dashboard:
--   Authentication → Sign In / Up → Password Protection → toggle ON.
--   Or via the Management API: PATCH /v1/projects/{ref}/config/auth
--   with { "password_hibp_enabled": true }.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. public.update_user_stats_on_prediction — lock search_path
--    References public.user_profiles (was unqualified)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_stats_on_prediction()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  IF NEW.is_correct IS NOT NULL AND OLD.is_correct IS NULL THEN
    UPDATE public.user_profiles
    SET
      total_predictions   = total_predictions + 1,
      correct_predictions = correct_predictions + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
      win_rate = CASE
        WHEN total_predictions + 1 > 0
        THEN ((correct_predictions + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END)::DECIMAL
              / (total_predictions + 1)) * 100
        ELSE 0
      END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- 2. api.ai_feedback — fix auth.jwt() re-evaluated per row
--    Wrap with (select ...) so Postgres evaluates once per statement.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "ai_feedback_admin_full_access" ON api.ai_feedback;
CREATE POLICY "ai_feedback_admin_full_access"
  ON api.ai_feedback
  FOR ALL
  TO authenticated
  USING      ((select auth.jwt()) ->> 'user_role' = 'admin')
  WITH CHECK ((select auth.jwt()) ->> 'user_role' = 'admin');


-- ---------------------------------------------------------------------------
-- 3. api.ai_predictions — fix auth.uid() re-evaluated per row
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Own predictions only" ON api.ai_predictions;
CREATE POLICY "Own predictions only"
  ON api.ai_predictions
  FOR ALL
  USING ((select auth.uid()) = user_id OR user_id IS NULL);


-- ---------------------------------------------------------------------------
-- 4. api.arbitrage_opportunities — fix auth.role() re-evaluated per row
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Auth write access" ON api.arbitrage_opportunities;
CREATE POLICY "Auth write access"
  ON api.arbitrage_opportunities
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated');


-- ---------------------------------------------------------------------------
-- 5. api.backup_daily_picks
--    Problem A: auth.role() re-evaluated per row in the ALL policy
--    Problem B: FOR ALL includes SELECT, so anon/authenticated/dashboard_user
--               see two permissive SELECT policies (read + write), forcing
--               Postgres to evaluate both for every SELECT query.
--    Fix: replace the single FOR ALL write policy with three per-command
--         policies (INSERT / UPDATE / DELETE) so SELECT is covered only by
--         backup_daily_picks_read.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "backup_daily_picks_write"  ON api.backup_daily_picks;

CREATE POLICY "backup_daily_picks_insert"
  ON api.backup_daily_picks
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "backup_daily_picks_update"
  ON api.backup_daily_picks
  FOR UPDATE
  USING      ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "backup_daily_picks_delete"
  ON api.backup_daily_picks
  FOR DELETE
  USING ((select auth.role()) = 'service_role');


-- ---------------------------------------------------------------------------
-- 6. api.backup_live_odds — fix auth.role() re-evaluated per row
--    Also split FOR ALL → per-command to prevent the same latent
--    multiple-permissive-SELECT issue as backup_daily_picks.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "backup_live_odds_write" ON api.backup_live_odds;

CREATE POLICY "backup_live_odds_insert"
  ON api.backup_live_odds
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "backup_live_odds_update"
  ON api.backup_live_odds
  FOR UPDATE
  USING      ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "backup_live_odds_delete"
  ON api.backup_live_odds
  FOR DELETE
  USING ((select auth.role()) = 'service_role');


-- =============================================================================
-- Verify
-- =============================================================================
SELECT proname, pg_catalog.array_to_string(proconfig,', ') AS config
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'update_user_stats_on_prediction';

SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'api'
  AND tablename IN ('ai_feedback','ai_predictions','arbitrage_opportunities',
                    'backup_daily_picks','backup_live_odds')
ORDER BY tablename, policyname;
