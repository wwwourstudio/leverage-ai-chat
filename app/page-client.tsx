/**
 * Main Chat Interface - v2 (analysis overlay fixed)
 * 
 * Production-ready AI sports betting assistant with real-time data integration.
 * Features:
 * - Real-time player projections from The Odds API
 * - Trust metrics and confidence scoring
 * - Context-aware suggestions
 * - File attachments (images, CSV)
 * - Chat history with edit/regenerate
 * - Mobile-optimized UI
 * 
 * @module app/page
 */

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import dynamic from 'next/dynamic';
import { fetchDynamicCards } from '@/lib/data-service';
import { FREE_TIER, GROK_VOICE_STORAGE_KEY, GROK_VOICE_DEFAULT } from '@/lib/constants';
import { isDev as getIsDev } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';
import { extractSportFromText, extractSport } from '@/lib/sport-detection';
import { useModalState } from '@/lib/hooks/useModalState';
import { useCredits } from '@/lib/hooks/useCredits';
import { useMessageEditor } from '@/lib/hooks/useMessageEditor';
import { useChatList, type Chat } from '@/lib/hooks/useChatList';
import { useCardAnalysis } from '@/lib/hooks/useCardAnalysis';
import { useSuggestedPrompts } from '@/lib/hooks/useSuggestedPrompts';
import { useFileHandling, type FileAttachment } from '@/lib/hooks/useFileHandling';
import { useKalshiStore } from '@/lib/store/kalshi-store';
import { useGenerateResponse } from '@/lib/hooks/useGenerateResponse';
import { TrendingUp, Trophy, Award, Layers, BarChart3, Sparkles } from 'lucide-react';
import { useToast } from '@/components/toast-provider';
import { Sidebar } from '@/components/Sidebar';
import { ChatHeader, EnvironmentWarningBanner } from '@/components/chat';
import type { InsightCard } from '@/lib/cards-generator';
import { loadMessages, updateThread } from '@/lib/chat-service';
import { getSeasonInfo } from '@/lib/seasonal-context';
import { useChat } from '@/lib/hooks/useChat';
import { useTheme } from 'next-themes';
import { AddToHomeBanner } from '@/components/AddToHomeBanner';
import { getHardcodedQuickActions, type PromptItem } from '@/lib/prompt-data';
import { useVoiceConversation } from '@/lib/hooks/use-voice-conversation';
import { ChatMessageList } from '@/components/index/ChatMessageList';
import { ChatInputSection } from '@/components/index/ChatInputSection';
import { ChatModals } from '@/components/index/ChatModals';
import { FantasyLeagueSetup, type FantasyLeague as FantasyLeagueType } from '@/components/index/FantasyLeagueSetup';
import type { Message, ServerDataProps, TrustMetrics } from '@/app/types/chat';
const VoiceConversationOverlay = dynamic(() => import('@/components/voice-conversation-overlay').then(m => ({ default: m.VoiceConversationOverlay })), { ssr: false });

interface UnifiedAIPlatformProps {
  serverData?: ServerDataProps;
}

type FantasyLeague = FantasyLeagueType;

export default function UnifiedAIPlatform({ serverData }: UnifiedAIPlatformProps) {
  const toast = useToast();
  const { setTheme } = useTheme();
  const { user: authUser, loading: authLoading } = useAuth();
  const prevAuthUserIdRef = useRef<string | null>(undefined as unknown as string | null);

  // Dynamic welcome message based on time, category, and selected sport
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
      kalshi: sportLabel
        ? `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is monitoring **${sportLabel}** prediction markets on Kalshi. Ask about contract pricing, market inefficiencies, or best-value plays in this category.`
        : `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is monitoring Kalshi prediction markets in real-time. Ask about election contracts, weather markets, economic events, or cross-market arbitrage.`,
      all: sportLabel
        ? `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** - Powered by Grok AI\n\nFiltering for **${sportLabel}**. Ask me about betting odds, player props, DFS lineups, or fantasy strategy for ${sportLabel}.`
        : `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** - Powered by Grok AI\n\nI'm connected to live odds feeds, Kalshi prediction markets, and real-time sports data. Ask me about betting odds, player props, DFS lineups, fantasy strategy, or prediction markets.`,
    };

    return categoryMessages[category] || categoryMessages.all;
  };

  // Static welcome used for initial SSR render to avoid timezone-based hydration mismatch.
  // getWelcomeMessage() calls getHours()/toLocaleDateString() which differ between the
  // UTC server and the user's local-timezone browser, causing React error #418.
  const STATIC_WELCOME = `**Leverage AI** - Powered by Grok AI\n\nI'm connected to live odds feeds, Kalshi prediction markets, and real-time sports data. Ask me about betting odds, player props, DFS lineups, fantasy strategy, or prediction markets.`;

  // Cards are fetched on page load via /api/cards and shown on the welcome screen.
  // They are also regenerated on each AI response via /api/analyze.

  const {
    messages,
    setMessages,
    sendMessage: streamMessage,
    abort: abortStream,
  } = useChat<Message>({
    api: '/api/analyze',
    appendUserMessage: false, // page-client.tsx appends user messages itself
    prepareBody: (_content, extra) => extra as Record<string, unknown>,
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: STATIC_WELCOME,
        // Fixed epoch fallback keeps SSR and client hydration identical (no #418 mismatch).
        // The useEffect below corrects this to the real current time after hydration.
        timestamp: new Date(serverData?.serverTime ?? 0),
        isWelcome: true,
        cards: [],
        insights: {
          totalValue: 0,
          winRate: 0,
          roi: 0,
          activeContests: 0,
          totalInvested: 0,
        },
      } as Message,
    ],
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Last complete (non-streaming, non-pending) assistant message — fed to voice conversation
  const lastCompleteAssistantMessage = useMemo(() => {
    const complete = [...messages]
      .reverse()
      .find(m => m.role === 'assistant' && !m.isStreaming && !m.isPending && !m.isWelcome && m.content?.length > 20);
    return complete?.content;
  }, [messages]);

  // Voice conversation — full duplex voice chat using browser Web Speech APIs
  const voiceConv = useVoiceConversation({
    onSendMessage: useCallback((text: string) => {
      // Fire the same path as pressing Enter in the chat box
      // We need to set input and then trigger generateRealResponse directly
      setInput('');
      // Defer to next tick so generateRealResponse ref is settled
      setTimeout(() => {
        if (generateRealResponseRef.current) {
          generateRealResponseRef.current(text);
        }
      }, 0);
    }, []),
    lastCompleteAssistantMessage,
    isAITyping: isTyping,
  });

  // Client-side odds cache: key = sportKey, TTL = 5 minutes
  const oddsCacheRef = useRef<Map<string, { data: unknown; ts: number }>>(new Map());

  const [sidebarOpen, setSidebarOpen] = useState(false); // corrected to desktop-open by useEffect below
  const [chatSearch, setChatSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  // Editing state + handlers are provided by useMessageEditor (wired below after chats state)

  const {
    showLoginModal, setShowLoginModal,
    showSignupModal, setShowSignupModal,
    showUserLightbox, setShowUserLightbox,
    showSettingsLightbox, setShowSettingsLightbox,
    showAlertsLightbox, setShowAlertsLightbox,
    showWatchlistLightbox, setShowWatchlistLightbox,
    showStripeLightbox, setShowStripeLightbox,
    showPurchaseModal, setShowPurchaseModal,
    showSubscriptionModal, setShowSubscriptionModal,
    showCommandPalette, setShowCommandPalette,
    showLimitNotification, setShowLimitNotification,
  } = useModalState();

  const {
    creditsRemaining, setCreditsRemaining,
    supabaseProfileId, setSupabaseProfileId,
    getCreditData,
    consumeCredit, addCredits,
    getRateLimitData, canCreateNewChat, updateRateLimitCount,
  } = useCredits();

  const [systemStatus, setSystemStatus] = useState<'ok' | 'degraded' | 'down'>('ok');

  const [alertCount, setAlertCount] = useState(0);
  const [savedPlayersCount, setSavedPlayersCount] = useState(0);
  const [savedCardsCount, setSavedCardsCount] = useState(0);
  // Sync bookmark badge counts from localStorage on mount + on updates from card toggles
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
  const [customInstructions, setCustomInstructions] = useState('');
  const [deepThink, setDeepThink] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(!!serverData?.userSession);
  const [user, setUser] = useState<{ name: string; email: string; avatar?: string } | null>(
    serverData?.userSession ? {
      name: serverData.userSession.user.name,
      email: serverData.userSession.user.email ?? '',
    } : null
  );
  // uploadedFiles state is managed by useFileHandling hook
  const [selectedSport, setSelectedSport] = useState<string>('');
  const [selectedKalshiTopic, setSelectedKalshiTopic] = useState<string>('');
  const [kalshiBettingBannerVisible, setKalshiBettingBannerVisible] = useState(false);
  const cardsRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchedForQueryRef = useRef<string | null>(null);
  // Dedup guard — prevents double-fire when onPromptClick and handleSubmit both
  // call generateRealResponse for the same message within the same tick.
  const analyzingMessageRef = useRef<string | null>(null);

  const {
    chats, setChats,
    activeChat, setActiveChat,
    isLoadingChats, setIsLoadingChats,
    pendingThreadRef,
    pendingQueryRef,
    handleStarChat,
    handleNewChat,
    openChatWithQuery,
    handleSavedPlayerClick,
    handleSavedCardClick,
    handleSelectChat,
    handleDeleteChat,
  } = useChatList({
    serverTime: serverData?.serverTime,
    selectedCategory,
    setSelectedCategory,
    selectedSport,
    setSelectedSport,
    setMessages,
    isLoggedIn,
    canCreateNewChat,
    updateRateLimitCount,
    setShowLimitNotification,
    setShowWatchlistLightbox,
    toast,
  });

  const handleCategorySelect = useCallback((catId: string) => {
    setSelectedCategory(catId);
    if (catId !== 'kalshi') setKalshiBettingBannerVisible(false);
  }, []);

  const handleToggleSidebar = useCallback(() => setSidebarOpen(v => !v), []);
  const handleOpenUserLightbox = useCallback(() => setShowUserLightbox(true), []);
  const handleOpenAlerts = useCallback(() => setShowAlertsLightbox(true), []);
  const handleOpenSettings = useCallback(() => setShowSettingsLightbox(true), []);
  const handleOpenWatchlist = useCallback(() => setShowWatchlistLightbox(true), []);
  const handleOpenLogin = useCallback(() => setShowLoginModal(true), []);
  const handleOpenSignup = useCallback(() => setShowSignupModal(true), []);
  const handleOpenStripe = useCallback(() => setShowStripeLightbox(true), []);
  const handleToggleDeepThink = useCallback(() => setDeepThink(v => !v), []);
  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);
  const handleUserClick = useCallback(() => {
    if (isLoggedIn) setShowUserLightbox(true);
    else setShowLoginModal(true);
  }, [isLoggedIn]);

  // Set to true by loadInitData() after seeding aiQuickActions from init.defaultPrompts.
  // The prompts useEffect checks this on its first fire to avoid clearing + re-fetching
  // prompts that were already seeded on page load.
  const initPromptsLoadedRef = useRef(false);

  const { verifyStage, setVerifyStage, cardAnalysisMap, generateDetailedAnalysis } = useCardAnalysis();
  const {
    suggestedPrompts, setSuggestedPrompts,
    isClarificationPills, setIsClarificationPills,
    aiQuickActions, setAiQuickActions,
    lastUserQuery, setLastUserQuery,
    generateContextualSuggestions,
  } = useSuggestedPrompts({ selectedCategory, selectedSport, initPromptsLoadedRef });

  // Fantasy league setup state — must NOT read localStorage here (causes SSR hydration mismatch #418)
  const [fantasyLeague, setFantasyLeague] = useState<FantasyLeague | null>(null);
  const [fantasySetupStep, setFantasySetupStep] = useState(0);
  const [fantasySetupData, setFantasySetupData] = useState<Partial<FantasyLeague>>({ sport: 'nfl', platform: 'espn', teams: 12, leagueType: 'ppr' });
  const { uploadedFiles, fileInputRef, processFiles, handleFileUpload, removeAttachment, saveFileToProfile, setUploadedFiles } = useFileHandling();
  const handleSaveFile = useCallback((file: FileAttachment) => {
    saveFileToProfile(file, (msg) => toast.success(msg), (msg) => toast.error(msg));
  }, [saveFileToProfile, toast]);
  // Open sidebar by default on desktop (lg breakpoint = 1024px). Mobile/tablet stay closed.
  useEffect(() => {
    if (window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  // Cmd+K / Ctrl+K → open command palette
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

  // Check actual service health once on mount; wire to the status indicator in ChatInput.
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

  // Correct the welcome message timestamp to real local time after hydration.
  // Runs once on mount — safe because it's client-only (no server/client mismatch).
  useEffect(() => {
    const now = new Date();
    setMessages((prev: any) =>
      prev[0]?.isWelcome ? [{ ...prev[0], timestamp: now }, ...prev.slice(1)] : prev
    );
    setChats((prev: any) =>
      prev[0]?.id === 'chat-1' ? [{ ...prev[0], timestamp: now }, ...prev.slice(1)] : prev
    );
  }, []);

  // Personalize the welcome message client-side after hydration (and when user logs in).
  // This runs only in the browser, so getWelcomeMessage()'s timezone-sensitive
  // date/time calls are safe here (no server/client mismatch).
  useEffect(() => {
    const firstName = user?.name?.split(' ')[0] || undefined;
    setMessages((prev: any) => {
      if (prev[0]?.isWelcome) {
        return [{ ...prev[0], content: getWelcomeMessage('all', undefined, firstName) }, ...prev.slice(1)];
      }
      return prev;
    });
  }, [user?.name]);

  // Re-personalize + refresh cards when category or sport filter changes (only while welcome is still visible).
  useEffect(() => {
    const firstName = user?.name?.split(' ')[0] || undefined;

    // Update message text immediately
    setMessages((prev: any) => {
      if (prev[0]?.isWelcome) {
        return [{ ...prev[0], content: getWelcomeMessage(selectedCategory, selectedSport || undefined, firstName) }, ...prev.slice(1)];
      }
      return prev;
    });
  }, [selectedCategory, selectedSport]);


  // Load instructions from localStorage fallback only (server instructions come via /api/init)
  const loadInstructionsFromLocalStorage = () => {
    const stored = localStorage.getItem('leverage_custom_instructions') || '';
    setCustomInstructions(stored);
  };

  // Fetch profile ID for credit sync — credits and instructions come via /api/init.
  const loadProfileId = async (authId: string) => {
    try {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', authId)
        .single();
      if (profile?.id) setSupabaseProfileId(profile.id);
      // Sync stored theme preference to DOM
      const { data: pref } = await supabase
        .from('user_preferences')
        .select('theme')
        .eq('user_id', authId)
        .single();
      if (pref?.theme) setTheme(pref.theme);
    } catch {
      // Non-critical — credit sync will be skipped without a profile ID
    }
  };

  // Fetch credits + instructions + chats from /api/init and apply to state.
  // Called on every auth resolution (signed in OR guest) — replaces the old
  // page-load useEffect so /api/init is requested exactly once per page load.
  const loadInitData = async () => {
    try {
      const res = await fetch('/api/init');
      const init = await res.json();

      // Hydrate welcome message insights
      if (init.insights) {
        setMessages((prev: Message[]) => {
          const newMessages = [...prev];
          if (newMessages[0]?.isWelcome) {
            newMessages[0] = { ...newMessages[0], insights: init.insights };
          }
          return newMessages;
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
      // Seed quick-action prompts and mark them as loaded so the prompts
      // useEffect skips its first-mount fetch (which would clear these).
      if (Array.isArray(init.defaultPrompts) && init.defaultPrompts.length > 0) {
        setAiQuickActions(
          init.defaultPrompts.map((p: { label: string; query: string }) => ({
            label: p.label,
            icon: Sparkles,
            category: selectedCategory,
            query: p.query,
          }))
        );
        initPromptsLoadedRef.current = true;
      }
      // Populate chat threads directly from init.chats — same data as /api/chats GET,
      // eliminating a redundant round-trip. Only applies when the user is logged in.
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
        if (firstThread.category && firstThread.category !== 'all') {
          setSelectedCategory(firstThread.category);
        }
        const SPORT_KEYS_LIST = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb', 'soccer_epl', 'soccer_mls'];
        const sportTag = firstThread.tags?.find((t: string) => SPORT_KEYS_LIST.includes(t));
        if (sportTag) setSelectedSport(sportTag);
        loadMessages(firstThread.id).then(msgs => {
          if (msgs.length > 0) {
            let storedCards: Record<string, any[]> = {};
            try { storedCards = JSON.parse(localStorage.getItem(`lev:cards:${firstThread.id}`) ?? '{}'); } catch { /* ignore */ }
            setMessages(msgs.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              cards: m.cards?.length ? m.cards : (storedCards[m.id ?? ''] ?? []),
              modelUsed: m.modelUsed,
              confidence: m.confidence,
              isWelcome: m.isWelcome,
            })) as any);
          }
        });
      }
    } catch {
      loadInstructionsFromLocalStorage();
    }
  };

  // Restore fantasy league from Supabase (called on login / auth change)
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
    } catch { /* non-critical — localStorage fallback already loaded */ }
  };

  // Sync auth state from AuthProvider (getSession from localStorage — 0 network calls).
  // prevAuthUserIdRef ensures side-effects (loadInitData, loadThreads) fire only on
  // identity transitions, not on every render.
  useEffect(() => {
    if (authLoading) return;

    const currentUserId = authUser?.id ?? null;
    // undefined means "not yet initialised" — skip the first render guard check
    const prevUserId = prevAuthUserIdRef.current === (undefined as unknown as string | null)
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

      // Only fire data-loading side-effects on actual identity transitions (sign-in / switch),
      // not on token-refresh events where authUser is the same person.
      if (prevUserId !== currentUserId) {
        loadFantasyLeagueFromDB();
        // loadInitData() fetches /api/init which returns credits, instructions, insights,
        // chats, and defaultPrompts in a single request — no separate /api/chats call needed.
        setIsLoadingChats(true);
        loadInitData();
      }
    } else {
      // Signed out (or first load as guest)
      setIsLoggedIn(false);
      setUser(null);
      setSupabaseProfileId(null);
      setFantasyLeague(null);
      localStorage.removeItem('leverage_fantasy_league');
      const stored = localStorage.getItem('leverage_custom_instructions') || '';
      setCustomInstructions(stored);
      if (prevUserId !== null && prevUserId !== undefined) {
        // Actual sign-out transition — reload guest instructions
        loadInstructionsFromLocalStorage();
      }
      // On first mount as guest (prevUserId is undefined), call loadInitData() to
      // seed prompts and any guest-visible init data — replaces the old page-load useEffect.
      if (prevUserId === undefined) {
        loadInitData();
      }
    }
  // deps: authUser/authLoading are the only values that should trigger this effect.
  // loadInitData/loadInstructionsFromLocalStorage are component-scoped helpers that
  // reference many pieces of state; adding them would cause an infinite loop.
    }, [authUser, authLoading]);

  // Handle Stripe checkout success: verify session server-side before adding credits
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) return;

    // Clean up URL params immediately so reloads don't re-trigger
    window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      const isDev = getIsDev();
      try {
        const res = await fetch(`/api/stripe/verify?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (data.verified && data.credits > 0) {
          addCredits(data.credits);
          if (isDev) console.log(`[Stripe] Verified and added ${data.credits} credits for session ${sessionId}`);
        } else if (!data.verified) {
          // Stripe not configured (dev mode) — fall back to URL param
          const creditsPurchased = params.get('credits');
          const amount = creditsPurchased ? parseInt(creditsPurchased, 10) : 0;
          if (amount > 0) {
            addCredits(amount);
            if (isDev) console.log(`[Stripe] Dev mode: added ${amount} credits from URL param`);
          }
        }
      } catch {
        // Network error — fall back to URL param (best-effort)
        const creditsPurchased = params.get('credits');
        const amount = creditsPurchased ? parseInt(creditsPurchased, 10) : 0;
        if (amount > 0) addCredits(amount);
      }
    })();
  }, []);

  // NOTE: The page-load /api/init fetch was here previously ([] deps useEffect).
  // It has been removed — loadInitData() in the auth effect now covers both
  // authenticated and guest users on first mount, preventing a duplicate fetch.

  // Initialize the Kalshi WebSocket store once on mount (client-side only).
  // The WS itself only opens when a KalshiCard subscribes to a ticker — this
  // just wires up the price-update and connection-change listeners.
  useEffect(() => {
    const cleanup = useKalshiStore.getState().initWS();
    return cleanup;
  }, []);

  // One-time card fallback: if the AI response didn't include cards (rare failure),
  // fetch them independently so the user sees something.
  // We do NOT refresh cards that were already returned by the AI — those are aligned
  // with the AI text and replacing them would cause text/card drift.
  useEffect(() => {
    if (cardsRefreshIntervalRef.current) clearTimeout(cardsRefreshIntervalRef.current);

    const fillMissingCards = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (!lastUserQuery) return;

      // Guard: only run once per query+category combination
      const fetchKey = `${lastUserQuery}::${selectedCategory}`;
      if (fetchedForQueryRef.current === fetchKey) return;

      // Hoist prop detection so the guard below can exempt prop queries
      const msgLow = (lastUserQuery || '').toLowerCase();
      const hasPropQuery = msgLow.includes('prop') || msgLow.includes('strikeout')
                        || msgLow.includes('hits over') || msgLow.includes('home run over')
                        || msgLow.includes('player bet');

      // Skip if the last AI message already has cards (AI-aligned, do not replace)
      // Exception: prop queries need their own card fetch even when AI has moneyline cards
      const lastAIMessage = [...messages].reverse().find((m: any) => m.role === 'assistant');
      if (lastAIMessage?.cards?.length && !hasPropQuery) return;

      fetchedForQueryRef.current = fetchKey;

      try {
        const hasFantasyOrDFSQuery = /\b(adp|draft|waiver|sleeper|fantasy|dfs|best ball|lineup|vbd|tier|rank)\b/i.test(lastUserQuery || '');
        const hasDFSQuery = /\b(dfs|daily fantasy|showdown|gpp|gpps|tournament lineup)\b/i.test(lastUserQuery || '');
        // Sportsbook name present but NOT DFS-specific → route to betting
        const hasBettingPlatformQuery =
          /\b(draftkings|fanduel|betmgm|caesars|pointsbet|barstool)\b/i.test(lastUserQuery || '') &&
          !/\b(lineup|slate|dfs|daily fantasy|gpp|showdown)\b/i.test(lastUserQuery || '');
        const detectedCategory = hasPropQuery ? 'props'
          : (
          msgLow.includes('kalshi') ||
          msgLow.includes('prediction market') ||
          msgLow.includes('championship winner') ||
          msgLow.includes('contract pricing') ||
          msgLow.includes('winner contract')
        ) ? 'kalshi'
          : hasBettingPlatformQuery ? 'betting'
          : hasFantasyOrDFSQuery && selectedCategory !== 'betting' && selectedCategory !== 'props'
          ? (hasDFSQuery ? 'dfs' : 'fantasy')
          : selectedCategory === 'fantasy' && !hasFantasyOrDFSQuery
          ? 'betting'
          : selectedCategory;
        const conversationHistory = messages.slice(-10).map((m: any) => ({ role: m.role, content: m.content || '' }));
        const refreshSport = extractSport(lastUserQuery, conversationHistory) || selectedSport || undefined;
        console.log('[v0] fillMissingCards sport:', refreshSport, '(query:', lastUserQuery?.slice(0, 60), ')');
        const freshCards = await fetchDynamicCards({ sport: refreshSport, userContext: lastUserQuery, category: detectedCategory, limit: 7 });
        if (freshCards.length === 0) return;

        setMessages((prev: any) => {
          const updated = [...prev];
          const converted = freshCards;
          // Only fill messages that still have no cards
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'assistant' && !updated[i].cards?.length) {
              updated[i] = { ...updated[i], cards: converted };
              break;
            }
          }
          return updated;
        });
      } catch {
        // Non-critical — silently skip on error
      }
    };

    // Short delay to let the AI done-event cards arrive first
    cardsRefreshIntervalRef.current = setTimeout(fillMissingCards, 3000) as unknown as NodeJS.Timeout;
    return () => { if (cardsRefreshIntervalRef.current) clearTimeout(cardsRefreshIntervalRef.current); };
  }, [lastUserQuery]);

  const categories = [
    { id: 'all', name: 'All', icon: Layers, color: 'text-blue-400', desc: 'Everything' },
    { id: 'betting', name: 'Sports Betting', icon: TrendingUp, color: 'text-orange-400', desc: 'Live Odds & Props' },
    { id: 'fantasy', name: 'Fantasy', icon: Trophy, color: 'text-violet-400', desc: 'Season-long & Best Ball' },
    { id: 'dfs', name: 'DFS Optimizer', icon: Award, color: 'text-purple-400', desc: 'DK/FD Lineups' },
    { id: 'kalshi', name: 'Kalshi Markets', icon: BarChart3, color: 'text-cyan-400', desc: 'Financial Prediction' },
  ];

  const sports = useMemo(() => {
    const raw = [
      { id: 'mlb',             name: 'MLB',             apiKey: 'baseball_mlb' },
      { id: 'nba',             name: 'NBA',             apiKey: 'basketball_nba' },
      { id: 'nhl',             name: 'NHL',             apiKey: 'icehockey_nhl' },
      { id: 'nfl',             name: 'NFL',             apiKey: 'americanfootball_nfl' },
      { id: 'ncaa-basketball',   name: "NCAA Men's Basketball",   apiKey: 'basketball_ncaab' },
      { id: 'ncaa-basketball-w', name: "NCAA Women's Basketball", apiKey: 'basketball_wncaab' },
      { id: 'ncaa-football',     name: 'NCAA Football',           apiKey: 'americanfootball_ncaaf' },
    ].map(s => ({ ...s, isInSeason: getSeasonInfo(s.apiKey).isInSeason }));
    return [...raw.filter(s => s.isInSeason), ...raw.filter(s => !s.isInSeason)];
  }, []);

  // Demo cards removed - app now fetches ONLY real data from APIs
  // Real data sources: The Odds API, Grok 4 Fast AI, Open-Meteo Weather API, Supabase
  const unifiedCards: InsightCard[] = [];

  // Load fantasy league from localStorage after hydration (avoids SSR mismatch #418)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('leverage_fantasy_league');
      if (saved) setFantasyLeague(JSON.parse(saved));
    } catch { /* ignore parse errors */ }
  }, []);

  useEffect(() => {
    if (serverData?.fetchErrors?.length) {
      toast.info('Live data unavailable — showing AI estimates. Data will refresh shortly.');
    }
  }, []); // mount-only: serverData is immutable SSR props, toast is stable context ref


  const handleFollowUp = (action: 'correlated' | 'metrics', cardData?: any) => {
    const isDev = getIsDev();
    if (isDev) console.log('[v0] Generating follow-up response:', action);

    // Check if user has credits
    if (!consumeCredit()) {
      if (isDev) console.log('[v0] No credits remaining, showing purchase modal');
      setShowStripeLightbox(true);
      return;
    }

    // Delegate to the real AI pipeline with a contextual query so the response
    // is grounded in live data instead of drawing from the stale unifiedCards array
    // (which is always empty since demo cards were removed).
    const cardTitle = cardData?.title ?? '';
    const query = action === 'correlated'
      ? `Show me correlated betting opportunities related to: ${cardTitle}. Include cross-market plays with positive expected value.`
      : `Provide a deep metric analysis for: ${cardTitle}. Include key performance indicators, historical accuracy, and statistical significance.`;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev: Message[]) => [...prev, userMsg]);
    setInput('');
    generateRealResponse(query);
  };

  const stopGeneration = useCallback(() => {
    abortStream();
    setIsTyping(false);
  }, [abortStream]);

  const handleRetryMessage = useCallback((messageId: string) => {
    setMessages((prev: Message[]) =>
      prev.map(m => m.id === messageId
        ? { ...m, isPending: true, isError: false, isPartial: false, isStreaming: false, content: '', cards: [] }
        : m)
    );
    generateRealResponseRef.current?.(lastUserQuery, undefined, messageId);
  }, [lastUserQuery]);

  // Listen for player-name clicks dispatched from fantasy/DFS cards.
  // Using a ref so the effect doesn't need generateRealResponse as a dependency.
  const generateRealResponseRef = useRef<typeof generateRealResponse | null>(null);
  // Stable wrapper used by useMessageEditor — always calls the latest generateRealResponse
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
    handleEditChatTitle, handleSaveChatTitle,
    handleCancelChatTitleEdit, handleKeyDownChatTitle,
    adjustEditTextareaHeight,
  } = useMessageEditor({
    messages,
    setMessages,
    activeChat,
    isLoggedIn,
    generateResponse: generateResponseStable,
    toast,
    setChats,
  });
  useEffect(() => {
    const handler = (e: Event) => {
      const { query, category } = (e as CustomEvent<{ query: string; category?: string }>).detail;
      // Sync the platform tab so the AI gets the right context and model
      // Guard: only update if the category actually changed — prevents redundant
      // state updates (and their cascading re-renders) when already on the tab.
      if (category && category !== selectedCategory) setSelectedCategory(category);
      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: query, timestamp: new Date() };
      setMessages((prev: Message[]) => [...prev, userMsg]);
      setInput('');
      generateRealResponseRef.current?.(query);
    };
    window.addEventListener('leveragePlayerClick', handler);
    return () => window.removeEventListener('leveragePlayerClick', handler);
  }, []);

  const generateRealResponse = useGenerateResponse({
    messages, setMessages, streamMessage, abortStream,
    setIsTyping, selectedCategory, selectedSport, setKalshiBettingBannerVisible,
    customInstructions, deepThink, fantasyLeague, setVerifyStage,
    setSuggestedPrompts, setIsClarificationPills, generateContextualSuggestions, setLastUserQuery,
    activeChat, setActiveChat, setChats, pendingThreadRef, isLoggedIn,
    oddsCacheRef, analyzingMessageRef, toast,
  });

  // Keep the ref current so player-click and voice handlers always call the latest version
  generateRealResponseRef.current = generateRealResponse;



  // File handling functions provided by useFileHandling hook

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && uploadedFiles.length === 0) return;

    // Debounce: if a stream is already in flight, abort it before starting a new one.
    // This prevents log-visible "4 POSTs in 3 minutes" stacking where each request
    // triggers its own Grok call + Kalshi fetch before the previous stream completes.
    if (isTyping) {
      abortStream();
      // Let the abort propagate (setIsTyping(false) runs in generateRealResponse's
      // finally block) then fall through to start the new request immediately.
    }

    // Check if user has credits
    if (!consumeCredit()) {
      setShowStripeLightbox(true);
      return;
    }

    // Guard: detect raw TSV/CSV pasted directly into the chat box.
    // The ADP upload modal is the right path for bulk tabular data — sending
    // 1000+ rows through the chat both exceeds the message limit and wastes
    // tokens on formatting rather than analysis.
    if (input.trim()) {
      const lineCount = input.split('\n').filter(Boolean).length;
      const tabCount  = (input.match(/\t/g) ?? []).length;
      if (lineCount > 20 && tabCount > lineCount) {
        toast.error(
          '📊 That looks like raw ADP/spreadsheet data. Use the ADP Upload button (📎) to import it — the AI will have full access to all rows for draft analysis.'
        );
        return;
      }
    }

    // Capture files before clearing — generateRealResponse needs the content
    const currentFiles = [...uploadedFiles];

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input || '📎 Attached files',
      timestamp: new Date(),
      attachments: currentFiles.length > 0 ? currentFiles : undefined
    };

    const optimisticId = crypto.randomUUID();
    setMessages((prev: Message[]) => [
      ...prev,
      userMessage,
      {
        id: optimisticId,
        role: 'assistant' as const,
        content: '',
        timestamp: new Date(),
        isPending: true,
        cards: [],
      } as Message,
    ]);
    setUploadedFiles([]);

    // Update chat preview and title based on first user message
    setChats((prevChats: Chat[]) => prevChats.map((chat: Chat) => {
      if (chat.id === activeChat) {
        const updatedChat = { ...chat };
        // Update preview with user's message
        updatedChat.preview = input.slice(0, 50) + (input.length > 50 ? '...' : '');
        updatedChat.timestamp = new Date();

        // Auto-generate title from first message if still default
        if (chat.title === 'New Analysis' && input.length > 0) {
          const words = input.split(' ').slice(0, 5).join(' ');
          updatedChat.title = words + (input.split(' ').length > 5 ? '...' : '');
        }

        // Auto-tag based on message content
        const contentLower = input.toLowerCase();
        const newTags = [...chat.tags];
        if (contentLower.includes('nba') || contentLower.includes('basketball')) newTags.push('nba');
        if (contentLower.includes('nfl') || contentLower.includes('football')) newTags.push('nfl');
        if (contentLower.includes('mlb') || contentLower.includes('baseball')) newTags.push('mlb');
        if (contentLower.includes('dfs') || contentLower.includes('lineup')) newTags.push('optimizer');
        if (contentLower.includes('draft') || contentLower.includes('adp')) newTags.push('draft');
        if (contentLower.includes('bet') || contentLower.includes('odds')) newTags.push('live');
        updatedChat.tags = [...new Set(newTags)].slice(0, 3);

        // Persist updated title/preview to Supabase (fire-and-forget)
        if (isLoggedIn) {
          updateThread(chat.id, {
            title: updatedChat.title,
            preview: updatedChat.preview,
            tags: updatedChat.tags,
          });
        }

        return updatedChat;
      }
      return chat;
    }));

    // Build the prompt that actually reaches the AI — append file data as text
    // so the model can analyse the file content directly.
    let promptForAI = input;
    if (currentFiles.length > 0) {
      const fileSections: string[] = [];

      for (const f of currentFiles) {
        if (f.data?.headers && f.data?.rows) {
          // CSV/TSV: include up to 500 rows
          // Cap at 100 rows for the AI prompt — full data is uploaded via the
          // ADP endpoint; sending thousands of rows here wastes context window.
          const AI_ROW_LIMIT = 100;
          const headers = f.data.headers.join('\t');
          const rows = f.data.rows.slice(0, AI_ROW_LIMIT).map((r: string[]) => r.join('\t')).join('\n');
          const truncated = f.data.rows.length > AI_ROW_LIMIT
            ? `\n[... ${f.data.rows.length - AI_ROW_LIMIT} more rows — full dataset uploaded to ADP database]`
            : '';
          fileSections.push(`[File: ${f.name} (${f.data.rows.length} rows)]\n${headers}\n${rows}${truncated}`);
        } else if (f.textContent) {
          // TXT / JSON
          fileSections.push(`[File: ${f.name}]\n${f.textContent}`);
        }
      }

      if (fileSections.length > 0) {
        promptForAI = (input ? input + '\n\n' : 'Analyze this data:\n\n') + fileSections.join('\n\n');
      } else if (!input) {
        // Image-only with no text — give it a default prompt
        promptForAI = `I've attached ${currentFiles.map(f => f.name).join(', ')}. Please analyze.`;
      }
    }

    setInput('');
    // Extract image attachments for vision (must be done before setUploadedFiles clears them)
    const visionAttachments = currentFiles
      .filter(f => f.type === 'image' && f.imageBase64)
      .map(f => ({ name: f.name, base64: f.imageBase64!, mimeType: f.mimeType ?? 'image/jpeg' }));
    generateRealResponse(promptForAI, visionAttachments.length > 0 ? visionAttachments : undefined, optimisticId);
  };

  // ── Auto-query: fire pending query once the welcome message appears ───────────
  // When openChatWithQuery sets pendingQueryRef and calls handleNewChat, messages
  // resets to [welcomeMsg]. This effect detects that and submits the pending query.
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };


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
  
  // AI-generated prompts (aiQuickActions) take priority when available;
  // fall back to hardcoded arrays from lib/prompt-data.ts on network failure or while loading.
  const hardcodedQuickActions = getHardcodedQuickActions(selectedCategory, selectedSport, selectedKalshiTopic);
  const quickActions = aiQuickActions ?? hardcodedQuickActions;

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* Environment Variable Warning Banner */}
      <EnvironmentWarningBanner missingKeys={serverData?.missingKeys ?? []} />
      
      {/* Mobile backdrop — closes sidebar when tapping outside */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-backdrop-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar wrapper
          Mobile (< md): fixed overlay, translate drives show/hide — chat area stays full-width
          Desktop (≥ md): in-flow, width-animated by the Sidebar component itself */}
      <div className={`flex-shrink-0 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:transition-transform max-md:duration-300 max-md:ease-in-out ${sidebarOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}`}>
        <Sidebar
          open={sidebarOpen}
          onNewChat={handleNewChat}
          chatSearch={chatSearch}
          setChatSearch={setChatSearch}
          activeChat={activeChat}
          onSelectChat={handleSelectChat}
          selectedCategory={selectedCategory}
          setSelectedCategory={handleCategorySelect}
          selectedSport={selectedSport}
          setSelectedSport={setSelectedSport}
          selectedKalshiTopic={selectedKalshiTopic}
          setSelectedKalshiTopic={setSelectedKalshiTopic}
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
          user={user}
          onUserClick={handleUserClick}
          isLoadingChats={isLoadingChats}
          onClose={handleCloseSidebar}
          onNavigate={(query, category, sport) => { openChatWithQuery(query, category, sport); setSidebarOpen(false); }}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gradient-to-br from-black via-background to-black">
        {/* Mobile "Add to Home Screen" banner — in normal flow, pushes header down */}
        <AddToHomeBanner />
        {/* Header */}
        <ChatHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          isLoggedIn={isLoggedIn}
          user={user}
          onOpenUserLightbox={handleOpenUserLightbox}
          onOpenAlerts={handleOpenAlerts}
          alertCount={alertCount}
          onOpenSettings={handleOpenSettings}
          onOpenWatchlist={handleOpenWatchlist}
          watchlistCount={savedPlayersCount + savedCardsCount}
          onOpenLogin={handleOpenLogin}
          onOpenSignup={handleOpenSignup}
          currentSport={selectedSport || undefined}
          currentCategory={selectedCategory !== 'all' ? selectedCategory : undefined}
        />

        <ChatMessageList
          messages={messages}
          isTyping={isTyping}
          verifyStage={verifyStage}
          editingMessageIndex={editingMessageIndex}
          editingContent={editingContent}
          speakingMessageId={speakingMessageId}
          setSpeakingMessageId={setSpeakingMessageId}
          kalshiBettingBannerVisible={kalshiBettingBannerVisible}
          setKalshiBettingBannerVisible={setKalshiBettingBannerVisible}
          editTextareaRef={editTextareaRef}
          onEditContentChange={setEditingContent}
          adjustEditTextareaHeight={adjustEditTextareaHeight}
          onKeyDown={handleKeyDown}
          selectedCategory={selectedCategory}
          onGenerateResponse={(q) => generateRealResponse(q)}
          onFollowUp={handleFollowUp}
          onEditMessage={handleEditMessage}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          onCopyMessage={handleCopyMessage}
          onRegenerateResponse={handleRegenerateResponse}
          onVote={handleVote}
        />
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
          selectedCategory={selectedCategory}
          selectedSport={selectedSport}
          deepThink={deepThink}
          onToggleDeepThink={handleToggleDeepThink}
          systemStatus={systemStatus}
          showLimitNotification={showLimitNotification}
          setShowLimitNotification={setShowLimitNotification}
          getRateLimitData={getRateLimitData}
          fantasyLeague={fantasyLeague}
          setFantasyLeague={setFantasyLeague}
          fantasySetupData={fantasySetupData}
          setFantasySetupData={setFantasySetupData as any}
          fantasySetupStep={fantasySetupStep}
          setFantasySetupStep={setFantasySetupStep}
          isLoggedIn={isLoggedIn}
          messages={messages}
          suggestedPrompts={suggestedPrompts}
          quickActions={quickActions}
          isClarificationPills={isClarificationPills}
          onCategorySelect={handleCategorySelect}
          onPromptClick={(submitText) => {
            const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: submitText, timestamp: new Date() };
            setMessages((prev: Message[]) => [...prev, userMessage]);
            setChats((prevChats: Chat[]) => prevChats.map((chat: Chat) => {
              if (chat.id === activeChat) {
                const updatedChat = { ...chat };
                updatedChat.preview = submitText.slice(0, 50) + (submitText.length > 50 ? '...' : '');
                updatedChat.timestamp = new Date();
                if (chat.title === 'New Analysis') {
                  const words = submitText.split(' ').slice(0, 5).join(' ');
                  updatedChat.title = words + (submitText.split(' ').length > 5 ? '...' : '');
                }
                return updatedChat;
              }
              return chat;
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
      </div>

      <ChatModals
        showPurchaseModal={showPurchaseModal}
        purchaseAmount={purchaseAmount}
        setPurchaseAmount={setPurchaseAmount}
        setShowPurchaseModal={setShowPurchaseModal}
        showSubscriptionModal={showSubscriptionModal}
        setShowSubscriptionModal={setShowSubscriptionModal}
        setShowStripeLightbox={setShowStripeLightbox}
        setShowLoginModal={setShowLoginModal}
        showLoginModal={showLoginModal}
        showSignupModal={showSignupModal}
        setShowSignupModal={setShowSignupModal}
        setIsLoggedIn={setIsLoggedIn}
        setUser={setUser}
        showUserLightbox={showUserLightbox}
        setShowUserLightbox={setShowUserLightbox}
        user={user}
        onLogout={() => { setUser(null); setIsLoggedIn(false); setFantasyLeague(null); localStorage.removeItem('leverage_fantasy_league'); }}
        onInstructionsChange={setCustomInstructions}
        onAttachFile={(file) => setUploadedFiles((prev: any) => [...prev, { ...file, url: '' }])}
        showSettingsLightbox={showSettingsLightbox}
        setShowSettingsLightbox={setShowSettingsLightbox}
        onUserUpdate={setUser}
        onOpenStripe={handleOpenStripe}
        creditsRemaining={creditsRemaining}
        showAlertsLightbox={showAlertsLightbox}
        setShowAlertsLightbox={setShowAlertsLightbox}
        setAlertCount={setAlertCount}
        showWatchlistLightbox={showWatchlistLightbox}
        setShowWatchlistLightbox={setShowWatchlistLightbox}
        onPlayerClick={handleSavedPlayerClick}
        onCardClick={handleSavedCardClick}
        showCommandPalette={showCommandPalette}
        setShowCommandPalette={setShowCommandPalette}
        chats={chats}
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        setSidebarOpen={setSidebarOpen}
        showStripeLightbox={showStripeLightbox}
        addCredits={addCredits}
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