import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeSecretKey, getStripeMonthlyPriceId, getStripeAnnualPriceId } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Embedded Checkout session and returns a clientSecret
 * for the frontend to render the in-app Stripe form.
 *
 * Request body:
 * - type: 'credits' | 'subscription'
 * - amount: number (for credits, in dollars)
 * - credits: number
 * - planId: string (for subscriptions: 'monthly' | 'annual')
 * - customer_email?: string
 *
 * The authenticated Supabase user is read from the request cookies and
 * attached to the Stripe session as both `client_reference_id` and
 * `metadata.userId` so the webhook can identify the user without an
 * email→user lookup (which is expensive and capped at 1000 users).
 *
 * Response (real mode): { clientSecret: string }
 * Response (mock mode):  { success: true, mock: true, credits: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, amount, credits, planId, customer_email } = body;

    const stripeSecretKey = getStripeSecretKey();

    if (!stripeSecretKey) {
      console.log('[Stripe] No STRIPE_SECRET_KEY configured, using mock mode');
      return NextResponse.json({
        success: true,
        mock: true,
        credits: credits || amount || 20,
        message: 'Credits added (mock mode — configure STRIPE_SECRET_KEY for real payments)',
      });
    }

    // Resolve authenticated user (if any) so the webhook can identify them
    // directly from session metadata instead of doing an email→user lookup.
    let userId: string | null = null;
    let userEmail: string | undefined;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = user.email ?? undefined;
      }
    } catch {
      // Auth lookup failed — proceed as guest checkout (email-only resolution)
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-02-25.clover' });
    // Build return_url from a trusted server-side source, not the client-controlled
    // origin header (which can be forged to redirect users to an attacker domain).
    const siteBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://leverageai.app';
    const returnUrl = `${siteBase}?session_id={CHECKOUT_SESSION_ID}`;

    const sharedSessionFields = {
      ui_mode: 'embedded' as const,
      customer_email: customer_email || userEmail || undefined,
      allow_promotion_codes: true,
      return_url: returnUrl,
      ...(userId ? { client_reference_id: userId } : {}),
    };

    if (type === 'subscription') {
      const priceMap: Record<string, string> = {
        monthly: getStripeMonthlyPriceId() || '',
        annual: getStripeAnnualPriceId() || '',
      };

      const priceId = priceMap[planId || 'monthly'];
      if (!priceId) {
        return NextResponse.json({
          success: true,
          mock: true,
          credits: credits || 20,
          message: 'Credits added (mock mode — configure STRIPE_MONTHLY_PRICE_ID/STRIPE_ANNUAL_PRICE_ID)',
        });
      }

      const session = await stripe.checkout.sessions.create({
        ...sharedSessionFields,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
          type: 'subscription',
          planId,
          credits: String(credits ?? ''),
          ...(userId ? { userId } : {}),
        },
      });

      return NextResponse.json({ clientSecret: session.client_secret });
    } else {
      // One-time credit purchase
      const unitAmount = Math.max((amount || 10) * 100, 500); // min $5

      const session = await stripe.checkout.sessions.create({
        ...sharedSessionFields,
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${credits || amount} Leverage AI Credits`,
                description: `${credits || amount} AI analysis credits for Leverage AI`,
              },
              unit_amount: unitAmount,
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: 'credits',
          credits: String(credits || amount),
          ...(userId ? { userId } : {}),
        },
      });

      return NextResponse.json({ clientSecret: session.client_secret });
    }
  } catch (error: any) {
    console.error('[Stripe] Checkout error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Checkout failed' },
      { status: 500 }
    );
  }
}
