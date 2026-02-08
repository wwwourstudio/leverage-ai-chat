import { createBrowserClient } from '@supabase/ssr'
import { isInV0Preview } from '@/lib/preview-mode'

let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  // In v0 preview, return a mock client to avoid browser restrictions
  if (isInV0Preview()) {
    console.log('[v0] Running in preview mode - Supabase auth disabled');
    return createMockClient();
  }

  if (client) {
    return client
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey)

  return client
}

// Mock client for preview environments
function createMockClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ 
        data: { user: null, session: null }, 
        error: { message: 'Auth disabled in preview mode' } 
      }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ 
        data: { subscription: { unsubscribe: () => {} } } 
      }),
    },
    from: () => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: { message: 'Database disabled in preview mode' } }),
      update: () => ({ data: null, error: { message: 'Database disabled in preview mode' } }),
      delete: () => ({ data: null, error: { message: 'Database disabled in preview mode' } }),
    }),
  } as any;
}
