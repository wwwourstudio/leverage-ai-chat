/**
 * Fix: user_credits and live_odds_cache RLS for authenticated role
 *
 * user_credits: add SELECT/INSERT/UPDATE policies for the authenticated role so
 * logged-in users can read and upsert their own credit row via the browser client.
 *
 * live_odds_cache: add a SELECT policy for the authenticated role so the
 * odds-sidebar browser fetch stops getting "permission denied for table".
 */

import pg from 'pg'

const { Client } = pg

const client = new Client({
  connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
})

const sql = /* sql */ `
-- ── user_credits ──────────────────────────────────────────────────────────────

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credits"       ON public.user_credits;
DROP POLICY IF EXISTS "Users can insert own credits"     ON public.user_credits;
DROP POLICY IF EXISTS "Users can update own credits"     ON public.user_credits;
DROP POLICY IF EXISTS "Authenticated read own credits"   ON public.user_credits;
DROP POLICY IF EXISTS "Authenticated insert own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Authenticated update own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Service role full access on user_credits" ON public.user_credits;

CREATE POLICY "Authenticated read own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated insert own credits"
  ON public.user_credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated update own credits"
  ON public.user_credits FOR UPDATE
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on user_credits"
  ON public.user_credits FOR ALL
  USING      ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── live_odds_cache ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated read odds cache" ON public.live_odds_cache;

CREATE POLICY "Authenticated read odds cache"
  ON public.live_odds_cache FOR SELECT
  USING ((select auth.role()) IN ('authenticated', 'anon'));
`

async function main() {
  await client.connect()
  console.log('Connected to database')

  try {
    await client.query(sql)
    console.log('RLS policies applied successfully')
  } catch (err) {
    console.error('Error applying RLS policies:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
