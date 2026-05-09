'use client';

import { Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BettingCardData } from './betting-utils';

export function TabProps({ data, onAnalyze, onAsk, loading = false }: {
  data: BettingCardData; onAnalyze?: () => void; onAsk?: (q: string) => void; loading?: boolean;
}) {
  const props = Array.isArray(data.playerProps) ? data.playerProps : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 rounded-full border-2 border-[var(--border-subtle)] border-t-white/60 animate-spin" />
      </div>
    );
  }

  if (props.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Users className="w-8 h-8 text-[var(--text-faint)]" />
        <p className="text-[11px] text-[var(--text-muted)]">No prop data available for this game</p>
        {onAnalyze && (
          <button onClick={onAnalyze} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] hover:text-foreground hover:border-[var(--border-hover)] transition-all">
            Ask AI about player props for this game →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {props.map((p: any, i: number) => {
        const oddsNum = parseFloat(p.odds);
        const hitRate = parseFloat(p.hitRate);
        const handleClick = onAsk ? () => onAsk(`Show me the prop card for ${p.player} ${p.stat} ${p.line} — analysis, hit rate, and betting value`) : undefined;
        return (
          <div
            key={i}
            onClick={handleClick}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] transition-colors',
              handleClick && 'cursor-pointer hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] active:scale-[0.99]',
            )}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-foreground truncate">{p.player}</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">{p.team} · {p.stat}</p>
            </div>
            <span className="text-[11px] font-bold text-[var(--text-faint)] tabular-nums shrink-0">{p.line}</span>
            {p.odds && (
              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black border shrink-0', !isNaN(oddsNum) && oddsNum > 0 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' : 'bg-red-500/10 text-red-300 border-red-500/25')}>
                {!isNaN(oddsNum) && oddsNum > 0 ? `+${p.odds}` : p.odds}
              </span>
            )}
            {p.hitRate != null && (
              <span className={cn('text-[10px] font-black tabular-nums shrink-0', !isNaN(hitRate) && hitRate >= 65 ? 'text-emerald-400' : !isNaN(hitRate) && hitRate <= 35 ? 'text-red-400' : 'text-white/70')}>
                {p.hitRate}%
              </span>
            )}
            {handleClick && <ChevronRight className="w-3 h-3 text-[var(--text-faint)] shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}
