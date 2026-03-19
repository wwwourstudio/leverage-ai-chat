-- =============================================================================
-- Fix: RLS enabled but no policies on 8 public tables
-- Supabase lint: "RLS Enabled No Policy" ×8
--
-- Without any policy, RLS blocks ALL access (deny-by-default).
-- Adding appropriate policies based on table ownership:
--
--   User-owned tables (have user_id):
--     ai_audit_log       — users read own rows; service_role writes
--     conversation_members — users read own rows; service_role manages
--     user_predictions   — users read/insert/update own rows; service_role deletes
--
--   Shared catalog tables (no user_id — public data):
--     arbitrage_opportunities — public read; service_role writes
--     college_baseball_odds   — public read; service_role writes
--     games                   — public read; service_role writes
--     line_movement           — public read; service_role writes
--     odds                    — public read; service_role writes
--
-- All auth.uid() / auth.role() calls are wrapped with (select ...) to
-- evaluate once per statement, not once per row.
-- =============================================================================

-- public.ai_audit_log
CREATE POLICY "ai_audit_log_read"   ON public.ai_audit_log FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "ai_audit_log_insert" ON public.ai_audit_log FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "ai_audit_log_update" ON public.ai_audit_log FOR UPDATE USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "ai_audit_log_delete" ON public.ai_audit_log FOR DELETE USING ((select auth.role()) = 'service_role');

-- public.arbitrage_opportunities
CREATE POLICY "arbitrage_opportunities_read"   ON public.arbitrage_opportunities FOR SELECT USING (true);
CREATE POLICY "arbitrage_opportunities_insert" ON public.arbitrage_opportunities FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "arbitrage_opportunities_update" ON public.arbitrage_opportunities FOR UPDATE USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "arbitrage_opportunities_delete" ON public.arbitrage_opportunities FOR DELETE USING ((select auth.role()) = 'service_role');

-- public.college_baseball_odds
CREATE POLICY "college_baseball_odds_read"   ON public.college_baseball_odds FOR SELECT USING (true);
CREATE POLICY "college_baseball_odds_insert" ON public.college_baseball_odds FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "college_baseball_odds_update" ON public.college_baseball_odds FOR UPDATE USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "college_baseball_odds_delete" ON public.college_baseball_odds FOR DELETE USING ((select auth.role()) = 'service_role');

-- public.conversation_members
CREATE POLICY "conversation_members_read"   ON public.conversation_members FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "conversation_members_insert" ON public.conversation_members FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "conversation_members_update" ON public.conversation_members FOR UPDATE USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "conversation_members_delete" ON public.conversation_members FOR DELETE USING ((select auth.role()) = 'service_role');

-- public.games
CREATE POLICY "games_read"   ON public.games FOR SELECT USING (true);
CREATE POLICY "games_write"  ON public.games FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "games_update" ON public.games FOR UPDATE USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "games_delete" ON public.games FOR DELETE USING ((select auth.role()) = 'service_role');

-- public.line_movement
CREATE POLICY "line_movement_read"   ON public.line_movement FOR SELECT USING (true);
CREATE POLICY "line_movement_insert" ON public.line_movement FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "line_movement_update" ON public.line_movement FOR UPDATE USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "line_movement_delete" ON public.line_movement FOR DELETE USING ((select auth.role()) = 'service_role');

-- public.odds
CREATE POLICY "odds_read"   ON public.odds FOR SELECT USING (true);
CREATE POLICY "odds_insert" ON public.odds FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "odds_update" ON public.odds FOR UPDATE USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "odds_delete" ON public.odds FOR DELETE USING ((select auth.role()) = 'service_role');

-- public.user_predictions
CREATE POLICY "user_predictions_read"   ON public.user_predictions FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "user_predictions_insert" ON public.user_predictions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "user_predictions_update" ON public.user_predictions FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "user_predictions_delete" ON public.user_predictions FOR DELETE USING ((select auth.role()) = 'service_role');
