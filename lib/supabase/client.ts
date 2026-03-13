import { createBrowserClient } from '@supabase/ssr'

// Use globalThis to persist the singleton across HMR reloads in development
const GLOBAL_KEY = '__supabase_browser_client__' as const

type BrowserClient = ReturnType<typeof createBrowserClient>

export function createClient(): BrowserClient {
  // Check globalThis first (survives HMR)
  const cached = (globalThis as Record<string, unknown>)[GLOBAL_KEY] as BrowserClient | undefined
  if (cached) {
    return cached
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  const client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'api' },
  })

  // Store in globalThis to survive HMR
  ;(globalThis as Record<string, unknown>)[GLOBAL_KEY] = client

  return client
}
