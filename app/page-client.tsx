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
import { fetchDynamicCards, type DynamicCard } from '@/lib/data-service';
import { API_ENDPOINTS, PLAYER_HEADSHOT_IDS, sportToApi, FREE_TIER, GROK_VOICE_STORAGE_KEY, GROK_VOICE_DEFAULT } from '@/lib/constants';
import { speakText, stopVoice } from '@/lib/voice-player';
import { cardsToSpeech } from '@/lib/card-speech';
import { isDev as getIsDev } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';
import { detectSportFromText, extractSport, extractSportFromText, extractMarketType, extractPlatform } from '@/lib/sport-detection';
import { useModalState } from '@/lib/hooks/useModalState';
import { useCredits } from '@/lib/hooks/useCredits';
import { useMessageEditor } from '@/lib/hooks/useMessageEditor';
import { useChatList, type Chat } from '@/lib/hooks/useChatList';
import { useCardAnalysis } from '@/lib/hooks/useCardAnalysis';
import { useSuggestedPrompts } from '@/lib/hooks/useSuggestedPrompts';
import { useFileHandling, type FileAttachment } from '@/lib/hooks/useFileHandling';
import { useKalshiStore } from '@/lib/store/kalshi-store';
const AuthModals = dynamic(() => import('@/components/AuthModals').then(m => ({ default: m.AuthModals })), { ssr: false });
import { TrendingUp, Trophy, Target, ThumbsUp, ThumbsDown, MessageSquare, Clock, Star, Zap, AlertCircle, CheckCircle, CheckCircle2, DollarSign, Activity, Award, ChevronRight, Bell, ShoppingCart, Medal, PieChart, Layers, BarChart3, Sparkles, TrendingDown, Flame, Users, RefreshCw, Search, Copy, Edit3, RotateCcw, Shield, Database, BookOpen, X, CheckCheck, AlertTriangle, BarChart, Info, FileText, ImageIcon, Loader2, Volume2 } from 'lucide-react';
import { CardLayout } from '@/components/data-cards/CardLayout';
import { DatabaseStatusBanner } from '@/components/database-status-banner';
import { TrustMetricsDisplay } from '@/components/trust-metrics-display';
import { AIProgressIndicator } from '@/components/ai-progress-indicator';
const SettingsLightbox = dynamic(() => import('@/components/SettingsLightbox').then(m => ({ default: m.SettingsLightbox })), { ssr: false });
const AlertsLightbox = dynamic(() => import('@/components/AlertsLightbox').then(m => ({ default: m.AlertsLightbox })), { ssr: false });
const StripeLightbox = dynamic(() => import('@/components/StripeLightbox').then(m => ({ default: m.StripeLightbox })), { ssr: false });
const UserLightbox = dynamic(() => import('@/components/UserLightbox').then(m => ({ default: m.UserLightbox })), { ssr: false });
const WatchlistLightbox = dynamic(() => import('@/components/WatchlistLightbox').then(m => ({ default: m.WatchlistLightbox })), { ssr: false });
import { useToast } from '@/components/toast-provider';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { ChatHeader, ChatInput } from '@/components/chat';
import { SuggestedPrompts } from '@/components/suggested-prompts';
import { InsightCardItem, type InsightCard } from '@/components/InsightCard';

import { createThread, updateThread, loadMessages, saveMessagesBatch } from '@/lib/chat-service';
import { generateNoDataMessage, getSeasonInfo } from '@/lib/seasonal-context';
import { useChat, type ChatMessage as HookChatMessage } from '@/lib/hooks/useChat';
import { useTheme } from 'next-themes';
import { WelcomeScreen } from '@/components/index/WelcomeScreen';
import { MessageContent } from '@/components/index/MessageContent';
import { MessageAttachments } from '@/components/index/MessageAttachments';
import { CreditModals } from '@/components/index/CreditModals';
import { DetailedAnalysisLayout, type DetailedAnalysisData } from '@/components/index/DetailedAnalysisLayout';
import { FantasyLeagueSetup, type FantasyLeague as FantasyLeagueType } from '@/components/index/FantasyLeagueSetup';
import { AddToHomeBanner } from '@/components/AddToHomeBanner';
import {
  getHardcodedQuickActions,
  sportSelectionBettingPrompts,
  sportSelectionFantasyPrompts,
  sportSelectionDFSPrompts,
  type PromptItem,
} from '@/lib/prompt-data';
import { useVoiceConversation } from '@/lib/hooks/use-voice-conversation';
const VoiceConversationOverlay = dynamic(() => import('@/components/voice-conversation-overlay').then(m => ({ default: m.VoiceConversationOverlay })), { ssr: false });

// FileAttachment interface is imported from @/lib/hooks/useFileHandling

interface APIResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
  text?: string;
  cards?: InsightCard[];
  confidence?: number;
  sources?: Array<{
    name: string;
    type: 'database' | 'api' | 'model' | 'cache';
    reliability: number;
    url?: string;
  }>;
  model?: string;
  modelUsed?: string; // Model name used for generation (for display)
  trustMetrics?: TrustMetrics;
  useFallback?: boolean; // Flag to indicate fallback mode was used
  details?: string; // Additional error or diagnostic details
  errorType?: string; // Type of error that occurred
  clarificationNeeded?: boolean;
  clarificationOptions?: string[];
  processingTime?: number;
}

interface OddsEvent {
  sport_title: string;
  bookmakers?: Array<{
    key: string;
    title: string;
    markets: any[];
  }>;
}

interface TrustMetrics {
  benfordIntegrity: number;
  oddsAlignment: number;
  marketConsensus: number;
  historicalAccuracy: number;
  finalConfidence: number;
  trustLevel: 'high' | 'medium' | 'low';
  flags?: Array<{
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }>;
  riskLevel: 'low' | 'medium' | 'high';
  adjustedTone?: string;
  modelUsed?: string;
  sources?: Array<{ name: string; type: string; reliability: number }>;
  processingTime?: number;
  hasLiveOdds?: boolean;
  hasKalshi?: boolean;
}

interface Message extends HookChatMessage {
  // Specialised fields not in HookChatMessage
  cards?: InsightCard[];        // narrower than unknown[] — typed for this app
  trustMetrics?: TrustMetrics;  // narrower than unknown — typed for this app
  attachments?: FileAttachment[];
  voted?: 'up' | 'down';
  // isWelcome, isEditing, editHistory, insights, clarificationOptions, useFallback
  // are inherited from HookChatMessage as optional fields
}

import type { ServerDataResult } from '@/lib/server-data-loader';
export type ServerDataProps = ServerDataResult;

interface UnifiedAIPlatformProps {
  serverData?: ServerDataProps;
}

// FantasyLeague type is imported from @/components/index/FantasyLeagueSetup
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const refreshSport = extractSportFromText(lastUserQuery) || selectedSport || undefined;
        const freshCards = await fetchDynamicCards({ sport: refreshSport, userContext: lastUserQuery, category: detectedCategory, limit: 7 });
        if (freshCards.length === 0) return;

        const converted = freshCards.map(convertToInsightCard);
        setMessages((prev: any) => {
          const updated = [...prev];
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

  const generateRealResponse = async (userMessage: string, imageAttachments?: Array<{ name: string; base64: string; mimeType: string }>, optimisticAssistantId?: string) => {
    const isDev = getIsDev();
    // Dedup guard: suppress duplicate calls for the same message (e.g. onPromptClick
    // and handleSubmit both firing within the same event loop tick).
    const msgKey = userMessage.trim().slice(0, 200);
    if (analyzingMessageRef.current === msgKey) {
      if (isDev) console.log('[v0] Duplicate analyze suppressed for:', msgKey.slice(0, 60));
      return;
    }
    analyzingMessageRef.current = msgKey;

    // Cancel any in-flight request — hook manages the AbortController internally
    abortStream();
    setIsTyping(true);
    setLastUserQuery(userMessage);
    const startTime = Date.now();

    try {
      if (isDev) console.log('[v0] Starting real AI analysis for:', userMessage);
      
      // Extract context from user message with strict detection flags
      const lowerMsg = userMessage.toLowerCase();
      
      // Political market keywords
      const politicalKeywords = ['kalshi', 'election', 'politics', 'cpi', 'inflation', 'fed', 'approval rating', 'recession', 'polymarket', 'prediction market'];
      const isPoliticalMarket = politicalKeywords.some(k => lowerMsg.includes(k));
      
      // Sports detection - pass conversation history for context, but not for Kalshi queries
      const conversationHistory = messages.slice(-5).map((m: any) => ({ role: m.role, content: m.content || '' }));
      const detectedSport = extractSport(
        userMessage,
        (selectedCategory === 'kalshi' || isPoliticalMarket) ? undefined : conversationHistory
      );

      // Normalize the UI-selected sport to the same format extractSport() returns
      // (e.g. 'ncaa-football' → 'ncaaf', 'ncaa-basketball' → 'ncaab', 'ncaa-basketball-w' → 'ncaaw', others unchanged)
      const selectedSportNormalized = selectedSport === 'ncaa-football' ? 'ncaaf'
        : selectedSport === 'ncaa-basketball' ? 'ncaab'
        : selectedSport === 'ncaa-basketball-w' ? 'ncaaw'
        : selectedSport || null;

      // Priority: direct message detection > explicit tab selection > history inheritance.
      // This prevents conversation history from a different sport bleeding into the current
      // query when the user has explicitly selected a sport tab (e.g. NCAAB tab + MLB history).
      const directMessageSport = detectSportFromText(userMessage);
      const effectiveSport = directMessageSport
        || (selectedCategory !== 'kalshi' ? selectedSportNormalized : null)
        || (!selectedSportNormalized ? detectedSport : null);

      // Betting intent keywords — also activates on Betting tab
      const bettingKeywords = ['odds', 'bet', 'line', 'spread', 'arbitrage', 'arb', 'h2h', 'sportsbook', 'draftkings', 'fanduel', 'moneyline', 'prop', 'parlay'];
      const hasBettingIntent = bettingKeywords.some(k => lowerMsg.includes(k)) || selectedCategory === 'betting';

      // Sports query detection (not political, not Kalshi)
      const sportsKeywords = ['nba', 'nfl', 'nhl', 'mlb', 'basketball', 'football', 'hockey', 'baseball', 'ncaa'];
      const isSportsQuery = (sportsKeywords.some(k => lowerMsg.includes(k)) || !!effectiveSport) && !isPoliticalMarket && selectedCategory !== 'kalshi';

      // Fantasy intent — also activates on Fantasy tab and DFS tab
      const fantasyKeywords = ['fantasy', 'draft', 'waiver', 'faab', 'adp', 'vbd', 'tier cliff', 'bestball', 'best ball', 'start sit', 'trade', 'trade value', 'trade target', 'trade advice', 'who should i pick', 'who do i start', 'sleeper', 'rankings', 'projections', 'auction value', 'nfbc', 'nffc', 'tgfbi', 'draft strategy', 'draft slot', 'draft position', 'pick position', 'draft order', 'average draft'];
      const hasFantasyIntent = (fantasyKeywords.some(k => lowerMsg.includes(k)) || selectedCategory === 'fantasy' || selectedCategory === 'dfs') && !isPoliticalMarket;

      // Player-specific query detection — check message against known player roster
      const detectedPlayerName = Object.keys(PLAYER_HEADSHOT_IDS).find(
        name => lowerMsg.includes(name.toLowerCase())
      );
      const hasPlayerIntent = !!detectedPlayerName && !hasBettingIntent && !hasFantasyIntent;

      const detectedPlatform = extractPlatform(userMessage);

      // Political market guard — respects the UI platform selection:
      // - Kalshi platform selected → always political (never fetch sports odds)
      // - Betting platform selected → never political (don't let message keywords override)
      // - Otherwise → use message-based detection
      const finalIsPoliticalMarket = selectedCategory === 'kalshi' ||
        ((isPoliticalMarket || detectedPlatform === 'kalshi') && selectedCategory !== 'betting');

      // Show banner when user is on Kalshi tab but their query looks like a sports bet
      if (selectedCategory === 'kalshi' && hasBettingIntent && !isPoliticalMarket) {
        setKalshiBettingBannerVisible(true);
      } else {
        setKalshiBettingBannerVisible(false);
      }

      const context: any = {
        sport: effectiveSport,
        marketType: extractMarketType(userMessage),
        platform: detectedPlatform,
        isSportsQuery,
        isPoliticalMarket: finalIsPoliticalMarket,
        hasBettingIntent,
        hasFantasyIntent,
        hasPlayerIntent,
        playerName: detectedPlayerName,
        previousMessages: messages.slice(-5).map((m: any) => ({ role: m.role, content: m.content || '' })),
        // Pass Kalshi sub-category pill value when in Kalshi mode.
        // Only forward values that are actual Kalshi sub-categories — never sport
        // slugs like 'nba' or 'nfl', which are sports-odds concepts, not Kalshi ones.
        // Pill selection takes priority; if no pill is selected we detect from message text
        // so typing "show me sports markets on Kalshi" still routes to sports markets.
        kalshiSubcategory: (() => {
          if (selectedCategory !== 'kalshi') return undefined;
          const validSubs = ['politics', 'elections', 'election', 'sports', 'sport', 'weather', 'climate',
            'finance', 'financials', 'economics', 'crypto', 'companies', 'trending',
            'culture', 'entertainment', 'arts', 'pop culture', 'awards', 'tv', 'film',
            'music', 'movies', 'celebrity', 'oscars', 'emmys', 'grammys'];
          if (selectedSport && validSubs.includes(selectedSport.toLowerCase())) return selectedSport;
          // Fallback: detect from message text when no pill is selected
          const m = lowerMsg;
          if (m.includes('sports') || m.includes('nfl') || m.includes('nba') || m.includes('mlb')
            || m.includes('nhl') || m.includes('march madness') || m.includes('super bowl')
            || m.includes('world series') || m.includes('stanley cup')
            || m.includes('championship') || m.includes('game ')) return 'sports';
          if (m.includes('polit') || m.includes('election')) return 'politics';
          if (m.includes('weather') || m.includes('climate')) return 'weather';
          if (m.includes('finance') || m.includes('crypto') || m.includes('econom') || m.includes('stock')) return 'finance';
          if (m.includes('oscar') || m.includes('grammy') || m.includes('emmy')
            || m.includes('award') || m.includes('entertainment') || m.includes('golden globe')
            || m.includes('bafta') || m.includes('box office') || m.includes('academy award')
            || m.includes('celebrity') || m.includes('billboard') || m.includes('netflix')
            || m.includes('reality show') || m.includes('music video') || m.includes('film')
            || m.includes('movie')) return 'entertainment';
          return undefined;
        })(),
        // Pass selected tab so the API can route DFS vs fantasy correctly
        selectedCategory,
        // Pass league settings so server-side card generation uses the correct size/format
        leagueSize: fantasyLeague?.setupComplete ? (fantasyLeague.teams ?? 12) : undefined,
        leagueScoringFormat: fantasyLeague?.setupComplete ? (fantasyLeague.leagueType ?? undefined) : undefined,
      };

      if (isDev) {
        console.log('[v0] Context:', { sport: detectedSport || 'none', betting: hasBettingIntent, sports: isSportsQuery, political: finalIsPoliticalMarket, fantasy: hasFantasyIntent });
      }

      // Inject sport-selection pills immediately (zero latency) when we know the intent
      // but no sport has been provided — user sees choices before the AI responds.
      if (!effectiveSport && selectedCategory !== 'kalshi' && selectedCategory !== 'all') {
        if (selectedCategory === 'dfs') {
          setSuggestedPrompts(sportSelectionDFSPrompts);
          setIsClarificationPills(true);
        } else if (hasFantasyIntent && selectedCategory === 'fantasy') {
          setSuggestedPrompts(sportSelectionFantasyPrompts);
          setIsClarificationPills(true);
        } else if (hasBettingIntent || selectedCategory === 'betting') {
          setSuggestedPrompts(sportSelectionBettingPrompts);
          setIsClarificationPills(true);
        }
      }

      // HARD STOP: Political markets NEVER fetch sports odds
      if (context.isPoliticalMarket) {
        if (isDev) console.log('[POLITICAL MARKET DETECTED] Skipping sports odds fetch');
        // Route directly to Kalshi analysis without attempting sports odds
        // Note: The /api/analyze endpoint will handle Kalshi market analysis
      } else if (context.hasFantasyIntent && (!context.hasBettingIntent || selectedCategory === 'fantasy') && selectedCategory !== 'dfs') {
        // Fantasy intent — card generation is handled server-side by /api/analyze
        // (which has filesystem access to read the full ADP CSV). Client-side
        // pre-generation is intentionally skipped to avoid the static 120-player fallback.
        if (isDev) console.log('[FANTASY INTENT] Cards will be generated server-side');
      } else if ((context.hasBettingIntent || context.isSportsQuery) && !context.hasPlayerIntent) {
        // Fetch sports odds for any betting-related query OR explicit sports query
        if (isDev) console.log('[ODDS FETCH ATTEMPT] Betting intent or sports query detected');
        if (isDev) console.log('[v0] === ODDS FETCH STARTING ===');
        
        // Import SPORT_KEYS for consistent API format
        const { SPORT_KEYS, sportToApi } = await import('@/lib/constants');
        
        // IF SPORT IS EXPLICITLY DETECTED: Fetch ONLY that sport, NO fallback
        if (context.sport) {
          const sportKey = sportToApi(context.sport);
          
          if (isDev) {
            console.log('[v0] Fetching ONLY detected sport:', sportKey);
            console.log('[NO FALLBACK] Explicit sport detected');
          }
          
          try {
            // Check 5-minute client-side cache before hitting the API
            const ODDS_TTL = 5 * 60 * 1000;
            const cached = oddsCacheRef.current.get(sportKey);
            let oddsResult: any;
            if (cached && Date.now() - cached.ts < ODDS_TTL) {
              if (isDev) console.log(`[v0] Odds cache hit for ${sportKey}`);
              oddsResult = cached.data;
            } else {
              const oddsResponse = await fetch('/api/odds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sport: sportKey, marketType: context.marketType || 'h2h' })
              });
              if (!oddsResponse.ok) {
                const errorBody = await oddsResponse.json().catch(() => ({ error: `HTTP ${oddsResponse.status}` }));
                if (isDev) console.error(`[v0] Odds API error (${oddsResponse.status}):`, errorBody);
                if (oddsResponse.status === 503) {
                  context.oddsKeyMissing = true;
                  context.oddsErrorMessage = 'ODDS_API_KEY is not configured. Live odds are unavailable.';
                } else {
                  context.oddsError = errorBody.error;
                  context.oddsErrorMessage = errorBody.message || `Unable to fetch ${context.sport?.toUpperCase() || ''} odds (${oddsResponse.status}).`;
                }
                oddsResult = null;
              } else {
                oddsResult = await oddsResponse.json();
                // Store in cache
                oddsCacheRef.current.set(sportKey, { data: oddsResult, ts: Date.now() });
              }
            }

            if (oddsResult) {
              if (oddsResult?.events?.length > 0) {
                const sportName = sportKey.replace('_', ' ').toUpperCase();
                if (isDev) console.log(`[v0] ✅ Found ${oddsResult.events.length} live games in ${sportName}`);
                context.oddsData = oddsResult;
                context.oddsData.sport = sportKey;
              } else {
                if (isDev) console.log('[NO GAMES FOUND]', context.sport);
                // NO fallback - return status indicating no games
                context.noGamesAvailable = true;
                const _noDataMsg = generateNoDataMessage(sportKey);
                context.noGamesMessage = `${_noDataMsg.title}: ${_noDataMsg.description} ${_noDataMsg.suggestion}`;
              }
            }
          } catch (err) {
            if (isDev) console.error(`[v0] Exception fetching ${sportKey}:`, err);
            context.oddsError = err;
            context.oddsErrorMessage = `Unable to fetch ${context.sport.toUpperCase()} odds. This may be a temporary API issue.`;
          }
        } else {
          // No specific sport detected. Don't burn API calls with fallback rotation --
          // the client already has real cards from SSR/initial load. Those cards will be
          // passed to /api/analyze via existingCards and displayed in the response.
          if (isDev) console.log('[v0] No sport detected — using available cards instead of fallback rotation');
        }
        

        
        // HARD CROSS-SPORT CONTAMINATION GUARD
        if (context.sport && context.oddsData?.sport && context.oddsData.sport !== sportToApi(context.sport)) {
          if (isDev) console.error('[CROSS-SPORT BLOCKED] Attempted contamination prevented:', {
            detected: context.sport,
          fetched: context.oddsData.sport
        });
        // Clear contaminated data
        context.oddsData = undefined as any;
        context.crossSportError = true;
        }
      }
      
      // Collect cards from prior AI responses to pass as context — exclude the
      // welcome/SSR message so its pre-fetched cards never pollute a fresh query.
      const allPreviousCards = messages
        .filter((m: Message) => !m.isWelcome && m.role === 'assistant')
        .flatMap((m: Message) => m.cards || []);
      const realCards = allPreviousCards.filter((c: InsightCard) => c.realData !== false);
      const availableCards = (realCards.length > 0 ? realCards : allPreviousCards).slice(0, 6);

      // Inject fantasy league context when in fantasy mode
      let contextualUserMessage = userMessage;
      if (selectedCategory === 'fantasy' && fantasyLeague?.setupComplete) {
        const leagueCtx = [
          `Sport: ${fantasyLeague.sport?.toUpperCase() ?? 'NFL'}`,
          `Platform: ${fantasyLeague.platform?.toUpperCase() ?? 'ESPN'}`,
          `${fantasyLeague.teams ?? 12} teams`,
          `Format: ${fantasyLeague.leagueType ?? fantasyLeague.scoring ?? 'PPR'}`,
          `Team: "${fantasyLeague.teamName}"`,
          fantasyLeague.leagueName ? `League: "${fantasyLeague.leagueName}"` : '',
        ].filter(Boolean).join(', ');
        contextualUserMessage = `[Fantasy League Context: ${leagueCtx}]\n\n${userMessage}`;
      }

      // Stream the response via the useChat hook — handles SSE parsing, rAF batching,
      // AbortController lifecycle, and streaming message state internally.
      setVerifyStage('analyzing');
      const assistantMsg = await streamMessage(userMessage, {
        userMessage: contextualUserMessage,
        existingCards: availableCards,
        context,
        customInstructions: customInstructions || undefined,
        imageAttachments: imageAttachments?.length ? imageAttachments : undefined,
        deepThink,
        optimisticAssistantId,
      });

      // Hook handled the error (abort, non-OK response, stream failure) — clean up and exit.
      if (!assistantMsg) {
        setSuggestedPrompts(generateContextualSuggestions(userMessage, []));
        setIsClarificationPills(false);
        return;
      }

      // Post-process the streamed response: enrich cards and trust metrics.
      const processingTime = Date.now() - startTime;

      // Card selection: use server cards when present; fall back to pre-loaded cards
      // only when the server returned none (undefined vs explicit []).
      const serverCardCount = (assistantMsg.cards as unknown[])?.length ?? 0;
      const useFallbackCards = serverCardCount === 0 && availableCards.length > 0;
      const responseCards = serverCardCount > 0
        ? (assistantMsg.cards as InsightCard[])
        : (useFallbackCards ? availableCards : []);

      if (isDev) {
        console.log('[v0] Analysis:', JSON.stringify({
          serverCards: serverCardCount,
          responseCards: responseCards.length,
          fallbackCards: useFallbackCards ? availableCards.length : 0,
          confidence: assistantMsg.trustMetrics?.finalConfidence,
          fallback: useFallbackCards,
        }));
      }

      // Enrich trust metrics with real metadata so TrustMetricsDisplay can show
      // sources, model name, processing time, and live-data badges.
      const hasLiveOdds = !!(context?.oddsData?.events?.length > 0);
      const hasKalshi = context?.isPoliticalMarket === true;
      const enrichedTrustMetrics = assistantMsg.trustMetrics
        ? {
            ...(assistantMsg.trustMetrics as object),
            modelUsed: assistantMsg.modelUsed || 'Grok 4',
            sources: assistantMsg.sources || [],
            processingTime,
            hasLiveOdds,
            hasKalshi,
          }
        : {
            benfordIntegrity: 85,
            oddsAlignment: hasLiveOdds ? 90 : 80,
            marketConsensus: hasLiveOdds ? 88 : 78,
            historicalAccuracy: 87,
            finalConfidence: hasLiveOdds ? 88 : 82,
            trustLevel: 'high' as const,
            riskLevel: 'low' as const,
            adjustedTone: hasLiveOdds ? 'Strong signal — live data verified' : 'Knowledge-based analysis',
            flags: [],
            modelUsed: 'Grok 4',
            sources: assistantMsg.sources || [],
            processingTime,
            hasLiveOdds,
            hasKalshi,
          };

      // Build the finalised message shape (used for Supabase persistence below)
      const newMessage: Message = {
        ...assistantMsg,
        cards: responseCards,
        confidence: assistantMsg.confidence || 85,
        sources: assistantMsg.sources || [],
        modelUsed: assistantMsg.modelUsed || 'Grok 4',
        processingTime,
        trustMetrics: enrichedTrustMetrics as TrustMetrics,
      };

      // Update the already-streamed message in state with enriched metadata.
      // The hook has already set isStreaming: false and basic cards/confidence from
      // the done event — this pass adds enriched trust metrics and processed cards.
      setMessages((prev: Message[]) => prev.map(m =>
        m.id === assistantMsg.id
          ? { ...m,
              cards: newMessage.cards || [],
              confidence: newMessage.confidence,
              sources: newMessage.sources,
              modelUsed: newMessage.modelUsed,
              processingTime: newMessage.processingTime,
              trustMetrics: newMessage.trustMetrics,
            }
          : m
      ).slice(-30));

      // Persist cards to localStorage so they survive page reloads.
      if ((newMessage.cards as any[])?.length && assistantMsg.id && activeChat) {
        try {
          const lsKey = `lev:cards:${activeChat}`;
          const stored: Record<string, any[]> = JSON.parse(localStorage.getItem(lsKey) ?? '{}');
          stored[assistantMsg.id] = newMessage.cards as any[];
          // Keep at most 50 message entries per chat to avoid storage bloat
          const keys = Object.keys(stored);
          if (keys.length > 50) delete stored[keys[0]];
          localStorage.setItem(lsKey, JSON.stringify(stored));
        } catch { /* quota / security errors — silently skip */ }
      }

      // Persist both messages to Supabase (fire-and-forget).
      // Guard: only save when we have a real Supabase UUID — not a placeholder like
      // 'chat-1' or 'chat-{timestamp}'. If a thread creation is in-flight (pendingThreadRef),
      // await it; if there is no pending thread at all (first-ever message scenario),
      // create one on the fly.
      if (isLoggedIn) {
        const capturedChat = activeChat;
        const capturedMsg = newMessage;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(capturedChat);
        const resolveThreadId = async (): Promise<string | null> => {
          if (isUuid) return capturedChat;
          if (pendingThreadRef.current) {
            const created = await pendingThreadRef.current;
            return created?.id ?? null;
          }
          // First-ever message — no thread exists yet; create one now
          const category = selectedCategory === 'all' ? 'betting' : selectedCategory;
          const tags = [
            selectedCategory === 'all' ? 'multi-platform' : selectedCategory,
            ...(selectedSport ? [selectedSport] : []),
          ];
          const created = await createThread(category, userMessage.slice(0, 50), tags);
          if (created) {
            setChats((prev: any) => prev.map((c: any) => c.id === capturedChat ? { ...c, id: created.id, category, tags } : c));
            setActiveChat(created.id);
          }
          return created?.id ?? null;
        };
        const finalCategory = selectedCategory === 'all' ? 'betting' : selectedCategory;
        const finalTags = [
          selectedCategory === 'all' ? 'multi-platform' : selectedCategory,
          ...(selectedSport ? [selectedSport] : []),
        ];
        resolveThreadId().then(async (threadId) => {
          if (!threadId) return;
          const [, savedMsgId] = await saveMessagesBatch(threadId, [
            { role: 'user', content: userMessage },
            {
              role: 'assistant',
              content: capturedMsg.content,
              model_used: capturedMsg.modelUsed,
              confidence: capturedMsg.confidence,
              cards: (capturedMsg.cards as unknown[])?.length ? capturedMsg.cards as unknown[] : undefined,
            },
          ]);
          // Re-key cards in localStorage to use real DB IDs so they survive page reloads.
          // The early save above used client-side UUIDs (temp thread ID + streaming message ID).
          // Now we have the real Supabase-assigned IDs for both the thread and the message.
          const clientMsgId = capturedMsg.id;
          if (savedMsgId && (capturedMsg.cards as any[])?.length) {
            try {
              const oldKey = `lev:cards:${capturedChat}`;
              const newKey = `lev:cards:${threadId}`;
              let stored: Record<string, any[]> = JSON.parse(localStorage.getItem(oldKey) ?? '{}');
              if (oldKey !== newKey) {
                localStorage.removeItem(oldKey);
              }
              // Re-key message entry: client streaming UUID → server UUID
              if (stored[clientMsgId]?.length && clientMsgId !== savedMsgId) {
                stored[savedMsgId] = stored[clientMsgId];
                delete stored[clientMsgId];
              }
              const keys = Object.keys(stored);
              if (keys.length > 50) delete stored[keys[0]];
              localStorage.setItem(newKey, JSON.stringify(stored));
            } catch { /* quota / security errors — silently skip */ }
          }
          // Sync category + sport tags so sidebar always shows correct context
          updateThread(threadId, { category: finalCategory, tags: finalTags });
          setChats((prev: any) => prev.map((c: any) =>
            c.id === threadId ? { ...c, category: finalCategory, tags: finalTags } : c
          ));
        });
      }

      // Generate contextual suggestions — use clarificationOptions from API if ambiguous
      if (assistantMsg.clarificationOptions?.length) {
        setSuggestedPrompts(assistantMsg.clarificationOptions.map((o: string) => ({
          label: o,
          icon: Target,
          category: selectedCategory,
        })));
        setIsClarificationPills(true);
      } else {
        const contextualSuggestions = generateContextualSuggestions(userMessage, newMessage.cards || []);
        setSuggestedPrompts(contextualSuggestions);
        setIsClarificationPills(false);
      }

    } catch (error) {
      // AbortError is handled by the hook — this catch covers errors in context
      // building or odds fetching that occur before streamMessage() is called.
      if (error instanceof Error && error.name === 'AbortError') return;

      console.error('[v0] Error generating real response:', error);

      // Update placeholder in-place if present; otherwise append a new error message
      const errorContent = `I'm having trouble connecting to live data sources right now. Please try again in a moment.`;
      const errorMetadata = {
        cards: [],
        confidence: 50,
        sources: [{ name: 'Cached Data', type: 'cache' as const, reliability: 60 }],
        modelUsed: 'Fallback Mode',
        processingTime: Date.now() - startTime,
        trustMetrics: {
          benfordIntegrity: 50,
          oddsAlignment: 50,
          marketConsensus: 50,
          historicalAccuracy: 50,
          finalConfidence: 50,
          trustLevel: 'low' as const,
          riskLevel: 'high' as const,
          adjustedTone: 'Connection error — please retry',
          flags: [{ type: 'connectivity', message: 'Live data unavailable due to connectivity issue', severity: 'warning' as const }],
        },
      };
      setMessages((prev: Message[]) => {
        if (optimisticAssistantId && prev.some(m => m.id === optimisticAssistantId && (m.isPending || m.isStreaming))) {
          return prev.map(m => m.id === optimisticAssistantId
            ? { ...m, isPending: false, isStreaming: false, isError: true, content: errorContent, ...errorMetadata }
            : m);
        }
        return [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: errorContent,
          timestamp: new Date(),
          isError: true,
          ...errorMetadata,
        } as Message].slice(-30);
      });

      setSuggestedPrompts(generateContextualSuggestions(userMessage, []));
      setIsClarificationPills(false);
    } finally {
      setIsTyping(false);
      // Clear in-flight guard so the same message can be re-sent after completion.
      analyzingMessageRef.current = null;
    }
  };
  // Keep the ref current so the player-click event handler always calls the latest version
  generateRealResponseRef.current = generateRealResponse;

  // Sport detection helpers are imported from @/lib/sport-detection

  const selectRelevantCards = async (userMessage: string, context?: any): Promise<InsightCard[]> => {
    const isDev = getIsDev();
    const msgLower = userMessage.toLowerCase();

    // Extract sport and category from message - use conversation history from context if available
    const conversationHistory = context?.previousMessages || messages.slice(-5).map((m: any) => ({ role: m.role, content: m.content || '' }));
    const sport = extractSport(userMessage, conversationHistory);
    let category = 'all';

    if (msgLower.includes('bet') || msgLower.includes('odds')) {
      category = 'betting';
    } else if (msgLower.includes('dfs') || msgLower.includes('lineup')) {
      category = 'dfs';
    } else if (msgLower.includes('draft') || msgLower.includes('fantasy')) {
      category = 'fantasy';
    } else if (msgLower.includes('kalshi') || msgLower.includes('market')) {
      category = 'kalshi';
    } else if (msgLower.includes('prop') || msgLower.includes('strikeout')
            || msgLower.includes('player bet')) {
      category = 'props';
    }

    // Extract DraftKings draft group ID from prompts like "DraftKings #12345"
    const draftGroupIdMatch = userMessage.match(/DraftKings #(\d+)/i);
    const draftGroupId = draftGroupIdMatch ? parseInt(draftGroupIdMatch[1], 10) : undefined;

    if (isDev) console.log('[v0] Fetching dynamic cards for:', { sport, category, draftGroupId });

    try {
      if (isDev) console.log('[v0] Requesting dynamic cards with params:', { sport, category, context, limit: 7, draftGroupId });

      const dynamicCards = await fetchDynamicCards({
        sport: sport || undefined,
        category,
        userContext: context,
        limit: 7,
        draftGroupId,
      });

      if (isDev) console.log('[v0] Received dynamic cards response:', dynamicCards.length, 'cards');

      if (dynamicCards.length === 0) {
        if (isDev) {
          console.log('[v0] WARNING: Zero dynamic cards returned from API. Check:');
          console.log('[v0] - Sport extracted:', sport);
          console.log('[v0] - Category detected:', category);
          console.log('[v0] - API endpoint configured:', API_ENDPOINTS?.CARDS || 'undefined');
          console.log('[v0] - Context provided:', context);
        }
      } else if (dynamicCards.every((c: any) => c.realData === false || c.data?.realData === false)) {
        toast.info('Live data unavailable — showing AI estimates. Data will refresh shortly.');
      }

      // Convert DynamicCard to InsightCard format
      const convertedCards = dynamicCards.map(card => convertToInsightCard(card));

      if (isDev) console.log('[v0] Returning', convertedCards.length, 'converted insight cards');
      return convertedCards;
    } catch (error) {
      console.error('[v0] Error fetching dynamic cards:', error instanceof Error ? error.message : String(error));
      return [];
    }
  };

  const convertToInsightCard = (dynamicCard: DynamicCard): InsightCard => {
    
    // Validate required fields
    if (!dynamicCard || typeof dynamicCard !== 'object') {
      console.error('[v0] Invalid card: not an object', dynamicCard);
      throw new Error('Invalid card data: must be an object');
    }
    
    if (!dynamicCard.type || !dynamicCard.title) {
      console.error('[v0] Invalid card: missing required fields', dynamicCard);
      throw new Error('Invalid card data: missing type or title');
    }
    
    // Map icon string to actual icon component
    const iconMap: Record<string, any> = {
      'Zap': Zap,
      'Target': Target,
      'Award': Award,
      'DollarSign': DollarSign,
      'TrendingUp': TrendingUp,
      'Medal': Medal,
      'ShoppingCart': ShoppingCart,
      'BarChart3': BarChart3,
      'Activity': Activity,
      'Sparkles': Sparkles
    };
    
    // Ensure all required fields have valid values
    const validatedCard: InsightCard = {
      type: String(dynamicCard.type || 'unknown'),
      title: String(dynamicCard.title || 'Untitled Card'),
      icon: iconMap[dynamicCard.icon] || Zap,
      category: String(dynamicCard.category || 'General'),
      subcategory: String(dynamicCard.subcategory || 'Info'),
      gradient: String(dynamicCard.gradient || 'from-blue-500 to-purple-500'),
      data: dynamicCard.data && typeof dynamicCard.data === 'object' ? dynamicCard.data : {},
      status: String(dynamicCard.status || 'active')
    };
    
    return validatedCard;
  };

  const buildSourcesList = (oddsData: APIResponse<OddsEvent[]> | null): Array<{ name: string; type: 'database' | 'api' | 'model' | 'cache'; reliability: number; url?: string }> => {
    const sources: Array<{ name: string; type: 'database' | 'api' | 'model' | 'cache'; reliability: number; url?: string }> = [
      { name: 'Grok AI Model', type: 'model' as const, reliability: 94 },
      { name: 'Supabase Trust System', type: 'database' as const, reliability: 96 }
    ];
    
    if (oddsData?.success && oddsData.data) {
      sources.push({
        name: 'The Odds API (Live)',
        type: 'api' as const,
        reliability: 98,
        url: 'https://the-odds-api.com'
      });
    }
    
    return sources;
  };



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
      {serverData?.missingKeys && serverData.missingKeys.length > 0 && (
        <div className="absolute top-0 left-0 right-0 bg-amber-600/90 backdrop-blur-sm border-b border-amber-500/50 px-4 py-2 z-50 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-white flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold">Missing API Keys:</span> {serverData.missingKeys.join(', ')}. Some features may not work properly.
          </div>
          <a 
            href="/admin/setup" 
            className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md transition-colors whitespace-nowrap"
          >
            Configure →
          </a>
        </div>
      )}
      
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

        {/* Messages Container - Dynamic Data-Driven Interface */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 py-6 custom-scrollbar scroll-smooth"
          aria-live="polite"
          aria-label="Conversation"
          role="log"
          style={{
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="max-w-5xl xl:max-w-6xl mx-auto space-y-6">
            {/* Database Status Banner */}
            <DatabaseStatusBanner />
            {/* Kalshi sports-query banner */}
            {kalshiBettingBannerVisible && (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/25 text-amber-300 text-[11px] font-semibold">
                <span className="shrink-0">⚠️</span>
                <span>Showing Kalshi prediction markets. For live sportsbook odds, switch to the <strong>Betting</strong> tab.</span>
                <button onClick={() => setKalshiBettingBannerVisible(false)} className="ml-auto text-amber-400/60 hover:text-amber-300 text-xs">✕</button>
              </div>
            )}
            {messages.length === 0 ? (
              <WelcomeScreen onPromptSelect={(q) => generateRealResponse(q)} />
            ) : (
              messages.map((message: any, index: any) => {
                // Group messages: Check if this message is from same sender as previous
                const prevMessage = index > 0 ? messages[index - 1] : null;
                const isGrouped = prevMessage && prevMessage.role === message.role;
                const _showTimestamp = !isGrouped || index === messages.length - 1;
                
                return (
                  <div
                    key={message.id ?? `msg-${index}`}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn ${isGrouped ? 'mt-1.5' : 'mt-5'}`}
                  >
                    <div className={message.role === 'user' ? 'max-w-[85%] md:max-w-[75%]' : 'w-full max-w-4xl lg:max-w-3xl'}>
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
                      {/* Logo mark */}
                      <div className="relative w-7 h-7 shrink-0" role="img" aria-label="Leverage AI">
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 opacity-20 blur-sm" />
                        <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                          <TrendingUp className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                        </div>
                      </div>
                      <span className="text-xs font-black tracking-tight text-white">Leverage<span className="text-blue-400"> AI</span></span>

                      {/* Verified badge */}
                      {message.sources && message.sources.length > 0 && !message.isWelcome && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md">
                          <CheckCheck className="w-2.5 h-2.5 text-blue-400" />
                          <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">Live Data</span>
                        </div>
                      )}

                    </div>
                  )}
                  
                  <div
                    className={`relative group/message ${
                      message.role === 'user'
                        ? 'rounded-2xl rounded-tr-sm px-5 py-3.5 bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/25 w-fit max-w-[85%] ml-auto'
                        : message.isError
                          ? 'rounded-2xl rounded-tl-sm px-5 py-4 bg-red-950/20 text-foreground border border-red-800/40 border-l-2 border-l-red-500/60 shadow-lg shadow-black/30'
                          : message.isPartial
                            ? 'rounded-2xl rounded-tl-sm px-5 py-4 bg-gradient-to-br from-[var(--bg-overlay)] via-[var(--bg-elevated)]/50 to-[var(--bg-overlay)] text-foreground border border-[var(--border-subtle)] border-l-2 border-l-amber-500/60 shadow-lg shadow-black/30'
                            : 'rounded-2xl rounded-tl-sm px-5 py-4 bg-gradient-to-br from-[var(--bg-overlay)] via-[var(--bg-elevated)]/50 to-[var(--bg-overlay)] text-foreground border border-[var(--border-subtle)] shadow-lg shadow-black/30'
                    }`}
                  >
                    {editingMessageIndex === index ? (
                      <div className="space-y-3">
              <textarea
                ref={editTextareaRef}
                value={editingContent}
                onChange={(e: any) => {
                  setEditingContent(e.target.value);
                  adjustEditTextareaHeight();
                }}
                onKeyDown={handleKeyDown}
                placeholder={selectedCategory === 'all' ? "Ask about sports betting, fantasy, DFS, or prediction markets..." : 
                             selectedCategory === 'betting' ? "e.g. 'Best value plays for tonight's games'" :
                             selectedCategory === 'fantasy' ? "e.g. 'NFBC draft strategy for pick 3'" :
                             selectedCategory === 'dfs' ? "e.g. 'Optimal GPP stack for tonight'" :
                             "e.g. 'Weather-correlated Kalshi markets'"}
                className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-[13px] leading-relaxed resize-none min-h-[44px] max-h-[200px] pr-2"
                rows={1}
                disabled={isTyping}
              />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveEdit(index)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Save & Regenerate
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)] text-white rounded-lg text-xs font-bold transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Loading skeleton — shown while waiting for API response */}
                        {message.role === 'assistant' && message.isPending && (
                          <div className="space-y-2.5 py-1" aria-label="Loading response" aria-busy="true">
                            <div className="h-2.5 w-48 rounded-full bg-white/10 animate-pulse" />
                            <div className="h-2.5 w-64 rounded-full bg-white/10 animate-pulse [animation-delay:150ms]" />
                            <div className="h-2.5 w-36 rounded-full bg-white/10 animate-pulse [animation-delay:300ms]" />
                          </div>
                        )}
                        {/* Error / partial banners for assistant messages */}
                        {message.role === 'assistant' && message.isError && (
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-800/30">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span className="text-xs text-red-400 font-medium">Response failed</span>
                          </div>
                        )}
                        {message.role === 'assistant' && message.isPartial && (
                          <div className="flex items-center gap-2 mb-2">
                            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs text-amber-400">Partial response</span>
                          </div>
                        )}
                        {/* Check if this is a detailed analysis with structured data */}
                        {!message.isPending && (message.content.includes('__DETAILED_ANALYSIS__') ? (
                          (() => {
                            const match = message.content.match(/__DETAILED_ANALYSIS__([\s\S]+)__END_ANALYSIS__/);
                            if (!match) return <p className="text-sm leading-relaxed font-medium">{message.content}</p>;
                            let analysisData: DetailedAnalysisData;
                            try {
                              analysisData = JSON.parse(match[1]);
                            } catch {
                              return <p className="text-sm leading-relaxed font-medium">{message.content.replace(/__DETAILED_ANALYSIS__[\s\S]*?__END_ANALYSIS__/, '').trim()}</p>;
                            }
                            return (
                              <DetailedAnalysisLayout
                                data={analysisData}
                                isTyping={isTyping}
                                onFollowUp={handleFollowUp}
                              />
                            );
                          })()
                        ) : (
                          <div className={(!message.isPending && message.isStreaming) ? 'content-streaming' : undefined}>
                            <MessageContent content={message.content} />
                          </div>
                        ))}
                        
                        {/* File Attachments Display */}
                        <MessageAttachments attachments={message.attachments} />
                        
                        {message.editHistory && message.editHistory.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                            <details className="text-xs text-[var(--text-faint)]">
                              <summary className="cursor-pointer hover:text-[var(--text-muted)] flex items-center gap-1.5">
                                <RotateCcw className="w-3 h-3" />
                                Edited {message.editHistory.length} time{message.editHistory.length !== 1 ? 's' : ''}
                              </summary>
                            </details>
                          </div>
                        )}
                      </>
                    )}
                  </div>



                  {/* Dynamic Cards Section — Hero + Compact Suggestions layout */}
                  {message.role === 'assistant' && message.cards && message.cards.length > 0 && (
                    <CardLayout
                      cards={message.cards}
                      aiInsight={message.content}
                      messageIndex={index}
                      trustScore={message.trustMetrics?.finalConfidence}
                      trustLevel={message.trustMetrics?.trustLevel}
                      onAsk={(q: string) => generateRealResponse(q)}
                    />
                  )}

                  {/* Combined Metadata: Source Credibility & AI Trust - Hidden for welcome message */}
                  {message.role === 'assistant' && !message.isWelcome && (message.sources || message.trustMetrics) && (
                    <div className="mt-3 md:ml-11">
                      {/* Compact Metadata Summary */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-faint)]">
                        {message.modelUsed && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-purple-500/60 shrink-0" />
                            <span>Model: <span className="text-[var(--text-faint)] font-semibold">{message.modelUsed.replace('grok-3-fast', 'Grok 3 Fast').replace('grok-4', 'Grok 3 Fast').replace('Grok 4', 'Grok 3 Fast')}</span></span>
                          </span>
                        )}
                        {message.processingTime && (
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-yellow-500/60 shrink-0" />
                            <span>Processed in: <span className="text-[var(--text-faint)] font-semibold tabular-nums">{message.processingTime}ms</span></span>
                          </span>
                        )}
                      </div>

                      {/* Single collapsible: Sources & Trust combined */}
                      {(message.sources?.length || message.trustMetrics) && (
                        <details className="mt-2 group/trust">
                          <summary className="cursor-pointer list-none flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors">
                            <Shield className={`w-3.5 h-3.5 shrink-0 ${
                              message.trustMetrics?.trustLevel === 'high' ? 'text-blue-500/70' :
                              message.trustMetrics?.trustLevel === 'medium' ? 'text-yellow-500/70' :
                              'text-blue-500/60'
                            }`} />
                            <span className="font-semibold uppercase tracking-wide">Sources & Trust</span>
                            {message.trustMetrics && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                message.trustMetrics.trustLevel === 'high' ? 'bg-blue-600/20 text-blue-400' :
                                message.trustMetrics.trustLevel === 'medium' ? 'bg-yellow-600/20 text-yellow-400' :
                                'bg-red-600/20 text-red-400'
                              }`}>
                                {message.trustMetrics.finalConfidence}%
                              </span>
                            )}
                            {message.sources?.length ? (
                              <span className="text-[var(--text-faint)]">· {message.sources.length} sources</span>
                            ) : null}
                            {message.trustMetrics?.hasLiveOdds && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-500/80">LIVE</span>
                            )}
                            <ChevronRight className="w-3 h-3 group-open/trust:rotate-90 transition-transform shrink-0" />
                          </summary>
                          <div className="mt-2 space-y-2">
                            {message.sources && message.sources.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {message.sources.map((source: any, idx: any) => {
                                  const reliabilityColor = source.reliability >= 90 ? 'text-blue-500 border-blue-600/20' : 'text-yellow-500 border-yellow-600/20';
                                  const Icon = source.type === 'database' ? Database : source.type === 'api' ? Activity : source.type === 'model' ? Sparkles : RefreshCw;
                                  return (
                                    <div key={source.name ?? `src-${idx}`} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-[var(--bg-overlay)] ${reliabilityColor} text-[11px]`} title={`${source.name} - ${source.reliability}% reliability`}>
                                      <Icon className="w-3 h-3" />
                                      <span className="font-semibold">{source.name}</span>
                                      <span className="font-bold tabular-nums">{source.reliability}%</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {message.trustMetrics && (
                              <TrustMetricsDisplay
                                metrics={{
                                  ...message.trustMetrics,
                                  sources: message.trustMetrics.sources || message.sources,
                                  modelUsed: message.trustMetrics.modelUsed || message.modelUsed || 'Grok 4',
                                  processingTime: message.trustMetrics.processingTime || message.processingTime,
                                }}
                              />
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  )}


                  {/* Message Actions - Hidden for welcome message */}
                  {!message.isWelcome && (
                    <div className={`flex items-center flex-nowrap gap-0.5 mt-2 ${message.role === 'assistant' ? 'ml-11' : ''}`}>
                      {message.role === 'user' && editingMessageIndex !== index && (
                        <button
                          onClick={() => handleEditMessage(index)}
                          className={`p-1.5 rounded-lg transition-all group/action border border-transparent hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)]`}
                          title="Edit this message"
                          aria-label="Edit message"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[var(--text-faint)] group-hover/action:text-blue-400 transition-colors" />
                        </button>
                      )}
                      {message.role === 'assistant' && (
                        <>
                          <button
                            onClick={() => message.voted !== 'up' && handleVote(index, 'up')}
                            className={`p-1.5 rounded-lg transition-all group/action border ${
                              message.voted === 'up'
                                ? 'bg-blue-500/15 border-blue-500/40 cursor-default'
                                : 'hover:bg-blue-500/10 active:bg-blue-500/20 border-transparent hover:border-blue-500/30'
                            }`}
                            title="This response was helpful"
                            aria-label="Mark as helpful"
                          >
                            <ThumbsUp className={`w-3.5 h-3.5 transition-colors ${message.voted === 'up' ? 'text-blue-400 fill-blue-400/30' : 'text-[var(--text-faint)] group-hover/action:text-blue-400'}`} />
                          </button>
                          <button
                            onClick={() => message.voted !== 'down' && handleVote(index, 'down')}
                            className={`p-1.5 rounded-lg transition-all group/action border ${
                              message.voted === 'down'
                                ? 'bg-red-500/15 border-red-500/40 cursor-default'
                                : 'hover:bg-red-500/10 active:bg-red-500/20 border-transparent hover:border-red-500/30'
                            }`}
                            title="This response needs improvement"
                            aria-label="Mark as needing improvement"
                          >
                            <ThumbsDown className={`w-3.5 h-3.5 transition-colors ${message.voted === 'down' ? 'text-red-400 fill-red-400/30' : 'text-[var(--text-faint)] group-hover/action:text-red-400'}`} />
                          </button>
                          <button
                            onClick={() => handleRegenerateResponse(index)}
                            className={`flex items-center gap-1 p-1.5 rounded-lg transition-all group/action border ${
                              message.isError
                                ? 'text-red-400 bg-red-950/30 border-red-800/40 hover:bg-red-900/40'
                                : message.isPartial
                                  ? 'text-amber-400 bg-amber-950/30 border-amber-800/40 hover:bg-amber-900/40'
                                  : 'hover:bg-purple-500/10 active:bg-purple-500/20 border-transparent hover:border-purple-500/30'
                            }`}
                            title="Regenerate this response"
                            aria-label="Regenerate response"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 transition-colors ${
                              message.isError ? 'text-red-400' : message.isPartial ? 'text-amber-400' : 'text-[var(--text-faint)] group-hover/action:text-purple-400'
                            }`} />
                            {(message.isError || message.isPartial) && (
                              <span className="text-[11px] font-medium">Retry</span>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              if (speakingMessageId === message.id) {
                                stopVoice();
                                setSpeakingMessageId(null);
                              } else {
                                const cards = (message as any).cards;
                                const text = message.content + (cards?.length ? '\n\n' + cardsToSpeech(cards) : '');
                                const voice_id = typeof window !== 'undefined'
                                  ? (localStorage.getItem(GROK_VOICE_STORAGE_KEY) ?? GROK_VOICE_DEFAULT)
                                  : GROK_VOICE_DEFAULT;
                                setSpeakingMessageId(message.id);
                                speakText(text, {
                                  voice_id,
                                  onEnd: () => setSpeakingMessageId(null),
                                });
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-all group/action border ${
                              speakingMessageId === message.id
                                ? 'bg-blue-500/15 border-blue-500/40 text-blue-400 animate-pulse'
                                : 'hover:bg-blue-500/10 active:bg-blue-500/20 border-transparent hover:border-blue-500/30'
                            }`}
                            title={speakingMessageId === message.id ? 'Stop speaking' : 'Read aloud'}
                            aria-label={speakingMessageId === message.id ? 'Stop speaking' : 'Read aloud'}
                          >
                            <Volume2 className={`w-3.5 h-3.5 transition-colors ${speakingMessageId === message.id ? 'text-blue-400' : 'text-[var(--text-faint)] group-hover/action:text-blue-400'}`} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleCopyMessage(message.content)}
                        className="p-1.5 rounded-lg hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-all group/action border border-transparent hover:border-cyan-500/30"
                        title="Copy message to clipboard"
                        aria-label="Copy message"
                      >
                        <Copy className="w-3.5 h-3.5 text-[var(--text-faint)] group-hover/action:text-cyan-400 transition-colors" />
                      </button>
                      <div className="ml-auto flex items-center gap-1 px-2 py-1 bg-[var(--bg-overlay)] rounded-md border border-[var(--border-subtle)]">
                        <Clock className="w-3 h-3 text-[var(--text-faint)]" />
                        <span suppressHydrationWarning className="text-[10px] font-medium text-[var(--text-faint)] tabular-nums">{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  )}
                    </div>
                  </div>
                );
          })
        )}

      {isTyping && !messages.some((m: Message) => m.isPending || m.isStreaming) && (
        <div className="flex gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/50 animate-pulse">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="bg-gradient-to-br from-[var(--bg-overlay)] to-[var(--bg-overlay)] backdrop-blur-xl rounded-2xl px-5 py-4 border border-[var(--border-subtle)] shadow-2xl">
              <AIProgressIndicator stage={verifyStage} />
            </div>
          </div>
        </div>
      )}
            
          </div>
        </div>

        {/* Input Area */}
        <div className="relative border-t border-[var(--border-subtle)] bg-gradient-to-b from-background to-black px-4 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-t from-blue-600/5 via-transparent to-transparent pointer-events-none"></div>
          
          {/* Rate Limit Notification */}
          {showLimitNotification && (
            <div className="relative max-w-5xl xl:max-w-6xl mx-auto mb-4">
              <div className="bg-gradient-to-r from-orange-500/10 via-red-500/10 to-orange-500/10 border border-orange-500/30 rounded-2xl p-4 backdrop-blur-sm shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-orange-500/20 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-white mb-1">
                        Chat Limit Reached
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed" suppressHydrationWarning>
                        You've reached your limit of {FREE_TIER.CHAT_LIMIT} chats per 24 hours. Your limit will reset in{' '}
                        {Math.ceil((getRateLimitData().resetTime - Date.now()) / (1000 * 60 * 60))} hours.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLimitNotification(false)}
                    className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg transition-all"
                    aria-label="Close notification"
                  >
                    <X className="w-4 h-4 text-[var(--text-faint)] hover:text-foreground/80" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="relative max-w-5xl xl:max-w-6xl mx-auto">
            {/* Fantasy League Setup Flow — shown when Fantasy is selected and no league is configured */}
            {selectedCategory === 'fantasy' && !fantasyLeague?.setupComplete && (
              <FantasyLeagueSetup
                fantasySetupData={fantasySetupData}
                fantasySetupStep={fantasySetupStep}
                setFantasySetupData={setFantasySetupData as any}
                setFantasySetupStep={setFantasySetupStep as any}
                isLoggedIn={isLoggedIn}
                onSave={(league) => {
                  setFantasyLeague(league);
                  setFantasySetupStep(0);
                  setFantasySetupData({ sport: 'nfl', platform: 'espn', teams: 12, leagueType: 'ppr' });
                }}
              />
            )}
            {/* Show configured league context + reset button */}
            {selectedCategory === 'fantasy' && fantasyLeague?.setupComplete && isLoggedIn && (
              <div className="mb-3 flex items-center gap-2 px-1">
                <Trophy className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[11px] font-bold text-violet-400">{fantasyLeague.teamName}</span>
                <span className="text-[10px] text-[var(--text-faint)]">
                  {fantasyLeague.sport?.toUpperCase()} · {fantasyLeague.platform?.toUpperCase()} · {fantasyLeague.teams} teams · {fantasyLeague.leagueType ?? fantasyLeague.scoring}
                </span>
                <button onClick={() => { setFantasyLeague(null); localStorage.removeItem('leverage_fantasy_league'); }} className="ml-auto text-[10px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors">Edit league</button>
              </div>
            )}
            {/* Suggested Prompts — welcome grid + scrollable pills */}
            <SuggestedPrompts
              showWelcomeGrid={messages.length === 1 && !!messages[0]?.isWelcome && suggestedPrompts.length === 0 && selectedCategory === 'all'}
              onWelcomeAction={(query) => {
                const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: query, timestamp: new Date() };
                setMessages((prev: Message[]) => [...prev, userMessage]);
                setInput('');
                generateRealResponse(query);
              }}
              onCategorySelect={handleCategorySelect}
              suggestedPrompts={suggestedPrompts}
              quickActions={quickActions}
              hasMessages={messages.length > 1}
              lastUserQuery={lastUserQuery}
              selectedCategory={selectedCategory}
              selectedSport={selectedSport}
              clarificationMode={isClarificationPills}
              onPromptClick={(submitText) => {
                // Do NOT set input before the async path — it briefly populates the
                // textarea and opens a race window where Enter or a double-click fires
                // handleSubmit concurrently, adding the message twice.
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
            />

            {/* Desktop Chat Input */}
            <ChatInput
              input={input}
              onInputChange={setInput}
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
              deepThink={deepThink}
              onToggleDeepThink={handleToggleDeepThink}
              systemStatus={systemStatus}
              voiceConvState={voiceConv.convState}
              voiceConvSupported={voiceConv.isSupported}
              onActivateVoice={voiceConv.activate}
              lastAssistantMessage={[...messages].reverse().find((m: any) => m.role === 'assistant')?.content as string | undefined}
            />
          </div>
        </div>
      </div>

      {/* Credit Modals */}
      <CreditModals
        showPurchase={showPurchaseModal}
        purchaseAmount={purchaseAmount}
        setPurchaseAmount={setPurchaseAmount}
        onClosePurchase={() => setShowPurchaseModal(false)}
        onStripeCheckout={() => setShowStripeLightbox(true)}
        onLogin={() => setShowLoginModal(true)}
        showSubscription={showSubscriptionModal}
        onCloseSubscription={() => setShowSubscriptionModal(false)}
        onStripeSubscription={() => setShowStripeLightbox(true)}
      />

      {/* Auth Modals - extracted to separate component */}
      <AuthModals
        showLoginModal={showLoginModal}
        showSignupModal={showSignupModal}
        setShowLoginModal={setShowLoginModal}
        setShowSignupModal={setShowSignupModal}
        setIsLoggedIn={setIsLoggedIn}
        setUser={setUser}
      />

      {/* User Lightbox */}
      <UserLightbox
        isOpen={showUserLightbox}
        onClose={() => setShowUserLightbox(false)}
        user={user}
        onLogout={() => { setUser(null); setIsLoggedIn(false); setFantasyLeague(null); localStorage.removeItem('leverage_fantasy_league'); }}
        onInstructionsChange={setCustomInstructions}
        onAttachFile={(file: any) => setUploadedFiles((prev: any) => [...prev, { ...file, url: '' }])}
      />

      {/* Settings Lightbox */}
      <SettingsLightbox
        isOpen={showSettingsLightbox}
        onClose={() => setShowSettingsLightbox(false)}
        user={user}
        onUserUpdate={setUser}
        onOpenStripe={handleOpenStripe}
        creditsRemaining={creditsRemaining}
      />

      {/* Alerts Lightbox */}
      <AlertsLightbox
        isOpen={showAlertsLightbox}
        onClose={() => setShowAlertsLightbox(false)}
        onAlertsCountChange={setAlertCount}
      />

      {/* Watchlist Lightbox */}
      <WatchlistLightbox
        isOpen={showWatchlistLightbox}
        onClose={() => setShowWatchlistLightbox(false)}
        onPlayerClick={handleSavedPlayerClick}
        onCardClick={handleSavedCardClick}
      />

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        chats={chats}
        activeChat={activeChat}
        onSelectChat={(id) => { handleSelectChat(id); setSidebarOpen(false); }}
        onNewChat={() => { handleNewChat(); setSidebarOpen(false); }}
        onOpenSettings={() => setShowSettingsLightbox(true)}
      />

      {/* Stripe Purchase Lightbox */}
      <StripeLightbox
        isOpen={showStripeLightbox}
        onClose={() => setShowStripeLightbox(false)}
        onCreditsAdded={addCredits}
        creditsRemaining={creditsRemaining}
        userEmail={user?.email}
      />

      {/* Voice Conversation Overlay */}
      {voiceConv.isActive && (
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
      )}

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          .animate-fadeIn {
            animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .animate-pulse-slow {
            animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(17, 24, 39, 0.3);
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(75, 85, 99, 0.5);
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(107, 114, 128, 0.7);
          }
        `}
      </style>
    </div>
  );
}
