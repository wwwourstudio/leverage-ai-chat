/**
 * Fix: user_credits and live_odds_cache RLS for authenticated role
 *
 * user_credits: add SELECT/INSERT/UPDATE policies for the authenticated role so
 * logged-in users can read and upsert their own credit row via the browser client.
 *
 * live_odds_cache: add a SELECT policy for the authenticated role so the
 * odds-sidebar browser fetch stops getting "permission denied for table".
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

const statements = [
  // ── user_credits ──────────────────────────────────────────────────────────
  `ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY`,

  `DROP POLICY IF EXISTS "Users can view own credits"       ON public.user_credits`,
  `DROP POLICY IF EXISTS "Users can insert own credits"     ON public.user_credits`,
  `DROP POLICY IF EXISTS "Users can update own credits"     ON public.user_credits`,
  `DROP POLICY IF EXISTS "Authenticated read own credits"   ON public.user_credits`,
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

  // ── live_odds_cache ───────────────────────────────────────────────────────
  `DROP POLICY IF EXISTS "Authenticated read odds cache" ON public.live_odds_cache`,

  `CREATE POLICY "Authenticated read odds cache"
     ON public.live_odds_cache FOR SELECT
     USING ((select auth.role()) IN ('authenticated', 'anon'))`,
]

async function main() {
  console.log('Applying RLS policies via Supabase rpc...')
  let ok = 0
  let fail = 0

  for (const stmt of statements) {
    const preview = stmt.trim().split('\n')[0].substring(0, 80)
    const { error } = await supabase.rpc('exec_sql', { query: stmt })
    if (error) {
      // rpc may not exist — fall back to a raw POST to the SQL endpoint
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: stmt }),
      })
      if (!res.ok) {
        const body = await res.text()
        console.error(`  FAIL [${preview}]: ${body}`)
        fail++
      } else {
        console.log(`  OK   [${preview}]`)
        ok++
      }
    } else {
      console.log(`  OK   [${preview}]`)
      ok++
    }
  }

  console.log(`\nDone — ${ok} succeeded, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
