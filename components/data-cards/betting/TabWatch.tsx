'use client';

import { useState, useCallback } from 'react';
import { Bookmark, ChevronRight, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BettingCardData } from './betting-utils';
import { PlayerAvatar } from '@/components/data-cards/PlayerAvatar';

const WATCHLIST_KEY = 'leverage_watchlist';

function WatchPlayerRow({ p, sport, onAsk }: { p: any; sport?: string; onAsk?: (q: string) => void }) {
  const key = `bookmark:player:${(p.player ?? '').toLowerCase().replace(/\s+/g, '_')}`;
  const [saved, setSaved] = useState(() => { try { return !!localStorage.getItem(key); } catch { return false; } });

  const toggle = useCallback(() => {
    setSaved(prev => {
      const next = !prev;
      try {
        if (next) {
          localStorage.setItem(key, '1');
          const list = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]');
          if (!list.find((e: any) => e.name === p.player)) {
            list.unshift({ name: p.player, position: p.position ?? '', team: p.team ?? '', addedAt: new Date().toISOString() });
            localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
          }
          window.dispatchEvent(new CustomEvent('watchlist-update', { detail: { count: JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]').length } }));
        } else {
          localStorage.removeItem(key);
          const list = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]').filter((e: any) => e.name !== p.player);
          localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
          window.dispatchEvent(new CustomEvent('watchlist-update', { detail: { count: list.length } }));
        }
      } catch {}
      return next;
    });
  }, [key, p.player, p.position, p.team]);

  return (
    <div
      onClick={onAsk ? () => onAsk(`Show me stats and prop card for ${p.player} (${p.team}) — ${p.reason}`) : undefined}
      className={cn('flex items-start gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] transition-colors', onAsk && 'cursor-pointer hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] active:scale-[0.99]')}
    >
      <PlayerAvatar playerName={p.player} photoUrl={p.photoUrl} sport={sport} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black text-foreground truncate">{p.player}</p>
        <p className="text-[10px] text-[var(--text-muted)] mb-1">{p.team}</p>
        <p className="text-[10px] text-[var(--text-faint)] leading-relaxed">{p.reason}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        title={saved ? 'Remove from bookmarks' : 'Bookmark player'}
        className={cn('flex-shrink-0 p-1.5 rounded-lg transition-all', saved ? 'text-blue-500 bg-blue-500/10 border border-blue-500/20' : 'text-[var(--text-faint)] hover:text-blue-400 hover:bg-blue-500/10')}
      >
        <Bookmark className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} />
      </button>
      {onAsk && <ChevronRight className="w-3 h-3 text-[var(--text-faint)] self-center shrink-0" />}
    </div>
  );
}

export function TabWatch({ data, onAnalyze, onAsk }: {
  data: BettingCardData; onAnalyze?: () => void; onAsk?: (q: string) => void;
}) {
  const players = Array.isArray(data.playersToWatch) ? data.playersToWatch : [];

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Eye className="w-8 h-8 text-[var(--text-faint)]" />
        <p className="text-[11px] text-[var(--text-muted)]">No watch list available</p>
        {onAnalyze && (
          <button onClick={onAnalyze} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] hover:text-foreground hover:border-[var(--border-hover)] transition-all">
            Ask AI who to watch in this game →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {players.map((p: any, i: number) => (
        <WatchPlayerRow key={i} p={p} sport={data.sport} onAsk={onAsk} />
      ))}
    </div>
  );
}
