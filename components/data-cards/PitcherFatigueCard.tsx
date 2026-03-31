'use client';

import { Wind, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PitcherFatigueData {
  pitcherName?: string;
  fatigueMultiplier?: string | number;
  fatigueLabel?: 'fresh' | 'normal' | 'tired' | 'at-risk';
  pitchCountLastStart?: string | number;
  inningsLastStart?: string | number;
  daysRest?: string | number;
  pitchCountLast7Days?: string | number;
  bettingImpact?: string;
  description?: string;
  note?: string;
}

interface PitcherFatigueCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: PitcherFatigueData;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

const LABEL_STYLES = {
  fresh:    { bar: 'bg-emerald-500', text: 'text-emerald-300', badge: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
  normal:   { bar: 'bg-blue-500',    text: 'text-blue-300',    badge: 'bg-blue-500/15    border-blue-500/40    text-blue-300'    },
  tired:    { bar: 'bg-amber-500',   text: 'text-amber-300',   badge: 'bg-amber-500/15   border-amber-500/40   text-amber-300'   },
  'at-risk':{ bar: 'bg-red-500',     text: 'text-red-400',     badge: 'bg-red-500/15     border-red-500/40     text-red-400'     },
};

export function PitcherFatigueCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  onAnalyze,
  isHero,
}: PitcherFatigueCardProps) {
  const label = data.fatigueLabel ?? 'normal';
  const styles = LABEL_STYLES[label] ?? LABEL_STYLES.normal;
  const multiplier = Number(data.fatigueMultiplier ?? 1);
  // Map 0.80–1.50 multiplier range to 0–100% bar
  const barPct = Math.min(100, Math.max(0, ((multiplier - 0.80) / 0.70) * 100));

  const pitchCount = Number(data.pitchCountLastStart ?? 0);
  const daysRest   = Number(data.daysRest ?? 4);
  const isHighCount  = pitchCount > 105;
  const isShortRest  = daysRest > 0 && daysRest <= 3;
  const recText =
    label === 'at-risk' ? 'Avoid in DFS — high fatigue, decline likely'
    : label === 'tired'  ? 'Fade K/IP overs — reduced velocity expected'
    : label === 'normal' ? 'Standard projection applies'
    : 'Favorable start — target in DFS & parlays';
  const recColors =
    label === 'at-risk' ? 'bg-red-500/10 border-red-500/20 text-red-300'
    : label === 'tired'  ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border transition-all duration-200 animate-fade-in-up',
        'border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)]',
        isHero && 'sm:rounded-3xl',
      )}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} aria-hidden="true" />

      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Wind className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">{category}</span>
              <span className="text-[oklch(0.3_0.01_280)] mx-1.5">/</span>
              <span className="text-[10px] font-medium text-[oklch(0.45_0.01_280)]">{subcategory}</span>
              <h3 className="text-sm font-black text-[oklch(0.92_0.005_85)] mt-1 leading-snug">{title}</h3>
            </div>
          </div>

          <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border shrink-0', styles.badge)}>
            {label}
          </span>
        </div>

        {/* Fatigue bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5 text-[10px]">
            <span className="text-[oklch(0.45_0.01_280)]">Fatigue Level</span>
            <span className={cn('font-black tabular-nums', styles.text)}>
              {multiplier.toFixed(2)}×
            </span>
          </div>
          <div className="h-2 rounded-full bg-[oklch(0.18_0.015_280)] overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', styles.bar)}
              style={{ width: `${barPct}%` }}
              role="meter"
              aria-valuenow={barPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="flex justify-between text-[8px] text-[oklch(0.38_0.01_280)] mt-1">
            <span>Fresh</span>
            <span>At Risk</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {data.pitchCountLastStart !== undefined && (
            <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">Last Start</p>
              <p className="text-base font-black tabular-nums text-[oklch(0.85_0.005_85)]">{data.pitchCountLastStart} P</p>
            </div>
          )}
          {data.daysRest !== undefined && (
            <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">Days Rest</p>
              <p className="text-base font-black tabular-nums text-[oklch(0.85_0.005_85)]">{data.daysRest}d</p>
            </div>
          )}
          {data.inningsLastStart !== undefined && (
            <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">Innings</p>
              <p className="text-base font-black tabular-nums text-[oklch(0.85_0.005_85)]">{data.inningsLastStart} IP</p>
            </div>
          )}
          {data.pitchCountLast7Days !== undefined && (
            <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">7-Day Pitches</p>
              <p className="text-base font-black tabular-nums text-[oklch(0.85_0.005_85)]">{data.pitchCountLast7Days}</p>
            </div>
          )}
        </div>

        {/* Warning flags */}
        {(isHighCount || isShortRest) && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 mb-2 space-y-0.5">
            {isHighCount && (
              <p className="text-[10px] text-amber-300 font-semibold">⚠ High pitch count ({pitchCount}) — velocity/command risk</p>
            )}
            {isShortRest && (
              <p className="text-[10px] text-amber-300 font-semibold">⚠ Short rest ({daysRest}d) — monitor lineup/scratch</p>
            )}
          </div>
        )}

        {/* Action recommendation */}
        <div className={cn('rounded-lg px-3 py-2 text-[10px] font-semibold mb-2 border', recColors)}>
          {recText}
        </div>

        {/* Betting impact */}
        {data.bettingImpact && (
          <p className="text-[11px] text-[oklch(0.60_0.01_280)] leading-relaxed">{data.bettingImpact}</p>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-[oklch(0.85_0.005_85)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
          >
            Full Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
