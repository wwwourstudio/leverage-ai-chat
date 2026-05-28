'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import {
  FlaskConical, BookmarkPlus, BookmarkCheck,
  Share2, Check, History, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CardData } from '@/lib/types';
import { useToast } from '@/components/toast-provider';
import { CardHistoryPanel } from './CardHistoryPanel';

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

const PATTERN_STD_REGISTRY: Array<{ test: (t: string) => boolean; Component: React.ComponentType<any>; skipBookmark?: boolean }> = [
  { test: t => t.includes('dfs') || t.includes('lineup'),                                                                              Component: DFSCard },
  { test: t => t.includes('fantasy') || t.includes('draft') || t.includes('sleeper'),                                                 Component: FantasyCard, skipBookmark: true },
  { test: t => t.includes('kalshi') || t.includes('prediction'),                                                                      Component: KalshiCard },
  { test: t => t.includes('weather') || t.includes('climate'),                                                                        Component: WeatherCard },
  { test: t => t === 'adp-analysis' || t.includes('adp'),                                                                             Component: ADPCard },
  // Note: 'arbitrage' is NOT listed here — the pre-registry catches all arbitrage
  // types (arbitrage_opp → ArbitrageOpportunityCard, *arbitrage* → ArbitrageCard)
  // before this table is ever reached. An entry here would be dead code.
  { test: t => t === 'moneyline-value' || t === 'totals-value',                                                                        Component: BettingCard },
  { test: t => t === 'fantasy-insight' || t === 'bestball-stack' || t === 'auction-value',                                            Component: FantasyCard, skipBookmark: true },
  { test: t => t.includes('dfs-value') || t.includes('dfs-matchup') || t.includes('dfs-contrarian') || t.includes('dfs-strategy'),   Component: DFSCard },
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
  /** Timestamp that increments on real-time refresh; triggers amber flash animation. */
  refreshKey?: number;
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
  refreshKey,
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

  // Suppress cards with no meaningful data payload.
  const meaningfulKeys = Object.keys(safeCard.data).filter(
    k => k !== 'realData' && k !== 'status' && safeCard.data[k] != null && safeCard.data[k] !== '',
  );
  const isStatcastType = STATS_CARD_TYPES.has(card.type) || card.type?.includes('statcast') || card.type?.includes('simulation');
  const hasTopLevelMetrics = isStatcastType && Array.isArray(card.summary_metrics);
  if (meaningfulKeys.length === 0 && !hasTopLevelMetrics) {
    if (safeCard.realData === false) return null;
    console.warn('[v0] [DynamicCardRenderer] Live card has empty data payload:', safeCard.type, '/', safeCard.title);
  }

  // Hide explicit no-games placeholders and offseason stubs
  const isNoGamesCard =
    safeCard.subcategory === 'No Games Available' ||
    (typeof safeCard.data.noGames === 'boolean' && safeCard.data.noGames) ||
    (typeof safeCard.data.status === 'string' && safeCard.data.status === 'NO_DATA') ||
    (safeCard.title.toLowerCase().includes('offseason') && safeCard.realData === false);

  if (isNoGamesCard) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 px-4 py-3 flex items-center gap-2 opacity-60">
        <span className="text-[10px] text-[var(--text-faint)] italic">
          No live {safeCard.category || safeCard.title} data right now
        </span>
      </div>
    );
  }

  const handleAnalyze = onAnalyze ? () => onAnalyze(card) : undefined;

  const isEstimated = safeCard.realData === false;
  const hasTrustOverlay = trustScore !== undefined;

  const fetchedAt: string | undefined = (safeCard.metadata as Record<string, unknown> | undefined)?.fetchedAt as string | undefined;
  const dataAgeLabel = (() => {
    if (!fetchedAt || isEstimated) return null;
    const ageMs = Date.now() - new Date(fetchedAt).getTime();
    const mins = Math.floor(ageMs / 60_000);
    if (mins < 1) return null;
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  })();

  // ── Hooks (must remain after early returns to preserve existing behavior) ───

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { addToast } = useToast();

  // Bookmark / pin state
  const bookmarkKey = `bookmark:${safeCard.type}:${safeCard.title}`;
  const cardId = `${safeCard.type}:${safeCard.title}`;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [isBookmarked, setIsBookmarked] = useState(() => {
    try { return !!localStorage.getItem(bookmarkKey); } catch { return false; }
  });
  // eslint-disable-next-line react-hooks/rules-of-hooks
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
        window.dispatchEvent(new CustomEvent('card-pin-update'));
      } catch {}
      return next;
    });
  }, [bookmarkKey, cardId, safeCard]);

  // Sharing state
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [sharing, setSharing] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleShare = useCallback(async () => {
    const sportEmojis: Record<string, string> = { nba: '🏀', nfl: '🏈', mlb: '⚾', nhl: '🏒' };
    const emoji = sportEmojis[safeCard.category?.toLowerCase()] ?? '📊';
    const pairs = Object.entries(safeCard.data)
      .filter(([k, v]) => k !== 'realData' && k !== 'status' && typeof v !== 'object' && v != null)
      .slice(0, 4)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
    const text = `${emoji} ${safeCard.title}\n${safeCard.category} · ${safeCard.subcategory}\n${pairs.join(' · ')}\n\nvia Leverage AI`;
    setSharing(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: safeCard.title, text });
      } else {
        await navigator.clipboard.writeText(text);
        addToast('Copied to clipboard');
      }
    } catch { /* user dismissed */ }
    finally { setTimeout(() => setSharing(false), 1500); }
  }, [safeCard, addToast]);

  // History panel visibility
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [showHistory, setShowHistory] = useState(false);

  // Mobile swipe + long-press state
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [swipeHint, setSwipeHint] = useState<'left' | 'right' | null>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [showQuickActions, setShowQuickActions] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    longPressTimerRef.current = setTimeout(() => {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
      setShowQuickActions(true);
      touchStartRef.current = null;
    }, 300);
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    clearTimeout(longPressTimerRef.current!);
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
    if (Math.abs(dx) > 24 && Math.abs(dx) > dy * 1.5) {
      setSwipeHint(dx > 0 ? 'right' : 'left');
    }
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearTimeout(longPressTimerRef.current!);
    setSwipeHint(null);
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
    touchStartRef.current = null;
    if (Math.abs(dx) < 72 || Math.abs(dx) <= dy * 1.5) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
    if (dx > 0) toggleBookmark(); else handleShare();
  }, [toggleBookmark, handleShare]);

  // Value-changed flash animation (triggered by refreshKey prop changing)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [flashValue, setFlashValue] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const prevRefreshKeyRef = useRef(refreshKey);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== prevRefreshKeyRef.current) {
      prevRefreshKeyRef.current = refreshKey;
      setFlashValue(true);
      const t = setTimeout(() => setFlashValue(false), 800);
      return () => clearTimeout(t);
    }
  }, [refreshKey]);

  // Historical comparison: compare current data to last snapshot + maintain rolling history
  const HIST_KEY = `chist:${safeCard.type}:${safeCard.title}`;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [deltaDir, setDeltaDir] = useState<'up' | 'down' | null>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
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

      // Maintain rolling 5-snapshot history for CardHistoryPanel
      const histKey = `card_history:${safeCard.type}:${safeCard.title}`;
      const existing = JSON.parse(localStorage.getItem(histKey) ?? '[]') as Array<{ ts: string; data: Record<string, any> }>;
      const updated = [{ ts: new Date().toISOString(), data: safeCard.data }, ...existing].slice(0, 5);
      localStorage.setItem(histKey, JSON.stringify(updated));
    } catch {}
    // Intentionally runs only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLive = safeCard.realData === true;

  // ── withOverlays: wraps any card with overlay badges + interactive buttons ──

  function withOverlays(el: React.ReactElement, skipBookmark = false): React.ReactElement {
    return (
      <>
        <div
          className={cn(
            'relative group/card animate-card-enter',
            flashValue && 'animate-value-changed',
          )}
          style={{ animationDelay: `${Math.min((index ?? 0) * 60, 300)}ms` }}
          onTouchStart={!skipBookmark ? handleTouchStart : undefined}
          onTouchMove={!skipBookmark ? handleTouchMove : undefined}
          onTouchEnd={!skipBookmark ? handleTouchEnd : undefined}
        >
          {el}

          {/* Swipe hints (mobile) */}
          {!skipBookmark && swipeHint === 'right' && (
            <div className="absolute inset-y-0 right-0 w-16 flex items-center justify-center bg-blue-500/10 rounded-r-[var(--ui-radius-card,12px)] animate-swipe-hint-right pointer-events-none z-20">
              <BookmarkPlus className="w-5 h-5 text-blue-400" />
            </div>
          )}
          {!skipBookmark && swipeHint === 'left' && (
            <div className="absolute inset-y-0 left-0 w-16 flex items-center justify-center bg-purple-500/10 rounded-l-[var(--ui-radius-card,12px)] animate-swipe-hint-left pointer-events-none z-20">
              <Share2 className="w-5 h-5 text-purple-400" />
            </div>
          )}

          {/* Bookmark button */}
          {!skipBookmark && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleBookmark(); }}
              aria-label={isBookmarked ? 'Unpin card' : 'Pin card'}
              className={cn(
                'absolute z-10 w-7 h-7 rounded-full flex items-center justify-center',
                'opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 transition-all duration-150',
                isEstimated ? 'top-9 right-2' : 'top-2 right-2',
                isBookmarked
                  ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400 animate-bookmark-spring'
                  : 'bg-[var(--bg-overlay)]/80 backdrop-blur-sm border border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-foreground',
              )}
            >
              {isBookmarked
                ? <BookmarkCheck className="w-3.5 h-3.5" />
                : <BookmarkPlus className="w-3.5 h-3.5" />
              }
            </button>
          )}

          {/* Share button */}
          {!skipBookmark && (
            <button
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              aria-label="Share card"
              className={cn(
                'absolute z-10 w-7 h-7 rounded-full flex items-center justify-center',
                'opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 transition-all duration-150',
                isEstimated ? 'top-9 right-10' : 'top-2 right-10',
                sharing
                  ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400'
                  : 'bg-[var(--bg-overlay)]/80 backdrop-blur-sm border border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-foreground',
              )}
            >
              {sharing ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* History toggle button */}
          {!skipBookmark && (
            <button
              onClick={() => setShowHistory(p => !p)}
              aria-label={showHistory ? 'Hide history' : 'Show history'}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--bg-overlay)]/80 border border-[var(--border-subtle)] text-[var(--text-faint)] opacity-0 group-hover/card:opacity-100 transition-all duration-150 whitespace-nowrap"
            >
              <History className="w-2.5 h-2.5" />
              {showHistory ? 'Hide' : 'History'}
            </button>
          )}

          {/* ESTIMATED badge */}
          {isEstimated && (
            <span className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold backdrop-blur-sm pointer-events-none animate-badge-pop animate-delay-150" role="note" aria-label="Estimated data">
              <FlaskConical className="w-3 h-3" aria-hidden="true" />
              Estimated
            </span>
          )}

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
                    trustLevel === 'high' ? 'bg-blue-400' :
                    trustLevel === 'medium' ? 'bg-yellow-400' :
                    'bg-red-400'
                  }`} />
                  <span className="text-[8px] font-bold text-[var(--text-faint)]">{trustScore}%</span>
                </div>
              )}
              {deltaDir && (
                <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold border backdrop-blur-sm ${
                  deltaDir === 'up'
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`} aria-label={`Data ${deltaDir === 'up' ? 'increased' : 'decreased'} since last view`}>
                  {deltaDir === 'up' ? '↑' : '↓'} Updated
                </span>
              )}
            </div>
          )}
        </div>

        {/* History panel — rendered outside the card div to avoid clip issues */}
        {!skipBookmark && showHistory && (
          <CardHistoryPanel
            cardKey={`${safeCard.type}:${safeCard.title}`}
            currentData={safeCard.data}
          />
        )}

        {/* Quick-action bottom sheet (mobile long-press) */}
        {!skipBookmark && showQuickActions && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowQuickActions(false)}
          >
            <div
              className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-2xl p-4 pb-8 space-y-1 animate-slide-up"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-[10px] font-black text-[var(--text-faint)] uppercase tracking-wider mb-3 px-1 truncate">
                {safeCard.title}
              </div>
              {([
                { Icon: Sparkles, label: 'Analyze', action: handleAnalyze },
                { Icon: Share2,   label: 'Share',   action: handleShare },
                { Icon: isBookmarked ? BookmarkCheck : BookmarkPlus, label: isBookmarked ? 'Unpin' : 'Pin', action: toggleBookmark },
                { Icon: History,  label: showHistory ? 'Hide History' : 'History', action: () => setShowHistory(p => !p) },
              ] as const).map(({ Icon, label, action }) => (
                <button
                  key={label}
                  onClick={() => { action?.(); setShowQuickActions(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors text-left"
                >
                  <Icon className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                  <span className="text-sm font-semibold text-foreground">{label}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
      </>
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

  if (cardType === 'hr_prediction_card')
    return withOverlays(<HRPredictionCard data={card.data as any} />);

  if (cardType === 'vpe_projection_card')
    return withOverlays(<VPECard card={{ ...safeCard, ...(card as any) } as any} onAnalyze={handleAnalyze} />);

  if (cardType === 'mlb_projection_card')
    return withOverlays(<MLBProjectionCard data={{ ...safeCard, ...(card as any) } as any} onAnalyze={handleAnalyze} isHero={isHero} />);

  if (cardType.includes('statcast') || cardType === 'hr_prop_card' || cardType.includes('simulation') || cardType === 'leaderboard_card' || cardType === 'pitch_analysis_card')
    return withOverlays(<StatcastCard data={{ ...safeCard, ...(card as any) } as any} onAnalyze={handleAnalyze} isHero={isHero} />, cardType.includes('statcast'));

  if (cardType === 'betting-insight' || cardType.includes('insight')) {
    const sportEmojis: Record<string, string> = {
      nba: '🏀', nfl: '🏈', mlb: '⚾', nhl: '🏒', ncaab: '🏀', ncaaf: '🏈',
    };
    const emoji = sportEmojis[safeCard.category?.toLowerCase() ?? ''] ?? '📊';
    return withOverlays(
      <div className={`group relative bg-gradient-to-br ${safeCard.gradient || 'from-blue-600/20 dark:to-purple-900/10'} rounded-2xl p-5 border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-all duration-300 shadow-lg hover:shadow-xl`}>
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

  if (cardType === 'adp-upload')
    return <ADPUploadModal sport={(safeCard.data?.sport as 'mlb' | 'nfl' | undefined) ?? 'mlb'} />;

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

  if (cardType.includes('player_prop') || cardType === 'player-prop')
    return withOverlays(<PlayerPropCard data={safeCard.data} category={safeCard.category} gradient={safeCard.gradient} onAnalyze={handleAnalyze} isHero={isHero} />);

  if (cardType === 'odds_event')      return withOverlays(<OddsCard event={safeCard.data as any} onAsk={onAsk} />);
  if (cardType === 'kalshi_market')   return withOverlays(<KalshiMarketCard market={safeCard.data as any} onAsk={onAsk} />);
  if (cardType === 'player_profile')  return withOverlays(<PlayerCard player={safeCard.data as any} onAsk={onAsk} />);
  if (cardType === 'arbitrage_opp')   return withOverlays(<ArbitrageOpportunityCard opportunity={safeCard.data as any} onAsk={onAsk} />);

  if (cardType === 'dfs_lineup') {
    const rawLineup = safeCard.data.lineup;
    const rosterArray: any[] = rawLineup?.roster ?? (Array.isArray(rawLineup) ? rawLineup : null) ?? safeCard.data.players ?? [];
    const lineup = rosterArray.map((p: any) => ({
      ...p,
      player_name: p.player_name ?? p.display_name ?? p.name ?? '',
      player_type: p.player_type ?? p.primaryPosition ?? p.position ?? '',
      dk_pts_mean: p.dk_pts_mean ?? p.projectedPoints ?? 0,
    }));
    // DFSLineupCard has its own complete shell with header/badges — render without
    // withOverlays so the generic "ESTIMATED" badge never collides with the card's UI.
    return (
      <DFSLineupCard
        lineup={lineup}
        totalProjected={rawLineup?.totalProjected ?? safeCard.data.totalProjected ?? 0}
        site={safeCard.data.site ?? 'DK'}
        onAsk={onAsk}
      />
    );
  }

  if (cardType === 'dfs-games')  return <DFSGamesCard data={safeCard.data as any} onAsk={onAsk} />;
  if (cardType === 'dfs-slate')  return <DFSSlateCard title={safeCard.title} data={safeCard.data} onAnalyze={handleAnalyze} isHero={isHero} />;

  if (cardType.includes('arbitrage'))
    return withOverlays(<ArbitrageCard data={safeCard.data as any} gradient={safeCard.gradient} onAnalyze={handleAnalyze} isHero={isHero} />);

  // ── Standard registry lookup (exact → pattern → fallback) ─────────────────
  if (cardType in EXACT_STD_REGISTRY) return renderStd(EXACT_STD_REGISTRY[cardType]);
  for (const { test, Component, skipBookmark } of PATTERN_STD_REGISTRY) {
    if (test(cardType)) return renderStd(Component, skipBookmark);
  }
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[DynamicCardRenderer] Unknown card type "${safeCard.type}" — falling back to BettingCard.`);
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
