'use client';

import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Shell, PosBadge, type FantasyCardProps } from './shared';

export const CliffCard = memo(function CliffCard({ data, ...p }: FantasyCardProps) {
  const { cliffs = [], description } = data;

  return (
    <Shell {...p} status="alert" Icon={AlertTriangle}>
      {description && (
        <p className="text-xs text-[oklch(0.52_0.01_280)] leading-relaxed">{description}</p>
      )}
      <div className="space-y-2">
        {cliffs.map((c: any, i: number) => {
          const urg = c.urgency ?? 0.5;
          const variant = urg > 0.7
            ? 'border-red-500/35 bg-red-500/6 text-red-400'
            : urg > 0.4
            ? 'border-amber-500/35 bg-amber-500/6 text-amber-400'
            : 'border-blue-500/35 bg-blue-500/6 text-blue-400';
          return (
            <div key={i} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2', variant)}>
              <PosBadge pos={c.pos} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold">
                  Cliff after <span className="font-black">{c.cliffAfterName}</span>
                </span>
              </div>
              <span className="text-sm font-black tabular-nums shrink-0">{c.dropPcts?.toFixed(1)}% ↓</span>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-[oklch(0.35_0.01_280)]">
        Miss these positions and you wait 3–4 rounds for equivalent value.
      </p>
    </Shell>
  );
});
