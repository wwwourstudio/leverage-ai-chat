'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface UnifiedCardShellProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  /** Card status — drives the glow border color on dark backgrounds */
  status?: string;
  /** Apply spring card-enter animation */
  animate?: boolean;
}

const STATUS_GLOW: Record<string, string> = {
  hot:     'card-hot     animate-ember-burst',
  value:   'card-value   animate-value-glow',
  optimal: 'card-optimal animate-optimal-glow',
  arb:     'card-arb     animate-arb-flash',
  live:    'card-live animate-live-glow',
};

export function UnifiedCardShell({
  children,
  className,
  interactive = false,
  status,
  animate = false,
}: UnifiedCardShellProps) {
  const glowClass = status ? (STATUS_GLOW[status.toLowerCase()] ?? '') : '';

  return (
    <div
      className={cn(
        'rounded-[var(--ui-radius-card)] border border-[var(--ui-card-border)] bg-[var(--ui-card-bg)] shadow-[var(--ui-shadow-card)] overflow-hidden',
        interactive && 'card-interactive',
        animate && 'animate-card-enter-spring',
        glowClass,
        className,
      )}
    >
      {children}
    </div>
  );
}
