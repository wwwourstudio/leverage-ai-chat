'use client';

import { BettingCard } from './BettingCard';
import { DFSCard } from './DFSCard';
import { FantasyCard } from './FantasyCard';
import { KalshiCard } from './KalshiCard';
import { WeatherCard } from './WeatherCard';
import { ArbitrageCard } from './ArbitrageCard';
import { CardSkeleton } from './CardSkeleton';

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

interface DynamicCardRendererProps {
  card: CardData;
  index?: number;
  onAnalyze?: (card: CardData) => void;
  isLoading?: boolean;
  error?: string;
  isHero?: boolean;
}

export function DynamicCardRenderer({
  card,
  index = 0,
  onAnalyze,
  isLoading,
  error,
  isHero = false,
}: DynamicCardRendererProps) {
  // Loading state
  if (isLoading) {
    return <CardSkeleton />;
  }

  // Validate card data
  if (!card || typeof card !== 'object') {
    console.error('[v0] Invalid card data:', card);
    return null;
  }

  // Ensure required fields exist with fallbacks
  const safeCard = {
    type: card.type || 'default',
    title: card.title || 'Untitled Card',
    category: card.category || 'General',
    subcategory: card.subcategory || 'Info',
    gradient: card.gradient || 'from-blue-500 to-purple-500',
    data: card.data && typeof card.data === 'object' ? card.data : {},
    status: card.status || 'active',
    realData: card.realData
  };

  const handleAnalyze = onAnalyze ? () => onAnalyze(card) : undefined;

  // Determine card type and render appropriate component
  const cardType = safeCard.type.toLowerCase();

  // Betting-related cards
  if (
    cardType.includes('odds') ||
    cardType.includes('betting') ||
    cardType.includes('moneyline') ||
    cardType.includes('spread') ||
    cardType.includes('totals')
  ) {
    return (
      <BettingCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        error={error}
        isHero={isHero}
      />
    );
  }

  // DFS-related cards
  if (cardType.includes('dfs') || cardType.includes('lineup')) {
    return (
      <DFSCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        error={error}
        isHero={isHero}
      />
    );
  }

  // Fantasy-related cards
  if (
    cardType.includes('fantasy') ||
    cardType.includes('draft') ||
    cardType.includes('sleeper')
  ) {
    return (
      <FantasyCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        error={error}
        isHero={isHero}
      />
    );
  }

  // Kalshi-related cards
  if (cardType.includes('kalshi') || cardType.includes('prediction')) {
    return (
      <KalshiCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        error={error}
        isHero={isHero}
      />
    );
  }

  // Weather-related cards
  if (cardType.includes('weather') || cardType.includes('climate')) {
    return (
      <WeatherCard
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        error={error}
        isHero={isHero}
      />
    );
  }

  // Arbitrage cards
  if (cardType.includes('arbitrage')) {
    return (
      <ArbitrageCard
        data={safeCard.data as any}
        gradient={safeCard.gradient}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // Default fallback - use betting card as generic card
  return (
    <BettingCard
      type={safeCard.type}
      title={safeCard.title}
      category={safeCard.category}
      subcategory={safeCard.subcategory}
      gradient={safeCard.gradient}
      data={safeCard.data}
      status={safeCard.status}
      onAnalyze={handleAnalyze}
      error={error}
      isHero={isHero}
    />
  );
}

interface CardListProps {
  cards: CardData[];
  onAnalyze?: (card: CardData) => void;
  isLoading?: boolean;
  className?: string;
}

export function CardList({ cards, onAnalyze, isLoading, className = '' }: CardListProps) {
  if (isLoading) {
    return (
      <div className={`flex flex-col gap-4 w-full ${className}`}>
        {[1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm font-medium">No cards available</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Try asking about a specific sport or market</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 w-full ${className}`}>
      {cards.map((card, index) => (
        <DynamicCardRenderer
          key={`${card.type}-${index}`}
          card={card}
          index={index}
          onAnalyze={onAnalyze}
        />
      ))}
    </div>
  );
}
