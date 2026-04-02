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
        'group relative w-full rounded-2xl overflow-hidden bg-background border transition-all duration-200 animate-fade-in-up',
        'border-[var(--border-subtle)] hover:border-[var(--border-hover)]',
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
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{category}</span>
              <span className="text-[var(--text-faint)] mx-1.5">/</span>
              <span className="text-[10px] font-medium text-[var(--text-faint)]">{subcategory}</span>
              <h3 className="text-sm font-black text-foreground mt-1 leading-snug">{title}</h3>
            </div>
          </div>
          <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border shrink-0', styles.badge)}>
            {styles.label}
          </span>
        </div>

        {data.umpireName && (
          <p className="text-[10px] font-semibold text-[var(--text-muted)] mb-3">Ump: {data.umpireName}</p>
        )}

        {/* Impact grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[var(--bg-overlay)] rounded-lg border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">K Prop</p>
            <p className={cn('text-base font-black tabular-nums', kImpact > 0 ? 'text-emerald-400' : kImpact < 0 ? 'text-red-400' : 'text-foreground/80')}>
              {fmtImpact(kImpact)}
            </p>
          </div>
          <div className="bg-[var(--bg-overlay)] rounded-lg border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">BB Prop</p>
            <p className={cn('text-base font-black tabular-nums', bbImpact > 0 ? 'text-amber-400' : bbImpact < 0 ? 'text-emerald-400' : 'text-foreground/80')}>
              {fmtImpact(bbImpact)}
            </p>
          </div>
          <div className="bg-[var(--bg-overlay)] rounded-lg border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Run Env</p>
            <p className={cn('text-base font-black tabular-nums', runImpact > 0 ? 'text-amber-400' : runImpact < 0 ? 'text-emerald-400' : 'text-foreground/80')}>
              {runImpact > 0 ? '+' : ''}{runImpact.toFixed(1)}
            </p>
          </div>
        </div>

        {/* CSR comparison bars */}
        {data.calledStrikeRate !== undefined && data.leagueAvgCSR !== undefined ? (
          <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-3 py-2.5 mb-3 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Called Strike Rate</p>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[var(--text-faint)] w-14 shrink-0">Umpire</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500',
                    bias === 'wide' ? 'bg-blue-500' : bias === 'tight' ? 'bg-amber-500' : 'bg-slate-500')}
                  style={{ width: `${Math.min(100, Number(data.calledStrikeRate) * 200)}%` }}
                />
              </div>
              <span className="font-black w-10 text-right tabular-nums text-foreground/80">
                {(Number(data.calledStrikeRate) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[var(--text-faint)] w-14 shrink-0">League</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--bg-surface)] transition-all duration-500"
                  style={{ width: `${Math.min(100, Number(data.leagueAvgCSR) * 200)}%` }}
                />
              </div>
              <span className="font-black w-10 text-right tabular-nums text-[var(--text-muted)]">
                {(Number(data.leagueAvgCSR) * 100).toFixed(1)}%
              </span>
            </div>
            {data.strikeZoneSizeRelative !== undefined && (
              <div className="flex justify-between text-[10px] pt-0.5 border-t border-[var(--border-subtle)]">
                <span className="text-[var(--text-faint)]">Zone Size vs Avg</span>
                <span className="font-semibold text-foreground/80">
                  {(Number(data.strikeZoneSizeRelative) * 100 - 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5 text-xs mb-3">
            {data.calledStrikeRate !== undefined && (
              <div className="flex justify-between">
                <span className="text-[var(--text-faint)]">Called Strike Rate</span>
                <span className="font-semibold text-foreground/80">
                  {(Number(data.calledStrikeRate) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {data.strikeZoneSizeRelative !== undefined && (
              <div className="flex justify-between">
                <span className="text-[var(--text-faint)]">Zone Size</span>
                <span className="font-semibold text-foreground/80">
                  {(Number(data.strikeZoneSizeRelative) * 100 - 100).toFixed(0)}% vs avg
                </span>
              </div>
            )}
          </div>
        )}

        {data.signal && (
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{data.signal}</p>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-cyan-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
          >
            Full Umpire Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
