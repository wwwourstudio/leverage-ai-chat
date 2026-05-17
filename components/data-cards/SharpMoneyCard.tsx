'use client';

import { Zap, ChevronRight } from 'lucide-react';
import { cn, formatAmericanOdds } from '@/lib/utils';

export interface SharpMoneyData {
  matchup?: string;
  market?: string;
  outcome?: string;
  openPrice?: string | number;
  currentPrice?: string | number;
  movement?: string | number;
  direction?: 'shortening' | 'lengthening' | 'stable';
  isSharp?: boolean;
  bookmaker?: string;
  sampleCount?: string | number;
  timestamp?: string;
  description?: string;
  note?: string;
}

interface SharpMoneyCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: SharpMoneyData;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

export function SharpMoneyCard({
  title,
  category,
  subcategory,
  data,
  onAnalyze,
  isHero,
}: SharpMoneyCardProps) {
  const isSteam = !!data.isSharp;
  const isShorting = data.direction === 'shortening';
  const movementNum = Math.abs(Number(data.movement ?? 0));

  const isBullish = !isShorting;
  const dirArrow = isBullish ? '▲' : '▼';
  const dirColor = isBullish ? 'text-emerald-400' : 'text-red-400';
  const dirBg = isBullish ? 'from-emerald-600/25 dark:via-emerald-800/10' : 'from-red-600/25 dark:via-red-800/10';

  const magnitudeLabel = movementNum < 5 ? 'LOW' : movementNum < 15 ? 'MEDIUM' : 'HIGH';
  const confidenceColor =
    magnitudeLabel === 'HIGH'
      ? 'bg-red-500'
      : magnitudeLabel === 'MEDIUM'
      ? 'bg-amber-500'
      : 'bg-slate-500';
  const confidencePct = magnitudeLabel === 'HIGH' ? 85 : magnitudeLabel === 'MEDIUM' ? 55 : 25;

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow,0_0_40px_rgb(0_0_0/0.3))] transition-all duration-300',
        isSteam && 'border-amber-600/40 hover:border-amber-500/60',
        isHero && 'sm:rounded-3xl',
      )}
    >
      {/* Ambient gradient background */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none',
          'from-amber-600/25 dark:via-orange-800/10 to-transparent',
        )}
        aria-hidden="true"
      />

      {/* Steam move banner */}
      {isSteam && (
        <div className="relative flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-amber-900/30 border-b border-amber-700/30 text-amber-400 z-10">
          <Zap className="w-3 h-3 shrink-0 animate-pulse" aria-hidden="true" />
          <span>Steam Move — Sharp Money Detected</span>
          <span className="ml-auto px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[9px]">
            STEAM
          </span>
        </div>
      )}

      <div className="relative z-10 pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {category}
            </span>
            <span className="text-[var(--text-faint)]">/</span>
            <span className="text-[9px] text-[var(--text-faint)] truncate">{subcategory}</span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--bg-overlay)] text-[var(--text-muted)] border border-[var(--border-subtle)] shrink-0">
            SHARP
          </span>
        </div>

        <h3 className="text-sm font-black text-foreground mb-0.5 truncate">{title}</h3>
        {data.matchup && (
          <p className="text-[10px] text-[var(--text-muted)] mb-4 truncate">{data.matchup}</p>
        )}
        {!data.matchup && <div className="mb-4" />}

        {/* Direction hero: massive arrow + movement */}
        <div className="flex items-center gap-4 mb-4 px-4 py-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          {/* Big directional arrow */}
          <div className={cn('text-6xl font-black leading-none select-none', dirColor)}>
            {dirArrow}
          </div>

          {/* Side stats */}
          <div className="flex-1 space-y-1.5">
            {/* Movement chip */}
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-xs font-black px-2.5 py-1 rounded-lg border',
                isBullish
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/15 border-red-500/30 text-red-300',
              )}>
                {isShorting ? '−' : '+'}{movementNum} pts
              </span>
              <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide">
                {isShorting ? 'Shortening' : 'Lengthening'}
              </span>
            </div>

            {/* Outcome */}
            {data.outcome && (
              <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                Side: <span className="text-foreground">{data.outcome}</span>
              </p>
            )}

            {/* Bookmaker */}
            {data.bookmaker && (
              <p className="text-[10px] text-[var(--text-faint)]">
                via <span className="font-semibold text-[var(--text-muted)]">{data.bookmaker}</span>
              </p>
            )}
          </div>
        </div>

        {/* Opening → Current price comparison */}
        {data.openPrice !== undefined && data.currentPrice !== undefined && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Opening</p>
              <p className="text-xl font-black text-[var(--text-muted)] tabular-nums">
                {formatAmericanOdds(data.openPrice)}
              </p>
            </div>

            <div className="text-[var(--text-faint)] text-lg font-black">→</div>

            <div className="flex-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Current</p>
              <p className={cn('text-xl font-black tabular-nums', dirColor)}>
                {formatAmericanOdds(data.currentPrice)}
              </p>
            </div>
          </div>
        )}

        {/* Confidence bar */}
        <div className="mb-4 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
              Signal Confidence
            </span>
            <span className={cn(
              'text-[9px] font-black uppercase tracking-wide',
              magnitudeLabel === 'HIGH' ? 'text-red-400' : magnitudeLabel === 'MEDIUM' ? 'text-amber-400' : 'text-slate-400',
            )}>
              {magnitudeLabel}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', confidenceColor)}
              style={{ width: `${confidencePct}%` }}
            />
          </div>
        </div>

        {/* Description */}
        {data.description && (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 px-3 py-2.5 text-[10px] text-[var(--text-muted)] mb-3 leading-relaxed">
            {data.description}
          </div>
        )}

        {/* Footer meta */}
        <div className="flex items-center justify-between text-[10px] text-[var(--text-faint)]">
          {data.sampleCount !== undefined && (
            <span>{data.sampleCount} snapshots</span>
          )}
          {data.timestamp && (
            <span className="ml-auto">{data.timestamp}</span>
          )}
        </div>

        {data.note && (
          <p className="mt-2 text-[11px] text-[var(--text-muted)] italic">{data.note}</p>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-amber-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
          >
            Full Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
