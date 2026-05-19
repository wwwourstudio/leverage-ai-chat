'use client';

import { memo } from 'react';
import { Trophy, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Shell, type FantasyCardProps } from './shared';

export const SportOverviewCard = memo(function SportOverviewCard({ data, ...p }: FantasyCardProps) {
  const { description, note, features = [], stats = [] } = data;

  return (
    <Shell {...p} status={data.status ?? 'value'} Icon={Trophy}>
      {description && (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">{description}</p>
      )}

      {/* Season stats grid — 2×3 tiles with colored values */}
      {(stats as { label: string; val: string | number; color?: string }[]).length > 0 && (
        <div className={cn(
          'grid gap-1.5',
          stats.length <= 3 ? 'grid-cols-3' : 'grid-cols-3',
        )}>
          {(stats as { label: string; val: string | number; color?: string }[]).map((s, i) => {
            // Cycle through violet/purple/blue for visual variety
            const accentCls = i % 3 === 0
              ? 'text-violet-300'
              : i % 3 === 1
              ? 'text-purple-300'
              : 'text-blue-300';
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-0.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2.5 text-center"
              >
                <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-faint)] leading-tight">{s.label}</span>
                <span className={cn('text-sm font-black tabular-nums leading-tight', s.color ?? accentCls)}>
                  {String(s.val)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Feature list with check icons */}
      {(features as string[]).length > 0 && (
        <div className="space-y-1">
          {(features as string[]).map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] hover:border-violet-500/20 transition-colors">
              <CheckCircle className="w-3 h-3 text-violet-400 shrink-0" />
              <span className="text-[11px] text-[var(--text-muted)]">{f}</span>
            </div>
          ))}
        </div>
      )}

      {note && (
        <p className="text-[10px] text-[var(--text-faint)] leading-relaxed italic border-t border-[var(--border-subtle)] pt-2">
          {note}
        </p>
      )}
    </Shell>
  );
});
