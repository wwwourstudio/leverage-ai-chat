import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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
  // cookies are reassembled correctly.
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

  // Refresh the session on every request.
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
    // Run on all paths except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
