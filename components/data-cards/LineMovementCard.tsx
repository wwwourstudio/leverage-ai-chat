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
  data,
  onAnalyze,
  isHero,
}: LineMovementCardProps) {
  const isSteam = !!data.isSteamMove;
  const isUp = data.direction === 'UP';
  const hasMovement = !!(data.oldLine && data.newLine);

  const movColor = isUp ? 'text-emerald-400' : 'text-red-400';
  const movBg = isUp
    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
    : 'bg-red-500/15 border-red-500/30 text-red-300';

  // Parse sharp money percentage
  const sharpMatch = String(data.sharpMoney ?? '').match(/(\d+)/);
  const sharpNum = sharpMatch ? parseInt(sharpMatch[1]) : null;
  const publicNum = sharpNum !== null ? 100 - sharpNum : null;
  const followSharp = isSteam || (sharpNum !== null && sharpNum >= 65);

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow,0_0_40px_rgb(0_0_0/0.3))] transition-all duration-300',
        isSteam && 'border-amber-600/40 hover:border-amber-500/60',
        isHero && 'sm:rounded-3xl',
      )}
    >
      {/* Ambient gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-violet-600/25 dark:via-purple-800/10 to-transparent opacity-60 pointer-events-none"
        aria-hidden="true"
      />

      {/* Steam banner */}
      {isSteam && (
        <div className="relative z-10 flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-amber-900/30 border-b border-amber-700/30 text-amber-400">
          <Zap className="w-3 h-3 shrink-0 animate-pulse" aria-hidden="true" />
          <span>Steam Move Detected — Heavy Sharp Action</span>
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
            <span className="text-[9px] text-[var(--text-faint)]">{subcategory}</span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--bg-overlay)] text-[var(--text-muted)] border border-[var(--border-subtle)] shrink-0">
            LINE
          </span>
        </div>

        <h3 className="text-sm font-black text-foreground mb-4 truncate">{title}</h3>

        {hasMovement ? (
          <>
            {/* Old → New line hero comparison */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 text-center">
                <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-2">Opening</p>
                <p className="text-2xl font-black text-[var(--text-muted)] tabular-nums">{data.oldLine}</p>
              </div>

              {/* Center arrow + change chip */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                {isUp ? (
                  <TrendingUp className={cn('w-5 h-5', movColor)} aria-hidden="true" />
                ) : (
                  <TrendingDown className={cn('w-5 h-5', movColor)} aria-hidden="true" />
                )}
                {data.lineChange && (
                  <span className={cn('text-xs font-black px-2.5 py-1 rounded-lg border tabular-nums', movBg)}>
                    {data.lineChange}
                  </span>
                )}
              </div>

              <div className="flex-1 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 text-center">
                <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-2">Current</p>
                <p className={cn('text-2xl font-black tabular-nums', movColor)}>{data.newLine}</p>
              </div>
            </div>

            {/* Sharp vs Public split bar */}
            {sharpNum !== null && publicNum !== null && (
              <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-3 space-y-2 mb-3">
                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wide">
                  <span className="text-[var(--text-faint)]">Public {publicNum}%</span>
                  <span className={sharpNum >= 60 ? 'text-amber-400' : 'text-[var(--text-muted)]'}>
                    Sharp {sharpNum}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden flex gap-0.5">
                  <div
                    className="h-full bg-[var(--bg-overlay)] rounded-l-full"
                    style={{ width: `${publicNum}%` }}
                  />
                  <div
                    className={cn(
                      'h-full rounded-r-full',
                      sharpNum >= 60 ? 'bg-amber-500' : 'bg-violet-500/70',
                    )}
                    style={{ width: `${sharpNum}%` }}
                  />
                </div>
              </div>
            )}

            {/* Text-only sharp money display if no number parsed */}
            {sharpNum === null && data.sharpMoney && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] mb-3 text-xs">
                <span className="text-[var(--text-muted)]">Sharp Action</span>
                <span className="font-semibold text-foreground">{data.sharpMoney}</span>
              </div>
            )}

            {/* Signal recommendation */}
            {(isSteam || data.sharpMoney) && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[10px] font-semibold mb-3',
                followSharp
                  ? 'bg-amber-500/8 border-amber-500/20 text-amber-300'
                  : 'bg-[var(--bg-overlay)] border-[var(--border-subtle)] text-[var(--text-muted)]',
              )}>
                {followSharp ? (
                  isUp
                    ? <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                    : <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Activity className="w-3.5 h-3.5 shrink-0" />
                )}
                {followSharp
                  ? `Follow sharp money — line trending ${isUp ? 'up' : 'down'}`
                  : 'Monitor — insufficient sharp signal'}
              </div>
            )}

            {/* Footer: book + timestamp */}
            <div className="flex items-center justify-between text-[10px] text-[var(--text-faint)]">
              {data.bookmaker && (
                <span>
                  via <span className="font-semibold text-[var(--text-muted)]">{data.bookmaker}</span>
                </span>
              )}
              {data.timestamp && <span className="ml-auto">{data.timestamp}</span>}
            </div>
          </>
        ) : (
          /* Fallback / monitoring state */
          <div className="py-2 space-y-3">
            {data.description && (
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">{data.description}</p>
            )}
            {data.note && (
              <p className="text-xs text-[var(--text-faint)]">{data.note}</p>
            )}
            {data.tracking && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
                <Activity className="w-3.5 h-3.5 text-violet-400/60 shrink-0" />
                Tracking: {data.tracking}
              </div>
            )}
          </div>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-violet-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
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
