'use client';

import { BettingCard } from './BettingCard';
import { DFSCard } from './DFSCard';
import { FantasyCard } from './FantasyCard';
import { KalshiCard } from './KalshiCard';
import { WeatherCard } from './WeatherCard';
import { ArbitrageCard } from './ArbitrageCard';
import { CardSkeleton } from './CardSkeleton';
import { StatcastCard } from './StatcastCard';
import { ADPCard } from './ADPCard';
import { MLBProjectionCard } from './MLBProjectionCard';
import { VPECard } from './VPECard';

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

  // Hide cards with no live game data — "No Games Available" placeholders and offseason stubs
  const isNoGamesCard =
    safeCard.subcategory === 'No Games Available' ||
    safeCard.subcategory.toLowerCase().includes('no games') ||
    (typeof safeCard.data.status === 'string' && safeCard.data.status === 'NO_DATA') ||
    (safeCard.title.toLowerCase().includes('offseason') && safeCard.realData === false);

  if (isNoGamesCard) return null;

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

  // Vortex Projection Engine (VPE 3.0) — Baseball only
  if (cardType === 'vpe_projection_card') {
    return (
      <VPECard
        card={{ ...safeCard, ...(card as any) } as any}
        onAnalyze={handleAnalyze}
      />
    );
  }

  // LeverageMetrics MLB Projection cards (HR/K/Breakout/Monte Carlo)
  if (cardType === 'mlb_projection_card') {
    return (
      <MLBProjectionCard
        data={{ ...safeCard, ...(card as any) } as any}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // MLB Statcast cards — statcast_summary_card, hr_prop_card, game_simulation_card,
  // leaderboard_card, pitch_analysis_card
  if (
    cardType.includes('statcast') ||
    cardType === 'hr_prop_card' ||
    cardType.includes('simulation') ||
    cardType === 'leaderboard_card' ||
    cardType === 'pitch_analysis_card'
  ) {
    return (
      <StatcastCard
        data={{ ...safeCard, ...(card as any) } as any}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // AI Insight cards (off-season or no-live-data fallback)
  if (cardType === 'betting-insight' || cardType.includes('insight')) {
    const sportEmojis: Record<string, string> = {
      nba: '🏀', nfl: '🏈', mlb: '⚾', nhl: '🏒', ncaab: '🏀', ncaaf: '🏈',
    };
    const sportKey = safeCard.category?.toLowerCase() ?? '';
    const emoji = sportEmojis[sportKey] ?? '📊';
    return (
      <div className={`group relative bg-gradient-to-br ${safeCard.gradient || 'from-blue-600/20 to-purple-900/10'} rounded-2xl p-5 border border-gray-700/40 hover:border-gray-600/60 transition-all duration-300 shadow-lg hover:shadow-xl`}>
        <div className="flex items-start gap-3 mb-3">
          <div className="text-2xl leading-none mt-0.5">{emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{safeCard.category?.toUpperCase()} · {safeCard.subcategory}</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20 uppercase tracking-wider">AI Insight</span>
            </div>
            <h3 className="text-sm font-black text-white">{safeCard.title}</h3>
          </div>
        </div>
        {safeCard.data?.insight && (
          <p className="text-sm text-gray-300 leading-relaxed border-l-2 border-blue-500/40 pl-3">{safeCard.data.insight}</p>
        )}
        <div className="mt-3 pt-3 border-t border-gray-700/30 flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Powered by {safeCard.data?.source || 'Grok 4'}</span>
        </div>
      </div>
    );
  }

  // ADP leaderboard cards (NFBC ADP tool results)
  if (cardType === 'adp-analysis' || cardType.includes('adp')) {
    return (
      <ADPCard
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

  // Player prop odds cards (from The Odds API via playerPropToCard())
  if (cardType.includes('player_prop') || cardType === 'player-prop') {
    const d = safeCard.data;
    const overRaw  = String(d.over  ?? '');
    const underRaw = String(d.under ?? '');
    const overNum  = parseFloat(overRaw);
    const underNum = parseFloat(underRaw);
    const overStr  = !isNaN(overNum)  ? (overNum  > 0 ? `+${overNum}`  : String(overNum))  : overRaw;
    const underStr = !isNaN(underNum) ? (underNum > 0 ? `+${underNum}` : String(underNum)) : underRaw;
    return (
      <div className={`group relative bg-gradient-to-br ${safeCard.gradient} rounded-2xl p-5 border border-gray-700/40 hover:border-gray-600/60 transition-all duration-300 shadow-lg hover:shadow-xl`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400/70">{safeCard.category} · Player Props</span>
            <h3 className="text-sm font-black text-white mt-0.5">{d.player}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{d.stat} — Line: <span className="text-white font-semibold">{d.line}</span></p>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20 uppercase tracking-wider flex-shrink-0">LIVE</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-black/20 rounded-lg p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Over {d.line}</p>
            <p className={`text-lg font-black ${!isNaN(overNum) && overNum > 0 ? 'text-green-400' : 'text-red-400'}`}>{overStr}</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Under {d.line}</p>
            <p className={`text-lg font-black ${!isNaN(underNum) && underNum > 0 ? 'text-green-400' : 'text-red-400'}`}>{underStr}</p>
          </div>
        </div>
        <div className="border-t border-gray-700/30 pt-2.5 space-y-1">
          <p className="text-[11px] text-gray-400 truncate">{d.game}</p>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500">{d.gameTime}</p>
            <span className="text-[9px] text-gray-600 uppercase tracking-wider">{d.bookmaker}</span>
          </div>
        </div>
        {handleAnalyze && (
          <button onClick={handleAnalyze} className="mt-3 w-full text-[10px] font-bold uppercase tracking-widest text-blue-400/70 hover:text-blue-300 transition-colors">
            Analyze →
          </button>
        )}
      </div>
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
