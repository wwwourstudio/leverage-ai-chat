import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

/**
 * proxy.js — Next.js 16 proxy configuration.
 *
 * In Next.js 16, `proxy.js` replaces the deprecated `middleware.ts` file.
 * The exported `proxy` function is backwards-compatible: Next.js 16 accepts
 * both `middleware.ts` and `proxy.js`, so existing deployments continue to
 * work unchanged while the new filename is adopted going forward.
 *
 * Responsibility: refresh the Supabase auth session cookie on every matched
 * request so tokens stay alive across navigations. No route-level protection
 * is implemented here — guard individual routes with `getUser()` checks instead.
 */
export async function proxy(request) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, skip auth — protected routes handle this
  // gracefully via their own `getUser()` guards.
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  // Using getAll/setAll (required by @supabase/ssr 0.5+) so chunked session
  // cookies are reassembled correctly and the
  // "Cannot create property on string" error is avoided.
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresh the session — sole purpose of this proxy.
  const { error: authError } = await supabase.auth.getUser();

  // If the refresh token is revoked or expired, clear stale sb- cookies so
  // the user is treated as logged-out rather than looping on 401 errors.
  if (authError?.code === 'refresh_token_not_found') {
    const clearResponse = NextResponse.next({ request });
    request.cookies.getAll().forEach(cookie => {
      if (cookie.name.startsWith('sb-')) {
        clearResponse.cookies.delete(cookie.name);
      }
    });
    return clearResponse;
  }

  return response;
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals, static assets, and public manifest/sw files
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)',
  ],
};
