'use client';

import { memo } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Shell, PosBadge, type FantasyCardProps } from './shared';

/** Visual drop-percentage bar */
function DropBar({ pct }: { pct: number }) {
  const capped = Math.min(100, pct);
  const barCls = pct > 40
    ? 'bg-gradient-to-r from-red-500 to-rose-400'
    : pct > 20
    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
    : 'bg-gradient-to-r from-blue-500 to-cyan-400';
  return (
    <div className="mt-1.5 space-y-0.5">
      <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', barCls)} style={{ width: `${capped}%` }} />
      </div>
    </div>
  );
}

export const CliffCard = memo(function CliffCard({ data, ...p }: FantasyCardProps) {
  const { cliffs = [], description } = data;
  const hasCliffs = cliffs.length > 0;

  return (
    <Shell {...p} status="alert" Icon={AlertTriangle}>
      {/* CLIFF DETECTED / SAFE hero badge */}
      <div className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border',
        hasCliffs
          ? 'bg-red-500/8 border-red-500/30'
          : 'bg-emerald-500/8 border-emerald-500/30',
      )}>
        {hasCliffs ? (
          <>
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <div>
              <p className="text-xs font-black text-red-300 uppercase tracking-widest">Cliff Detected</p>
              <p className="text-[9px] text-red-400/70 mt-0.5">{cliffs.length} position tier{cliffs.length > 1 ? 's' : ''} at risk</p>
            </div>
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-black text-emerald-300 uppercase tracking-widest">Safe Zone</p>
              <p className="text-[9px] text-emerald-400/70 mt-0.5">No critical tier cliffs detected</p>
            </div>
          </>
        )}
      </div>

      {description && (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">{description}</p>
      )}

      {/* Cliff rows */}
      <div className="space-y-2">
        {cliffs.map((c: any, i: number) => {
          const urg = c.urgency ?? 0.5;
          const dropPct: number = c.dropPcts ?? c.dropPct ?? 0;
          const variant = urg > 0.7
            ? 'border-red-500/35 bg-red-500/6 text-red-400'
            : urg > 0.4
            ? 'border-amber-500/35 bg-amber-500/6 text-amber-400'
            : 'border-blue-500/35 bg-blue-500/6 text-blue-400';
          return (
            <div key={i} className={cn('rounded-xl border px-3 py-2.5', variant)}>
              <div className="flex items-center gap-3">
                <PosBadge pos={c.pos} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold">
                    Cliff after <span className="font-black">{c.cliffAfterName}</span>
                  </span>
                </div>
                {/* Drop percentage as large chip */}
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-base font-black tabular-nums leading-none">
                    {dropPct.toFixed(1)}%
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">drop</span>
                </div>
              </div>
              <DropBar pct={dropPct} />
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-[var(--text-faint)] border-t border-[var(--border-subtle)] pt-2">
        Miss these positions and you wait 3–4 rounds for equivalent value.
      </p>
    </Shell>
  );
});
