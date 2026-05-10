'use client';

import { useState, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  createThread,
  updateThread,
  deleteThread,
  loadMessages,
  type ChatThread,
} from '@/lib/chat-service';
import { getWelcomeMessage } from '@/lib/seasonal-context';
import type { SavedCardEntry } from '@/components/data-cards/DynamicCardRenderer';

// ── Chat entity type (exported so page-client.tsx and Sidebar can import it) ──

export interface Chat {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  starred: boolean;
  category: string;
  tags: string[];
}

// ── Hook options ──────────────────────────────────────────────────────────────

export interface UseChatListOptions {
  serverTime: string | undefined;
  selectedCategory: string;
  setSelectedCategory: Dispatch<SetStateAction<string>>;
  selectedSport: string;
  setSelectedSport: Dispatch<SetStateAction<string>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setMessages: Dispatch<SetStateAction<any[]>>;
  isLoggedIn: boolean;
  canCreateNewChat: () => boolean;
  updateRateLimitCount: () => void;
  setShowLimitNotification: Dispatch<SetStateAction<boolean>>;
  setShowWatchlistLightbox: Dispatch<SetStateAction<boolean>>;
  toast: { success: (msg: string) => void; error: (msg: string) => void; info: (msg: string) => void };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function inferSportFromPosition(position: string): string {
  const p = position.toUpperCase();
  if (['SP','RP','CL','C','1B','2B','3B','SS','LF','CF','RF','DH','OF','P'].includes(p)) return 'baseball_mlb';
  if (['QB','RB','WR','TE','K','DEF','PK','FB'].includes(p)) return 'americanfootball_nfl';
  if (['PG','SG','SF','PF','F','G','F-C','G-F'].includes(p)) return 'basketball_nba';
  return '';
}

const CARD_SPORT_MAP: Record<string, string> = {
  MLB: 'baseball_mlb', NBA: 'basketball_nba', NFL: 'americanfootball_nfl',
  NHL: 'icehockey_nhl', NCAAB: 'basketball_ncaab', NCAAF: 'americanfootball_ncaaf',
  EPL: 'soccer_epl', MLS: 'soccer_usa_mls',
};
const CARD_PLATFORM_MAP: Record<string, string> = {
  DFS: 'dfs', Kalshi: 'kalshi', Fantasy: 'fantasy',
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useChatList({
  serverTime,
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
}: UseChatListOptions) {
  const [chats, setChats] = useState<Chat[]>([
    {
      id: 'chat-1',
      title: 'New Chat',
      preview: 'Start a conversation to get real-time sports betting insights...',
      timestamp: new Date(serverTime ?? 0),
      starred: false,
      category: 'all',
      tags: [],
    },
  ]);
  const [activeChat, setActiveChat] = useState('chat-1');
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  // pendingThreadRef: holds the in-flight createThread promise so saveMessage can await
  // the real UUID before persisting messages.
  const pendingThreadRef = useRef<Promise<ChatThread | null> | null>(null);
  // pendingQueryRef: holds a query string that should auto-fire once the welcome message renders.
  const pendingQueryRef = useRef<string | null>(null);

  const handleStarChat = useCallback((chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const chat = chats.find((c) => c.id === chatId);
    const wasStarred = chat?.starred;
    const snapshot = chats;
    setChats(chats.map((c) =>
      c.id === chatId ? { ...c, starred: !c.starred } : c
    ));
    if (isLoggedIn) {
      updateThread(chatId, { starred: !wasStarred }).catch(() => {
        setChats(snapshot);
        toast.error('Failed to update — please try again');
      });
    }
    toast.success(wasStarred ? 'Removed from starred' : 'Analysis saved');
  }, [chats, isLoggedIn, toast]);

  const handleNewChat = useCallback(() => {
    if (!canCreateNewChat()) {
      setShowLimitNotification(true);
      return;
    }

    const welcomeMessage = getWelcomeMessage(selectedCategory);
    const categoryTitles: Record<string, string> = {
      all: 'New Analysis',
      betting: 'New Sports Betting Analysis',
      fantasy: 'New Fantasy Analysis',
      dfs: 'New DFS Lineup Analysis',
      kalshi: 'New Kalshi Market Analysis',
    };
    const chatTitle = categoryTitles[selectedCategory] ?? 'New Analysis';
    const chatCategory = selectedCategory === 'all' ? 'betting' : selectedCategory;

    const newChatId = `chat-${Date.now()}`;
    const newChat: Chat = {
      id: newChatId,
      title: chatTitle,
      preview: welcomeMessage.slice(0, 50) + '...',
      timestamp: new Date(),
      starred: false,
      category: chatCategory,
      tags: [
        selectedCategory === 'all' ? 'multi-platform' : selectedCategory,
        ...(selectedSport ? [selectedSport] : []),
      ],
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChat(newChatId);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: welcomeMessage,
        timestamp: new Date(),
        cards: [],
        modelUsed: 'Grok AI',
        isWelcome: true,
      },
    ]);

    if (isLoggedIn) {
      const threadTags = [
        selectedCategory === 'all' ? 'multi-platform' : selectedCategory,
        ...(selectedSport ? [selectedSport] : []),
      ];
      const threadPromise = createThread(chatCategory, chatTitle, threadTags);
      pendingThreadRef.current = threadPromise;
      threadPromise.then((created) => {
        pendingThreadRef.current = null;
        if (created) {
          setChats((prev) => prev.map((c) =>
            c.id === newChatId ? { ...c, id: created.id } : c
          ));
          setActiveChat(created.id);
        }
      });
    }

    updateRateLimitCount();
  }, [
    canCreateNewChat, selectedCategory, selectedSport, isLoggedIn,
    setMessages, setShowLimitNotification, updateRateLimitCount,
  ]);

  const openChatWithQuery = useCallback((query: string, category?: string, sport?: string) => {
    if (category) setSelectedCategory(category);
    if (sport !== undefined) setSelectedSport(sport);
    pendingQueryRef.current = query;
    handleNewChat();
  }, [handleNewChat, setSelectedCategory, setSelectedSport]);

  const handleSavedPlayerClick = useCallback((name: string, position: string, team?: string) => {
    void team;
    setShowWatchlistLightbox(false);
    const sport = inferSportFromPosition(position);
    const query = `Analyze ${name} — show me recent stats, props, and betting lines`;
    openChatWithQuery(query, 'betting', sport || undefined);
  }, [openChatWithQuery, setShowWatchlistLightbox]);

  const handleSavedCardClick = useCallback((entry: SavedCardEntry) => {
    setShowWatchlistLightbox(false);
    const sport = CARD_SPORT_MAP[entry.card.category] ?? '';
    const platform = CARD_PLATFORM_MAP[entry.card.category] ?? 'betting';
    const query = `Show me ${entry.card.subcategory || entry.card.type.replace(/_/g, ' ')} for ${entry.card.title}`;
    openChatWithQuery(query, platform, sport || undefined);
  }, [openChatWithQuery, setShowWatchlistLightbox]);

  const handleSelectChat = useCallback((chatId: string) => {
    setActiveChat(chatId);

    const selectedChat = chats.find((c) => c.id === chatId);
    if (selectedChat?.category && selectedChat.category !== 'all') {
      setSelectedCategory(selectedChat.category);
    }
    const SPORT_KEYS_LIST = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb', 'soccer_epl', 'soccer_mls'];
    const sportTag = selectedChat?.tags?.find((t) => SPORT_KEYS_LIST.includes(t));
    setSelectedSport(sportTag ?? '');

    if (isLoggedIn) {
      loadMessages(chatId).then((msgs) => {
        if (msgs.length > 0) {
          let storedCards: Record<string, unknown[]> = {};
          try { storedCards = JSON.parse(localStorage.getItem(`lev:cards:${chatId}`) ?? '{}'); } catch { /* ignore */ }
          setMessages(msgs.map((m) => ({
            id: m.id || crypto.randomUUID(),
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            cards: m.cards?.length ? m.cards : (storedCards[m.id ?? ''] ?? []),
            modelUsed: m.modelUsed,
            confidence: m.confidence,
            isWelcome: m.isWelcome,
          })));
        } else {
          const chat = chats.find((c) => c.id === chatId);
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: `**${chat?.title || 'Chat'}**\n\nNo saved messages found. Start a new message to continue.`,
            timestamp: new Date(),
            cards: [],
            isWelcome: true,
          }]);
        }
      });
    } else {
      const chat = chats.find((c) => c.id === chatId);
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `**${chat?.title || 'Analysis Restored'}**\n\nSign in to save and restore your conversation history.\n\n**Ready to continue optimizing your strategy.**`,
        timestamp: new Date(),
        cards: [],
        isWelcome: true,
      }]);
    }
  }, [chats, isLoggedIn, setMessages, setSelectedCategory, setSelectedSport]);

  const handleDeleteChat = useCallback((chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const snapshot = chats;
    const remaining = chats.filter((chat) => chat.id !== chatId);
    setChats(remaining);
    if (activeChat === chatId && remaining.length > 0) {
      setActiveChat(remaining[0].id);
    }
    if (isLoggedIn) {
      deleteThread(chatId).catch(() => {
        setChats(snapshot);
        toast.error('Failed to delete — please try again');
      });
    }
    toast.info('Chat deleted');
  }, [chats, activeChat, isLoggedIn, toast]);

  return {
    // State
    chats, setChats,
    activeChat, setActiveChat,
    isLoadingChats, setIsLoadingChats,
    // Refs (shared with generateRealResponse and the auto-query effect in page-client.tsx)
    pendingThreadRef,
    pendingQueryRef,
    // Handlers
    handleStarChat,
    handleNewChat,
    openChatWithQuery,
    handleSavedPlayerClick,
    handleSavedCardClick,
    handleSelectChat,
    handleDeleteChat,
  };
}
