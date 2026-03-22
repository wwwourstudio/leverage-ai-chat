'use client';

import { memo } from 'react';
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
  if (!cards || cards.length === 0) return null;

  const heroCard = cards[0];
  // All cards after the first, up to 5
  const suggestedCards = cards.slice(1, 6);

  const insight = aiInsight ? extractInsightBlurb(aiInsight) : null;

  return (
    <div className="mt-4 space-y-2.5 w-full">
      {/* ── Hero Card ────────────────────────────────────────────────── */}
      <div className="w-full">
        {/* Ambient glow behind hero */}
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

      {/* ── Additional Cards Grid ────────────────────────────────────── */}
      {suggestedCards.length > 0 && (
        <div className="space-y-2">
          <div className={cn(
            'grid gap-3',
            suggestedCards.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
          )}>
            {suggestedCards.map((card, i) => {
              const key = card.id ?? `${card.type}-${i}`;
              return (
                <DynamicCardRenderer
                  key={key}
                  card={card}
                  index={i + 1}
                  isHero={false}
                  onAnalyze={onAnalyze ? () => onAnalyze(card) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
