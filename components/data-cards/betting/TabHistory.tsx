'use client';

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BettingCardData } from './betting-utils';
import { TabSpinner } from './betting-shared';

export function TabHistory({ data, onAnalyze, onAsk, loading = false }: {
  data: BettingCardData; onAnalyze?: () => void; onAsk?: (q: string) => void; loading?: boolean;
}) {
  if (loading) return <TabSpinner />;

  const history = Array.isArray(data.h2hHistory) ? data.h2hHistory : [];
  const matchup = data.matchup ?? data.game ?? '';

  return (
    <div className="space-y-3">
      {(data.atsRecord || data.h2hRecord) && (
        <div className="flex gap-2 flex-wrap">
          {data.atsRecord && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-black text-[var(--text-muted)]">
              ATS <span className="text-foreground">{data.atsRecord}</span>
            </span>
          )}
          {data.h2hRecord && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-black text-[var(--text-muted)]">
              H2H <span className="text-foreground">{data.h2hRecord}</span>
            </span>
          )}
        </div>
      )}
      {history.length > 0 ? (
        <div className="space-y-1.5">
          {history.map((h: any, i: number) => {
            const handleClick = onAsk
              ? () => onAsk(`Analyze this ${matchup} H2H matchup — ${h.date} final score ${h.score ?? h.result}, winner: ${h.winner ?? 'unknown'}. What trends matter for today's game?`)
              : undefined;
            return (
              <div
                key={i}
                onClick={handleClick}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-overlay)] border border-[var(--border-subtle)] transition-colors',
                  handleClick && 'cursor-pointer hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] active:scale-[0.99]',
                )}
              >
                <span className="text-[10px] text-[var(--text-muted)]">{h.date}</span>
                <span className="text-[10px] font-bold text-foreground tabular-nums">{h.score ?? h.result}</span>
                {h.betResult != null ? (
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black border', h.betResult === 'hit' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-red-500/15 text-red-300 border-red-500/30')}>
                    {h.betResult === 'hit' ? 'HIT' : 'MISS'}
                  </span>
                ) : h.winner != null ? (
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black border uppercase', h.won === true ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : h.won === false ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-white/10 text-white/60 border-white/15')}>
                    {String(h.winner).toUpperCase()}
                  </span>
                ) : null}
                {handleClick && <ChevronRight className="w-3 h-3 text-[var(--text-faint)] shrink-0" />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-[11px] text-[var(--text-muted)]">No detailed history available</p>
          {onAnalyze && (
            <button onClick={onAnalyze} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] hover:text-foreground hover:border-[var(--border-hover)] transition-all">
              Ask AI for head-to-head history →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
