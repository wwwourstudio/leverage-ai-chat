'use client';

import React from "react"

import { useState, useRef, useEffect } from 'react';
import { Send, TrendingUp, Trophy, Target, ThumbsUp, ThumbsDown, Menu, Plus, MessageSquare, Clock, Star, Trash2, Zap, AlertCircle, CheckCircle, DollarSign, Activity, Award, ChevronRight, Bell, Settings, ShoppingCart, Medal, PieChart, Layers, BarChart3, Sparkles, TrendingDown, Flame, Users, RefreshCw, Search, Calendar, Copy, Edit3, RotateCcw, Shield, Database, BookOpen, ExternalLink, X, CheckCheck, AlertTriangle, XCircle, TrendingUpIcon, BarChart, Info, Paperclip, FileText, ImageIcon, MoveIcon as RemoveIcon } from 'lucide-react';

interface FileAttachment {
  id: string;
  name: string;
  type: 'image' | 'csv';
  url: string;
  size: number;
  data?: any; // For CSV parsed data
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
  icon: any;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, string | number>;
  status: string;
}

export default function UnifiedAIPlatform() {
  const [messages, setMessages] = useState<Message[]>([
  {
  role: 'assistant',
  content: "Welcome to the All-In-One Sports & Financial Intelligence Platform! I'm your AI companion for NFC fantasy football (NFBC/NFFC/NFBKC), sports betting, DFS optimization, and financial event prediction via Kalshi. Whether you need draft strategy, live odds analysis, lineup optimization, or market insights - I've got you covered. What can I help you with today?",
  timestamp: new Date(),
  isWelcome: true,
  cards: [],
  insights: {
  totalValue: 4697.50,
  winRate: 66.8,
        roi: 15.6,
        activeContests: 12,
        totalInvested: 3450
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
  const [uploadedFiles, setUploadedFiles] = useState<FileAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Rate limiting utilities
  const CHAT_LIMIT = 5;
  const LIMIT_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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

  const updateRateLimitCount = () => {
    const data = getRateLimitData();
    const updated = { ...data, count: data.count + 1 };
    localStorage.setItem('chatRateLimit', JSON.stringify(updated));
    return updated;
  };

  const canCreateNewChat = () => {
    const data = getRateLimitData();
    return data.count < CHAT_LIMIT;
  };

  // Initialize chats remaining on mount
  useEffect(() => {
    const data = getRateLimitData();
    setChatsRemaining(CHAT_LIMIT - data.count);
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

  const simulateResponse = (userMessage: string) => {
    setIsTyping(true);
    
    setTimeout(() => {
      const responses = [
        {
          text: "Excellent timing! I've analyzed live odds, fantasy matchups, and prediction markets to find the best opportunities across all platforms:",
          cards: [unifiedCards[0], unifiedCards[4], unifiedCards[7]]
        },
        {
          text: "I've optimized your strategy by combining DFS data, betting lines, and Kalshi market insights. Here's what my AI models are showing:",
          cards: [unifiedCards[2], unifiedCards[3], unifiedCards[9]]
        },
        {
          text: "Great question! I'm seeing strong edges across multiple platforms. Here's the comprehensive breakdown:",
          cards: [unifiedCards[1], unifiedCards[5], unifiedCards[8], unifiedCards[10]]
        },
        {
          text: "Perfect! I've identified several high-value opportunities by cross-referencing fantasy values, betting markets, and financial predictions:",
          cards: [unifiedCards[4], unifiedCards[6], unifiedCards[7]]
        }
      ];

      const response = responses[Math.floor(Math.random() * responses.length)];
      
    const sourceTypes: Array<{ name: string; type: 'database' | 'api' | 'model' | 'cache'; reliability: number; url?: string }> = [
      { name: 'Live Odds API', type: 'api', reliability: 98, url: 'https://api.odds.com' },
      { name: 'Fantasy Database', type: 'database', reliability: 95 },
      { name: 'GPT-4 Analysis', type: 'model', reliability: 92 },
      { name: 'Historical Cache', type: 'cache', reliability: 88 },
      { name: 'Kalshi Markets API', type: 'api', reliability: 97, url: 'https://api.kalshi.com' },
      { name: 'DFS Optimizer Engine', type: 'model', reliability: 94 }
    ];
    
    const randomSources = sourceTypes
      .sort(() => Math.random() - 0.5)
      .slice(0, 2 + Math.floor(Math.random() * 2));

    // Generate AI Trust & Integrity metrics
    const benfordIntegrity = 75 + Math.floor(Math.random() * 23);
    const oddsAlignment = 80 + Math.floor(Math.random() * 18);
    const marketConsensus = 70 + Math.floor(Math.random() * 25);
    const historicalAccuracy = 78 + Math.floor(Math.random() * 20);

    const finalConfidence = Math.round(
      benfordIntegrity * 0.20 +
      oddsAlignment * 0.30 +
      marketConsensus * 0.30 +
      historicalAccuracy * 0.20
    );

    const trustLevel: 'high' | 'medium' | 'low' = 
      finalConfidence >= 80 ? 'high' : 
      finalConfidence >= 60 ? 'medium' : 'low';

    const riskLevel: 'low' | 'medium' | 'high' = 
      finalConfidence >= 80 ? 'low' : 
      finalConfidence >= 60 ? 'medium' : 'high';

    const flags: Array<{ type: string; message: string; severity: 'info' | 'warning' | 'error' }> = [];
    
    if (benfordIntegrity < 70) {
      flags.push({ 
        type: 'benford', 
        message: 'AI numeric outputs show deviation from market odds distribution', 
        severity: 'warning' 
      });
    }
    if (oddsAlignment < 85) {
      flags.push({ 
        type: 'odds', 
        message: `AI recommendation differs from live market by ${(100 - oddsAlignment) / 10}%`, 
        severity: oddsAlignment < 70 ? 'error' : 'warning' 
      });
    }
    if (marketConsensus < 70) {
      flags.push({ 
        type: 'consensus', 
        message: 'Significant divergence from market consensus detected', 
        severity: 'warning' 
      });
    }

    const adjustedTone = trustLevel === 'high' ? 'Strong signal' : 
                        trustLevel === 'medium' ? 'Moderate edge' : 
                        'High uncertainty';

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: response.text,
      timestamp: new Date(),
      cards: response.cards,
      confidence: 85 + Math.floor(Math.random() * 13),
      sources: randomSources,
      modelUsed: 'GPT-4 Turbo',
      processingTime: 850 + Math.floor(Math.random() * 500),
      trustMetrics: {
        benfordIntegrity,
        oddsAlignment,
        marketConsensus,
        historicalAccuracy,
        finalConfidence,
        trustLevel,
        flags: flags.length > 0 ? flags : undefined,
        riskLevel,
        adjustedTone
      }
    }]);
    setIsTyping(false);
  }, 1500);
};

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: FileAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = file.type;

      // Validate file type
      if (!fileType.startsWith('image/') && fileType !== 'text/csv') {
        alert(`File type not supported: ${file.name}. Please upload images (JPEG, PNG) or CSV files.`);
        continue;
      }

      // Create file URL
      const fileUrl = URL.createObjectURL(file);

      const attachment: FileAttachment = {
        id: `${Date.now()}-${i}`,
        name: file.name,
        type: fileType.startsWith('image/') ? 'image' : 'csv',
        url: fileUrl,
        size: file.size
      };

      // Parse CSV if needed
      if (fileType === 'text/csv') {
        const text = await file.text();
        const parsed = parseCSV(text);
        attachment.data = parsed;
      }

      newAttachments.push(attachment);
    }

    setUploadedFiles(prev => [...prev, ...newAttachments]);
    console.log('[v0] Files uploaded:', newAttachments.length);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => 
      line.split(',').map(cell => cell.trim())
    );

    return { headers, rows };
  };

  const removeAttachment = (id: string) => {
    setUploadedFiles(prev => {
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

    const userMessage: Message = {
      role: 'user',
      content: input || '📎 Attached files',
      timestamp: new Date(),
      attachments: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setUploadedFiles([]);
    
    // Update chat preview and title based on first user message
    setChats(prevChats => prevChats.map(chat => {
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
    simulateResponse(input);
  };

  const handleNewChat = () => {
    // Check rate limit before creating new chat
    if (!canCreateNewChat()) {
      setShowLimitNotification(true);
      return;
    }

    const newChatId = `chat-${Date.now()}`;
    const welcomeMessage = "Welcome! I'm ready to analyze betting odds, fantasy values, DFS lineups, or Kalshi markets. What would you like to explore?";
    const newChat: Chat = {
      id: newChatId,
      title: 'New Analysis',
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
        cards: []
      }
    ]);

    // Update rate limit count
    const updated = updateRateLimitCount();
    setChatsRemaining(CHAT_LIMIT - updated.count);
    console.log('[v0] New chat created. Chats remaining:', CHAT_LIMIT - updated.count);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChat(chatId);
    setMessages([
      {
        role: 'assistant',
        content: "Analysis loaded. Let's continue building your edge across all platforms!",
        timestamp: new Date(),
        cards: []
      }
    ]);
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(chats.filter(chat => chat.id !== chatId));
    if (activeChat === chatId && chats.length > 1) {
      const remainingChats = chats.filter(chat => chat.id !== chatId);
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
      setMessages(prev => prev.map((msg, i) => {
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
        simulateResponse(editingContent);
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
      simulateResponse(userMessage);
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

  const renderInsightCard = (card: InsightCard, index: number) => {
    const Icon = card.icon;
    const badge = getStatusBadge(card.status);
    const BadgeIcon = badge.icon;

    return (
      <div 
        key={index} 
        className="group relative bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900 rounded-2xl p-5 border border-gray-700/50 hover:border-gray-600 transition-all duration-500 shadow-xl hover:shadow-2xl hover:scale-[1.02] overflow-hidden"
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
        
        <div className="relative flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{card.category} • {card.subcategory}</span>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${badge.bg} ${badge.border}`}>
                  <BadgeIcon className={`w-3 h-3 ${badge.text}`} />
                  <span className={`text-xs font-bold ${badge.text}`}>{badge.label}</span>
                </div>
              </div>
              <h3 className="text-sm font-bold text-white">{card.title}</h3>
            </div>
          </div>
        </div>

        <div className="relative space-y-2.5">
          {Object.entries(card.data).map(([key, value], i) => (
            <div key={i} className="flex items-start justify-between group/item">
              <span className="text-xs font-medium text-gray-400 capitalize flex-shrink-0 mr-3">
                {key.replace(/([A-Z])/g, ' $1').trim()}:
              </span>
              <span className="text-sm font-bold text-white group-hover/item:text-blue-400 transition-colors text-right">
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className="relative mt-4 pt-4 border-t border-gray-700/50">
          <button className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors group/btn">
            <span>View Full Analysis</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  };

  const filteredChats = selectedCategory === 'all'
  ? chats
  : chats.filter(chat => chat.category === selectedCategory);
  
  // Platform-specific AI-powered prompt suggestions
  const platformPrompts: Record<string, Array<{ label: string; icon: any; category: string }>> = {
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
          {filteredChats.filter(chat => chat.starred).length > 0 && (
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
                              onChange={(e) => setEditingChatTitle(e.target.value)}
                              onKeyDown={(e) => handleKeyDownChatTitle(e, chat.id)}
                              onBlur={() => handleSaveChatTitle(chat.id)}
                              className="flex-1 bg-gray-800/80 border border-blue-500/50 rounded-md px-2 py-1 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              onClick={(e) => {
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
                              onClick={(e) => handleEditChatTitle(chat.id, chat.title, e)}
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
                        <span className="text-[10px] font-medium text-gray-600">{formatTimestamp(chat.timestamp)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={(e) => handleStarChat(chat.id, e)}
                        className="p-1 rounded-md hover:bg-gray-700/50 transition-all opacity-100"
                      >
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteChat(chat.id, e)}
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
                {filteredChats.filter(chat => !chat.starred).length}
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
                          onChange={(e) => setEditingChatTitle(e.target.value)}
                          onKeyDown={(e) => handleKeyDownChatTitle(e, chat.id)}
                          onBlur={() => handleSaveChatTitle(chat.id)}
                          className="flex-1 bg-gray-800/80 border border-blue-500/50 rounded-md px-2 py-1 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
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
                          onClick={(e) => handleEditChatTitle(chat.id, chat.title, e)}
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
                    <span className="text-[10px] font-medium text-gray-600">{formatTimestamp(chat.timestamp)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={(e) => handleStarChat(chat.id, e)}
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
                    onClick={(e) => handleDeleteChat(chat.id, e)}
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
              
              <button className="relative p-2.5 hover:bg-gray-800/70 rounded-xl transition-all duration-300 border border-gray-800 hover:border-gray-700 hover:shadow-lg group active:scale-95 border-none bg-transparent">
                <Bell className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-950 shadow-lg shadow-red-500/50 animate-pulse"></div>
              </button>
              <button className="p-2.5 hover:bg-gray-800/70 rounded-xl transition-all duration-300 border border-gray-800 hover:border-gray-700 hover:shadow-lg group active:scale-95 border-none bg-transparent">
                <Settings className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors group-hover:rotate-90 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar">
          <div className="max-w-5xl mx-auto space-y-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              >
                <div className={`max-w-4xl ${message.role === 'user' ? 'w-auto' : 'w-full'}`}>
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30 rounded-full">
                        <Sparkles className="w-4.5 h-4.5 text-white" />
                      </div>
                      <span className="text-sm font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Leverage AI </span>
                      {message.confidence && (
                        <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-gray-800/50 border border-gray-700/50 rounded-full">
                          <Activity className="w-3.5 h-3.5 text-green-400" />
                          <span className="text-xs font-bold text-gray-400">{message.confidence}% confidence</span>
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
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[80px] resize-y"
                          autoFocus
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
                        <p className="text-sm leading-relaxed font-medium">{message.content}</p>
                        
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

                  {message.role === 'assistant' && message.insights && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {message.insights.totalValue !== undefined && (
                        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-3">
                          <div className="text-xs font-bold text-gray-400 mb-1">Total Value</div>
                          <div className="text-lg font-black text-green-400">${message.insights.totalValue.toFixed(2)}</div>
                        </div>
                      )}
                      {message.insights.winRate !== undefined && (
                        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-3">
                          <div className="text-xs font-bold text-gray-400 mb-1">Win Rate</div>
                          <div className="text-lg font-black text-blue-400">{message.insights.winRate}%</div>
                        </div>
                      )}
                      {message.insights.roi !== undefined && (
                        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-3">
                          <div className="text-xs font-bold text-gray-400 mb-1">ROI</div>
                          <div className="text-lg font-black text-purple-400">+{message.insights.roi}%</div>
                        </div>
                      )}
                      {message.insights.activeContests !== undefined && (
                        <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-3">
                          <div className="text-xs font-bold text-gray-400 mb-1">Active</div>
                          <div className="text-lg font-black text-orange-400">{message.insights.activeContests}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {message.cards && message.cards.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
                      {message.cards.map((card, cardIndex) => renderInsightCard(card, cardIndex))}
                    </div>
                  )}

                  {/* Source Attribution & Reliability - Hidden for welcome message */}
                  {message.role === 'assistant' && !message.isWelcome && message.sources && message.sources.length > 0 && (
                    <div className="mt-5 ml-11 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-800/50">
                        <Shield className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Source Credibility</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {message.sources.map((source, idx) => {
                          const reliabilityColor = source.reliability >= 95 ? 'text-green-400 border-green-500/30 bg-green-500/5' :
                                                  source.reliability >= 90 ? 'text-blue-400 border-blue-500/30 bg-blue-500/5' :
                                                  'text-yellow-400 border-yellow-500/30 bg-yellow-500/5';
                          const Icon = source.type === 'database' ? Database : 
                                      source.type === 'api' ? Activity : 
                                      source.type === 'model' ? Sparkles : 
                                      RefreshCw;
                          return (
                            <div 
                              key={idx} 
                              className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border ${reliabilityColor} group/source cursor-default transition-all hover:scale-[1.02]`}
                              role="status"
                              aria-label={`${source.name} source with ${source.reliability}% reliability`}
                            >
                              <div className="p-1 rounded-lg bg-gray-900/50">
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-bold">{source.name}</span>
                              <div className="w-px h-4 bg-gray-700/50"></div>
                              <span className="text-xs font-black tabular-nums">{source.reliability}%</span>
                              {source.url && (
                                <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/source:opacity-100 transition-opacity ml-0.5" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {message.modelUsed && (
                        <div className="flex items-center gap-4 pt-2 border-t border-gray-800/30">
                          <span className="flex items-center gap-2 text-xs text-gray-500">
                            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                            <span className="font-semibold">Model:</span>
                            <span className="font-bold text-gray-400">{message.modelUsed}</span>
                          </span>
                          {message.processingTime && (
                            <span className="flex items-center gap-2 text-xs text-gray-500">
                              <Zap className="w-3.5 h-3.5 text-yellow-400" />
                              <span className="font-semibold">Processed in:</span>
                              <span className="font-bold text-gray-400 tabular-nums">{message.processingTime}ms</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Trust & Integrity - Hidden for welcome message */}
                  {message.role === 'assistant' && !message.isWelcome && message.trustMetrics && (
                    <div className="mt-5 ml-11 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-800/50">
                        <Shield className="w-4 h-4 text-green-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">AI Trust & Integrity</span>
                      </div>

                      {/* Trust Indicators */}
                      <div className="flex flex-wrap gap-2">
                        {/* Benford Market Integrity */}
                        <div 
                          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border cursor-default transition-all hover:scale-[1.02] ${
                            message.trustMetrics.benfordIntegrity >= 80 
                              ? 'text-green-400 border-green-500/30 bg-green-500/5' 
                              : message.trustMetrics.benfordIntegrity >= 60 
                              ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5'
                              : 'text-red-400 border-red-500/30 bg-red-500/5'
                          }`}
                          title="AI numeric outputs are statistically validated against live sportsbook odds distributions"
                          role="status"
                        >
                          <div className="p-1 rounded-lg bg-gray-900/50">
                            {message.trustMetrics.benfordIntegrity >= 80 ? (
                              <CheckCheck className="w-3.5 h-3.5" />
                            ) : message.trustMetrics.benfordIntegrity >= 60 ? (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <span className="text-xs font-bold">Benford Market Integrity</span>
                          <div className="w-px h-4 bg-gray-700/50"></div>
                          <span className="text-xs font-black tabular-nums">{message.trustMetrics.benfordIntegrity}%</span>
                        </div>

                        {/* Odds Alignment */}
                        <div 
                          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border cursor-default transition-all hover:scale-[1.02] ${
                            message.trustMetrics.oddsAlignment >= 80 
                              ? 'text-green-400 border-green-500/30 bg-green-500/5' 
                              : message.trustMetrics.oddsAlignment >= 60 
                              ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5'
                              : 'text-red-400 border-red-500/30 bg-red-500/5'
                          }`}
                          title="Measures how closely AI recommendations align with live sportsbook odds"
                          role="status"
                        >
                          <div className="p-1 rounded-lg bg-gray-900/50">
                            {message.trustMetrics.oddsAlignment >= 80 ? (
                              <CheckCheck className="w-3.5 h-3.5" />
                            ) : message.trustMetrics.oddsAlignment >= 60 ? (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <span className="text-xs font-bold">Odds Alignment</span>
                          <div className="w-px h-4 bg-gray-700/50"></div>
                          <span className="text-xs font-black tabular-nums">{message.trustMetrics.oddsAlignment}%</span>
                        </div>

                        {/* Market Consensus */}
                        <div 
                          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border cursor-default transition-all hover:scale-[1.02] ${
                            message.trustMetrics.marketConsensus >= 80 
                              ? 'text-green-400 border-green-500/30 bg-green-500/5' 
                              : message.trustMetrics.marketConsensus >= 60 
                              ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5'
                              : 'text-red-400 border-red-500/30 bg-red-500/5'
                          }`}
                          title="Compares AI outputs to aggregated market consensus"
                          role="status"
                        >
                          <div className="p-1 rounded-lg bg-gray-900/50">
                            {message.trustMetrics.marketConsensus >= 80 ? (
                              <CheckCheck className="w-3.5 h-3.5" />
                            ) : message.trustMetrics.marketConsensus >= 60 ? (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <span className="text-xs font-bold">Market Consensus</span>
                          <div className="w-px h-4 bg-gray-700/50"></div>
                          <span className="text-xs font-black tabular-nums">{message.trustMetrics.marketConsensus}%</span>
                        </div>

                        {/* Historical AI Accuracy */}
                        <div 
                          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border cursor-default transition-all hover:scale-[1.02] ${
                            message.trustMetrics.historicalAccuracy >= 80 
                              ? 'text-green-400 border-green-500/30 bg-green-500/5' 
                              : message.trustMetrics.historicalAccuracy >= 60 
                              ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5'
                              : 'text-red-400 border-red-500/30 bg-red-500/5'
                          }`}
                          title="Historical accuracy of this model on similar markets"
                          role="status"
                        >
                          <div className="p-1 rounded-lg bg-gray-900/50">
                            {message.trustMetrics.historicalAccuracy >= 80 ? (
                              <CheckCheck className="w-3.5 h-3.5" />
                            ) : message.trustMetrics.historicalAccuracy >= 60 ? (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <span className="text-xs font-bold">Historical AI Accuracy</span>
                          <div className="w-px h-4 bg-gray-700/50"></div>
                          <span className="text-xs font-black tabular-nums">{message.trustMetrics.historicalAccuracy}%</span>
                        </div>
                      </div>

                      {/* Final Confidence Score & Risk-Adjusted Recommendation */}
                      <div className="grid md:grid-cols-2 gap-3 pt-2 border-t border-gray-800/30">
                        <div className={`p-4 rounded-xl border ${
                          message.trustMetrics.trustLevel === 'high' 
                            ? 'bg-green-500/5 border-green-500/30' 
                            : message.trustMetrics.trustLevel === 'medium'
                            ? 'bg-blue-500/5 border-blue-500/30'
                            : 'bg-orange-500/5 border-orange-500/30'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className={`w-4 h-4 ${
                              message.trustMetrics.trustLevel === 'high' ? 'text-green-400' :
                              message.trustMetrics.trustLevel === 'medium' ? 'text-blue-400' :
                              'text-orange-400'
                            }`} />
                            <span className="text-xs font-bold text-gray-400 uppercase">Final Confidence</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className={`text-2xl font-black tabular-nums ${
                              message.trustMetrics.trustLevel === 'high' ? 'text-green-400' :
                              message.trustMetrics.trustLevel === 'medium' ? 'text-blue-400' :
                              'text-orange-400'
                            }`}>
                              {message.trustMetrics.finalConfidence}%
                            </span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                              message.trustMetrics.trustLevel === 'high' 
                                ? 'bg-green-500/20 text-green-400' 
                                : message.trustMetrics.trustLevel === 'medium'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-orange-500/20 text-orange-400'
                            }`}>
                              {message.trustMetrics.trustLevel === 'high' ? 'High Trust' : 
                               message.trustMetrics.trustLevel === 'medium' ? 'Medium Trust' : 
                               'Low Trust'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Confidence: {message.trustMetrics.adjustedTone}
                          </p>
                        </div>

                        <div className={`p-4 rounded-xl border ${
                          message.trustMetrics.riskLevel === 'low' 
                            ? 'bg-green-500/5 border-green-500/30' 
                            : message.trustMetrics.riskLevel === 'medium'
                            ? 'bg-yellow-500/5 border-yellow-500/30'
                            : 'bg-red-500/5 border-red-500/30'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className={`w-4 h-4 ${
                              message.trustMetrics.riskLevel === 'low' ? 'text-green-400' :
                              message.trustMetrics.riskLevel === 'medium' ? 'text-yellow-400' :
                              'text-red-400'
                            }`} />
                            <span className="text-xs font-bold text-gray-400 uppercase">Risk-Adjusted Recommendation</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                              message.trustMetrics.riskLevel === 'low' 
                                ? 'bg-green-500/20 text-green-400' 
                                : message.trustMetrics.riskLevel === 'medium'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {message.trustMetrics.riskLevel === 'low' ? 'Low Risk' : 
                               message.trustMetrics.riskLevel === 'medium' ? 'Medium Risk' : 
                               'High Risk'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            {message.trustMetrics.riskLevel === 'low' 
                              ? 'AI outputs align well with market data'
                              : message.trustMetrics.riskLevel === 'medium'
                              ? 'Some divergence from market consensus'
                              : 'Significant deviation from market baselines'}
                          </p>
                        </div>
                      </div>

                      {/* Advanced View: "Why Flagged?" */}
                      {message.trustMetrics.flags && message.trustMetrics.flags.length > 0 && (
                        <details className="pt-2 border-t border-gray-800/30">
                          <summary className="cursor-pointer hover:text-gray-300 text-xs font-bold text-gray-400 flex items-center gap-2 py-2">
                            <Info className="w-4 h-4 text-orange-400" />
                            Advanced View: Why Flagged? ({message.trustMetrics.flags.length} {message.trustMetrics.flags.length === 1 ? 'issue' : 'issues'})
                          </summary>
                          <div className="mt-3 space-y-2">
                            {message.trustMetrics.flags.map((flag, idx) => (
                              <div 
                                key={idx} 
                                className={`flex items-start gap-3 p-3 rounded-lg border ${
                                  flag.severity === 'error' 
                                    ? 'bg-red-500/5 border-red-500/30' 
                                    : flag.severity === 'warning'
                                    ? 'bg-yellow-500/5 border-yellow-500/30'
                                    : 'bg-blue-500/5 border-blue-500/30'
                                }`}
                              >
                                <div className="p-1 rounded-lg bg-gray-900/50 flex-shrink-0">
                                  {flag.severity === 'error' ? (
                                    <XCircle className="w-4 h-4 text-red-400" />
                                  ) : flag.severity === 'warning' ? (
                                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                  ) : (
                                    <Info className="w-4 h-4 text-blue-400" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className={`text-xs font-bold mb-1 ${
                                    flag.severity === 'error' ? 'text-red-400' :
                                    flag.severity === 'warning' ? 'text-yellow-400' :
                                    'text-blue-400'
                                  }`}>
                                    {flag.type.charAt(0).toUpperCase() + flag.type.slice(1)} Check
                                  </p>
                                  <p className="text-xs text-gray-400 leading-relaxed">
                                    {flag.message}
                                  </p>
                                </div>
                              </div>
                            ))}
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
                        <span className="text-xs font-medium text-gray-500 tabular-nums">{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Sparkles className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div className="bg-gradient-to-br from-gray-900/80 via-gray-850/80 to-gray-900/80 border border-gray-700/50 backdrop-blur-sm rounded-2xl px-5 py-4">
                    <div className="flex gap-2">
                      <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
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
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0 mb-5">
              {quickActions.map((action) => {
                const Icon = action.icon;
                const categoryColor = categories.find(c => c.id === action.category)?.color || 'text-blue-400';
                return (
                  <button
                    key={action.label}
                    onClick={() => {
                      setInput(action.label);
                      // Trigger submit after a brief delay to ensure state is updated
                      setTimeout(() => {
                        const userMessage: Message = {
                          role: 'user',
                          content: action.label,
                          timestamp: new Date()
                        };
                        setMessages(prev => [...prev, userMessage]);
                        
                        // Update chat metadata
                        setChats(prevChats => prevChats.map(chat => {
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
                        simulateResponse(action.label);
                      }, 0);
                    }}
                    className="group/quick flex items-center py-2.5 bg-gradient-to-r from-gray-800/60 to-gray-900/60 hover:from-gray-700/80 hover:to-gray-800/80 border border-gray-700/50 hover:border-gray-600 text-xs font-bold text-gray-300 hover:text-white whitespace-nowrap transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-95 backdrop-blur-sm px-2.5 gap-1 rounded-full pl-1.5 pr-3.5"
                  >
                    <div className="p-1 bg-gray-900/50 rounded-lg group-hover/quick:bg-gray-800 transition-colors">
                      <Icon className={`w-3.5 h-3.5 text-gray-500 group-hover/quick:${categoryColor} transition-colors`} />
                    </div>
                    {action.label}
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
                  accept="image/jpeg,image/png,image/jpg,text/csv"
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
                      handleSubmit(e as any);
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
                  chatsRemaining <= 1 
                    ? 'text-orange-400 bg-orange-500/10 border-orange-500/30' 
                    : 'text-gray-500 bg-gray-900/30 border-gray-800'
                }`}>
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{chatsRemaining} {chatsRemaining === 1 ? 'chat' : 'chats'} remaining</span>
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
