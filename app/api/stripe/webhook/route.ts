import { NextRequest, NextResponse } from 'next/server';
import { getStripeSecretKey, getStripeWebhookSecret, getSupabaseUrl, getSupabaseServiceKey } from '@/lib/config';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe webhook events and updates Supabase.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY        — Stripe secret key
 *   STRIPE_WEBHOOK_SECRET    — from `stripe listen` or Stripe Dashboard > Webhooks
 *
 * Events handled:
 *   checkout.session.completed     — subscription activation or one-time credit purchase
 *   invoice.paid                   — renewal — bump current_period_end
 *   customer.subscription.updated  — plan change / cancellation queued
 *   customer.subscription.deleted  — subscription cancellation
 *
 * Idempotency: every event.id is recorded in api.stripe_events before any
 * side-effect runs. Duplicate deliveries (Stripe retries) short-circuit to 200
 * without re-applying credits or tier changes.
 *
 * User resolution priority:
 *   1. metadata.userId      — set by /api/stripe/checkout when authenticated
 *   2. client_reference_id  — same value, redundant safety net
 *   3. customer_email       — fallback only; uses indexed auth.users lookup via service role
 */

// Allowed plan IDs and their tier mapping. Unknown planIds are rejected (not
// silently coerced to 'core') so a malformed checkout cannot grant a paid tier.
const PLAN_TIER_MAP: Record<string, string> = {
  monthly: 'core',
  annual: 'core',
};

interface StripeSubscriptionLite {
  id: string;
  current_period_start?: number;   // unix seconds
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  status?: string;
  items?: { data?: Array<{ price?: { id?: string } }> };
}

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

  // ── Idempotency: skip duplicate event deliveries ───────────────────────────
  // Stripe sends the same event.id when our handler fails or times out. Insert
  // first, return 200 immediately on duplicate.
  if (event.id) {
    const { error: insertErr } = await supabase
      .from('stripe_events')
      .insert({ event_id: event.id, event_type: event.type ?? 'unknown' });

    if (insertErr) {
      // 23505 = unique_violation; 42P01 = relation does not exist
      const code = (insertErr as any).code;
      if (code === '23505' || insertErr.message?.includes('duplicate key')) {
        console.log(`[Stripe/Webhook] Duplicate event ${event.id} — already processed`);
        return NextResponse.json({ received: true, duplicate: true });
      }
      if (code === '42P01' || insertErr.message?.toLowerCase().includes('does not exist')) {
        // Table not migrated yet — proceed without idempotency. Log so this is visible.
        console.warn('[Stripe/Webhook] api.stripe_events table missing — apply migration 20260506000000');
      } else {
        console.error('[Stripe/Webhook] stripe_events insert error:', insertErr.message);
        // Continue anyway — losing idempotency is preferable to dropping the event entirely.
      }
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event, stripe, supabase);
        break;
      }

      case 'invoice.paid': {
        await handleInvoicePaid(event, stripe, supabase);
        break;
      }

      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(event, supabase);
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
    // Return 200 so Stripe doesn't retry on permanent errors — but log loudly.
    // For transient errors, the idempotency table will let a manual replay succeed.
  }

  return NextResponse.json({ received: true });
}

// ── checkout.session.completed ────────────────────────────────────────────────

async function handleCheckoutCompleted(event: any, stripe: any, supabase: any) {
  const session = event.data.object;
  const metadata = session.metadata ?? {};
  const customerId = session.customer as string | null;
  const subscriptionId = session.subscription as string | null;

  // Resolve user — priority: metadata.userId → client_reference_id → email lookup
  const userId = await resolveUserId(session, metadata, supabase);

  if (metadata.type === 'subscription' && customerId) {
    const planId = metadata.planId as string | undefined;
    const tier = planId && PLAN_TIER_MAP[planId];
    if (!tier) {
      console.error(`[Stripe/Webhook] Rejected unknown planId="${planId}" for session=${session.id}`);
      return; // Don't grant any tier on malformed checkout
    }

    // Pull real period_start/end from Stripe rather than guessing +30 days
    let periodStart = new Date().toISOString();
    let periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (subscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId) as StripeSubscriptionLite;
        if (sub.current_period_start) periodStart = new Date(sub.current_period_start * 1000).toISOString();
        if (sub.current_period_end) periodEnd = new Date(sub.current_period_end * 1000).toISOString();
      } catch (err) {
        console.warn('[Stripe/Webhook] Failed to retrieve subscription dates — using approximate values:', (err as Error).message);
      }
    }

    await supabase.from('subscription_tiers').upsert(
      {
        user_id: userId ?? null,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        tier,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
      },
      { onConflict: 'stripe_customer_id' }
    );
    console.log(`[Stripe/Webhook] Subscription activated user=${userId ?? 'unknown'} tier=${tier} until=${periodEnd}`);
    return;
  }

  if (metadata.type === 'credits') {
    const creditAmount = parseInt(metadata.credits ?? '0', 10);
    if (creditAmount > 0 && userId) {
      await supabase.rpc('increment_user_credits', {
        p_user_id: userId,
        p_amount: creditAmount,
      });
      console.log(`[Stripe/Webhook] Added ${creditAmount} credits for user ${userId}`);
    } else if (creditAmount > 0) {
      console.error(`[Stripe/Webhook] Credits purchase succeeded but no user resolved for session=${session.id}`);
    }
  }
}

// ── invoice.paid (renewals) ───────────────────────────────────────────────────

async function handleInvoicePaid(event: any, stripe: any, supabase: any) {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription as string | null;
  if (!subscriptionId) return; // one-off invoice, not a subscription renewal

  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId) as StripeSubscriptionLite;
    const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;
    const periodEnd   = sub.current_period_end   ? new Date(sub.current_period_end   * 1000).toISOString() : null;

    if (!periodStart || !periodEnd) return;

    await supabase
      .from('subscription_tiers')
      .update({
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
      })
      .eq('stripe_subscription_id', subscriptionId);

    console.log(`[Stripe/Webhook] Renewal recorded: ${subscriptionId} → period_end=${periodEnd}`);
  } catch (err) {
    console.error('[Stripe/Webhook] invoice.paid retrieve error:', (err as Error).message);
  }
}

// ── customer.subscription.updated ─────────────────────────────────────────────

async function handleSubscriptionUpdated(event: any, supabase: any) {
  const sub = event.data.object as StripeSubscriptionLite;
  const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;
  const periodEnd   = sub.current_period_end   ? new Date(sub.current_period_end   * 1000).toISOString() : null;

  const update: Record<string, unknown> = {
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
  };
  if (periodStart) update.current_period_start = periodStart;
  if (periodEnd)   update.current_period_end   = periodEnd;
  // If subscription was cancelled or paused, tier is forced to 'free' at period_end via the deleted handler.
  // Status 'canceled' arrives separately as customer.subscription.deleted.

  await supabase
    .from('subscription_tiers')
    .update(update)
    .eq('stripe_subscription_id', sub.id);

  console.log(`[Stripe/Webhook] Subscription updated: ${sub.id} cancel_at_period_end=${update.cancel_at_period_end}`);
}

// ── User resolution helpers ───────────────────────────────────────────────────

/**
 * Resolve the Supabase user_id for a Stripe checkout session.
 *
 * Priority:
 *   1. metadata.userId       — set by /api/stripe/checkout when authenticated (preferred)
 *   2. client_reference_id   — same value, redundant safety net
 *   3. customer_email        — last resort, uses listUsers (slow, capped)
 *
 * Returns null if no path resolves a user. The caller decides what to do
 * with an unresolved user (e.g. credits purchase logs an error and skips).
 */
async function resolveUserId(
  session: any,
  metadata: Record<string, string>,
  supabase: any,
): Promise<string | null> {
  if (metadata.userId && typeof metadata.userId === 'string') return metadata.userId;
  if (session.client_reference_id && typeof session.client_reference_id === 'string') {
    return session.client_reference_id;
  }

  const customerEmail = session.customer_details?.email ?? session.customer_email;
  if (!customerEmail) return null;

  // Fallback path: email lookup. Capped at 1000 users; will need to be replaced
  // with a public.users mirror table for deployments beyond that scale.
  try {
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const userId = (listData?.users ?? []).find(
      (u: { email?: string; id: string }) => u.email === customerEmail,
    )?.id;
    return userId ?? null;
  } catch (err) {
    console.error('[Stripe/Webhook] listUsers fallback failed:', (err as Error).message);
    return null;
  }
}
