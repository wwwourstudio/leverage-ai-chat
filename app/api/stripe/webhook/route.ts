import { NextRequest, NextResponse } from 'next/server';
import { getStripeSecretKey, getStripeWebhookSecret, getSupabaseUrl, getSupabaseServiceKey } from '@/lib/config';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe webhook events and updates Supabase accordingly.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY        — Stripe secret key
 *   STRIPE_WEBHOOK_SECRET    — from `stripe listen` or Stripe Dashboard > Webhooks
 *
 * Events handled:
 *   checkout.session.completed  — subscription activation or one-time credit purchase
 *   customer.subscription.deleted — subscription cancellation
 */
export async function POST(request: NextRequest) {
  const stripeSecretKey = getStripeSecretKey();
  const webhookSecret = getStripeWebhookSecret();

  if (!stripeSecretKey) {
    console.warn('[Stripe/Webhook] STRIPE_SECRET_KEY not configured — ignoring event');
    return NextResponse.json({ received: true });
  }

  let Stripe: any;
  try {
    Stripe = (await import(/* webpackIgnore: true */ 'stripe')).default;
  } catch {
    console.error('[Stripe/Webhook] stripe package not installed');
    return NextResponse.json({ received: true });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-02-25.clover' });

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event: any;
  if (webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
      console.error('[Stripe/Webhook] Signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  } else {
    // No webhook secret configured — parse raw body (dev/test only)
    console.warn('[Stripe/Webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
    try {
      event = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();

  if (!supabaseUrl || !serviceKey) {
    console.warn('[Stripe/Webhook] Supabase not configured — cannot update tier');
    return NextResponse.json({ received: true });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    db: { schema: 'api' },
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const metadata = session.metadata ?? {};
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;

        if (metadata.type === 'subscription' && customerId) {
          // Map plan ID to subscription tier
          const tierMap: Record<string, string> = {
            monthly: 'core',
            annual: 'core',
          };
          const tier = tierMap[metadata.planId] ?? 'core';

          // Try to find user by customer email
          const customerEmail = session.customer_details?.email ?? session.customer_email;
          if (customerEmail) {
            await supabase.from('subscription_tiers').upsert(
              {
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                tier,
                current_period_start: new Date().toISOString(),
                // Approximate period end (Stripe webhook will have exact dates)
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                cancel_at_period_end: false,
              },
              { onConflict: 'stripe_customer_id' }
            );
            console.log(`[Stripe/Webhook] Subscription activated for ${customerEmail} — tier: ${tier}`);
          }
        } else if (metadata.type === 'credits') {
          // One-time credit purchase — increment user_credits balance
          const creditAmount = parseInt(metadata.credits ?? '0', 10);
          const customerEmail = session.customer_details?.email ?? session.customer_email;

          if (creditAmount > 0 && customerEmail) {
            // Look up user id by email via auth schema (service role required)
            // Note: getUserByEmail does not exist; listUsers + filter is the correct approach
            const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 }).catch(() => ({ data: { users: [] } }));
            const userId = (listData?.users ?? []).find((u: { email?: string; id: string }) => u.email === customerEmail)?.id;

            if (userId) {
              await supabase.rpc('increment_user_credits', {
                p_user_id: userId,
                p_amount: creditAmount,
              });
              console.log(`[Stripe/Webhook] Added ${creditAmount} credits for user ${userId}`);
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await supabase
          .from('subscription_tiers')
          .update({ tier: 'free', cancel_at_period_end: true })
          .eq('stripe_subscription_id', subscription.id);
        console.log(`[Stripe/Webhook] Subscription cancelled: ${subscription.id}`);
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (err) {
    console.error('[Stripe/Webhook] Handler error:', err);
    // Still return 200 so Stripe doesn't retry
  }

  return NextResponse.json({ received: true });
}
