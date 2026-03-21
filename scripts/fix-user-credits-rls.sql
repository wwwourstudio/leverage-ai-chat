-- =============================================================================
-- Fix: user_credits and live_odds_cache RLS for authenticated role
--
-- user_credits: server-side API routes use service_role (bypasses RLS) but the
-- browser-side Supabase client (anon key) gets 403/406 on upsert because there
-- are no INSERT/UPDATE policies for the authenticated role. Adding row-level
-- ownership policies lets logged-in users read and update their own row only.
--
-- live_odds_cache: "permission denied for table" error because write policies
-- were already locked to service_role only (correct), but the SELECT policy was
-- missing for authenticated, blocking the odds-sidebar fetch.
-- =============================================================================

-- ── user_credits ──────────────────────────────────────────────────────────────

-- Make sure RLS is on
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Drop any old conflicting policies
DROP POLICY IF EXISTS "Users can view own credits"    ON public.user_credits;
DROP POLICY IF EXISTS "Users can insert own credits"  ON public.user_credits;
DROP POLICY IF EXISTS "Users can update own credits"  ON public.user_credits;
DROP POLICY IF EXISTS "Authenticated read own credits"   ON public.user_credits;
DROP POLICY IF EXISTS "Authenticated insert own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Authenticated update own credits" ON public.user_credits;

-- SELECT: owner can read their own row
CREATE POLICY "Authenticated read own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: owner can create their own row (on_conflict upsert path)
CREATE POLICY "Authenticated insert own credits"
  ON public.user_credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: owner can update their own row
CREATE POLICY "Authenticated update own credits"
  ON public.user_credits FOR UPDATE
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- service_role bypass (idempotent re-apply)
DROP POLICY IF EXISTS "Service role full access on user_credits" ON public.user_credits;
CREATE POLICY "Service role full access on user_credits"
  ON public.user_credits FOR ALL
  USING      ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── live_odds_cache ───────────────────────────────────────────────────────────

-- SELECT for authenticated (needed by the odds sidebar browser fetch)
DROP POLICY IF EXISTS "Authenticated read odds cache" ON public.live_odds_cache;
CREATE POLICY "Authenticated read odds cache"
  ON public.live_odds_cache FOR SELECT
  USING ((select auth.role()) IN ('authenticated', 'anon'));
