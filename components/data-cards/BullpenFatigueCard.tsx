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

const RISK_STYLES = {
  low:      { bar: 'bg-emerald-500', badge: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
  moderate: { bar: 'bg-amber-500',   badge: 'bg-amber-500/15   border-amber-500/40   text-amber-300'   },
  high:     { bar: 'bg-red-500',     badge: 'bg-red-500/15     border-red-500/40     text-red-400'     },
};

export function BullpenFatigueCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  onAnalyze,
  isHero,
}: BullpenFatigueCardProps) {
  const risk = data.riskLevel ?? 'low';
  const styles = RISK_STYLES[risk] ?? RISK_STYLES.low;
  const fatigueScore = Number(data.fatigueScore ?? 0);
  const impact = Number(data.scoringEnvImpact ?? 0);
  const eraNum  = Number(data.eraLast14Days ?? 0);
  const eraColor = eraNum > 5.0 ? 'text-red-400' : eraNum > 4.0 ? 'text-amber-400' : eraNum > 0 ? 'text-emerald-400' : 'text-foreground';

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
            <Flame className="w-4 h-4 text-orange-400 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{category}</span>
              <span className="text-[var(--text-faint)] mx-1.5">/</span>
              <span className="text-[10px] font-medium text-[var(--text-faint)]">{subcategory}</span>
              <h3 className="text-sm font-black text-foreground mt-1 leading-snug">{title}</h3>
              {data.teamName && (
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{data.teamName} Bullpen</p>
              )}
            </div>
          </div>

          <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border shrink-0', styles.badge)}>
            {risk} risk
          </span>
        </div>

        {/* Score bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5 text-[10px]">
            <span className="text-[var(--text-faint)]">Fatigue Score</span>
            <span className="font-black tabular-nums text-foreground/80">{fatigueScore}/100</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', styles.bar)}
              style={{ width: `${fatigueScore}%` }}
              role="meter"
              aria-valuenow={fatigueScore}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {data.inningsLast3Days !== undefined && (
            <div className="bg-[var(--bg-overlay)] rounded-lg border border-[var(--border-subtle)] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Inn / 3d</p>
              <p className="text-sm font-black tabular-nums text-foreground">{data.inningsLast3Days}</p>
            </div>
          )}
          {data.pitchCountLast3Days !== undefined && (
            <div className="bg-[var(--bg-overlay)] rounded-lg border border-[var(--border-subtle)] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Pitches / 3d</p>
              <p className="text-sm font-black tabular-nums text-foreground">{data.pitchCountLast3Days}</p>
            </div>
          )}
          {data.eraLast14Days !== undefined && (
            <div className="bg-[var(--bg-overlay)] rounded-lg border border-[var(--border-subtle)] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">ERA L14</p>
              <p className={cn('text-sm font-black tabular-nums', eraColor)}>{Number(data.eraLast14Days).toFixed(2)}</p>
            </div>
          )}
          {data.scoringEnvImpact !== undefined && (
            <div className="bg-[var(--bg-overlay)] rounded-lg border border-[var(--border-subtle)] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">+Runs</p>
              <p className={cn('text-sm font-black tabular-nums', impact > 0 ? 'text-amber-400' : 'text-emerald-400')}>
                {impact > 0 ? '+' : ''}{impact.toFixed(1)}
              </p>
            </div>
          )}
        </div>

        {data.signal && (
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{data.signal}</p>
        )}

        {/* Run environment impact banner */}
        {impact !== 0 && (
          <div className={cn(
            'rounded-lg px-3 py-2 text-[10px] font-semibold mt-2 border',
            impact > 0.5
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
          )}>
            {impact > 0
              ? `+${impact.toFixed(1)} runs added — lean over on totals`
              : `${impact.toFixed(1)} runs suppressed — lean under on totals`}
          </div>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
          >
            Full Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
