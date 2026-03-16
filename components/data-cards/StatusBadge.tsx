'use client';

import { cn } from '@/lib/utils';
import { STATUS_BADGE_CONFIG, type StatusBadgeKey } from '@/lib/constants';

interface StatusBadgeProps {
  status: string;
  className?: string;
  /** Use inline variant (dot + text only, no pill background) */
  inline?: boolean;
}

/**
 * Shared status badge used across all data cards.
 * Reads from STATUS_BADGE_CONFIG in lib/constants for a single source of truth.
 */
export function StatusBadge({ status, className, inline = false }: StatusBadgeProps) {
  const cfg = STATUS_BADGE_CONFIG[status as StatusBadgeKey] ?? STATUS_BADGE_CONFIG.value;

  if (inline) {
    return (
      <span className={cn('flex items-center gap-1', className)}>
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
          style={{ backgroundColor: cfg.dot }}
        />
        <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.text)}>
          {cfg.label}
        </span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider',
        cfg.bg,
        cfg.border,
        cfg.text,
        className,
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
        style={{ backgroundColor: cfg.dot }}
      />
      {cfg.label}
    </div>
  );
}
