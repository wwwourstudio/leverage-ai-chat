import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getKalshiClient } from '@/lib/kalshi/kalshiClient';

/**
 * GET /api/kalshi/portfolio
 * Returns the authenticated user's Kalshi portfolio: balance, positions, and local order history.
 *
 * Requires:
 * - Active Supabase session (user must be signed in)
 * - KALSHI_PRIVATE_KEY + KALSHI_API_KEY_ID env vars (server-level credentials)
 *
 * Response:
 *   { success: true, balance, positions, orders, timestamp }
 */
export async function GET() {
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
          error: 'Kalshi API credentials not configured. Set KALSHI_PRIVATE_KEY and KALSHI_API_KEY_ID.',
          configured: false,
        },
        { status: 503 },
      );
    }

    // ── Fetch from Kalshi in parallel ─────────────────────────────────────────
    const [balanceResult, positionsResult] = await Promise.allSettled([
      client.getBalance(),
      client.getPositions(),
    ]);

    const balance = balanceResult.status === 'fulfilled'
      ? balanceResult.value
      : null;

    const positions = positionsResult.status === 'fulfilled'
      ? positionsResult.value.positions
      : [];

    if (balanceResult.status === 'rejected') {
      console.error('[v0] [API/kalshi/portfolio] Balance fetch failed:', balanceResult.reason);
    }
    if (positionsResult.status === 'rejected') {
      console.error('[v0] [API/kalshi/portfolio] Positions fetch failed:', positionsResult.reason);
    }

    // ── Local order history from Supabase ─────────────────────────────────────
    const { data: orders, error: dbError } = await supabase
      .from('kalshi_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (dbError) {
      console.error('[v0] [API/kalshi/portfolio] DB query error:', dbError.message);
    }

    return NextResponse.json({
      success: true,
      balance,
      positions,
      orders: orders ?? [],
      configured: true,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[v0] [API/kalshi/portfolio] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
