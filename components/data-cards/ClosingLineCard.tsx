'use client';

import { BarChart2, ChevronRight, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ClosingLineData {
  matchup?: string;
  market?: string;
  outcome?: string;
  betPrice?: string | number;
  closingPrice?: string | number;
  clv?: string | number;
  clvProbDelta?: string | number;
  verdict?: 'beat close' | 'at close' | 'missed close';
  bookmaker?: string;
  placedAt?: string;
  description?: string;
  note?: string;
}

interface ClosingLineCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: ClosingLineData;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

function formatAmerican(val: string | number | undefined): string {
  if (val === undefined) return '—';
  const n = Number(val);
  return n > 0 ? `+${n}` : String(n);
}

function impliedProbFromAmerican(odds: number): number {
  return odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100);
}

export function ClosingLineCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  onAnalyze,
  isHero,
}: ClosingLineCardProps) {
  const verdict = data.verdict ?? 'at close';
  const clv = Number(data.clv ?? 0);
  const probDelta = Number(data.clvProbDelta ?? 0);

  // CLV strength bar: map -30..+30 → 0..100%
  const clvBarPct = Math.min(100, Math.max(0, ((clv + 30) / 60) * 100));
  const clvBarColor = clv >= 10 ? 'bg-emerald-500' : clv >= 0 ? 'bg-blue-500' : 'bg-red-500';
  const clvStrength = Math.abs(clv) >= 15 ? 'STRONG' : Math.abs(clv) >= 5 ? 'MODERATE' : 'WEAK';

  // Implied probability bars
  const betOddsNum   = Number(data.betPrice ?? NaN);
  const closeOddsNum = Number(data.closingPrice ?? NaN);
  const betImplied   = !isNaN(betOddsNum)   && betOddsNum   !== 0 ? impliedProbFromAmerican(betOddsNum)   : null;
  const closeImplied = !isNaN(closeOddsNum) && closeOddsNum !== 0 ? impliedProbFromAmerican(closeOddsNum) : null;

  const verdictConfig = {
    'beat close':   { icon: CheckCircle2, color: 'text-emerald-400', badge: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300', label: 'Beat Close' },
    'at close':     { icon: MinusCircle,  color: 'text-slate-400',   badge: 'bg-slate-500/10   border-slate-500/30   text-slate-400',   label: 'At Close'   },
    'missed close': { icon: XCircle,      color: 'text-red-400',     badge: 'bg-red-500/15     border-red-500/40     text-red-400',     label: 'Missed Close' },
  }[verdict] ?? { icon: MinusCircle, color: 'text-slate-400', badge: 'bg-slate-500/10 border-slate-500/30 text-slate-400', label: 'At Close' };

  const VerdictIcon = verdictConfig.icon;

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
            <BarChart2 className="w-4 h-4 text-violet-400 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">{category}</span>
              <span className="text-[oklch(0.3_0.01_280)] mx-1.5">/</span>
              <span className="text-[10px] font-medium text-[oklch(0.45_0.01_280)]">{subcategory}</span>
              <h3 className="text-sm font-black text-[oklch(0.92_0.005_85)] mt-1 leading-snug">{title}</h3>
              {data.matchup && (
                <p className="text-[10px] text-[oklch(0.50_0.01_280)] mt-0.5 truncate">{data.matchup}</p>
              )}
            </div>
          </div>

          <span className={cn('flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border shrink-0', verdictConfig.badge)}>
            <VerdictIcon className="w-3 h-3" aria-hidden="true" />
            {verdictConfig.label}
          </span>
        </div>

        {/* Price comparison */}
        <div className="flex items-center justify-between bg-[oklch(0.09_0.01_280)] rounded-xl border border-[oklch(0.18_0.015_280)] p-4 mb-3">
          <div className="text-center flex-1">
            <p className="text-[8px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-1.5">Bet Line</p>
            <p className="text-xl font-black tabular-nums text-[oklch(0.80_0.005_85)]">
              {formatAmerican(data.betPrice)}
            </p>
          </div>

          <div className="flex flex-col items-center gap-0.5 px-3">
            <span className={cn('text-2xl font-black tabular-nums', verdictConfig.color)}>
              {clv > 0 ? '+' : ''}{clv}
            </span>
            <span className="text-[8px] uppercase tracking-widest text-[oklch(0.38_0.01_280)]">CLV</span>
          </div>

          <div className="text-center flex-1">
            <p className="text-[8px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-1.5">Closing</p>
            <p className={cn('text-xl font-black tabular-nums', verdictConfig.color)}>
              {formatAmerican(data.closingPrice)}
            </p>
          </div>
        </div>

        {/* CLV strength bar */}
        <div className="rounded-xl bg-[oklch(0.09_0.01_280)] border border-[oklch(0.18_0.015_280)] px-3 py-2.5 mb-3 space-y-1.5">
          <div className="flex justify-between text-[9px] font-bold uppercase tracking-wide">
            <span className="text-[oklch(0.40_0.01_280)]">CLV Strength</span>
            <span className={verdictConfig.color}>{clvStrength}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-500', clvBarColor)} style={{ width: `${clvBarPct}%` }} />
          </div>
          <div className="flex justify-between text-[8px] text-[oklch(0.38_0.01_280)]">
            <span>Missed</span>
            <span>Neutral</span>
            <span>Beat</span>
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
              <span className="text-[oklch(0.45_0.01_280)]">Side</span>
              <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.outcome}</span>
            </div>
          )}
          {betImplied !== null && closeImplied !== null ? (
            <div className="rounded-xl bg-[oklch(0.09_0.01_280)] border border-[oklch(0.18_0.015_280)] px-3 py-2.5 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.40_0.01_280)]">Implied Probability</p>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-[oklch(0.45_0.01_280)] w-12 shrink-0">At Bet</span>
                <div className="flex-1 h-1.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
                  <div className="h-full rounded-full bg-slate-400/70 transition-all duration-500" style={{ width: `${Math.min(100, betImplied * 150)}%` }} />
                </div>
                <span className="font-black w-10 text-right tabular-nums text-[oklch(0.80_0.005_85)]">{(betImplied * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-[oklch(0.45_0.01_280)] w-12 shrink-0">Closing</span>
                <div className="flex-1 h-1.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-500',
                    verdict === 'beat close' ? 'bg-emerald-500/70' : verdict === 'missed close' ? 'bg-red-500/70' : 'bg-slate-500/60'
                  )} style={{ width: `${Math.min(100, closeImplied * 150)}%` }} />
                </div>
                <span className={cn('font-black w-10 text-right tabular-nums', verdictConfig.color)}>{(closeImplied * 100).toFixed(1)}%</span>
              </div>
              {data.clvProbDelta !== undefined && (
                <div className="flex justify-between text-[10px] pt-0.5 border-t border-[oklch(0.16_0.015_280)]">
                  <span className="text-[oklch(0.45_0.01_280)]">Δ Edge</span>
                  <span className={cn('font-black', verdictConfig.color)}>{probDelta >= 0 ? '+' : ''}{(probDelta * 100).toFixed(1)}pp</span>
                </div>
              )}
            </div>
          ) : data.clvProbDelta !== undefined && (
            <div className="flex justify-between">
              <span className="text-[oklch(0.45_0.01_280)]">Prob Edge vs Close</span>
              <span className={cn('font-semibold', verdictConfig.color)}>
                {probDelta >= 0 ? '+' : ''}{(probDelta * 100).toFixed(1)}%
              </span>
            </div>
          )}
          {data.bookmaker && (
            <div className="flex justify-between">
              <span className="text-[oklch(0.45_0.01_280)]">Book</span>
              <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.bookmaker}</span>
            </div>
          )}
          {data.placedAt && (
            <div className="flex justify-between">
              <span className="text-[oklch(0.45_0.01_280)]">Placed</span>
              <span className="text-[oklch(0.50_0.01_280)]">{data.placedAt}</span>
            </div>
          )}
        </div>

        {data.note && (
          <p className="mt-3 text-[11px] text-[oklch(0.50_0.01_280)] italic">{data.note}</p>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-violet-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
          >
            CLV History
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
