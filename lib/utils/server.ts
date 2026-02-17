/**
 * Server-Only Utilities
 * Authentication and server-side utilities that require next/headers
 */
import "server-only"

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// ============================================
// Authentication Utilities
// ============================================

export async function getServerUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore errors in Server Components
          }
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

export async function requireAuth() {
  const { user, error } = await getServerUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  return user;
}

export async function hasRole(role: string) {
  const { user } = await getServerUser();
  if (!user) return false;

  const userRoles = user.user_metadata?.roles || [];
  return userRoles.includes(role);
}
