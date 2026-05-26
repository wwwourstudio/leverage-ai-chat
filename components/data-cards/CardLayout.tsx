'use client';

import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Pin } from 'lucide-react';
import { DynamicCardRenderer } from './DynamicCardRenderer';
import { CardFilterBar } from './CardFilterBar';
import { CardsEmptyState } from './CardStates';
import { UnifiedCardShell } from './UnifiedCardShell';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store/app-store';
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

const STATUS_PRIORITY: Record<string, number> = { hot: 0, value: 1, optimal: 2 };

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
  const { cardSortBy, cardSearch, cardLiveSubscribed, cardLiveRefreshAt } = useAppStore();

  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [isExiting, setIsExiting] = useState(false);
  const exitingCardsRef = useRef<CardData[]>([]);

  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      return new Set(
        cards
          .filter(c => !!localStorage.getItem(`bookmark:${c.type}:${c.title}`))
          .map(c => `${c.type}:${c.title}`)
      );
    } catch {
      return new Set();
    }
  });

  // Use cardLiveRefreshAt as the "loaded at" baseline so the age label resets on live refresh
  const baseTimeRef = useRef<Date>(new Date());
  const [ageLabel, setAgeLabel] = useState(() => formatAge(new Date()));

  useEffect(() => {
    if (cardLiveRefreshAt) {
      baseTimeRef.current = new Date(cardLiveRefreshAt);
      setAgeLabel(formatAge(baseTimeRef.current));
    }
  }, [cardLiveRefreshAt]);

  useEffect(() => {
    const id = setInterval(() => setAgeLabel(formatAge(baseTimeRef.current)), 60_000);
    return () => clearInterval(id);
  }, []);

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

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  if (!cards || cards.length === 0) return <CardsEmptyState />;

  const heroCard = cards[0];
  const rest = cards.slice(1, 7);

  // 1. Status filter
  const afterStatus = filter === 'all'
    ? rest
    : rest.filter(c => c.status?.toLowerCase() === filter);

  // 2. Search filter
  const afterSearch = cardSearch.trim()
    ? afterStatus.filter(c => {
        const q = cardSearch.toLowerCase();
        return (
          c.title?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q) ||
          c.subcategory?.toLowerCase().includes(q)
        );
      })
    : afterStatus;

  // 3. Sort: always pinned-first, then by cardSortBy
  const pinned = afterSearch.filter(c => pinnedIds.has(`${c.type}:${c.title}`));
  const unpinned = afterSearch.filter(c => !pinnedIds.has(`${c.type}:${c.title}`));

  const sortFn = (a: CardData, b: CardData): number => {
    if (cardSortBy === 'value') {
      const pa = STATUS_PRIORITY[a.status?.toLowerCase() ?? ''] ?? 3;
      const pb = STATUS_PRIORITY[b.status?.toLowerCase() ?? ''] ?? 3;
      return pa - pb;
    }
    if (cardSortBy === 'time') {
      const ta = Number(a.metadata?.fetchedAt ?? 0);
      const tb = Number(b.metadata?.fetchedAt ?? 0);
      return tb - ta;
    }
    if (cardSortBy === 'alpha') {
      return (a.title ?? '').localeCompare(b.title ?? '');
    }
    return 0; // default — preserve original order
  };

  const sorted = [
    ...pinned.sort(sortFn),
    ...unpinned.sort(sortFn),
  ];

  const COLS = 2;
  const totalPages = Math.ceil(sorted.length / COLS);
  const insight = aiInsight ? extractInsightBlurb(aiInsight) : null;
  const pinnedCount = rest.filter(c => pinnedIds.has(`${c.type}:${c.title}`)).length;

  const goTo = useCallback((next: number) => {
    setPage(p => Math.max(0, Math.min(next, Math.ceil(sorted.length / COLS) - 1)));
  }, [sorted.length]);

  const applyFilter = (f: StatusFilter) => {
    exitingCardsRef.current = sorted;
    setIsExiting(true);
    setTimeout(() => {
      setFilter(f);
      setPage(0);
      setIsExiting(false);
    }, 200);
  };

  // Reset page when search/sort changes
  useEffect(() => { setPage(0); }, [cardSearch, cardSortBy]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (Math.abs(dx) > 64 && Math.abs(dx) > dy * 1.5) {
      dx > 0 ? goTo(page + 1) : goTo(page - 1);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const renderCards = isExiting ? exitingCardsRef.current : sorted;

  return (
    <div className="mt-4 space-y-3 w-full">
      {/* ── Hero Card ────────────────────────────────────────────────── */}
      <div className="w-full animate-card-enter-spring">
        <DynamicCardRenderer
          card={heroCard}
          index={0}
          isHero
          onAnalyze={onAnalyze ? () => onAnalyze(heroCard) : undefined}
          onAsk={onAsk}
          trustScore={trustScore}
          trustLevel={trustLevel}
          refreshKey={cardLiveRefreshAt ?? undefined}
        />
        {insight && (
          <UnifiedCardShell className="mt-2 px-3 py-2 bg-[var(--bg-overlay)] flex items-start gap-2 animate-fade-in animate-delay-300">
            <Sparkles className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{insight}</p>
          </UnifiedCardShell>
        )}
      </div>

      {/* ── Smaller Cards Carousel ────────────────────────────────────── */}
      {rest.length > 0 && (
        <div className="space-y-2">
          {/* Filter bar: search + sort + status chips */}
          <CardFilterBar
            filter={filter}
            onFilterChange={applyFilter}
            totalCount={rest.length}
            filteredCount={sorted.length}
          />

          {/* Pinned indicator + live status + age label */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {pinnedCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20">
                <Pin className="w-2.5 h-2.5" />
                {pinnedCount} pinned
              </span>
            )}
            {cardLiveSubscribed && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
            <span className="ml-auto text-[9px] font-semibold text-[var(--text-faint)] tabular-nums">
              {ageLabel}
            </span>
          </div>

          {sorted.length === 0 && !isExiting ? (
            <p className="text-center text-[11px] text-[var(--text-faint)] py-4">
              No {cardSearch ? 'matching' : filter} cards in this set
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
                  {Array.from({ length: Math.max(totalPages, 1) }).map((_, pageIdx) => {
                    const pCards = renderCards.slice(pageIdx * COLS, pageIdx * COLS + COLS);
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
                              className={isExiting ? 'animate-card-exit' : 'animate-card-enter'}
                              style={{ animationDelay: `${i * (isExiting ? 30 : 60)}ms` }}
                            >
                              <DynamicCardRenderer
                                card={card}
                                index={absIdx + 1}
                                isHero={false}
                                onAnalyze={onAnalyze ? () => onAnalyze(card) : undefined}
                                onAsk={onAsk}
                                refreshKey={cardLiveRefreshAt ?? undefined}
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
