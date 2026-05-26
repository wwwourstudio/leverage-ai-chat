'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import dynamic from 'next/dynamic';
import { fetchDynamicCards } from '@/lib/data-service';
import { useCardRefresh } from '@/lib/hooks/use-card-refresh';
import { FREE_TIER, GROK_VOICE_STORAGE_KEY, GROK_VOICE_DEFAULT } from '@/lib/constants';
import { isDev as getIsDev } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';
import { extractSport } from '@/lib/sport-detection';
import { useModalState } from '@/lib/hooks/useModalState';
import { useCredits } from '@/lib/hooks/useCredits';
import { useMessageEditor } from '@/lib/hooks/useMessageEditor';
import { useChatList, type Chat } from '@/lib/hooks/useChatList';
import { useCardAnalysis } from '@/lib/hooks/useCardAnalysis';
import { useSuggestedPrompts } from '@/lib/hooks/useSuggestedPrompts';
import { useFileHandling, type FileAttachment } from '@/lib/hooks/useFileHandling';
import { useKalshiStore } from '@/lib/store/kalshi-store';
import { useGenerateResponse } from '@/lib/hooks/useGenerateResponse';
import { useAppStore, type AppCategory } from '@/lib/store/app-store';
import { useUserStore } from '@/lib/store/user-store';
import { useFantasyStore } from '@/lib/store/fantasy-store';
import { TrendingUp, Trophy, Award, Layers, BarChart3, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/toast-provider';
import { Sidebar } from '@/components/Sidebar';
import { ChatHeader } from '@/components/chat-header';
import { EnvironmentWarningBanner } from '@/components/chat';
import type { InsightCard } from '@/lib/cards-generator';
import { loadMessages, updateThread } from '@/lib/chat-service';
import { getSeasonInfo } from '@/lib/seasonal-context';
import { useChat } from '@/lib/hooks/useChat';
import { useTheme } from 'next-themes';
import { AddToHomeBanner } from '@/components/AddToHomeBanner';
import { getHardcodedQuickActions } from '@/lib/prompt-data';
import { useVoiceConversation } from '@/lib/hooks/use-voice-conversation';
import { ChatMessageList } from '@/components/index/ChatMessageList';
import { ChatInputSection } from '@/components/index/ChatInputSection';
import { ChatModals } from '@/components/index/ChatModals';
import { MobileNavBar } from '@/components/index/MobileNavBar';
import type { FantasyLeague } from '@/components/index/FantasyLeagueSetup';
import type { Message, ServerDataProps } from '@/app/types/chat';

const VoiceConversationOverlay = dynamic(() => import('@/components/voice-conversation-overlay').then(m => ({ default: m.VoiceConversationOverlay })), { ssr: false });

interface UnifiedAIPlatformProps {
  serverData?: ServerDataProps;
}

export default function UnifiedAIPlatform({ serverData }: UnifiedAIPlatformProps) {
  const toast = useToast();
  const { setTheme } = useTheme();
  const { user: authUser, loading: authLoading } = useAuth();
  const prevAuthUserIdRef = useRef<string | null | 'initial'>("initial");

  // ── Store reads ───────────────────────────────────────────────────────────────
  const {
    sidebarOpen, setSidebarOpen,
    selectedCategory, selectCategory,
    selectedSport, setSelectedSport,
    selectedKalshiTopic, setSelectedKalshiTopic,
    setSystemStatus,
    setKalshiBettingBannerVisible,
  } = useAppStore();

  const {
    isLoggedIn, setIsLoggedIn,
    user, setUser,
    customInstructions, setCustomInstructions,
    setSavedPlayersCount, setSavedCardsCount,
    signOut,
  } = useUserStore();

  const { fantasyLeague, setFantasyLeague } = useFantasyStore();

  const {
    setShowStripeLightbox, setShowCommandPalette,
    setShowLoginModal, setShowSignupModal,
    setShowLimitNotification, setShowWatchlistLightbox,
  } = useModalState();

  // ── SSR session seed (synchronous before paint) ───────────────────────────────
  // Prevents a flash of unauthenticated UI when the server has session data
  useLayoutEffect(() => {
    if (serverData?.userSession && !isLoggedIn) {
      setIsLoggedIn(true);
      setUser({
        name: serverData.userSession.user.name,
        email: serverData.userSession.user.email ?? '',
      });
    }
  }, []);

  // ── Welcome message ───────────────────────────────────────────────────────────
  const getWelcomeMessage = (category: string, sport?: string, userName?: string) => {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const name = userName ? `, ${userName}` : '';
    const sportNames: Record<string, string> = {
      nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL',
      'ncaa-football': 'NCAA Football', 'ncaa-basketball': "NCAA Men's Basketball", 'ncaa-basketball-w': "NCAA Women's Basketball",
    };
    const sportLabel = sport ? (sportNames[sport] || sport.toUpperCase()) : null;
    const categoryMessages: Record<string, string> = {
      betting: sportLabel
        ? `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is scanning live **${sportLabel}** odds across all major sportsbooks. Ask me about today's lines, player props, sharp money movement, or arbitrage opportunities.`
        : `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is scanning live odds across all major sportsbooks. Ask me about tonight's lines, player props, sharp money, or arbitrage opportunities.`,
      fantasy: sportLabel
        ? `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is ready for **${sportLabel}** fantasy analysis. Ask about waiver pickups, start/sit decisions, trade values, or draft strategy.`
        : `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is ready for fantasy analysis. Ask about draft strategy, waiver targets, or bestball stacking for NFBC/NFFC.`,
      dfs: sportLabel
        ? `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is optimizing **${sportLabel}** DFS lineups. Ask about optimal builds, ownership leverage, captain picks, or correlation stacks for DraftKings and FanDuel.`
        : `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is optimizing DFS lineups. Ask about optimal builds, ownership leverage, captain picks, or correlation stacks for DraftKings and FanDuel.`,
      kalshi: `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is monitoring Kalshi prediction markets in real-time. Ask about election contracts, weather markets, economic events, or cross-market arbitrage.`,
      all: sportLabel
        ? `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** - Powered by Grok AI\n\nFiltering for **${sportLabel}**. Ask me about betting odds, player props, DFS lineups, or fantasy strategy for ${sportLabel}.`
        : `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** - Powered by Grok AI\n\nI'm connected to live odds feeds, Kalshi prediction markets, and real-time sports data. Ask me about betting odds, player props, DFS lineups, fantasy strategy, or prediction markets.`,
    };
    return categoryMessages[category] || categoryMessages.all;
  };

  const STATIC_WELCOME = `**Leverage AI** - Powered by Grok AI\n\nI'm connected to live odds feeds, Kalshi prediction markets, and real-time sports data. Ask me about betting odds, player props, DFS lineups, fantasy strategy, or prediction markets.`;

  // ── Chat stream ───────────────────────────────────────────────────────────────
  const { messages, setMessages, sendMessage: streamMessage, abort: abortStream } = useChat<Message>({
    api: '/api/analyze',
    appendUserMessage: false,
    prepareBody: (_content, extra) => extra as Record<string, unknown>,
    initialMessages: [{
      id: 'welcome',
      role: 'assistant',
      content: STATIC_WELCOME,
      timestamp: new Date(serverData?.serverTime ?? 0),
      isWelcome: true,
      cards: [],
      insights: { totalValue: 0, winRate: 0, roi: 0, activeContests: 0, totalInvested: 0 },
    } as Message],
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [currentCards, setCurrentCards] = useState<any[]>(serverData?.initialCards || []);
  const [isFetchingCards, setIsFetchingCards] = useState(false);
  const [currentCardsFetchedAt, setCurrentCardsFetchedAt] = useState<number | null>(null);

  const lastCompleteAssistantMessage = useMemo(() => {
    const complete = [...messages]
      .reverse()
      .find(m => m.role === 'assistant' && !m.isStreaming && !m.isPending && !m.isWelcome && m.content?.length > 20);
    return complete?.content;
  }, [messages]);

  const oddsCacheRef = useRef<Map<string, { data: unknown; ts: number }>>(new Map());
  const cardsRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchedForQueryRef = useRef<string | null>(null);
  const analyzingMessageRef = useRef<string | null>(null);
  const generateRealResponseRef = useRef<typeof generateRealResponse | null>(null);

  // ── Credits ───────────────────────────────────────────────────────────────────
  const {
    creditsRemaining, setCreditsRemaining,
    setSupabaseProfileId,
    getCreditData, consumeCredit, addCredits, getRateLimitData, canCreateNewChat, updateRateLimitCount,
  } = useCredits();

  // ── Suggested prompts ─────────────────────────────────────────────────────────
  const initPromptsLoadedRef = useRef(false);
  const { verifyStage, setVerifyStage, cardAnalysisMap, generateDetailedAnalysis } = useCardAnalysis();
  const {
    suggestedPrompts, setSuggestedPrompts,
    isClarificationPills, setIsClarificationPills,
    aiQuickActions, setAiQuickActions,
    lastUserQuery, setLastUserQuery,
    generateContextualSuggestions,
  } = useSuggestedPrompts({ selectedCategory, selectedSport, selectedKalshiTopic, initPromptsLoadedRef });

  // ── File handling ─────────────────────────────────────────────────────────────
  const { uploadedFiles, fileInputRef, processFiles, handleFileUpload, removeAttachment, saveFileToProfile, setUploadedFiles } = useFileHandling();
  const handleSaveFile = useCallback((file: FileAttachment) => {
    saveFileToProfile(file, (msg) => toast.success(msg), (msg) => toast.error(msg));
  }, [saveFileToProfile, toast]);

  // ── Chat list ─────────────────────────────────────────────────────────────────
  const {
    chats, setChats,
    activeChat, setActiveChat,
    isLoadingChats, setIsLoadingChats,
    pendingThreadRef, pendingQueryRef,
    handleStarChat, handleNewChat, openChatWithQuery,
    handleSavedPlayerClick, handleSavedCardClick,
    handleSelectChat, handleDeleteChat,
  } = useChatList({
    serverTime: serverData?.serverTime,
    selectedCategory,
    setSelectedCategory: selectCategory as any,
    selectedSport,
    setSelectedSport: setSelectedSport as any,
    setMessages,
    isLoggedIn,
    canCreateNewChat,
    updateRateLimitCount,
    setShowLimitNotification: setShowLimitNotification as any,
    setShowWatchlistLightbox: setShowWatchlistLightbox as any,
    toast,
  });

  // ── Voice conversation ────────────────────────────────────────────────────────
  const voiceConv = useVoiceConversation({
    onSendMessage: useCallback((text: string) => {
      setInput('');
      setTimeout(() => { generateRealResponseRef.current?.(text); }, 0);
    }, []),
    lastCompleteAssistantMessage,
    isAITyping: isTyping,
  });

  // ── Initialization effects ────────────────────────────────────────────────────

  // Open sidebar by default on desktop (≥ 1024px)
  useEffect(() => {
    if (window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  // Cmd+K / Ctrl+K → command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Service health check
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    fetch('/api/health', { signal: controller.signal })
      .then(r => r.json())
      .then((data: any) => {
        setSystemStatus(data?.status === 'healthy' ? 'ok' : data?.status === 'unhealthy' ? 'down' : 'degraded');
      })
      .catch(() => setSystemStatus('degraded'))
      .finally(() => clearTimeout(timer));
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  // Fix welcome message timestamp after hydration
  useEffect(() => {
    const now = new Date();
    setMessages((prev: any) =>
      prev[0]?.isWelcome ? [{ ...prev[0], timestamp: now }, ...prev.slice(1)] : prev
    );
    setChats((prev: any) =>
      prev[0]?.id === 'chat-1' ? [{ ...prev[0], timestamp: now }, ...prev.slice(1)] : prev
    );
  }, []);

  // Personalize welcome message after user logs in
  useEffect(() => {
    const firstName = user?.name?.split(' ')[0] || undefined;
    setMessages((prev: any) => {
      if (prev[0]?.isWelcome) {
        return [{ ...prev[0], content: getWelcomeMessage('all', undefined, firstName) }, ...prev.slice(1)];
      }
      return prev;
    });
  }, [user?.name]);

  // Re-personalize when category/sport changes (while welcome is visible)
  useEffect(() => {
    const firstName = user?.name?.split(' ')[0] || undefined;
    setMessages((prev: any) => {
      if (prev[0]?.isWelcome) {
        return [{ ...prev[0], content: getWelcomeMessage(selectedCategory, selectedSport || undefined, firstName) }, ...prev.slice(1)];
      }
      return prev;
    });
  }, [selectedCategory, selectedSport]);

  // Restore fantasy league from localStorage after hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem('leverage_fantasy_league');
      if (saved) setFantasyLeague(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Kalshi WebSocket init
  useEffect(() => {
    const cleanup = useKalshiStore.getState().initWS();
    return cleanup;
  }, []);

  // Bookmark count sync
  useEffect(() => {
    try {
      const players = JSON.parse(localStorage.getItem('leverage_watchlist') ?? '[]');
      setSavedPlayersCount(Array.isArray(players) ? players.length : 0);
    } catch { /* ignore */ }
    try {
      const cards = JSON.parse(localStorage.getItem('leverage_saved_cards') ?? '[]');
      setSavedCardsCount(Array.isArray(cards) ? cards.length : 0);
    } catch { /* ignore */ }
    const playersHandler = (e: Event) => setSavedPlayersCount((e as CustomEvent<{ count: number }>).detail.count);
    const cardsHandler = (e: Event) => setSavedCardsCount((e as CustomEvent<{ count: number }>).detail.count);
    window.addEventListener('watchlist-update', playersHandler);
    window.addEventListener('saved-cards-update', cardsHandler);
    return () => {
      window.removeEventListener('watchlist-update', playersHandler);
      window.removeEventListener('saved-cards-update', cardsHandler);
    };
  }, []);

  useEffect(() => {
    if (serverData?.fetchErrors?.length) {
      toast.info('Live data unavailable — showing AI estimates. Data will refresh shortly.');
    }
  }, []);

  // ── Auth helpers ──────────────────────────────────────────────────────────────

  const loadInstructionsFromLocalStorage = () => {
    const stored = localStorage.getItem('leverage_custom_instructions') || '';
    setCustomInstructions(stored);
  };

  const loadProfileId = async (authId: string) => {
    try {
      const supabase = createClient();
      const { data: profile } = await supabase.from('user_profiles').select('id').eq('user_id', authId).single();
      if (profile?.id) setSupabaseProfileId(profile.id);
      const { data: pref } = await supabase.from('user_preferences').select('theme').eq('user_id', authId).single();
      if (pref?.theme) setTheme(pref.theme);
    } catch { /* non-critical */ }
  };

  const loadInitData = async () => {
    try {
      const res = await fetch('/api/init');
      const init = await res.json();

      if (init.insights) {
        setMessages((prev: Message[]) => {
          const next = [...prev];
          if (next[0]?.isWelcome) next[0] = { ...next[0], insights: init.insights };
          return next;
        });
      }
      if (init.credits?.credits != null) {
        const bal: number = init.credits.credits;
        setCreditsRemaining(bal);
        const creditData = getCreditData();
        localStorage.setItem('userCredits', JSON.stringify({ ...creditData, credits: bal }));
      }
      if (typeof init.instructions === 'string' && init.instructions) {
        setCustomInstructions(init.instructions);
        localStorage.setItem('leverage_custom_instructions', init.instructions);
      }
      if (Array.isArray(init.defaultPrompts) && init.defaultPrompts.length > 0) {
        const cat = useAppStore.getState().selectedCategory;
        setAiQuickActions(
          init.defaultPrompts.map((p: { label: string; query: string }) => ({
            label: p.label, icon: Sparkles, category: cat, query: p.query,
          }))
        );
        initPromptsLoadedRef.current = true;
      }
      if (Array.isArray(init.chats) && init.chats.length > 0) {
        const threads = init.chats.map((t: any) => ({
          id: t.id,
          title: t.title,
          preview: t.preview ?? '',
          timestamp: new Date(t.updated_at ?? t.created_at),
          starred: t.starred ?? false,
          category: t.category ?? 'all',
          tags: t.tags ?? [],
        }));
        setIsLoadingChats(false);
        setChats(threads);
        setActiveChat(threads[0].id);
        const firstThread = threads[0];
        if (firstThread.category && firstThread.category !== 'all') selectCategory(firstThread.category);
        const SPORT_KEYS_LIST = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb', 'soccer_epl', 'soccer_mls'];
        const sportTag = firstThread.tags?.find((t: string) => SPORT_KEYS_LIST.includes(t));
        if (sportTag) setSelectedSport(sportTag);
        loadMessages(firstThread.id).then(msgs => {
          if (msgs.length > 0) {
            let storedCards: Record<string, any[]> = {};
            try { storedCards = JSON.parse(localStorage.getItem(`lev:cards:${firstThread.id}`) ?? '{}'); } catch { /* ignore */ }
            setMessages(msgs.map((m: any) => ({
              id: m.id, role: m.role, content: m.content, timestamp: m.timestamp,
              cards: m.cards?.length ? m.cards : (storedCards[m.id ?? ''] ?? []),
              modelUsed: m.modelUsed, confidence: m.confidence, isWelcome: m.isWelcome,
            })) as any);
          }
        });
      }
    } catch {
      loadInstructionsFromLocalStorage();
    }
  };

  const loadFantasyLeagueFromDB = async () => {
    try {
      const res = await fetch('/api/fantasy/leagues');
      const data = await res.json();
      if (data.success && Array.isArray(data.leagues) && data.leagues.length > 0) {
        const dbLeague = data.leagues[0];
        const userTeam = (dbLeague.fantasy_teams ?? []).find((t: any) => t.is_user_team);
        const restored: FantasyLeague = {
          sport: dbLeague.sport,
          platform: dbLeague.platform,
          teams: dbLeague.league_size,
          leagueType: dbLeague.scoring_type,
          teamName: userTeam?.team_name || dbLeague.name,
          leagueName: dbLeague.name,
          setupComplete: true,
          scoring: dbLeague.scoring_type === 'ppr' ? 'PPR'
                 : dbLeague.scoring_type === 'half_ppr' ? 'Half-PPR' : 'Standard',
        };
        setFantasyLeague(restored);
        localStorage.setItem('leverage_fantasy_league', JSON.stringify(restored));
      }
    } catch { /* non-critical */ }
  };

  // ── Auth sync effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;

    const currentUserId = authUser?.id ?? null;
    const prevUserId = prevAuthUserIdRef.current === "initial"
      ? undefined
      : prevAuthUserIdRef.current;
    prevAuthUserIdRef.current = currentUserId;

    if (authUser) {
      setIsLoggedIn(true);
      setUser({
        name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
        email: authUser.email || '',
        avatar: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || undefined,
      });
      setShowLoginModal(false);
      setShowSignupModal(false);
      loadProfileId(authUser.id);

      if (prevUserId !== currentUserId) {
        loadFantasyLeagueFromDB();
        setIsLoadingChats(true);
        loadInitData();
      }
    } else {
      signOut();
      setSupabaseProfileId(null);
      setFantasyLeague(null);
      localStorage.removeItem('leverage_fantasy_league');
      const stored = localStorage.getItem('leverage_custom_instructions') || '';
      setCustomInstructions(stored);
      if (prevUserId !== null && prevUserId !== undefined) {
        loadInstructionsFromLocalStorage();
      }
      if (prevUserId === undefined) {
        loadInitData();
      }
    }
  }, [authUser, authLoading]);

  // ── Stripe checkout effect ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) return;
    window.history.replaceState({}, '', window.location.pathname);
    (async () => {
      const isDev = getIsDev();
      try {
        const res = await fetch(`/api/stripe/verify?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (data.verified && data.credits > 0) {
          addCredits(data.credits);
        } else if (!data.verified) {
          const creditsPurchased = params.get('credits');
          const amount = creditsPurchased ? parseInt(creditsPurchased, 10) : 0;
          if (amount > 0) addCredits(amount);
        }
      } catch {
        const creditsPurchased = params.get('credits');
        const amount = creditsPurchased ? parseInt(creditsPurchased, 10) : 0;
        if (amount > 0) addCredits(amount);
      }
    })();
  }, []);

  // ── fillMissingCards effect ───────────────────────────────────────────────────
  useEffect(() => {
    if (cardsRefreshIntervalRef.current) clearTimeout(cardsRefreshIntervalRef.current);

    const fillMissingCards = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (!lastUserQuery) return;

      const fetchKey = `${lastUserQuery}::${selectedCategory}`;
      if (fetchedForQueryRef.current === fetchKey) return;
      fetchedForQueryRef.current = fetchKey;

      const msgLow = (lastUserQuery || '').toLowerCase();
      const hasPropQuery = msgLow.includes('prop') || msgLow.includes('strikeout')
                        || msgLow.includes('hits over') || msgLow.includes('home run over')
                        || msgLow.includes('player bet') || msgLow.includes(' stats')
                        || msgLow.includes('era') || msgLow.includes('batting average')
                        || msgLow.includes('whip') || msgLow.includes('babip');

      try {
        setIsFetchingCards(true);
        const hasFantasyOrDFSQuery = /\b(adp|draft|waiver|sleeper|fantasy|dfs|best ball|lineup|vbd|tier|rank)\b/i.test(lastUserQuery || '');
        const hasDFSQuery = /\b(dfs|daily fantasy|showdown|gpp|gpps|tournament lineup)\b/i.test(lastUserQuery || '');
        const hasBettingPlatformQuery =
          /\b(draftkings|fanduel|betmgm|caesars|pointsbet|barstool)\b/i.test(lastUserQuery || '') &&
          !/\b(lineup|slate|dfs|daily fantasy|gpp|showdown)\b/i.test(lastUserQuery || '');
        const detectedCategory = hasPropQuery ? 'all'
          : (msgLow.includes('kalshi') || msgLow.includes('prediction market') || msgLow.includes('championship winner') || msgLow.includes('contract pricing') || msgLow.includes('winner contract')) ? 'kalshi'
          : hasBettingPlatformQuery ? 'betting'
          : hasFantasyOrDFSQuery && selectedCategory !== 'betting' && selectedCategory !== 'props'
          ? (hasDFSQuery ? 'dfs' : 'fantasy')
          : selectedCategory === 'fantasy' && !hasFantasyOrDFSQuery ? 'betting'
          : selectedCategory === 'dfs' && !hasDFSQuery && !hasFantasyOrDFSQuery ? 'betting'
          : selectedCategory;

        const conversationHistory = messages.slice(-10).map((m: any) => ({ role: m.role, content: m.content || '' }));
        const refreshSport = detectedCategory === 'kalshi' ? undefined : (extractSport(lastUserQuery, conversationHistory) || selectedSport || undefined);
        const freshCards = await fetchDynamicCards({ sport: refreshSport, userContext: lastUserQuery, category: detectedCategory, topic: detectedCategory === 'kalshi' ? selectedKalshiTopic || undefined : undefined, limit: 7 });
        if (freshCards.length === 0) {
          // Reset the guard so the next query can retry rather than being permanently blocked
          fetchedForQueryRef.current = null;
          return;
        }

        // Update the right-panel cards (always fresh for the current query)
        setCurrentCards(freshCards);
        setCurrentCardsFetchedAt(Date.now());

        // Attach cards to the most recent assistant message that lacks them
        setMessages((prev: any) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'assistant' && !updated[i].cards?.length) {
              updated[i] = { ...updated[i], cards: freshCards };
              break;
            }
          }
          return updated;
        });
      } catch { /* non-critical */ }
      finally { setIsFetchingCards(false); }
    };

    cardsRefreshIntervalRef.current = setTimeout(fillMissingCards, 3000) as unknown as NodeJS.Timeout;
    return () => { if (cardsRefreshIntervalRef.current) clearTimeout(cardsRefreshIntervalRef.current); };
  }, [lastUserQuery]);

  // ── Player click event listener ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { query, category } = (e as CustomEvent<{ query: string; category?: string }>).detail;
      const currentCategory = useAppStore.getState().selectedCategory;
      if (category && category !== currentCategory) selectCategory(category as AppCategory);
      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: query, timestamp: new Date() };
      setMessages((prev: Message[]) => [...prev, userMsg]);
      setInput('');
      generateRealResponseRef.current?.(query);
    };
    window.addEventListener('leveragePlayerClick', handler);
    return () => window.removeEventListener('leveragePlayerClick', handler);
  }, []);

  // ── Manual card refresh ───────────────────────────────────────────────────────
  const handleRefreshCards = useCallback(async () => {
    if (!lastUserQuery || isFetchingCards) return;
    fetchedForQueryRef.current = null; // force re-fetch on next fill
    const msgLow = lastUserQuery.toLowerCase();
    const hasPropQuery = msgLow.includes('prop') || msgLow.includes('strikeout');
    const hasFantasyOrDFSQuery = /\b(adp|draft|waiver|sleeper|fantasy|dfs|best ball|lineup|vbd|tier|rank)\b/i.test(lastUserQuery);
    const hasDFSQuery = /\b(dfs|daily fantasy|showdown|gpp|gpps|tournament lineup)\b/i.test(lastUserQuery);
    const hasBettingPlatformQuery = /\b(draftkings|fanduel|betmgm|caesars|pointsbet|barstool)\b/i.test(lastUserQuery) && !/\b(lineup|slate|dfs|daily fantasy|gpp|showdown)\b/i.test(lastUserQuery);
    const detectedCategory = hasPropQuery ? 'props'
      : (msgLow.includes('kalshi') || msgLow.includes('prediction market')) ? 'kalshi'
      : hasBettingPlatformQuery ? 'betting'
      : hasFantasyOrDFSQuery ? (hasDFSQuery ? 'dfs' : 'fantasy')
      : selectedCategory;
    const conversationHistory = messages.slice(-10).map((m: any) => ({ role: m.role, content: m.content || '' }));
    const refreshSport = detectedCategory === 'kalshi' ? undefined : (extractSport(lastUserQuery, conversationHistory) || selectedSport || undefined);
    try {
      setIsFetchingCards(true);
      const freshCards = await fetchDynamicCards({ sport: refreshSport, userContext: lastUserQuery, category: detectedCategory, topic: detectedCategory === 'kalshi' ? selectedKalshiTopic || undefined : undefined, limit: 7 });
      if (freshCards.length > 0) {
        setCurrentCards(freshCards);
        setCurrentCardsFetchedAt(Date.now());
      }
    } catch { /* non-critical */ }
    finally { setIsFetchingCards(false); }
  }, [lastUserQuery, isFetchingCards, selectedCategory, selectedSport, messages]);

  // ── Live card refresh via Supabase realtime ───────────────────────────────────
  useCardRefresh({ onRefresh: handleRefreshCards, enabled: !!lastUserQuery });

  // ── Response generation ───────────────────────────────────────────────────────
  const generateResponseStable = useCallback((msg: string) => {
    generateRealResponseRef.current?.(msg);
  }, []);

  const {
    editingMessageIndex, setEditingMessageIndex,
    editingContent, setEditingContent,
    editingChatId, editingChatTitle, setEditingChatTitle,
    editTextareaRef,
    handleEditMessage, handleSaveEdit, handleCancelEdit,
    handleCopyMessage, handleRegenerateResponse, handleVote,
    handleEditChatTitle, handleSaveChatTitle, handleKeyDownChatTitle,
    adjustEditTextareaHeight,
  } = useMessageEditor({
    messages, setMessages, activeChat, isLoggedIn,
    generateResponse: generateResponseStable, toast, setChats,
  });

  const generateRealResponse = useGenerateResponse({
    messages, setMessages, streamMessage, abortStream,
    setIsTyping, selectedCategory, selectedSport, setKalshiBettingBannerVisible,
    customInstructions, deepThink: useAppStore.getState().deepThink, fantasyLeague, setVerifyStage,
    setSuggestedPrompts, setIsClarificationPills, generateContextualSuggestions, setLastUserQuery,
    activeChat, setActiveChat, setChats, pendingThreadRef, isLoggedIn,
    oddsCacheRef, analyzingMessageRef, toast,
  });

  generateRealResponseRef.current = generateRealResponse;

  // ── Auto-query for pending queries ────────────────────────────────────────────
  useEffect(() => {
    const q = pendingQueryRef.current;
    if (q !== null && messages.length === 1 && (messages[0] as any)?.isWelcome) {
      pendingQueryRef.current = null;
      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: q, timestamp: new Date() };
      setMessages((prev: Message[]) => [...prev, userMsg]);
      setInput('');
      generateRealResponseRef.current?.(q);
    }
  }, [messages]);

  // ── Action handlers ───────────────────────────────────────────────────────────

  const handleOpenStripe = useCallback(() => setShowStripeLightbox(true), []);

  const stopGeneration = useCallback(() => {
    abortStream();
    setIsTyping(false);
  }, [abortStream]);

  const handleFollowUp = (action: 'correlated' | 'metrics', cardData?: any) => {
    if (!consumeCredit()) { setShowStripeLightbox(true); return; }
    const cardTitle = cardData?.title ?? '';
    const query = action === 'correlated'
      ? `Show me correlated betting opportunities related to: ${cardTitle}. Include cross-market plays with positive expected value.`
      : `Provide a deep metric analysis for: ${cardTitle}. Include key performance indicators, historical accuracy, and statistical significance.`;
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: query, timestamp: new Date() };
    setMessages((prev: Message[]) => [...prev, userMsg]);
    setInput('');
    generateRealResponse(query);
  };

  const handleLogout = useCallback(() => {
    signOut();
    setFantasyLeague(null);
    localStorage.removeItem('leverage_fantasy_league');
  }, [signOut, setFantasyLeague]);

  const handleAttachFile = useCallback((file: FileAttachment) => {
    setUploadedFiles((prev: any) => [...prev, { ...file, url: '' }]);
  }, [setUploadedFiles]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && uploadedFiles.length === 0) return;

    // Ensure we have an active chat (avoid null race on first submit)
    if (!activeChat) {
      handleNewChat();
      return;
    }

    if (isTyping) { abortStream(); }

    if (!consumeCredit()) { setShowStripeLightbox(true); return; }

    if (input.trim()) {
      const lineCount = input.split('\n').filter(Boolean).length;
      const tabCount  = (input.match(/\t/g) ?? []).length;
      if (lineCount > 20 && tabCount > lineCount) {
        toast.error('📊 That looks like raw ADP/spreadsheet data. Use the ADP Upload button (📎) to import it — the AI will have full access to all rows for draft analysis.');
        return;
      }
    }

    const currentFiles = [...uploadedFiles];
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input || '📎 Attached files',
      timestamp: new Date(),
      attachments: currentFiles.length > 0 ? currentFiles : undefined,
    };
    const optimisticId = crypto.randomUUID();
    setMessages((prev: Message[]) => [
      ...prev,
      userMessage,
      { id: optimisticId, role: 'assistant' as const, content: '', timestamp: new Date(), isPending: true, cards: [] } as Message,
    ]);
    setUploadedFiles([]);

    setChats((prevChats: Chat[]) => prevChats.map((chat: Chat) => {
      if (chat.id !== activeChat) return chat;
      const updatedChat = { ...chat };
      updatedChat.preview = input.slice(0, 50) + (input.length > 50 ? '...' : '');
      updatedChat.timestamp = new Date();
      if (chat.title === 'New Analysis' && input.length > 0) {
        const words = input.split(' ').slice(0, 5).join(' ');
        updatedChat.title = words + (input.split(' ').length > 5 ? '...' : '');
      }
      const contentLower = input.toLowerCase();
      const newTags = [...chat.tags];
      if (contentLower.includes('nba') || contentLower.includes('basketball')) newTags.push('nba');
      if (contentLower.includes('nfl') || contentLower.includes('football')) newTags.push('nfl');
      if (contentLower.includes('mlb') || contentLower.includes('baseball')) newTags.push('mlb');
      if (contentLower.includes('dfs') || contentLower.includes('lineup')) newTags.push('optimizer');
      if (contentLower.includes('draft') || contentLower.includes('adp')) newTags.push('draft');
      if (contentLower.includes('bet') || contentLower.includes('odds')) newTags.push('live');
      updatedChat.tags = [...new Set(newTags)].slice(0, 3);
      if (isLoggedIn) updateThread(chat.id, { title: updatedChat.title, preview: updatedChat.preview, tags: updatedChat.tags });
      return updatedChat;
    }));

    let promptForAI = input;
    if (currentFiles.length > 0) {
      const fileSections: string[] = [];
      for (const f of currentFiles) {
        if (f.data?.headers && f.data?.rows) {
          const AI_ROW_LIMIT = 100;
          const headers = f.data.headers.join('\t');
          const rows = f.data.rows.slice(0, AI_ROW_LIMIT).map((r: string[]) => r.join('\t')).join('\n');
          const truncated = f.data.rows.length > AI_ROW_LIMIT ? `\n[... ${f.data.rows.length - AI_ROW_LIMIT} more rows — full dataset uploaded to ADP database]` : '';
          fileSections.push(`[File: ${f.name} (${f.data.rows.length} rows)]\n${headers}\n${rows}${truncated}`);
        } else if (f.textContent) {
          fileSections.push(`[File: ${f.name}]\n${f.textContent}`);
        }
      }
      if (fileSections.length > 0) {
        promptForAI = (input ? input + '\n\n' : 'Analyze this data:\n\n') + fileSections.join('\n\n');
      } else if (!input) {
        promptForAI = `I've attached ${currentFiles.map(f => f.name).join(', ')}. Please analyze.`;
      }
    }

    setInput('');
    // Clear stale cards so the right panel shows loading state for this new query,
    // and force the fillMissingCards effect to re-fetch even if the query text matches.
    setCurrentCards([]);
    fetchedForQueryRef.current = null;
    const visionAttachments = currentFiles
      .filter(f => f.type === 'image' && f.imageBase64)
      .map(f => ({ name: f.name, base64: f.imageBase64!, mimeType: f.mimeType ?? 'image/jpeg' }));
    generateRealResponse(promptForAI, visionAttachments.length > 0 ? visionAttachments : undefined, optimisticId);
  };

  // ── Computed values ───────────────────────────────────────────────────────────

  const categories = [
    { id: 'all',     name: 'All',           icon: Layers,    color: 'text-blue-400',   desc: 'Everything' },
    { id: 'betting', name: 'Sports Betting', icon: TrendingUp, color: 'text-orange-400', desc: 'Live Odds & Props' },
    { id: 'fantasy', name: 'Fantasy',        icon: Trophy,    color: 'text-violet-400', desc: 'Season-long & Best Ball' },
    { id: 'dfs',     name: 'DFS Optimizer',  icon: Award,     color: 'text-purple-400', desc: 'DK/FD Lineups' },
    { id: 'kalshi',  name: 'Kalshi Markets', icon: BarChart3,  color: 'text-cyan-400',   desc: 'Prediction Markets' },
  ];

  const sports = useMemo(() => {
    const raw = [
      { id: 'mlb',               name: 'MLB',                         apiKey: 'baseball_mlb' },
      { id: 'nba',               name: 'NBA',                         apiKey: 'basketball_nba' },
      { id: 'nhl',               name: 'NHL',                         apiKey: 'icehockey_nhl' },
      { id: 'nfl',               name: 'NFL',                         apiKey: 'americanfootball_nfl' },
      { id: 'ncaa-basketball',   name: "NCAA Men's Basketball",       apiKey: 'basketball_ncaab' },
      { id: 'ncaa-basketball-w', name: "NCAA Women's Basketball",     apiKey: 'basketball_wncaab' },
      { id: 'ncaa-football',     name: 'NCAA Football',               apiKey: 'americanfootball_ncaaf' },
    ].map(s => ({ ...s, isInSeason: getSeasonInfo(s.apiKey).isInSeason }));
    return [...raw.filter(s => s.isInSeason), ...raw.filter(s => !s.isInSeason)];
  }, []);

  const filteredChats = chats
    .filter((chat: Chat) => selectedCategory === 'all' || chat.category === selectedCategory)
    .filter((chat: Chat) => {
      if (!selectedSport) return true;
      return chat.tags.some((tag: string) => tag.toLowerCase() === selectedSport.toLowerCase());
    })
    .filter((chat: Chat) => {
      if (!chatSearch.trim()) return true;
      const q = chatSearch.toLowerCase();
      return chat.title.toLowerCase().includes(q) || (chat.preview || '').toLowerCase().includes(q);
    });

  const hardcodedQuickActions = getHardcodedQuickActions(selectedCategory, selectedSport, selectedKalshiTopic);
  const quickActions = aiQuickActions ?? hardcodedQuickActions;

  const activeChatObj = chats.find((c: Chat) => c.id === activeChat) ?? null;

  // ── JSX ───────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--bg-surface)]">
      <EnvironmentWarningBanner missingKeys={serverData?.missingKeys ?? []} />

      {/* Mobile/tablet backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar wrapper: fixed drawer on mobile/tablet, in-flow on desktop */}
      <div className={cn(
        'shrink-0',
        'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50',
        'max-lg:transition-transform max-lg:duration-300 max-lg:ease-out',
        sidebarOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
      )}>
        <Sidebar
          onNewChat={handleNewChat}
          chatSearch={chatSearch}
          setChatSearch={setChatSearch}
          activeChat={activeChat}
          onSelectChat={handleSelectChat}
          filteredChats={filteredChats}
          editingChatId={editingChatId}
          editingChatTitle={editingChatTitle}
          setEditingChatTitle={setEditingChatTitle}
          onEditChatTitle={handleEditChatTitle}
          onSaveChatTitle={handleSaveChatTitle}
          onKeyDownChatTitle={handleKeyDownChatTitle}
          onStarChat={handleStarChat}
          onDeleteChat={handleDeleteChat}
          categories={categories}
          sports={sports}
          setSuggestedPrompts={setSuggestedPrompts}
          setLastUserQuery={setLastUserQuery}
          isLoadingChats={isLoadingChats}
          onNavigate={(query, category, sport) => { openChatWithQuery(query, category, sport); setSidebarOpen(false); }}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[var(--background)] dark:bg-gradient-to-br dark:from-black dark:via-background dark:to-black">
        <AddToHomeBanner />

        <ChatHeader
          activeChat={activeChatObj as any}
          messages={messages as any}
        />

        {/* Two-column body: messages + live cards panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <ChatMessageList
            messages={messages}
            isTyping={isTyping}
            verifyStage={verifyStage}
            editingMessageIndex={editingMessageIndex}
            editingContent={editingContent}
            editTextareaRef={editTextareaRef}
            onEditContentChange={setEditingContent}
            adjustEditTextareaHeight={adjustEditTextareaHeight}
            onKeyDown={handleKeyDown}
            onGenerateResponse={(q) => generateRealResponse(q)}
            onFollowUp={handleFollowUp}
            onEditMessage={handleEditMessage}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            onCopyMessage={handleCopyMessage}
            onRegenerateResponse={handleRegenerateResponse}
            onVote={handleVote}
          />


        </div>

        <ChatInputSection
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          isTyping={isTyping}
          onStopGeneration={stopGeneration}
          uploadedFiles={uploadedFiles}
          onFileUpload={handleFileUpload}
          onRemoveFile={removeAttachment}
          onSaveFile={handleSaveFile}
          onFileDrop={processFiles}
          onFilesAdded={(files: any) => setUploadedFiles((prev: any) => [...prev, ...files])}
          creditsRemaining={creditsRemaining}
          onOpenStripe={handleOpenStripe}
          lastUserQuery={lastUserQuery}
          getRateLimitData={getRateLimitData}
          messages={messages}
          suggestedPrompts={suggestedPrompts}
          quickActions={quickActions}
          isClarificationPills={isClarificationPills}
          onPromptClick={(submitText) => {
            const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: submitText, timestamp: new Date() };
            setMessages((prev: Message[]) => [...prev, userMessage]);
            setChats((prevChats: Chat[]) => prevChats.map((chat: Chat) => {
              if (chat.id !== activeChat) return chat;
              const updatedChat = { ...chat };
              updatedChat.preview = submitText.slice(0, 50) + (submitText.length > 50 ? '...' : '');
              updatedChat.timestamp = new Date();
              if (chat.title === 'New Analysis') {
                const words = submitText.split(' ').slice(0, 5).join(' ');
                updatedChat.title = words + (submitText.split(' ').length > 5 ? '...' : '');
              }
              return updatedChat;
            }));
            generateRealResponse(submitText);
          }}
          onWelcomeAction={(query) => {
            const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: query, timestamp: new Date() };
            setMessages((prev: Message[]) => [...prev, userMessage]);
            setInput('');
            generateRealResponse(query);
          }}
          setChats={setChats}
          activeChat={activeChat}
          voiceConvState={voiceConv.convState as any}
          voiceConvSupported={voiceConv.isSupported}
          onActivateVoice={voiceConv.activate}
          lastAssistantMessage={[...messages].reverse().find((m: any) => m.role === 'assistant')?.content as string | undefined}
        />

        <MobileNavBar />
      </div>

      <ChatModals
        creditsRemaining={creditsRemaining}
        addCredits={addCredits}
        chats={chats}
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onLogout={handleLogout}
        onAttachFile={handleAttachFile}
        onOpenStripe={handleOpenStripe}
        onPlayerClick={handleSavedPlayerClick}
        onCardClick={handleSavedCardClick}
        voiceIsActive={voiceConv.isActive}
        voiceOverlay={voiceConv.isActive ? (
          <VoiceConversationOverlay
            state={voiceConv.convState}
            liveTranscript={voiceConv.liveTranscript}
            speakingPreview={voiceConv.speakingPreview}
            isPushToTalk={voiceConv.isPushToTalk}
            onSetPushToTalk={voiceConv.setIsPushToTalk}
            lang={voiceConv.lang}
            onSetLang={voiceConv.setLang}
            onStartListening={voiceConv.startListening}
            onStopListening={voiceConv.stopListening}
            onClose={voiceConv.deactivate}
          />
        ) : null}
      />
    </div>
  );
}
