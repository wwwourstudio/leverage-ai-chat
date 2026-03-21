/**
 * Fix: user_credits and live_odds_cache RLS for authenticated role
 * Uses the direct Postgres connection (POSTGRES_URL_NON_POOLING) to run DDL.
 */

import pg from 'pg'

const { Client } = pg

const connectionString = process.env.POSTGRES_URL_NON_POOLING

if (!connectionString) {
  console.error('Missing POSTGRES_URL_NON_POOLING')
  process.exit(1)
}

const statements = [
  // ── user_credits ────────────────────────────────────────────────────────
  `ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY`,

  `DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits`,
  `DROP POLICY IF EXISTS "Users can insert own credits" ON public.user_credits`,
  `DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits`,
  `DROP POLICY IF EXISTS "Authenticated read own credits" ON public.user_credits`,
  `DROP POLICY IF EXISTS "Authenticated insert own credits" ON public.user_credits`,
  `DROP POLICY IF EXISTS "Authenticated update own credits" ON public.user_credits`,
  `DROP POLICY IF EXISTS "Service role full access on user_credits" ON public.user_credits`,

  `CREATE POLICY "Authenticated read own credits"
     ON public.user_credits FOR SELECT
     USING (auth.uid() = user_id)`,

  `CREATE POLICY "Authenticated insert own credits"
     ON public.user_credits FOR INSERT
     WITH CHECK (auth.uid() = user_id)`,

  `CREATE POLICY "Authenticated update own credits"
     ON public.user_credits FOR UPDATE
     USING      (auth.uid() = user_id)
     WITH CHECK (auth.uid() = user_id)`,

  `CREATE POLICY "Service role full access on user_credits"
     ON public.user_credits FOR ALL
     USING      ((select auth.role()) = 'service_role')
     WITH CHECK ((select auth.role()) = 'service_role')`,

  // ── live_odds_cache ──────────────────────────────────────────────────────
  `DROP POLICY IF EXISTS "Authenticated read odds cache" ON public.live_odds_cache`,

  `CREATE POLICY "Authenticated read odds cache"
     ON public.live_odds_cache FOR SELECT
     USING ((select auth.role()) IN ('authenticated', 'anon'))`,
]

async function main() {
  const client = new Client({ connectionString })
  // Supabase pooler uses a self-signed cert chain; disable strict verification
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  await client.connect()
  console.log('Connected to Postgres.\n')

  let ok = 0
  let fail = 0

  for (const stmt of statements) {
    const preview = stmt.trim().replace(/\n\s+/g, ' ').substring(0, 90)
    try {
      await client.query(stmt)
      console.log(`  OK   ${preview}`)
      ok++
    } catch (err) {
      console.error(`  FAIL ${preview}`)
      console.error(`       ${err.message}`)
      fail++
    }
  }

  await client.end()
  console.log(`\nDone — ${ok} succeeded, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
