import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeSecretKey, getStripeMonthlyPriceId, getStripeAnnualPriceId } from '@/lib/config';

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

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    // After embedded checkout completes, Stripe redirects to return_url
    const returnUrl = `${origin}?session_id={CHECKOUT_SESSION_ID}`;

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
        ui_mode: 'embedded',
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: customer_email || undefined,
        allow_promotion_codes: true,
        return_url: returnUrl,
        metadata: { type: 'subscription', planId, credits: String(credits) },
      });

      return NextResponse.json({ clientSecret: session.client_secret });
    } else {
      // One-time credit purchase
      const unitAmount = Math.max((amount || 10) * 100, 500); // min $5

      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
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
        customer_email: customer_email || undefined,
        allow_promotion_codes: true,
        return_url: returnUrl,
        metadata: { type: 'credits', credits: String(credits || amount) },
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
