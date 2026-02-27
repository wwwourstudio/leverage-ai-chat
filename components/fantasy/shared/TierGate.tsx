'use client';

import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SubscriptionTier, FantasyFeature } from '@/lib/fantasy/types';
import { hasFeatureAccess } from '@/lib/fantasy/types';

interface TierGateProps {
  tier: SubscriptionTier;
  requiredFeature: FantasyFeature;
  children: ReactNode;
  featureLabel?: string;
  onUpgradeClick?: () => void;
}

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  core: 'Core ($49/mo)',
  pro: 'Pro ($149/mo)',
  high_stakes: 'High Stakes ($999/yr)',
};

function getMinimumTier(feature: FantasyFeature): SubscriptionTier {
  const tiers: SubscriptionTier[] = ['free', 'core', 'pro', 'high_stakes'];
  for (const tier of tiers) {
    if (hasFeatureAccess(tier, feature)) return tier;
  }
  return 'high_stakes';
}

export function TierGate({ tier, requiredFeature, children, featureLabel, onUpgradeClick }: TierGateProps) {
  if (hasFeatureAccess(tier, requiredFeature)) {
    return <>{children}</>;
  }

  const minimumTier = getMinimumTier(requiredFeature);

  return (
    <Card className="border-dashed border-yellow-500/30 bg-yellow-500/5">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-2 text-2xl">&#128274;</div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          {featureLabel || 'Premium Feature'}
        </h3>
        <p className="mb-4 max-w-md text-sm text-muted-foreground">
          This feature requires {TIER_LABELS[minimumTier]} or higher.
          Upgrade to unlock advanced analytics and AI-powered tools.
        </p>
        <Button variant="default" size="sm" onClick={onUpgradeClick}>
          Upgrade to {TIER_LABELS[minimumTier]}
        </Button>
      </CardContent>
    </Card>
  );
}
