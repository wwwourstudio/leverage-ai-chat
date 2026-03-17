'use client';

import { memo } from 'react';
import { Trophy, CheckCircle } from 'lucide-react';
import { Shell, type FantasyCardProps } from './shared';

export const SportOverviewCard = memo(function SportOverviewCard({ data, ...p }: FantasyCardProps) {
  const { description, note, features = [], stats = [] } = data;

  return (
    <Shell {...p} status={data.status ?? 'value'} Icon={Trophy}>
      {description && (
        <p className="text-xs text-[oklch(0.52_0.01_280)] leading-relaxed">{description}</p>
      )}

      {/* Numeric stat grid (e.g. totalPlayers, avgVBD, etc.) */}
      {(stats as { label: string; val: string | number }[]).length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {(stats as { label: string; val: string | number }[]).map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] py-2.5">
              <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">{s.label}</span>
              <span className="text-sm font-black text-white tabular-nums">{String(s.val)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Feature list with check icons */}
      {(features as string[]).length > 0 && (
        <div className="space-y-1">
          {(features as string[]).map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[oklch(0.08_0.01_280)] border border-[oklch(0.14_0.01_280)]">
              <CheckCircle className="w-3 h-3 text-teal-400 shrink-0" />
              <span className="text-[11px] text-[oklch(0.55_0.01_280)]">{f}</span>
            </div>
          ))}
        </div>
      )}

      {note && (
        <p className="text-[10px] text-[oklch(0.42_0.01_280)] leading-relaxed italic border-t border-[oklch(0.14_0.01_280)] pt-2">
          {note}
        </p>
      )}
    </Shell>
  );
});
