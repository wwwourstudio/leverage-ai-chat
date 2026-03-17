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
import { ADPUploadModal } from '@/components/ADPUploadModal';
import { MLBProjectionCard } from './MLBProjectionCard';
import { VPECard } from './VPECard';

interface CardData {
  id?: string;
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  icon?: string;
  data: Record<string, any>;
  status: string;
  realData?: boolean;
  metadata?: Record<string, any>;
}

interface DynamicCardRendererProps {
  card: CardData;
  index?: number;
  onAnalyze?: (card: CardData) => void;
  isLoading?: boolean;
  error?: string;
  isHero?: boolean;
  trustScore?: number;
  trustLevel?: 'high' | 'medium' | 'low';
}

export function DynamicCardRenderer({
  card,
  index = 0,
  onAnalyze,
  isLoading,
  error,
  isHero = false,
  trustScore,
  trustLevel,
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
    icon: card.icon,
    data: card.data && typeof card.data === 'object' ? card.data : {},
    status: card.status || 'active',
    realData: card.realData,
    metadata: card.metadata,
  };

  // Hide cards with no live game data — "No Games Available" placeholders and offseason stubs
  const isNoGamesCard =
    safeCard.subcategory === 'No Games Available' ||
    safeCard.subcategory.toLowerCase().includes('no games') ||
    (typeof safeCard.data.status === 'string' && safeCard.data.status === 'NO_DATA') ||
    (safeCard.title.toLowerCase().includes('offseason') && safeCard.realData === false);

  if (isNoGamesCard) return null;

  const handleAnalyze = onAnalyze ? () => onAnalyze(card) : undefined;

  // Whether this card has real live data or is estimated/fallback
  const isEstimated = safeCard.realData === false;
  const hasTrustOverlay = trustScore !== undefined;

  // Wraps any card element with ESTIMATED badge (when realData===false)
  // and a per-card trust score chip (when trustScore is provided).
  function withOverlays(el: React.ReactElement): React.ReactElement {
    if (!isEstimated && !hasTrustOverlay) return el;
    return (
      <div className="relative">
        {el}
        {isEstimated && (
          <span className="absolute top-2 right-10 z-10 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-gray-900/80 text-gray-400 border border-gray-700/50 backdrop-blur-sm pointer-events-none">
            ESTIMATED
          </span>
        )}
        {hasTrustOverlay && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm border border-white/10 pointer-events-none">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              trustLevel === 'high' ? 'bg-emerald-400' :
              trustLevel === 'medium' ? 'bg-yellow-400' :
              'bg-red-400'
            }`} />
            <span className="text-[8px] font-bold text-white/60">{trustScore}%</span>
          </div>
        )}
      </div>
    );
  }

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
    return withOverlays(
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
    return withOverlays(
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
    return withOverlays(
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
    return withOverlays(
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
    return withOverlays(
      <WeatherCard
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

  // Vortex Projection Engine (VPE 3.0) — Baseball only
  if (cardType === 'vpe_projection_card') {
    return withOverlays(
      <VPECard
        card={{ ...safeCard, ...(card as any) } as any}
        onAnalyze={handleAnalyze}
      />
    );
  }

  // LeverageMetrics MLB Projection cards (HR/K/Breakout/Monte Carlo)
  if (cardType === 'mlb_projection_card') {
    return withOverlays(
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
    return withOverlays(
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
    return withOverlays(
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

  // ADP upload card — shown when no TSV has been uploaded yet
  if (cardType === 'adp-upload') {
    const sport = (safeCard.data?.sport as 'mlb' | 'nfl' | undefined) ?? 'mlb';
    return <ADPUploadModal sport={sport} />;
  }

  // ADP leaderboard cards (NFBC ADP tool results)
  if (cardType === 'adp-analysis' || cardType.includes('adp')) {
    return withOverlays(
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
    return withOverlays(
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

  // Line movement cards
  if (cardType === 'line_movement') {
    const d = safeCard.data;
    const isSteam = d.isSteamMove;
    const isUp = d.direction === 'UP';
    return withOverlays(
      <div className={`group relative bg-gradient-to-br ${safeCard.gradient} rounded-2xl p-5 border border-gray-700/40 hover:border-gray-600/60 transition-all duration-300 shadow-lg`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400/70">{safeCard.category} · {safeCard.subcategory}</span>
            <h3 className="text-sm font-black text-white mt-0.5 truncate max-w-[200px]">{safeCard.title}</h3>
          </div>
          {isSteam && (
            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0">STEAM</span>
          )}
        </div>
        <div className="flex items-center justify-between bg-black/30 rounded-xl p-3 mb-3">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Opening</p>
            <p className="text-lg font-black text-white/60">{d.oldLine ?? '—'}</p>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className={`text-2xl font-black ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>{isUp ? '↑' : '↓'}</span>
            <span className={`text-sm font-black tabular-nums ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>{d.lineChange}</span>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Current</p>
            <p className={`text-lg font-black ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>{d.newLine ?? '—'}</p>
          </div>
        </div>
        <div className="space-y-1.5 text-[11px]">
          {d.sharpMoney && <p className="text-gray-300">{d.sharpMoney}</p>}
          {d.bookmaker && <p className="text-gray-500">Source: <span className="text-gray-400 font-semibold">{d.bookmaker}</span></p>}
          {d.timestamp && <p className="text-gray-600">{d.timestamp}</p>}
        </div>
        {handleAnalyze && (
          <button onClick={handleAnalyze} className="mt-3 w-full text-[10px] font-bold uppercase tracking-widest text-blue-400/70 hover:text-blue-300 transition-colors">
            Analyze →
          </button>
        )}
      </div>
    );
  }

  // Kelly bet sizing cards
  if (cardType === 'kelly_bet') {
    const d = safeCard.data;
    const kellyNum = parseFloat(String(d.kellyFraction ?? '0'));
    const edgeNum = parseFloat(String(d.edge ?? '0'));
    return withOverlays(
      <div className={`group relative bg-gradient-to-br ${safeCard.gradient} rounded-2xl p-5 border border-gray-700/40 hover:border-gray-600/60 transition-all duration-300 shadow-lg`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400/70">{safeCard.category} · {safeCard.subcategory}</span>
            <h3 className="text-sm font-black text-white mt-0.5 truncate max-w-[200px]">{safeCard.title}</h3>
          </div>
          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider flex-shrink-0 ${
            edgeNum > 0.05 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {d.sport ?? 'KELLY'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-black/30 rounded-xl p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Stake</p>
            <p className="text-base font-black text-white">{d.recommendedStake ?? '—'}</p>
          </div>
          <div className="bg-black/30 rounded-xl p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Edge</p>
            <p className="text-base font-black text-emerald-400">{d.edge ?? '—'}</p>
          </div>
          <div className="bg-black/30 rounded-xl p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">EV</p>
            <p className="text-base font-black text-blue-400">{d.expectedValue ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-500">Kelly Fraction</span>
          <span className="font-bold text-white">{d.kellyFraction ?? '—'}</span>
        </div>
        {d.confidence && (
          <div className="flex items-center justify-between text-[11px] mt-1">
            <span className="text-gray-500">Confidence</span>
            <span className="font-bold text-white">{d.confidence}</span>
          </div>
        )}
        {handleAnalyze && (
          <button onClick={handleAnalyze} className="mt-3 w-full text-[10px] font-bold uppercase tracking-widest text-blue-400/70 hover:text-blue-300 transition-colors">
            Full Analysis →
          </button>
        )}
      </div>
    );
  }

  // Portfolio overview cards
  if (cardType === 'portfolio') {
    const d = safeCard.data;
    const utilNum = parseFloat(String(d.utilizationRate ?? '0'));
    return withOverlays(
      <div className={`group relative bg-gradient-to-br ${safeCard.gradient} rounded-2xl p-5 border border-gray-700/40 hover:border-gray-600/60 transition-all duration-300 shadow-lg`}>
        <div className="mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400/70">{safeCard.category} · {safeCard.subcategory}</span>
          <h3 className="text-sm font-black text-white mt-0.5">{safeCard.title}</h3>
        </div>
        {d.totalBankroll ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-black/30 rounded-xl p-2.5 text-center">
                <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Bankroll</p>
                <p className="text-sm font-black text-white">{d.totalBankroll}</p>
              </div>
              <div className="bg-black/30 rounded-xl p-2.5 text-center">
                <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Deployed</p>
                <p className="text-sm font-black text-emerald-400">{d.deployed}</p>
              </div>
              <div className="bg-black/30 rounded-xl p-2.5 text-center">
                <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Available</p>
                <p className="text-sm font-black text-blue-400">{d.available}</p>
              </div>
            </div>
            <div className="mb-2">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-gray-500 uppercase tracking-wider">Utilization</span>
                <span className={`font-bold ${utilNum > 80 ? 'text-red-400' : utilNum > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{d.utilizationRate}</span>
              </div>
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${utilNum > 80 ? 'bg-red-500' : utilNum > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(utilNum, 100)}%` }}
                />
              </div>
            </div>
            {d.riskBudget && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-500">Risk Budget</span>
                <span className="font-bold text-white">{d.riskBudget}</span>
              </div>
            )}
          </>
        ) : (
          <div className="py-3 text-center">
            <p className="text-sm text-gray-400">{d.description}</p>
            {d.note && <p className="text-xs text-gray-600 mt-2">{d.note}</p>}
          </div>
        )}
        {handleAnalyze && (
          <button onClick={handleAnalyze} className="mt-3 w-full text-[10px] font-bold uppercase tracking-widest text-blue-400/70 hover:text-blue-300 transition-colors">
            Manage Portfolio →
          </button>
        )}
      </div>
    );
  }

  // Arbitrage cards
  if (cardType.includes('arbitrage')) {
    return withOverlays(
      <ArbitrageCard
        data={safeCard.data as any}
        gradient={safeCard.gradient}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // Default fallback - use betting card as generic card
  return withOverlays(
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
