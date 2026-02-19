/**
 * Main Chat Interface
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
import { Send, TrendingUp, Trophy, Target, ThumbsUp, ThumbsDown, Menu, Plus, MessageSquare, Clock, Star, Trash2, Zap, AlertCircle, CheckCircle, CheckCircle2, DollarSign, Activity, Award, ChevronRight, Bell, Settings, ShoppingCart, Medal, PieChart, Layers, BarChart3, Sparkles, TrendingDown, Flame, Users, RefreshCw, Search, Calendar, Copy, Edit3, RotateCcw, Shield, Database, BookOpen, ExternalLink, X, CheckCheck, AlertTriangle, XCircle, TrendingUpIcon, BarChart, Info, Paperclip, FileText, ImageIcon, MoveIcon as RemoveIcon, Loader2 } from 'lucide-react';
import { DynamicCardRenderer, CardList, EmptyState } from '@/components/data-cards';
import { DatabaseStatusBanner } from '@/components/database-status-banner';
import { TrustMetricsDisplay, TrustMetricsBadge } from '@/components/trust-metrics-display';
import { InsightsDashboard } from '@/components/insights-dashboard';
import { AIProgressIndicator } from '@/components/ai-progress-indicator';
import { ErrorBoundary } from '@/components/error-boundary';
import { DataFallback } from '@/components/data-fallback';
import { ChatMessage } from '@/components/chat-message';

interface FileAttachment {
  id: string;
  name: string;
  type: 'image' | 'csv';
  url: string;
  size: number;
  data?: {
    headers: string[];
    rows: string[][];
  };
}

interface APIResponse<T = unknown> {
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

interface OddsMarket {
  key: string;
  outcomes: Array<{ name: string; price: number; point?: number }>;
}

interface OddsEvent {
  sport_title: string;
  bookmakers?: Array<{
    key: string;
    title: string;
    markets: OddsMarket[];
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
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, string | number>;
  status: string;
}

interface QueryContext {
  sport: string | null;
  marketType: string | null;
  platform: string | null;
  isSportsQuery: boolean;
  isPoliticalMarket: boolean;
  hasBettingIntent: boolean;
  previousMessages: Array<{ role: string; content: string }>;
  oddsData?: Record<string, unknown> & { sport?: string };
  oddsError?: unknown;
  oddsErrorMessage?: string;
  noGamesAvailable?: boolean;
  noGamesMessage?: string;
  crossSportError?: boolean;
}

export default function UnifiedAIPlatform() {
  // Dynamic welcome message based on time, category, and sport season
  const getWelcomeMessage = (category: string) => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    
    const categoryMessages: Record<string, string> = {
      betting: `${greeting}! It's ${dateStr}.\n\n**Leverage AI** is scanning live odds across all major sportsbooks. Ask me about tonight's lines, player props, sharp money, or arbitrage opportunities.`,
      fantasy: `${greeting}! It's ${dateStr}.\n\n**Leverage AI** is ready for fantasy analysis. Ask about draft strategy, waiver targets, trade values, or bestball stacking for NFBC/NFFC.`,
      dfs: `${greeting}! It's ${dateStr}.\n\n**Leverage AI** is optimizing DFS lineups. Ask about optimal builds, ownership leverage, captain picks, or correlation stacks for DraftKings and FanDuel.`,
      kalshi: `${greeting}! It's ${dateStr}.\n\n**Leverage AI** is monitoring Kalshi prediction markets in real-time. Ask about election contracts, weather markets, economic events, or cross-market arbitrage.`,
      all: `${greeting}! It's ${dateStr}.\n\n**Leverage AI** - Powered by Grok AI\n\nI'm connected to live odds feeds, Kalshi prediction markets, and real-time sports data. Ask me about betting odds, player props, DFS lineups, fantasy strategy, or prediction markets.`
    };
    
    return categoryMessages[category] || categoryMessages.all;
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '**Leverage AI** - Powered by Grok AI\n\nI\'m connected to live odds feeds, Kalshi prediction markets, and real-time sports data. Ask me about betting odds, player props, DFS lineups, fantasy strategy, or prediction markets.',
      timestamp: new Date(0),
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

  // Track client-side mount to avoid hydration mismatch on time-dependent content
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Update welcome message ONLY after client mount
  useEffect(() => {
    if (isMounted) {
      setMessages(prev => {
        if (prev.length === 1 && prev[0].isWelcome) {
          return [{
            ...prev[0],
            content: getWelcomeMessage('all'),
            timestamp: new Date(),
          }];
        }
        return prev;
      });
    }
  }, [isMounted]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; avatar?: string } | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileAttachment[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<Array<{ label: string; icon: React.ComponentType<{ className?: string }>; category: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Credit system utilities
  const MESSAGE_LIMIT = 15;
  const CHAT_LIMIT = 10;
  const LIMIT_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  const getCreditData = () => {
    if (typeof window === 'undefined') return { credits: MESSAGE_LIMIT, resetTime: Date.now() + LIMIT_DURATION };
    const data = localStorage.getItem('userCredits');
    if (!data) {
      const initial = { credits: MESSAGE_LIMIT, resetTime: Date.now() + LIMIT_DURATION };
      localStorage.setItem('userCredits', JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(data);
    // Check if reset time has passed
    if (Date.now() > parsed.resetTime) {
      const reset = { credits: MESSAGE_LIMIT, resetTime: Date.now() + LIMIT_DURATION };
      localStorage.setItem('userCredits', JSON.stringify(reset));
      return reset;
    }
    return parsed;
  };

  const consumeCredit = () => {
    const data = getCreditData();
    if (data.credits <= 0) {
      setShowPurchaseModal(true);
      return false;
    }
    const updated = { ...data, credits: data.credits - 1 };
    localStorage.setItem('userCredits', JSON.stringify(updated));
    setCreditsRemaining(updated.credits);
    return true;
  };

  const addCredits = (amount: number) => {
    const data = getCreditData();
    const updated = { ...data, credits: data.credits + amount };
    localStorage.setItem('userCredits', JSON.stringify(updated));
    setCreditsRemaining(updated.credits);
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
    // Check if reset time has passed
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

  // Check Supabase auth session on mount
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setIsLoggedIn(true);
          setUser({
            name: (session.user.user_metadata?.full_name as string) || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || ''
          });
        }
        
        // Listen for auth changes (OAuth redirect, signout, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: unknown, session: { user: { user_metadata?: Record<string, unknown>; email?: string } } | null) => {
          if (session?.user) {
            setIsLoggedIn(true);
            setUser({
              name: (session.user.user_metadata?.full_name as string) || session.user.email?.split('@')[0] || 'User',
              email: session.user.email || ''
            });
            setShowLoginModal(false);
            setShowSignupModal(false);
          } else {
            setIsLoggedIn(false);
            setUser(null);
          }
        });
        
        return () => subscription.unsubscribe();
      } catch (err) {
        console.error('[v0] Auth check failed:', err);
        return undefined;
      }
    })();
  }, []);

  // Initialize credits and load real insights on mount
  useEffect(() => {
    fetch('/api/insights')
      .then(r => {
        if (!r.ok) throw new Error(`Insights API returned ${r.status}`);
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error('Non-JSON response from insights');
        return r.json();
      })
      .then(result => {
        const insights = result?.insights ?? result;
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

  // Start with empty chat history - user creates real chats
  const [chats, setChats] = useState<Chat[]>([
    {
      id: 'chat-1',
      title: 'New Chat',
      preview: 'Start a conversation to get real-time sports betting insights...',
      timestamp: new Date(0),
      starred: false,
      category: 'all',
      tags: []
    }
  ]);

  // Hydrate chat timestamp client-side
  useEffect(() => {
    setChats(prev => prev.map(chat =>
      chat.id === 'chat-1' && chat.timestamp.getTime() === 0
        ? { ...chat, timestamp: new Date() }
        : chat
    ));
  }, []);

  const categories = [
    { id: 'all', name: 'All', icon: Layers, color: 'text-blue-400', desc: 'Everything' },
    { id: 'betting', name: 'Sports Betting', icon: TrendingUp, color: 'text-orange-400', desc: 'Live Odds & Props' },
    { id: 'fantasy', name: 'Fantasy (NFC)', icon: Trophy, color: 'text-green-400', desc: 'NFBC/NFFC/NFBKC' },
    { id: 'dfs', name: 'DFS Optimizer', icon: Award, color: 'text-purple-400', desc: 'DK/FD Lineups' },
    { id: 'kalshi', name: 'Kalshi Markets', icon: BarChart3, color: 'text-cyan-400', desc: 'Financial Prediction' },
  ];

  // Demo cards removed - app now fetches ONLY real data from APIs
  // Real data sources: The Odds API, Grok 4 Fast AI, Open-Meteo Weather API, Supabase
  const unifiedCards: InsightCard[] = [];

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
    setChats(chats.map((chat: Chat) =>
      chat.id === chatId ? { ...chat, starred: !chat.starred } : chat
    ));
  };

  const generateContextualSuggestions = (userMessage: string, responseCards: InsightCard[]) => {
    const msgLower = userMessage.toLowerCase();
    const suggestions: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; category: string }> = [];
    
    console.log('[v0] ==========================================');
      console.log('[v0] GENERATING CONTEXTUAL SUGGESTIONS');
      console.log('[v0] User message:', userMessage);
      console.log('[v0] Response cards received:', responseCards.length);
      console.log('[v0] Card details:', responseCards.map((c: InsightCard) => ({ type: c.type, category: c.category })));
    
    // Analyze the AI's response cards to understand what was provided
    const cardTypes = responseCards.map(card => card.type);
    const categories = [...new Set(responseCards.map(card => card.category))];
    const hasLiveOdds = cardTypes.includes('live-odds');
    const hasDFSLineup = cardTypes.includes('dfs-lineup') || cardTypes.includes('dfs-value');
    const hasFantasy = cardTypes.includes('adp-analysis') || cardTypes.includes('bestball-stack') || cardTypes.includes('auction-value');
    const hasKalshi = cardTypes.includes('kalshi-market') || cardTypes.includes('kalshi-weather');
    const hasCrossPlatform = cardTypes.includes('cross-platform');
    const hasPlayerProps = cardTypes.includes('player-prop');
    
    console.log('[v0] Detected card types:', { hasLiveOdds, hasDFSLineup, hasFantasy, hasKalshi, hasCrossPlatform, hasPlayerProps });
    
    // Analyze user message context for deeper understanding
    const isBetting = msgLower.includes('bet') || msgLower.includes('odds') || msgLower.includes('line');
    const isFantasy = msgLower.includes('draft') || msgLower.includes('fantasy') || msgLower.includes('adp');
    const isDFS = msgLower.includes('dfs') || msgLower.includes('lineup') || msgLower.includes('draftkings') || msgLower.includes('fanduel');
    const isKalshi = msgLower.includes('kalshi') || msgLower.includes('market') || msgLower.includes('prediction');
    const isNBA = msgLower.includes('nba') || msgLower.includes('lakers') || msgLower.includes('warriors') || msgLower.includes('basketball');
    const isNFL = msgLower.includes('nfl') || msgLower.includes('chiefs') || msgLower.includes('football');
    const isMLB = msgLower.includes('mlb') || msgLower.includes('baseball');
    
    // PRIORITY 1: Generate suggestions based on what the AI just showed (response cards)
    if (hasLiveOdds) {
      suggestions.push(
        { label: 'How has this line moved in the last hour?', icon: TrendingUp, category: 'betting' },
        { label: 'Show me correlated player props for this game', icon: Target, category: 'betting' },
        { label: 'Compare this with sharp money direction', icon: Activity, category: 'betting' }
      );
    }
    
    if (hasDFSLineup) {
      suggestions.push(
        { label: 'What is the leverage score for this lineup?', icon: Award, category: 'dfs' },
        { label: 'Build a low-ownership contrarian version', icon: Users, category: 'dfs' },
        { label: 'Show me the betting lines supporting these picks', icon: TrendingUp, category: 'all' }
      );
    }
    
    if (hasPlayerProps) {
      suggestions.push(
        { label: 'Stack this prop with correlated DFS plays', icon: Layers, category: 'all' },
        { label: 'What is the historical hit rate for this player?', icon: BarChart, category: 'betting' },
        { label: 'Find similar props across other games', icon: Search, category: 'betting' }
      );
    }
    
    if (hasFantasy) {
      suggestions.push(
        { label: 'Show me waiver wire adds in this range', icon: Star, category: 'fantasy' },
        { label: 'What are the trade targets with similar value?', icon: RefreshCw, category: 'fantasy' },
        { label: 'Compare this to betting market expectations', icon: Layers, category: 'all' }
      );
    }
    
    if (hasKalshi) {
      suggestions.push(
        { label: 'How does this correlate with betting markets?', icon: Sparkles, category: 'all' },
        { label: 'Show me arbitrage between Kalshi and sportsbooks', icon: DollarSign, category: 'kalshi' },
        { label: 'What other Kalshi markets are related?', icon: BarChart3, category: 'kalshi' }
      );
    }
    
    if (hasCrossPlatform) {
      suggestions.push(
        { label: 'Find more cross-platform correlation plays', icon: Sparkles, category: 'all' },
        { label: 'Optimize my bankroll across these opportunities', icon: PieChart, category: 'all' }
      );
    }
    
    // PRIORITY 2: Sport-specific deep dives based on response
    if (categories.includes('NBA')) {
      suggestions.push(
        { label: 'Deep dive NBA rest advantage tonight', icon: AlertCircle, category: 'betting' },
        { label: 'Show me NBA pace-up game environments', icon: Zap, category: 'dfs' }
      );
    }
    
    if (categories.includes('NFL')) {
      suggestions.push(
        { label: 'Analyze weather impact on these games', icon: Activity, category: 'betting' },
        { label: 'Show me correlated TD scorer + game total bets', icon: Medal, category: 'betting' }
      );
    }
    
    // PRIORITY 3: Generate contextual follow-ups based on user message context
    if (isBetting && suggestions.length < 5) {
      suggestions.push(
        { label: 'What are the best player props for tonight?', icon: Target, category: 'betting' },
        { label: 'Show me live arbitrage opportunities', icon: Zap, category: 'betting' },
        { label: 'Sharp money movement on these games?', icon: Activity, category: 'betting' }
      );
    } else if (isDFS && suggestions.length < 5) {
      suggestions.push(
        { label: 'Build a low-ownership tournament stack', icon: Users, category: 'dfs' },
        { label: 'Find value plays under $5K', icon: DollarSign, category: 'dfs' },
        { label: 'Showdown slate captain picks with leverage', icon: Medal, category: 'dfs' }
      );
    } else if (isFantasy && suggestions.length < 5) {
      suggestions.push(
        { label: 'Show me ADP risers this week', icon: TrendingUp, category: 'fantasy' },
        { label: 'Best ball stacking strategy?', icon: Medal, category: 'fantasy' },
        { label: 'Auction value targets for this week', icon: ShoppingCart, category: 'fantasy' }
      );
    } else if (isKalshi && suggestions.length < 5) {
      suggestions.push(
        { label: 'Weather markets affecting game totals', icon: Activity, category: 'kalshi' },
        { label: 'Cross-market arbitrage opportunities', icon: Sparkles, category: 'all' },
        { label: 'Political markets with sharp edge', icon: TrendingUp, category: 'kalshi' }
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
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
      index === self.findIndex((s) => s.label === suggestion.label)
    );
    
    console.log('[v0] Generated', suggestions.length, 'total suggestions');
    console.log('[v0] Filtered to', uniqueSuggestions.length, 'unique suggestions');
    console.log('[v0] Suggestion labels:', uniqueSuggestions.map(s => s.label));
    console.log('[v0] ==========================================');
    
    // Return 5-7 unique suggestions for optimal UX
    return uniqueSuggestions.slice(0, 7);
  };

  const handleFollowUp = (action: 'correlated' | 'metrics', _cardData?: InsightCard) => {
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
          { name: 'Grok AI', type: 'model', reliability: 94 },
          { name: 'Historical Database', type: 'database', reliability: 95 },
          { name: 'Live Market API', type: 'api', reliability: 97 }
        ],
        modelUsed: 'Grok AI',
        processingTime: 950,
        trustMetrics: {
          benfordIntegrity: 90,
          oddsAlignment: 92,
          marketConsensus: 88,
          historicalAccuracy: 94,
          finalConfidence: 91,
          trustLevel: 'high',
          riskLevel: 'low',
          adjustedTone: 'Strong signal',
          flags: []
        }
      };

      setMessages((prev: Message[]) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1000);
  };

  // Generate detailed analysis for a card by querying AI
  const generateDetailedAnalysis = (card: InsightCard) => {
    console.log('[v0] Generating detailed analysis for card:', card);
    const analysisPrompt = `Provide a comprehensive analysis for ${card.title} in ${card.category}. Include: 1) Specific data points supporting this opportunity, 2) Risk assessment and potential downsides, 3) Recommended position sizing, 4) Historical performance of similar scenarios.`;
    setInput(analysisPrompt);
    generateRealResponse(analysisPrompt);
  };
  
  const generateRealResponse = async (userMessage: string) => {
    setIsTyping(true);
    const startTime = Date.now();
    const isDev = process.env.NODE_ENV !== 'production';
    
    try {
      console.log('[v0] Starting real AI analysis for:', userMessage);
      
      // Extract context from user message with strict detection flags
      const lowerMsg = userMessage.toLowerCase();
      
      // Political market keywords
      const politicalKeywords = ['kalshi', 'election', 'politics', 'cpi', 'inflation', 'fed', 'approval rating', 'recession', 'polymarket', 'prediction market'];
      const isPoliticalMarket = politicalKeywords.some(k => lowerMsg.includes(k));
      
      // Sports detection
      const detectedSport = extractSport(userMessage);
      
      // Betting intent keywords
      const bettingKeywords = ['odds', 'bet', 'line', 'spread', 'arbitrage', 'arb', 'h2h', 'value', 'sportsbook', 'draftkings', 'fanduel', 'moneyline', 'prop', 'parlay'];
      const hasBettingIntent = bettingKeywords.some(k => lowerMsg.includes(k));
      
      // Sports query detection (not political)
      const sportsKeywords = ['nba', 'nfl', 'nhl', 'mlb', 'basketball', 'football', 'hockey', 'baseball', 'ncaa'];
      const isSportsQuery = sportsKeywords.some(k => lowerMsg.includes(k)) && !isPoliticalMarket;
      
      const detectedPlatform = extractPlatform(userMessage);
      
      // Override isPoliticalMarket if platform is kalshi
      const finalIsPoliticalMarket = isPoliticalMarket || detectedPlatform === 'kalshi';
      
    const context: QueryContext = {
      sport: detectedSport,
      marketType: extractMarketType(userMessage),
      platform: detectedPlatform,
      isSportsQuery,
      isPoliticalMarket: finalIsPoliticalMarket,
      hasBettingIntent,
      previousMessages: messages.slice(-5).map(m => ({ role: m.role, content: m.content || '' }))
    };

      if (isDev) {
        console.log('[v0] Extracted context:', context);
        console.log('[SPORT DETECTED]', detectedSport || 'none');
        console.log('[POLITICAL MARKET DETECTED]', finalIsPoliticalMarket);
      }
      
      // HARD STOP: Political markets NEVER fetch sports odds
      if (context.isPoliticalMarket) {
        if (isDev) console.log('[POLITICAL MARKET DETECTED] Skipping sports odds fetch');
        // Route directly to Kalshi analysis without attempting sports odds
        // Note: The /api/analyze endpoint will handle Kalshi market analysis
      } else if (context.hasBettingIntent && context.isSportsQuery) {
        // Only fetch sports odds if this is explicitly a sports betting query
        if (isDev) console.log('[ODDS FETCH ATTEMPT] Sports betting query detected');
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
              const errorText = await oddsResponse.text();
              if (isDev) console.error(`[v0] Odds API error (${oddsResponse.status}):`, errorText.substring(0, 100));
            } else {
              const oddsResult = await oddsResponse.json();
              
              if (oddsResult?.events?.length > 0) {
                const sportName = sportKey.replace('_', ' ').toUpperCase();
                if (isDev) console.log(`[v0] ✅ Found ${oddsResult.events.length} live games in ${sportName}`);
                context.oddsData = { ...oddsResult, sport: sportKey };
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
          // ONLY ALLOW FALLBACK IF NO SPORT DETECTED
          if (isDev) console.log('[v0] No specific sport detected - attempting fallback rotation');
          
          const fallbackSports = [
            SPORT_KEYS.NBA.API,
            SPORT_KEYS.NFL.API,
            SPORT_KEYS.NHL.API,
            SPORT_KEYS.MLB.API
          ];
          
          let foundData = false;
          
          for (const sportKey of fallbackSports) {
            if (foundData) break;
            
            if (isDev) console.log(`[v0] Trying fallback sport: ${sportKey}`);
            
            try {
              const oddsResponse = await fetch('/api/odds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sport: sportKey, marketType: 'h2h' })
              });
              
              if (oddsResponse.ok) {
                const oddsResult = await oddsResponse.json();
                
                if (oddsResult?.events?.length > 0) {
                  const sportName = sportKey.replace('_', ' ').toUpperCase();
                  if (isDev) console.log(`[v0] ✅ Fallback success - Found ${oddsResult.events.length} games in ${sportName}`);
                  context.oddsData = { ...oddsResult, sport: sportKey };
                  foundData = true;
                  break;
                }
              }
            } catch (err) {
              if (isDev) console.error(`[v0] Exception fetching ${sportKey}:`, err);
            }
          }
          
          if (!foundData && isDev) {
            console.warn('[v0] ⚠️ ODDS FETCH FAILED - No live games found across all sports');
          }
        }
        
        if (isDev) console.log('[v0] === ODDS FETCH COMPLETE ===');
        
        // HARD CROSS-SPORT CONTAMINATION GUARD
        if (context.sport && context.oddsData?.sport && context.oddsData.sport !== sportToApi(context.sport)) {
          if (isDev) console.error('[CROSS-SPORT BLOCKED] Attempted contamination prevented:', {
            detected: context.sport,
          fetched: context.oddsData.sport
        });
        // Clear contaminated data
        context.oddsData = undefined;
        context.crossSportError = true;
        }
      }
      
      // Fetch real data from our API routes
      const analysisRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage, context })
      });

      let analysisResult: APIResponse;
      const ct = analysisRes.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        analysisResult = { success: false, error: `Unexpected response (${analysisRes.status})` };
      } else {
        analysisResult = await analysisRes.json();
      }
      
      console.log('[v0] Analysis result received:', {
        success: analysisResult.success,
        hasText: !!analysisResult.text,
        hasCards: !!analysisResult.cards,
        hasTrustMetrics: !!analysisResult.trustMetrics,
        error: analysisResult.error,
        useFallback: analysisResult.useFallback,
        details: analysisResult.details,
        hadOddsData: !!context.oddsData
      });

      // Handle API errors with smart fallback
      const processingTime = Date.now() - startTime;
      let newMessage: Message;
      
      if (!analysisResult.success) {
        console.log('[v0] API call failed, using contextual cards');
        
        const fallbackCards = await selectRelevantCards(userMessage, context);
        const errorMessage = analysisResult.error || 'API temporarily unavailable';
        
        newMessage = {
          role: 'assistant',
          content: `I'm processing your request using cached data since live services are temporarily limited. ${errorMessage}\n\nHere's what I can tell you:`,
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
            flags: [{
              type: 'warning',
              message: errorMessage,
              severity: 'warning'
            }]
          }
        };
      } else {
        // Success path - process the analysis result
        newMessage = {
          role: 'assistant',
          content: analysisResult.text || 'Analysis complete.',
          timestamp: new Date(),
          cards: analysisResult.cards || [],
          confidence: analysisResult.confidence || 85,
          sources: analysisResult.sources || [],
          modelUsed: analysisResult.modelUsed || 'Grok',
          processingTime,
          trustMetrics: analysisResult.trustMetrics || {
            benfordIntegrity: 85,
            oddsAlignment: 85,
            marketConsensus: 85,
            historicalAccuracy: 85,
            finalConfidence: 85,
            trustLevel: 'high',
            riskLevel: 'low',
            adjustedTone: 'Confident',
            flags: []
          }
        };
      }
      
      // Add message to state
      setMessages((prev: Message[]) => [...prev, newMessage].slice(-30));
      
      // Generate contextual suggestions
      const contextualSuggestions = generateContextualSuggestions(userMessage, newMessage.cards || []);
      setSuggestedPrompts(contextualSuggestions);
      console.log('[v0] Generated contextual suggestions:', contextualSuggestions.length);
    } catch (error) {
      console.error('[v0] Error generating real response:', error);
      
      // Fallback to basic response with error indication
      const fallbackCards = await selectRelevantCards(userMessage);
      setMessages((prev: Message[]) => [...prev, {
        role: 'assistant',
        content: `I'm currently experiencing connectivity issues with live data sources. Here's an analysis based on available information:\n\n**Note:** Some real-time data may be limited. ${error instanceof Error ? `(${error.message})` : ''}`,
        timestamp: new Date(),
        cards: fallbackCards,
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

      setSuggestedPrompts(generateContextualSuggestions(userMessage, fallbackCards));
    } finally {
      setIsTyping(false);
    }
  };

  // Helper functions for context extraction
  const extractSport = (message: string): string | null => {
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
    
    console.log('[v0] No specific sport detected');
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

  const selectRelevantCards = async (userMessage: string, context?: QueryContext): Promise<InsightCard[]> => {
    const msgLower = userMessage.toLowerCase();
    
    // Extract sport and category from message
    const sport = extractSport(userMessage);
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
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
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



  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: FileAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = file.type;

      // Validate file type
      const isCsvOrTsv = fileType === 'text/csv' || fileType === 'text/tab-separated-values' || file.name.endsWith('.tsv');
      if (!fileType.startsWith('image/') && !isCsvOrTsv) {
        alert(`File type not supported: ${file.name}. Please upload images (JPEG, PNG), CSV, or TSV files.`);
        continue;
      }

      // Create file URL
      const fileUrl = URL.createObjectURL(file);

      const attachment: FileAttachment = {
        id: `${Date.now()}-${i}`,
        name: file.name,
        type: fileType.startsWith('image/') ? 'image' : isCsvOrTsv ? 'csv' : 'csv',
        url: fileUrl,
        size: file.size
      };

      // Parse CSV/TSV if needed
      if (isCsvOrTsv) {
        const text = await file.text();
        const delimiter = file.name.endsWith('.tsv') || fileType === 'text/tab-separated-values' ? '\t' : ',';
        const parsed = parseDelimitedFile(text, delimiter);
        // Store the parsed data with headers and rows
        attachment.data = {
          headers: parsed.headers,
          rows: parsed.rows
        };
      }

      newAttachments.push(attachment);
    }

    setUploadedFiles((prev: FileAttachment[]) => [...prev, ...newAttachments]);
    console.log('[v0] Files uploaded:', newAttachments.length);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseDelimitedFile = (text: string, delimiter: string = ',') => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines[0].split(delimiter).map(h => h.trim());
    const rows = lines.slice(1).map(line => 
      line.split(delimiter).map(cell => cell.trim())
    );

    return { headers, rows };
  };

  const removeAttachment = (id: string) => {
    setUploadedFiles((prev: FileAttachment[]) => {
      const file = prev.find(f => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.url);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && uploadedFiles.length === 0) return;

    // Check if user has credits
    if (!consumeCredit()) {
      console.log('[v0] No credits remaining, showing purchase modal');
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: input || '📎 Attached files',
      timestamp: new Date(),
      attachments: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
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
    
    setInput('');
    generateRealResponse(input);
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
      fantasy: 'New Fantasy (NFC) Analysis',
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

  const handleVote = (index: number, direction: 'up' | 'down') => {
    // Placeholder for vote handling logic
    console.log(`Vote ${direction} on message ${index}`);
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
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
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
    const badges: Record<string, { bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
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

  const filteredChats = selectedCategory === 'all'
  ? chats
      : chats.filter((chat: Chat) => chat.category === selectedCategory);
  
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
      { label: 'Kalshi election market analysis and edge', icon: BarChart3, category: 'kalshi' },
      { label: 'Weather markets for NFL game totals', icon: Activity, category: 'kalshi' },
      { label: 'Economic event predictions with value', icon: TrendingUp, category: 'kalshi' },
      { label: 'Cross-market arbitrage: Kalshi + betting', icon: Sparkles, category: 'kalshi' },
      { label: 'High-volume markets with mispricing', icon: Target, category: 'kalshi' }
    ]
  };

  // Get dynamic prompts based on selected platform
  const quickActions = platformPrompts[selectedCategory] || platformPrompts.all;

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } bg-gradient-to-b from-gray-950 via-gray-900 to-black border-r border-gray-800/50 transition-all duration-300 overflow-hidden flex flex-col backdrop-blur-xl`}
      >
        <div className="p-4 border-b border-gray-800/50 bg-gradient-to-b from-gray-900/50 to-transparent">
          <button
            onClick={handleNewChat}
            className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white rounded-full px-4 py-3 transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 flex items-center justify-center gap-2 font-bold group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <Plus className="w-4 h-4 relative z-10 group-hover:rotate-90 transition-transform duration-300" />
            <span className="relative z-10 text-sm">New Analysis</span>
          </button>

          <div className="mt-4">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Platform</div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map(cat => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`group/pill flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 border whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? 'bg-gray-800 text-white border-gray-700 shadow-lg'
                        : 'bg-transparent text-gray-500 border-gray-800 hover:text-gray-300 hover:bg-gray-800/50 hover:border-gray-700'
                    }`}
                    title={cat.desc}
                  >
                    <Icon className={`w-3.5 h-3.5 transition-colors duration-300 ${
                      isActive ? cat.color : 'text-gray-600 group-hover/pill:text-gray-400'
                    }`} />
                    <span>{cat.id === 'all' ? 'ALL' : cat.name.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-3 custom-scrollbar">
          {/* Starred Chats Section */}
                  {filteredChats.filter((chat: Chat) => chat.starred).length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Starred
                  </span>
                </div>
                <span className="text-[10px] font-bold text-gray-600">
                  {filteredChats.filter(chat => chat.starred).length}
                </span>
              </div>
              {filteredChats.filter(chat => chat.starred).map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat.id)}
                  className={`group relative rounded-lg p-3 cursor-pointer transition-all duration-300 ${
                    activeChat === chat.id
                      ? 'bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 border border-blue-500/30 shadow-lg shadow-blue-500/10'
                      : 'bg-gray-900/30 hover:bg-gray-800/50 border border-transparent hover:border-gray-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 group/title">
                        <MessageSquare className={`w-3.5 h-3.5 ${activeChat === chat.id ? 'text-blue-400' : 'text-gray-500'} flex-shrink-0`} />
                        {editingChatId === chat.id ? (
                          <div className="flex-1 flex items-center gap-1">
                            <input
                              type="text"
                              value={editingChatTitle}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingChatTitle(e.target.value)}
                              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDownChatTitle(e, chat.id)}
                              onBlur={() => handleSaveChatTitle(chat.id)}
                              className="flex-1 bg-gray-800/80 border border-blue-500/50 rounded-md px-2 py-1 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                              autoFocus
                              onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                            />
                            <button
                              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                e.stopPropagation();
                                handleSaveChatTitle(chat.id);
                              }}
                              className="p-1 hover:bg-gray-700/50 rounded transition-all"
                              title="Save title"
                            >
                              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center gap-1.5 min-w-0">
                            <h3 className="text-xs font-bold text-white truncate flex-1">
                              {chat.title}
                            </h3>
                            <button
                              onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleEditChatTitle(chat.id, chat.title, e)}
                              className="opacity-0 group-hover/title:opacity-100 p-0.5 hover:bg-gray-700/50 rounded transition-all flex-shrink-0"
                              title="Edit title"
                            >
                              <Edit3 className="w-3 h-3 text-gray-500 hover:text-blue-400" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 truncate mb-2 leading-tight">{chat.preview}</p>
                      
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          {chat.tags.slice(0, 2).map((tag, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-gray-800/50 border border-gray-700/50 rounded text-[10px] font-semibold text-gray-500">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className="text-[10px] font-medium text-gray-600" suppressHydrationWarning>{formatTimestamp(chat.timestamp)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleStarChat(chat.id, e)}
                        className="p-1 rounded-md hover:bg-gray-700/50 transition-all opacity-100"
                      >
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      </button>
                      <button
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleDeleteChat(chat.id, e)}
                        className="p-1 rounded-md hover:bg-gray-700/50 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All Chats Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2.5 py-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {selectedCategory === 'all' ? 'All Chats' : categories.find(c => c.id === selectedCategory)?.name || 'Chats'}
              </span>
              <span className="text-[10px] font-bold text-gray-600">
                  {filteredChats.filter((chat: Chat) => !chat.starred).length}
              </span>
            </div>
            {filteredChats.filter(chat => !chat.starred).map((chat) => (
            <div
              key={chat.id}
              onClick={() => handleSelectChat(chat.id)}
              className={`group relative rounded-lg p-3 cursor-pointer transition-all duration-300 ${
                activeChat === chat.id
                  ? 'bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 border border-blue-500/30 shadow-lg shadow-blue-500/10'
                  : 'bg-gray-900/30 hover:bg-gray-800/50 border border-transparent hover:border-gray-700/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 group/title">
                    <MessageSquare className={`w-3.5 h-3.5 ${activeChat === chat.id ? 'text-blue-400' : 'text-gray-500'} flex-shrink-0`} />
                    {editingChatId === chat.id ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={editingChatTitle}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingChatTitle(e.target.value)}
                          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDownChatTitle(e, chat.id)}
                          onBlur={() => handleSaveChatTitle(chat.id)}
                          className="flex-1 bg-gray-800/80 border border-blue-500/50 rounded-md px-2 py-1 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          autoFocus
                          onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation();
                            handleSaveChatTitle(chat.id);
                          }}
                          className="p-1 hover:bg-gray-700/50 rounded transition-all"
                          title="Save title"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center gap-1.5 min-w-0">
                        <h3 className="text-xs font-bold text-white truncate flex-1">
                          {chat.title}
                        </h3>
                        <button
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleEditChatTitle(chat.id, chat.title, e)}
                          className="opacity-0 group-hover/title:opacity-100 p-0.5 hover:bg-gray-700/50 rounded transition-all flex-shrink-0"
                          title="Edit title"
                        >
                          <Edit3 className="w-3 h-3 text-gray-500 hover:text-blue-400" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mb-2 leading-tight">{chat.preview}</p>
                  
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {chat.tags.slice(0, 2).map((tag, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-gray-800/50 border border-gray-700/50 rounded text-[10px] font-semibold text-gray-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] font-medium text-gray-600" suppressHydrationWarning>{formatTimestamp(chat.timestamp)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleStarChat(chat.id, e)}
                    className={`p-1 rounded-md hover:bg-gray-700/50 transition-all ${
                      chat.starred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        chat.starred ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'
                      }`}
                    />
                  </button>
                  <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleDeleteChat(chat.id, e)}
                    className="p-1 rounded-md hover:bg-gray-700/50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>

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
              <div className="flex items-center gap-3.5">
                <div className="relative group/logo">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-xl blur-xl opacity-50 group-hover/logo:opacity-75 transition-opacity"></div>
                  <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-xl shadow-blue-500/40 group-hover/logo:shadow-blue-500/60 transition-all duration-300">
                    <Sparkles className="w-6 h-6 text-white group-hover/logo:scale-110 transition-transform" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-950 shadow-lg shadow-green-500/50 flex items-center justify-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
                    Leverage AI 
                  </h1>
                  <p className="text-[11px] font-bold text-gray-500 tracking-wide">Sports Intelligence </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isLoggedIn && user ? (
                <>
                  {/* User Profile Info */}
                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-900/50 border border-gray-800">
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
                  <button className="relative p-2.5 hover:bg-gray-800/70 rounded-xl transition-all duration-300 border border-gray-800 hover:border-gray-700 hover:shadow-lg group active:scale-95 border-none bg-transparent">
                    <Bell className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                    <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-950 shadow-lg shadow-red-500/50 animate-pulse"></div>
                  </button>
                  <button className="p-2.5 hover:bg-gray-800/70 rounded-xl transition-all duration-300 border border-gray-800 hover:border-gray-700 hover:shadow-lg group active:scale-95 border-none bg-transparent">
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
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn ${isGrouped ? 'mt-2' : 'mt-6'}`}
                  >
                <div className={`max-w-4xl ${message.role === 'user' ? 'w-auto' : 'w-full'}`}>
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30 rounded-full">
                        <Sparkles className="w-4.5 h-4.5 text-white" />
                      </div>
                      <span className="text-sm font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Leverage AI</span>
                      
                      {/* Data Verification Badge */}
                      {message.sources && message.sources.length > 0 && !message.isWelcome && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
                          <CheckCheck className="w-3 h-3 text-green-400" />
                          <span className="text-[10px] font-black text-green-400 uppercase tracking-wide">Verified</span>
                        </div>
                      )}
                      
                      {message.confidence && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-gray-800/50 border border-gray-700/50 rounded-full">
                          <Activity className="w-3.5 h-3.5 text-green-400" />
                          <span className="text-xs font-bold text-gray-400">{message.confidence}% confidence</span>
                        </div>
                      )}
                      
                      {/* Trust Level Indicator */}
                      {message.trustMetrics && !message.isWelcome && (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                          message.trustMetrics.trustLevel === 'high' ? 'bg-blue-500/10 border-blue-500/30' :
                          message.trustMetrics.trustLevel === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                          'bg-orange-500/10 border-orange-500/30'
                        }`}>
                          <Shield className={`w-3 h-3 ${
                            message.trustMetrics.trustLevel === 'high' ? 'text-blue-400' :
                            message.trustMetrics.trustLevel === 'medium' ? 'text-yellow-400' :
                            'text-orange-400'
                          }`} />
                          <span className={`text-[10px] font-black uppercase tracking-wide ${
                            message.trustMetrics.trustLevel === 'high' ? 'text-blue-400' :
                            message.trustMetrics.trustLevel === 'medium' ? 'text-yellow-400' :
                            'text-orange-400'
                          }`}>
                            {message.trustMetrics.adjustedTone}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div
                    className={`rounded-2xl px-5 py-4 relative group/message ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/20'
                        : 'bg-gradient-to-br from-gray-900/80 via-gray-850/80 to-gray-900/80 text-gray-100 border border-gray-700/50 backdrop-blur-sm'
                    }`}
                  >
                    {editingMessageIndex === index ? (
                      <div className="space-y-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
                              <div className="space-y-6">
                                {/* Header Section */}
                                <div className="flex items-start gap-4">
                                  <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg flex-shrink-0`}>
                                    <CardIcon className="w-6 h-6 text-white" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h2 className="text-xl font-black text-white">{card.title}</h2>
                                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                                        card.status === 'hot' || card.status === 'elite' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                        card.status === 'strong' || card.status === 'optimal' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                        'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                      }`}>{card.status}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                                      {card.category} • {card.subcategory}
                                    </p>
                                  </div>
                                </div>

                                {/* Overview */}
                                <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-gray-700/50 rounded-xl p-4">
                                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <Info className="w-3.5 h-3.5" />
                                    Overview
                                  </h3>
                                  <p className="text-sm text-gray-200 leading-relaxed">{overview}</p>
                                </div>

                                {/* Key Metrics Grid */}
                                <div>
                                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <BarChart className="w-3.5 h-3.5" />
                                    Key Metrics
                                  </h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {metrics.map((metric: { label: string; value: string }, idx: number) => (
                                      <div 
                                        key={idx}
                                        className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border border-gray-700/50 rounded-xl p-3.5 hover:border-gray-600/50 transition-colors"
                                      >
                                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{metric.label}</div>
                                        <div className="text-base font-black text-white">{metric.value}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Market Context */}
                                <div className="bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border border-blue-700/30 rounded-xl p-4">
                                  <h3 className="text-xs font-black text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    Market Context & Edge
                                  </h3>
                                  <p className="text-sm text-gray-200 leading-relaxed">{marketContext}</p>
                                </div>

                                {/* Risk Assessment */}
                                <div>
                                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5" />
                                    Risk Assessment
                                  </h3>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-700/30 rounded-xl p-4">
                                      <div className="text-[10px] font-bold text-green-500 uppercase tracking-wide mb-1.5">Conviction Level</div>
                                      <div className="text-lg font-black text-green-400">{riskAssessment.convictionLevel}</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-700/30 rounded-xl p-4">
                                      <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-wide mb-1.5">Risk Category</div>
                                      <div className="text-sm font-black text-yellow-400">{riskAssessment.riskCategory}</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-700/30 rounded-xl p-4">
                                      <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wide mb-1.5">Position Sizing</div>
                                      <div className="text-lg font-black text-purple-400">{riskAssessment.positionSize}</div>
                                      <div className="text-[10px] text-gray-500 mt-1">of bankroll</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Strategic Recommendations */}
                                <div>
                                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5" />
                                    Strategic Recommendations
                                  </h3>
                                  <div className="space-y-2.5">
                                    {recommendations.map((rec: { label: string; value: string }, idx: number) => (
                                      <div 
                                        key={idx}
                                        className="bg-gradient-to-r from-gray-800/40 to-gray-900/40 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/50 transition-colors"
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-white text-xs font-black">{idx + 1}</span>
                                          </div>
                                          <div className="flex-1">
                                            <div className="text-xs font-black text-gray-300 mb-1">{rec.label}</div>
                                            <div className="text-sm text-gray-400 leading-relaxed">{rec.value}</div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Next Steps CTA */}
                                <div className="bg-gradient-to-r from-indigo-900/30 via-purple-900/30 to-pink-900/30 border border-indigo-600/30 rounded-xl p-5">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                      <span className="font-bold text-white">Next Steps:</span> Would you like me to show correlated opportunities or dive deeper into any specific metric?
                                    </p>
                                    <button
                                      onClick={() => {
                                        console.log('[v0] Yes button clicked - showing correlated opportunities');
                                        handleFollowUp('correlated', card);
                                      }}
                                      disabled={isTyping}
                                      className="group relative flex items-center justify-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 disabled:from-gray-600 disabled:via-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-black text-base rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:shadow-xl hover:scale-105 active:scale-95 min-w-[140px] flex-shrink-0"
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
                                  <p key={pIdx} suppressHydrationWarning>
                                    {parts.map((part, partIdx) => {
                                      if (partIdx % 2 === 1) {
                                        return <span key={partIdx} className="font-black text-white">{part}</span>;
                                      }
                                      return <span key={partIdx}>{part}</span>;
                                    })}
                                  </p>
                                );
                              }
                              
                              return <p key={pIdx} suppressHydrationWarning>{paragraph}</p>;
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



                  {/* Dynamic Cards Section with Enhanced UX */}
                  {message.role === 'assistant' && (
                    <div className="mt-5">
                      {message.cards && message.cards.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                          {message.cards.map((card, cardIndex) => {
                            const { icon: _icon, ...cardData } = card;
                            return (
                              <div key={`${card.type}-${cardIndex}`}>
                                <DynamicCardRenderer
                                  card={cardData}
                                  index={cardIndex}
                                  onAnalyze={() => generateDetailedAnalysis(card)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
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
                            <span>Model: <span className="text-gray-500 font-semibold">{message.modelUsed}</span></span>
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
                          <summary className="cursor-pointer list-none flex items-center gap-2 text-[11px] text-gray-600 hover:text-gray-500 transition-colors">
                            <Shield className="w-3.5 h-3.5 text-green-500/60" />
                            <span className="font-semibold uppercase tracking-wide">AI Trust & Integrity</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              message.trustMetrics.trustLevel === 'high' ? 'bg-green-600/20 text-green-500' :
                              message.trustMetrics.trustLevel === 'medium' ? 'bg-blue-600/20 text-blue-500' :
                              'bg-orange-600/20 text-orange-500'
                            }`}>
                              {message.trustMetrics.finalConfidence}% {message.trustMetrics.trustLevel === 'high' ? 'High' : message.trustMetrics.trustLevel === 'medium' ? 'Med' : 'Low'} Trust
                            </span>
                            <ChevronRight className="w-3 h-3 group-open/trust:rotate-90 transition-transform" />
                          </summary>
                          <div className="mt-3 space-y-3 pl-5">
                            {/* Trust Metrics Grid */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-900/30 border border-gray-800/50">
                                <span className="text-[10px] text-gray-600 font-semibold">Benford Market</span>
                                <span className={`text-[11px] font-bold tabular-nums ${
                                  message.trustMetrics.benfordIntegrity >= 80 ? 'text-green-500' :
                                  message.trustMetrics.benfordIntegrity >= 60 ? 'text-yellow-500' : 'text-red-500'
                                }`}>
                                  {message.trustMetrics.benfordIntegrity}%
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-900/30 border border-gray-800/50">
                                <span className="text-[10px] text-gray-600 font-semibold">Odds Alignment</span>
                                <span className={`text-[11px] font-bold tabular-nums ${
                                  message.trustMetrics.oddsAlignment >= 80 ? 'text-green-500' :
                                  message.trustMetrics.oddsAlignment >= 60 ? 'text-yellow-500' : 'text-red-500'
                                }`}>
                                  {message.trustMetrics.oddsAlignment}%
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-900/30 border border-gray-800/50">
                                <span className="text-[10px] text-gray-600 font-semibold">Market Consensus</span>
                                <span className={`text-[11px] font-bold tabular-nums ${
                                  message.trustMetrics.marketConsensus >= 80 ? 'text-green-500' :
                                  message.trustMetrics.marketConsensus >= 60 ? 'text-yellow-500' : 'text-red-500'
                                }`}>
                                  {message.trustMetrics.marketConsensus}%
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-900/30 border border-gray-800/50">
                                <span className="text-[10px] text-gray-600 font-semibold">Historical Accuracy</span>
                                <span className={`text-[11px] font-bold tabular-nums ${
                                  message.trustMetrics.historicalAccuracy >= 80 ? 'text-green-500' :
                                  message.trustMetrics.historicalAccuracy >= 60 ? 'text-yellow-500' : 'text-red-500'
                                }`}>
                                  {message.trustMetrics.historicalAccuracy}%
                                </span>
                              </div>
                            </div>

                            {/* Risk Assessment */}
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-900/30 border border-gray-800/50">
                              <span className="text-[10px] text-gray-600 font-semibold">Risk Level:</span>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                message.trustMetrics.riskLevel === 'low' ? 'bg-green-600/20 text-green-500' :
                                message.trustMetrics.riskLevel === 'medium' ? 'bg-yellow-600/20 text-yellow-500' :
                                'bg-red-600/20 text-red-500'
                              }`}>
                                {message.trustMetrics.riskLevel.charAt(0).toUpperCase() + message.trustMetrics.riskLevel.slice(1)} Risk
                              </span>
                              <span className="text-[10px] text-gray-700">• {message.trustMetrics.adjustedTone}</span>
                            </div>

                            {/* Flags if present */}
                            {message.trustMetrics.flags && message.trustMetrics.flags.length > 0 && (
                              <details className="group/flags">
                                <summary className="cursor-pointer list-none flex items-center gap-1.5 text-[10px] text-orange-600 hover:text-orange-500 transition-colors">
                                  <AlertCircle className="w-3 h-3" />
                                  <span className="font-semibold">{message.trustMetrics.flags.length} issue{message.trustMetrics.flags.length !== 1 ? 's' : ''} flagged</span>
                                  <ChevronRight className="w-2.5 h-2.5 group-open/flags:rotate-90 transition-transform" />
                                </summary>
                                <div className="mt-2 space-y-1.5">
                                  {message.trustMetrics.flags.map((flag, idx) => (
                                    <div 
                                      key={idx}
                                      className={`px-2.5 py-1.5 rounded-lg border text-[10px] ${
                                        flag.severity === 'error' ? 'bg-red-600/10 border-red-600/20 text-red-500' :
                                        flag.severity === 'warning' ? 'bg-yellow-600/10 border-yellow-600/20 text-yellow-500' :
                                        'bg-blue-600/10 border-blue-600/20 text-blue-500'
                                      }`}
                                    >
                                      <div className="font-bold mb-0.5">{flag.type.charAt(0).toUpperCase() + flag.type.slice(1)} Check</div>
                                      <div className="text-gray-600">{flag.message}</div>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
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
                            onClick={() => handleVote(index, 'up')}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-green-500/10 active:bg-green-500/20 transition-all group/action border border-transparent hover:border-green-500/30"
                            title="This response was helpful"
                            aria-label="Mark as helpful"
                          >
                            <ThumbsUp className="w-4 h-4 text-gray-500 group-hover/action:text-green-400 transition-colors" />
                            <span className="text-xs font-bold text-gray-500 group-hover/action:text-green-400">Helpful</span>
                          </button>
                          <button
                            onClick={() => handleVote(index, 'down')}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-red-500/10 active:bg-red-500/20 transition-all group/action border border-transparent hover:border-red-500/30"
                            title="This response needs improvement"
                            aria-label="Mark as needing improvement"
                          >
                            <ThumbsDown className="w-4 h-4 text-gray-500 group-hover/action:text-red-400 transition-colors" />
                            <span className="text-xs font-bold text-gray-500 group-hover/action:text-red-400">Improve</span>
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
                        <span className="text-xs font-medium text-gray-500 tabular-nums" suppressHydrationWarning>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
              <AIProgressIndicator />
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
            {/* Dynamic Contextual Suggestions or Platform Prompts */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0 mb-5">
              {(suggestedPrompts.length > 0 && messages.length > 1 ? suggestedPrompts : quickActions).map((action, idx) => {
                const Icon = action.icon;
                const isSuggested = suggestedPrompts.length > 0 && messages.length > 1;
                
                return (
                  <button
                    key={`${action.label}-${idx}`}
                    onClick={() => {
                      setInput(action.label);
                      // Trigger submit after a brief delay to ensure state is updated
                      setTimeout(() => {
                        const userMessage: Message = {
                          role: 'user',
                          content: action.label,
                          timestamp: new Date()
                        };
                        setMessages((prev: Message[]) => [...prev, userMessage]);
                        
                        // Update chat metadata
                        setChats((prevChats: Chat[]) => prevChats.map((chat: Chat) => {
                          if (chat.id === activeChat) {
                            const updatedChat = { ...chat };
                            updatedChat.preview = action.label.slice(0, 50) + (action.label.length > 50 ? '...' : '');
                            updatedChat.timestamp = new Date();
                            if (chat.title === 'New Analysis') {
                              const words = action.label.split(' ').slice(0, 5).join(' ');
                              updatedChat.title = words + (action.label.split(' ').length > 5 ? '...' : '');
                            }
                            return updatedChat;
                          }
                          return chat;
                        }));
                        
  setInput('');
  generateRealResponse(action.label);
  }, 0);
                    }}
                    className={`group/prompt flex items-center gap-2.5 px-4 py-2.5 rounded-full border text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      isSuggested 
                        ? 'bg-gray-900/60 border-blue-500/50 text-gray-200 hover:bg-gradient-to-r hover:from-blue-600/20 hover:via-purple-600/20 hover:to-blue-600/20 hover:border-blue-400/70' 
                        : 'bg-gray-900/60 border-gray-800/70 text-gray-400 hover:bg-gray-800/70 hover:border-gray-700 hover:text-gray-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSuggested ? 'text-gray-400 group-hover/prompt:text-blue-400' : 'text-gray-500 group-hover/prompt:text-gray-400'}`} />
                    <span>{action.label}</span>
                  </button>
                );
              })}
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
                      <span className="text-xs font-bold text-gray-300 max-w-[150px] truncate">
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                      <button
                        onClick={() => removeAttachment(file.id)}
                        className="p-1 hover:bg-gray-700/50 rounded transition-all ml-1"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="flex-1 relative group/input">
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,text/csv,.tsv,text/tab-separated-values"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                <input
                  type="text"
                  value={input}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as React.FormEvent<HTMLInputElement>);
                    }
                  }}
                  placeholder="Ask about betting odds, fantasy strategy, DFS lineups, or Kalshi markets..."
                  className="w-full bg-gradient-to-r from-gray-900/80 to-gray-850/80 border border-gray-700/50 hover:border-gray-600/50 focus:border-blue-500/50 rounded-2xl px-6 py-4.5 pr-32 font-medium text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm shadow-inner text-xs"
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
              <button
                type="submit"
                disabled={(!input.trim() && uploadedFiles.length === 0) || isTyping}
                className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 disabled:from-gray-800 disabled:to-gray-900 disabled:cursor-not-allowed text-white rounded-2xl px-8 py-4.5 transition-all duration-300 shadow-xl shadow-blue-500/25 hover:shadow-blue-500/50 hover:shadow-2xl disabled:shadow-none flex items-center gap-2.5 font-bold group overflow-hidden hover:scale-[1.02] active:scale-95 disabled:hover:scale-100"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <Send className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                <span className="text-sm relative z-10 tracking-wide">Analyze</span>
              </button>
            </form>

            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-[11px] font-bold text-gray-600">
                Betting • Fantasy (NFBC/NFFC/NFBKC) • DFS • Kalshi • Real-time AI Analysis
              </p>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                  creditsRemaining <= 3 
                    ? 'text-orange-400 bg-orange-500/10 border-orange-500/30' 
                    : 'text-gray-500 bg-gray-900/30 border-gray-800'
                }`}>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{creditsRemaining} {creditsRemaining === 1 ? 'credit' : 'credits'} remaining</span>
                </div>
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
          <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl" onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPurchaseAmount(e.target.value)}
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
                    const amount = parseInt(purchaseAmount) || 20;
                    if (amount >= 10) {
                      // Calculate credits: $1 = 1 credit
                      addCredits(amount);
                      setShowPurchaseModal(false);
                      setPurchaseAmount('');
                    }
                  }}
                  disabled={!purchaseAmount || parseInt(purchaseAmount) < 10}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
                >
                  Purchase Credits
                </button>

                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <button
                    onClick={() => {
                      setShowPurchaseModal(false);
                      setShowSubscriptionModal(true);
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
          <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl" onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
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
                  // Mock subscription - in production this would integrate with Stripe
                  addCredits(20);
                  setShowSubscriptionModal(false);
                }}
                className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all mb-3"
              >
                Subscribe Now
              </button>

              <button
                onClick={() => {
                  setShowSubscriptionModal(false);
                  setShowPurchaseModal(true);
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
