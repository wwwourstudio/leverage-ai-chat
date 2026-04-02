'use client';

import { memo, useState, useRef, useCallback } from 'react';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { DynamicCardRenderer } from './DynamicCardRenderer';
import { cn } from '@/lib/utils';

interface CardData {
  id?: string;
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, any>;
  status: string;
  realData?: boolean;
}

interface CardLayoutProps {
  cards: CardData[];
  aiInsight?: string;
  onAnalyze?: (card: CardData) => void;
  onAsk?: (query: string) => void;
  messageIndex?: number;
  trustScore?: number;
  trustLevel?: 'high' | 'medium' | 'low';
}

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
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  if (!cards || cards.length === 0) return null;

  const heroCard = cards[0];
  // Enforce even count (2, 4, or 6) — drop the last card if odd
  const rawSuggested = cards.slice(1, 7);
  const evenCount = Math.floor(rawSuggested.length / 2) * 2;
  const suggestedCards = rawSuggested.slice(0, evenCount);
  const COLS = 2;
  const totalPages = Math.ceil(suggestedCards.length / COLS);
  const insight = aiInsight ? extractInsightBlurb(aiInsight) : null;

  const goTo = useCallback((next: number) => {
    setPage(Math.max(0, Math.min(next, totalPages - 1)));
  }, [totalPages]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    // Only trigger if horizontal swipe dominates (not a scroll)
    if (Math.abs(dx) > 44 && Math.abs(dx) > dy * 1.5) {
      dx > 0 ? goTo(page + 1) : goTo(page - 1);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="mt-4 space-y-3 w-full">
      {/* ── Hero Card ────────────────────────────────────────────────── */}
      <div className="w-full">
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
          <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
            <Sparkles className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{insight}</p>
          </div>
        )}
      </div>

      {/* ── Smaller Cards Carousel ────────────────────────────────────── */}
      {suggestedCards.length > 0 && (
        <div className="space-y-2">

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
                const pCards = suggestedCards.slice(pageIdx * COLS, pageIdx * COLS + COLS);
                return (
                  <div
                    key={pageIdx}
                    className="w-full flex-shrink-0 grid grid-cols-2 gap-2.5 items-start"
                  >
                    {pCards.map((card, i) => {
                      const absIdx = pageIdx * COLS + i;
                      return (
                        <DynamicCardRenderer
                          key={card.id ?? `${card.type}-${absIdx}`}
                          card={card}
                          index={absIdx + 1}
                          isHero={false}
                          onAnalyze={onAnalyze ? () => onAnalyze(card) : undefined}
                          onAsk={onAsk}
                        />
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
              {/* Prev arrow */}
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

              {/* Dots + page count */}
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
                          ? 'w-5 h-1.5 bg-[var(--border-hover)]'
                          : 'w-1.5 h-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)]',
                      )}
                    />
                  ))}
                </div>
                <span className="text-[9px] font-semibold tabular-nums text-[var(--text-faint)]">
                  {page + 1}/{totalPages}
                </span>
              </div>

              {/* Next arrow */}
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
        </div>
      )}
    </div>
  );
});
