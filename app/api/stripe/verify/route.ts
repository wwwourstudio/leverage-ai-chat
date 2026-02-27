import { NextRequest, NextResponse } from 'next/server';
import { getStripeSecretKey } from '@/lib/config';

/**
 * GET /api/stripe/verify?session_id=cs_xxx
 *
 * Verifies a Stripe Checkout session server-side and returns the real
 * credit amount from session metadata — preventing URL-manipulation attacks.
 *
 * Response: { verified: true, credits: number, type: string }
 *         | { verified: false, error: string }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ verified: false, error: 'Missing session_id' }, { status: 400 });
  }

  const stripeSecretKey = getStripeSecretKey();
  if (!stripeSecretKey) {
    // Stripe not configured — trust the URL params (dev/demo mode)
    return NextResponse.json({ verified: false, error: 'Stripe not configured' }, { status: 503 });
  }

  let Stripe: any;
  try {
    Stripe = (await import(/* webpackIgnore: true */ 'stripe')).default;
  } catch {
    return NextResponse.json({ verified: false, error: 'Stripe package not installed' }, { status: 503 });
  }

  try {
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.json({ verified: false, error: 'Payment not completed' });
    }

    const metadata = session.metadata ?? {};
    const credits = parseInt(metadata.credits ?? '0', 10);
    const type = metadata.type ?? 'credits';

    return NextResponse.json({ verified: true, credits, type });
  } catch (err: any) {
    console.error('[Stripe/Verify] Error:', err.message);
    return NextResponse.json({ verified: false, error: err.message }, { status: 500 });
  }
}
