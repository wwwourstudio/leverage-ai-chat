'use client';

import { memo, useState, useEffect } from 'react';
import { RefreshCw, Sparkles, LayoutGrid } from 'lucide-react';
import { CardLayout } from '@/components/data-cards/CardLayout';
import { cn } from '@/lib/utils';
import type { CardData } from '@/lib/types';

interface CardsPanelProps {
  cards: CardData[];
  isLoading?: boolean;
  fetchedAt?: number | null;
  lastQueryText?: string;
  onRefresh?: () => void;
  onAsk?: (query: string) => void;
}

function useRelativeTime(ts: number | null | undefined): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!ts) { setLabel(''); return; }
    const update = () => {
      const diff = Math.floor((Date.now() - ts) / 1000);
      if (diff < 5) setLabel('just now');
      else if (diff < 60) setLabel(`${diff}s ago`);
      else setLabel(`${Math.floor(diff / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [ts]);

  return label;
}

export const CardsPanel = memo(function CardsPanel({
  cards,
  isLoading,
  fetchedAt,
  lastQueryText,
  onRefresh,
  onAsk,
}: CardsPanelProps) {
  const timeLabel = useRelativeTime(fetchedAt);
  const hasCards = (cards?.length ?? 0) > 0;

  const [isStale, setIsStale] = useState(false);
  useEffect(() => {
    if (!cards || cards.length === 0) return;
    const hasLive = cards.some(c => c.realData === true);
    if (!hasLive) return;
    setIsStale(false);
    const id = setTimeout(() => setIsStale(true), 5 * 60_000);
    return () => clearTimeout(id);
  }, [cards]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-overlay)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Live Data</span>
          {hasCards && timeLabel && (
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
              fetchedAt && Date.now() - fetchedAt < 30_000
                ? 'bg-blue-500/15 text-blue-400'
                : 'bg-[var(--bg-elevated)] text-[var(--text-faint)]',
            )}>
              {fetchedAt && Date.now() - fetchedAt < 30_000 ? '● ' : ''}{timeLabel}
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh cards"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stale data banner */}
      {isStale && (
        <div className="flex items-center gap-2 mx-3 mt-2 px-4 py-2 rounded-[10px] bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.25)]">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span className="text-[11px] text-amber-300 flex-1">Live data may be stale</span>
          {onRefresh && (
            <button
              onClick={() => { setIsStale(false); onRefresh?.(); }}
              className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold hover:bg-amber-500/30 transition-colors"
            >
              Refresh
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {isLoading && !hasCards ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 space-y-2.5 animate-pulse">
                <div className="h-2.5 w-24 rounded-full bg-[var(--border-default,var(--border-subtle))]" />
                <div className="h-2 w-40 rounded-full bg-[var(--border-default,var(--border-subtle))]" />
                <div className="h-2 w-32 rounded-full bg-[var(--border-default,var(--border-subtle))]" />
              </div>
            ))}
          </div>
        ) : hasCards ? (
          <CardLayout
            cards={cards}
            aiInsight={lastQueryText}
            onAsk={onAsk}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[var(--text-faint)]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-muted)]">Ask a question</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Live odds, props, and insights will appear here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
