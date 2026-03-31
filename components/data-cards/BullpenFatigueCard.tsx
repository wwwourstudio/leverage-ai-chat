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
  const eraColor = eraNum > 5.0 ? 'text-red-400' : eraNum > 4.0 ? 'text-amber-400' : eraNum > 0 ? 'text-emerald-400' : 'text-[oklch(0.85_0.005_85)]';

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
            <Flame className="w-4 h-4 text-orange-400 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">{category}</span>
              <span className="text-[oklch(0.3_0.01_280)] mx-1.5">/</span>
              <span className="text-[10px] font-medium text-[oklch(0.45_0.01_280)]">{subcategory}</span>
              <h3 className="text-sm font-black text-[oklch(0.92_0.005_85)] mt-1 leading-snug">{title}</h3>
              {data.teamName && (
                <p className="text-[10px] text-[oklch(0.50_0.01_280)] mt-0.5">{data.teamName} Bullpen</p>
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
            <span className="text-[oklch(0.45_0.01_280)]">Fatigue Score</span>
            <span className="font-black tabular-nums text-[oklch(0.80_0.005_85)]">{fatigueScore}/100</span>
          </div>
          <div className="h-2 rounded-full bg-[oklch(0.18_0.015_280)] overflow-hidden">
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
            <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">Inn / 3d</p>
              <p className="text-sm font-black tabular-nums text-[oklch(0.85_0.005_85)]">{data.inningsLast3Days}</p>
            </div>
          )}
          {data.pitchCountLast3Days !== undefined && (
            <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">Pitches / 3d</p>
              <p className="text-sm font-black tabular-nums text-[oklch(0.85_0.005_85)]">{data.pitchCountLast3Days}</p>
            </div>
          )}
          {data.eraLast14Days !== undefined && (
            <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">ERA L14</p>
              <p className={cn('text-sm font-black tabular-nums', eraColor)}>{Number(data.eraLast14Days).toFixed(2)}</p>
            </div>
          )}
          {data.scoringEnvImpact !== undefined && (
            <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">+Runs</p>
              <p className={cn('text-sm font-black tabular-nums', impact > 0 ? 'text-amber-400' : 'text-emerald-400')}>
                {impact > 0 ? '+' : ''}{impact.toFixed(1)}
              </p>
            </div>
          )}
        </div>

        {data.signal && (
          <p className="text-[11px] text-[oklch(0.60_0.01_280)] leading-relaxed">{data.signal}</p>
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
