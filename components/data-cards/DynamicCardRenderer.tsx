'use client';

import { useState, useCallback } from 'react';
import { Bookmark } from 'lucide-react';

// ── Saved-card entry (shared with WatchlistLightbox) ──────────────────────────
export interface SavedCardEntry {
  id: string;       // `${type}:${title}` for dedup
  savedAt: string;  // ISO timestamp
  card: {
    type: string; title: string; category: string; subcategory: string;
    gradient: string; status: string; data: Record<string, any>;
  };
}

const SAVED_CARDS_KEY = 'leverage_saved_cards';

// Standalone typed card components (used for direct API data, not AI-generated CardData)
import { OddsCard } from '@/components/cards/OddsCard';
import { KalshiMarketCard } from '@/components/cards/KalshiMarketCard';
import { PlayerCard } from '@/components/cards/PlayerCard';
import { DFSLineupCard } from '@/components/cards/DFSLineupCard';
import { ArbitrageOpportunityCard } from '@/components/cards/ArbitrageOpportunityCard';

import { BettingCard } from './BettingCard';
import { DFSCard } from './DFSCard';
import { FantasyCard } from './FantasyCard';
import { KalshiCard } from './KalshiCard';
import { WeatherCard } from './WeatherCard';
import { ArbitrageCard } from './ArbitrageCard';
import { LineMovementCard } from './LineMovementCard';
import { KellyBetCard } from './KellyBetCard';
import { PortfolioCard } from './PortfolioCard';
import { CardSkeleton } from './CardSkeleton';
import { StatcastCard } from './StatcastCard';
import { ADPCard } from './ADPCard';
import { ADPUploadModal } from '@/components/ADPUploadModal';
import { MLBProjectionCard } from './MLBProjectionCard';
import { VPECard } from './VPECard';
import { HRPredictionCard } from './HRPredictionCard';
import { EVBetCard } from './EVBetCard';
import { SharpMoneyCard } from './SharpMoneyCard';
import { PitcherFatigueCard } from './PitcherFatigueCard';
import { BullpenFatigueCard } from './BullpenFatigueCard';
import { PitchMatchupCard } from './PitchMatchupCard';
import { UmpireImpactCard } from './UmpireImpactCard';
import { CatcherFramingCard } from './CatcherFramingCard';
import { ClosingLineCard } from './ClosingLineCard';
import { DFSSlateCard } from './DFSSlateCard';
import { PropHitRateCard } from './PropHitRateCard';
import { PlayerPropCard } from './PlayerPropCard';

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
  onAsk?: (query: string) => void;
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
  onAsk,
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
    status: card.status || 'neutral',
    // cards-generator.ts sets realData inside card.data, not at the top level.
    // Read both locations so the ESTIMATED badge and offseason filter work correctly.
    realData: card.realData ?? (
      card.data && typeof card.data === 'object'
        ? (card.data as Record<string, unknown>).realData as boolean | undefined
        : undefined
    ),
    metadata: card.metadata,
  };

  // Warn when a card claims to be real data (realData !== false) but its payload is empty.
  // This catches generator regressions where a live card is emitted with no actual fields.
  if (safeCard.realData !== false) {
    const meaningfulKeys = Object.keys(safeCard.data).filter(
      k => k !== 'realData' && k !== 'status' && safeCard.data[k] != null,
    );
    if (meaningfulKeys.length === 0) {
      console.warn(
        '[v0] [DynamicCardRenderer] Card has realData≠false but data payload is empty —',
        safeCard.type, '/', safeCard.title,
      );
    }
  }

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

  // Data staleness: show "Updated X ago" when fetchedAt is in metadata
  const fetchedAt: string | undefined = (safeCard.metadata as any)?.fetchedAt;
  const dataAgeLabel = (() => {
    if (!fetchedAt || isEstimated) return null;
    const ageMs = Date.now() - new Date(fetchedAt).getTime();
    const mins = Math.floor(ageMs / 60_000);
    if (mins < 1) return null; // < 1 min: don't show (fresh enough)
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  })();

  // Per-card bookmark state (persisted to localStorage)
  const bookmarkKey = `bookmark:${safeCard.type}:${safeCard.title}`;
  const cardId = `${safeCard.type}:${safeCard.title}`;
  const [isBookmarked, setIsBookmarked] = useState(() => {
    try { return !!localStorage.getItem(bookmarkKey); } catch { return false; }
  });
  const toggleBookmark = useCallback(() => {
    setIsBookmarked(prev => {
      const next = !prev;
      try {
        // Flag key for fast init check
        next ? localStorage.setItem(bookmarkKey, '1') : localStorage.removeItem(bookmarkKey);
        // Full card data in saved_cards array
        const existing: SavedCardEntry[] = JSON.parse(localStorage.getItem(SAVED_CARDS_KEY) ?? '[]');
        const updated = next
          ? [{ id: cardId, savedAt: new Date().toISOString(), card: { type: safeCard.type, title: safeCard.title, category: safeCard.category, subcategory: safeCard.subcategory, gradient: safeCard.gradient, status: safeCard.status, data: safeCard.data } }, ...existing.filter(e => e.id !== cardId)]
          : existing.filter(e => e.id !== cardId);
        localStorage.setItem(SAVED_CARDS_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('saved-cards-update', { detail: { count: updated.length } }));
      } catch {}
      return next;
    });
  }, [bookmarkKey, cardId, safeCard]);

  // Wraps any card element with ESTIMATED badge, trust score chip, and bookmark button.
  // Pass skipBookmark=true for card types that have their own save/watch mechanism.
  function withOverlays(el: React.ReactElement, skipBookmark = false): React.ReactElement {
    return (
      <div className="relative group/card">
        {el}
        {/* Bookmark button — top-right corner, visible on hover. Skipped for cards with built-in watchlist. */}
        {!skipBookmark && (
          <button
            onClick={toggleBookmark}
            className={`absolute top-2 right-2 z-10 p-1 rounded-md transition-all duration-150 hover:bg-[var(--bg-elevated)] ${isBookmarked ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'}`}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark card'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-blue-500 text-blue-500' : 'text-[var(--text-faint)]'}`} />
          </button>
        )}
        {isEstimated && (
          <span className="absolute top-2 right-10 z-10 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-[var(--bg-surface)] text-[var(--text-faint)] border border-[var(--border-subtle)] backdrop-blur-sm pointer-events-none">
            ESTIMATED
          </span>
        )}
        {dataAgeLabel && !isEstimated && (
          <span className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 rounded text-[8px] font-semibold tabular-nums bg-[var(--bg-overlay)]/80 text-[var(--text-faint)] border border-[var(--border-subtle)] backdrop-blur-sm pointer-events-none">
            {dataAgeLabel}
          </span>
        )}
        {hasTrustOverlay && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-overlay)]/80 backdrop-blur-sm border border-[var(--border-subtle)] pointer-events-none">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              trustLevel === 'high' ? 'bg-emerald-400' :
              trustLevel === 'medium' ? 'bg-yellow-400' :
              'bg-red-400'
            }`} />
            <span className="text-[8px] font-bold text-[var(--text-faint)]">{trustScore}%</span>
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
        onAsk={onAsk}
        error={error}
        isHero={isHero}
      />
    );
  }

  // Full DFS slate card (9-player optimal lineup roster)
  if (cardType === 'dfs-slate') {
    return withOverlays(
      <DFSSlateCard
        title={safeCard.title}
        data={safeCard.data}
        onAnalyze={handleAnalyze}
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

  // LeverageMetrics v3 HR Prediction card (exact match — must come before 'prediction' catch-all)
  if (cardType === 'hr_prediction_card') {
    return withOverlays(
      <HRPredictionCard data={card.data as any} />
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
    // StatcastCard has its own heart/watchlist button — skip the generic bookmark star
    const isStatcastPitcher = cardType.includes('statcast');
    return withOverlays(
      <StatcastCard
        data={{ ...safeCard, ...(card as any) } as any}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />,
      isStatcastPitcher, // skipBookmark
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
      <div className={`group relative bg-gradient-to-br ${safeCard.gradient || 'from-blue-600/20 to-purple-900/10'} rounded-2xl p-5 border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-all duration-300 shadow-lg hover:shadow-xl`}>
        <div className="flex items-start gap-3 mb-3">
          <div className="text-2xl leading-none mt-0.5">{emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">{safeCard.category?.toUpperCase()} · {safeCard.subcategory}</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20 uppercase tracking-wider">AI Insight</span>
            </div>
            <h3 className="text-sm font-black text-white">{safeCard.title}</h3>
          </div>
        </div>
        {safeCard.data?.insight && (
          <p className="text-sm text-foreground/80 leading-relaxed border-l-2 border-blue-500/40 pl-3">{safeCard.data.insight}</p>
        )}
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Powered by {safeCard.data?.source || 'Grok 4'}</span>
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
    return withOverlays(
      <PlayerPropCard
        data={safeCard.data}
        category={safeCard.category}
        gradient={safeCard.gradient}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // Prop hit-rate cards (detailed historical analysis with grade rings + recent form)
  if (cardType === 'prop-hit-rate' || cardType === 'prop_hit_rate') {
    const d = safeCard.data;
    return withOverlays(
      <PropHitRateCard
        playerName={String(d.playerName ?? d.player ?? safeCard.title ?? '')}
        statType={String(d.statType ?? d.stat ?? '')}
        hitRatePercentage={parseFloat(String(d.hitRatePercentage ?? d.hitRate ?? 0))}
        totalGames={parseInt(String(d.totalGames ?? 0))}
        hits={parseInt(String(d.hits ?? 0))}
        misses={parseInt(String(d.misses ?? 0))}
        avgLine={parseFloat(String(d.avgLine ?? d.line ?? 0))}
        avgActual={parseFloat(String(d.avgActual ?? 0))}
        trend={d.trend ?? 'stable'}
        confidence={d.confidence ?? 'medium'}
        recommendation={String(d.recommendation ?? '')}
        recentForm={d.recentForm}
        sport={safeCard.category}
        isHero={isHero}
        onAnalyze={handleAnalyze}
      />
    );
  }

  // Line movement cards
  if (cardType === 'line_movement') {
    return withOverlays(
      <LineMovementCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // Kelly bet sizing cards
  if (cardType === 'kelly_bet') {
    return withOverlays(
      <KellyBetCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // Portfolio overview cards
  if (cardType === 'portfolio') {
    return withOverlays(
      <PortfolioCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // ── Trading terminal analytics cards ──────────────────────────────────────

  // Positive-EV bet cards
  if (cardType === 'ev_bet_card') {
    return withOverlays(
      <EVBetCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // Sharp money / steam move cards (must come before 'insight' catch-all)
  if (cardType === 'sharp_money_card') {
    return withOverlays(
      <SharpMoneyCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // Pitcher fatigue cards
  if (cardType === 'pitcher_fatigue_card') {
    return withOverlays(
      <PitcherFatigueCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // Bullpen fatigue cards
  if (cardType === 'bullpen_fatigue_card') {
    return withOverlays(
      <BullpenFatigueCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // Pitch type matchup cards
  if (cardType === 'pitch_matchup_card') {
    return withOverlays(
      <PitchMatchupCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // Umpire strike zone impact cards
  if (cardType === 'umpire_impact_card') {
    return withOverlays(
      <UmpireImpactCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // Catcher framing cards
  if (cardType === 'catcher_framing_card') {
    return withOverlays(
      <CatcherFramingCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // Closing line value (CLV) tracking cards
  if (cardType === 'closing_line_card') {
    return withOverlays(
      <ClosingLineCard
        type={safeCard.type}
        title={safeCard.title}
        category={safeCard.category}
        subcategory={safeCard.subcategory}
        gradient={safeCard.gradient}
        data={safeCard.data}
        status={safeCard.status}
        onAnalyze={handleAnalyze}
        isHero={isHero}
      />
    );
  }

  // ── Standalone typed cards (direct API data, exact type matches) ──────────

  // Enriched odds event (from /api/odds enriched response)
  if (cardType === 'odds_event') {
    return withOverlays(
      <OddsCard
        event={safeCard.data as any}
        onAsk={onAsk}
      />
    );
  }

  // Kalshi market card (from /api/kalshi response)
  if (cardType === 'kalshi_market') {
    return withOverlays(
      <KalshiMarketCard
        market={safeCard.data as any}
        onAsk={onAsk}
      />
    );
  }

  // Player profile card (from /api/players response)
  if (cardType === 'player_profile') {
    return withOverlays(
      <PlayerCard
        player={safeCard.data as any}
        onAsk={onAsk}
      />
    );
  }

  // DFS lineup card (from /api/dfs response)
  if (cardType === 'dfs_lineup') {
    const rawLineup = safeCard.data.lineup;
    const rosterArray: any[] = rawLineup?.roster
      ?? (Array.isArray(rawLineup) ? rawLineup : null)
      ?? safeCard.data.players
      ?? [];
    const totalProjected: number =
      rawLineup?.totalProjected ?? safeCard.data.totalProjected ?? 0;
    // Normalize field names: nfbc_adp enriched players use primaryPosition/projectedPoints
    const lineup = rosterArray.map((p: any) => ({
      ...p,
      player_name: p.player_name ?? p.display_name ?? p.name ?? '',
      player_type: p.player_type ?? p.primaryPosition ?? p.position ?? '',
      dk_pts_mean: p.dk_pts_mean ?? p.projectedPoints ?? 0,
    }));
    return withOverlays(
      <DFSLineupCard
        lineup={lineup}
        totalProjected={totalProjected}
        site={safeCard.data.site ?? 'DK'}
        onAsk={onAsk}
      />
    );
  }

  // Arbitrage opportunity card (standalone typed — exact match first)
  if (cardType === 'arbitrage_opp') {
    return withOverlays(
      <ArbitrageOpportunityCard
        opportunity={safeCard.data as any}
        onAsk={onAsk}
      />
    );
  }

  // ── Legacy arbitrage cards (existing data-cards pipeline) ────────────────
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
