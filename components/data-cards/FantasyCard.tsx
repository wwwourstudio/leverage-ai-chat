'use client';

import { memo } from 'react';
import { VBDCard } from './fantasy/VBDCard';
import { WaiverCard } from './fantasy/WaiverCard';
import { DraftCard } from './fantasy/DraftCard';
import { CliffCard } from './fantasy/CliffCard';
import { ProjectionCard } from './fantasy/ProjectionCard';
import { SportOverviewCard } from './fantasy/SportOverviewCard';
import { LegacyCard } from './fantasy/LegacyCard';

interface FantasyCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, any>;
  status: string;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
  isHero?: boolean;
}

/**
 * FantasyCard — thin router that delegates to the appropriate sub-card component.
 * All sub-cards live in components/data-cards/fantasy/ for maintainability.
 */
export const FantasyCard = memo(function FantasyCard(props: FantasyCardProps) {
  const t = props.data?.fantasyCardType as string | undefined;

  let card;
  if (t === 'vbd_rankings')              card = <VBDCard           {...props} />;
  else if (t === 'tier_cliff')           card = <CliffCard         {...props} />;
  else if (t === 'draft_recommendation') card = <DraftCard         {...props} />;
  else if (t === 'waiver')               card = <WaiverCard        {...props} />;
  else if (t === 'projection')           card = <ProjectionCard    {...props} />;
  else if (t === 'sport_overview')       card = <SportOverviewCard {...props} />;
  else                                   card = <LegacyCard        {...props} />;

  return <div className="animate-fade-in-up">{card}</div>;
});
