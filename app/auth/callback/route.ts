import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * OAuth callback handler for Supabase PKCE flow.
 *
 * After a user approves Google (or any OAuth provider) login, Supabase
 * redirects here with a one-time ?code= parameter. This route exchanges
 * that code for a session cookie, then sends the user back to the app.
 *
 * Without this route the PKCE code is never redeemed and the user stays
 * logged out even though Google approved the login.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: { schema: 'api' },
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: any) {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: any }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // Code missing or exchange failed — redirect to home
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
