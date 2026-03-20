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
 * IMPORTANT — why we never fall back to the anon key:
 *   The anon role lacks USAGE on BIGSERIAL sequences in the api schema.
 *   Using it causes "permission denied for sequence statcast_daily_id_seq"
 *   on every INSERT (even though RLS policies allow the write at the table
 *   level, sequence ACLs are separate).  If the service role key is absent,
 *   we return null and callers degrade gracefully rather than writing with
 *   the wrong credentials.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

/**
 * Returns a singleton Supabase client scoped to the `api` schema with the
 * service role key (bypasses RLS and has USAGE on all sequences).
 * Returns null in browser context or when SUPABASE_SERVICE_ROLE_KEY is absent.
 */
export async function getIngestClient() {
  if (typeof window !== 'undefined') return null;
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Require the service role key explicitly — do NOT fall back to the anon
  // key.  The anon role does not have USAGE on api schema sequences, which
  // causes "permission denied for sequence *_id_seq" on every INSERT.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn(
      '[ingest-client] SUPABASE_SERVICE_ROLE_KEY is not set — ' +
      'ingest writes are disabled.  Add this env var to enable DB persistence.',
    );
    return null;
  }

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
