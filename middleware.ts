import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Supabase auth session middleware.
 *
 * Refreshes the auth cookie on every matched request so the session
 * stays alive across navigations. No route-level protection is applied
 * here -- guard individual routes or pages with `getUser()` checks instead.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Check if Supabase is configured before attempting auth
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Supabase not configured - skip auth checks, allow all requests
    // Protected routes will handle missing auth gracefully
    return response;
  }

  // Supabase is configured - proceed with auth middleware
  // Using getAll/setAll API (required for @supabase/ssr 0.5+) so chunked session
  // cookies are reassembled correctly and avoid "Cannot create property on string" errors.
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session -- this is the sole purpose of the middleware.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
