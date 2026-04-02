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
    : 'text-[var(--text-muted)]';

  const modelPct   = data.modelProbability   !== undefined ? Number(data.modelProbability)   * 100 : null;
  const impliedPct = data.impliedProbability !== undefined ? Number(data.impliedProbability) * 100 : null;
  const kellyDollar = data.quarterKelly !== undefined ? (Number(data.quarterKelly) * 1000).toFixed(0) : null;

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-background border transition-all duration-200 animate-fade-in-up',
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
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {category}
            </span>
            <span className="text-[var(--text-faint)] mx-1.5" aria-hidden="true">/</span>
            <span className="text-[10px] font-medium text-[var(--text-muted)]">{subcategory}</span>
            <h3 className="text-sm font-black text-foreground mt-1 leading-snug">{title}</h3>
            {data.matchup && (
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{data.matchup}</p>
            )}
          </div>

          {/* Confidence badge */}
          <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border shrink-0', confColors[conf])}>
            {conf} conf
          </span>
        </div>

        {/* EV + Odds row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[var(--bg-overlay)] rounded-xl border border-[var(--border-subtle)] p-3 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">EV Edge</p>
            <p className={cn('text-lg font-black tabular-nums', evColor)}>{data.evPercent ?? '—'}</p>
          </div>
          <div className="bg-[var(--bg-overlay)] rounded-xl border border-[var(--border-subtle)] p-3 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Odds</p>
            <p className="text-lg font-black tabular-nums text-foreground">
              {data.americanOdds !== undefined
                ? (Number(data.americanOdds) > 0 ? `+${data.americanOdds}` : String(data.americanOdds))
                : '—'}
            </p>
          </div>
          <div className="bg-[var(--bg-overlay)] rounded-xl border border-[var(--border-subtle)] p-3 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">¼ Kelly</p>
            <p className="text-lg font-black tabular-nums text-foreground">
              {data.quarterKelly !== undefined ? `${(Number(data.quarterKelly) * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
        </div>

        {/* Bankroll context */}
        {kellyDollar !== null && (
          <p className="text-[10px] text-[var(--text-muted)] mb-3">
            ¼ Kelly on $1,000 bankroll ≈ <span className="font-bold text-foreground">${kellyDollar}</span>
          </p>
        )}

        {/* Model vs Market probability comparison */}
        {modelPct !== null && impliedPct !== null && (
          <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-3 py-2.5 mb-3 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Probability Edge</p>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[var(--text-muted)] w-14 shrink-0">Model</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, modelPct)}%` }} />
              </div>
              <span className="text-emerald-400 font-black w-9 text-right tabular-nums">{modelPct.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[var(--text-muted)] w-14 shrink-0">Market</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full rounded-full bg-slate-500 transition-all duration-500" style={{ width: `${Math.min(100, impliedPct)}%` }} />
              </div>
              <span className="text-[var(--text-muted)] font-black w-9 text-right tabular-nums">{impliedPct.toFixed(1)}%</span>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="space-y-1.5 text-xs">
          {data.market && (
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Market</span>
              <span className="font-semibold text-foreground">{data.market}</span>
            </div>
          )}
          {data.outcome && (
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Outcome</span>
              <span className="font-semibold text-foreground">{data.outcome}</span>
            </div>
          )}
          {data.bookmaker && (
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Best Book</span>
              <span className="font-semibold text-foreground">{data.bookmaker}</span>
            </div>
          )}
        </div>

        {data.description && (
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-2 mt-3 text-[10px] text-[var(--text-muted)] leading-relaxed">
            {data.description}
          </div>
        )}

        {data.note && (
          <p className="mt-3 text-[11px] text-[var(--text-muted)] italic">{data.note}</p>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-emerald-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
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
