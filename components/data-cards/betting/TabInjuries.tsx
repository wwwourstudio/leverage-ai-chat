'use client';

import { useState, useCallback } from 'react';
import { Bookmark, ChevronRight, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BettingCardData } from './betting-utils';
import { TabSpinner } from './betting-shared';

const WATCHLIST_KEY = 'leverage_watchlist';

function InjuryRow({ inj, statusCls, onAsk }: { inj: any; statusCls: (s: string) => string; onAsk?: (q: string) => void }) {
  const key = `bookmark:player:${(inj.player ?? '').toLowerCase().replace(/\s+/g, '_')}`;
  const [saved, setSaved] = useState(() => { try { return !!localStorage.getItem(key); } catch { return false; } });

  const toggle = useCallback(() => {
    setSaved(prev => {
      const next = !prev;
      try {
        if (next) {
          localStorage.setItem(key, '1');
          const list = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]');
          if (!list.find((e: any) => e.name === inj.player)) {
            list.unshift({ name: inj.player, position: inj.position ?? '', team: inj.team ?? '', addedAt: new Date().toISOString() });
            localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
          }
          window.dispatchEvent(new CustomEvent('watchlist-update', { detail: { count: JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]').length } }));
        } else {
          localStorage.removeItem(key);
          const list = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]').filter((e: any) => e.name !== inj.player);
          localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
          window.dispatchEvent(new CustomEvent('watchlist-update', { detail: { count: list.length } }));
        }
      } catch {}
      return next;
    });
  }, [key, inj.player, inj.position, inj.team]);

  return (
    <div
      onClick={onAsk ? () => onAsk(`Show me the injury analysis and betting impact for ${inj.player} (${inj.status}) on the ${inj.team}`) : undefined}
      className={cn('px-3 py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] transition-colors', onAsk && 'cursor-pointer hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] active:scale-[0.99]')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black text-foreground truncate">{inj.player}</p>
          <p className="text-[10px] text-[var(--text-muted)]">{inj.team}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black border', statusCls(inj.status))}>
            {inj.status?.toUpperCase()}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            title={saved ? 'Remove from bookmarks' : 'Bookmark player'}
            className={cn('p-1.5 rounded-lg transition-all', saved ? 'text-blue-500 bg-blue-500/10 border border-blue-500/20' : 'text-[var(--text-faint)] hover:text-blue-400 hover:bg-blue-500/10')}
          >
            <Bookmark className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} />
          </button>
          {onAsk && <ChevronRight className="w-3 h-3 text-[var(--text-faint)]" />}
        </div>
      </div>
      {inj.impact && <p className="text-[10px] text-[var(--text-muted)] mt-1.5 leading-relaxed">{inj.impact}</p>}
    </div>
  );
}

export function TabInjuries({ data, onAnalyze, onAsk, loading = false }: {
  data: BettingCardData; onAnalyze?: () => void; onAsk?: (q: string) => void; loading?: boolean;
}) {
  if (loading) return <TabSpinner />;

  const injuries = Array.isArray(data.injuries) ? data.injuries : [];

  if (injuries.length > 0) {
    const statusCls = (status: string) => {
      const s = status?.toUpperCase();
      if (s === 'OUT')          return 'bg-red-500/15 text-red-300 border-red-500/30';
      if (s === 'DOUBTFUL')     return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      if (s === 'QUESTIONABLE') return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
      if (s === 'GTD')          return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      return 'bg-white/10 text-white/60 border-white/20';
    };
    return (
      <div className="space-y-1.5">
        {injuries.map((inj: any, i: number) => (
          <InjuryRow key={i} inj={inj} statusCls={statusCls} onAsk={onAsk} />
        ))}
      </div>
    );
  }

  if (data.injuryAlert) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/6 border border-red-500/20">
        <Shield className="w-3 h-3 text-red-400 shrink-0" />
        <span className="text-[10px] text-red-300 leading-relaxed">{data.injuryAlert}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Shield className="w-8 h-8 text-[var(--text-faint)]" />
      <p className="text-[11px] text-[var(--text-muted)]">No injury reports for this game</p>
      {onAnalyze && (
        <button onClick={onAnalyze} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] hover:text-foreground hover:border-[var(--border-hover)] transition-all">
          Ask AI about injury updates →
        </button>
      )}
    </div>
  );
}
