'use client';

import { Shield, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CatcherFramingData {
  catcherName?: string;
  framingTier?: 'elite' | 'above-avg' | 'average' | 'below-avg';
  framingRunsAboveAverage?: string | number;
  calledStrikeConversionDelta?: string | number;
  koPropImpact?: string | number;
  walkPropImpact?: string | number;
  pitcherEraImpact?: string | number;
  signal?: string;
  description?: string;
  note?: string;
}

interface CatcherFramingCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: CatcherFramingData;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

const TIER_STYLES = {
  'elite':     { badge: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300', bar: 'bg-emerald-500', label: 'Elite Framer'    },
  'above-avg': { badge: 'bg-blue-500/15    border-blue-500/40    text-blue-300',    bar: 'bg-blue-500',    label: 'Above Average'  },
  'average':   { badge: 'bg-slate-500/10   border-slate-500/30   text-slate-400',   bar: 'bg-slate-500',   label: 'Average'        },
  'below-avg': { badge: 'bg-red-500/15     border-red-500/40     text-red-400',     bar: 'bg-red-500',     label: 'Below Average'  },
};

export function CatcherFramingCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  onAnalyze,
  isHero,
}: CatcherFramingCardProps) {
  const tier = data.framingTier ?? 'average';
  const styles = TIER_STYLES[tier] ?? TIER_STYLES.average;
  const fRAA = Number(data.framingRunsAboveAverage ?? 0);
  const kImpact  = Number(data.koPropImpact ?? 0);
  const bbImpact = Number(data.walkPropImpact ?? 0);
  const eraImpact = Number(data.pitcherEraImpact ?? 0);

  // Map fRAA -25..+25 to bar 0..100%
  const barPct = Math.min(100, Math.max(0, (fRAA + 25) / 50 * 100));

  function fmtPct(v: number): string {
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;
  }

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
            <Shield className="w-4 h-4 text-teal-400 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">{category}</span>
              <span className="text-[oklch(0.3_0.01_280)] mx-1.5">/</span>
              <span className="text-[10px] font-medium text-[oklch(0.45_0.01_280)]">{subcategory}</span>
              <h3 className="text-sm font-black text-[oklch(0.92_0.005_85)] mt-1 leading-snug">{title}</h3>
            </div>
          </div>
          <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border shrink-0', styles.badge)}>
            {styles.label}
          </span>
        </div>

        {/* fRAA bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5 text-[10px]">
            <span className="text-[oklch(0.45_0.01_280)]">Framing Runs Above Avg / 1k</span>
            <span className="font-black tabular-nums text-[oklch(0.80_0.005_85)]">
              {fRAA >= 0 ? '+' : ''}{fRAA.toFixed(1)}
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
            <span>-25 (worst)</span>
            <span>0 avg</span>
            <span>+25 (best)</span>
          </div>
        </div>

        {/* Prop impact grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">K Prop</p>
            <p className={cn('text-sm font-black tabular-nums', kImpact > 0 ? 'text-emerald-400' : kImpact < 0 ? 'text-red-400' : 'text-[oklch(0.80_0.005_85)]')}>
              {fmtPct(kImpact)}
            </p>
          </div>
          <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">BB Prop</p>
            <p className={cn('text-sm font-black tabular-nums', bbImpact < 0 ? 'text-emerald-400' : bbImpact > 0 ? 'text-amber-400' : 'text-[oklch(0.80_0.005_85)]')}>
              {fmtPct(bbImpact)}
            </p>
          </div>
          <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">ERA Δ</p>
            <p className={cn('text-sm font-black tabular-nums', eraImpact < 0 ? 'text-emerald-400' : eraImpact > 0 ? 'text-red-400' : 'text-[oklch(0.80_0.005_85)]')}>
              {eraImpact >= 0 ? '+' : ''}{eraImpact.toFixed(2)}
            </p>
          </div>
        </div>

        {data.signal && (
          <p className="text-[11px] text-[oklch(0.60_0.01_280)] leading-relaxed">{data.signal}</p>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-teal-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
          >
            Full Framing Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
