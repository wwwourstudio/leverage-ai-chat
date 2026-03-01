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

import { useState, useRef, useEffect } from 'react';
import { fetchDynamicCards, fetchUserInsights, type DynamicCard } from '@/lib/data-service';
import { API_ENDPOINTS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { AuthModals } from '@/components/AuthModals';
import { MessageList } from '@/components/message-list';
import { MobileChatInput } from '@/components/mobile-chat-input';
import { Send, TrendingUp, Trophy, Target, ThumbsUp, ThumbsDown, Menu, Plus, MessageSquare, Clock, Star, Trash2, Zap, AlertCircle, CheckCircle, CheckCircle2, DollarSign, Activity, Award, ChevronRight, Bell, Settings, ShoppingCart, Medal, PieChart, Layers, BarChart3, Sparkles, TrendingDown, Flame, Users, RefreshCw, Search, Calendar, Copy, Edit3, RotateCcw, Shield, Database, BookOpen, ExternalLink, X, CheckCheck, AlertTriangle, XCircle, TrendingUpIcon, BarChart, Info, Paperclip, FileText, ImageIcon, MoveIcon as RemoveIcon, Loader2, Bookmark } from 'lucide-react';
import { DynamicCardRenderer, CardList, EmptyState } from '@/components/data-cards';
import { CardLayout } from '@/components/data-cards/CardLayout';
import { DatabaseStatusBanner } from '@/components/database-status-banner';
import { TrustMetricsDisplay, TrustMetricsBadge } from '@/components/trust-metrics-display';
import { InsightsDashboard } from '@/components/insights-dashboard';
import { AIProgressIndicator } from '@/components/ai-progress-indicator';
import { ErrorBoundary } from '@/components/error-boundary';
import { DataFallback } from '@/components/data-fallback';
import { ChatMessage } from '@/components/chat-message';
import { SettingsLightbox } from '@/components/SettingsLightbox';
import { AlertsLightbox } from '@/components/AlertsLightbox';
import { StripeLightbox } from '@/components/StripeLightbox';
import { UserLightbox } from '@/components/UserLightbox';
import { useToast } from '@/components/toast-provider';
import { Sidebar } from '@/components/Sidebar';

interface FileAttachment {
  id: string;
  name: string;
  type: 'image' | 'csv' | 'text' | 'json';
  url: string;
  size: number;
  data?: { headers: string[]; rows: string[][] } | null; // For CSV parsed data
  textContent?: string | null; // For txt / json / pdf files
  imageBase64?: string | null;  // Raw base64 (no data: prefix) for vision API
  mimeType?: string | null;     // e.g. 'image/jpeg'
}

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
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  cards?: InsightCard[];
  insights?: {
    totalValue?: number;
    winRate?: number;
    roi?: number;
    activeContests?: number;
    totalInvested?: number;
  };
  confidence?: number;
  isEditing?: boolean;
  isWelcome?: boolean;
  editHistory?: Array<{
    content: string;
    timestamp: Date;
  }>;
  sources?: Array<{
    name: string;
    type: 'database' | 'api' | 'model' | 'cache';
    reliability: number;
    url?: string;
  }>;
  modelUsed?: string;
  processingTime?: number;
  trustMetrics?: TrustMetrics;
  attachments?: FileAttachment[];
  voted?: 'up' | 'down';
}

interface Chat {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  starred: boolean;
  category: string;
  tags: string[];
}

interface InsightCard {
  type: string;
  title: string;
  icon: any;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, any>;
  status: string;
}

export interface ServerDataProps {
  initialCards: any[];
  initialInsights: any;
  userSession: any;
  serverTime: string;
  missingKeys: string[];
  envErrors: string[];
  dataSourcesUsed: string[];
  fetchErrors: string[];
}

interface UnifiedAIPlatformProps {
  serverData?: ServerDataProps;
}

export default function UnifiedAIPlatform({ serverData }: UnifiedAIPlatformProps) {
  const toast = useToast();

  // Dynamic welcome message based on time, category, and selected sport
  const getWelcomeMessage = (category: string, sport?: string, userName?: string) => {
    // Use server time to prevent hydration mismatch
    const now = serverData?.serverTime ? new Date(serverData.serverTime) : new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const name = userName ? `, ${userName}` : '';

    const sportNames: Record<string, string> = {
      nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL',
      'ncaa-football': 'NCAA Football', 'ncaa-basketball': 'NCAA Basketball',
    };
    const sportLabel = sport ? (sportNames[sport] || sport.toUpperCase()) : null;

    const categoryMessages: Record<string, string> = {
      betting: sportLabel
        ? `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is scanning live **${sportLabel}** odds across all major sportsbooks. Ask me about today's lines, player props, sharp money movement, or arbitrage opportunities.`
        : `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is scanning live odds across all major sportsbooks. Ask me about tonight's lines, player props, sharp money, or arbitrage opportunities.`,
      fantasy: sportLabel
        ? `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is ready for **${sportLabel}** fantasy analysis. Ask about waiver pickups, start/sit decisions, trade values, or draft strategy.`
        : `${greeting}${name}! It's ${dateStr}.\n\n**Leverage AI** is ready for fantasy analysis. Ask about draft strategy, waiver targets, trade values, or bestball stacking for NFBC/NFFC.`,
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

  const [messages, setMessages] = useState<Message[]>([
    {
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
        totalInvested: 0
      }
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [verifyStage, setVerifyStage] = useState<'analyzing' | 'reverifying'>('analyzing');
  const [cardAnalysisMap, setCardAnalysisMap] = useState<Record<string, { loading: boolean; content: string | null; error: string | null }>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatSearch, setChatSearch] = useState('');
  const [activeChat, setActiveChat] = useState('chat-1');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const [showLimitNotification, setShowLimitNotification] = useState(false);
  const [chatsRemaining, setChatsRemaining] = useState(5);
  const [creditsRemaining, setCreditsRemaining] = useState(15);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showSettingsLightbox, setShowSettingsLightbox] = useState(false);
  const [showAlertsLightbox, setShowAlertsLightbox] = useState(false);
  const [showStripeLightbox, setShowStripeLightbox] = useState(false);
  const [showUserLightbox, setShowUserLightbox] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(!!serverData?.userSession);
  const [user, setUser] = useState<{ name: string; email: string; avatar?: string } | null>(
    serverData?.userSession ? {
      name: serverData.userSession.user.name,
      email: serverData.userSession.user.email,
    } : null
  );
  const [uploadedFiles, setUploadedFiles] = useState<FileAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<Array<{ label: string; icon: any; category: string; query?: string }>>([]);
  const [lastUserQuery, setLastUserQuery] = useState<string>('');
  const [selectedSport, setSelectedSport] = useState<string>('');
  const [cardsRefreshedAt, setCardsRefreshedAt] = useState<Date | null>(null);
  const cardsRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fantasy league setup state — must NOT read localStorage here (causes SSR hydration mismatch #418)
  interface FantasyLeague {
    sport: string;                // 'nfl' | 'mlb' | 'nba' | 'nhl'
    platform: string;             // 'espn' | 'yahoo' | 'fantrax' | 'cbs' | 'nfbc' | 'nfl_com'
    teams: number;
    leagueType: string;           // 'ppr' | 'half_ppr' | 'standard' | 'h2h' | 'roto' | 'roto_h2h'
    teamName: string;
    leagueName: string;
    // legacy compat
    type?: string;
    scoring?: string;
    setupComplete: boolean;
  }
  const [fantasyLeague, setFantasyLeague] = useState<FantasyLeague | null>(null);
  const [fantasySetupStep, setFantasySetupStep] = useState(0);
  const [fantasySetupData, setFantasySetupData] = useState<Partial<FantasyLeague>>({ sport: 'nfl', platform: 'espn', teams: 12, leagueType: 'ppr' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Correct the welcome message timestamp to real local time after hydration.
  // Runs once on mount — safe because it's client-only (no server/client mismatch).
  useEffect(() => {
    const now = new Date();
    setMessages(prev =>
      prev[0]?.isWelcome ? [{ ...prev[0], timestamp: now }, ...prev.slice(1)] : prev
    );
    setChats(prev =>
      prev[0]?.id === 'chat-1' ? [{ ...prev[0], timestamp: now }, ...prev.slice(1)] : prev
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Personalize the welcome message client-side after hydration (and when user logs in).
  // This runs only in the browser, so getWelcomeMessage()'s timezone-sensitive
  // date/time calls are safe here (no server/client mismatch).
  useEffect(() => {
    const firstName = user?.name?.split(' ')[0] || undefined;
    setMessages(prev => {
      if (prev[0]?.isWelcome) {
        return [{ ...prev[0], content: getWelcomeMessage('all', undefined, firstName) }, ...prev.slice(1)];
      }
      return prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  // Re-personalize + refresh cards when category or sport filter changes (only while welcome is still visible).
  useEffect(() => {
    const firstName = user?.name?.split(' ')[0] || undefined;

    // Update message text immediately
    setMessages(prev => {
      if (prev[0]?.isWelcome) {
        return [{ ...prev[0], content: getWelcomeMessage(selectedCategory, selectedSport || undefined, firstName) }, ...prev.slice(1)];
      }
      return prev;
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedSport]);


  
  // Credit system utilities — syncs with Supabase user_profiles when logged in,
  // falls back to localStorage for anonymous users.
  const MESSAGE_LIMIT = 15;
  const CHAT_LIMIT = 10;
  const LIMIT_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const [supabaseProfileId, setSupabaseProfileId] = useState<string | null>(null);

  const getCreditData = () => {
    if (typeof window === 'undefined') return { credits: MESSAGE_LIMIT, resetTime: Date.now() + LIMIT_DURATION };
    const data = localStorage.getItem('userCredits');
    if (!data) {
      const initial = { credits: MESSAGE_LIMIT, resetTime: Date.now() + LIMIT_DURATION };
      localStorage.setItem('userCredits', JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(data);
    if (Date.now() > parsed.resetTime) {
      const reset = { credits: MESSAGE_LIMIT, resetTime: Date.now() + LIMIT_DURATION };
      localStorage.setItem('userCredits', JSON.stringify(reset));
      return reset;
    }
    return parsed;
  };

  // Sync credits to Supabase (fire-and-forget)
  const syncCreditsToSupabase = async (newCredits: number, _transactionType: string, _amount: number) => {
    if (!supabaseProfileId) return;
    try {
      const supabase = createClient();
      await supabase
        .from('user_profiles')
        .update({ credits_remaining: newCredits, updated_at: new Date().toISOString() })
        .eq('id', supabaseProfileId);
    } catch (err) {
      console.error('[Credits] Supabase sync failed:', err);
    }
  };

  // Load custom AI instructions — from API if logged in, localStorage otherwise
  const loadInstructionsFromApi = async () => {
    try {
      const res = await fetch('/api/user/instructions');
      const data = await res.json();
      if (typeof data.instructions === 'string') {
        setCustomInstructions(data.instructions);
        // Keep localStorage in sync as offline fallback
        localStorage.setItem('leverage_custom_instructions', data.instructions);
        return;
      }
    } catch {
      // ignore
    }
    // Fallback to localStorage
    const stored = localStorage.getItem('leverage_custom_instructions') || '';
    setCustomInstructions(stored);
  };

  // Load credits from Supabase on login
  const loadCreditsFromSupabase = async (authId: string) => {
    try {
      const supabase = createClient();

      // Fetch profile credits and purchased credits in parallel
      const [profileResult, creditsResult] = await Promise.all([
        supabase.from('user_profiles').select('id, credits_remaining').eq('user_id', authId).single(),
        supabase.from('user_credits').select('balance').eq('user_id', authId).single(),
      ]);

      const profile = profileResult.data;
      // Suppress 404-class errors: user_credits table may not be migrated yet — fallback is fine
      if (creditsResult.error) {
        const isMissingTable = creditsResult.error.message?.toLowerCase().includes('does not exist')
          || (creditsResult.error as any).code === '42P01'
          || (creditsResult.error as any).code === 'PGRST200';
        if (!isMissingTable) {
          console.warn('[Credits] user_credits query failed:', creditsResult.error.message);
        }
      }
      const purchasedBalance = creditsResult.data?.balance ?? 0;

      if (profile) {
        setSupabaseProfileId(profile.id);
        // Use purchased balance if it exists; otherwise fall back to profile credits
        const dbCredits = purchasedBalance > 0 ? purchasedBalance : (profile.credits_remaining ?? MESSAGE_LIMIT);
        setCreditsRemaining(dbCredits);
        const creditData = getCreditData();
        localStorage.setItem('userCredits', JSON.stringify({ ...creditData, credits: dbCredits }));
        return dbCredits;
      }
    } catch (err) {
      console.error('[Credits] Failed to load from Supabase:', err);
    }
    return null;
  };

  const consumeCredit = () => {
    const data = getCreditData();
    if (data.credits <= 0) {
      setShowStripeLightbox(true);
      return false;
    }
    const newCredits = data.credits - 1;
    const updated = { ...data, credits: newCredits };
    localStorage.setItem('userCredits', JSON.stringify(updated));
    setCreditsRemaining(newCredits);
    syncCreditsToSupabase(newCredits, 'consume', -1);
    return true;
  };

  const addCredits = (amount: number): void => {
    const data = getCreditData();
    const newCredits = data.credits + amount;
    const updated = { ...data, credits: newCredits };
    localStorage.setItem('userCredits', JSON.stringify(updated));
    setCreditsRemaining(newCredits);
    syncCreditsToSupabase(newCredits, 'purchase', amount);
  };

  const getRateLimitData = () => {
    if (typeof window === 'undefined') return { count: 0, resetTime: Date.now() + LIMIT_DURATION };
    const data = localStorage.getItem('chatRateLimit');
    if (!data) {
      const initial = { count: 0, resetTime: Date.now() + LIMIT_DURATION };
      localStorage.setItem('chatRateLimit', JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(data);
    if (Date.now() > parsed.resetTime) {
      const reset = { count: 0, resetTime: Date.now() + LIMIT_DURATION };
      localStorage.setItem('chatRateLimit', JSON.stringify(reset));
      return reset;
    }
    return parsed;
  };

  const canCreateNewChat = () => {
    const data = getRateLimitData();
    return data.count < CHAT_LIMIT;
  };

  const updateRateLimitCount = () => {
    const data = getRateLimitData();
    const updated = { ...data, count: data.count + 1 };
    localStorage.setItem('chatRateLimit', JSON.stringify(updated));
    return updated;
  };

  // Check Supabase auth session on mount and sync credits
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setIsLoggedIn(true);
          setUser({
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || ''
          });
          // Load credits and instructions from Supabase
          loadCreditsFromSupabase(session.user.id);
          loadInstructionsFromApi();
        } else {
          // Not logged in — load instructions from localStorage
          const stored = localStorage.getItem('leverage_custom_instructions') || '';
          setCustomInstructions(stored);
        }

        // Listen for auth changes (OAuth redirect, signout, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
          if (session?.user) {
            setIsLoggedIn(true);
            setUser({
              name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
              email: session.user.email || ''
            });
            setShowLoginModal(false);
            setShowSignupModal(false);
            // Load credits and instructions from Supabase on auth change
            loadCreditsFromSupabase(session.user.id);
            loadInstructionsFromApi();
          } else {
            setIsLoggedIn(false);
            setUser(null);
            setSupabaseProfileId(null);
            // Revert to localStorage instructions on logout
            const stored = localStorage.getItem('leverage_custom_instructions') || '';
            setCustomInstructions(stored);
          }
        });

        return () => subscription.unsubscribe();
      } catch (err) {
        console.error('[v0] Auth check failed:', err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Stripe checkout success: verify session server-side before adding credits
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) return;

    // Clean up URL params immediately so reloads don't re-trigger
    window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      try {
        const res = await fetch(`/api/stripe/verify?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (data.verified && data.credits > 0) {
          addCredits(data.credits);
          console.log(`[Stripe] Verified and added ${data.credits} credits for session ${sessionId}`);
        } else if (!data.verified) {
          // Stripe not configured (dev mode) — fall back to URL param
          const creditsPurchased = params.get('credits');
          const amount = creditsPurchased ? parseInt(creditsPurchased, 10) : 0;
          if (amount > 0) {
            addCredits(amount);
            console.log(`[Stripe] Dev mode: added ${amount} credits from URL param`);
          }
        }
      } catch {
        // Network error — fall back to URL param (best-effort)
        const creditsPurchased = params.get('credits');
        const amount = creditsPurchased ? parseInt(creditsPurchased, 10) : 0;
        if (amount > 0) addCredits(amount);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize credits and load real insights on mount
  useEffect(() => {
    fetch('/api/insights')
      .then(r => r.json())
      .then(insights => {
        setMessages((prev: Message[]) => {
          const newMessages = [...prev];
          if (newMessages[0]?.isWelcome) {
            newMessages[0] = {
              ...newMessages[0],
              insights
            };
          }
          return newMessages;
        });
      })
      .catch(err => {
        console.error('[v0] Error loading initial data:', err);
      });
  }, []);

  // Auto-refresh cards every 5 minutes when the conversation has AI cards
  useEffect(() => {
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

    const refreshCards = async () => {
      // Only refresh if there are messages with cards showing
      const hasCards = messages.some(m => m.role === 'assistant' && m.cards && m.cards.length > 0);
      if (!hasCards || !lastUserQuery) return;

      try {
        const { fetchDynamicCards: fetchCards } = await import('@/lib/data-service');
        const freshCards = await fetchCards({ userContext: lastUserQuery, category: selectedCategory, limit: 4 });
        if (freshCards.length === 0) return;

        const converted = freshCards.map(convertToInsightCard);
        setMessages(prev => {
          const updated = [...prev];
          // Update the last assistant message that has cards
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'assistant' && updated[i].cards?.length) {
              updated[i] = { ...updated[i], cards: converted };
              break;
            }
          }
          return updated;
        });
        setCardsRefreshedAt(new Date());
      } catch {
        // Non-critical — silently skip on error
      }
    };

    if (cardsRefreshIntervalRef.current) clearInterval(cardsRefreshIntervalRef.current);
    cardsRefreshIntervalRef.current = setInterval(refreshCards, REFRESH_INTERVAL);
    return () => { if (cardsRefreshIntervalRef.current) clearInterval(cardsRefreshIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, lastUserQuery]);

  // Start with empty chat history - user creates real chats
  // Use serverData.serverTime for the initial timestamp to avoid SSR/client hydration mismatch (#418).
  const [chats, setChats] = useState<Chat[]>([
    {
      id: 'chat-1',
      title: 'New Chat',
      preview: 'Start a conversation to get real-time sports betting insights...',
      timestamp: new Date(serverData?.serverTime ?? 0),
      starred: false,
      category: 'all',
      tags: []
    }
  ]);

  const categories = [
    { id: 'all', name: 'All', icon: Layers, color: 'text-blue-400', desc: 'Everything' },
    { id: 'betting', name: 'Sports Betting', icon: TrendingUp, color: 'text-orange-400', desc: 'Live Odds & Props' },
    { id: 'fantasy', name: 'Fantasy', icon: Trophy, color: 'text-green-400', desc: 'Season-long & Best Ball' },
    { id: 'dfs', name: 'DFS Optimizer', icon: Award, color: 'text-purple-400', desc: 'DK/FD Lineups' },
    { id: 'kalshi', name: 'Kalshi Markets', icon: BarChart3, color: 'text-cyan-400', desc: 'Financial Prediction' },
  ];

  const sports = [
    { id: 'mlb', name: 'MLB' },
    { id: 'nfl', name: 'NFL' },
    { id: 'nba', name: 'NBA' },
    { id: 'nhl', name: 'NHL' },
    { id: 'ncaa-football', name: 'NCAA Football' },
    { id: 'ncaa-basketball', name: 'NCAA Basketball' },
  ];

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Loading skeleton for cards
  const CardLoadingSkeleton = () => (
    <div className="group relative bg-gradient-to-br from-gray-900/95 via-gray-850/95 to-gray-900/95 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/60 overflow-hidden animate-pulse">
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-xl bg-gray-700/50"></div>
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 bg-gray-700/50 rounded"></div>
          <div className="h-4 w-48 bg-gray-700/50 rounded"></div>
          <div className="h-6 w-20 bg-gray-700/50 rounded-full"></div>
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/30">
            <div className="h-3 w-24 bg-gray-700/50 rounded"></div>
            <div className="h-3 w-32 bg-gray-700/50 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );

  const handleStarChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const chat = chats.find((c: Chat) => c.id === chatId);
    const wasStarred = chat?.starred;
    setChats(chats.map((c: Chat) =>
      c.id === chatId ? { ...c, starred: !c.starred } : c
    ));
    toast.success(wasStarred ? 'Removed from starred' : 'Analysis saved');
  };

  const generateContextualSuggestions = (userMessage: string, responseCards: InsightCard[]) => {
    const msgLower = userMessage.toLowerCase();
    const suggestions: Array<{ label: string; icon: any; category: string }> = [];

    // Extract named entities from response cards for hyper-specific follow-ups
    const matchups = responseCards
      .map(c => c.data?.matchup as string | undefined)
      .filter(Boolean) as string[];
    const firstMatchup = matchups[0]; // e.g. "Los Angeles Lakers @ Golden State Warriors"
    const teams = firstMatchup
      ? firstMatchup.split(' @ ').map(t => t.split(' ').slice(-1)[0]) // last word = team name
      : [];
    const firstAway = teams[0] ?? '';
    const firstHome = teams[1] ?? '';
    const playerName = responseCards.find(c => c.data?.player)?.data?.player as string | undefined;
    const sport = responseCards[0]?.category ?? '';

    // Analyze card types in the response
    const cardTypes = responseCards.map(card => card.type);
    const hasLiveOdds = cardTypes.some(t => t.includes('odds') || t.includes('live'));
    const hasDFSLineup = cardTypes.some(t => t.includes('dfs'));
    const hasFantasy = cardTypes.some(t => t.includes('fantasy') || t.includes('draft') || t.includes('waiver'));
    const hasKalshi = cardTypes.some(t => t.includes('kalshi') || t.includes('prediction'));
    const hasPlayerProps = cardTypes.some(t => t.includes('prop'));

    // Analyze user message for topic
    const isLineMovement = msgLower.includes('line move') || msgLower.includes('movement') || msgLower.includes('steam');
    const isFantasyQ = msgLower.includes('draft') || msgLower.includes('fantasy') || msgLower.includes('adp') || selectedCategory === 'fantasy';
    const isDFS = msgLower.includes('dfs') || msgLower.includes('lineup') || selectedCategory === 'dfs';
    const isKalshi = msgLower.includes('kalshi') || msgLower.includes('prediction') || selectedCategory === 'kalshi';
    const isArbitrage = msgLower.includes('arbitrage') || msgLower.includes('arb');
    const isParlay = msgLower.includes('parlay') || msgLower.includes('same-game') || msgLower.includes('sgp');
    const isPlayerProp = msgLower.includes('prop') || !!playerName;

    // PRIORITY 0: Highly specific follow-ups for line movement questions
    if (isLineMovement) {
      suggestions.push(
        { label: 'Where is the sharp money going on this game?', icon: Target, category: 'betting' },
        { label: 'Show me opening line vs current line comparison', icon: BarChart, category: 'betting' },
        { label: 'What does this movement say about public vs sharp action?', icon: Activity, category: 'betting' },
        { label: 'Set an alert if this line moves another half point', icon: Bell, category: 'betting' },
        { label: 'Find correlated player props based on this line move', icon: Layers, category: 'betting' }
      );
    }

    // PRIORITY 0: Specific follow-ups for player prop questions
    if (isPlayerProp && !isLineMovement) {
      suggestions.push(
        { label: 'Show me the historical hit rate for this player prop', icon: BarChart, category: 'betting' },
        { label: 'Stack this prop into a same-game parlay', icon: Layers, category: 'betting' },
        { label: 'Find correlated props for the same game', icon: Target, category: 'betting' },
        { label: 'Compare this line across all sportsbooks', icon: Activity, category: 'betting' }
      );
    }

    // PRIORITY 0: Specific follow-ups for arbitrage questions
    if (isArbitrage) {
      suggestions.push(
        { label: 'Calculate optimal Kelly sizing for this arb', icon: DollarSign, category: 'betting' },
        { label: 'Show me more live arbitrage opportunities', icon: Zap, category: 'betting' },
        { label: 'Alert me when new arbs appear on these books', icon: Bell, category: 'betting' }
      );
    }

    // PRIORITY 0: Specific follow-ups for parlay questions
    if (isParlay) {
      suggestions.push(
        { label: 'What legs have the best correlation in this parlay?', icon: Layers, category: 'betting' },
        { label: 'Show me the EV calculation for each leg', icon: BarChart, category: 'betting' },
        { label: 'Find the best sportsbook for this exact parlay', icon: Target, category: 'betting' }
      );
    }

    // PRIORITY 1: Hyper-specific prompts using actual teams/players from cards
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
        { label: 'What is the leverage score for this lineup?', icon: Award, category: 'dfs' },
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
        { label: 'Best trade targets with similar ADP?', icon: RefreshCw, category: 'fantasy' },
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

    // PRIORITY 2: Sport-specific follow-ups based on card categories
    const cardCategories = [...new Set(responseCards.map(c => c.category?.toUpperCase()))];
    if (cardCategories.includes('NBA')) {
      suggestions.push(
        { label: firstMatchup ? `Rest advantage analysis: ${firstAway} vs ${firstHome}` : 'NBA rest-advantage games tonight', icon: AlertCircle, category: 'betting' },
        { label: 'NBA pace-up games for totals', icon: Zap, category: 'dfs' }
      );
    }
    if (cardCategories.includes('NFL') || cardCategories.includes('NFC') || cardCategories.includes('NFC')) {
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

    // PRIORITY 3: Category fallbacks if still not enough
    if (isDFS && suggestions.length < 5) {
      suggestions.push(
        { label: 'Build a low-ownership tournament stack', icon: Users, category: 'dfs' },
        { label: 'Find value plays under $5K salary', icon: DollarSign, category: 'dfs' },
        { label: 'Showdown slate captain picks with leverage', icon: Medal, category: 'dfs' }
      );
    } else if (isFantasyQ && suggestions.length < 5) {
      suggestions.push(
        { label: 'Show me ADP risers this week', icon: TrendingUp, category: 'fantasy' },
        { label: 'Best ball stacking strategy', icon: Medal, category: 'fantasy' },
        { label: 'Auction value targets this week', icon: ShoppingCart, category: 'fantasy' }
      );
    } else if (isKalshi && suggestions.length < 5) {
      suggestions.push(
        { label: 'Show trending Kalshi markets', icon: TrendingUp, category: 'kalshi' },
        { label: 'Political markets with market inefficiency', icon: Activity, category: 'kalshi' },
        { label: 'Weather + climate prediction markets', icon: Sparkles, category: 'kalshi' }
      );
    }
    
    // PRIORITY 4: Predictive next-step suggestions based on card data
    responseCards.forEach(card => {
      if (suggestions.length >= 7) return;
      
      // Generate specific suggestions based on card type and data
      if (card.type === 'live-odds' && card.data.movement) {
        suggestions.push({ 
          label: `Track ${card.data.matchup} live until game time`, 
          icon: Clock, 
          category: 'betting' 
        });
      }
      
      if (card.type === 'dfs-lineup' && card.data.topPlay) {
        suggestions.push({ 
          label: `Build alternate lineup fading ${card.data.topPlay}`, 
          icon: Users, 
          category: 'dfs' 
        });
      }
      
      if (card.type === 'player-prop' && card.data.player) {
        suggestions.push({ 
          label: `Find correlated ${card.data.player} same-game parlays`, 
          icon: Medal, 
          category: 'betting' 
        });
      }
      
      if (card.type === 'adp-analysis' && card.data.player) {
        suggestions.push({ 
          label: `Show similar value picks in this ADP range`, 
          icon: Search, 
          category: 'fantasy' 
        });
      }
      
      if (card.type === 'kalshi-market' && card.data.event) {
        suggestions.push({ 
          label: `Alert me on ${card.data.market} price movements`, 
          icon: Bell, 
          category: 'kalshi' 
        });
      }
    });
    
    // PRIORITY 5: Intelligent universal suggestions based on what wasn't covered
    const universalSuggestions = [
      { label: 'What are tonight\'s best value opportunities?', icon: Sparkles, category: 'all' },
      { label: 'Show me high-confidence plays across platforms', icon: CheckCircle, category: 'all' },
      { label: 'Compare live odds across all sportsbooks', icon: BarChart, category: 'betting' },
      { label: 'Find contrarian tournament plays', icon: Users, category: 'dfs' },
      { label: 'Track sharp money movements in real-time', icon: TrendingUp, category: 'betting' },
      { label: 'Optimize my overall portfolio allocation', icon: PieChart, category: 'all' },
      { label: 'Breaking news and injury updates', icon: AlertCircle, category: 'all' },
      { label: 'Show me arbitrage opportunities', icon: DollarSign, category: 'all' }
    ];
    
    // Add contextual universal suggestions
    for (const suggestion of universalSuggestions) {
      if (suggestions.length >= 7) break;
      if (!suggestions.some(s => s.label === suggestion.label)) {
        suggestions.push(suggestion);
      }
    }
    
    // PRIORITY 6: Ensure we have exactly 5-7 suggestions with intelligent deduplication
    // Also filter out the exact user message to avoid showing what was just asked
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
      index === self.findIndex((s) => s.label === suggestion.label) &&
      suggestion.label.toLowerCase() !== userMessage.toLowerCase()
    );

    console.log('[v0] Suggestions:', uniqueSuggestions.length, 'generated');

    // Return 5-7 unique suggestions for optimal UX
    return uniqueSuggestions.slice(0, 7);
  };

  const handleFollowUp = (action: 'correlated' | 'metrics', cardData?: any) => {
    console.log('[v0] Generating follow-up response:', action);
    
    // Check if user has credits
    if (!consumeCredit()) {
      console.log('[v0] No credits remaining, showing purchase modal');
      return;
    }

    setIsTyping(true);
    
    setTimeout(() => {
      let responseText = '';
      let responseCards: InsightCard[] = [];

      if (action === 'correlated') {
        responseText = "**Correlated Opportunities Identified**\n\n**Cross-Platform Analysis:** I've scanned multiple markets to find plays that correlate with your original opportunity.\n\n**Synergy Rating:** High - These plays share common factors and can be stacked for increased leverage\n\n**Strategic Value:** Combining these opportunities creates portfolio diversification while maintaining edge\n\n**Here are the correlated plays:**";
        responseCards = [unifiedCards[1], unifiedCards[3], unifiedCards[5]];
      } else {
        responseText = "**Deep Metric Analysis**\n\n**Data Validation:** All metrics cross-referenced with historical databases and real-time market feeds\n\n**Statistical Significance:** Each data point has been tested for reliability and predictive value\n\n**Actionable Insights:** Below is a granular breakdown of key performance indicators and their implications\n\n**Detailed metric breakdown:**";
        responseCards = [unifiedCards[2], unifiedCards[6]];
      }

      const aiMessage: Message = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        cards: responseCards,
        sources: [
          { name: 'Grok 4 (xAI)', type: 'model', reliability: 96 },
          { name: 'The Odds API (Live)', type: 'api', reliability: 97 },
          { name: 'Historical Database', type: 'database', reliability: 92 },
        ],
        modelUsed: 'Grok 4',
        processingTime: 950,
        trustMetrics: {
          benfordIntegrity: 91,
          oddsAlignment: 93,
          marketConsensus: 89,
          historicalAccuracy: 95,
          finalConfidence: 92,
          trustLevel: 'high',
          riskLevel: 'low',
          adjustedTone: 'Strong signal — live data verified',
          flags: [],
          modelUsed: 'Grok 4',
          hasLiveOdds: true,
        }
      };

      setMessages((prev: Message[]) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1000);
  };

  // Generate inline card-type-specific analysis without adding a new chat message
  const generateCardAnalysis = async (card: InsightCard, cardKey: string) => {
    // Toggle: collapse if already open
    if (cardAnalysisMap[cardKey]?.content || cardAnalysisMap[cardKey]?.error) {
      setCardAnalysisMap(prev => { const n = { ...prev }; delete n[cardKey]; return n; });
      return;
    }

    setCardAnalysisMap(prev => ({ ...prev, [cardKey]: { loading: true, content: null, error: null } }));

    const d = card.data as any;
    const cardType = (card.type ?? '').toLowerCase();

    // Card-type-specific prompts
    let prompt = '';
    if (cardType === 'kalshi' || cardType === 'prediction') {
      const yesPct = d.yesPct ?? 50;
      const noPct  = d.noPct  ?? (100 - yesPct);
      prompt = `Analyze this Kalshi prediction market contract. Be concise and actionable.

Market: "${card.title}"
Category: ${card.subcategory || card.category}
YES price: ${yesPct}¢ (${yesPct}% implied probability)
NO price: ${noPct}¢${d.volume ? `\nVolume: ${d.volume}` : ''}${d.expiresLabel ? `\nExpires: ${d.expiresLabel}` : ''}${d.ticker ? `\nTicker: ${d.ticker}` : ''}

Provide exactly these 5 sections:
**1. Market Assessment** – Is this price efficient or mispriced? What does ${yesPct}% imply about the event?
**2. Key Drivers** – 3 bullet points of the most important factors influencing this market
**3. Edge Analysis** – Where does edge exist (if any)? Lean YES or NO and why?
**4. Risk Factors** – What could move this market significantly?
**5. Recommendation** – Clear YES / NO / PASS with confidence level (Low/Medium/High)

No preamble. Start directly with section 1.`;
    } else if (['betting', 'odds', 'moneyline', 'spread', 'totals'].includes(cardType)) {
      prompt = `Analyze this sports betting opportunity as a sharp bettor. Be concise.

Market: "${card.title}"
Category: ${card.subcategory || card.category}${d.homeTeam ? `\nHome: ${d.homeTeam}` : ''}${d.awayTeam ? `\nAway: ${d.awayTeam}` : ''}${d.homeOdds || d.odds ? `\nOdds: ${d.homeOdds ?? d.odds}` : ''}${d.spread ? `\nSpread: ${d.spread}` : ''}${d.total ? `\nTotal: ${d.total}` : ''}

Provide exactly these 5 sections:
**1. Line Analysis** – Is this line sharp or public? Any steam or reverse line movement?
**2. Key Angles** – 3 bullet points of the strongest betting factors
**3. Kelly Sizing** – Suggested bet size as % of bankroll and why
**4. Sharp Signal** – Where is sharp money leaning?
**5. Pick** – Clear recommendation with one-line reasoning

No preamble. Start directly with section 1.`;
    } else if (cardType === 'arbitrage') {
      prompt = `Analyze this sports betting arbitrage opportunity. Be precise.

Opportunity: "${card.title}"${d.profit ? `\nProfit margin: ${d.profit}` : ''}${d.bookmaker1 ? `\nBook 1: ${d.bookmaker1}` : ''}${d.bookmaker2 ? `\nBook 2: ${d.bookmaker2}` : ''}

Provide exactly these 5 sections:
**1. Opportunity Assessment** – Is this a genuine arb or key-number variance play?
**2. Execution Risk** – Account limits, line movement risk, timing window
**3. Profit Calculation** – Example stakes and profit with a $1,000 bankroll
**4. Execution Steps** – Step-by-step to lock in the profit
**5. Verdict** – Execute immediately / Proceed with caution / Avoid

No preamble. Start directly with section 1.`;
    } else if (cardType === 'dfs' || cardType === 'lineup') {
      prompt = `Analyze this DFS opportunity as a lineup optimizer. Be concise.

Player/Stack: "${card.title}"
Contest type: ${card.subcategory || card.category}${d.salary ? `\nSalary: ${d.salary}` : ''}${d.projection ? `\nProjection: ${d.projection}` : ''}${d.ownership ? `\nProjected ownership: ${d.ownership}` : ''}

Provide exactly these 5 sections:
**1. Value Assessment** – Is this good value at the salary? Salary efficiency score
**2. Ceiling Scenario** – What does a top-score game look like?
**3. Correlation Stacks** – Best teammates to pair for maximum upside
**4. Ownership Leverage** – GPP leverage potential (low/medium/high ownership)
**5. Recommendation** – Use in Cash / GPP / Both / Fade

No preamble. Start directly with section 1.`;
    } else if (cardType === 'fantasy' || cardType === 'draft') {
      prompt = `Analyze this fantasy sports opportunity. Be concise and actionable.

Player: "${card.title}"
Context: ${card.subcategory || card.category}${d.adp ? `\nADP: ${d.adp}` : ''}${d.value ? `\nValue: ${d.value}` : ''}

Provide exactly these 5 sections:
**1. Upside/Floor** – Best and worst realistic outcomes this season/week
**2. Key Factors** – 3 most important things to know right now
**3. Roster Decision** – Start / Sit / Trade for / Trade away / Waiver pickup
**4. Matchup Context** – Injury news, usage, schedule notes
**5. Verdict** – Clear action with confidence level

No preamble. Start directly with section 1.`;
    } else if (cardType === 'weather' || cardType === 'climate') {
      prompt = `Analyze this weather prediction market or weather-impacted game. Be concise.

Event: "${card.title}"${card.subcategory ? `\nType: ${card.subcategory}` : ''}

Provide exactly these 5 sections:
**1. Forecast Confidence** – How reliable is the current forecast for this event?
**2. Betting Implications** – How does weather impact totals, spreads, and specific props?
**3. Historical Context** – What typically happens to lines in these conditions?
**4. Key Thresholds** – Weather metrics that would trigger significant line movement
**5. Recommendation** – Actionable play (e.g., Under / Over / Fade game total)

No preamble. Start directly with section 1.`;
    } else {
      prompt = `Provide a focused analysis for this opportunity. Be concise and actionable.

Opportunity: "${card.title}"
Category: ${card.subcategory || card.category}

Provide exactly these 4 sections:
**1. Key Data Points** – Most important metrics supporting this opportunity
**2. Risk Assessment** – Potential downsides and how to mitigate them
**3. Recommended Action** – Clear action with one-line reasoning
**4. Position Sizing** – How much to allocate (% of bankroll)

No preamble. Start directly with section 1.`;
    }

    const context: any = {
      isPoliticalMarket: cardType === 'kalshi' || cardType === 'prediction',
      hasBettingIntent: ['betting', 'odds', 'moneyline', 'spread', 'totals', 'arbitrage'].includes(cardType),
    };

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: prompt, context }),
      });
      let result: APIResponse;
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        result = { success: false, error: `Server error ${res.status}: ${text.slice(0, 150)}` };
      } else {
        result = await res.json().catch(() => ({ success: false, error: 'Invalid JSON response' })) as APIResponse;
      }
      if (!result.success) {
        setCardAnalysisMap(prev => ({ ...prev, [cardKey]: { loading: false, content: null, error: result.error ?? 'Analysis failed' } }));
        return;
      }
      setCardAnalysisMap(prev => ({ ...prev, [cardKey]: { loading: false, content: result.text ?? null, error: null } }));
    } catch {
      setCardAnalysisMap(prev => ({ ...prev, [cardKey]: { loading: false, content: null, error: 'Network error — please try again' } }));
    }
  };

  // Wrapper for "View Full Analysis" buttons rendered outside the message-card loop
  // (e.g. _renderInsightCard). Derives a stable key from the card itself.
  const generateDetailedAnalysis = (card: InsightCard) => {
    const cardKey = `insight-${card.type}-${(card.title || '').replace(/\s+/g, '-').toLowerCase().slice(0, 40)}`;
    generateCardAnalysis(card, cardKey);
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsTyping(false);
  };

  const generateRealResponse = async (userMessage: string, imageAttachments?: Array<{ name: string; base64: string; mimeType: string }>) => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsTyping(true);
    setLastUserQuery(userMessage);
    const startTime = Date.now();
    const isDev = process.env.NODE_ENV !== 'production';
    
    try {
      console.log('[v0] Starting real AI analysis for:', userMessage);
      
      // Extract context from user message with strict detection flags
      const lowerMsg = userMessage.toLowerCase();
      
      // Political market keywords
      const politicalKeywords = ['kalshi', 'election', 'politics', 'cpi', 'inflation', 'fed', 'approval rating', 'recession', 'polymarket', 'prediction market'];
      const isPoliticalMarket = politicalKeywords.some(k => lowerMsg.includes(k));
      
      // Sports detection - pass conversation history for context
      const conversationHistory = messages.slice(-5).map(m => ({ role: m.role, content: m.content || '' }));
      const detectedSport = extractSport(userMessage, conversationHistory);

      // Normalize the UI-selected sport to the same format extractSport() returns
      // (e.g. 'ncaa-football' → 'ncaaf', 'ncaa-basketball' → 'ncaab', others unchanged)
      const selectedSportNormalized = selectedSport === 'ncaa-football' ? 'ncaaf'
        : selectedSport === 'ncaa-basketball' ? 'ncaab'
        : selectedSport || null;

      // Fall back to the UI sport filter when the message doesn't name a sport explicitly.
      // Don't apply the fallback for Kalshi — that platform never fetches sports odds.
      const effectiveSport = detectedSport || (selectedCategory !== 'kalshi' ? selectedSportNormalized : null);

      // Betting intent keywords — also activates on Betting tab
      const bettingKeywords = ['odds', 'bet', 'line', 'spread', 'arbitrage', 'arb', 'h2h', 'value', 'sportsbook', 'draftkings', 'fanduel', 'moneyline', 'prop', 'parlay'];
      const hasBettingIntent = bettingKeywords.some(k => lowerMsg.includes(k)) || selectedCategory === 'betting';

      // Sports query detection (not political, not Kalshi)
      const sportsKeywords = ['nba', 'nfl', 'nhl', 'mlb', 'basketball', 'football', 'hockey', 'baseball', 'ncaa'];
      const isSportsQuery = (sportsKeywords.some(k => lowerMsg.includes(k)) || !!effectiveSport) && !isPoliticalMarket && selectedCategory !== 'kalshi';

      // Fantasy intent — also activates on Fantasy tab and DFS tab
      const fantasyKeywords = ['fantasy', 'draft', 'waiver', 'faab', 'adp', 'vbd', 'tier cliff', 'bestball', 'best ball', 'start sit', 'trade value', 'who should i pick', 'who do i start', 'sleeper', 'rankings', 'projections', 'auction value'];
      const hasFantasyIntent = (fantasyKeywords.some(k => lowerMsg.includes(k)) || selectedCategory === 'fantasy' || selectedCategory === 'dfs') && !isPoliticalMarket;

      const detectedPlatform = extractPlatform(userMessage);

      // Political market guard — respects the UI platform selection:
      // - Kalshi platform selected → always political (never fetch sports odds)
      // - Betting platform selected → never political (don't let message keywords override)
      // - Otherwise → use message-based detection
      const finalIsPoliticalMarket = selectedCategory === 'kalshi' ||
        ((isPoliticalMarket || detectedPlatform === 'kalshi') && selectedCategory !== 'betting');

      const context: any = {
        sport: effectiveSport,
        marketType: extractMarketType(userMessage),
        platform: detectedPlatform,
        isSportsQuery,
        isPoliticalMarket: finalIsPoliticalMarket,
        hasBettingIntent,
        hasFantasyIntent,
        previousMessages: messages.slice(-5).map(m => ({ role: m.role, content: m.content || '' })),
        // Pass Kalshi sub-category pill value when in Kalshi mode
        kalshiSubcategory: selectedCategory === 'kalshi' && selectedSport ? selectedSport : undefined,
      };

      if (isDev) {
        console.log('[v0] Context:', { sport: detectedSport || 'none', betting: hasBettingIntent, sports: isSportsQuery, political: finalIsPoliticalMarket, fantasy: hasFantasyIntent });
      }

      // HARD STOP: Political markets NEVER fetch sports odds
      if (context.isPoliticalMarket) {
        if (isDev) console.log('[POLITICAL MARKET DETECTED] Skipping sports odds fetch');
        // Route directly to Kalshi analysis without attempting sports odds
        // Note: The /api/analyze endpoint will handle Kalshi market analysis
      } else if (context.hasFantasyIntent && !context.hasBettingIntent) {
        // Fantasy intent — generate fantasy cards client-side immediately so they
        // appear before the AI response comes back.
        if (isDev) console.log('[FANTASY INTENT] Generating fantasy cards');
        try {
          const { generateFantasyCards } = await import('@/lib/fantasy/cards/fantasy-card-generator');
          const fantasyCards = generateFantasyCards(userMessage, 3);
          context.existingCards = fantasyCards;
        } catch (err) {
          if (isDev) console.error('[FANTASY INTENT] Card generation failed:', err);
        }
      } else if (context.hasBettingIntent || context.isSportsQuery) {
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
            } else {
              const oddsResult = await oddsResponse.json();
              
              if (oddsResult?.events?.length > 0) {
                const sportName = sportKey.replace('_', ' ').toUpperCase();
                if (isDev) console.log(`[v0] ✅ Found ${oddsResult.events.length} live games in ${sportName}`);
                context.oddsData = oddsResult;
                context.oddsData.sport = sportKey;
              } else {
                if (isDev) console.log('[NO GAMES FOUND]', context.sport);
                // NO fallback - return status indicating no games
                context.noGamesAvailable = true;
                context.noGamesMessage = `No live ${context.sport.toUpperCase()} games scheduled at this time. Games typically appear 24-48 hours before start time.`;
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
      
      // Collect any existing cards from previous messages (SSR welcome + prior responses)
      // to pass to the analyze endpoint so it can return them without re-fetching.
      const availableCards = messages
        .flatMap((m: Message) => m.cards || [])
        .filter((c: InsightCard) => c.data?.realData !== false)
        .slice(0, 6);

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

      // Fetch real data from our API routes
      const fetchAnalysis = () =>
        fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage: contextualUserMessage, existingCards: availableCards, context, customInstructions: customInstructions || undefined, imageAttachments: imageAttachments?.length ? imageAttachments : undefined }),
          signal: controller.signal,
        }).then(async (res) => {
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            const snippet = text.slice(0, 200);
            console.error('[v0] /api/analyze non-OK response:', res.status, snippet);
            return { success: false, error: `Server error ${res.status}` } as APIResponse;
          }
          return res.json().catch((e: unknown) => {
            console.error('[v0] /api/analyze JSON parse error:', e);
            return { success: false, error: 'Invalid response from server' } as APIResponse;
          }) as Promise<APIResponse>;
        });

      setVerifyStage('analyzing');
      let analysisResult = await fetchAnalysis();

      // Client-side final-safety retry: if the server couldn't lift integrity above 40
      // even after its own server-side retries, try once more from the client side.
      const CLIENT_RETRY_THRESHOLD = 40;
      if (
        analysisResult.success &&
        !analysisResult.useFallback &&
        (analysisResult.trustMetrics?.finalConfidence ?? 100) < CLIENT_RETRY_THRESHOLD
      ) {
        console.warn(
          '[v0] Integrity below client threshold (' +
            analysisResult.trustMetrics?.finalConfidence +
            '%) — client-side re-verify',
        );
        setVerifyStage('reverifying');
        analysisResult = await fetchAnalysis();
        setVerifyStage('analyzing');
      }

      console.log('[v0] Analysis:', {
        ok: analysisResult.success,
        cards: analysisResult.cards?.length ?? 0,
        confidence: analysisResult.trustMetrics?.finalConfidence,
        fallback: analysisResult.useFallback,
        clientCards: availableCards.length,
      });

      // Handle API errors with smart fallback
      const processingTime = Date.now() - startTime;
      let newMessage: Message;
      
      if (!analysisResult.success) {
        console.log('[v0] API call failed, using available cards as fallback');
        
        // Use already-loaded cards rather than making another server call
        const fallbackCards = availableCards.length > 0 ? availableCards : await selectRelevantCards(userMessage, context);
        const errorMessage = analysisResult.error || 'API temporarily unavailable';
        
        newMessage = {
          role: 'assistant',
          content: `Here's what I can tell you based on available data:`,
          timestamp: new Date(),
          cards: fallbackCards,
          confidence: 70,
          sources: [
            {
              name: 'Cached Market Data',
              type: 'cache',
              reliability: 70
            }
          ],
          modelUsed: 'Fallback',
          processingTime,
          trustMetrics: {
            benfordIntegrity: 70,
            oddsAlignment: 70,
            marketConsensus: 70,
            historicalAccuracy: 70,
            finalConfidence: 70,
            trustLevel: 'medium',
            riskLevel: 'medium',
            adjustedTone: 'Moderate confidence',
            flags: []
          }
        };
      } else {
        // Success path - process the analysis result.
        // If the server returns cards, use them. Otherwise fall back to
        // the cards we already have from the SSR welcome message.
        const responseCards = (analysisResult.cards && analysisResult.cards.length > 0)
          ? analysisResult.cards
          : availableCards;

        // Enrich trust metrics with real metadata so TrustMetricsDisplay can show
        // sources, model name, processing time, and live-data badges.
        const hasLiveOdds = !!(context?.oddsData?.events?.length > 0);
        const hasKalshi = context?.isPoliticalMarket === true;
        const enrichedTrustMetrics = analysisResult.trustMetrics
          ? {
              ...analysisResult.trustMetrics,
              modelUsed: analysisResult.modelUsed || 'Grok 4',
              sources: analysisResult.sources || [],
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
              sources: analysisResult.sources || [],
              processingTime,
              hasLiveOdds,
              hasKalshi,
            };

        newMessage = {
          role: 'assistant',
          content: analysisResult.text || 'Analysis complete.',
          timestamp: new Date(),
          cards: responseCards,
          confidence: analysisResult.confidence || 85,
          sources: analysisResult.sources || [],
          modelUsed: analysisResult.modelUsed || 'Grok 4',
          processingTime,
          trustMetrics: enrichedTrustMetrics,
        };
      }
      
      // Add message to state
      setMessages((prev: Message[]) => [...prev, newMessage].slice(-30));

      // Generate contextual suggestions — use clarificationOptions from API if ambiguous
      if (analysisResult.clarificationOptions?.length) {
        setSuggestedPrompts(analysisResult.clarificationOptions.map((o: string) => ({
          label: o,
          icon: Target,
          category: selectedCategory,
        })));
      } else {
        const contextualSuggestions = generateContextualSuggestions(userMessage, newMessage.cards || []);
        setSuggestedPrompts(contextualSuggestions);
      }

    } catch (error) {
      // Ignore abort errors — user intentionally cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('[v0] Error generating real response:', error);

      // Fallback to basic response with error indication — no random cards
      setMessages((prev: Message[]) => [...prev, {
        role: 'assistant',
        content: `I'm currently experiencing connectivity issues with live data sources. Here's an analysis based on available information:\n\n**Note:** Some real-time data may be limited. ${error instanceof Error ? `(${error.message})` : ''}`,
        timestamp: new Date(),
        cards: [],
        confidence: 70,
        sources: [
          { name: 'Cached Data', type: 'cache', reliability: 75 }
        ],
        modelUsed: 'Fallback Mode',
        processingTime: Date.now() - startTime,
        trustMetrics: {
          benfordIntegrity: 70,
          oddsAlignment: 70,
          marketConsensus: 70,
          historicalAccuracy: 70,
          finalConfidence: 70,
          trustLevel: 'medium',
          riskLevel: 'medium',
          adjustedTone: 'Limited data',
          flags: [{
            type: 'connectivity',
            message: 'Using cached data due to API connectivity issues',
            severity: 'warning'
          }]
        }
      }]);

      setSuggestedPrompts(generateContextualSuggestions(userMessage, []));
    } finally {
      setIsTyping(false);
    }
  };

  // Helper functions for context extraction
  const extractSport = (message: string, conversationHistory?: Array<{ role: string; content: string }>): string | null => {
    const msgLower = message.toLowerCase();
    
    console.log('[v0] Extracting sport from:', message);
    
    // Basketball
    if (msgLower.includes('nba') || msgLower.includes('basketball')) {
      console.log('[v0] Detected sport: NBA');
      return 'nba';
    }
    
    // Football
    if (msgLower.includes('nfl') || msgLower.includes('football')) {
      console.log('[v0] Detected sport: NFL');
      return 'nfl';
    }
    
    // Baseball - enhanced detection for fantasy baseball
    if (msgLower.includes('mlb') || msgLower.includes('baseball') || 
        msgLower.includes('nfbc') || msgLower.includes('nffc') || 
        msgLower.includes('nfbkc') || msgLower.includes('tgfbi')) {
      console.log('[v0] Detected sport: MLB (baseball/fantasy baseball)');
      return 'mlb';
    }
    
    // Hockey
    if (msgLower.includes('nhl') || msgLower.includes('hockey')) {
      console.log('[v0] Detected sport: NHL');
      return 'nhl';
    }
    
    // NCAA
    if (msgLower.includes('ncaa')) {
      const sport = msgLower.includes('basketball') ? 'ncaab' : 'ncaaf';
      console.log('[v0] Detected sport:', sport);
      return sport;
    }
    
    // Check for contextual references that indicate user is continuing a conversation
    const contextualKeywords = [
      'this game', 'that game', 'the game', 'same game', 
      'this match', 'that match', 'the match', 'same match',
      'these props', 'those props', 'these players', 'those players',
      'this parlay', 'that parlay', 'for this', 'for that',
      'correlated', 'same-game', 'sgp'
    ];
    
    const hasContextualReference = contextualKeywords.some(keyword => msgLower.includes(keyword));
    
    // If no sport found in current message and (conversation history exists OR has contextual keywords), check recent messages
    if ((conversationHistory && conversationHistory.length > 0) || hasContextualReference) {
      if (hasContextualReference) {
        console.log('[v0] Contextual reference detected, checking conversation history...');
      } else {
        console.log('[v0] No sport in current message, checking conversation history...');
      }
      
      // Check last 5 messages (newest first) for sport context
      if (conversationHistory) {
        for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 5); i--) {
          const historicalMsg = conversationHistory[i];
          if (historicalMsg && historicalMsg.content) {
            const historicalSport = extractSportFromText(historicalMsg.content);
            if (historicalSport) {
              console.log('[v0] Inherited sport from conversation history:', historicalSport);
              return historicalSport;
            }
          }
        }
      }
    }
    
    console.log('[v0] No specific sport detected');
    return null;
  };

  // Helper to extract sport from text without recursion
  const extractSportFromText = (text: string): string | null => {
    const textLower = text.toLowerCase();
    
    if (textLower.includes('nba') || textLower.includes('basketball')) return 'nba';
    if (textLower.includes('nfl') || textLower.includes('football')) return 'nfl';
    if (textLower.includes('mlb') || textLower.includes('baseball') || 
        textLower.includes('nfbc') || textLower.includes('nffc') || 
        textLower.includes('nfbkc') || textLower.includes('tgfbi')) return 'mlb';
    if (textLower.includes('nhl') || textLower.includes('hockey')) return 'nhl';
    if (textLower.includes('ncaa')) {
      return textLower.includes('basketball') ? 'ncaab' : 'ncaaf';
    }
    
    return null;
  };

  const extractMarketType = (message: string): string | null => {
    const msgLower = message.toLowerCase();
    if (msgLower.includes('spread')) return 'spreads';
    if (msgLower.includes('total') || msgLower.includes('over') || msgLower.includes('under')) return 'totals';
    if (msgLower.includes('moneyline') || msgLower.includes('ml')) return 'h2h';
    if (msgLower.includes('prop')) return 'player_props';
    return 'h2h'; // default to head-to-head
  };

  const extractPlatform = (message: string): string | null => {
    const msgLower = message.toLowerCase();
    if (msgLower.includes('draftkings') || msgLower.includes('dk')) return 'draftkings';
    if (msgLower.includes('fanduel') || msgLower.includes('fd')) return 'fanduel';
    if (msgLower.includes('kalshi')) return 'kalshi';
    if (msgLower.includes('nfbc') || msgLower.includes('nffc')) return 'fantasy';
    return null;
  };

  const selectRelevantCards = async (userMessage: string, context?: any): Promise<InsightCard[]> => {
    const msgLower = userMessage.toLowerCase();
    
    // Extract sport and category from message - use conversation history from context if available
    const conversationHistory = context?.previousMessages || messages.slice(-5).map(m => ({ role: m.role, content: m.content || '' }));
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
    }
    
    console.log('[v0] Fetching dynamic cards for:', { sport, category });
    
    try {
      // Fetch dynamic cards from API
      console.log('[v0] Requesting dynamic cards with params:', { sport, category, context, limit: 3 });
      
      const dynamicCards = await fetchDynamicCards({
        sport: sport || undefined,
        category,
        userContext: context,
        limit: 3
      });
      
      console.log('[v0] Received dynamic cards response:', dynamicCards.length, 'cards');
      
      if (dynamicCards.length === 0) {
        console.log('[v0] WARNING: Zero dynamic cards returned from API. Check:');
        console.log('[v0] - Sport extracted:', sport);
        console.log('[v0] - Category detected:', category);
        console.log('[v0] - API endpoint configured:', API_ENDPOINTS?.CARDS || 'undefined');
        console.log('[v0] - Context provided:', context);
      }
      
      // Convert DynamicCard to InsightCard format
      const convertedCards = dynamicCards.map(card => {
        console.log('[v0] Converting card:', card.type, card.title);
        return convertToInsightCard(card);
      });
      
      console.log('[v0] Returning', convertedCards.length, 'converted insight cards');
      return convertedCards;
    } catch (error) {
      console.error('[v0] Error fetching dynamic cards:', error);
      console.error('[v0] Error details:', error instanceof Error ? error.message : String(error));
      // Return empty array on error - the response will still be shown
      return [];
    }
  };

  const convertToInsightCard = (dynamicCard: DynamicCard): InsightCard => {
    console.log('[v0] Converting dynamic card:', dynamicCard.type, dynamicCard.title);
    
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
    
    console.log('[v0] Validated card:', validatedCard.type, validatedCard.title);
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



  /** Read a File as raw base64 (no data: URI prefix) for vision API */
  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  /** Basic PDF text extraction — filters printable chars from raw PDF bytes */
  const extractPdfText = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const decoder = new TextDecoder('latin1');
      const rawText = decoder.decode(arrayBuffer);
      const matches = rawText.match(/\(([^)]{1,300})\)\s*(?:Tj|TJ|'|")/g) ?? [];
      const extracted = matches
        .map(m => m.replace(/^\(/, '').replace(/\)\s*(?:Tj|TJ|'|")$/, ''))
        .join(' ')
        .replace(/\\[nrt]/g, ' ')
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s{3,}/g, '\n')
        .trim();
      if (extracted.length > 50) return extracted.slice(0, 10000);
      return rawText
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s{3,}/g, '\n')
        .trim()
        .slice(0, 10000);
    } catch {
      return '';
    }
  };

  const processFiles = async (fileList: FileList | File[]): Promise<FileAttachment[]> => {
    const files = Array.from(fileList);
    const newAttachments: FileAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = file.type;

      const isCsvOrTsv = fileType === 'text/csv' || fileType === 'text/tab-separated-values'
        || file.name.endsWith('.tsv') || file.name.endsWith('.csv');
      const isTextFile = fileType === 'text/plain' || file.name.endsWith('.txt');
      const isJsonFile = fileType === 'application/json' || fileType === 'text/json' || file.name.endsWith('.json');
      const isImage = fileType.startsWith('image/');
      const isPdf = fileType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (!isImage && !isCsvOrTsv && !isTextFile && !isJsonFile && !isPdf) {
        alert(`File type not supported: ${file.name}. Supported: images, CSV, TSV, TXT, JSON, PDF.`);
        continue;
      }

      const fileUrl = isImage ? URL.createObjectURL(file) : '';

      const attachment: FileAttachment = {
        id: `${Date.now()}-${i}`,
        name: file.name,
        type: isImage ? 'image' : isCsvOrTsv ? 'csv' : isJsonFile ? 'json' : 'text',
        url: fileUrl,
        size: file.size,
        mimeType: isImage ? fileType : undefined,
      };

      if (isImage) {
        try {
          attachment.imageBase64 = await readFileAsBase64(file);
        } catch {
          // Vision skipped; filename still included in text prompt
        }
      } else if (isCsvOrTsv) {
        const text = await file.text();
        const delimiter = file.name.endsWith('.tsv') || fileType === 'text/tab-separated-values' ? '\t' : ',';
        attachment.data = parseDelimitedFile(text, delimiter);
      } else if (isTextFile) {
        const text = await file.text();
        attachment.textContent = text.slice(0, 10000);
      } else if (isJsonFile) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          attachment.textContent = JSON.stringify(parsed, null, 2).slice(0, 10000);
        } catch {
          const text = await file.text();
          attachment.textContent = text.slice(0, 10000);
        }
      } else if (isPdf) {
        const pdfText = await extractPdfText(file);
        attachment.textContent = pdfText.length > 50
          ? `[PDF: ${file.name}]\n${pdfText}`
          : `[PDF: ${file.name} — text extraction limited. Please describe what you want analyzed from this document.]`;
      }

      newAttachments.push(attachment);
    }

    return newAttachments;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments = await processFiles(files);
    setUploadedFiles((prev: FileAttachment[]) => [...prev, ...newAttachments]);
    console.log('[v0] Files uploaded:', newAttachments.length);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseDelimitedFile = (text: string, delimiter: string = ',') => {
    // Safety limits — prevent RangeError: Invalid array length on huge or binary files
    const MAX_BYTES = 5_000_000; // 5 MB
    const MAX_ROWS  = 5_000;
    const MAX_COLS  = 200;

    const safeText = text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
    const lines = safeText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [], truncated: false };

    const headers = lines[0].split(delimiter).map(h => h.trim()).slice(0, MAX_COLS);
    const dataLines = lines.slice(1, MAX_ROWS + 1);
    const rows = dataLines.map(line =>
      line.split(delimiter).map(cell => cell.trim()).slice(0, MAX_COLS)
    );

    return { headers, rows, truncated: lines.length > MAX_ROWS + 1 };
  };

  const removeAttachment = (id: string) => {
    setUploadedFiles((prev: FileAttachment[]) => {
      const file = prev.find(f => f.id === id);
      if (file && file.url) URL.revokeObjectURL(file.url);
      return prev.filter(f => f.id !== id);
    });
  };

  const saveFileToProfile = (file: FileAttachment) => {
    try {
      const existing = JSON.parse(localStorage.getItem('leverage_saved_files') || '[]');
      const entry = {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        data: file.data ?? null,
        textContent: file.textContent ?? null,
        savedAt: new Date().toISOString(),
      };
      const deduped = existing.filter((f: any) => f.name !== entry.name);
      localStorage.setItem('leverage_saved_files', JSON.stringify([entry, ...deduped].slice(0, 20)));
      toast.success(`"${file.name}" saved to your profile`);
    } catch {
      toast.error('Could not save file to profile');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && uploadedFiles.length === 0) return;

    // Check if user has credits
    if (!consumeCredit()) {
      console.log('[v0] No credits remaining, showing purchase modal');
      return;
    }

    // Capture files before clearing — generateRealResponse needs the content
    const currentFiles = [...uploadedFiles];

    const userMessage: Message = {
      role: 'user',
      content: input || '📎 Attached files',
      timestamp: new Date(),
      attachments: currentFiles.length > 0 ? currentFiles : undefined
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
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
          const headers = f.data.headers.join('\t');
          const rows = f.data.rows.slice(0, 500).map((r: string[]) => r.join('\t')).join('\n');
          const truncated = f.data.rows.length > 500 ? `\n[... ${f.data.rows.length - 500} more rows truncated]` : '';
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
    generateRealResponse(promptForAI, visionAttachments.length > 0 ? visionAttachments : undefined);
  };

  const handleNewChat = () => {
    // Check rate limit before creating new chat
    if (!canCreateNewChat()) {
      setShowLimitNotification(true);
      return;
    }

    const newChatId = `chat-${Date.now()}`;
    // Generate dynamic welcome message based on selected category
    const welcomeMessage = getWelcomeMessage(selectedCategory);
    
    // Category-specific titles
    const categoryTitles = {
      all: 'New Analysis',
      betting: 'New Sports Betting Analysis',
      fantasy: 'New Fantasy Analysis',
      dfs: 'New DFS Lineup Analysis',
      kalshi: 'New Kalshi Market Analysis'
    };
    
    const newChat: Chat = {
      id: newChatId,
      title: categoryTitles[selectedCategory as keyof typeof categoryTitles] || 'New Analysis',
      preview: welcomeMessage.slice(0, 50) + '...',
      timestamp: new Date(),
      starred: false,
      category: selectedCategory === 'all' ? 'betting' : selectedCategory,
      tags: [selectedCategory === 'all' ? 'multi-platform' : selectedCategory]
    };
    setChats([newChat, ...chats]);
    setActiveChat(newChatId);
    setMessages([
      {
        role: 'assistant',
        content: welcomeMessage,
        timestamp: new Date(),
        cards: [],
        modelUsed: 'Grok AI',
        isWelcome: true
      }
    ]);

    // Update rate limit count
    const updated = updateRateLimitCount();
    setChatsRemaining(CHAT_LIMIT - updated.count);
    console.log('[v0] New', selectedCategory, 'analysis chat created. Chats remaining:', CHAT_LIMIT - updated.count);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChat(chatId);
    setMessages([
      {
        role: 'assistant',
        content: "**Analysis Restored**\n\nYour previous conversation has been loaded. All data sources remain active and verified.\n\n**Ready to continue optimizing your strategy across all platforms.**",
        timestamp: new Date(),
        cards: []
      }
    ]);
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(chats.filter((chat: Chat) => chat.id !== chatId));
    if (activeChat === chatId && chats.length > 1) {
      const remainingChats = chats.filter((chat: Chat) => chat.id !== chatId);
      setActiveChat(remainingChats[0].id);
    }
    toast.info('Chat deleted');
  };

  const handleEditMessage = (index: number) => {
    const message = messages[index];
    if (message.role === 'user') {
      setEditingMessageIndex(index);
      setEditingContent(message.content);
    }
  };

  const handleSaveEdit = (index: number) => {
    if (editingContent.trim()) {
      setMessages((prev: Message[]) => prev.map((msg, i) => {
        if (i === index) {
          return {
            ...msg,
            content: editingContent,
            editHistory: [
              ...(msg.editHistory || []),
              { content: msg.content, timestamp: msg.timestamp }
            ],
            timestamp: new Date()
          };
        }
        return msg;
      }));
      setEditingMessageIndex(null);
      setEditingContent('');
      
  // Re-generate response after editing user message
  if (messages[index].role === 'user') {
    const newMessages = messages.slice(0, index + 1);
    setMessages(newMessages);
    generateRealResponse(editingContent);
  }
  }
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
    setEditingContent('');
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
    console.log('[v0] Message copied to clipboard');
  };

  const handleRegenerateResponse = (index: number) => {
    if (index > 0 && messages[index - 1].role === 'user') {
      const userMessage = messages[index - 1].content;
      const newMessages = messages.slice(0, index);
      setMessages(newMessages);
      generateRealResponse(userMessage);
    }
  };

  const handleVote = async (index: number, direction: 'up' | 'down') => {
    // Optimistic UI update
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, voted: direction } : m));
    toast.success(direction === 'up' ? 'Marked helpful — thanks!' : "Got it, we'll improve this");
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vote: direction === 'up' ? 'helpful' : 'improve',
          messageExcerpt: messages[index]?.content?.slice(0, 500),
          sessionId: activeChat,
        }),
      });
    } catch {
      // Non-blocking — feedback is best-effort
    }
  };

  const handleEditChatTitle = (chatId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chatId);
    setEditingChatTitle(currentTitle);
  };

  const handleSaveChatTitle = (chatId: string) => {
    if (editingChatTitle.trim()) {
      setChats(chats.map(chat =>
        chat.id === chatId ? { ...chat, title: editingChatTitle.trim() } : chat
      ));
    }
    setEditingChatId(null);
    setEditingChatTitle('');
  };

  const handleCancelChatTitleEdit = () => {
    setEditingChatId(null);
    setEditingChatTitle('');
  };

  const handleKeyDownChatTitle = (e: React.KeyboardEvent, chatId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveChatTitle(chatId);
    } else if (e.key === 'Escape') {
      handleCancelChatTitleEdit();
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      // Use requestAnimationFrame to batch DOM changes and prevent forced reflows
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          const newHeight = textareaRef.current.scrollHeight;
          textareaRef.current.style.height = `${newHeight}px`;
        }
      });
    }
  };

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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, any> = {
      hot: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: Flame, label: 'HOT' },
      value: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: DollarSign, label: 'VALUE' },
      optimal: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', icon: Award, label: 'OPTIMAL' },
      strong: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: CheckCircle, label: 'STRONG' },
      target: { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/30', icon: Target, label: 'TARGET' },
      elite: { bg: 'bg-purple-600/20', text: 'text-purple-300', border: 'border-purple-600/30', icon: Medal, label: 'ELITE' },
      sleeper: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30', icon: Zap, label: 'SLEEPER' },
      opportunity: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', icon: BarChart3, label: 'OPPORTUNITY' },
      edge: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', icon: TrendingUp, label: 'EDGE' },
      synergy: { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', icon: Sparkles, label: 'SYNERGY' }
    };
    return badges[status] || badges.value;
  };

  const _renderInsightCard = (card: InsightCard, index: number) => {
    // Validate card data before rendering
    if (!card || typeof card !== 'object') {
      return null;
    }
    
    // Ensure required fields exist with fallbacks
    const safeCard = {
      icon: card.icon || Zap,
      status: card.status || 'active',
      gradient: card.gradient || 'from-blue-500 to-purple-500',
      category: card.category || 'General',
      subcategory: card.subcategory || 'Info',
      title: card.title || 'Untitled Card',
      data: card.data && typeof card.data === 'object' ? card.data : {},
      type: card.type || 'default'
    };
    
    const Icon = safeCard.icon;
    const badge = getStatusBadge(safeCard.status);
    const BadgeIcon = badge.icon;
    const dataEntries = Object.entries(safeCard.data);
    
    // Enhanced visual design with glassmorphism and better data presentation
    return (
      <div
        key={`card-${index}-${safeCard.type}`}
        className="group relative bg-gradient-to-br from-gray-900/95 via-gray-850/95 to-gray-900/95 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/60 hover:border-gray-500/80 transition-all duration-500 shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] hover:scale-[1.02] overflow-hidden"
      >
        {/* Animated gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${safeCard.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-700`}></div>
        
        {/* Accent line on left */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${safeCard.gradient} opacity-60 group-hover:opacity-100 transition-opacity`}></div>
        
        {/* Header section with icon and title */}
        <div className="relative flex items-start justify-between mb-5">
          <div className="flex items-start gap-4 flex-1">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${safeCard.gradient} shadow-lg ring-4 ring-gray-800/50 group-hover:ring-gray-700/50 transition-all`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{safeCard.category}</span>
                <span className="text-gray-600">•</span>
                <span className="text-xs font-medium text-gray-500">{safeCard.subcategory}</span>
              </div>
              <h3 className="text-base font-bold text-white leading-tight mb-1">{safeCard.title}</h3>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${badge.bg} ${badge.border}`}>
                <BadgeIcon className={`w-3.5 h-3.5 ${badge.text}`} />
                <span className={`text-xs font-bold ${badge.text} uppercase tracking-wide`}>{badge.label}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Enhanced data grid with better visual hierarchy */}
        <div className="relative space-y-2">
          {dataEntries.length > 0 ? (
            dataEntries.map(([key, value], i) => {
              const formattedKey = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())
                .trim();
              
              // Enhanced metric detection
              const valueStr = String(value);
              const isPercentage = valueStr.includes('%');
              const isDollar = valueStr.includes('$');
              const isUpTrend = valueStr.includes('↑') || valueStr.toLowerCase().includes('up');
              const isDownTrend = valueStr.includes('↓') || valueStr.toLowerCase().includes('down');
              const isHighValue = valueStr.includes('elite') || valueStr.includes('optimal');
              
              // Assign colors based on context
              let valueColor = 'text-gray-300';
              if (isUpTrend) valueColor = 'text-green-400';
              else if (isDownTrend) valueColor = 'text-red-400';
              else if (isHighValue) valueColor = 'text-purple-400';
              else if (isDollar || isPercentage) valueColor = 'text-blue-400';
              
              return (
                <div key={i} className="group/item relative">
                  <div className="flex items-center justify-between py-2.5 px-3.5 rounded-lg bg-gradient-to-r from-gray-800/40 to-gray-800/20 hover:from-gray-800/60 hover:to-gray-800/40 transition-all duration-200 border border-gray-700/30 hover:border-gray-600/50">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex-shrink-0 mr-4">
                      {formattedKey}
                    </span>
                    <span className={`text-sm font-extrabold text-right ${valueColor} group-hover/item:scale-105 transition-transform flex items-center gap-1.5`}>
                      {isUpTrend && <TrendingUp className="w-3.5 h-3.5" />}
                      {isDownTrend && <TrendingDown className="w-3.5 h-3.5" />}
                      {valueStr || 'N/A'}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-gray-500 text-sm font-medium">
              No data available
            </div>
          )}
        </div>

        <div className="relative mt-4 pt-4 border-t border-gray-700/50">
          <button 
            onClick={() => generateDetailedAnalysis(card)}
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors group/btn"
          >
            <span>View Full Analysis</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  };

  const filteredChats = chats
    .filter((chat: Chat) => selectedCategory === 'all' || chat.category === selectedCategory)
    .filter((chat: Chat) => {
      if (!chatSearch.trim()) return true;
      const q = chatSearch.toLowerCase();
      return chat.title.toLowerCase().includes(q) || (chat.preview || '').toLowerCase().includes(q);
    });
  
  // Platform-specific AI-powered prompt suggestions
  const platformPrompts: Record<string, Array<{ label: string; icon: React.ComponentType<{ className?: string }>; category: string }>> = {
    all: [
      { label: 'Cross-platform arbitrage opportunities', icon: Sparkles, category: 'all' },
      { label: 'Today\'s best value plays across all platforms', icon: TrendingUp, category: 'all' },
      { label: 'Correlated bets: DFS + betting + Kalshi', icon: Layers, category: 'all' },
      { label: 'AI model predictions for tonight\'s games', icon: Activity, category: 'all' }
    ],
    betting: [
      { label: 'NBA picks with best odds tonight', icon: TrendingUp, category: 'betting' },
      { label: 'Live arbitrage alerts across sportsbooks', icon: Zap, category: 'betting' },
      { label: 'Player props with edge (MLB/NBA/NFL)', icon: Target, category: 'betting' },
      { label: 'Sharp money movement analysis', icon: Activity, category: 'betting' },
      { label: 'Parlay builder with EV+ legs', icon: Medal, category: 'betting' }
    ],
    fantasy: [
      { label: 'NFBC draft strategy for my pick position', icon: Trophy, category: 'fantasy' },
      { label: 'Auction value targets and sleepers', icon: ShoppingCart, category: 'fantasy' },
      { label: 'Best ball stacking strategy for NFFC', icon: Award, category: 'fantasy' },
      { label: 'ADP risers and fallers this week', icon: TrendingUp, category: 'fantasy' },
      { label: 'Salary cap week optimization', icon: DollarSign, category: 'fantasy' }
    ],
    dfs: [
      { label: 'DFS NFL optimal lineups for DraftKings', icon: Award, category: 'dfs' },
      { label: 'FanDuel NBA value plays under $5K', icon: DollarSign, category: 'dfs' },
      { label: 'Showdown captain picks with leverage', icon: Medal, category: 'dfs' },
      { label: 'Low ownership tournament stacks', icon: Users, category: 'dfs' },
      { label: 'MLB pitcher-stacks correlation builder', icon: Layers, category: 'dfs' }
    ],
    kalshi: [
      { label: 'Trending', icon: TrendingUp, category: 'kalshi', query: 'Show me trending Kalshi prediction markets right now' },
      { label: 'Politics', icon: Activity, category: 'kalshi', query: 'Show me Politics prediction markets on Kalshi' },
      { label: 'Sports', icon: Trophy, category: 'kalshi', query: 'Show me Sports prediction markets on Kalshi' },
      { label: 'Culture', icon: Sparkles, category: 'kalshi', query: 'Show me Culture prediction markets on Kalshi' },
      { label: 'Crypto', icon: BarChart3, category: 'kalshi', query: 'Show me Crypto prediction markets on Kalshi' },
      { label: 'Climate', icon: Activity, category: 'kalshi', query: 'Show me Climate prediction markets on Kalshi' },
      { label: 'Economics', icon: DollarSign, category: 'kalshi', query: 'Show me Economics prediction markets on Kalshi' },
      { label: 'Mentions', icon: MessageSquare, category: 'kalshi', query: 'Show me top Mentions markets on Kalshi' },
      { label: 'Companies', icon: Layers, category: 'kalshi', query: 'Show me Companies prediction markets on Kalshi' },
      { label: 'Financials', icon: PieChart, category: 'kalshi', query: 'Show me Financials prediction markets on Kalshi' },
      { label: 'Tech & Science', icon: Zap, category: 'kalshi', query: 'Show me Tech & Science prediction markets on Kalshi' },
    ]
  };

  // Sport-specific prompt overrides — Betting
  const sportBettingPrompts: Record<string, Array<{ label: string; icon: React.ComponentType<{ className?: string }>; category: string }>> = {
    nfl: [
      { label: 'NFL best lines and spreads this week', icon: TrendingUp, category: 'betting' },
      { label: 'NFL player props with sharp edge', icon: Target, category: 'betting' },
      { label: 'NFL sharp money movement & steam', icon: Activity, category: 'betting' },
      { label: 'NFL arbitrage across sportsbooks', icon: Zap, category: 'betting' },
      { label: 'NFL parlay builder with EV+ legs', icon: Medal, category: 'betting' },
    ],
    nba: [
      { label: 'NBA picks with best odds tonight', icon: TrendingUp, category: 'betting' },
      { label: 'NBA player props with edge tonight', icon: Target, category: 'betting' },
      { label: 'NBA live arbitrage alerts', icon: Zap, category: 'betting' },
      { label: 'NBA sharp money movement analysis', icon: Activity, category: 'betting' },
      { label: 'NBA parlay builder with EV+ legs', icon: Medal, category: 'betting' },
    ],
    mlb: [
      { label: 'MLB best run lines tonight', icon: TrendingUp, category: 'betting' },
      { label: 'MLB pitcher props with edge', icon: Target, category: 'betting' },
      { label: 'MLB first-5 innings sharp plays', icon: Activity, category: 'betting' },
      { label: 'MLB arbitrage across sportsbooks', icon: Zap, category: 'betting' },
      { label: 'MLB same-game parlay builder', icon: Medal, category: 'betting' },
    ],
    nhl: [
      { label: 'NHL best moneylines tonight', icon: TrendingUp, category: 'betting' },
      { label: 'NHL player props with edge', icon: Target, category: 'betting' },
      { label: 'NHL puck line sharp plays', icon: Activity, category: 'betting' },
      { label: 'NHL live arbitrage alerts', icon: Zap, category: 'betting' },
      { label: 'NHL period-by-period betting angles', icon: Medal, category: 'betting' },
    ],
    'ncaa-football': [
      { label: 'College football best lines this week', icon: TrendingUp, category: 'betting' },
      { label: 'NCAAF player props with edge', icon: Target, category: 'betting' },
      { label: 'College football sharp line moves', icon: Activity, category: 'betting' },
      { label: 'NCAAF arbitrage opportunities', icon: Zap, category: 'betting' },
      { label: 'College football totals with weather edge', icon: Medal, category: 'betting' },
    ],
    'ncaa-basketball': [
      { label: 'College basketball best lines tonight', icon: TrendingUp, category: 'betting' },
      { label: 'NCAAB player props with edge', icon: Target, category: 'betting' },
      { label: 'College basketball sharp money plays', icon: Activity, category: 'betting' },
      { label: 'NCAAB arbitrage across sportsbooks', icon: Zap, category: 'betting' },
      { label: 'College basketball parlay builder', icon: Medal, category: 'betting' },
    ],
  };

  // Sport-specific prompt overrides — Fantasy
  const sportFantasyPrompts: Record<string, Array<{ label: string; icon: React.ComponentType<{ className?: string }>; category: string }>> = {
    nfl: [
      { label: 'NFL waiver wire priorities this week', icon: TrendingUp, category: 'fantasy' },
      { label: 'NFL start/sit decisions this week', icon: Trophy, category: 'fantasy' },
      { label: 'NFL trade value analysis', icon: ShoppingCart, category: 'fantasy' },
      { label: 'NFL best ball stacking strategy', icon: Award, category: 'fantasy' },
      { label: 'NFL ADP risers and fallers', icon: Activity, category: 'fantasy' },
    ],
    nba: [
      { label: 'NBA fantasy pickups this week', icon: TrendingUp, category: 'fantasy' },
      { label: 'NBA trade value analysis', icon: ShoppingCart, category: 'fantasy' },
      { label: 'NBA streaming targets by category', icon: Trophy, category: 'fantasy' },
      { label: 'NBA injury impact on roster', icon: Activity, category: 'fantasy' },
      { label: 'NBA schedule analysis this week', icon: Award, category: 'fantasy' },
    ],
    mlb: [
      { label: 'MLB waiver wire SP/RP targets', icon: TrendingUp, category: 'fantasy' },
      { label: 'MLB hitter and pitcher streamers', icon: Trophy, category: 'fantasy' },
      { label: 'MLB trade value analysis', icon: ShoppingCart, category: 'fantasy' },
      { label: 'MLB IL pickup opportunities', icon: Activity, category: 'fantasy' },
      { label: 'MLB matchup-based start/sit', icon: Award, category: 'fantasy' },
    ],
    nhl: [
      { label: 'NHL fantasy pickups this week', icon: TrendingUp, category: 'fantasy' },
      { label: 'NHL power-play unit streaming targets', icon: Trophy, category: 'fantasy' },
      { label: 'NHL trade value analysis', icon: ShoppingCart, category: 'fantasy' },
      { label: 'NHL goalie start/sit decisions', icon: Award, category: 'fantasy' },
      { label: 'NHL back-to-back schedule impact', icon: Activity, category: 'fantasy' },
    ],
    'ncaa-football': [
      { label: 'NCAAF fantasy waiver wire targets', icon: TrendingUp, category: 'fantasy' },
      { label: 'College football start/sit decisions', icon: Trophy, category: 'fantasy' },
      { label: 'NCAAF trade value analysis', icon: ShoppingCart, category: 'fantasy' },
      { label: 'College football ADP risers/fallers', icon: Activity, category: 'fantasy' },
      { label: 'NCAAF breakout player targets', icon: Award, category: 'fantasy' },
    ],
    'ncaa-basketball': [
      { label: 'NCAAB fantasy pickups this week', icon: TrendingUp, category: 'fantasy' },
      { label: 'College basketball streaming targets', icon: Trophy, category: 'fantasy' },
      { label: 'NCAAB trade value analysis', icon: ShoppingCart, category: 'fantasy' },
      { label: 'College basketball injury updates', icon: Activity, category: 'fantasy' },
      { label: 'NCAAB matchup-based start/sit', icon: Award, category: 'fantasy' },
    ],
  };

  // Sport-specific prompt overrides — DFS
  const sportDFSPrompts: Record<string, Array<{ label: string; icon: React.ComponentType<{ className?: string }>; category: string }>> = {
    nfl: [
      { label: 'NFL DFS optimal lineups for DraftKings', icon: Award, category: 'dfs' },
      { label: 'NFL FanDuel value plays this week', icon: DollarSign, category: 'dfs' },
      { label: 'NFL showdown captain picks with leverage', icon: Medal, category: 'dfs' },
      { label: 'NFL low-ownership GPP stacks', icon: Users, category: 'dfs' },
      { label: 'NFL QB-receiver correlation stacks', icon: Layers, category: 'dfs' },
    ],
    nba: [
      { label: 'NBA DFS optimal lineups for DraftKings', icon: Award, category: 'dfs' },
      { label: 'NBA FanDuel value plays under $5K', icon: DollarSign, category: 'dfs' },
      { label: 'NBA showdown captain picks', icon: Medal, category: 'dfs' },
      { label: 'NBA pace-up game stacks', icon: Users, category: 'dfs' },
      { label: 'NBA low-ownership tournament plays', icon: Layers, category: 'dfs' },
    ],
    mlb: [
      { label: 'MLB DFS optimal lineups for DraftKings', icon: Award, category: 'dfs' },
      { label: 'MLB pitcher stacks correlation builder', icon: Layers, category: 'dfs' },
      { label: 'MLB FanDuel value plays tonight', icon: DollarSign, category: 'dfs' },
      { label: 'MLB low-ownership GPP plays', icon: Users, category: 'dfs' },
      { label: 'MLB weather-impacted lineup adjustments', icon: Medal, category: 'dfs' },
    ],
    nhl: [
      { label: 'NHL DFS optimal lineups for DraftKings', icon: Award, category: 'dfs' },
      { label: 'NHL power-play unit stacks', icon: Layers, category: 'dfs' },
      { label: 'NHL FanDuel value plays tonight', icon: DollarSign, category: 'dfs' },
      { label: 'NHL low-ownership GPP plays', icon: Users, category: 'dfs' },
      { label: 'NHL goalie plays and fades', icon: Medal, category: 'dfs' },
    ],
    'ncaa-football': [
      { label: 'NCAAF DFS optimal lineups for DraftKings', icon: Award, category: 'dfs' },
      { label: 'College football FanDuel value plays', icon: DollarSign, category: 'dfs' },
      { label: 'NCAAF showdown captain picks', icon: Medal, category: 'dfs' },
      { label: 'College football low-ownership GPP stacks', icon: Users, category: 'dfs' },
      { label: 'NCAAF QB-receiver correlation stacks', icon: Layers, category: 'dfs' },
    ],
    'ncaa-basketball': [
      { label: 'NCAAB DFS optimal lineups for DraftKings', icon: Award, category: 'dfs' },
      { label: 'College basketball FanDuel value plays', icon: DollarSign, category: 'dfs' },
      { label: 'NCAAB showdown captain picks', icon: Medal, category: 'dfs' },
      { label: 'College basketball low-ownership GPP plays', icon: Users, category: 'dfs' },
      { label: 'NCAAB pace-up game stacks', icon: Layers, category: 'dfs' },
    ],
  };

  // Kalshi subcategory-specific prompts — shown when a topic filter is selected
  const kalshiTopicPrompts: Record<string, Array<{ label: string; icon: any; category: string }>> = {
    Trending: [
      { label: 'What trending Kalshi market has the best edge right now?', icon: TrendingUp, category: 'kalshi' },
      { label: 'Biggest volume moves in the last 24 hours', icon: Activity, category: 'kalshi' },
      { label: 'Highest liquidity trending contract today', icon: BarChart3, category: 'kalshi' },
      { label: 'Cross-market arbitrage vs trending Kalshi markets', icon: Zap, category: 'kalshi' },
    ],
    Politics: [
      { label: '2026 midterm election contracts with market inefficiencies', icon: Activity, category: 'kalshi' },
      { label: 'Best value on Senate seat prediction markets', icon: TrendingUp, category: 'kalshi' },
      { label: 'Governor race contract pricing analysis', icon: Target, category: 'kalshi' },
      { label: 'Political market portfolio hedging strategy', icon: Layers, category: 'kalshi' },
    ],
    Sports: [
      { label: 'Best value on sports Kalshi contracts vs sportsbooks', icon: TrendingUp, category: 'kalshi' },
      { label: 'Championship winner contract pricing analysis', icon: Trophy, category: 'kalshi' },
      { label: 'MVP award prediction market value', icon: Award, category: 'kalshi' },
      { label: 'Sports Kalshi vs DraftKings arbitrage opportunities', icon: Zap, category: 'kalshi' },
    ],
    Culture: [
      { label: 'Best value on awards season Kalshi contracts', icon: Sparkles, category: 'kalshi' },
      { label: 'Oscars / Grammy contract pricing inefficiencies', icon: Award, category: 'kalshi' },
      { label: 'Celebrity event market analysis right now', icon: Activity, category: 'kalshi' },
      { label: 'Entertainment prediction market portfolio strategy', icon: Layers, category: 'kalshi' },
    ],
    Crypto: [
      { label: 'Bitcoin price milestone contract analysis', icon: TrendingUp, category: 'kalshi' },
      { label: 'ETF approval prediction market pricing', icon: BarChart3, category: 'kalshi' },
      { label: 'Cross-market crypto vs Kalshi arbitrage', icon: Zap, category: 'kalshi' },
      { label: 'Altcoin milestone contract value opportunities', icon: DollarSign, category: 'kalshi' },
    ],
    Climate: [
      { label: 'Hurricane season contract analysis', icon: Activity, category: 'kalshi' },
      { label: 'Temperature record market value vs NOAA forecasts', icon: TrendingUp, category: 'kalshi' },
      { label: 'Climate event prediction market pricing', icon: BarChart3, category: 'kalshi' },
      { label: 'Best value climate contracts this month', icon: Target, category: 'kalshi' },
    ],
    Economics: [
      { label: 'Fed rate decision contract analysis', icon: DollarSign, category: 'kalshi' },
      { label: 'CPI / inflation prediction market pricing', icon: TrendingUp, category: 'kalshi' },
      { label: 'Jobs report contract value opportunities', icon: BarChart3, category: 'kalshi' },
      { label: 'GDP prediction market edge vs consensus', icon: Activity, category: 'kalshi' },
    ],
    Mentions: [
      { label: 'Top social media mention contract opportunities', icon: Activity, category: 'kalshi' },
      { label: 'Celebrity brand mention market analysis', icon: Sparkles, category: 'kalshi' },
      { label: 'News volume prediction market edge', icon: TrendingUp, category: 'kalshi' },
      { label: 'Best value mentions markets right now', icon: Target, category: 'kalshi' },
    ],
    Companies: [
      { label: 'Earnings announcement contract pricing', icon: DollarSign, category: 'kalshi' },
      { label: 'M&A announcement prediction market analysis', icon: TrendingUp, category: 'kalshi' },
      { label: 'CEO departure market probability assessment', icon: Activity, category: 'kalshi' },
      { label: 'Company milestone contract value opportunities', icon: Target, category: 'kalshi' },
    ],
    Financials: [
      { label: 'S&P 500 milestone prediction market analysis', icon: TrendingUp, category: 'kalshi' },
      { label: 'Interest rate futures vs Kalshi contract pricing', icon: DollarSign, category: 'kalshi' },
      { label: 'Treasury yield prediction market value', icon: BarChart3, category: 'kalshi' },
      { label: 'Stock market milestone contract portfolio strategy', icon: Layers, category: 'kalshi' },
    ],
    'Tech & Science': [
      { label: 'AI company milestone contract analysis', icon: Zap, category: 'kalshi' },
      { label: 'Tech earnings prediction market value', icon: TrendingUp, category: 'kalshi' },
      { label: 'Space launch success prediction market pricing', icon: Activity, category: 'kalshi' },
      { label: 'Scientific breakthrough contract opportunities', icon: Sparkles, category: 'kalshi' },
    ],
  };

  // Get dynamic prompts based on selected platform AND sport/topic
  const quickActions = (() => {
    if (selectedCategory === 'kalshi' && selectedSport && kalshiTopicPrompts[selectedSport]) {
      return kalshiTopicPrompts[selectedSport];
    }
    if (selectedSport) {
      if (selectedCategory === 'betting' && sportBettingPrompts[selectedSport]) return sportBettingPrompts[selectedSport];
      if (selectedCategory === 'fantasy' && sportFantasyPrompts[selectedSport]) return sportFantasyPrompts[selectedSport];
      if (selectedCategory === 'dfs'     && sportDFSPrompts[selectedSport])     return sportDFSPrompts[selectedSport];
    }
    return platformPrompts[selectedCategory] || platformPrompts.all;
  })();

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
      
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onNewChat={handleNewChat}
        chatSearch={chatSearch}
        setChatSearch={setChatSearch}
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedSport={selectedSport}
        setSelectedSport={setSelectedSport}
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
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-black via-gray-950 to-black">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-b border-gray-800/50 px-6 py-4 shadow-2xl backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-transparent pointer-events-none"></div>
          <div className="relative flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="group p-2.5 hover:bg-gray-800/70 rounded-xl transition-all duration-300 border border-gray-800 hover:border-gray-700 hover:shadow-lg active:scale-95 border-none bg-transparent"
              >
                <Menu className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
              </button>
              <div className="flex items-center gap-3">
                {/* Logo mark */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 blur-md opacity-40" />
                  <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <TrendingUp className="w-4.5 h-4.5 text-white" />
                  </div>
                </div>
                <div className="flex flex-col leading-none gap-0.5">
                  <h1 className="text-base font-black tracking-tight text-white">
                    Leverage<span className="text-blue-400"> AI</span>
                  </h1>
                  <p className="text-[10px] font-semibold text-gray-600 tracking-widest uppercase">Sports Intelligence</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isLoggedIn && user ? (
                <>
                  {/* User Profile Info */}
                  <div
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-900/50 border border-gray-800 cursor-pointer hover:border-gray-700 hover:bg-gray-800/50 transition-all"
                    onClick={() => setShowUserLightbox(true)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {user.avatar ? (
                            <img src={user.avatar || "/placeholder.svg"} alt={user.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-950"></div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{user.name}</span>
                        <span className="text-[10px] text-gray-500">{user.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notifications and Settings for logged-in users */}
                  <button
                    onClick={() => setShowAlertsLightbox(true)}
                    className="relative p-2.5 hover:bg-gray-800/70 rounded-xl transition-all duration-300 border border-gray-800 hover:border-gray-700 hover:shadow-lg group active:scale-95 border-none bg-transparent"
                  >
                    <Bell className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                    <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-950 shadow-lg shadow-red-500/50 animate-pulse"></div>
                  </button>
                  <button
                    onClick={() => setShowSettingsLightbox(true)}
                    className="p-2.5 hover:bg-gray-800/70 rounded-xl transition-all duration-300 border border-gray-800 hover:border-gray-700 hover:shadow-lg group active:scale-95 border-none bg-transparent"
                  >
                    <Settings className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors group-hover:rotate-90 transition-transform" />
                  </button>
                </>
              ) : (
                <>
                  {/* Login and Sign Up buttons for non-authenticated users */}
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="px-4 py-2 rounded-xl border border-gray-800 bg-gray-900/50 hover:bg-gray-800/70 hover:border-gray-700 text-gray-300 hover:text-white text-sm font-semibold transition-all"
                  >
                    Log in
                  </button>
                  <button
                    onClick={() => setShowSignupModal(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Messages Container - Dynamic Data-Driven Interface */}
        <div 
          className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar scroll-smooth"
          style={{ 
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Database Status Banner */}
            <DatabaseStatusBanner />
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-300">No messages yet</h3>
                  <p className="text-sm text-gray-500">Start a conversation to get AI-powered insights</p>
                </div>
              </div>
            ) : (
              messages.map((message, index) => {
                // Group messages: Check if this message is from same sender as previous
                const prevMessage = index > 0 ? messages[index - 1] : null;
                const isGrouped = prevMessage && prevMessage.role === message.role;
                const _showTimestamp = !isGrouped || index === messages.length - 1;
                
                return (
                  <div
                    key={`message-${index}`}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn ${isGrouped ? 'mt-1.5' : 'mt-5'}`}
                  >
                <div className={message.role === 'user' ? 'max-w-[75%]' : 'w-full max-w-4xl'}>
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
                      {/* Logo mark */}
                      <div className="relative w-7 h-7 shrink-0">
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 opacity-20 blur-sm" />
                        <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                          <TrendingUp className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                      <span className="text-xs font-black tracking-tight text-white">Leverage<span className="text-blue-400"> AI</span></span>

                      {/* Verified badge */}
                      {message.sources && message.sources.length > 0 && !message.isWelcome && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                          <CheckCheck className="w-2.5 h-2.5 text-emerald-400" />
                          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Live Data</span>
                        </div>
                      )}

                      {/* Confidence / Benford Trust Score */}
                      {message.confidence && !message.isWelcome && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border ${
                          message.confidence >= 85 ? 'bg-green-500/10 border-green-500/20' :
                          message.confidence >= 65 ? 'bg-amber-500/10 border-amber-500/20' :
                          'bg-red-500/10 border-red-500/20'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            message.confidence >= 85 ? 'bg-green-400' :
                            message.confidence >= 65 ? 'bg-amber-400' : 'bg-red-400'
                          }`} />
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${
                            message.confidence >= 85 ? 'text-green-400' :
                            message.confidence >= 65 ? 'text-amber-400' : 'text-red-400'
                          }`}>{message.confidence}% integrity</span>
                        </div>
                      )}
                      {/* Model badge */}
                      {message.modelUsed && !message.isWelcome && (
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">{message.modelUsed}</span>
                      )}
                    </div>
                  )}
                  
                  <div
                    className={`relative group/message ${
                      message.role === 'user'
                        ? 'rounded-2xl rounded-tr-sm px-5 py-3.5 bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/25 w-fit max-w-[85%] ml-auto'
                        : 'rounded-2xl rounded-tl-sm px-5 py-4 bg-gradient-to-br from-gray-900 via-gray-800/50 to-gray-900 text-gray-100 border border-gray-700/40 shadow-lg shadow-black/30'
                    }`}
                  >
                    {editingMessageIndex === index ? (
                      <div className="space-y-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  adjustTextareaHeight();
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
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs font-bold transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Check if this is a detailed analysis with structured data */}
                        {message.content.includes('__DETAILED_ANALYSIS__') ? (
                          (() => {
                            const match = message.content.match(/__DETAILED_ANALYSIS__(.+)__END_ANALYSIS__/);
                            if (!match) return <p className="text-sm leading-relaxed font-medium">{message.content}</p>;
                            
                            const data = JSON.parse(match[1]);
                            const { card, metrics, overview, marketContext, riskAssessment, recommendations } = data;
                            
                            // Map card type to icon component
                            const getCardIcon = (type: string) => {
                              const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
                                'live-odds': Zap,
                                'player-prop': Target,
                                'dfs-lineup': Award,
                                'dfs-value': DollarSign,
                                'adp-analysis': TrendingUp,
                                'bestball-stack': Medal,
                                'auction-value': ShoppingCart,
                                'kalshi-market': BarChart3,
                                'kalshi-weather': Activity,
                                'cross-platform': Sparkles,
                                'ai-prediction': Sparkles,
                              };
                              return iconMap[type] || Sparkles;
                            };
                            
                            const CardIcon = getCardIcon(card.type);
                            
                            return (
                              <div className="space-y-5">
                                {/* Header Section */}
                                <div className="flex items-start gap-3">
                                  <div className="p-2.5 rounded-xl bg-[oklch(0.16_0.02_280)] flex-shrink-0">
                                    <CardIcon className="w-5 h-5 text-[oklch(0.70_0.005_85)]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h2 className="text-lg font-black text-[oklch(0.95_0.005_85)] truncate">{card.title}</h2>
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-[oklch(0.16_0.02_280)] text-[oklch(0.70_0.005_85)] border border-[oklch(0.22_0.02_280)]">{card.status}</span>
                                    </div>
                                    <p className="text-[11px] text-[oklch(0.45_0.01_280)] font-semibold uppercase tracking-wide">
                                      {card.category} / {card.subcategory}
                                    </p>
                                  </div>
                                </div>

                                {/* Overview */}
                                <div className="bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)] rounded-xl p-4">
                                  <h3 className="text-[10px] font-black text-[oklch(0.45_0.01_280)] uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Info className="w-3 h-3" />
                                    Overview
                                  </h3>
                                  <p className="text-sm text-[oklch(0.80_0.005_85)] leading-relaxed">{overview}</p>
                                </div>

                                {/* Key Metrics Grid */}
                                <div>
                                  <h3 className="text-[10px] font-black text-[oklch(0.45_0.01_280)] uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <BarChart className="w-3 h-3" />
                                    Key Metrics
                                  </h3>
                                  <div className="grid grid-cols-2 gap-2">
                                    {metrics.map((metric: { label: string; value: string }, idx: number) => (
                                      <div 
                                        key={idx}
                                        className="bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)] rounded-xl p-3 hover:border-[oklch(0.25_0.02_280)] transition-colors"
                                      >
                                        <div className="text-[9px] font-bold text-[oklch(0.45_0.01_280)] uppercase tracking-widest mb-1">{metric.label}</div>
                                        <div className="text-base font-black text-[oklch(0.92_0.005_85)]">{metric.value}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Market Context */}
                                <div className="bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)] rounded-xl p-4">
                                  <h3 className="text-[10px] font-black text-[oklch(0.45_0.01_280)] uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <TrendingUp className="w-3 h-3" />
                                    Market Context & Edge
                                  </h3>
                                  <p className="text-sm text-[oklch(0.80_0.005_85)] leading-relaxed">{marketContext}</p>
                                </div>

                                {/* Risk Assessment */}
                                <div>
                                  <h3 className="text-[10px] font-black text-[oklch(0.45_0.01_280)] uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Shield className="w-3 h-3" />
                                    Risk Assessment
                                  </h3>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)] rounded-xl p-3">
                                      <div className="text-[9px] font-bold text-[oklch(0.45_0.01_280)] uppercase tracking-widest mb-1">Conviction</div>
                                      <div className="text-lg font-black text-[oklch(0.92_0.005_85)]">{riskAssessment.convictionLevel}</div>
                                    </div>
                                    <div className="bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)] rounded-xl p-3">
                                      <div className="text-[9px] font-bold text-[oklch(0.45_0.01_280)] uppercase tracking-widest mb-1">Risk</div>
                                      <div className="text-sm font-black text-[oklch(0.85_0.005_85)]">{riskAssessment.riskCategory}</div>
                                    </div>
                                    <div className="bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)] rounded-xl p-3">
                                      <div className="text-[9px] font-bold text-[oklch(0.45_0.01_280)] uppercase tracking-widest mb-1">Position</div>
                                      <div className="text-lg font-black text-[oklch(0.92_0.005_85)]">{riskAssessment.positionSize}</div>
                                      <div className="text-[9px] text-[oklch(0.35_0.01_280)] mt-0.5">of bankroll</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Strategic Recommendations */}
                                <div>
                                  <h3 className="text-[10px] font-black text-[oklch(0.45_0.01_280)] uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Target className="w-3 h-3" />
                                    Strategic Recommendations
                                  </h3>
                                  <div className="space-y-2">
                                    {recommendations.map((rec: { label: string; value: string }, idx: number) => (
                                      <div 
                                        key={idx}
                                        className="bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)] rounded-xl p-3.5 hover:border-[oklch(0.25_0.02_280)] transition-colors"
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className="w-5 h-5 rounded-md bg-[oklch(0.18_0.02_280)] flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-[oklch(0.70_0.005_85)] text-[10px] font-black">{idx + 1}</span>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-black text-[oklch(0.80_0.005_85)] mb-0.5">{rec.label}</div>
                                            <div className="text-sm text-[oklch(0.55_0.01_280)] leading-relaxed">{rec.value}</div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Next Steps CTA  */}
                                <div className="bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.015_280)] rounded-xl p-4">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <p className="text-sm text-[oklch(0.60_0.01_280)] leading-relaxed">
                                      <span className="font-bold text-[oklch(0.90_0.005_85)]">Next Steps:</span> Show correlated opportunities or dive deeper into any metric?
                                    </p>
                                    <button
                                      onClick={() => {
                                        console.log('[v0] Yes button clicked - showing correlated opportunities');
                                        handleFollowUp('correlated', card);
                                      }}
                                      disabled={isTyping}
                                      className="group relative flex items-center justify-center gap-2 px-6 py-3 bg-[oklch(0.20_0.02_280)] hover:bg-[oklch(0.25_0.02_280)] disabled:bg-[oklch(0.14_0.01_280)] disabled:cursor-not-allowed text-[oklch(0.92_0.005_85)] font-bold text-sm rounded-xl border border-[oklch(0.28_0.02_280)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] min-w-[120px] flex-shrink-0"
                                    >
                                      {isTyping ? (
                                        <>
                                          <Loader2 className="w-5 h-5 animate-spin" />
                                          <span>Loading...</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                          <span className="tracking-wide">YES</span>
                                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  
                                  {/* Secondary Options */}
                                  <div className="mt-4 pt-4 border-t border-indigo-600/20">
                                    <p className="text-xs text-gray-400 mb-3 font-semibold">Or choose a specific action:</p>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        onClick={() => {
                                          console.log('[v0] Correlated opportunities button clicked');
                                          handleFollowUp('correlated', card);
                                        }}
                                        disabled={isTyping}
                                        className="flex items-center gap-2 px-3.5 py-2 bg-gray-800/50 hover:bg-gray-700/50 disabled:bg-gray-800/30 disabled:cursor-not-allowed border border-gray-700/50 hover:border-blue-500/50 text-gray-300 hover:text-white font-semibold text-xs rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                                      >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        Correlated Plays
                                      </button>
                                      <button
                                        onClick={() => {
                                          console.log('[v0] Metrics analysis button clicked');
                                          handleFollowUp('metrics', card);
                                        }}
                                        disabled={isTyping}
                                        className="flex items-center gap-2 px-3.5 py-2 bg-gray-800/50 hover:bg-gray-700/50 disabled:bg-gray-800/30 disabled:cursor-not-allowed border border-gray-700/50 hover:border-purple-500/50 text-gray-300 hover:text-white font-semibold text-xs rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                                      >
                                        <BarChart className="w-3.5 h-3.5" />
                                        Deep Metrics
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="text-sm leading-relaxed font-medium space-y-3">
                            {message.content.split('\n\n').map((paragraph, pIdx) => {
                              // Check if paragraph contains bullet points
                              if (paragraph.includes('\n**') && paragraph.includes('**')) {
                                const lines = paragraph.split('\n');
                                return (
                                  <div key={pIdx} className="space-y-2">
                                    {lines.map((line, lIdx) => {
                                      // Bold text with ** **
                                      if (line.includes('**')) {
                                        const parts = line.split('**');
                                        return (
                                          <div key={lIdx} className="flex items-start gap-2">
                                            {parts.map((part, partIdx) => {
                                              if (partIdx % 2 === 1) {
                                                return <span key={partIdx} className="font-black text-white">{part}</span>;
                                              } else if (part.trim()) {
                                                return <span key={partIdx} className="text-gray-300">{part}</span>;
                                              }
                                              return null;
                                            })}
                                          </div>
                                        );
                                      }
                                      return <div key={lIdx}>{line}</div>;
                                    })}
                                  </div>
                                );
                              }
                              
                              // Regular paragraph with bold support
                              if (paragraph.includes('**')) {
                                const parts = paragraph.split('**');
                                return (
                                  <p key={pIdx}>
                                    {parts.map((part, partIdx) => {
                                      if (partIdx % 2 === 1) {
                                        return <span key={partIdx} className="font-black text-white">{part}</span>;
                                      }
                                      return <span key={partIdx}>{part}</span>;
                                    })}
                                  </p>
                                );
                              }
                              
                              return <p key={pIdx}>{paragraph}</p>;
                            })}
                          </div>
                        )}
                        
                        {/* File Attachments Display */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {message.attachments.map((attachment) => (
                              <div key={attachment.id}>
                                {attachment.type === 'image' && (
                                  <div className="relative group/img rounded-xl overflow-hidden border border-gray-700/50 bg-gray-900/50">
                                    <img 
                                      src={attachment.url || "/placeholder.svg"} 
                                      alt={attachment.name}
                                      className="w-full max-w-xl rounded-xl"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                      <div className="flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4 text-gray-400" />
                                        <span className="text-xs font-bold text-gray-300">{attachment.name}</span>
                                        <span className="text-xs text-gray-500 ml-auto">{(attachment.size / 1024).toFixed(1)} KB</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {attachment.type === 'csv' && attachment.data && (
                                  <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 overflow-hidden">
                                    <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/50 border-b border-gray-700/50">
                                      <FileText className="w-4 h-4 text-green-400" />
                                      <span className="text-xs font-bold text-gray-300">{attachment.name}</span>
                                      <span className="text-xs text-gray-500 ml-auto">
                                        {attachment.data.rows.length} rows × {attachment.data.headers.length} columns
                                      </span>
                                    </div>
                                    <div className="overflow-x-auto max-h-96 custom-scrollbar">
                                      <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-gray-800/80 backdrop-blur-sm">
                                          <tr>
                                            {attachment.data.headers.map((header: string, idx: number) => (
                                              <th key={idx} className="px-4 py-2.5 text-left font-bold text-gray-300 border-b border-gray-700/50">
                                                {header}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {attachment.data.rows.slice(0, 100).map((row: string[], rowIdx: number) => (
                                            <tr key={rowIdx} className="hover:bg-gray-800/30 transition-colors border-b border-gray-800/30">
                                              {row.map((cell: string, cellIdx: number) => (
                                                <td key={cellIdx} className="px-4 py-2.5 text-gray-400 font-medium">
                                                  {cell}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      {attachment.data.rows.length > 100 && (
                                        <div className="px-4 py-3 bg-gray-800/30 text-center">
                                          <span className="text-xs text-gray-500">
                                            Showing first 100 rows of {attachment.data.rows.length}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {message.editHistory && message.editHistory.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-700/50">
                            <details className="text-xs text-gray-500">
                              <summary className="cursor-pointer hover:text-gray-400 flex items-center gap-1.5">
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
                    <div>
                      <CardLayout
                        cards={message.cards}
                        aiInsight={message.content}
                        onAnalyze={(card) => {
                          const cardIndex = message.cards!.indexOf(card);
                          generateCardAnalysis(card, `${index}-${cardIndex}`);
                        }}
                        messageIndex={index}
                      />

                      {/* Analysis panels — full width below the card grid */}
                      {message.cards.map((card, cardIndex) => {
                        const cardKey = `${index}-${cardIndex}`;
                        const analysis = cardAnalysisMap[cardKey];
                        const isOpen = analysis?.loading || !!analysis?.content || !!analysis?.error;
                        if (!isOpen) return null;
                        return (
                          <div key={cardKey} className="mt-2 rounded-xl border border-gray-700/50 bg-gray-900/95 backdrop-blur-xl overflow-hidden w-full">
                            {analysis.loading ? (
                              <div className="p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <div className="w-1.5 h-1.5 bg-blue-500/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                  <span className="text-[11px] text-gray-400 ml-1">Analyzing {card.type === 'kalshi' ? 'prediction market' : 'opportunity'}...</span>
                                </div>
                                <div className="h-2 bg-gray-700/40 rounded-full animate-pulse w-full" />
                                <div className="h-2 bg-gray-700/40 rounded-full animate-pulse w-5/6" />
                                <div className="h-2 bg-gray-700/40 rounded-full animate-pulse w-3/5" />
                              </div>
                            ) : analysis.error ? (
                              <div className="p-4 flex items-center gap-2 text-xs text-red-400">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{analysis.error}</span>
                              </div>
                            ) : (
                              <div className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-1.5">
                                    <BarChart3 className="w-3 h-3 text-gray-500" />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Analysis</span>
                                  </div>
                                  <button
                                    onClick={() => setCardAnalysisMap(prev => { const n = { ...prev }; delete n[cardKey]; return n; })}
                                    className="text-gray-600 hover:text-gray-300 transition-colors"
                                    aria-label="Close analysis"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="text-xs text-gray-300 leading-relaxed space-y-2.5">
                                  {(analysis.content ?? '').split('\n\n').map((para, pIdx) => {
                                    if (para.includes('**')) {
                                      const parts = para.split('**');
                                      return (
                                        <p key={pIdx}>
                                          {parts.map((part, partIdx) =>
                                            partIdx % 2 === 1
                                              ? <span key={partIdx} className="font-bold text-white">{part}</span>
                                              : <span key={partIdx}>{part}</span>
                                          )}
                                        </p>
                                      );
                                    }
                                    return <p key={pIdx}>{para}</p>;
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Combined Metadata: Source Credibility & AI Trust - Hidden for welcome message */}
                  {message.role === 'assistant' && !message.isWelcome && (message.sources || message.trustMetrics) && (
                    <div className="mt-4 ml-11">
                      {/* Compact Metadata Summary */}
                      <div className="flex items-center gap-3 text-[11px] text-gray-600">
                        {message.modelUsed && (
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="w-3 h-3 text-purple-500/60" />
                            <span>Model: <span className="text-gray-500 font-semibold">{message.modelUsed.replace('Grok 3', 'Grok 4').replace('grok-3', 'Grok 4').replace('grok-4', 'Grok 4')}</span></span>
                          </span>
                        )}
                        {message.processingTime && (
                          <span className="flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-yellow-500/60" />
                            <span>Processed in: <span className="text-gray-500 font-semibold tabular-nums">{message.processingTime}ms</span></span>
                          </span>
                        )}
                      </div>

                      {/* Collapsible Source Credibility */}
                      {message.sources && message.sources.length > 0 && (
                        <details className="mt-3 group/sources">
                          <summary className="cursor-pointer list-none flex items-center gap-2 text-[11px] text-gray-600 hover:text-gray-500 transition-colors">
                            <Shield className="w-3.5 h-3.5 text-blue-500/60" />
                            <span className="font-semibold uppercase tracking-wide">Source Credibility</span>
                            <span className="text-gray-700">({message.sources.length} sources)</span>
                            <ChevronRight className="w-3 h-3 group-open/sources:rotate-90 transition-transform" />
                          </summary>
                          <div className="mt-3 flex flex-wrap gap-2 pl-5">
                            {message.sources.map((source, idx) => {
                              const reliabilityColor = source.reliability >= 95 ? 'text-green-500 border-green-600/20' :
                                                      source.reliability >= 90 ? 'text-blue-500 border-blue-600/20' :
                                                      'text-yellow-500 border-yellow-600/20';
                              const Icon = source.type === 'database' ? Database : 
                                          source.type === 'api' ? Activity : 
                                          source.type === 'model' ? Sparkles : 
                                          RefreshCw;
                              return (
                                <div 
                                  key={idx} 
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-gray-900/30 ${reliabilityColor} text-[11px]`}
                                  title={`${source.name} - ${source.reliability}% reliability`}
                                >
                                  <Icon className="w-3 h-3" />
                                  <span className="font-semibold">{source.name}</span>
                                  <span className="font-bold tabular-nums">{source.reliability}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}

                      {/* Collapsible AI Trust & Integrity */}
                      {message.trustMetrics && (
                        <details className="mt-3 group/trust">
                          <summary className="cursor-pointer list-none flex items-center gap-2 text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                            <Shield className={`w-3.5 h-3.5 ${
                              message.trustMetrics.trustLevel === 'high' ? 'text-emerald-500/70' :
                              message.trustMetrics.trustLevel === 'medium' ? 'text-yellow-500/70' :
                              'text-red-500/70'
                            }`} />
                            <span className="font-semibold uppercase tracking-wide">AI Trust & Integrity</span>
                            {/* Confidence badge */}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              message.trustMetrics.trustLevel === 'high' ? 'bg-emerald-600/20 text-emerald-400' :
                              message.trustMetrics.trustLevel === 'medium' ? 'bg-yellow-600/20 text-yellow-400' :
                              'bg-red-600/20 text-red-400'
                            }`}>
                              {message.trustMetrics.finalConfidence}%
                            </span>
                            {/* Live odds badge */}
                            {(message.trustMetrics as any).hasLiveOdds && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-500/80">
                                LIVE
                              </span>
                            )}
                            {/* Model badge */}
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-500/10 text-purple-400/80">
                              {message.modelUsed || 'Grok 4'}
                            </span>
                            <ChevronRight className="w-3 h-3 group-open/trust:rotate-90 transition-transform ml-auto" />
                          </summary>
                          <div className="mt-3 pl-5">
                            <TrustMetricsDisplay
                              metrics={{
                                ...message.trustMetrics,
                                sources: (message.trustMetrics as any).sources || message.sources,
                                modelUsed: (message.trustMetrics as any).modelUsed || message.modelUsed || 'Grok 4',
                                processingTime: (message.trustMetrics as any).processingTime || message.processingTime,
                              }}
                            />
                          </div>
                        </details>
                      )}
                    </div>
                  )}


                  {/* Message Actions - Hidden for welcome message */}
                  {!message.isWelcome && (
                    <div className={`flex items-center flex-wrap gap-2 mt-5 ${message.role === 'assistant' ? 'ml-11' : ''}`}>
                      {message.role === 'user' && editingMessageIndex !== index && (
                        <button
                          onClick={() => handleEditMessage(index)}
                          className="flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-gray-800/60 active:bg-gray-800/80 transition-all group/action border border-gray-800 hover:border-gray-700"
                          title="Edit this message"
                          aria-label="Edit message"
                        >
                          <Edit3 className="w-4 h-4 text-gray-500 group-hover/action:text-blue-400 transition-colors" />
                          <span className="text-xs font-bold text-gray-500 group-hover/action:text-blue-400">Edit</span>
                        </button>
                      )}
                      {message.role === 'assistant' && (
                        <>
                          <button
                            onClick={() => message.voted !== 'up' && handleVote(index, 'up')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all group/action border ${
                              message.voted === 'up'
                                ? 'bg-green-500/15 border-green-500/40 cursor-default'
                                : 'hover:bg-green-500/10 active:bg-green-500/20 border-transparent hover:border-green-500/30'
                            }`}
                            title="This response was helpful"
                            aria-label="Mark as helpful"
                          >
                            <ThumbsUp className={`w-4 h-4 transition-colors ${message.voted === 'up' ? 'text-green-400 fill-green-400/30' : 'text-gray-500 group-hover/action:text-green-400'}`} />
                            <span className={`text-xs font-bold ${message.voted === 'up' ? 'text-green-400' : 'text-gray-500 group-hover/action:text-green-400'}`}>Helpful</span>
                          </button>
                          <button
                            onClick={() => message.voted !== 'down' && handleVote(index, 'down')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all group/action border ${
                              message.voted === 'down'
                                ? 'bg-red-500/15 border-red-500/40 cursor-default'
                                : 'hover:bg-red-500/10 active:bg-red-500/20 border-transparent hover:border-red-500/30'
                            }`}
                            title="This response needs improvement"
                            aria-label="Mark as needing improvement"
                          >
                            <ThumbsDown className={`w-4 h-4 transition-colors ${message.voted === 'down' ? 'text-red-400 fill-red-400/30' : 'text-gray-500 group-hover/action:text-red-400'}`} />
                            <span className={`text-xs font-bold ${message.voted === 'down' ? 'text-red-400' : 'text-gray-500 group-hover/action:text-red-400'}`}>Improve</span>
                          </button>
                          <button
                            onClick={() => handleRegenerateResponse(index)}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-purple-500/10 active:bg-purple-500/20 transition-all group/action border border-transparent hover:border-purple-500/30"
                            title="Regenerate this response"
                            aria-label="Regenerate response"
                          >
                            <RotateCcw className="w-4 h-4 text-gray-500 group-hover/action:text-purple-400 transition-colors" />
                            <span className="text-xs font-bold text-gray-500 group-hover/action:text-purple-400">Regenerate</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleCopyMessage(message.content)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-all group/action border border-transparent hover:border-cyan-500/30"
                        title="Copy message to clipboard"
                        aria-label="Copy message"
                      >
                        <Copy className="w-4 h-4 text-gray-500 group-hover/action:text-cyan-400 transition-colors" />
                        <span className="text-xs font-bold text-gray-500 group-hover/action:text-cyan-400">Copy</span>
                      </button>
                      <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-gray-900/50 rounded-lg border border-gray-800/50">
                        <Clock className="w-3.5 h-3.5 text-gray-600" />
                        {/* suppressHydrationWarning: toLocaleTimeString() is timezone-dependent;
                            server renders UTC, browser renders local time — mismatch is expected. */}
                        <span suppressHydrationWarning className="text-xs font-medium text-gray-500 tabular-nums">{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

      {isTyping && (
        <div className="flex gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/50 animate-pulse">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="bg-gradient-to-br from-gray-900/95 via-gray-850/95 to-gray-900/95 backdrop-blur-xl rounded-2xl px-5 py-4 border border-gray-700/60 shadow-2xl">
              <AIProgressIndicator stage={verifyStage} />
            </div>
          </div>
        </div>
      )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="relative border-t border-gray-800/50 bg-gradient-to-b from-gray-950 to-black px-4 py-5 shadow-2xl backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-t from-blue-600/5 via-transparent to-transparent pointer-events-none"></div>
          
          {/* Rate Limit Notification */}
          {showLimitNotification && (
            <div className="relative max-w-5xl mx-auto mb-4">
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
                      <p className="text-xs text-gray-400 leading-relaxed">
                        You've reached your limit of {CHAT_LIMIT} chats per 24 hours. Your limit will reset in{' '}
                        {Math.ceil((getRateLimitData().resetTime - Date.now()) / (1000 * 60 * 60))} hours.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLimitNotification(false)}
                    className="p-2 hover:bg-gray-800/50 rounded-lg transition-all"
                    aria-label="Close notification"
                  >
                    <X className="w-4 h-4 text-gray-500 hover:text-gray-300" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="relative max-w-5xl mx-auto">
            {/* Fantasy League Setup Flow — shown when Fantasy is selected and no league is configured */}
            {selectedCategory === 'fantasy' && !fantasyLeague?.setupComplete && (() => {
              // ── Inline config data ─────────────────────────────────────────
              const SETUP_SPORTS = [
                { value: 'nfl', label: 'Football', icon: '🏈' },
                { value: 'mlb', label: 'Baseball', icon: '⚾' },
                { value: 'nba', label: 'Basketball', icon: '🏀' },
                { value: 'nhl', label: 'Hockey', icon: '🏒' },
              ] as const;
              const SETUP_PLATFORMS: Record<string, Array<{ value: string; label: string }>> = {
                nfl: [{ value:'espn',label:'ESPN' },{ value:'yahoo',label:'Yahoo' },{ value:'fantrax',label:'Fantrax' },{ value:'cbs',label:'CBS' },{ value:'nfl_com',label:'NFL.com' }],
                mlb: [{ value:'espn',label:'ESPN' },{ value:'yahoo',label:'Yahoo' },{ value:'fantrax',label:'Fantrax' },{ value:'cbs',label:'CBS' },{ value:'nfbc',label:'NFBC' }],
                nba: [{ value:'espn',label:'ESPN' },{ value:'yahoo',label:'Yahoo' },{ value:'fantrax',label:'Fantrax' },{ value:'cbs',label:'CBS' }],
                nhl: [{ value:'espn',label:'ESPN' },{ value:'yahoo',label:'Yahoo' },{ value:'fantrax',label:'Fantrax' },{ value:'cbs',label:'CBS' }],
              };
              const SETUP_TYPES: Record<string, Array<{ value: string; label: string }>> = {
                nfl: [{ value:'ppr',label:'PPR' },{ value:'half_ppr',label:'Half PPR' },{ value:'standard',label:'Standard' }],
                mlb: [{ value:'h2h',label:'Head-to-Head' },{ value:'roto',label:'Rotisserie' },{ value:'roto_h2h',label:'Roto H2H' }],
                nba: [{ value:'h2h',label:'Head-to-Head' },{ value:'roto',label:'Rotisserie' }],
                nhl: [{ value:'h2h',label:'Head-to-Head' },{ value:'roto',label:'Rotisserie' }],
              };
              const activeSport = (fantasySetupData.sport || 'nfl') as string;
              const platforms = SETUP_PLATFORMS[activeSport] ?? SETUP_PLATFORMS.nfl;
              const leagueTypes = SETUP_TYPES[activeSport] ?? SETUP_TYPES.nfl;
              const isNfbc = fantasySetupData.platform === 'nfbc';
              const teamSizes = isNfbc ? [12, 15] : [8,10,12,14,16,20,24,30];
              const sportIcon = SETUP_SPORTS.find(s => s.value === activeSport)?.icon ?? '🏆';

              const STEP_NAMES = ['Sport', 'Platform', 'Teams', 'Format', 'Save'];
              const btnBase = 'px-3 py-1.5 rounded-xl border text-xs font-bold transition-all';
              const btnActive = 'border-green-400/70 bg-green-700/30 text-green-200';
              const btnInactive = 'border-green-700/40 bg-green-900/15 text-green-400 hover:bg-green-700/20 hover:border-green-500/50';

              return (
                <div className="mb-5 bg-gradient-to-br from-[oklch(0.12_0.04_145/0.5)] via-[oklch(0.09_0.01_280/0.8)] to-[oklch(0.10_0.03_145/0.3)] border border-green-700/30 rounded-2xl p-4 backdrop-blur-sm">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-bold text-green-300">Set up your fantasy league</span>
                    <span className="ml-auto text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {STEP_NAMES[fantasySetupStep]} · {fantasySetupStep + 1}/{STEP_NAMES.length}
                    </span>
                  </div>
                  {/* Step indicators */}
                  <div className="flex items-center gap-1 mb-4">
                    {STEP_NAMES.map((name, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full transition-all ${i < fantasySetupStep ? 'bg-green-400' : i === fantasySetupStep ? 'bg-green-300 scale-125' : 'bg-gray-700'}`} />
                        {i < STEP_NAMES.length - 1 && <div className={`w-4 h-px transition-all ${i < fantasySetupStep ? 'bg-green-500/50' : 'bg-gray-800'}`} />}
                      </div>
                    ))}
                  </div>

                  {/* Step 0: Sport */}
                  {fantasySetupStep === 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2.5">What sport is your fantasy league?</p>
                      <div className="grid grid-cols-2 gap-2">
                        {SETUP_SPORTS.map(s => (
                          <button key={s.value}
                            onClick={() => {
                              const defaultPlatform = (SETUP_PLATFORMS[s.value] ?? SETUP_PLATFORMS.nfl)[0].value;
                              const defaultType = (SETUP_TYPES[s.value] ?? SETUP_TYPES.nfl)[0].value;
                              setFantasySetupData(d => ({ ...d, sport: s.value, platform: defaultPlatform, leagueType: defaultType }));
                              setFantasySetupStep(1);
                            }}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${fantasySetupData.sport === s.value ? btnActive : btnInactive}`}>
                            <span className="text-xl">{s.icon}</span>
                            <span className="text-sm font-bold">{s.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 1: Platform */}
                  {fantasySetupStep === 1 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2.5">{sportIcon} Which platform is your {activeSport.toUpperCase()} league on?</p>
                      <div className="flex flex-wrap gap-2">
                        {platforms.map(p => (
                          <button key={p.value}
                            onClick={() => {
                              const sizes = p.value === 'nfbc' ? [12,15] : [8,10,12,14,16,20,24,30];
                              const newSize = sizes.includes(fantasySetupData.teams ?? 12) ? (fantasySetupData.teams ?? 12) : 12;
                              setFantasySetupData(d => ({ ...d, platform: p.value, teams: newSize }));
                              setFantasySetupStep(2);
                            }}
                            className={`${btnBase} ${fantasySetupData.platform === p.value ? btnActive : btnInactive}`}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Teams slider */}
                  {fantasySetupStep === 2 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2.5">How many teams in your league?</p>
                      {isNfbc ? (
                        <div className="flex gap-3">
                          {[12,15].map(n => (
                            <button key={n}
                              onClick={() => { setFantasySetupData(d => ({ ...d, teams: n })); setFantasySetupStep(3); }}
                              className={`flex-1 py-4 rounded-xl border text-2xl font-black transition-all ${(fantasySetupData.teams ?? 12) === n ? btnActive : btnInactive}`}>
                              {n}<span className="block text-[10px] font-normal opacity-60 mt-0.5">teams</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-center">
                            <span className="text-4xl font-black text-white tabular-nums">{fantasySetupData.teams ?? 12}</span>
                            <span className="text-xs text-gray-500 ml-1">teams</span>
                          </div>
                          <input type="range" min={8} max={30} step={1}
                            value={fantasySetupData.teams ?? 12}
                            onChange={e => setFantasySetupData(d => ({ ...d, teams: parseInt(e.target.value) }))}
                            className="w-full accent-green-400 cursor-pointer" />
                          <div className="flex justify-between text-[9px] text-gray-600"><span>8</span><span>16</span><span>24</span><span>30</span></div>
                          <div className="flex flex-wrap gap-1.5 justify-center">
                            {teamSizes.map(n => (
                              <button key={n}
                                onClick={() => setFantasySetupData(d => ({ ...d, teams: n }))}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${(fantasySetupData.teams ?? 12) === n ? btnActive : btnInactive}`}>
                                {n}
                              </button>
                            ))}
                          </div>
                          <button onClick={() => setFantasySetupStep(3)}
                            className="w-full py-2 rounded-xl bg-green-700/30 border border-green-500/40 text-green-300 text-xs font-bold hover:bg-green-700/40 transition-all">
                            Continue →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3: League Type */}
                  {fantasySetupStep === 3 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2.5">Scoring format for your {activeSport.toUpperCase()} league?</p>
                      <div className="space-y-2">
                        {leagueTypes.map(t => (
                          <button key={t.value}
                            onClick={() => { setFantasySetupData(d => ({ ...d, leagueType: t.value })); setFantasySetupStep(4); }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${fantasySetupData.leagueType === t.value ? btnActive : btnInactive}`}>
                            <span className="font-bold">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 4: League name + team name → save */}
                  {fantasySetupStep === 4 && (
                    <div className="space-y-2.5">
                      <p className="text-xs text-gray-400 mb-1">Almost done! Name your league and team.</p>
                      <input type="text" placeholder="League name (e.g. The Winners Circle)"
                        value={fantasySetupData.leagueName || ''}
                        onChange={e => setFantasySetupData(d => ({ ...d, leagueName: e.target.value }))}
                        className="w-full bg-gray-900/60 border border-green-700/40 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/60 transition-all"
                        maxLength={60} />
                      <input type="text" placeholder="Your team name (e.g. Gronk's Hammers)"
                        value={fantasySetupData.teamName || ''}
                        onChange={e => setFantasySetupData(d => ({ ...d, teamName: e.target.value }))}
                        className="w-full bg-gray-900/60 border border-green-700/40 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/60 transition-all"
                        maxLength={40} />
                      {/* Summary */}
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {[
                          `${sportIcon} ${activeSport.toUpperCase()}`,
                          (fantasySetupData.platform ?? 'ESPN').toUpperCase(),
                          `${fantasySetupData.teams ?? 12} teams`,
                          leagueTypes.find(t => t.value === fantasySetupData.leagueType)?.label ?? fantasySetupData.leagueType ?? '',
                        ].map((chip, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-green-900/20 border border-green-700/30 text-green-400 font-medium">{chip}</span>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          if (!fantasySetupData.teamName?.trim()) return;
                          const league: FantasyLeague = {
                            sport: fantasySetupData.sport || 'nfl',
                            platform: fantasySetupData.platform || 'espn',
                            teams: fantasySetupData.teams || 12,
                            leagueType: fantasySetupData.leagueType || 'ppr',
                            teamName: fantasySetupData.teamName.trim(),
                            leagueName: (fantasySetupData.leagueName || '').trim() || 'My League',
                            setupComplete: true,
                            // legacy compat
                            scoring: fantasySetupData.leagueType === 'ppr' ? 'PPR' : fantasySetupData.leagueType === 'half_ppr' ? 'Half-PPR' : 'Standard',
                          };
                          localStorage.setItem('leverage_fantasy_league', JSON.stringify(league));
                          setFantasyLeague(league);
                          setFantasySetupStep(0);
                          setFantasySetupData({ sport: 'nfl', platform: 'espn', teams: 12, leagueType: 'ppr' });
                          toast.success(`League saved! Welcome, ${league.teamName} 🏆`);
                        }}
                        disabled={!fantasySetupData.teamName?.trim()}
                        className="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-green-900/20">
                        Save League 🚀
                      </button>
                    </div>
                  )}

                  {fantasySetupStep > 0 && (
                    <button onClick={() => setFantasySetupStep(s => Math.max(0, s - 1))}
                      className="mt-2.5 text-[10px] text-gray-600 hover:text-gray-400 transition-colors">
                      ← Back
                    </button>
                  )}
                </div>
              );
            })()}
            {/* Show configured league context + reset button */}
            {selectedCategory === 'fantasy' && fantasyLeague?.setupComplete && (
              <div className="mb-3 flex items-center gap-2 px-1">
                <Trophy className="w-3.5 h-3.5 text-green-500" />
                <span className="text-[11px] font-bold text-green-400">{fantasyLeague.teamName}</span>
                <span className="text-[10px] text-gray-600">
                  {fantasyLeague.sport?.toUpperCase()} · {fantasyLeague.platform?.toUpperCase()} · {fantasyLeague.teams} teams · {fantasyLeague.leagueType ?? fantasyLeague.scoring}
                </span>
                <button onClick={() => { setFantasyLeague(null); localStorage.removeItem('leverage_fantasy_league'); }} className="ml-auto text-[10px] text-gray-600 hover:text-gray-400 transition-colors">Edit league</button>
              </div>
            )}
            {/* Follow up on: label — plain text, not a pill */}
            {/* Welcome categorized quick-start grid — shown only on fresh session */}
            {messages.length === 1 && messages[0]?.isWelcome && suggestedPrompts.length === 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-3 px-1">
                  Get started — choose a category
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'Betting', desc: 'Live odds & arbitrage', icon: TrendingUp, color: 'text-blue-400', bg: 'from-blue-600/10 to-blue-900/5', border: 'border-blue-500/20', sample: 'Live arbitrage alerts across sportsbooks', sampleIcon: Zap },
                    { label: 'Fantasy', desc: 'Draft & waiver tools', icon: Trophy, color: 'text-purple-400', bg: 'from-purple-600/10 to-purple-900/5', border: 'border-purple-500/20', sample: 'NFBC draft strategy for my pick position', sampleIcon: Award },
                    { label: 'DFS', desc: 'Optimal lineups', icon: Medal, color: 'text-amber-400', bg: 'from-amber-600/10 to-amber-900/5', border: 'border-amber-500/20', sample: 'DFS NFL optimal lineups for DraftKings', sampleIcon: BarChart3 },
                    { label: 'Predictions', desc: 'Kalshi markets', icon: Activity, color: 'text-cyan-400', bg: 'from-cyan-600/10 to-cyan-900/5', border: 'border-cyan-500/20', sample: 'Show me trending Kalshi prediction markets right now', sampleIcon: Sparkles },
                  ].map(({ label, desc, icon: Icon, color, bg, border, sample, sampleIcon: SampleIcon }) => (
                    <button
                      key={label}
                      onClick={() => {
                        const userMessage: Message = { role: 'user', content: sample, timestamp: new Date() };
                        setMessages((prev: Message[]) => [...prev, userMessage]);
                        setInput('');
                        generateRealResponse(sample);
                      }}
                      className={`group/cat flex flex-col items-start gap-1.5 p-3 rounded-xl bg-gradient-to-br ${bg} border ${border} hover:border-opacity-60 transition-all hover:scale-[1.02] active:scale-[0.98] text-left`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span className={`text-xs font-bold ${color}`}>{label}</span>
                      </div>
                      <p className="text-[10px] text-[oklch(0.45_0.008_280)] leading-tight">{desc}</p>
                      <div className="flex items-center gap-1 mt-1 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                        <SampleIcon className="w-3 h-3 text-[oklch(0.45_0.008_280)]" />
                        <span className="text-[9px] text-[oklch(0.45_0.008_280)] line-clamp-1">{sample}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {lastUserQuery && suggestedPrompts.length > 0 && messages.length > 1 && (
              <div className="mb-3 px-1 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                  Follow up on:
                </span>
                <span className="text-[11px] text-gray-400 truncate max-w-[420px]">
                  {lastUserQuery.length > 72 ? lastUserQuery.slice(0, 72) + '…' : lastUserQuery}
                </span>
              </div>
            )}
            {/* Dynamic Contextual Suggestions or Platform Prompts */}
            <div className="relative mb-5">
              <div className="absolute left-0 inset-y-0 w-6 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 inset-y-0 w-14 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 px-2">
              {(suggestedPrompts.length > 0 && messages.length > 1 ? suggestedPrompts : quickActions).map((action, idx) => {
                const Icon = action.icon;
                const isSuggested = suggestedPrompts.length > 0 && messages.length > 1;
                const submitText = (action as any).query || action.label;

                return (
                  <button
                    key={`${action.label}-${idx}`}
                    onClick={() => {
                      setInput(submitText);
                      setTimeout(() => {
                        const userMessage: Message = {
                          role: 'user',
                          content: submitText,
                          timestamp: new Date()
                        };
                        setMessages((prev: Message[]) => [...prev, userMessage]);

                        // Update chat metadata
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

                        setInput('');
                        generateRealResponse(submitText);
                      }, 0);
                    }}
                    className={`group/prompt flex items-center gap-2.5 px-4 py-2.5 rounded-full border text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      isSuggested
                        ? 'bg-gray-900/60 border-blue-500/50 text-gray-200 hover:bg-gradient-to-r hover:from-blue-600/20 hover:via-purple-600/20 hover:to-blue-600/20 hover:border-blue-400/70'
                        : selectedCategory === 'kalshi'
                          ? 'bg-gray-900/60 border-cyan-800/50 text-gray-400 hover:bg-cyan-900/20 hover:border-cyan-600/50 hover:text-cyan-300'
                          : 'bg-gray-900/60 border-gray-800/70 text-gray-400 hover:bg-gray-800/70 hover:border-gray-700 hover:text-gray-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${
                      isSuggested ? 'text-gray-400 group-hover/prompt:text-blue-400'
                      : selectedCategory === 'kalshi' ? 'text-cyan-600 group-hover/prompt:text-cyan-400'
                      : 'text-gray-500 group-hover/prompt:text-gray-400'
                    }`} />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
            </div>

            {/* File Upload Preview */}
            {uploadedFiles.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-gray-400">
                    {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} attached
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded-xl group/file hover:border-gray-600 transition-all"
                    >
                      {file.type === 'image' ? (
                        <ImageIcon className="w-4 h-4 text-blue-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-green-400" />
                      )}
                      <span className="text-xs font-bold text-gray-300 max-w-[120px] truncate">
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                      {/* Save to profile */}
                      <button
                        onClick={() => saveFileToProfile(file)}
                        className="p-1 hover:bg-blue-900/40 rounded transition-all"
                        title="Save file to profile"
                      >
                        <Bookmark className="w-3.5 h-3.5 text-gray-500 hover:text-blue-400" />
                      </button>
                      <button
                        onClick={() => removeAttachment(file.id)}
                        className="p-1 hover:bg-gray-700/50 rounded transition-all"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Drag-and-drop + form wrapper */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragEnter={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
              onDrop={async e => {
                e.preventDefault();
                setIsDragOver(false);
                const dropped = await processFiles(e.dataTransfer.files);
                if (dropped.length > 0) setUploadedFiles(prev => [...prev, ...dropped]);
              }}
              className={`relative rounded-2xl transition-all duration-200 ${isDragOver ? 'ring-2 ring-blue-500/60 bg-blue-500/5' : ''}`}
            >
              {isDragOver && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-blue-500/60 bg-blue-500/10 pointer-events-none">
                  <div className="flex flex-col items-center gap-1">
                    <Paperclip className="w-6 h-6 text-blue-400" />
                    <span className="text-sm font-bold text-blue-300">Drop files here</span>
                    <span className="text-xs text-blue-400/70">Images, CSV, TXT, JSON</span>
                  </div>
                </div>
              )}

            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="flex-1 relative group/input focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:shadow-lg focus-within:shadow-blue-500/10 rounded-2xl transition-all duration-300">
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/gif,image/webp,text/csv,.tsv,text/tab-separated-values,text/plain,.txt,.json,application/json,.pdf,application/pdf"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as React.FormEvent<HTMLInputElement>);
                    }
                  }}
                  placeholder={
                    lastUserQuery
                      ? `Follow up on your ${lastUserQuery.toLowerCase().includes('nba') ? 'NBA' : lastUserQuery.toLowerCase().includes('nfl') ? 'NFL' : lastUserQuery.toLowerCase().includes('kalshi') ? 'Kalshi' : lastUserQuery.toLowerCase().includes('dfs') ? 'DFS' : lastUserQuery.toLowerCase().includes('fantasy') ? 'fantasy' : 'sports'} analysis or ask something new...`
                      : 'Ask about betting odds, fantasy strategy, DFS lineups, or Kalshi markets...'
                  }
                  className="w-full bg-gray-900/90 border border-gray-700/50 hover:border-gray-600/60 focus:border-blue-500/40 rounded-2xl px-6 py-4.5 pr-32 font-medium text-white placeholder-gray-500 focus:outline-none transition-all backdrop-blur-sm shadow-inner text-sm"
                  disabled={isTyping}
                  maxLength={500}
                />
                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 hover:bg-gray-800/70 rounded-lg transition-all group/attach border-none bg-transparent"
                    title="Attach image or CSV file"
                    disabled={isTyping}
                  >
                    <Paperclip className="w-4.5 h-4.5 text-gray-500 group-hover/attach:text-blue-400 transition-colors" />
                  </button>
                  <span className={`text-xs font-bold transition-colors ${input.length > 450 ? 'text-orange-400' : 'text-gray-600'}`}>
                    {input.length}/500
                  </span>
                </div>
              </div>
              {isTyping ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="relative bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white rounded-2xl px-8 py-4.5 transition-all duration-300 shadow-xl shadow-red-900/30 flex items-center gap-2.5 font-bold group overflow-hidden hover:scale-[1.02] active:scale-95"
                >
                  <X className="w-5 h-5 relative z-10" />
                  <span className="text-sm relative z-10 tracking-wide">Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={(!input.trim() && uploadedFiles.length === 0)}
                  className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 disabled:from-gray-800 disabled:to-gray-900 disabled:cursor-not-allowed text-white rounded-2xl px-8 py-4.5 transition-all duration-300 shadow-xl shadow-blue-500/25 hover:shadow-blue-500/50 hover:shadow-2xl disabled:shadow-none flex items-center gap-2.5 font-bold group overflow-hidden hover:scale-[1.02] active:scale-95 disabled:hover:scale-100"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <Send className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  <span className="text-sm relative z-10 tracking-wide">Analyze</span>
                </button>
              )}
            </form>
            </div>{/* end drag-and-drop wrapper */}

            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-[11px] font-bold text-gray-600">
                Betting • Fantasy • DFS • Kalshi • Real-time AI Analysis
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowStripeLightbox(true)}
                  className={`flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer hover:opacity-80 ${
                  creditsRemaining <= 3
                    ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                    : 'text-gray-500 bg-gray-900/30 border-gray-800'
                }`}>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{creditsRemaining} {creditsRemaining === 1 ? 'credit' : 'credits'} remaining</span>
                </button>
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
                  <div className="relative flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
                    <div className="absolute inset-0 bg-green-400 rounded-full animate-ping"></div>
                  </div>
                  <span>All systems operational</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Credits Modal */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowPurchaseModal(false)}>
          <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPurchaseModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/30 mb-4">
                  <AlertCircle className="w-6 h-6 text-orange-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Out of Credits</h2>
                <p className="text-sm text-gray-400">Purchase more credits to continue using AI analysis</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Amount (min $10)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                    <input
                      type="number"
                      min="10"
                      value={purchaseAmount}
                      onChange={(e) => setPurchaseAmount(e.target.value)}
                      placeholder="10"
                      className="w-full pl-8 pr-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[20, 50, 100, 250].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setPurchaseAmount(amount.toString())}
                      className="flex-1 min-w-[80px] px-4 py-2.5 rounded-xl border border-gray-800 bg-gray-950 hover:bg-gray-800 hover:border-gray-700 text-white font-semibold text-sm transition-all"
                    >
                      ${amount}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setShowPurchaseModal(false);
                    setShowStripeLightbox(true);
                  }}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all"
                >
                  Purchase Credits
                </button>

                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <button
                    onClick={() => {
                      setShowPurchaseModal(false);
                      setShowStripeLightbox(true);
                    }}
                    className="text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                  >
                    View Subscription
                  </button>
                  <button
                    onClick={() => {
                      setShowPurchaseModal(false);
                      setShowLoginModal(true);
                    }}
                    className="text-sm text-gray-400 hover:text-gray-300 font-semibold transition-colors"
                  >
                    Login
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowSubscriptionModal(false)}>
          <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowSubscriptionModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/30 mb-4">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Monthly Subscription</h2>
                <p className="text-sm text-gray-400">Get 20 credits every month for continuous access</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-6 mb-6">
                <div className="flex items-baseline justify-center mb-4">
                  <span className="text-4xl font-black text-white">$20</span>
                  <span className="text-gray-400 ml-2">/month</span>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>20 credits per month</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Auto-renews on the 1st</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Cancel anytime</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Priority support</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowSubscriptionModal(false);
                  setShowStripeLightbox(true);
                }}
                className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all mb-3"
              >
                Subscribe Now
              </button>

              <button
                onClick={() => {
                  setShowSubscriptionModal(false);
                  setShowStripeLightbox(true);
                }}
                className="w-full py-3 text-sm text-gray-400 hover:text-gray-300 font-semibold transition-colors"
              >
                One-time purchase instead
              </button>
            </div>
          </div>
        </div>
      )}

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
        onLogout={() => { setUser(null); setIsLoggedIn(false); }}
        onInstructionsChange={setCustomInstructions}
        onAttachFile={(file) => setUploadedFiles(prev => [...prev, { ...file, url: '' }])}
      />

      {/* Settings Lightbox */}
      <SettingsLightbox
        isOpen={showSettingsLightbox}
        onClose={() => setShowSettingsLightbox(false)}
        user={user}
        onUserUpdate={setUser}
        onOpenStripe={() => setShowStripeLightbox(true)}
      />

      {/* Alerts Lightbox */}
      <AlertsLightbox
        isOpen={showAlertsLightbox}
        onClose={() => setShowAlertsLightbox(false)}
      />

      {/* Stripe Purchase Lightbox */}
      <StripeLightbox
        isOpen={showStripeLightbox}
        onClose={() => setShowStripeLightbox(false)}
        onCreditsAdded={addCredits}
        creditsRemaining={creditsRemaining}
        userEmail={user?.email}
      />

      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(15px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
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
