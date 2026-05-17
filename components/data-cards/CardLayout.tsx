'use client';

import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, RefreshCw, Pin } from 'lucide-react';
import { DynamicCardRenderer } from './DynamicCardRenderer';
import { CardsEmptyState } from './CardStates';
import { UnifiedCardShell } from './UnifiedCardShell';
import { cn } from '@/lib/utils';
import type { CardData } from '@/lib/types';

interface CardLayoutProps {
  cards: CardData[];
  aiInsight?: string;
  onAnalyze?: (card: CardData) => void;
  onAsk?: (query: string) => void;
  messageIndex?: number;
  trustScore?: number;
  trustLevel?: 'high' | 'medium' | 'low';
}

type StatusFilter = 'all' | 'hot' | 'value' | 'optimal';

const STATUS_FILTERS: { id: StatusFilter; label: string; color: string }[] = [
  { id: 'all',     label: 'All',     color: 'text-[var(--text-muted)] bg-[var(--bg-elevated)]' },
  { id: 'hot',     label: 'Hot',     color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  { id: 'value',   label: 'Value',   color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { id: 'optimal', label: 'Optimal', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
];

function extractInsightBlurb(text?: string): string | null {
  if (!text) return null;
  const clean = text
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^[-•]\s+/gm, '')
    .trim();
  const lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 20);
  if (!lines.length) return null;
  const sentence = lines[0];
  return sentence.length > 120 ? sentence.slice(0, 117) + '…' : sentence;
}

function isPinned(card: CardData): boolean {
  try {
    return !!localStorage.getItem(`bookmark:${card.type}:${card.title}`);
  } catch {
    return false;
  }
}

function formatAge(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export const CardLayout = memo(function CardLayout({
  cards,
  aiInsight,
  onAnalyze,
  onAsk,
  messageIndex = 0,
  trustScore,
  trustLevel,
}: CardLayoutProps) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<StatusFilter>('all');
  // Tracks pinned card IDs so sorted order re-renders when pins change
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      return new Set(
        cards
          .filter(c => !!localStorage.getItem(`bookmark:${c.type}:${c.title}`))
          .map(c => `${c.type}:${c.title}`)
      );
    } catch { return new Set(); }
  });
  const [loadedAt] = useState(() => new Date());
  const [ageLabel, setAgeLabel] = useState(() => formatAge(new Date()));
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Update "X ago" label every minute
  useEffect(() => {
    const id = setInterval(() => setAgeLabel(formatAge(loadedAt)), 60_000);
    return () => clearInterval(id);
  }, [loadedAt]);

  // Re-sync pinned state when any card is pinned/unpinned
  useEffect(() => {
    const handler = () => {
      try {
        setPinnedIds(new Set(
          cards
            .filter(c => !!localStorage.getItem(`bookmark:${c.type}:${c.title}`))
            .map(c => `${c.type}:${c.title}`)
        ));
      } catch {}
    };
    window.addEventListener('card-pin-update', handler);
    return () => window.removeEventListener('card-pin-update', handler);
  }, [cards]);

  if (!cards || cards.length === 0) return <CardsEmptyState />;

  const heroCard = cards[0];
  const rest = cards.slice(1, 7);

  // Apply status filter
  const filtered = filter === 'all'
    ? rest
    : rest.filter(c => c.status?.toLowerCase() === filter);

  // Sort: pinned cards first
  const sorted = [
    ...filtered.filter(c => pinnedIds.has(`${c.type}:${c.title}`)),
    ...filtered.filter(c => !pinnedIds.has(`${c.type}:${c.title}`)),
  ];

  const COLS = 2;
  const totalPages = Math.ceil(sorted.length / COLS);
  const insight = aiInsight ? extractInsightBlurb(aiInsight) : null;

  const goTo = useCallback((next: number) => {
    setPage(Math.max(0, Math.min(next, totalPages - 1)));
  }, [totalPages]);

  // Reset page when filter changes
  const applyFilter = (f: StatusFilter) => {
    setFilter(f);
    setPage(0);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (Math.abs(dx) > 44 && Math.abs(dx) > dy * 1.5) {
      dx > 0 ? goTo(page + 1) : goTo(page - 1);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const hasPinned = pinnedIds.size > 0 && rest.some(c => pinnedIds.has(`${c.type}:${c.title}`));

  return (
    <div className="mt-4 space-y-3 w-full">
      {/* ── Hero Card ────────────────────────────────────────────────── */}
      <div className="w-full animate-card-enter">
        <DynamicCardRenderer
          card={heroCard}
          index={0}
          isHero
          onAnalyze={onAnalyze ? () => onAnalyze(heroCard) : undefined}
          onAsk={onAsk}
          trustScore={trustScore}
          trustLevel={trustLevel}
        />
        {insight && (
          <UnifiedCardShell className="mt-2 px-3 py-2 bg-[var(--bg-overlay)] flex items-start gap-2">
            <Sparkles className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{insight}</p>
          </UnifiedCardShell>
        )}
      </div>

      {/* ── Smaller Cards Carousel ────────────────────────────────────── */}
      {rest.length > 0 && (
        <div className="space-y-2">
          {/* Filter chips + pinned indicator */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => applyFilter(f.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all duration-150',
                  filter === f.id
                    ? f.color + ' border-current opacity-100'
                    : 'text-[var(--text-faint)] bg-transparent border-[var(--border-subtle)] hover:border-[var(--border-hover)] opacity-70 hover:opacity-100',
                )}
                aria-pressed={filter === f.id}
              >
                {f.label}
              </button>
            ))}
            {hasPinned && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20">
                <Pin className="w-2.5 h-2.5" />
                Pinned first
              </span>
            )}
            <span className="ml-auto text-[9px] font-semibold text-[var(--text-faint)] tabular-nums">{ageLabel}</span>
          </div>

          {sorted.length === 0 ? (
            <p className="text-center text-[11px] text-[var(--text-faint)] py-4">
              No {filter} cards in this set
            </p>
          ) : (
            <>
              {/* Sliding track */}
              <div
                className="overflow-hidden rounded-xl"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                <div
                  className="flex transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
                  style={{ transform: `translateX(-${page * 100}%)` }}
                >
                  {Array.from({ length: totalPages }).map((_, pageIdx) => {
                    const pCards = sorted.slice(pageIdx * COLS, pageIdx * COLS + COLS);
                    return (
                      <div
                        key={pageIdx}
                        className={cn(
                          'w-full flex-shrink-0 grid gap-2.5 items-start',
                          pCards.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
                        )}
                      >
                        {pCards.map((card, i) => {
                          const absIdx = pageIdx * COLS + i;
                          return (
                            <div
                              key={card.id ?? `${card.type}-${absIdx}`}
                              className="animate-card-enter"
                              style={{ animationDelay: `${i * 60}ms` }}
                            >
                              <DynamicCardRenderer
                                card={card}
                                index={absIdx + 1}
                                isHero={false}
                                onAnalyze={onAnalyze ? () => onAnalyze(card) : undefined}
                                onAsk={onAsk}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Navigation bar — dots + prev/next arrows */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-0.5">
                  <button
                    onClick={() => goTo(page - 1)}
                    disabled={page === 0}
                    aria-label="Previous cards"
                    className={cn(
                      'flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-150',
                      page === 0
                        ? 'opacity-0 pointer-events-none'
                        : 'text-[var(--text-faint)] hover:text-foreground hover:bg-[var(--bg-elevated)]',
                    )}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5" role="tablist" aria-label="Card pages">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          role="tab"
                          aria-selected={i === page}
                          aria-label={`Page ${i + 1} of ${totalPages}`}
                          onClick={() => goTo(i)}
                          className={cn(
                            'rounded-full transition-all duration-250 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400',
                            i === page
                              ? 'w-6 h-1.5 bg-[var(--border-hover)]'
                              : 'w-1.5 h-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)]',
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-[9px] font-semibold tabular-nums text-[var(--text-faint)]">
                      {page + 1}/{totalPages}
                    </span>
                  </div>

                  <button
                    onClick={() => goTo(page + 1)}
                    disabled={page === totalPages - 1}
                    aria-label="Next cards"
                    className={cn(
                      'flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-150',
                      page === totalPages - 1
                        ? 'opacity-0 pointer-events-none'
                        : 'text-[var(--text-faint)] hover:text-foreground hover:bg-[var(--bg-elevated)]',
                    )}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});
