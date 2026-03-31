'use client';

import { Eye, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UmpireImpactData {
  umpireName?: string;
  strikeZoneBias?: 'tight' | 'normal' | 'wide';
  calledStrikeRate?: string | number;
  leagueAvgCSR?: string | number;
  strikeZoneSizeRelative?: string | number;
  koPropImpact?: string | number;
  walkPropImpact?: string | number;
  scoringEnvImpact?: string | number;
  signal?: string;
  description?: string;
  note?: string;
}

interface UmpireImpactCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: UmpireImpactData;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

const BIAS_STYLES = {
  tight:  { badge: 'bg-amber-500/15 border-amber-500/40 text-amber-300',   label: 'Tight Zone' },
  normal: { badge: 'bg-slate-500/10 border-slate-500/30 text-slate-400',   label: 'Avg Zone'   },
  wide:   { badge: 'bg-blue-500/15  border-blue-500/40  text-blue-300',    label: 'Wide Zone'  },
};

export function UmpireImpactCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  onAnalyze,
  isHero,
}: UmpireImpactCardProps) {
  const bias = data.strikeZoneBias ?? 'normal';
  const styles = BIAS_STYLES[bias] ?? BIAS_STYLES.normal;
  const kImpact  = Number(data.koPropImpact  ?? 0);
  const bbImpact = Number(data.walkPropImpact ?? 0);
  const runImpact = Number(data.scoringEnvImpact ?? 0);

  function fmtImpact(v: number): string {
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
            <Eye className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
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

        {data.umpireName && (
          <p className="text-[10px] font-semibold text-[oklch(0.65_0.01_280)] mb-3">Ump: {data.umpireName}</p>
        )}

        {/* Impact grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">K Prop</p>
            <p className={cn('text-base font-black tabular-nums', kImpact > 0 ? 'text-emerald-400' : kImpact < 0 ? 'text-red-400' : 'text-[oklch(0.80_0.005_85)]')}>
              {fmtImpact(kImpact)}
            </p>
          </div>
          <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">BB Prop</p>
            <p className={cn('text-base font-black tabular-nums', bbImpact > 0 ? 'text-amber-400' : bbImpact < 0 ? 'text-emerald-400' : 'text-[oklch(0.80_0.005_85)]')}>
              {fmtImpact(bbImpact)}
            </p>
          </div>
          <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">Run Env</p>
            <p className={cn('text-base font-black tabular-nums', runImpact > 0 ? 'text-amber-400' : runImpact < 0 ? 'text-emerald-400' : 'text-[oklch(0.80_0.005_85)]')}>
              {runImpact > 0 ? '+' : ''}{runImpact.toFixed(1)}
            </p>
          </div>
        </div>

        {/* CSR comparison bars */}
        {data.calledStrikeRate !== undefined && data.leagueAvgCSR !== undefined ? (
          <div className="rounded-xl bg-[oklch(0.09_0.01_280)] border border-[oklch(0.18_0.015_280)] px-3 py-2.5 mb-3 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.40_0.01_280)]">Called Strike Rate</p>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[oklch(0.45_0.01_280)] w-14 shrink-0">Umpire</span>
              <div className="flex-1 h-1.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500',
                    bias === 'wide' ? 'bg-blue-500' : bias === 'tight' ? 'bg-amber-500' : 'bg-slate-500')}
                  style={{ width: `${Math.min(100, Number(data.calledStrikeRate) * 200)}%` }}
                />
              </div>
              <span className="font-black w-10 text-right tabular-nums text-[oklch(0.80_0.005_85)]">
                {(Number(data.calledStrikeRate) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[oklch(0.45_0.01_280)] w-14 shrink-0">League</span>
              <div className="flex-1 h-1.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, Number(data.leagueAvgCSR) * 200)}%` }}
                />
              </div>
              <span className="font-black w-10 text-right tabular-nums text-[oklch(0.55_0.01_280)]">
                {(Number(data.leagueAvgCSR) * 100).toFixed(1)}%
              </span>
            </div>
            {data.strikeZoneSizeRelative !== undefined && (
              <div className="flex justify-between text-[10px] pt-0.5 border-t border-[oklch(0.16_0.015_280)]">
                <span className="text-[oklch(0.45_0.01_280)]">Zone Size vs Avg</span>
                <span className="font-semibold text-[oklch(0.80_0.005_85)]">
                  {(Number(data.strikeZoneSizeRelative) * 100 - 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5 text-xs mb-3">
            {data.calledStrikeRate !== undefined && (
              <div className="flex justify-between">
                <span className="text-[oklch(0.45_0.01_280)]">Called Strike Rate</span>
                <span className="font-semibold text-[oklch(0.80_0.005_85)]">
                  {(Number(data.calledStrikeRate) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {data.strikeZoneSizeRelative !== undefined && (
              <div className="flex justify-between">
                <span className="text-[oklch(0.45_0.01_280)]">Zone Size</span>
                <span className="font-semibold text-[oklch(0.80_0.005_85)]">
                  {(Number(data.strikeZoneSizeRelative) * 100 - 100).toFixed(0)}% vs avg
                </span>
              </div>
            )}
          </div>
        )}

        {data.signal && (
          <p className="text-[11px] text-[oklch(0.60_0.01_280)] leading-relaxed">{data.signal}</p>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-cyan-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
          >
            Full Umpire Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
