'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Bookmark, FlaskConical, Share2, Check, Pin } from 'lucide-react';
import type { CardData } from '@/lib/types';

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
import { OddsCard } from './OddsCard';
import { KalshiMarketCard } from './KalshiMarketCard';
import { PlayerCard } from './PlayerCard';
import { DFSLineupCard } from './DFSLineupCard';
import { ArbitrageOpportunityCard } from './ArbitrageOpportunityCard';

import { BettingCard } from './BettingCard';
import { DFSCard } from './DFSCard';
import { FantasyCard } from './FantasyCard';
import { KalshiCard } from './KalshiCard';
import { WeatherCard } from './WeatherCard';
import { ArbitrageCard } from './ArbitrageCard';
import { LineMovementCard } from './LineMovementCard';
import { KellyBetCard } from './KellyBetCard';
import { PortfolioCard } from './PortfolioCard';
import { CardSkeleton, CardGrid, SkeletonVariant } from './CardSkeleton';
import { StatcastCard } from './StatcastCard';
import { ADPCard } from './ADPCard';
const ADPUploadModal = dynamic(
  () => import('@/components/ADPUploadModal').then(m => ({ default: m.ADPUploadModal })),
  { ssr: false, loading: () => null },
);
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
import { DFSGamesCard } from './DFSGamesCard';
import { PropHitRateCard } from './PropHitRateCard';
import { PlayerPropCard } from './PlayerPropCard';

// ── Card registries ────────────────────────────────────────────────────────
// Standard-props shape: { type, title, category, subcategory, gradient, data, status, onAnalyze, onAsk, error, isHero }
// Exact-match wins before pattern-match.

const EXACT_STD_REGISTRY: Record<string, React.ComponentType<any>> = {
  line_movement:        LineMovementCard,
  kelly_bet:            KellyBetCard,
  portfolio:            PortfolioCard,
  ev_bet_card:          EVBetCard,
  sharp_money_card:     SharpMoneyCard,
  pitcher_fatigue_card: PitcherFatigueCard,
  bullpen_fatigue_card: BullpenFatigueCard,
  pitch_matchup_card:   PitchMatchupCard,
  umpire_impact_card:   UmpireImpactCard,
  catcher_framing_card: CatcherFramingCard,
  closing_line_card:    ClosingLineCard,
};

const PATTERN_STD_REGISTRY: Array<{ test: (t: string) => boolean; Component: React.ComponentType<any> }> = [
  { test: t => t.includes('dfs') || t.includes('lineup'),                                                                              Component: DFSCard },
  { test: t => t.includes('fantasy') || t.includes('draft') || t.includes('sleeper'),                                                 Component: FantasyCard },
  { test: t => t.includes('kalshi') || t.includes('prediction'),                                                                      Component: KalshiCard },
  { test: t => t.includes('weather') || t.includes('climate'),                                                                        Component: WeatherCard },
  { test: t => t === 'adp-analysis' || t.includes('adp'),                                                                             Component: ADPCard },
  // Note: 'arbitrage' is NOT listed here — the pre-registry catches all arbitrage
  // types (arbitrage_opp → ArbitrageOpportunityCard, *arbitrage* → ArbitrageCard)
  // before this table is ever reached. An entry here would be dead code.
  { test: t => t.includes('odds') || t.includes('betting') || t.includes('moneyline') || t.includes('spread') || t.includes('totals'), Component: BettingCard },
];

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

const STATS_CARD_TYPES = new Set([
  'statcast', 'statcast_summary_card', 'hr_prop_card', 'leaderboard_card',
  'pitch_analysis_card', 'mlb_projection_card', 'vpe_projection_card',
]);

const MINIMAL_CARD_TYPES = new Set([
  'betting-insight', 'insight', 'adp-upload',
]);

function getSkeletonVariant(type: string): SkeletonVariant {
  const t = type.toLowerCase();
  if (t.includes('arbitrage')) return 'arbitrage';
  if (STATS_CARD_TYPES.has(t) || t.includes('statcast') || t.includes('simulation')) return 'stats';
  if (MINIMAL_CARD_TYPES.has(t) || t.includes('insight')) return 'minimal';
  return 'betting';
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
    return <CardSkeleton variant={card ? getSkeletonVariant(card.type) : 'betting'} />;
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

  // Suppress cards with no meaningful data payload. A card is considered empty
  // when every field in `data` is null/undefined or one of the housekeeping keys
  // (`realData`, `status`). Prevents the user from seeing a card shell full of
  // "—" placeholders when a generator regression emits a card without data.
  const meaningfulKeys = Object.keys(safeCard.data).filter(
    k => k !== 'realData' && k !== 'status' && safeCard.data[k] != null && safeCard.data[k] !== '',
  );
  // Statcast-type cards store their metrics at the top level (summary_metrics, lightbox),
  // not inside the data object — skip the empty-data check for them.
  const isStatcastType = STATS_CARD_TYPES.has(card.type) || card.type?.includes('statcast') || card.type?.includes('simulation');
  const hasTopLevelMetrics = isStatcastType && Array.isArray(card.summary_metrics);
  if (meaningfulKeys.length === 0 && !hasTopLevelMetrics) {
    if (safeCard.realData === false) {
      // Simulated/fallback card with no data — safe to suppress
      return null;
    }
    // Live card (realData true/undefined) with empty payload — let the card component
    // render its own empty/error state rather than silently hiding it
    console.warn(
      '[v0] [DynamicCardRenderer] Live card has empty data payload:',
      safeCard.type, '/', safeCard.title,
    );
  }

  // Hide explicit no-games placeholders and offseason stubs
  const isNoGamesCard =
    safeCard.subcategory === 'No Games Available' ||
    (typeof safeCard.data.noGames === 'boolean' && safeCard.data.noGames) ||
    (typeof safeCard.data.status === 'string' && safeCard.data.status === 'NO_DATA') ||
    (safeCard.title.toLowerCase().includes('offseason') && safeCard.realData === false);

  if (isNoGamesCard) return null;

  const handleAnalyze = onAnalyze ? () => onAnalyze(card) : undefined;

  // Whether this card has real live data or is estimated/fallback
  const isEstimated = safeCard.realData === false;
  const hasTrustOverlay = trustScore !== undefined;

  // Data staleness: show "Updated X ago" when fetchedAt is in metadata
  const fetchedAt: string | undefined = (safeCard.metadata as Record<string, unknown> | undefined)?.fetchedAt as string | undefined;
  const dataAgeLabel = (() => {
    if (!fetchedAt || isEstimated) return null;
    const ageMs = Date.now() - new Date(fetchedAt).getTime();
    const mins = Math.floor(ageMs / 60_000);
    if (mins < 1) return null; // < 1 min: don't show (fresh enough)
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  })();

  // Per-card bookmark/pin state (persisted to localStorage)
  const bookmarkKey = `bookmark:${safeCard.type}:${safeCard.title}`;
  const cardId = `${safeCard.type}:${safeCard.title}`;
  const [isBookmarked, setIsBookmarked] = useState(() => {
    try { return !!localStorage.getItem(bookmarkKey); } catch { return false; }
  });
  const toggleBookmark = useCallback(() => {
    setIsBookmarked(prev => {
      const next = !prev;
      try {
        next ? localStorage.setItem(bookmarkKey, '1') : localStorage.removeItem(bookmarkKey);
        const existing: SavedCardEntry[] = JSON.parse(localStorage.getItem(SAVED_CARDS_KEY) ?? '[]');
        const updated = next
          ? [{ id: cardId, savedAt: new Date().toISOString(), card: { type: safeCard.type, title: safeCard.title, category: safeCard.category, subcategory: safeCard.subcategory, gradient: safeCard.gradient, status: safeCard.status, data: safeCard.data } }, ...existing.filter(e => e.id !== cardId)]
          : existing.filter(e => e.id !== cardId);
        localStorage.setItem(SAVED_CARDS_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('saved-cards-update', { detail: { count: updated.length } }));
        // Notify CardLayout to re-sort pinned cards to top
        window.dispatchEvent(new CustomEvent('card-pin-update'));
      } catch {}
      return next;
    });
  }, [bookmarkKey, cardId, safeCard]);

  // Share card: copy formatted summary to clipboard with visual feedback
  const [isShared, setIsShared] = useState(false);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareCard = useCallback(() => {
    const dataLines = Object.entries(safeCard.data)
      .filter(([k, v]) => k !== 'realData' && k !== 'status' && v != null && v !== '')
      .slice(0, 6)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
      .join('\n');
    const text = [
      `📊 ${safeCard.title}`,
      `${safeCard.category} · ${safeCard.subcategory}`,
      dataLines,
      '',
      'Shared from Leverage AI',
    ].join('\n');
    try {
      navigator.clipboard.writeText(text);
      setIsShared(true);
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
      shareTimerRef.current = setTimeout(() => setIsShared(false), 2000);
    } catch {}
  }, [safeCard]);

  // Historical comparison: compare current data to the last snapshot for this card type+title.
  // Detects numeric field movements so we can show ↑/↓ "Updated" badges.
  const HIST_KEY = `chist:${safeCard.type}:${safeCard.title}`;
  const [deltaDir, setDeltaDir] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIST_KEY);
      if (raw) {
        const prev = JSON.parse(raw) as Record<string, any>;
        let ups = 0, downs = 0;
        for (const [k, v] of Object.entries(safeCard.data)) {
          if (k === 'realData' || k === 'status') continue;
          const pv = prev[k];
          if (typeof v === 'number' && typeof pv === 'number' && v !== pv) {
            v > pv ? ups++ : downs++;
          }
        }
        if (ups + downs > 0) setDeltaDir(ups >= downs ? 'up' : 'down');
      }
      localStorage.setItem(HIST_KEY, JSON.stringify(safeCard.data));
    } catch {}
    // Intentionally runs only on mount — safeCard.data is stable per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live indicator: shown on cards with confirmed real data (not estimated)
  const isLive = safeCard.realData === true;

  // Wraps any card element with ESTIMATED badge, trust score chip, pin and share buttons.
  // Pass skipBookmark=true for card types that have their own save/watch mechanism.
  function withOverlays(el: React.ReactElement, skipBookmark = false): React.ReactElement {
    return (
      <div className="relative group/card animate-card-enter">
        {el}

        {/* Top-left: LIVE pulse for confirmed real-time data */}
        {isLive && (
          <span className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
          </span>
        )}

        {/* Top-right: share + pin buttons — revealed on hover, always shown when pinned */}
        <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1 pointer-events-none">
          <div className={`flex items-center gap-1 transition-opacity duration-150 pointer-events-auto ${isBookmarked ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'}`}>
            <button
              onClick={shareCard}
              className="p-1 rounded-md transition-all duration-150 hover:bg-[var(--bg-elevated)]"
              aria-label="Copy card to clipboard"
            >
              {isShared
                ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                : <Share2 className="w-3.5 h-3.5 text-[var(--text-faint)]" />
              }
            </button>
            {!skipBookmark && (
              <button
                onClick={toggleBookmark}
                className={`p-1 rounded-md transition-all duration-150 hover:bg-[var(--bg-elevated)] ${isBookmarked ? 'bg-blue-500/10' : ''}`}
                aria-label={isBookmarked ? 'Unpin card' : 'Pin card'}
              >
                <Pin className={`w-3.5 h-3.5 transition-colors ${isBookmarked ? 'fill-blue-500 text-blue-500' : 'text-[var(--text-faint)]'}`} />
              </button>
            )}
          </div>
          {isEstimated && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold backdrop-blur-sm pointer-events-none" role="note" aria-label="Estimated data">
              <FlaskConical className="w-3 h-3" aria-hidden="true" />
              Estimated
            </span>
          )}
        </div>

        {/* Bottom-right: data age label */}
        {dataAgeLabel && !isEstimated && (
          <span className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 rounded text-[8px] font-semibold tabular-nums bg-[var(--bg-overlay)]/80 text-[var(--text-faint)] border border-[var(--border-subtle)] backdrop-blur-sm pointer-events-none">
            {dataAgeLabel}
          </span>
        )}

        {/* Bottom-left: trust score + historical delta badge side-by-side */}
        {(hasTrustOverlay || deltaDir) && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 pointer-events-none">
            {hasTrustOverlay && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-overlay)]/80 backdrop-blur-sm border border-[var(--border-subtle)]">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  trustLevel === 'high' ? 'bg-emerald-400' :
                  trustLevel === 'medium' ? 'bg-yellow-400' :
                  'bg-red-400'
                }`} />
                <span className="text-[8px] font-bold text-[var(--text-faint)]">{trustScore}%</span>
              </div>
            )}
            {deltaDir && (
              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold border backdrop-blur-sm ${
                deltaDir === 'up'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`} aria-label={`Data ${deltaDir === 'up' ? 'increased' : 'decreased'} since last view`}>
                {deltaDir === 'up' ? '↑' : '↓'} Updated
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Card dispatch ─────────────────────────────────────────────────────────
  const cardType = safeCard.type.toLowerCase();

  // Renders a standard-props card (the majority share this prop shape).
  function renderStd(Component: React.ComponentType<any>, skipBookmark = false): React.ReactElement {
    return withOverlays(
      <Component
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
      />,
      skipBookmark,
    );
  }

  // ── Cards with unique prop shapes (handled before registry lookup) ────────

  // HR Prediction: exact match before 'prediction' catch-all in pattern registry
  if (cardType === 'hr_prediction_card')
    return withOverlays(<HRPredictionCard data={card.data as any} />);

  // VPE 3.0 — merges safeCard + raw card for nested data fields
  if (cardType === 'vpe_projection_card')
    return withOverlays(<VPECard card={{ ...safeCard, ...(card as any) } as any} onAnalyze={handleAnalyze} />);

  // MLB Projections — same merge pattern as VPE
  if (cardType === 'mlb_projection_card')
    return withOverlays(<MLBProjectionCard data={{ ...safeCard, ...(card as any) } as any} onAnalyze={handleAnalyze} isHero={isHero} />);

  // Statcast — skipBookmark only when type string contains 'statcast'
  if (cardType.includes('statcast') || cardType === 'hr_prop_card' || cardType.includes('simulation') || cardType === 'leaderboard_card' || cardType === 'pitch_analysis_card')
    return withOverlays(<StatcastCard data={{ ...safeCard, ...(card as any) } as any} onAnalyze={handleAnalyze} isHero={isHero} />, cardType.includes('statcast'));

  // AI Insight cards (custom JSX — no component wrapper)
  if (cardType === 'betting-insight' || cardType.includes('insight')) {
    const sportEmojis: Record<string, string> = {
      nba: '🏀', nfl: '🏈', mlb: '⚾', nhl: '🏒', ncaab: '🏀', ncaaf: '🏈',
    };
    const emoji = sportEmojis[safeCard.category?.toLowerCase() ?? ''] ?? '📊';
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

  // ADP upload — no overlay wrapper (it is the trigger modal itself)
  if (cardType === 'adp-upload')
    return <ADPUploadModal sport={(safeCard.data?.sport as 'mlb' | 'nfl' | undefined) ?? 'mlb'} />;

  // Prop hit-rate — unique destructured prop shape
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

  // Player prop — different prop shape (data + category + gradient only)
  if (cardType.includes('player_prop') || cardType === 'player-prop')
    return withOverlays(<PlayerPropCard data={safeCard.data} category={safeCard.category} gradient={safeCard.gradient} onAnalyze={handleAnalyze} isHero={isHero} />);

  // Standalone typed cards (direct API data, exact matches)
  if (cardType === 'odds_event')      return withOverlays(<OddsCard event={safeCard.data as any} onAsk={onAsk} />);
  if (cardType === 'kalshi_market')   return withOverlays(<KalshiMarketCard market={safeCard.data as any} onAsk={onAsk} />);
  if (cardType === 'player_profile')  return withOverlays(<PlayerCard player={safeCard.data as any} onAsk={onAsk} />);
  if (cardType === 'arbitrage_opp')   return withOverlays(<ArbitrageOpportunityCard opportunity={safeCard.data as any} onAsk={onAsk} />);

  // DFS Lineup — requires field normalization before render
  if (cardType === 'dfs_lineup') {
    const rawLineup = safeCard.data.lineup;
    const rosterArray: any[] = rawLineup?.roster ?? (Array.isArray(rawLineup) ? rawLineup : null) ?? safeCard.data.players ?? [];
    const lineup = rosterArray.map((p: any) => ({
      ...p,
      player_name: p.player_name ?? p.display_name ?? p.name ?? '',
      player_type: p.player_type ?? p.primaryPosition ?? p.position ?? '',
      dk_pts_mean: p.dk_pts_mean ?? p.projectedPoints ?? 0,
    }));
    return withOverlays(<DFSLineupCard lineup={lineup} totalProjected={rawLineup?.totalProjected ?? safeCard.data.totalProjected ?? 0} site={safeCard.data.site ?? 'DK'} onAsk={onAsk} />);
  }

  // DFS Games: skipBookmark (interactive card with built-in controls)
  if (cardType === 'dfs-games')  return withOverlays(<DFSGamesCard data={safeCard.data as any} onAsk={onAsk} />, true);
  // DFS Slate: full lineup roster card
  if (cardType === 'dfs-slate')  return withOverlays(<DFSSlateCard title={safeCard.title} data={safeCard.data} onAnalyze={handleAnalyze} isHero={isHero} />);

  // ArbitrageCard has different props from ArbitrageOpportunityCard (legacy pipeline)
  if (cardType.includes('arbitrage'))
    return withOverlays(<ArbitrageCard data={safeCard.data as any} gradient={safeCard.gradient} onAnalyze={handleAnalyze} isHero={isHero} />);

  // ── Standard registry lookup (exact → pattern → fallback) ─────────────────
  if (cardType in EXACT_STD_REGISTRY) return renderStd(EXACT_STD_REGISTRY[cardType]);
  for (const { test, Component } of PATTERN_STD_REGISTRY) {
    if (test(cardType)) return renderStd(Component);
  }
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[DynamicCardRenderer] Unknown card type "${safeCard.type}" — falling back to BettingCard. Add it to CARD_TYPES and the dispatch chain.`);
  }
  return renderStd(BettingCard);
}

interface CardListProps {
  cards: CardData[];
  onAnalyze?: (card: CardData) => void;
  isLoading?: boolean;
  className?: string;
}

export function CardList({ cards, onAnalyze, isLoading, className = '' }: CardListProps) {
  if (isLoading) {
    return <CardGrid count={3} className={className} />;
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
          key={`${card.type}-${card.title ?? ''}-${index}`}
          card={card}
          index={index}
          onAnalyze={onAnalyze}
        />
      ))}
    </div>
  );
}
