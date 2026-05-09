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

const BIAS_CONFIG = {
  tight:  { badge: 'bg-amber-500/15 border-amber-500/40 text-amber-300',  barColor: 'bg-amber-500',  header: 'from-amber-900/30 via-yellow-900/10', label: 'Tight Zone', icon: 'text-amber-400'  },
  normal: { badge: 'bg-slate-500/10 border-slate-500/30 text-slate-400',  barColor: 'bg-slate-400',  header: 'from-slate-800/30 via-slate-900/10',  label: 'Avg Zone',   icon: 'text-slate-400'  },
  wide:   { badge: 'bg-blue-500/15  border-blue-500/40  text-blue-300',   barColor: 'bg-blue-500',   header: 'from-blue-900/30 via-cyan-900/10',    label: 'Wide Zone',  icon: 'text-blue-400'   },
};

export function UmpireImpactCard({
  title,
  category,
  subcategory,
  data,
  onAnalyze,
  isHero,
}: UmpireImpactCardProps) {
  const bias = data.strikeZoneBias ?? 'normal';
  const cfg = BIAS_CONFIG[bias] ?? BIAS_CONFIG.normal;
  const kImpact   = Number(data.koPropImpact  ?? 0);
  const bbImpact  = Number(data.walkPropImpact ?? 0);
  const runImpact = Number(data.scoringEnvImpact ?? 0);

  function fmtImpact(v: number): string {
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
            <Eye className={cn('w-2.5 h-2.5', cfg.icon)} />
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/60">{category}</span>
          <span className="text-white/25">·</span>
          <span className="text-[9px] text-white/40">{subcategory}</span>
        </div>
        <h3 className="text-sm font-black text-white leading-snug pr-28">{title}</h3>
        {data.umpireName && (
          <p className="text-[10px] text-white/50 mt-0.5">Umpire: {data.umpireName}</p>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Impact grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">K Prop</p>
            <p className={cn('text-base font-black tabular-nums', kImpact > 0 ? 'text-emerald-400' : kImpact < 0 ? 'text-red-400' : 'text-white/70')}>
              {fmtImpact(kImpact)}
            </p>
          </div>
          <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">BB Prop</p>
            <p className={cn('text-base font-black tabular-nums', bbImpact > 0 ? 'text-amber-400' : bbImpact < 0 ? 'text-emerald-400' : 'text-white/70')}>
              {fmtImpact(bbImpact)}
            </p>
          </div>
          <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Run Env</p>
            <p className={cn('text-base font-black tabular-nums', runImpact > 0 ? 'text-amber-400' : runImpact < 0 ? 'text-emerald-400' : 'text-white/70')}>
              {runImpact > 0 ? '+' : ''}{runImpact.toFixed(1)}
            </p>
          </div>
        </div>

        {/* CSR comparison bars */}
        {data.calledStrikeRate !== undefined && data.leagueAvgCSR !== undefined ? (
          <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-2.5 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Called Strike Rate</p>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[var(--text-faint)] w-14 shrink-0">Umpire</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', cfg.barColor)}
                  style={{ width: `${Math.min(100, Number(data.calledStrikeRate) * 200)}%` }}
                />
              </div>
              <span className="font-black w-10 text-right tabular-nums text-white/80">
                {(Number(data.calledStrikeRate) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[var(--text-faint)] w-14 shrink-0">League</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Number(data.leagueAvgCSR) * 200)}%` }}
                />
              </div>
              <span className="font-black w-10 text-right tabular-nums text-[var(--text-muted)]">
                {(Number(data.leagueAvgCSR) * 100).toFixed(1)}%
              </span>
            </div>
            {data.strikeZoneSizeRelative !== undefined && (
              <div className="flex justify-between text-[10px] pt-1.5 border-t border-[var(--border-subtle)]">
                <span className="text-[var(--text-faint)]">Zone Size vs Avg</span>
                <span className="font-semibold text-white/80">
                  {(Number(data.strikeZoneSizeRelative) * 100 - 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5 text-xs">
            {data.calledStrikeRate !== undefined && (
              <div className="flex justify-between">
                <span className="text-[var(--text-faint)]">Called Strike Rate</span>
                <span className="font-semibold text-white/80">
                  {(Number(data.calledStrikeRate) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {data.strikeZoneSizeRelative !== undefined && (
              <div className="flex justify-between">
                <span className="text-[var(--text-faint)]">Zone Size</span>
                <span className="font-semibold text-white/80">
                  {(Number(data.strikeZoneSizeRelative) * 100 - 100).toFixed(0)}% vs avg
                </span>
              </div>
            )}
          </div>
        )}

        {data.signal && (
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{data.signal}</p>
        )}
      </div>

      {onAnalyze && (
        <div className="px-4 pb-4 pt-1">
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] text-[11px] font-semibold text-[var(--text-muted)] hover:text-cyan-400 transition-all duration-150"
          >
            Full Umpire Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </article>
  );
}
