'use client';

import { useState, useRef, useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  Target, BarChart, Activity, Bell, Layers, TrendingUp, DollarSign, Zap,
  Trophy, Star, Users, Sparkles, AlertCircle, Medal, ShoppingCart,
  CheckCircle, PieChart, Clock, Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { InsightCard } from '@/components/InsightCard';
import { isDev } from '@/lib/config';

export interface UseSuggestedPromptsOptions {
  selectedCategory: string;
  selectedSport: string;
  initPromptsLoadedRef: React.MutableRefObject<boolean>;
}

type PromptItem = { label: string; icon: LucideIcon; category: string; query?: string };
type QuickAction = { label: string; icon: LucideIcon; category: string; query: string };

const UNIVERSAL_SUGGESTIONS: PromptItem[] = [
  { label: "What are tonight's best value opportunities?", icon: Sparkles, category: 'all' },
  { label: 'Show me high-confidence plays across platforms', icon: CheckCircle, category: 'all' },
  { label: 'Compare live odds across all sportsbooks', icon: BarChart, category: 'betting' },
  { label: 'Find contrarian tournament plays', icon: Users, category: 'dfs' },
  { label: 'Track sharp money movements in real-time', icon: TrendingUp, category: 'betting' },
  { label: 'Optimize my overall portfolio allocation', icon: PieChart, category: 'all' },
  { label: 'Breaking news and injury updates', icon: AlertCircle, category: 'all' },
  { label: 'Show me arbitrage opportunities', icon: DollarSign, category: 'all' },
];

export function useSuggestedPrompts({
  selectedCategory,
  selectedSport,
  initPromptsLoadedRef,
}: UseSuggestedPromptsOptions) {
  const [suggestedPrompts, setSuggestedPrompts] = useState<PromptItem[]>([]);
  const [isClarificationPills, setIsClarificationPills] = useState(false);
  const [aiQuickActions, setAiQuickActions] = useState<QuickAction[] | null>(null);
  const [lastUserQuery, setLastUserQuery] = useState<string>('');
  const lastSuggestionQueryRef = useRef<string>('');
  const normalizedCategory = useMemo(() => selectedCategory.toLowerCase(), [selectedCategory]);

  // Fetch AI-generated quick-action prompts when category or sport changes.
  // Skips the first mount if loadInitData already seeded prompts (initPromptsLoadedRef guard).
  useEffect(() => {
    if (initPromptsLoadedRef.current) {
      initPromptsLoadedRef.current = false;
      return;
    }
    let cancelled = false;
    setAiQuickActions(null);
    fetch(`/api/prompts?category=${encodeURIComponent(selectedCategory)}&sport=${encodeURIComponent(selectedSport ?? '')}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.prompts) && data.prompts.length > 0) {
          setAiQuickActions(
            data.prompts.map((p: { label: string; query: string }) => ({
              label: p.label,
              icon: Sparkles,
              category: selectedCategory,
              query: p.query,
            }))
          );
        }
      })
      .catch(() => { /* network failure — fall back to hardcoded */ });
    return () => { cancelled = true; };
  }, [selectedCategory, selectedSport]);

  const generateContextualSuggestions = useCallback((userMessage: string, responseCards: InsightCard[]) => {
    if (userMessage === lastSuggestionQueryRef.current && responseCards.length === 0) {
      return suggestedPrompts;
    }
    lastSuggestionQueryRef.current = userMessage;

    const msgLower = userMessage.toLowerCase();
    const suggestions: Array<{ label: string; icon: LucideIcon; category: string }> = [];

    const matchups = responseCards
      .map(c => c.data?.matchup as string | undefined)
      .filter(Boolean) as string[];
    const firstMatchup = matchups[0];
    const teams = firstMatchup
      ? firstMatchup.split(' @ ').map(t => t.split(' ').slice(-1)[0])
      : [];
    const firstAway = teams[0] ?? '';
    const firstHome = teams[1] ?? '';
    const playerName = responseCards.find(c => c.data?.player)?.data?.player as string | undefined;
    const cardTypes = responseCards.map(card => card.type);
    const hasLiveOdds = cardTypes.some(t => t.includes('odds') || t.includes('live'));
    const hasDFSLineup = cardTypes.some(t => t.includes('dfs'));
    const hasFantasy = cardTypes.some(t => t.includes('fantasy') || t.includes('draft') || t.includes('waiver'));
    const hasKalshi = cardTypes.some(t => t.includes('kalshi') || t.includes('prediction'));
    const hasPlayerProps = cardTypes.some(t => t.includes('prop'));

    const isLineMovement = msgLower.includes('line move') || msgLower.includes('movement') || msgLower.includes('steam');
    const isFantasyQ = msgLower.includes('draft') || msgLower.includes('fantasy') || msgLower.includes('adp') || normalizedCategory === 'fantasy';
    const isDFS = msgLower.includes('dfs') || msgLower.includes('lineup') || normalizedCategory === 'dfs';
    const isKalshi = msgLower.includes('kalshi') || msgLower.includes('prediction') || normalizedCategory === 'kalshi';
    const isArbitrage = msgLower.includes('arbitrage') || msgLower.includes('arb');
    const isParlay = msgLower.includes('parlay') || msgLower.includes('same-game') || msgLower.includes('sgp');
    const isPlayerProp = msgLower.includes('prop') || !!playerName;

    if (isLineMovement) {
      suggestions.push(
        { label: 'Where is the sharp money going on this game?', icon: Target, category: 'betting' },
        { label: 'Show me opening line vs current line comparison', icon: BarChart, category: 'betting' },
        { label: 'What does this movement say about public vs sharp action?', icon: Activity, category: 'betting' },
        { label: 'Set an alert if this line moves another half point', icon: Bell, category: 'betting' },
        { label: 'Find correlated player props based on this line move', icon: Layers, category: 'betting' }
      );
    }

    if (isPlayerProp && !isLineMovement) {
      suggestions.push(
        { label: 'Show me the historical hit rate for this player prop', icon: BarChart, category: 'betting' },
        { label: 'Stack this prop into a same-game parlay', icon: Layers, category: 'betting' },
        { label: 'Find correlated props for the same game', icon: Target, category: 'betting' },
        { label: 'Compare this line across all sportsbooks', icon: Activity, category: 'betting' }
      );
    }

    if (isArbitrage) {
      suggestions.push(
        { label: 'Calculate optimal Kelly sizing for this arb', icon: DollarSign, category: 'betting' },
        { label: 'Show me more live arbitrage opportunities', icon: Zap, category: 'betting' },
        { label: 'Alert me when new arbs appear on these books', icon: Bell, category: 'betting' }
      );
    }

    if (isParlay) {
      suggestions.push(
        { label: 'What legs have the best correlation in this parlay?', icon: Layers, category: 'betting' },
        { label: 'Show me the EV calculation for each leg', icon: BarChart, category: 'betting' },
        { label: 'Find the best sportsbook for this exact parlay', icon: Target, category: 'betting' }
      );
    }

    if (hasLiveOdds && !isLineMovement) {
      const gameCtx = firstMatchup ? `for ${firstAway} vs ${firstHome}` : 'on these games';
      suggestions.push(
        { label: `Show player props ${gameCtx}`, icon: Target, category: 'betting' },
        { label: `How has the line moved ${gameCtx}?`, icon: TrendingUp, category: 'betting' },
        { label: `Sharp vs public money split ${gameCtx}`, icon: Activity, category: 'betting' },
      );
    }

    if (hasDFSLineup) {
      suggestions.push(
        { label: 'What is the leverage score for this lineup?', icon: Trophy, category: 'dfs' },
        { label: 'Build a contrarian GPP lineup', icon: Users, category: 'dfs' },
        { label: 'Show me the betting lines supporting these picks', icon: TrendingUp, category: 'all' }
      );
    }

    if (hasPlayerProps) {
      const propName = playerName ? `${playerName}'s prop` : 'this player prop';
      suggestions.push(
        { label: `Historical hit rate for ${propName}`, icon: BarChart, category: 'betting' },
        { label: `Stack ${propName} into a same-game parlay`, icon: Layers, category: 'betting' },
        { label: 'Find correlated props in the same game', icon: Target, category: 'betting' }
      );
    }

    if (hasFantasy) {
      suggestions.push(
        { label: 'Show me waiver wire targets this week', icon: Star, category: 'fantasy' },
        { label: 'VBD rankings for this position', icon: Trophy, category: 'fantasy' }
      );
    }

    if (hasKalshi) {
      const topTitle = responseCards.find(c => c.type?.includes('kalshi'))?.title;
      suggestions.push(
        { label: topTitle ? `Deeper analysis on: ${topTitle.slice(0, 45)}` : 'Which Kalshi markets have the best edge?', icon: Sparkles, category: 'kalshi' },
        { label: 'Cross-market arbitrage: Kalshi vs sportsbooks', icon: DollarSign, category: 'kalshi' },
        { label: 'Show me weather markets affecting game totals', icon: Activity, category: 'kalshi' }
      );
    }

    const cardCategories = [...new Set(responseCards.map(c => c.category?.toUpperCase()))];
    if (cardCategories.includes('NBA')) {
      suggestions.push(
        { label: firstMatchup ? `Rest advantage analysis: ${firstAway} vs ${firstHome}` : 'NBA rest-advantage games tonight', icon: AlertCircle, category: 'betting' },
        { label: 'NBA pace-up games for totals', icon: Zap, category: 'dfs' }
      );
    }
    if (cardCategories.includes('NFL') || cardCategories.includes('NFC')) {
      suggestions.push(
        { label: 'Weather impact on these NFL games', icon: Activity, category: 'betting' },
        { label: 'Correlated TD scorer + game total parlays', icon: Medal, category: 'betting' }
      );
    }
    if (cardCategories.includes('NHL')) {
      suggestions.push(
        { label: firstMatchup ? `Goalie matchup analysis: ${firstAway} vs ${firstHome}` : 'NHL goalie matchup edges tonight', icon: Target, category: 'betting' },
      );
    }
    if (cardCategories.includes('MLB')) {
      suggestions.push(
        { label: 'Starting pitcher edges for today', icon: Target, category: 'betting' },
        { label: 'Wind and weather impact on totals', icon: Activity, category: 'betting' }
      );
    }

    const p3Category =
      normalizedCategory !== 'all'
        ? normalizedCategory
        : isDFS      ? 'dfs'
        : isFantasyQ ? 'fantasy'
        : isKalshi   ? 'kalshi'
        : 'betting';

    if (p3Category === 'dfs' && suggestions.length < 5) {
      suggestions.push(
        { label: 'Build a low-ownership tournament stack', icon: Users, category: 'dfs' },
        { label: 'Find value plays under $5K salary', icon: DollarSign, category: 'dfs' },
        { label: 'Showdown slate captain picks with leverage', icon: Medal, category: 'dfs' }
      );
    } else if (p3Category === 'fantasy' && suggestions.length < 5) {
      suggestions.push(
        { label: 'Show me ADP risers this week', icon: TrendingUp, category: 'fantasy' },
        { label: 'Best ball stacking strategy', icon: Medal, category: 'fantasy' },
        { label: 'Auction value targets this week', icon: ShoppingCart, category: 'fantasy' }
      );
    } else if (p3Category === 'kalshi' && suggestions.length < 5) {
      suggestions.push(
        { label: 'Show trending Kalshi markets', icon: TrendingUp, category: 'kalshi' },
        { label: 'Political markets with market inefficiency', icon: Activity, category: 'kalshi' },
        { label: 'Weather + climate prediction markets', icon: Sparkles, category: 'kalshi' }
      );
    }

    responseCards.forEach(card => {
      if (suggestions.length >= 7) return;
      if (card.type === 'live-odds' && card.data.movement) {
        suggestions.push({ label: `Track ${card.data.matchup} live until game time`, icon: Clock, category: 'betting' });
      }
      if (card.type === 'dfs-lineup' && card.data.topPlay) {
        suggestions.push({ label: `Build alternate lineup fading ${card.data.topPlay}`, icon: Users, category: 'dfs' });
      }
      if (card.type === 'player-prop' && card.data.player) {
        suggestions.push({ label: `Find correlated ${card.data.player} same-game parlays`, icon: Medal, category: 'betting' });
      }
      if (card.type === 'adp-analysis' && card.data.player) {
        suggestions.push({ label: 'Show similar value picks in this ADP range', icon: Search, category: 'fantasy' });
      }
      if (card.type === 'kalshi-market' && card.data.event) {
        suggestions.push({ label: `Alert me on ${card.data.market} price movements`, icon: Bell, category: 'kalshi' });
      }
    });

    const existingLabels = new Set(suggestions.map(s => s.label));
    for (const suggestion of UNIVERSAL_SUGGESTIONS) {
      if (suggestions.length >= 7) break;
      if (!existingLabels.has(suggestion.label)) {
        suggestions.push(suggestion);
        existingLabels.add(suggestion.label);
      }
    }
    const seen = new Set<string>();
    const lowerMessage = userMessage.toLowerCase();
    const uniqueSuggestions = suggestions.filter((suggestion) => {
      if (suggestion.label.toLowerCase() === lowerMessage) return false;
      if (seen.has(suggestion.label)) return false;
      seen.add(suggestion.label);
      return true;
    });

    if (isDev()) console.log('[v0] Suggestions:', uniqueSuggestions.length, 'generated');

    return uniqueSuggestions.slice(0, 7);
  // selectedCategory drives suggestion routing; suggestedPrompts is the early-return fallback.
  }, [normalizedCategory, suggestedPrompts]);

  return {
    suggestedPrompts,
    setSuggestedPrompts: setSuggestedPrompts as Dispatch<SetStateAction<PromptItem[]>>,
    isClarificationPills,
    setIsClarificationPills,
    aiQuickActions,
    setAiQuickActions,
    lastUserQuery,
    setLastUserQuery,
    generateContextualSuggestions,
  };
}
