import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Module-level singleton for ADP operations (server-side only)
// NOTE: intentionally does NOT import 'server-only' because this module is
// transitively reachable from page-client.tsx (a Client Component) via
// adp-data.ts → fantasy-card-generator.ts. The Supabase client is only
// instantiated lazily and only when the env vars are present (server context).
let _adpClient: SupabaseClient | null = null;

/**
 * Returns a module-level Supabase singleton configured for ADP table access.
 * Uses the service role key when available (bypasses RLS), falls back to anon key.
 * Returns null when the required env vars are missing (client-side / test envs).
 */
export function getADPSupabaseClient(): SupabaseClient | null {
  if (_adpClient) return _adpClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  _adpClient = createClient(url, key, {
    db: { schema: 'api' },
    auth: {
      // Disable session persistence — this is a server-side service client
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return _adpClient;
}
