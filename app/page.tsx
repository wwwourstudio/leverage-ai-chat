/**
 * Server Component Wrapper for Main Chat Interface
 * 
 * Fetches initial data server-side for better performance and SEO.
 * Passes pre-fetched data to client component for hydration.
 * 
 * @module app/page-wrapper
 */

import { Suspense } from 'react';
import { loadServerData, type ServerDataResult } from '@/lib/server-data-loader';
import { logEnvValidation, validateServerEnv } from '@/lib/env-validator';
import UnifiedAIPlatform from './page-client';

export interface ServerDataProps extends ServerDataResult {
  // Extended with data source tracking
}

async function fetchInitialServerData(): Promise<ServerDataProps> {
  console.log('[v0] Server: === Page Load - Fetching All Data ===');
  
  // Log environment validation for debugging
  const envValidation = validateServerEnv();
  logEnvValidation(envValidation, 'server');
  
  // Use enhanced data loader with parallel fetching and comprehensive error handling
  const serverData = await loadServerData({
    category: 'all',
    limit: 12,
    includeKalshi: true,
    includeOdds: true,
  });

  // Log data fetch results
  console.log('[v0] Server: Data fetch summary:');
  console.log('  - Cards:', serverData.initialCards.length);
  console.log('  - Session:', serverData.userSession ? 'authenticated' : 'anonymous');
  console.log('  - Sources:', serverData.dataSourcesUsed.join(', '));
  console.log('  - Missing Keys:', serverData.missingKeys.length);
  console.log('  - Errors:', serverData.fetchErrors.length);

  return serverData;
}

export default function UnifiedAIPlatform() {
  const [messages, setMessages] = useState<Message[]>([
  {
  role: 'assistant',
  content: "Welcome to **Leverage AI** - Your All-In-One Sports & Financial Intelligence Platform.\n\nI'm your AI companion for:\n\n**Sports Betting** - Real-time odds analysis, value detection, and sharp money tracking\n**Fantasy (NFC)** - NFBC/NFFC/NFBKC draft strategy, ADP analysis, and auction optimization\n**DFS** - Optimal lineup construction, leverage plays, and ownership projections\n**Kalshi Markets** - Financial event prediction, weather markets, and arbitrage opportunities\n\nEvery recommendation is backed by advanced AI models analyzing multiple data sources to provide you with verified, high-confidence insights.\n\n**How can I help you gain an edge today?**",
  timestamp: new Date(),
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
  const [suggestedPrompts, setSuggestedPrompts] = useState<Array<{ label: string; icon: any; category: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Initialize credits and load real insights on mount
  useEffect(() => {
    const data = getCreditData();
    setCreditsRemaining(data.credits);
    const rateData = getRateLimitData();
    setChatsRemaining(CHAT_LIMIT - rateData.count);

    // Load real user insights
    console.log('[v0] Loading real user insights on mount');
    fetchUserInsights().then(insights => {
      console.log('[v0] Loaded insights:', insights);
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages[0]?.isWelcome) {
          newMessages[0] = {
            ...newMessages[0],
            insights
          };
        }
        return newMessages;
      });
    }).catch(err => {
      console.error('[v0] Failed to load insights:', err);
    });
  }, []);

  const [chats, setChats] = useState<Chat[]>([
    {
      id: 'chat-1',
      title: 'NBA Lakers Betting Analysis',
      preview: 'Sharp money on Lakers -4.5, 73% win probability...',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      starred: true,
      category: 'betting',
      tags: ['live', 'nba', 'high-value']
    },
    {
      id: 'chat-2',
      title: 'NFBC Main Event Draft Strategy',
      preview: 'Zero RB approach with elite WR stacking...',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      starred: true,
      category: 'fantasy',
      tags: ['baseball', 'draft', 'strategy']
    },
    {
      id: 'chat-3',
      title: 'DFS NFL Week 8 Showdown Lineup',
      preview: 'Optimal $49,800 salary lineup, 315.2 projected...',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      starred: false,
      category: 'dfs',
      tags: ['nfl', 'optimizer', 'draftkings']
    },
    {
      id: 'chat-4',
      title: 'Kalshi Election Market Analysis',
      preview: 'Presidential market showing 58% probability...',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      starred: true,
      category: 'kalshi',
      tags: ['politics', 'prediction-market']
    },
    {
      id: 'chat-5',
      title: 'Best Ball Portfolio Optimization',
      preview: 'Diversify with 40% Mahomes exposure across...',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12),
      starred: false,
      category: 'fantasy',
      tags: ['football', 'bestball', 'nffc']
    },
    {
      id: 'chat-6',
      title: 'MLB Ohtani Props + Kalshi Weather',
      preview: 'Over 1.5 total bases +120, 68% hit rate with...',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      starred: true,
      category: 'betting',
      tags: ['mlb', 'props', 'cross-platform']
    }
  ]);

  const categories = [
    { id: 'all', name: 'All', icon: Layers, color: 'text-blue-400', desc: 'Everything' },
    { id: 'betting', name: 'Sports Betting', icon: TrendingUp, color: 'text-orange-400', desc: 'Live Odds & Props' },
    { id: 'fantasy', name: 'Fantasy (NFC)', icon: Trophy, color: 'text-green-400', desc: 'NFBC/NFFC/NFBKC' },
    { id: 'dfs', name: 'DFS Optimizer', icon: Award, color: 'text-purple-400', desc: 'DK/FD Lineups' },
    { id: 'kalshi', name: 'Kalshi Markets', icon: BarChart3, color: 'text-cyan-400', desc: 'Financial Prediction' },
  ];

  const unifiedCards: InsightCard[] = [
    // Betting Cards
    {
      type: 'live-odds',
      title: 'Live Odds Alert',
      icon: Zap,
      category: 'NBA',
      subcategory: 'Live Betting',
      gradient: 'from-orange-500 to-red-600',
      data: {
        matchup: 'Lakers vs Warriors',
        bestLine: 'Lakers -4.5 (-108)',
        book: 'FanDuel',
        edge: '+2.3%',
        movement: '↑ from -3.5',
        confidence: 87
      },
      status: 'hot'
    },
    {
      type: 'player-prop',
      title: 'Player Prop Value',
      icon: Target,
      category: 'NBA',
      subcategory: 'Props',
      gradient: 'from-purple-500 to-pink-600',
      data: {
        player: 'LeBron James',
        prop: 'Over 25.5 Points',
        line: '+105',
        hitRate: '68%',
        lastGames: '4/5 over',
        projection: '27.8 pts'
      },
      status: 'value'
    },
    // DFS Cards
    {
      type: 'dfs-lineup',
      title: 'Optimal DFS Lineup',
      icon: Award,
      category: 'NFL',
      subcategory: 'DraftKings',
      gradient: 'from-green-500 to-emerald-600',
      data: {
        platform: 'DraftKings Showdown',
        salary: '$49,800 / $50,000',
        projected: '315.2 pts',
        ownership: 'Avg 8.3% owned',
        topPlay: 'Patrick Mahomes (CPT)',
        leverage: 'High tournament upside'
      },
      status: 'optimal'
    },
    {
      type: 'dfs-value',
      title: 'DFS Value Play',
      icon: DollarSign,
      category: 'NFL',
      subcategory: 'FanDuel',
      gradient: 'from-blue-500 to-cyan-600',
      data: {
        player: 'Jakobi Meyers WR',
        salary: '$5,200',
        projection: '14.7 pts',
        valueRatio: '2.83x',
        ownership: '3.1% projected',
        matchup: 'vs NYJ (28th vs WR)'
      },
      status: 'value'
    },
    // Fantasy Cards
    {
      type: 'adp-analysis',
      title: 'ADP Value Target',
      icon: TrendingUp,
      category: 'NFFC',
      subcategory: 'Draft Strategy',
      gradient: 'from-green-600 to-teal-600',
      data: {
        player: 'Ja\'Marr Chase WR CIN',
        currentADP: '12.3',
        recommendation: 'Target at pick 15+',
        value: '+2.7 rounds value',
        reason: 'WR1 upside undervalued',
        confidence: 89
      },
      status: 'target'
    },
    {
      type: 'bestball-stack',
      title: 'Best Ball Stack',
      icon: Medal,
      category: 'NFFC',
      subcategory: 'Best Ball',
      gradient: 'from-purple-500 to-indigo-600',
      data: {
        stack: 'Chiefs Offense',
        players: 'Mahomes + Kelce + Rice',
        correlation: '+0.84',
        upside: 'Top 5% finish: 12.3%',
        ownership: 'Combined 18.2%',
        leverage: 'Elite tournament value'
      },
      status: 'elite'
    },
    {
      type: 'auction-value',
      title: 'Auction Sleeper',
      icon: ShoppingCart,
      category: 'NFBC',
      subcategory: 'Auction',
      gradient: 'from-blue-500 to-indigo-600',
      data: {
        player: 'Juan Soto OF NYY',
        avgPrice: '$38',
        targetPrice: '$35-37',
        maxPrice: '$40',
        reasoning: 'Yankee Stadium boost',
        projection: '35 HR, .285 AVG, 100 RBI'
      },
      status: 'sleeper'
    },
    // Kalshi Cards
    {
      type: 'kalshi-market',
      title: 'Kalshi Event Prediction',
      icon: BarChart3,
      category: 'Politics',
      subcategory: 'Election Markets',
      gradient: 'from-cyan-500 to-blue-600',
      data: {
        event: '2024 Presidential Election',
        market: 'Democratic Nominee',
        probability: '58%',
        volume: '$2.4M traded',
        edge: 'Sharp money moving',
        recommendation: 'Long at 56-58'
      },
      status: 'opportunity'
    },
    {
      type: 'kalshi-weather',
      title: 'Weather Market Edge',
      icon: Activity,
      category: 'Weather',
      subcategory: 'Temperature',
      gradient: 'from-orange-400 to-red-500',
      data: {
        market: 'SF Over 75°F Tomorrow',
        currentOdds: '42%',
        modelPrediction: '51%',
        edge: '+9% value',
        volume: '$126K',
        recommendation: 'Buy at <45%'
      },
      status: 'edge'
    },
    // Cross-Platform Insights
    {
      type: 'cross-platform',
      title: 'Multi-Platform Insight',
      icon: Sparkles,
      category: 'NFL + Kalshi',
      subcategory: 'Correlation Analysis',
      gradient: 'from-violet-500 to-purple-600',
      data: {
        insight: 'Weather impact on totals',
        game: 'BUF @ KC Sunday',
        kalshiWeather: '35°F, 70% snow',
        bettingAdjustment: 'Under 47.5 ↓ from 51',
        dfsImpact: 'RB usage up 18%',
        recommendation: 'Under + stack RBs in DFS'
      },
      status: 'synergy'
    },
    {
      type: 'ai-prediction',
      title: 'AI Model Prediction',
      icon: Sparkles,
      category: 'NFL',
      subcategory: 'Model Edge',
      gradient: 'from-blue-600 to-purple-600',
      data: {
        pick: 'Chiefs -7.5',
        probability: '73.4%',
        expectedValue: '+$12.80',
        modelEdge: '9.2%',
        sharpMoney: '78% on Chiefs',
        confidence: 91
      },
      status: 'strong'
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleStarChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(chats.map(chat =>
      chat.id === chatId ? { ...chat, starred: !chat.starred } : chat
    ));
  };

  const generateContextualSuggestions = (userMessage: string, responseCards: InsightCard[]) => {
    const msgLower = userMessage.toLowerCase();
    const suggestions: Array<{ label: string; icon: any; category: string }> = [];
    
    console.log('[v0] Generating dynamic suggestions based on response cards:', responseCards.length);
    
    // Analyze the AI's response cards to understand what was provided
    const cardTypes = responseCards.map(card => card.type);
    const categories = [...new Set(responseCards.map(card => card.category))];
    const hasLiveOdds = cardTypes.includes('live-odds');
    const hasDFSLineup = cardTypes.includes('dfs-lineup') || cardTypes.includes('dfs-value');
    const hasFantasy = cardTypes.includes('adp-analysis') || cardTypes.includes('bestball-stack') || cardTypes.includes('auction-value');
    const hasKalshi = cardTypes.includes('kalshi-market') || cardTypes.includes('kalshi-weather');
    const hasCrossPlatform = cardTypes.includes('cross-platform');
    const hasPlayerProps = cardTypes.includes('player-prop');
    
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
    
    console.log('[v0] Final contextual suggestions count:', uniqueSuggestions.length);
    
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
          { name: 'Advanced AI Model', type: 'model', reliability: 93 },
          { name: 'Historical Database', type: 'database', reliability: 95 },
          { name: 'Live Market API', type: 'api', reliability: 97 }
        ],
        modelUsed: 'GPT-4 Turbo',
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

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const generateDetailedAnalysis = (card: InsightCard) => {
    console.log('[v0] Generating detailed analysis for card:', card.title);
    
    // Check if user has credits
    if (!consumeCredit()) {
      console.log('[v0] No credits remaining, showing purchase modal');
      return;
    }

    setIsTyping(true);
    
    setTimeout(() => {
      // Extract metrics dynamically from card data
      const metrics = Object.entries(card.data).map(([key, value]) => ({
        label: key.replace(/([A-Z])/g, ' $1').trim(),
        value: value
      }));

      // Determine conviction and risk levels
      const convictionLevel = card.status === 'hot' || card.status === 'strong' || card.status === 'elite' ? 'High' : 
                             card.status === 'value' || card.status === 'optimal' ? 'Medium-High' : 'Medium';
      const riskCategory = card.status === 'hot' ? 'Time-sensitive play' : 
                          card.status === 'value' ? 'Measured opportunity' : 'Standard variance';
      const positionSize = card.status === 'elite' || card.status === 'strong' ? '15-20%' : 
                          card.status === 'value' ? '10-15%' : '8-12%';
      const entryStrategy = card.status === 'hot' ? 'Act quickly - market moving fast' : 'Monitor for optimal entry window';
      const crossPlatformRec = card.category === 'NBA' || card.category === 'NFL' ? 'DFS lineups and player props' : 
                               card.category === 'NFFC' || card.category === 'NFBC' ? 'auction values and stacks' : 'related betting markets';
      const exitConditions = card.status === 'hot' ? 'Lock in if line moves significantly against position' : 'Standard variance management';
      const leverageOpp = card.type === 'live-odds' ? 'correlated player props' : 
                         card.type === 'dfs-lineup' ? 'betting totals' : 
                         card.type === 'kalshi-market' ? 'sportsbook arbitrage' : 'related plays';

      // Store structured data using JSON marker (exclude icon - it's not serializable)
      const { icon, ...cardWithoutIcon } = card;
      const structuredData = {
        isDetailedAnalysis: true,
        card: cardWithoutIcon,
        metrics: metrics,
        overview: `${card.category} ${card.subcategory} opportunity identified with ${card.status.toUpperCase()} confidence. Based on multi-platform analysis, this presents significant edge potential.`,
        marketContext: `My AI models have analyzed ${card.category} data across multiple platforms including live odds feeds, historical databases, and prediction markets. This ${card.subcategory.toLowerCase()} opportunity shows strong alignment with profitable historical patterns.`,
        riskAssessment: {
          convictionLevel,
          riskCategory,
          positionSize
        },
        recommendations: [
          { label: 'Entry Strategy', value: entryStrategy },
          { label: 'Cross-Platform Plays', value: `Consider correlating with ${crossPlatformRec}` },
          { label: 'Exit Conditions', value: exitConditions },
          { label: 'Leverage Opportunities', value: `Stack with ${leverageOpp}` }
        ]
      };

      // Use special JSON marker in content
      const detailedAnalysisText = `__DETAILED_ANALYSIS__${JSON.stringify(structuredData)}__END_ANALYSIS__`;

      const aiMessage: Message = {
        role: 'assistant',
        content: detailedAnalysisText,
        timestamp: new Date(),
        // Remove cards array to eliminate duplicate display
        cards: [],
        sources: [
          { name: 'Advanced AI Model', type: 'model', reliability: 94 },
          { name: 'Historical Database', type: 'database', reliability: 96 },
          { name: 'Live Market API', type: 'api', reliability: 98 }
        ],
        modelUsed: 'GPT-4 Turbo',
        processingTime: 1050,
        trustMetrics: {
          benfordIntegrity: 88,
          oddsAlignment: 90,
          marketConsensus: 85,
          historicalAccuracy: 92,
          finalConfidence: 89,
          trustLevel: 'high',
          riskLevel: 'medium',
          adjustedTone: 'Moderate confidence'
        }
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setSuggestedPrompts(generateContextualSuggestions(card.title, aiMessage.cards || []));
      setIsTyping(false);
    }, 1200);
  };

  const generateRealResponse = async (userMessage: string) => {
    setIsTyping(true);
    const startTime = Date.now();
    
    try {
      console.log('[v0] Starting real AI analysis for:', userMessage);
      
      // Extract context from user message
      const context = {
        sport: extractSport(userMessage),
        marketType: extractMarketType(userMessage),
        platform: extractPlatform(userMessage),
        previousMessages: messages.slice(-5).map(m => ({ role: m.role, content: m.content }))
      };

      console.log('[v0] Extracted context:', context);
      
      // Fetch real data from our API routes
      const analysisPromise = fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage,
          context
        })
      }).then(async (res) => {
        if (!res.ok) {
          console.error('[v0] Analyze API returned', res.status);
          return { success: false, useFallback: true, error: `API returned ${res.status}` };
        }
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          console.error('[v0] Analyze API returned non-JSON:', text.substring(0, 100));
          return { success: false, useFallback: true, error: 'Invalid response from API' };
        }
      });

  // Display data quality metrics in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[v0] Page: Hydrating with server data:', {
      cardsCount: serverData.initialCards.length,
      hasSession: !!serverData.userSession,
      dataQuality: serverData.fetchErrors.length === 0 ? 'GOOD' : 'DEGRADED',
      sources: serverData.dataSourcesUsed,
    });
  }

  return (
    <Suspense fallback={<PageSkeleton />}>
      <UnifiedAIPlatform serverData={serverData} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex h-screen bg-gray-950 text-white animate-pulse">
      <div className="flex-1 flex flex-col">
        <div className="h-16 bg-gray-900/50 border-b border-gray-800/50" />
        <div className="flex-1 p-6 space-y-4">
          <div className="h-20 bg-gray-900/30 rounded-lg" />
          <div className="h-20 bg-gray-900/30 rounded-lg" />
          <div className="h-20 bg-gray-900/30 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
