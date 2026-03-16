import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Module-level singleton for ADP operations
// Runtime check ensures client is only created server-side
let _adpSupabaseServer: SupabaseClient | null = null;

/**
 * Returns a Supabase client configured for ADP data operations.
 * Uses service role key for elevated permissions.
 * Returns null in browser context to prevent GoTrueClient conflicts.
 */
export function getADPSupabaseClient(): SupabaseClient | null {
  // Prevent client creation in browser - avoids "Multiple GoTrueClient" warning
  if (typeof window !== 'undefined') {
    return null;
  }

  if (_adpSupabaseServer) return _adpSupabaseServer;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  _adpSupabaseServer = createClient(url, key, {
    db: { schema: 'api' },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _adpSupabaseServer;
}
