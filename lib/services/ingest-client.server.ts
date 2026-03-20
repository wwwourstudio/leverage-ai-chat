/**
 * Ingest Supabase Client
 *
 * Singleton service-role Supabase client for background ingest writes.
 * Uses the service role key to bypass RLS — safe because this module is
 * server-only (never imported by the browser bundle).
 *
 * All ingest services (statcast-ingest, game-ingest, projection-store) import
 * this shared factory rather than creating their own clients, so we hold at
 * most one extra connection across all ingest operations in a warm Lambda.
 *
 * Pattern mirrors lib/supabase/adp-client.server.ts.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

/**
 * Returns a singleton Supabase client scoped to the `api` schema with the
 * service role key (bypasses RLS).  Returns null in browser context or when
 * env vars are absent.
 */
export async function getIngestClient() {
  if (typeof window !== 'undefined') return null;
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  const { createClient } = await import('@supabase/supabase-js');
  _client = createClient(url, key, {
    db: { schema: 'api' },
    auth: {
      persistSession:    false,
      autoRefreshToken:  false,
      detectSessionInUrl: false,
    },
  });

  return _client;
}
