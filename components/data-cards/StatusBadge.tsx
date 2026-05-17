'use client';

import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
  showDot?: boolean;
}

const BADGE_CLASS: Record<string, string> = {
  hot:     'status-badge status-badge-hot',
  value:   'status-badge status-badge-value',
  optimal: 'status-badge status-badge-optimal',
  edge:    'status-badge status-badge-edge',
  arb:     'status-badge status-badge-arb',
  live:    'status-badge status-badge-live',
  neutral: 'status-badge status-badge-neutral',
};

const DOT_CLASS: Record<string, string> = {
  hot:     'hot-dot',
  live:    'live-dot',
};

const LABEL: Record<string, string> = {
  hot:       'HOT',
  value:     'VALUE',
  optimal:   'OPTIMAL',
  edge:      'EDGE',
  arb:       'ARB',
  live:      'LIVE',
  neutral:   'NEUTRAL',
  target:    'TARGET',
  elite:     'ELITE',
  sleeper:   'SLEEPER',
  favorable: 'FAVORABLE',
  alert:     'ALERT',
};

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const key = status?.toLowerCase() ?? 'neutral';
  const badgeClass = BADGE_CLASS[key] ?? 'status-badge status-badge-neutral';
  const dotClass = showDot ? (DOT_CLASS[key] ?? null) : null;
  const label = LABEL[key] ?? status?.toUpperCase() ?? 'NEUTRAL';

  return (
    <span className={cn(badgeClass, className)}>
      {dotClass && <span className={dotClass} aria-hidden="true" />}
      {label}
    </span>
  );
}
