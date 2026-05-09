'use client';

import { ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BettingCardData } from './betting-utils';
import { TabSpinner } from './betting-shared';

// Parse W-L-D record strings like "12-8" or "5-3-1"
function parseRecord(rec: string): { w: number; l: number; d: number } | null {
  const parts = rec.split('-').map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return null;
  return { w: parts[0], l: parts[1], d: parts[2] ?? 0 };
}

export function TabHistory({ data, onAnalyze, onAsk, loading = false }: {
  data: BettingCardData; onAnalyze?: () => void; onAsk?: (q: string) => void; loading?: boolean;
}) {
  if (loading) return <TabSpinner />;

  const history = Array.isArray(data.h2hHistory) ? data.h2hHistory : [];
  const matchup = data.matchup ?? data.game ?? '';

  // Build last-5 mini trend from history
  const last5 = history.slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Record summary chips */}
      {(data.atsRecord || data.h2hRecord) && (
        <div className="flex gap-2 flex-wrap">
          {data.h2hRecord && (() => {
            const rec = parseRecord(data.h2hRecord);
            return (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">H2H</span>
                {rec ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] font-black text-emerald-400 tabular-nums">{rec.w}</span>
                    <span className="text-[10px] text-[var(--text-faint)]">-</span>
                    {rec.d > 0 && (
                      <>
                        <span className="text-[12px] font-black text-amber-400 tabular-nums">{rec.d}</span>
                        <span className="text-[10px] text-[var(--text-faint)]">-</span>
                      </>
                    )}
                    <span className="text-[12px] font-black text-red-400 tabular-nums">{rec.l}</span>
                    {rec.d === 0 && (
                      <span className="text-[9px] text-[var(--text-faint)] ml-0.5">W-L</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm font-black text-foreground tabular-nums">{data.h2hRecord}</span>
                )}
              </div>
            );
          })()}
          {data.atsRecord && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">ATS</span>
              <span className="text-sm font-black text-foreground tabular-nums">{data.atsRecord}</span>
            </div>
          )}
        </div>
      )}

      {/* Last 5 trend squares */}
      {last5.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">Last {last5.length}</span>
          <div className="flex items-center gap-1">
            {last5.map((h: any, i: number) => {
              const isHit = h.betResult === 'hit' || h.won === true;
              const isMiss = h.betResult === 'miss' || h.won === false;
              return (
                <div
                  key={i}
                  title={h.score ?? h.result ?? ''}
                  className={cn(
                    'w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-black',
                    isHit ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                    : isMiss ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                    : 'bg-white/8 border border-white/15 text-white/40',
                  )}
                >
                  {isHit ? 'W' : isMiss ? 'L' : '·'}
                </div>
              );
            })}
          </div>
          <span className="text-[8px] text-[var(--text-faint)]">← recent</span>
        </div>
      )}

      {/* Game history rows */}
      {history.length > 0 ? (
        <div className="rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] overflow-hidden">
          {history.map((h: any, i: number) => {
            const handleClick = onAsk
              ? () => onAsk(`Analyze this ${matchup} H2H matchup — ${h.date} final score ${h.score ?? h.result}, winner: ${h.winner ?? 'unknown'}. What trends matter for today's game?`)
              : undefined;
            const isHit = h.betResult === 'hit' || h.won === true;
            const isMiss = h.betResult === 'miss' || h.won === false;

            return (
              <div
                key={i}
                onClick={handleClick}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 border-b border-[var(--border-subtle)] last:border-0 transition-colors',
                  i % 2 === 1 && 'bg-white/[0.015]',
                  handleClick && 'cursor-pointer hover:bg-[var(--bg-elevated)] active:scale-[0.99]',
                )}
              >
                {/* Result badge */}
                {(h.betResult != null || h.winner != null) && (
                  <div className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[9px] font-black',
                    isHit ? 'bg-emerald-500/20 border border-emerald-500/35 text-emerald-400'
                    : isMiss ? 'bg-red-500/20 border border-red-500/35 text-red-400'
                    : 'bg-white/8 border border-white/15 text-white/40',
                  )}>
                    {isHit ? 'W' : isMiss ? 'L' : '?'}
                  </div>
                )}

                {/* Date */}
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-faint)] shrink-0">
                  <Clock className="w-3 h-3" />
                  {h.date}
                </div>

                {/* Score */}
                <span className="text-[11px] font-black text-foreground tabular-nums flex-1 text-right">
                  {h.score ?? h.result ?? '—'}
                </span>

                {/* Winner label */}
                {h.winner && (
                  <span className="text-[9px] font-bold text-[var(--text-faint)] truncate max-w-[60px]">
                    {h.winner}
                  </span>
                )}

                {handleClick && (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)] shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
            <Clock className="w-6 h-6 text-[var(--text-faint)]" />
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">No detailed history available</p>
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] hover:text-foreground hover:border-[var(--border-hover)] transition-all"
            >
              Ask AI for head-to-head history →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
