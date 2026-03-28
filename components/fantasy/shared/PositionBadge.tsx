'use client';

import { cn } from '@/lib/utils';

const POSITION_COLORS: Record<string, string> = {
  // NFL
  QB:        'bg-red-500/20 text-red-400 border-red-500/30',
  RB:        'bg-blue-500/20 text-blue-400 border-blue-500/30',
  WR:        'bg-blue-500/20 text-blue-400 border-blue-500/30',
  TE:        'bg-orange-500/20 text-orange-400 border-orange-500/30',
  K:         'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DEF:       'bg-slate-500/20 text-slate-400 border-slate-500/30',
  FLEX:      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  SUPERFLEX: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  // MLB — pitchers
  SP:        'bg-violet-500/20 text-violet-400 border-violet-500/30',
  RP:        'bg-violet-500/20 text-violet-400 border-violet-500/30',
  P:         'bg-violet-500/20 text-violet-400 border-violet-500/30',
  // MLB — infield
  '1B':      'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  '2B':      'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  '3B':      'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  SS:        'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  // MLB — outfield / DH
  OF:        'bg-violet-500/20 text-violet-400 border-violet-500/30',
  DH:        'bg-blue-500/20 text-blue-400 border-blue-500/30',
  // NBA
  PG:        'bg-orange-500/20 text-orange-400 border-orange-500/30',
  SG:        'bg-orange-500/20 text-orange-400 border-orange-500/30',
  SF:        'bg-amber-500/20 text-amber-400 border-amber-500/30',
  PF:        'bg-amber-500/20 text-amber-400 border-amber-500/30',
  G:         'bg-orange-500/20 text-orange-400 border-orange-500/30',
  F:         'bg-amber-500/20 text-amber-400 border-amber-500/30',
  C:         'bg-rose-500/20 text-rose-400 border-rose-500/30',
  UTIL:      'bg-sky-500/20 text-sky-400 border-sky-500/30',
};

interface PositionBadgeProps {
  position: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PositionBadge({ position, size = 'md', className }: PositionBadgeProps) {
  const colors = POSITION_COLORS[position] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30';

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
        className,
      )}
    >
      {position}
    </span>
  );
}
