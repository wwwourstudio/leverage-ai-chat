import { createBrowserClient } from '@supabase/ssr'

// Use globalThis to persist the singleton across HMR re-evaluations in
// development. Without this, every hot-reload creates a new GoTrueClient
// instance backed by the same localStorage key, triggering the
// "Multiple GoTrueClient instances" warning.
const g = globalThis as typeof globalThis & {
  __supabaseBrowserClient?: ReturnType<typeof createBrowserClient>
}

export function createClient() {
  if (g.__supabaseBrowserClient) {
    return g.__supabaseBrowserClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  g.__supabaseBrowserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'api' },
  })

  return g.__supabaseBrowserClient
}
