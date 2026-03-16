'use client';

import { memo } from 'react';
import { Trophy } from 'lucide-react';
import { Shell, type FantasyCardProps } from './shared';

export const SportOverviewCard = memo(function SportOverviewCard({ data, ...p }: FantasyCardProps) {
  const { description, note, features = [] } = data;

  return (
    <Shell {...p} status={data.status ?? 'value'} Icon={Trophy}>
      {description && (
        <p className="text-xs text-[oklch(0.52_0.01_280)] leading-relaxed">{description}</p>
      )}
      {(features as string[]).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(features as string[]).map((f, i) => (
            <span key={i} className="px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] text-[oklch(0.55_0.01_280)]">
              {f}
            </span>
          ))}
        </div>
      )}
      {note && (
        <p className="text-[10px] text-[oklch(0.42_0.01_280)] leading-relaxed italic">{note}</p>
      )}
    </Shell>
  );
});
