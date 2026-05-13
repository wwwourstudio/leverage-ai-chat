'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface UnifiedCardShellProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}

export function UnifiedCardShell({ children, className, interactive = false }: UnifiedCardShellProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--ui-radius-card)] border border-[var(--ui-card-border)] bg-[var(--ui-card-bg)] shadow-[var(--ui-shadow-card)]',
        interactive && 'transition-all duration-[var(--duration-fast)] hover:border-[var(--ui-card-border-hover)] hover:shadow-[var(--ui-shadow-elevated)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
