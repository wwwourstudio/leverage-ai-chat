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

const TIER_CONFIG = {
  'elite':     { badge: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300', bar: 'bg-emerald-500', header: 'dark:from-emerald-900/30 dark:via-teal-900/15',   label: 'Elite Framer',   icon: 'text-emerald-400' },
  'above-avg': { badge: 'bg-blue-500/15 border-blue-500/40 text-blue-300',          bar: 'bg-blue-500',    header: 'dark:from-blue-900/30 dark:via-cyan-900/15',      label: 'Above Average',  icon: 'text-blue-400'    },
  'average':   { badge: 'bg-slate-500/10 border-slate-500/30 text-slate-400',       bar: 'bg-slate-500',   header: 'dark:from-slate-800/30 dark:via-slate-900/10',    label: 'Average',        icon: 'text-slate-400'   },
  'below-avg': { badge: 'bg-red-500/15 border-red-500/40 text-red-400',             bar: 'bg-red-500',     header: 'dark:from-red-900/30 dark:via-rose-900/15',       label: 'Below Average',  icon: 'text-red-400'     },
};

export function CatcherFramingCard({
  title,
  category,
  subcategory,
  data,
  onAnalyze,
  isHero,
}: CatcherFramingCardProps) {
  const tier = data.framingTier ?? 'average';
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.average;
  const fRAA = Number(data.framingRunsAboveAverage ?? 0);
  const kImpact   = Number(data.koPropImpact ?? 0);
  const bbImpact  = Number(data.walkPropImpact ?? 0);
  const eraImpact = Number(data.pitcherEraImpact ?? 0);

  // Map fRAA -25..+25 to 0..100%
  const barPct = Math.min(100, Math.max(0, (fRAA + 25) / 50 * 100));

  const cscd = Number(data.calledStrikeConversionDelta ?? 0);
  const hasCscd = data.calledStrikeConversionDelta !== undefined && Math.abs(cscd) > 0.001;
  const cscdBarPct = Math.min(100, Math.max(0, ((cscd + 0.05) / 0.10) * 100));
  const cscdBarColor = cscd > 0 ? 'bg-emerald-500' : cscd < 0 ? 'bg-red-500' : 'bg-slate-500';
  const cscdColor = cscd > 0 ? 'text-emerald-400' : cscd < 0 ? 'text-red-400' : 'text-white/70';

  function fmtPct(v: number): string {
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;
  }

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-300',
      'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow)]',
      isHero && 'sm:rounded-3xl',
    )}>
      {/* Gradient header */}
      <div className={cn('relative px-4 pt-4 pb-3 bg-gradient-to-br to-transparent border-b border-[var(--border-subtle)]', cfg.header)}>
        <div className="absolute top-3 right-3">
          <span className={cn('inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border', cfg.badge)}>
            <Shield className={cn('w-2.5 h-2.5', cfg.icon)} />
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/60">{category}</span>
          <span className="text-white/25">·</span>
          <span className="text-[9px] text-white/40">{subcategory}</span>
        </div>
        <h3 className="text-sm font-black text-white leading-snug pr-28">{title}</h3>
        {data.catcherName && (
          <p className="text-[10px] text-white/50 mt-0.5">Catcher: {data.catcherName}</p>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* fRAA bar */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide">Framing Runs Above Avg / 1k</span>
            <span className="text-sm font-black tabular-nums text-white/80">
              {fRAA >= 0 ? '+' : ''}{fRAA.toFixed(1)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
              style={{ width: `${barPct}%` }}
              role="meter"
              aria-valuenow={barPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="flex justify-between text-[8px] text-[var(--text-faint)] mt-1">
            <span>-25 (worst)</span>
            <span>0 avg</span>
            <span>+25 (best)</span>
          </div>
        </div>

        {/* Called strike conversion delta */}
        {hasCscd && (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide">Called Strike Conversion Δ</span>
              <span className={cn('text-sm font-black tabular-nums', cscdColor)}>
                {cscd > 0 ? '+' : ''}{(cscd * 100).toFixed(1)}pp
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', cscdBarColor)}
                style={{ width: `${cscdBarPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[8px] text-[var(--text-faint)] mt-1">
              <span>-5pp</span>
              <span>avg</span>
              <span>+5pp</span>
            </div>
          </div>
        )}

        {/* Prop impact grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">K Prop</p>
            <p className={cn('text-sm font-black tabular-nums', kImpact > 0 ? 'text-emerald-400' : kImpact < 0 ? 'text-red-400' : 'text-white/70')}>
              {fmtPct(kImpact)}
            </p>
          </div>
          <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">BB Prop</p>
            <p className={cn('text-sm font-black tabular-nums', bbImpact < 0 ? 'text-emerald-400' : bbImpact > 0 ? 'text-amber-400' : 'text-white/70')}>
              {fmtPct(bbImpact)}
            </p>
          </div>
          <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">ERA Δ</p>
            <p className={cn('text-sm font-black tabular-nums', eraImpact < 0 ? 'text-emerald-400' : eraImpact > 0 ? 'text-red-400' : 'text-white/70')}>
              {eraImpact >= 0 ? '+' : ''}{eraImpact.toFixed(2)}
            </p>
          </div>
        </div>

        {data.signal && (
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{data.signal}</p>
        )}
      </div>

      {onAnalyze && (
        <div className="px-4 pb-4 pt-1">
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] text-[11px] font-semibold text-[var(--text-muted)] hover:text-teal-400 transition-all duration-150"
          >
            Full Framing Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </article>
  );
}
