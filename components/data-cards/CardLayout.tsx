'use client';

import { memo, useState } from 'react';
import { Sparkles } from 'lucide-react';
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
  /** Short AI insight blurb to display below the hero card (first 1–2 sentences of message) */
  aiInsight?: string;
  onAnalyze?: (card: CardData) => void;
  messageIndex?: number;
  trustScore?: number;
  trustLevel?: 'high' | 'medium' | 'low';
}

/** Extract a short 1–2 sentence blurb from a longer AI message */
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
  messageIndex = 0,
  trustScore,
  trustLevel,
}: CardLayoutProps) {
  const [page, setPage] = useState(0);

  if (!cards || cards.length === 0) return null;

  const heroCard = cards[0];
  const suggestedCards = cards.slice(1, 7); // up to 6 additional cards
  const COLS = 2;
  const totalPages = Math.ceil(suggestedCards.length / COLS);
  const pageCards = suggestedCards.slice(page * COLS, page * COLS + COLS);
  const insight = aiInsight ? extractInsightBlurb(aiInsight) : null;

  return (
    <div className="mt-4 space-y-2.5 w-full">
      {/* ── Hero Card ────────────────────────────────────────────────── */}
      <div className="w-full">
        <div
          className="absolute -inset-1 rounded-3xl opacity-20 blur-xl pointer-events-none transition-opacity duration-500"
          aria-hidden="true"
        />
        <div>
          <DynamicCardRenderer
            card={heroCard}
            index={0}
            isHero
            onAnalyze={onAnalyze ? () => onAnalyze(heroCard) : undefined}
            trustScore={trustScore}
            trustLevel={trustLevel}
          />
        </div>

        {/* AI Insight blurb */}
        {insight && (
          <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-xl bg-[oklch(0.10_0.012_260)] border border-[oklch(0.20_0.025_260)]">
            <Sparkles className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[11px] text-[oklch(0.65_0.01_280)] leading-relaxed">{insight}</p>
          </div>
        )}
      </div>

      {/* ── Smaller Cards Carousel (2-up per page) ───────────────────── */}
      {suggestedCards.length > 0 && (
        <div className="space-y-2.5">
          {/* Card row */}
          <div className="grid grid-cols-2 gap-3">
            {pageCards.map((card, i) => {
              const absIdx = page * COLS + i;
              const key = card.id ?? `${card.type}-${absIdx}`;
              return (
                <DynamicCardRenderer
                  key={key}
                  card={card}
                  index={absIdx + 1}
                  isHero={false}
                  onAnalyze={onAnalyze ? () => onAnalyze(card) : undefined}
                />
              );
            })}
            {/* Placeholder to keep grid even when last page has 1 card */}
            {pageCards.length === 1 && <div />}
          </div>

          {/* Dot navigation — only shown when there are multiple pages */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Card pages">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === page}
                  aria-label={`Page ${i + 1}`}
                  onClick={() => setPage(i)}
                  className={cn(
                    'rounded-full transition-all duration-200',
                    i === page
                      ? 'w-4 h-1.5 bg-blue-400'
                      : 'w-1.5 h-1.5 bg-[oklch(0.28_0.01_280)] hover:bg-[oklch(0.38_0.01_280)]',
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
