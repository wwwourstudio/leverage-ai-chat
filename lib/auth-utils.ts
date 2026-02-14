/**
 * Authentication Utilities
 * 
 * Helper functions for Supabase authentication
 * in Next.js 16 App Router with SSR support
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Get authenticated user on server
 */
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
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { user, error };
}

/**
 * Require authentication (throw if not authenticated)
 */
export async function requireAuth() {
  const { user, error } = await getServerUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  return user;
}

/**
 * Check if user has specific role
 */
export async function hasRole(role: string) {
  const { user } = await getServerUser();
  
  if (!user) return false;

  // Check user metadata for roles
  const userRoles = user.user_metadata?.roles || [];
  return userRoles.includes(role);
}
