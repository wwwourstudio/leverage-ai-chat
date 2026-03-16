import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getKalshiClient } from '@/lib/kalshi/kalshiClient';
import type { KalshiOrder } from '@/lib/kalshi/kalshiClient';

// ── Input validation helpers ──────────────────────────────────────────────────

function isValidTicker(s: unknown): s is string {
  return typeof s === 'string' && /^[A-Z0-9\-]+$/.test(s) && s.length <= 80;
}

function isValidAction(s: unknown): s is 'buy' | 'sell' {
  return s === 'buy' || s === 'sell';
}

function isValidSide(s: unknown): s is 'yes' | 'no' {
  return s === 'yes' || s === 'no';
}

function isValidType(s: unknown): s is 'limit' | 'market' {
  return s === 'limit' || s === 'market';
}

/**
 * POST /api/kalshi/trade
 * Place a limit or market order on Kalshi.
 *
 * Request body:
 *   {
 *     ticker:   string  — market ticker (e.g. "NBA-HEAT-WIN-2026-01-15")
 *     action:   'buy' | 'sell'
 *     side:     'yes' | 'no'
 *     quantity: number  — number of contracts (≥1)
 *     price:    number  — limit price in cents (1–99); ignored for market orders
 *     type?:    'limit' | 'market'  (default: 'limit')
 *   }
 *
 * Response: { success, order, dbRecord, error? }
 *
 * Requires:
 * - Active Supabase session
 * - KALSHI_PRIVATE_KEY + KALSHI_API_KEY_ID env vars
 */
export async function POST(request: Request) {
  try {
    // ── Auth guard ────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    // ── Credentials check ─────────────────────────────────────────────────────
    const client = getKalshiClient();
    if (!client.isConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Kalshi trading not configured. Contact support to enable trading.',
          configured: false,
        },
        { status: 503 },
      );
    }

    // ── Parse & validate body ─────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { ticker, action, side, quantity, price, type = 'limit' } = body;

    if (!isValidTicker(ticker)) {
      return NextResponse.json({ success: false, error: 'Invalid ticker' }, { status: 400 });
    }
    if (!isValidAction(action)) {
      return NextResponse.json({ success: false, error: 'action must be "buy" or "sell"' }, { status: 400 });
    }
    if (!isValidSide(side)) {
      return NextResponse.json({ success: false, error: 'side must be "yes" or "no"' }, { status: 400 });
    }
    if (!isValidType(type)) {
      return NextResponse.json({ success: false, error: 'type must be "limit" or "market"' }, { status: 400 });
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json({ success: false, error: 'quantity must be a positive integer' }, { status: 400 });
    }
    if (type === 'limit') {
      if (typeof price !== 'number' || !Number.isInteger(price) || price < 1 || price > 99) {
        return NextResponse.json({ success: false, error: 'price must be an integer between 1 and 99' }, { status: 400 });
      }
    }

    console.log(`[v0] [API/kalshi/trade] POST order: ${action} ${quantity}x ${ticker} ${side} @ ${price}¢ (${type})`);

    // ── Place order via Kalshi ─────────────────────────────────────────────────
    const orderPayload: KalshiOrder = {
      ticker:    ticker as string,
      action:    action as 'buy' | 'sell',
      side:      side   as 'yes' | 'no',
      type:      type   as 'limit' | 'market',
      count:     quantity as number,
      ...(type === 'limit' && side === 'yes' && { yes_price: price as number }),
      ...(type === 'limit' && side === 'no'  && { no_price:  price as number }),
    };

    const kalshiOrder = await client.createOrder(orderPayload);

    // ── Persist to Supabase ───────────────────────────────────────────────────
    const { data: dbRecord, error: dbError } = await supabase
      .from('kalshi_orders')
      .insert({
        user_id:         user.id,
        ticker:          ticker as string,
        kalshi_order_id: kalshiOrder.order_id,
        action:          action as string,
        side:            side   as string,
        quantity:        quantity as number,
        price:           (price as number) ?? 0,
        type:            type   as string,
        status:          kalshiOrder.status,
        filled_count:    kalshiOrder.filled_count,
        remaining_count: kalshiOrder.remaining_count,
      })
      .select()
      .single();

    if (dbError) {
      // Order is placed on Kalshi — log the persistence failure but don't fail the response
      console.error('[v0] [API/kalshi/trade] DB persist error:', dbError.message);
    }

    return NextResponse.json({
      success: true,
      order:    kalshiOrder,
      dbRecord: dbRecord ?? null,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[v0] [API/kalshi/trade] Error:', msg);

    // Classify common Kalshi errors
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return NextResponse.json(
        { success: false, error: 'Rate limit reached. Please wait a moment before placing another order.' },
        { status: 429 },
      );
    }
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
      return NextResponse.json(
        { success: false, error: 'Order rejected by Kalshi. Check your credentials and account status.' },
        { status: 403 },
      );
    }
    if (msg.includes('400') || msg.toLowerCase().includes('bad request')) {
      return NextResponse.json(
        { success: false, error: `Order rejected: ${msg}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/kalshi/trade
 * Cancel a resting order.
 *
 * Request body: { orderId: string }
 *
 * Response: { success, order, error? }
 */
export async function DELETE(request: Request) {
  try {
    // ── Auth guard ────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    const client = getKalshiClient();
    if (!client.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Kalshi trading not configured.', configured: false },
        { status: 503 },
      );
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { orderId } = body;
    if (typeof orderId !== 'string' || !orderId.trim()) {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 });
    }

    // ── Verify the order belongs to this user ─────────────────────────────────
    const { data: dbOrder } = await supabase
      .from('kalshi_orders')
      .select('id, kalshi_order_id, status')
      .eq('kalshi_order_id', orderId)
      .eq('user_id', user.id)
      .single();

    if (!dbOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found or not owned by current user' },
        { status: 404 },
      );
    }

    if (dbOrder.status === 'filled' || dbOrder.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: `Order is already ${dbOrder.status}` },
        { status: 409 },
      );
    }

    console.log(`[v0] [API/kalshi/trade] DELETE order ${orderId}`);

    // ── Cancel on Kalshi ──────────────────────────────────────────────────────
    const result = await client.cancelOrder(orderId);

    // ── Update Supabase ───────────────────────────────────────────────────────
    await supabase
      .from('kalshi_orders')
      .update({ status: 'cancelled' })
      .eq('kalshi_order_id', orderId)
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      order: result.order,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[v0] [API/kalshi/trade] DELETE Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
