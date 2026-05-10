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
      className={cn(
        'flex items-start gap-3 px-3.5 py-3 rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] transition-all',
        onAsk && 'cursor-pointer hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] active:scale-[0.99]',
      )}
    >
      {/* Player avatar */}
      <div className="shrink-0 mt-0.5">
        <PlayerAvatar playerName={p.player} photoUrl={p.photoUrl} sport={sport} size="md" />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <p className="text-[12px] font-black text-foreground truncate leading-tight">{p.player}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {p.position && (
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/8 border border-white/10 text-white/50">
                  {p.position}
                </span>
              )}
              {p.team && (
                <span className="text-[10px] text-[var(--text-faint)]">{p.team}</span>
              )}
              {p.price && (
                <span className="ml-1 text-[10px] font-black tabular-nums px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  {p.price}
                </span>
              )}
            </div>
          </div>

          {/* Watch / bookmark toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            title={saved ? 'Remove from bookmarks' : 'Bookmark player'}
            className={cn(
              'shrink-0 w-7 h-7 flex items-center justify-center rounded-xl transition-all border',
              saved
                ? 'text-blue-400 bg-blue-500/15 border-blue-500/25 shadow-sm shadow-blue-500/10'
                : 'text-[var(--text-faint)] hover:text-blue-400 hover:bg-blue-500/10 border-transparent hover:border-blue-500/20',
            )}
          >
            <Bookmark className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Reason / insight */}
        {p.reason && (
          <p className="text-[10px] text-[var(--text-faint)] leading-relaxed line-clamp-2">{p.reason}</p>
        )}
      </div>

      {onAsk && (
        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)] self-center shrink-0" />
      )}
    </div>
  );
}

export function TabWatch({ data, onAnalyze, onAsk }: {
  data: BettingCardData; onAnalyze?: () => void; onAsk?: (q: string) => void;
}) {
  const players = Array.isArray(data.playersToWatch) ? data.playersToWatch : [];

  // Group by team if available
  const grouped: Record<string, any[]> = {};
  for (const p of players) {
    const team = p.team ?? 'Players to Watch';
    if (!grouped[team]) grouped[team] = [];
    grouped[team].push(p);
  }
  const hasMultipleTeams = Object.keys(grouped).length > 1;

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
          <Eye className="w-6 h-6 text-[var(--text-faint)]" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-[var(--text-muted)]">No watch list available</p>
          <p className="text-[10px] text-[var(--text-faint)] mt-0.5">Players to watch are added by AI analysis</p>
        </div>
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] hover:text-foreground hover:border-[var(--border-hover)] transition-all"
          >
            Ask AI who to watch in this game →
          </button>
        )}
      </div>
    );
  }

  // If only one team or no team, render flat list
  if (!hasMultipleTeams) {
    return (
      <div className="space-y-2">
        {players.map((p: any, i: number) => (
          <WatchPlayerRow key={i} p={p} sport={data.sport} onAsk={onAsk} />
        ))}
      </div>
    );
  }

  // Grouped by team
  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([team, teamPlayers]) => (
        <div key={team}>
          <div className="flex items-center gap-2 mb-1.5 px-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">{team}</span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>
          <div className="space-y-1.5">
            {teamPlayers.map((p: any, i: number) => (
              <WatchPlayerRow key={i} p={p} sport={data.sport} onAsk={onAsk} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
