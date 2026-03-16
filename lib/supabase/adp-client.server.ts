// Module-level singleton for ADP operations.
// NOTE: intentionally uses a dynamic import for @supabase/supabase-js so that
// this module can be statically imported by adp-data.ts (which is bundled for
// the client) without pulling the entire Supabase package into the client chunk.
// The factory is only resolved lazily, server-side, when getADPSupabaseClient()
// is actually called.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adpClient: any = null;

/**
 * Returns a Supabase singleton configured for ADP table access.
 * Uses the service role key when available (bypasses RLS), falls back to anon key.
 * Returns null when called in a browser context or when env vars are missing.
 */
export async function getADPSupabaseClient() {
  // Never instantiate a server client in the browser — bail out immediately
  // so that the dynamic import below is never reached in the client bundle.
  if (typeof window !== 'undefined') return null;

  if (_adpClient) return _adpClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  // Dynamic import keeps @supabase/supabase-js out of the client chunk.
  const { createClient } = await import('@supabase/supabase-js');
  _adpClient = createClient(url, key, {
    db: { schema: 'api' },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return _adpClient;
}
