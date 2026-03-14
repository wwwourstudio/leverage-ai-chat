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
  trustScore?: number;
  trustLevel?: 'high' | 'medium' | 'low';
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
  trustScore,
  trustLevel,
}: CardLayoutProps) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  if (!cards || cards.length === 0) return null;

  // Hero card is the currently selected one
  const heroCard = cards[heroIndex] ?? cards[0];
  // Suggested cards are the rest (up to 3), excluding the hero
  const suggestedCards = cards.filter((_, i) => i !== heroIndex).slice(0, 3);

  const insight = aiInsight ? extractInsightBlurb(aiInsight) : null;

  function selectHero(index: number) {
    if (index === heroIndex) return;
    setTransitioning(true);
    // Brief fade-out then swap
    setTimeout(() => {
      setHeroIndex(index);
      setTransitioning(false);
    }, 120);
  }

  return (
    <div className="mt-4 space-y-2.5 w-full">
      {/* ── Hero Card ────────────────────────────────────────────────── */}
      <div className="w-full">
        {/* Ambient glow behind hero */}
        <div
          className="absolute -inset-1 rounded-3xl opacity-20 blur-xl pointer-events-none transition-opacity duration-500"
          aria-hidden="true"
        />
        <div className={cn(
          'transition-opacity duration-150',
          transitioning ? 'opacity-0' : 'opacity-100',
        )}>
          <DynamicCardRenderer
            card={heroCard}
            index={heroIndex}
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

      {/* ── Suggested Cards Row ──────────────────────────────────────── */}
      {suggestedCards.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5 px-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500/70">
              More Markets
            </p>
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-900/60 text-[8px] font-black text-blue-400/80">
              {suggestedCards.length}
            </span>
          </div>
          <div className={cn(
            'grid gap-2',
            suggestedCards.length === 1 ? 'grid-cols-1' :
            suggestedCards.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          )}>
            {suggestedCards.map((card, i) => {
              // Map back to original index in the cards array
              const originalIndex = cards.indexOf(card);
              return (
                <CompactCard
                  key={card.id ?? `${card.type}-${originalIndex}`}
                  card={card}
                  index={i}
                  isActive={false}
                  onClick={() => selectHero(originalIndex)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
