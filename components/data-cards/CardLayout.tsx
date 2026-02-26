'use client';

import { useState, memo } from 'react';
import { Sparkles } from 'lucide-react';
import { DynamicCardRenderer } from './DynamicCardRenderer';
import { CompactCard } from './CompactCard';
import { cn } from '@/lib/utils';

interface CardData {
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
}

/** Extract a short 1–2 sentence blurb from a longer AI message */
function extractInsightBlurb(text?: string): string | null {
  if (!text) return null;
  // Strip markdown headers and leading asterisks
  const clean = text
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^[-•]\s+/gm, '')
    .trim();
  // Take the first non-empty line that's at least 20 chars
  const lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 20);
  if (!lines.length) return null;
  const sentence = lines[0];
  // Truncate at ~120 chars
  return sentence.length > 120 ? sentence.slice(0, 117) + '…' : sentence;
}

export const CardLayout = memo(function CardLayout({
  cards,
  aiInsight,
  onAnalyze,
  messageIndex = 0,
}: CardLayoutProps) {
  const [heroIndex, setHeroIndex] = useState(0);

  if (!cards || cards.length === 0) return null;

  // Hero card is the currently selected one
  const heroCard = cards[heroIndex] ?? cards[0];
  // Suggested cards are the rest (up to 3), excluding the hero
  const suggestedCards = cards.filter((_, i) => i !== heroIndex).slice(0, 3);

  const insight = aiInsight ? extractInsightBlurb(aiInsight) : null;

  return (
    <div className="mt-4 space-y-2.5 w-full">
      {/* ── Hero Card ────────────────────────────────────────────────── */}
      <div className="w-full">
        <DynamicCardRenderer
          card={heroCard}
          index={heroIndex}
          isHero
          onAnalyze={onAnalyze ? () => onAnalyze(heroCard) : undefined}
        />

        {/* AI Insight blurb */}
        {insight && (
          <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-xl bg-[oklch(0.10_0.012_260)] border border-[oklch(0.20_0.025_260)]">
            <Sparkles className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[11px] text-[oklch(0.65_0.01_280)] leading-relaxed">{insight}</p>
          </div>
        )}
      </div>

      {/* ── Suggested Cards Row ──────────────────────────────────────── */}
      {suggestedCards.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.38_0.01_280)] mb-1.5 px-0.5">
            Suggested
          </p>
          <div className={cn(
            'grid gap-2',
            suggestedCards.length === 1 ? 'grid-cols-1' :
            suggestedCards.length === 2 ? 'grid-cols-2' :
            'grid-cols-3',
          )}>
            {suggestedCards.map((card, i) => {
              // Map back to original index in the cards array
              const originalIndex = cards.indexOf(card);
              return (
                <CompactCard
                  key={`${card.type}-${originalIndex}`}
                  card={card}
                  index={i}
                  isActive={false}
                  onClick={() => setHeroIndex(originalIndex)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
