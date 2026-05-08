import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripeSecretKey } from '@/lib/config';

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session for the authenticated user and
 * returns the session URL. The client redirects (or opens a new tab) to it.
 *
 * Requires: STRIPE_SECRET_KEY and a Stripe Customer Portal configured in
 * the Stripe Dashboard (Settings → Billing → Customer Portal).
 */
export async function POST(request: NextRequest) {
  const stripeSecretKey = getStripeSecretKey();
  if (!stripeSecretKey) {
    return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: sub } = await supabase
      .from('subscription_tiers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ success: false, error: 'No active subscription found' }, { status: 404 });
    }

    let Stripe: any;
    try {
      Stripe = (await import(/* webpackIgnore: true */ 'stripe')).default;
    } catch {
      return NextResponse.json({ success: false, error: 'Stripe package not installed' }, { status: 503 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });

    const body = await request.json().catch(() => ({}));
    const defaultReturnUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://leverageai.app'}/`;
    const rawReturnUrl = (body as any).returnUrl ?? defaultReturnUrl;

    // Validate returnUrl against an allowlist to prevent open-redirect attacks.
    // An attacker who controls returnUrl can redirect users to a hostile domain
    // after they exit the Stripe portal.
    let returnUrl = defaultReturnUrl;
    try {
      const parsed = new URL(rawReturnUrl);
      const host = parsed.hostname.toLowerCase();
      const isAllowed =
        host === 'leverageai.app' ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.vercel.app') ||
        (process.env.NEXT_PUBLIC_SITE_URL &&
          host === new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname.toLowerCase());
      if (isAllowed) {
        returnUrl = rawReturnUrl;
      } else {
        console.warn(`[Stripe/Portal] Rejected untrusted returnUrl host: ${host}`);
      }
    } catch {
      // Malformed URL — fall through to default
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: returnUrl,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (err: any) {
    console.error('[Stripe/Portal] Error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
