'use client';

import { TrendingUp, Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EVBetData {
  matchup?: string;
  market?: string;
  outcome?: string;
  bookmaker?: string;
  americanOdds?: string | number;
  evPercent?: string;
  modelProbability?: string | number;
  impliedProbability?: string | number;
  quarterKelly?: string | number;
  confidence?: 'high' | 'medium' | 'low';
  description?: string;
  note?: string;
}

interface EVBetCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: EVBetData;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

export function EVBetCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  onAnalyze,
  isHero,
}: EVBetCardProps) {
  const conf = data.confidence ?? 'medium';
  const confColors = {
    high:   'text-emerald-300 bg-emerald-500/15 border-emerald-500/40',
    medium: 'text-amber-300   bg-amber-500/10   border-amber-500/35',
    low:    'text-slate-400   bg-slate-500/10   border-slate-500/30',
  };

  const evRaw = parseFloat(String(data.evPercent ?? '0'));
  const evColor =
    evRaw >= 10 ? 'text-emerald-300'
    : evRaw >= 5  ? 'text-amber-300'
    : 'text-slate-400';

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border transition-all duration-200 animate-fade-in-up',
        'border-emerald-600/30 hover:border-emerald-500/50 hover:shadow-[0_0_30px_oklch(0.4_0.12_145/0.10)]',
        isHero && 'sm:rounded-3xl',
      )}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} aria-hidden="true" />

      {/* EV banner */}
      <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-900/20 border-b border-emerald-700/20 text-emerald-400">
        <TrendingUp className="w-3 h-3 shrink-0" aria-hidden="true" />
        Positive Expected Value Bet
      </div>

      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">
              {category}
            </span>
            <span className="text-[oklch(0.3_0.01_280)] mx-1.5" aria-hidden="true">/</span>
            <span className="text-[10px] font-medium text-[oklch(0.45_0.01_280)]">{subcategory}</span>
            <h3 className="text-sm font-black text-[oklch(0.92_0.005_85)] mt-1 leading-snug">{title}</h3>
          </div>

          {/* Confidence badge */}
          <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border shrink-0', confColors[conf])}>
            {conf} conf
          </span>
        </div>

        {/* EV + Odds row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[oklch(0.09_0.01_280)] rounded-xl border border-[oklch(0.18_0.015_280)] p-3 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-1">EV Edge</p>
            <p className={cn('text-lg font-black tabular-nums', evColor)}>{data.evPercent ?? '—'}</p>
          </div>
          <div className="bg-[oklch(0.09_0.01_280)] rounded-xl border border-[oklch(0.18_0.015_280)] p-3 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-1">Odds</p>
            <p className="text-lg font-black tabular-nums text-[oklch(0.92_0.005_85)]">
              {data.americanOdds !== undefined
                ? (Number(data.americanOdds) > 0 ? `+${data.americanOdds}` : String(data.americanOdds))
                : '—'}
            </p>
          </div>
          <div className="bg-[oklch(0.09_0.01_280)] rounded-xl border border-[oklch(0.18_0.015_280)] p-3 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-1">¼ Kelly</p>
            <p className="text-lg font-black tabular-nums text-[oklch(0.80_0.005_85)]">
              {data.quarterKelly !== undefined ? `${(Number(data.quarterKelly) * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1.5 text-xs">
          {data.market && (
            <div className="flex justify-between">
              <span className="text-[oklch(0.45_0.01_280)]">Market</span>
              <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.market}</span>
            </div>
          )}
          {data.outcome && (
            <div className="flex justify-between">
              <span className="text-[oklch(0.45_0.01_280)]">Outcome</span>
              <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.outcome}</span>
            </div>
          )}
          {data.bookmaker && (
            <div className="flex justify-between">
              <span className="text-[oklch(0.45_0.01_280)]">Best Book</span>
              <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.bookmaker}</span>
            </div>
          )}
          {data.modelProbability !== undefined && (
            <div className="flex justify-between">
              <span className="text-[oklch(0.45_0.01_280)]">Model Prob</span>
              <span className="font-semibold text-emerald-400">
                {(Number(data.modelProbability) * 100).toFixed(1)}%
              </span>
            </div>
          )}
          {data.impliedProbability !== undefined && (
            <div className="flex justify-between">
              <span className="text-[oklch(0.45_0.01_280)]">Market Implied</span>
              <span className="font-semibold text-[oklch(0.65_0.01_280)]">
                {(Number(data.impliedProbability) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {data.note && (
          <p className="mt-3 text-[11px] text-[oklch(0.50_0.01_280)] italic">{data.note}</p>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-emerald-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
          >
            <Zap className="w-3 h-3" aria-hidden="true" />
            Full EV Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
