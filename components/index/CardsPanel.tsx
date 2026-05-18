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
  const hasCards = cards.length > 0;

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
                ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400'
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
