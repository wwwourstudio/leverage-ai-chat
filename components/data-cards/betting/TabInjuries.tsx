'use client';

import { useState, useCallback } from 'react';
import { Bookmark, ChevronRight, Shield, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BettingCardData } from './betting-utils';
import { TabSpinner } from './betting-shared';

const WATCHLIST_KEY = 'leverage_watchlist';

// Severity order for sorting: worst → best
const SEVERITY_ORDER: Record<string, number> = {
  OUT: 0, DOUBTFUL: 1, QUESTIONABLE: 2, GTD: 3, PROBABLE: 4,
};

interface StatusStyle {
  bg: string;
  border: string;
  text: string;
  dot: string;
  label: string;
}

function getStatusStyle(status: string): StatusStyle {
  const s = (status ?? '').toUpperCase();
  if (s === 'OUT')          return { bg: 'bg-red-950/60',    border: 'border-red-600/30',    text: 'text-red-300',    dot: 'bg-red-400',    label: 'OUT' };
  if (s === 'DOUBTFUL')     return { bg: 'bg-red-900/30',    border: 'border-red-500/25',    text: 'text-red-300',    dot: 'bg-red-400',    label: 'DOUBTFUL' };
  if (s === 'QUESTIONABLE') return { bg: 'bg-amber-900/30',  border: 'border-amber-500/25',  text: 'text-amber-300',  dot: 'bg-amber-400',  label: 'QUESTIONABLE' };
  if (s === 'GTD')          return { bg: 'bg-blue-900/25',   border: 'border-blue-500/20',   text: 'text-blue-300',   dot: 'bg-blue-400',   label: 'GTD' };
  if (s === 'PROBABLE')     return { bg: 'bg-yellow-900/20', border: 'border-yellow-500/20', text: 'text-yellow-300', dot: 'bg-yellow-400', label: 'PROBABLE' };
  return { bg: 'bg-white/5', border: 'border-white/10', text: 'text-white/60', dot: 'bg-white/40', label: s || 'UNKNOWN' };
}

function InjuryRow({ inj, onAsk }: { inj: any; onAsk?: (q: string) => void }) {
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

  const ss = getStatusStyle(inj.status);

  return (
    <div
      onClick={onAsk ? () => onAsk(`Show me the injury analysis and betting impact for ${inj.player} (${inj.status}) on the ${inj.team}`) : undefined}
      className={cn(
        'px-3.5 py-3 rounded-2xl border transition-all',
        ss.bg, ss.border,
        onAsk && 'cursor-pointer hover:brightness-110 active:scale-[0.99]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Player info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            {/* Status dot */}
            <span className={cn('w-2 h-2 rounded-full shrink-0 shadow-sm', ss.dot)} />
            <p className="text-[12px] font-black text-foreground truncate">{inj.player}</p>
          </div>
          <div className="flex items-center gap-2 pl-4">
            {inj.position && (
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/8 border border-white/10 text-white/50">
                {inj.position}
              </span>
            )}
            <span className="text-[10px] text-[var(--text-faint)]">{inj.team}</span>
          </div>
        </div>

        {/* Right side: status badge + bookmark */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('px-2.5 py-1 rounded-xl text-[10px] font-black border', ss.text, ss.border, 'bg-black/20')}>
            {ss.label}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            title={saved ? 'Remove from bookmarks' : 'Bookmark player'}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded-xl transition-all border',
              saved
                ? 'text-blue-400 bg-blue-500/15 border-blue-500/25'
                : 'text-[var(--text-faint)] hover:text-blue-400 hover:bg-blue-500/10 border-transparent',
            )}
          >
            <Bookmark className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} />
          </button>
          {onAsk && <ChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)]" />}
        </div>
      </div>

      {/* Impact note */}
      {inj.impact && (
        <p className="text-[10px] text-[var(--text-muted)] mt-2 pl-4 leading-relaxed border-l border-white/10">{inj.impact}</p>
      )}
    </div>
  );
}

export function TabInjuries({ data, onAnalyze, onAsk, loading = false }: {
  data: BettingCardData; onAnalyze?: () => void; onAsk?: (q: string) => void; loading?: boolean;
}) {
  if (loading) return <TabSpinner />;

  const injuries = Array.isArray(data.injuries) ? data.injuries : [];

  if (injuries.length > 0) {
    // Sort by severity (worst first)
    const sorted = [...injuries].sort((a: any, b: any) => {
      const as = SEVERITY_ORDER[String(a.status ?? '').toUpperCase()] ?? 99;
      const bs = SEVERITY_ORDER[String(b.status ?? '').toUpperCase()] ?? 99;
      return as - bs;
    });

    return (
      <div className="space-y-2">
        {sorted.map((inj: any, i: number) => (
          <InjuryRow key={i} inj={inj} onAsk={onAsk} />
        ))}
      </div>
    );
  }

  if (data.injuryAlert) {
    return (
      <div className="flex items-start gap-3 px-3.5 py-3 rounded-2xl bg-red-950/40 border border-red-600/25 border-l-2 border-l-red-500">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <span className="text-[11px] text-red-300 leading-relaxed">{data.injuryAlert}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
        <Shield className="w-6 h-6 text-emerald-400" />
      </div>
      <div>
        <p className="text-[11px] font-bold text-emerald-400">No injury reports</p>
        <p className="text-[10px] text-[var(--text-faint)] mt-0.5">All players healthy for this game</p>
      </div>
      {onAnalyze && (
        <button
          onClick={onAnalyze}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] hover:text-foreground hover:border-[var(--border-hover)] transition-all"
        >
          Ask AI about injury updates →
        </button>
      )}
    </div>
  );
}
