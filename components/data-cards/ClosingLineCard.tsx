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
  data,
  onAnalyze,
  isHero,
}: ClosingLineCardProps) {
  const verdict = data.verdict ?? 'at close';
  const clv = Number(data.clv ?? 0);
  const probDelta = Number(data.clvProbDelta ?? 0);

  // CLV strength bar: map -30..+30 → 0..100%
  const clvBarPct = Math.min(100, Math.max(0, ((clv + 30) / 60) * 100));
  const clvBarColor = clv >= 10 ? 'bg-blue-500' : clv >= 0 ? 'bg-blue-500' : 'bg-red-500';
  const clvStrength = Math.abs(clv) >= 15 ? 'STRONG' : Math.abs(clv) >= 5 ? 'MODERATE' : 'WEAK';

  // Implied probability bars
  const betOddsNum   = Number(data.betPrice ?? NaN);
  const closeOddsNum = Number(data.closingPrice ?? NaN);
  const betImplied   = !isNaN(betOddsNum)   && betOddsNum   !== 0 ? impliedProbFromAmerican(betOddsNum)   : null;
  const closeImplied = !isNaN(closeOddsNum) && closeOddsNum !== 0 ? impliedProbFromAmerican(closeOddsNum) : null;

  const verdictConfig = {
    'beat close':   { icon: CheckCircle2, color: 'text-blue-400', badge: 'bg-blue-500/15 border-blue-500/40 text-blue-300', label: 'BEAT CLOSE', verdictBg: 'from-blue-600/25 dark:via-blue-900/10' },
    'at close':     { icon: MinusCircle,  color: 'text-slate-400',   badge: 'bg-slate-500/10   border-slate-500/30   text-slate-400',   label: 'AT CLOSE',   verdictBg: 'from-slate-600/20 dark:via-slate-900/10' },
    'missed close': { icon: XCircle,      color: 'text-red-400',     badge: 'bg-red-500/15     border-red-500/40     text-red-400',     label: 'MISSED CLV', verdictBg: 'from-red-600/25 dark:via-red-900/10' },
  }[verdict] ?? { icon: MinusCircle, color: 'text-slate-400', badge: 'bg-slate-500/10 border-slate-500/30 text-slate-400', label: 'AT CLOSE', verdictBg: 'from-slate-600/20 dark:via-slate-900/10' };

  const VerdictIcon = verdictConfig.icon;

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow,0_0_40px_rgb(0_0_0/0.3))] transition-all duration-300',
        isHero && 'sm:rounded-3xl',
      )}
    >
      {/* Ambient gradient tinted by verdict */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none',
          'from-blue-600/25 dark:via-teal-800/10 to-transparent',
        )}
        aria-hidden="true"
      />

      <div className="relative z-10 pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart2 className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{category}</span>
                <span className="text-[var(--text-faint)]">/</span>
                <span className="text-[9px] text-[var(--text-faint)] truncate">{subcategory}</span>
              </div>
              <h3 className="text-sm font-black text-foreground mt-1 leading-snug">{title}</h3>
              {data.matchup && (
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{data.matchup}</p>
              )}
            </div>
          </div>

          {/* Verdict badge */}
          <span className={cn(
            'flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border shrink-0',
            verdictConfig.badge,
          )}>
            <VerdictIcon className="w-3 h-3" aria-hidden="true" />
            {verdictConfig.label}
          </span>
        </div>

        {/* Bet vs Close hero comparison */}
        <div className="flex items-stretch gap-3 mb-4">
          {/* Bet price */}
          <div className="flex-1 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-2">Bet Line</p>
            <p className="text-2xl font-black tabular-nums text-foreground/80">
              {formatAmerican(data.betPrice)}
            </p>
          </div>

          {/* CLV center display */}
          <div className="flex flex-col items-center justify-center px-3 shrink-0">
            <span className={cn('text-3xl font-black tabular-nums leading-none', verdictConfig.color)}>
              {clv > 0 ? '+' : ''}{clv}
            </span>
            <span className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mt-1">CLV</span>
          </div>

          {/* Closing price */}
          <div className="flex-1 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-2">Closing</p>
            <p className={cn('text-2xl font-black tabular-nums', verdictConfig.color)}>
              {formatAmerican(data.closingPrice)}
            </p>
          </div>
        </div>

        {/* Visual comparison bar: bet pos vs close pos */}
        {data.betPrice !== undefined && data.closingPrice !== undefined && (
          <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-2 mb-3">
            <div className="flex justify-between text-[9px] text-[var(--text-faint)] mb-1">
              <span>Bet</span>
              <span>Close</span>
            </div>
            <div className="relative h-2 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
              <div
                className={cn('absolute h-full rounded-full', clvBarColor)}
                style={{ width: `${clvBarPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[8px] text-[var(--text-faint)] mt-1">
              <span>Missed</span>
              <span>Neutral</span>
              <span>Beat</span>
            </div>
          </div>
        )}

        {/* CLV strength indicator */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] mb-3">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
            CLV Strength
          </span>
          <span className={cn('text-[10px] font-black uppercase tracking-wide', verdictConfig.color)}>
            {clvStrength}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1.5 text-xs">
          {data.market && (
            <div className="flex justify-between">
              <span className="text-[var(--text-faint)]">Market</span>
              <span className="font-semibold text-foreground/80">{data.market}</span>
            </div>
          )}
          {data.outcome && (
            <div className="flex justify-between">
              <span className="text-[var(--text-faint)]">Side</span>
              <span className="font-semibold text-foreground/80">{data.outcome}</span>
            </div>
          )}
          {betImplied !== null && closeImplied !== null ? (
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-2.5 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Implied Probability</p>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-[var(--text-faint)] w-12 shrink-0">At Bet</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--text-faint)]/70 transition-all duration-500" style={{ width: `${Math.min(100, betImplied * 150)}%` }} />
                </div>
                <span className="font-black w-10 text-right tabular-nums text-foreground/80">{(betImplied * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-[var(--text-faint)] w-12 shrink-0">Closing</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-500',
                    verdict === 'beat close' ? 'bg-blue-500/70' : verdict === 'missed close' ? 'bg-red-500/70' : 'bg-slate-500/60'
                  )} style={{ width: `${Math.min(100, closeImplied * 150)}%` }} />
                </div>
                <span className={cn('font-black w-10 text-right tabular-nums', verdictConfig.color)}>{(closeImplied * 100).toFixed(1)}%</span>
              </div>
              {data.clvProbDelta !== undefined && (
                <div className="flex justify-between text-[10px] pt-0.5 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-faint)]">Δ Edge</span>
                  <span className={cn('font-black', verdictConfig.color)}>{probDelta >= 0 ? '+' : ''}{(probDelta * 100).toFixed(1)}pp</span>
                </div>
              )}
            </div>
          ) : data.clvProbDelta !== undefined && (
            <div className="flex justify-between">
              <span className="text-[var(--text-faint)]">Prob Edge vs Close</span>
              <span className={cn('font-semibold', verdictConfig.color)}>
                {probDelta >= 0 ? '+' : ''}{(probDelta * 100).toFixed(1)}%
              </span>
            </div>
          )}
          {data.bookmaker && (
            <div className="flex justify-between">
              <span className="text-[var(--text-faint)]">Book</span>
              <span className="font-semibold text-foreground/80">{data.bookmaker}</span>
            </div>
          )}
          {data.placedAt && (
            <div className="flex justify-between">
              <span className="text-[var(--text-faint)]">Placed</span>
              <span className="text-[var(--text-muted)]">{data.placedAt}</span>
            </div>
          )}
        </div>

        {data.note && (
          <p className="mt-3 text-[11px] text-[var(--text-muted)] italic">{data.note}</p>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-blue-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
          >
            CLV History
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
