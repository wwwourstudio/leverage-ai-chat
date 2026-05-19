'use client';

import { Flame, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BullpenFatigueData {
  teamName?: string;
  fatigueScore?: string | number;
  riskLevel?: 'low' | 'moderate' | 'high';
  inningsLast3Days?: string | number;
  pitchCountLast3Days?: string | number;
  eraLast14Days?: string | number;
  scoringEnvImpact?: string | number;
  signal?: string;
  description?: string;
  note?: string;
}

interface BullpenFatigueCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: BullpenFatigueData;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

const RISK_CONFIG = {
  low:      { bar: 'bg-blue-500', badge: 'bg-blue-500/15 border-blue-500/40 text-blue-300', header: 'dark:from-blue-900/30 dark:via-blue-900/10',    icon: 'text-blue-400' },
  moderate: { bar: 'bg-amber-500',   badge: 'bg-amber-500/15 border-amber-500/40 text-amber-300',       header: 'dark:from-amber-900/30 dark:via-orange-900/10',   icon: 'text-amber-400'   },
  high:     { bar: 'bg-red-500',     badge: 'bg-red-500/15 border-red-500/40 text-red-400',             header: 'dark:from-red-900/35 dark:via-orange-900/15',     icon: 'text-red-400'     },
};

export function BullpenFatigueCard({
  title,
  category,
  subcategory,
  data,
  onAnalyze,
  isHero,
}: BullpenFatigueCardProps) {
  const risk = data.riskLevel ?? 'low';
  const cfg = RISK_CONFIG[risk] ?? RISK_CONFIG.low;
  const fatigueScore = Number(data.fatigueScore ?? 0);
  const impact = Number(data.scoringEnvImpact ?? 0);
  const eraNum  = Number(data.eraLast14Days ?? 0);
  const eraColor = eraNum > 5.0 ? 'text-red-400' : eraNum > 4.0 ? 'text-amber-400' : eraNum > 0 ? 'text-blue-400' : 'text-[var(--text-secondary,var(--text-muted))]';

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
            <Flame className={cn('w-2.5 h-2.5', cfg.icon)} />
            {risk} risk
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">{category}</span>
          <span className="text-[var(--text-faint)]">·</span>
          <span className="text-[9px] text-[var(--text-faint)]">{subcategory}</span>
        </div>
        <h3 className="text-sm font-black text-[var(--foreground)] leading-snug pr-24">{title}</h3>
        {data.teamName && (
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{data.teamName} Bullpen</p>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Fatigue score bar */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide">Fatigue Score</span>
            <span className="text-sm font-black tabular-nums text-[var(--foreground)]">{fatigueScore}<span className="text-[10px] text-[var(--text-faint)] font-normal">/100</span></span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
              style={{ width: `${fatigueScore}%` }}
              role="meter"
              aria-valuenow={fatigueScore}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {data.inningsLast3Days !== undefined && (
            <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
              <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Inn / 3d</p>
              <p className="text-base font-black tabular-nums text-[var(--foreground)]">{data.inningsLast3Days}</p>
            </div>
          )}
          {data.pitchCountLast3Days !== undefined && (
            <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
              <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Pitches / 3d</p>
              <p className="text-base font-black tabular-nums text-[var(--foreground)]">{data.pitchCountLast3Days}</p>
            </div>
          )}
          {data.eraLast14Days !== undefined && (
            <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
              <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">ERA L14</p>
              <p className={cn('text-base font-black tabular-nums', eraColor)}>{Number(data.eraLast14Days).toFixed(2)}</p>
            </div>
          )}
          {data.scoringEnvImpact !== undefined && (
            <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
              <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Run Impact</p>
              <p className={cn('text-base font-black tabular-nums', impact > 0 ? 'text-amber-400' : 'text-blue-400')}>
                {impact > 0 ? '+' : ''}{impact.toFixed(1)}
              </p>
            </div>
          )}
        </div>

        {data.signal && (
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{data.signal}</p>
        )}

        {impact !== 0 && (
          <div className={cn(
            'rounded-xl px-3 py-2.5 text-[10px] font-semibold border',
            impact > 0.5
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-300',
          )}>
            {impact > 0
              ? `+${impact.toFixed(1)} runs added — lean OVER on totals`
              : `${impact.toFixed(1)} runs suppressed — lean UNDER on totals`}
          </div>
        )}
      </div>

      {onAnalyze && (
        <div className="px-4 pb-4 pt-1">
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--foreground)] transition-all duration-150"
          >
            Full Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </article>
  );
}
