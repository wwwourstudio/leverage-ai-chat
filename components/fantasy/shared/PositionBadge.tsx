'use client';

import { cn } from '@/lib/utils';

const POSITION_COLORS: Record<string, string> = {
  QB: 'bg-red-500/20 text-red-400 border-red-500/30',
  RB: 'bg-green-500/20 text-green-400 border-green-500/30',
  WR: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  TE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  K: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DEF: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  FLEX: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

interface PositionBadgeProps {
  position: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PositionBadge({ position, size = 'md', className }: PositionBadgeProps) {
  const colors = POSITION_COLORS[position] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md border font-bold tracking-wide',
        colors,
        sizeClasses[size],
        className
      )}
    >
      {position}
    </span>
  );
}
