import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/user/subscription
 *
 * Returns the authenticated user's current subscription tier and period info.
 * Used by StripeLightbox to show "X days remaining" and the Manage button.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: true, tier: 'free', periodEnd: null, cancelAtPeriodEnd: false });
    }

    const { data } = await supabase
      .from('subscription_tiers')
      .select('tier, current_period_end, cancel_at_period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      tier: data?.tier ?? 'free',
      periodEnd: data?.current_period_end ?? null,
      cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
    });
  } catch (err) {
    console.error('[API/user/subscription] Error:', err);
    return NextResponse.json({ success: true, tier: 'free', periodEnd: null, cancelAtPeriodEnd: false });
  }
}
