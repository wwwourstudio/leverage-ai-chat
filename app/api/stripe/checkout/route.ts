import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for credit purchases or subscriptions.
 *
 * Request body:
 * - type: 'credits' | 'subscription'
 * - amount: number (for credits)
 * - credits: number
 * - planId: string (for subscriptions)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, amount, credits, planId } = body;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    // If Stripe is not configured, fall back to mock mode
    if (!stripeSecretKey) {
      console.log('[Stripe] No STRIPE_SECRET_KEY configured, using mock mode');
      return NextResponse.json({
        success: true,
        mock: true,
        credits: credits || amount || 20,
        message: 'Credits added (mock mode — configure STRIPE_SECRET_KEY for real payments)',
      });
    }

    // Dynamic import of Stripe to avoid build errors when not installed
    let Stripe: any;
    try {
      Stripe = (await import('stripe')).default;
    } catch {
      console.log('[Stripe] stripe package not installed, using mock mode');
      return NextResponse.json({
        success: true,
        mock: true,
        credits: credits || amount || 20,
        message: 'Credits added (mock mode — install stripe package for real payments)',
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    if (type === 'subscription') {
      // Map plan IDs to Stripe Price IDs (set these in your Stripe dashboard)
      const priceMap: Record<string, string> = {
        monthly: process.env.STRIPE_MONTHLY_PRICE_ID || '',
        annual: process.env.STRIPE_ANNUAL_PRICE_ID || '',
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
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}?session_id={CHECKOUT_SESSION_ID}&credits=${credits}`,
        cancel_url: `${origin}?canceled=true`,
        metadata: { type: 'subscription', planId, credits: String(credits) },
      });

      return NextResponse.json({ url: session.url });
    } else {
      // One-time credit purchase
      const unitAmount = Math.max((amount || 10) * 100, 500); // min $5

      const session = await stripe.checkout.sessions.create({
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
        success_url: `${origin}?session_id={CHECKOUT_SESSION_ID}&credits=${credits || amount}`,
        cancel_url: `${origin}?canceled=true`,
        metadata: { type: 'credits', credits: String(credits || amount) },
      });

      return NextResponse.json({ url: session.url });
    }
  } catch (error: any) {
    console.error('[Stripe] Checkout error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Checkout failed' },
      { status: 500 }
    );
  }
}
