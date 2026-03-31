'use client';

import { TrendingUp, TrendingDown, Zap, Activity, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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

function formatAmericanOdds(val: string | number | undefined): string {
  if (val === undefined) return '—';
  const n = Number(val);
  return n > 0 ? `+${n}` : String(n);
}

export function SharpMoneyCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  onAnalyze,
  isHero,
}: SharpMoneyCardProps) {
  const isSteam = !!data.isSharp;
  const isShorting = data.direction === 'shortening';
  const movementNum = Math.abs(Number(data.movement ?? 0));

  const movColor = isShorting ? 'text-red-400' : 'text-emerald-400';

  const magnitudeLabel = movementNum < 5 ? 'MINOR' : movementNum < 15 ? 'MODERATE' : 'MAJOR';
  const magnitudeColor = movementNum >= 15 ? 'text-red-400' : movementNum >= 5 ? 'text-amber-400' : 'text-slate-400';

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border transition-all duration-200 animate-fade-in-up',
        isSteam
          ? 'border-red-600/50 hover:border-red-500/70 hover:shadow-[0_0_35px_oklch(0.4_0.18_25/0.15)]'
          : 'border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)]',
        isHero && 'sm:rounded-3xl',
      )}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} aria-hidden="true" />

      {/* Steam banner */}
      {isSteam && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest bg-red-900/25 border-b border-red-700/25 text-red-400">
          <Zap className="w-3 h-3 shrink-0 animate-pulse" aria-hidden="true" />
          Steam Move — Sharp Money Detected
        </div>
      )}

      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">
              {category}
            </span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[oklch(0.10_0.01_280)] text-[oklch(0.45_0.01_280)] border border-[oklch(0.20_0.015_280)] shrink-0">
            {subcategory}
          </span>
        </div>

        <h3 className="text-sm font-black text-[oklch(0.92_0.005_85)] mb-4 truncate">{title}</h3>

        {/* Line movement visualization */}
        {(data.openPrice !== undefined && data.currentPrice !== undefined) ? (
          <div className="flex items-center justify-between bg-[oklch(0.09_0.01_280)] rounded-xl border border-[oklch(0.18_0.015_280)] p-4 mb-3">
            <div className="text-center flex-1">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-1.5">Opening</p>
              <p className="text-xl font-black text-[oklch(0.55_0.01_280)] tabular-nums">
                {formatAmericanOdds(data.openPrice)}
              </p>
            </div>

            <div className="flex flex-col items-center gap-1 px-4">
              {isShorting ? (
                <TrendingDown className={cn('w-6 h-6', movColor)} aria-hidden="true" />
              ) : (
                <TrendingUp className={cn('w-6 h-6', movColor)} aria-hidden="true" />
              )}
              <span className={cn('text-sm font-black tabular-nums', movColor)}>
                {isShorting ? '-' : '+'}{movementNum}
              </span>
            </div>

            <div className="text-center flex-1">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-1.5">Current</p>
              <p className={cn('text-xl font-black tabular-nums', movColor)}>
                {formatAmericanOdds(data.currentPrice)}
              </p>
            </div>
          </div>
        ) : (
          data.description && (
            <p className="text-sm text-[oklch(0.65_0.01_280)] mb-3">{data.description}</p>
          )
        )}

        {/* Details */}
        <div className="space-y-1.5 text-xs">
          {data.market && (
            <div className="flex justify-between">
              <span className="text-[oklch(0.45_0.01_280)]">Market</span>
              <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.market}</span>
            </div>
          )}
          {data.bookmaker && (
            <div className="flex justify-between">
              <span className="text-[oklch(0.45_0.01_280)]">Source</span>
              <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.bookmaker}</span>
            </div>
          )}
          {data.sampleCount !== undefined && (
            <div className="flex justify-between">
              <span className="text-[oklch(0.45_0.01_280)]">Snapshots</span>
              <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.sampleCount}</span>
            </div>
          )}
          {data.timestamp && (
            <div className="flex justify-between">
              <span className="text-[oklch(0.45_0.01_280)]">Last Updated</span>
              <span className="text-[oklch(0.50_0.01_280)]">{data.timestamp}</span>
            </div>
          )}
        </div>

        {/* Magnitude + action recommendation */}
        <div className={cn(
          'rounded-lg px-3 py-2 text-[10px] font-semibold mt-3 flex items-start justify-between gap-3',
          isSteam
            ? 'bg-red-500/10 border border-red-500/20 text-red-300'
            : 'bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)] text-[oklch(0.55_0.01_280)]',
        )}>
          <span>
            {isSteam
              ? `⚡ Sharp steam — ${isShorting ? 'follow the shortening price' : 'price drifting with sharp backing'}`
              : `${magnitudeLabel} move — confirm with volume before acting`}
          </span>
          <span className={cn('text-[9px] font-black uppercase tracking-wider shrink-0', magnitudeColor)}>
            {magnitudeLabel}
          </span>
        </div>

        {data.note && (
          <p className="mt-3 text-[11px] text-[oklch(0.50_0.01_280)] italic">{data.note}</p>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-red-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
          >
            Full Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
