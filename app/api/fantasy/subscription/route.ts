import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';
import { hasFeatureAccess } from '@/lib/fantasy/types';
import type { SubscriptionTier, FantasyFeature } from '@/lib/fantasy/types';

// ============================================================================
// GET /api/fantasy/subscription — Get user's subscription tier
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    const { data: subscription } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const tier: SubscriptionTier = (subscription?.tier as SubscriptionTier) || 'free';

    // Check feature access for common features
    const featureChecks: FantasyFeature[] = [
      'draft_assistant_basic',
      'draft_simulation',
      'opponent_modeling',
      'faab_optimizer',
      'win_probability_realtime',
      'injury_alerts_realtime',
      'dfs_optimizer_basic',
      'dfs_optimizer_full',
      'hedge_fund_mode',
      'bankroll_management',
      'api_access',
    ];

    const features: Record<string, boolean> = {};
    for (const feature of featureChecks) {
      features[feature] = hasFeatureAccess(tier, feature);
    }

    return NextResponse.json({
      success: true,
      tier,
      status: subscription?.status || 'active',
      periodEnd: subscription?.current_period_end || null,
      features,
    });
  } catch (error) {
    console.error('[API/fantasy/subscription] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
