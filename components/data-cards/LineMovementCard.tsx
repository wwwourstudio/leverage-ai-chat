'use client';

import { TrendingUp, TrendingDown, Activity, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LineMovementData {
  matchup?: string;
  lineChange?: string;
  oldLine?: string;
  newLine?: string;
  bookmaker?: string;
  timestamp?: string;
  isSteamMove?: boolean;
  direction?: 'UP' | 'DOWN';
  sharpMoney?: string;
  description?: string;
  note?: string;
  tracking?: string;
  status?: string;
  realData?: boolean;
}

interface LineMovementCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: LineMovementData;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

export function LineMovementCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  onAnalyze,
  isHero,
}: LineMovementCardProps) {
  const isSteam = !!data.isSteamMove;
  const isUp = data.direction === 'UP';
  const hasMovement = !!(data.oldLine && data.newLine);

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border transition-all duration-200 animate-fade-in-up',
        isSteam
          ? 'border-red-600/40 hover:border-red-500/60'
          : 'border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)]',
        isHero && 'sm:rounded-3xl',
      )}
    >
      <div
        className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)}
        aria-hidden="true"
      />

      {isSteam && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest bg-red-900/20 border-b border-red-700/20 text-red-400">
          <Zap className="w-3 h-3 shrink-0" aria-hidden="true" />
          Steam Move Detected — Heavy Sharp Action
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

        {hasMovement ? (
          <>
            {/* Line movement visualization */}
            <div className="flex items-center justify-between bg-[oklch(0.09_0.01_280)] rounded-xl border border-[oklch(0.18_0.015_280)] p-4 mb-3">
              <div className="text-center flex-1">
                <p className="text-[9px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-1.5">Opening</p>
                <p className="text-xl font-black text-[oklch(0.60_0.01_280)] tabular-nums">{data.oldLine}</p>
              </div>

              <div className="flex flex-col items-center gap-1 px-4">
                {isUp ? (
                  <TrendingUp className="w-6 h-6 text-emerald-400" aria-hidden="true" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-400" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    'text-sm font-black tabular-nums',
                    isUp ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {data.lineChange}
                </span>
              </div>

              <div className="text-center flex-1">
                <p className="text-[9px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-1.5">Current</p>
                <p
                  className={cn(
                    'text-xl font-black tabular-nums',
                    isUp ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {data.newLine}
                </p>
              </div>
            </div>

            {/* Sharp / public split bar */}
            {data.sharpMoney && (() => {
              const sharpMatch = String(data.sharpMoney).match(/(\d+)/);
              const sharpNum = sharpMatch ? parseInt(sharpMatch[1]) : null;
              const publicNum = sharpNum !== null ? 100 - sharpNum : null;
              return sharpNum !== null ? (
                <div className="rounded-xl bg-[oklch(0.09_0.01_280)] border border-[oklch(0.18_0.015_280)] px-3 py-2.5 space-y-1.5">
                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-wide">
                    <span className="text-[oklch(0.42_0.01_280)]">Public {publicNum}%</span>
                    <span className={sharpNum >= 60 ? 'text-amber-400' : 'text-[oklch(0.55_0.01_280)]'}>Sharp {sharpNum}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden flex">
                    <div className="h-full bg-[oklch(0.30_0.01_280)]" style={{ width: `${publicNum}%` }} />
                    <div className={cn('h-full', sharpNum >= 60 ? 'bg-amber-500' : 'bg-blue-500/70')} style={{ width: `${sharpNum}%` }} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[oklch(0.45_0.01_280)]">Sharp Action</span>
                  <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.sharpMoney}</span>
                </div>
              );
            })()}

            {/* Follow / Fade recommendation */}
            {(isSteam || data.sharpMoney) && (() => {
              const sharpMatch = String(data.sharpMoney ?? '').match(/(\d+)/);
              const sharpNum = sharpMatch ? parseInt(sharpMatch[1]) : null;
              const followSharp = isSteam || (sharpNum !== null && sharpNum >= 65);
              return (
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-semibold',
                  followSharp
                    ? 'bg-amber-500/8 border-amber-500/20 text-amber-300'
                    : 'bg-[oklch(0.10_0.01_280)] border-[oklch(0.19_0.015_280)] text-[oklch(0.55_0.01_280)]',
                )}>
                  {followSharp
                    ? (isUp ? <TrendingUp className="w-3 h-3 shrink-0" /> : <TrendingDown className="w-3 h-3 shrink-0" />)
                    : <Activity className="w-3 h-3 shrink-0" />}
                  {followSharp
                    ? `Follow sharp money — line trending ${isUp ? 'up' : 'down'}`
                    : 'Monitor — insufficient sharp signal'}
                </div>
              );
            })()}

            {/* Details row */}
            <div className="space-y-1.5 text-xs">
              {data.bookmaker && (
                <div className="flex items-center justify-between">
                  <span className="text-[oklch(0.45_0.01_280)]">Source</span>
                  <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.bookmaker}</span>
                </div>
              )}
              {data.timestamp && (
                <div className="flex items-center justify-between">
                  <span className="text-[oklch(0.45_0.01_280)]">Updated</span>
                  <span className="text-[oklch(0.50_0.01_280)]">{data.timestamp}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Fallback / monitoring state */
          <div className="py-2 space-y-2">
            {data.description && (
              <p className="text-sm text-[oklch(0.65_0.01_280)]">{data.description}</p>
            )}
            {data.note && (
              <p className="text-xs text-[oklch(0.45_0.01_280)]">{data.note}</p>
            )}
            {data.tracking && (
              <p className="text-xs text-[oklch(0.45_0.01_280)]">Tracking: {data.tracking}</p>
            )}
          </div>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-[oklch(0.85_0.005_85)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
            aria-label="Analyze line movement"
          >
            Full Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
