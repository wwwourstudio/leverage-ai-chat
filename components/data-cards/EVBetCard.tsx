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
  const isPositiveEV = evRaw > 0;
  const evColorClass =
    evRaw >= 10 ? 'text-emerald-300'
    : evRaw >= 5  ? 'text-amber-300'
    : evRaw > 0   ? 'text-sky-300'
    : 'text-red-400';

  const evBgClass =
    evRaw >= 5  ? 'from-emerald-600/25 dark:via-cyan-800/10 to-transparent'
    : evRaw > 0 ? 'from-sky-600/20 dark:via-cyan-800/8 to-transparent'
    : 'from-red-600/15 dark:via-slate-800/5 to-transparent';

  const modelPct   = data.modelProbability   !== undefined ? Number(data.modelProbability)   * 100 : null;
  const impliedPct = data.impliedProbability !== undefined ? Number(data.impliedProbability) * 100 : null;
  const edgePct    = modelPct !== null && impliedPct !== null ? modelPct - impliedPct : null;
  const kellyDollar = data.quarterKelly !== undefined ? (Number(data.quarterKelly) * 1000).toFixed(0) : null;

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow)] transition-all duration-300 animate-fade-in-up',
        isHero && 'sm:rounded-3xl',
      )}
    >
      {/* Gradient header band */}
      <div className={cn('absolute inset-x-0 top-0 h-36 bg-gradient-to-b pointer-events-none', evBgClass)} />

      {/* Left accent stripe */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} aria-hidden="true" />

      {/* EV banner */}
      <div className="relative flex items-center justify-between px-4 py-2 border-b border-emerald-700/20 bg-emerald-900/10">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">
          <TrendingUp className="w-3 h-3 shrink-0" aria-hidden="true" />
          Positive Expected Value Bet
        </div>
        {isPositiveEV && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wide">
            EDGE
          </span>
        )}
      </div>

      <div className="relative pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
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
          <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border shrink-0', confColors[conf])}>
            {conf} conf
          </span>
        </div>

        {/* Hero EV number + Odds */}
        <div className="mb-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 text-center">
          <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">EV Edge</p>
          <p className={cn('text-5xl font-black tabular-nums leading-none', evColorClass)}>
            {data.evPercent ?? '—'}
          </p>
          {edgePct !== null && (
            <p className={cn('text-sm font-bold mt-1.5 tabular-nums', edgePct > 0 ? 'text-emerald-400' : 'text-red-400')}>
              {edgePct > 0 ? '+' : ''}{edgePct.toFixed(1)}% edge
            </p>
          )}
          {data.americanOdds !== undefined && (
            <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <span className="text-[9px] uppercase tracking-widest text-[var(--text-faint)]">Odds</span>
              <span className="text-sm font-black text-white tabular-nums ml-1">
                {Number(data.americanOdds) > 0 ? `+${data.americanOdds}` : String(data.americanOdds)}
              </span>
            </div>
          )}
        </div>

        {/* Model vs Market probability comparison */}
        {modelPct !== null && impliedPct !== null && (
          <div className="mb-4">
            <div className="flex items-center gap-2 py-2">
              <div className="flex-1 text-center rounded-xl bg-[var(--bg-elevated)] p-2.5 border border-[var(--border-subtle)]">
                <div className="text-xl font-black text-emerald-300 tabular-nums">{modelPct.toFixed(1)}%</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Model Prob</div>
              </div>
              <div className="text-[var(--text-faint)] text-xs font-bold">vs</div>
              <div className="flex-1 text-center rounded-xl bg-[var(--bg-elevated)] p-2.5 border border-[var(--border-subtle)]">
                <div className="text-xl font-black text-[var(--text-muted)] tabular-nums">{impliedPct.toFixed(1)}%</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Market Implied</div>
              </div>
            </div>
            {/* Confidence meter */}
            <div className="mt-2">
              <div className="flex justify-between text-[9px] text-[var(--text-faint)] mb-1">
                <span className="uppercase tracking-wide">Model confidence</span>
                <span className="font-bold">{Math.round(modelPct)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, modelPct)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">¼ Kelly</p>
            <p className="text-sm font-black tabular-nums text-foreground">
              {data.quarterKelly !== undefined ? `${(Number(data.quarterKelly) * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
          {data.market && (
            <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center col-span-2">
              <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Market</p>
              <p className="text-sm font-black tabular-nums text-foreground truncate">{data.market}</p>
            </div>
          )}
        </div>

        {/* Bankroll context */}
        {kellyDollar !== null && (
          <p className="text-[10px] text-[var(--text-muted)] mb-3 bg-[var(--bg-elevated)] rounded-lg px-3 py-1.5 border border-[var(--border-subtle)]">
            ¼ Kelly on $1,000 bankroll ≈ <span className="font-bold text-foreground">${kellyDollar}</span>
          </p>
        )}

        {/* Details */}
        <div className="space-y-1.5 text-xs">
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
