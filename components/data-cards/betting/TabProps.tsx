'use client';

import { Users, ChevronRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BettingCardData } from './betting-utils';

export function TabProps({ data, onAnalyze, onAsk, loading = false }: {
  data: BettingCardData; onAnalyze?: () => void; onAsk?: (q: string) => void; loading?: boolean;
}) {
  const props = Array.isArray(data.playerProps) ? data.playerProps : [];

  if (loading) {
    return (
      <div className="space-y-2 py-2 px-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="h-10 rounded-xl bg-[var(--bg-elevated)] animate-card-shimmer"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    );
  }

  if (props.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
          <Users className="w-6 h-6 text-[var(--text-faint)]" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-[var(--text-muted)]">No prop data available for this game</p>
          <p className="text-[10px] text-[var(--text-faint)] mt-0.5">Props typically post 24–48h before tip-off</p>
        </div>
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] hover:text-foreground hover:border-[var(--border-hover)] transition-all"
          >
            Ask AI about player props for this game →
          </button>
        )}
      </div>
    );
  }

  // Group props by player name
  const grouped: Record<string, any[]> = {};
  for (const p of props) {
    const key = p.player ?? 'Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([playerName, playerProps]) => (
        <div key={playerName} className="rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] overflow-hidden">
          {/* Player header */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
            <div className="w-6 h-6 rounded-lg bg-white/5 border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
              <span className="text-[9px] font-black text-[var(--text-muted)]">
                {(playerName || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-foreground truncate">{playerName}</p>
              {playerProps[0]?.team && (
                <p className="text-[9px] text-[var(--text-faint)] truncate">{playerProps[0].team}</p>
              )}
            </div>
          </div>

          {/* Prop rows */}
          <div className="divide-y divide-[var(--border-subtle)]">
            {playerProps.map((p: any, i: number) => {
              const oddsNum = parseFloat(p.odds);
              const hitRate = parseFloat(p.hitRate);
              const hasHitRate = p.hitRate != null && !isNaN(hitRate);
              const hitColor = hasHitRate
                ? hitRate >= 65 ? 'bg-emerald-500' : hitRate <= 35 ? 'bg-red-500' : 'bg-amber-500'
                : 'bg-[var(--bg-elevated)]';
              const handleClick = onAsk
                ? () => onAsk(`Show me the prop card for ${p.player} ${p.stat} ${p.line} — analysis, hit rate, and betting value`)
                : undefined;

              return (
                <div
                  key={i}
                  onClick={handleClick}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-3 transition-colors',
                    handleClick && 'cursor-pointer hover:bg-[var(--bg-elevated)] active:scale-[0.99]',
                  )}
                >
                  {/* Stat + line */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[var(--text-muted)] truncate">{p.stat}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-black text-white tabular-nums">{p.line}</span>
                      {hasHitRate && (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <div className="flex-1 h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden max-w-16">
                            <div
                              className={cn('h-full rounded-full transition-all duration-500', hitColor)}
                              style={{ width: `${Math.min(100, hitRate)}%` }}
                            />
                          </div>
                          <span className={cn(
                            'text-[9px] font-black tabular-nums',
                            hitRate >= 65 ? 'text-emerald-400' : hitRate <= 35 ? 'text-red-400' : 'text-amber-400',
                          )}>
                            {p.hitRate}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Odds chip */}
                  {p.odds && (
                    <span className={cn(
                      'shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-black border tabular-nums',
                      !isNaN(oddsNum) && oddsNum > 0
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                        : 'bg-red-500/8 text-red-300 border-red-500/20',
                    )}>
                      {!isNaN(oddsNum) && oddsNum > 0 ? `+${p.odds}` : p.odds}
                    </span>
                  )}

                  {handleClick && (
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)] shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {onAsk && props.length > 0 && (
        <button
          onClick={() => onAsk(`Give me full analysis on all player props for this game — which ones have the best value?`)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:border-[var(--border-hover)] transition-all"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Full props analysis →
        </button>
      )}
    </div>
  );
}
