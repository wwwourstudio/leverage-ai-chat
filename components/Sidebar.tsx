'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import Image from 'next/image';
import {
  Plus, Search, Star, Trash2, MessageSquare, Edit3, CheckCircle,
  LayoutGrid, TrendingUp, Trophy, Award, BarChart3,
  Zap, ChevronLeft, ChevronRight, X, Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { useAppStore, type AppCategory } from '@/lib/store/app-store';
import { useUserStore } from '@/lib/store/user-store';
import { useModalState } from '@/lib/hooks/useModalState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Chat {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  starred: boolean;
  category: string;
  tags: string[];
}

interface CategoryDef {
  id: string;
  name: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  desc: string;
}

interface SportDef {
  id: string;
  name: string;
  isInSeason?: boolean;
}

export interface SidebarProps {
  onNewChat: () => void;
  chatSearch: string;
  setChatSearch: (v: string) => void;
  activeChat: string;
  onSelectChat: (id: string) => void;
  filteredChats: Chat[];
  editingChatId: string | null;
  editingChatTitle: string;
  setEditingChatTitle: (t: string) => void;
  onEditChatTitle: (id: string, title: string, e: React.MouseEvent) => void;
  onSaveChatTitle: (id: string) => void;
  onKeyDownChatTitle: (e: React.KeyboardEvent, id: string) => void;
  onStarChat: (id: string, e: React.MouseEvent) => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
  categories: CategoryDef[];
  sports: SportDef[];
  setSuggestedPrompts: (p: any[]) => void;
  setLastUserQuery: (q: string) => void;
  isLoadingChats?: boolean;
  onNavigate?: (query: string, category?: string, sport?: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RAIL_ICONS: Record<string, React.FC<{ className?: string }>> = {
  all:     LayoutGrid,
  betting: TrendingUp,
  fantasy: Trophy,
  dfs:     Award,
  kalshi:  BarChart3,
};

const CAT_STYLES: Record<string, {
  active: string;
  glow: string;
  dot: string;
  sport: string;
}> = {
  all:     { active: 'text-blue-400',   glow: 'shadow-blue-500/30',   dot: 'bg-blue-400',   sport: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  betting: { active: 'text-orange-400', glow: 'shadow-orange-500/30', dot: 'bg-orange-400', sport: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  fantasy: { active: 'text-violet-400', glow: 'shadow-violet-500/30', dot: 'bg-violet-400', sport: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  dfs:     { active: 'text-purple-400', glow: 'shadow-purple-500/30', dot: 'bg-purple-400', sport: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  kalshi:  { active: 'text-cyan-400',   glow: 'shadow-cyan-500/30',   dot: 'bg-cyan-400',   sport: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
};

const KALSHI_TOPICS = [
  'All', 'Trending', 'Politics', 'Sports', 'Culture', 'Crypto',
  'Climate', 'Economics', 'Mentions', 'Companies', 'Financials', 'Tech & Science',
];

const SPORT_TAG_ACCENT: Record<string, string> = {
  betting: 'border-l-blue-500/60',
  'multi-platform': 'border-l-blue-500/60',
  fantasy: 'border-l-violet-500/60',
  dfs: 'border-l-yellow-500/60',
  kalshi: 'border-l-cyan-500/60',
  mlb: 'border-l-red-400/60',
  nfl: 'border-l-amber-500/60',
  nba: 'border-l-orange-400/60',
  nhl: 'border-l-sky-400/60',
};

function tagAccentClass(tags: string[]): string {
  const first = (tags[0] ?? '').toLowerCase();
  return `border-l-2 ${SPORT_TAG_ACCENT[first] ?? 'border-l-[var(--border-subtle)]'}`;
}

function groupChatsByDate(chats: Chat[]): Array<{ label: string; chats: Chat[] }> {
  const todayMs   = new Date().setHours(0, 0, 0, 0);
  const yesterMs  = todayMs - 86_400_000;
  const weekAgoMs = todayMs - 7 * 86_400_000;

  const groups: Array<{ label: string; chats: Chat[] }> = [
    { label: 'Today',     chats: [] },
    { label: 'Yesterday', chats: [] },
    { label: 'This Week', chats: [] },
    { label: 'Older',     chats: [] },
  ];

  for (const chat of chats) {
    const t = new Date(chat.timestamp).getTime();
    if      (t >= todayMs)    groups[0].chats.push(chat);
    else if (t >= yesterMs)   groups[1].chats.push(chat);
    else if (t >= weekAgoMs)  groups[2].chats.push(chat);
    else                       groups[3].chats.push(chat);
  }

  return groups.filter(g => g.chats.length > 0);
}

// ── Chat Skeleton ─────────────────────────────────────────────────────────────

function ChatSkeleton() {
  return (
    <div className="space-y-1 px-2 pt-1">
      {[0.85, 0.65, 0.75, 0.55, 0.7].map((w, i) => (
        <div
          key={i}
          className="h-[58px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 flex items-center gap-3 overflow-hidden"
        >
          <div className="w-1.5 h-8 rounded-full bg-[var(--bg-elevated)] animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 rounded-full bg-[var(--bg-elevated)] animate-pulse" style={{ width: `${w * 100}%` }} />
            <div className="h-2 rounded-full bg-[var(--bg-elevated)] animate-pulse opacity-60" style={{ width: `${w * 65}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Chat Card ─────────────────────────────────────────────────────────────────

const ChatCard = memo(function ChatCard({
  chat,
  isActive,
  editingChatId,
  editingChatTitle,
  setEditingChatTitle,
  onEditChatTitle,
  onSaveChatTitle,
  onKeyDownChatTitle,
  onSelectChat,
  onStarChat,
  onDeleteChat,
}: {
  chat: Chat;
  isActive: boolean;
  editingChatId: string | null;
  editingChatTitle: string;
  setEditingChatTitle: (t: string) => void;
  onEditChatTitle: (id: string, title: string, e: React.MouseEvent) => void;
  onSaveChatTitle: (id: string) => void;
  onKeyDownChatTitle: (e: React.KeyboardEvent, id: string) => void;
  onSelectChat: (id: string) => void;
  onStarChat: (id: string, e: React.MouseEvent) => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
}) {
  const isEditing = editingChatId === chat.id;

  return (
    <button
      type="button"
      onClick={() => onSelectChat(chat.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectChat(chat.id); }
      }}
      className={cn(
        'group relative w-full text-left rounded-xl transition-all duration-200 overflow-hidden',
        tagAccentClass(chat.tags),
        isActive
          ? 'bg-[var(--bg-elevated)] border border-[var(--border-default)] shadow-md'
          : 'bg-transparent border border-transparent hover:bg-[var(--bg-surface)] hover:border-[var(--border-subtle)]',
      )}
    >
      {/* Active indicator glow line */}
      {isActive && (
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
      )}

      <div className="px-3 py-2.5">
        {/* Title row */}
        <div className="flex items-start gap-2 mb-1">
          <MessageSquare className={cn(
            'w-3 h-3 mt-0.5 flex-shrink-0 transition-colors duration-150',
            isActive ? 'text-blue-400' : 'text-[var(--text-faint)] group-hover:text-[var(--text-muted)]',
          )} />

          <div className="flex-1 min-w-0 flex items-center gap-1">
            {isEditing ? (
              <div className="flex-1 flex items-center gap-1.5">
                <input
                  type="text"
                  value={editingChatTitle}
                  onChange={(e: any) => setEditingChatTitle(e.target.value)}
                  onKeyDown={(e: any) => onKeyDownChatTitle(e, chat.id)}
                  onBlur={() => onSaveChatTitle(chat.id)}
                  onClick={(e: any) => e.stopPropagation()}
                  autoFocus
                  className="flex-1 min-w-0 bg-[var(--bg-overlay)] border border-blue-500/50 rounded-md px-2 py-0.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                />
                <button
                  onClick={(e: any) => { e.stopPropagation(); onSaveChatTitle(chat.id); }}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <CheckCircle className="w-3 h-3 text-blue-400" />
                </button>
              </div>
            ) : (
              <>
                <h3 className={cn(
                  'text-xs font-semibold truncate flex-1 transition-colors',
                  isActive ? 'text-foreground' : 'text-[var(--text-muted)] group-hover:text-foreground',
                )}>
                  {chat.title}
                </h3>
                <button
                  onClick={(e: any) => onEditChatTitle(chat.id, chat.title, e)}
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-0.5 rounded hover:bg-[var(--bg-elevated)] transition-all"
                  title="Rename"
                  aria-label="Rename chat"
                >
                  <Edit3 className="w-2.5 h-2.5 text-[var(--text-faint)]" />
                </button>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e: any) => onStarChat(chat.id, e)}
              className="p-1 rounded-lg hover:bg-[var(--bg-elevated)] transition-all active:scale-90"
              title={chat.starred ? 'Unstar' : 'Star'}
              aria-label={chat.starred ? 'Unstar chat' : 'Star chat'}
            >
              <Star className={cn(
                'w-3 h-3 transition-colors',
                chat.starred ? 'text-amber-400 fill-amber-400' : 'text-[var(--text-faint)] hover:text-amber-400',
              )} />
            </button>
            <button
              onClick={(e: any) => onDeleteChat(chat.id, e)}
              className="p-1 rounded-lg hover:bg-red-500/10 transition-all active:scale-90"
              title="Delete"
              aria-label="Delete chat"
            >
              <Trash2 className="w-3 h-3 text-[var(--text-faint)] hover:text-red-400 transition-colors" />
            </button>
          </div>

          {/* Star indicator (always visible when starred + not hovered) */}
          {chat.starred && (
            <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0 group-hover:hidden" />
          )}
        </div>

        {/* Preview + meta row */}
        <div className="pl-5 flex items-end justify-between gap-2">
          <p className="text-[11px] text-[var(--text-faint)] truncate flex-1 leading-tight">
            {chat.preview}
          </p>
          <span suppressHydrationWarning className="text-[10px] text-[var(--text-faint)] whitespace-nowrap flex-shrink-0 tabular-nums">
            {formatRelativeTime(chat.timestamp)}
          </span>
        </div>

        {/* Tags row */}
        {chat.tags.length > 0 && (
          <div className="pl-5 mt-1.5 flex items-center gap-1 flex-wrap">
            {chat.tags.slice(0, 3).map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wider bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-faint)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
});

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--text-faint)]">{label}</span>
      <div className="flex-1 h-px bg-[var(--border-subtle)] opacity-50" />
      <span className="text-[9px] font-bold text-[var(--text-faint)] tabular-nums opacity-70">{count}</span>
    </div>
  );
}

// ── Collapsed Icon Rail ────────────────────────────────────────────────────────

function IconRail({
  categories,
  onNewChat,
}: {
  categories: CategoryDef[];
  onNewChat: () => void;
}) {
  const { selectedCategory, selectCategory, setSidebarOpen } = useAppStore();
  const { user } = useUserStore();
  const { setShowUserLightbox } = useModalState();

  return (
    <div className="flex flex-col items-center h-full py-3 gap-1 w-14">
      {/* Expand button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--bg-surface)] text-[var(--text-faint)] hover:text-foreground transition-all duration-150 group mb-1"
        title="Expand sidebar"
        aria-label="Expand sidebar"
      >
        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* New chat */}
      <button
        onClick={onNewChat}
        className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 transition-all duration-200 hover:scale-105 active:scale-95 mb-2"
        title="New Analysis"
        aria-label="New analysis"
      >
        <Plus className="w-3.5 h-3.5 text-white" />
      </button>

      {/* Divider */}
      <div className="w-5 h-px bg-[var(--border-subtle)] opacity-50 mb-1" />

      {/* Category icons */}
      {categories.map(cat => {
        const Icon = RAIL_ICONS[cat.id] ?? cat.icon;
        const isActive = selectedCategory === cat.id;
        const styles = CAT_STYLES[cat.id] ?? CAT_STYLES.all;

        return (
          <div key={cat.id} className="relative w-full flex justify-center">
            {isActive && (
              <div className="absolute left-0 inset-y-1 w-0.5 rounded-r-full bg-gradient-to-b from-blue-500 to-indigo-500" />
            )}
            <button
              onClick={() => selectCategory(cat.id as AppCategory)}
              title={cat.name}
              aria-label={cat.name}
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150',
                isActive
                  ? 'bg-[var(--bg-elevated)]'
                  : 'hover:bg-[var(--bg-surface)]',
              )}
            >
              <Icon className={cn(
                'w-4 h-4 transition-colors duration-150',
                isActive ? styles.active : 'text-[var(--text-faint)]',
              )} />
            </button>
          </div>
        );
      })}

      <div className="flex-1" />

      {/* User avatar */}
      {user && (
        <button
          onClick={() => setShowUserLightbox(true)}
          title={user.name}
          aria-label="Open profile"
          className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-blue-500/40 transition-all duration-200 flex-shrink-0 hover:scale-105 active:scale-95"
        >
          {user.avatar
            ? <Image src={user.avatar} className="w-8 h-8 object-cover" alt="" width={32} height={32} />
            : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <span className="text-[11px] font-black text-white">{user.name[0]?.toUpperCase()}</span>
              </div>
            )
          }
        </button>
      )}
    </div>
  );
}

// ── Category Tab Strip ────────────────────────────────────────────────────────

function CategoryTabs({
  categories,
  selectedCategory,
  onSelect,
}: {
  categories: CategoryDef[];
  selectedCategory: string;
  onSelect: (id: string) => void;
}) {
  const tabsRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    const el = tabsRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [selectedCategory]);

  return (
    <div className="relative">
      {/* Fade edges */}
      <div className="absolute left-0 inset-y-0 w-4 bg-gradient-to-r from-[var(--bg-overlay)] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 inset-y-0 w-4 bg-gradient-to-l from-[var(--bg-overlay)] to-transparent z-10 pointer-events-none" />

      <div
        ref={tabsRef}
        className="flex gap-0.5 overflow-x-auto scrollbar-hide px-3"
        role="tablist"
      >
        {categories.map(cat => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          const styles = CAT_STYLES[cat.id] ?? CAT_STYLES.all;

          return (
            <button
              key={cat.id}
              role="tab"
              aria-selected={isActive}
              data-active={isActive}
              onClick={() => onSelect(cat.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all duration-150 flex-shrink-0 border',
                isActive
                  ? `bg-[var(--bg-elevated)] border-[var(--border-default)] ${styles.active}`
                  : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-surface)]',
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', isActive ? styles.active : '')} />
              {cat.id === 'all' ? 'All' : cat.name.split(' ')[0]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sport Filter Chips ─────────────────────────────────────────────────────────

function SportChips({
  sports,
  selectedSport,
  selectedCategory,
  onSelect,
}: {
  sports: SportDef[];
  selectedSport: string;
  selectedCategory: string;
  onSelect: (id: string) => void;
}) {
  const styles = CAT_STYLES[selectedCategory] ?? CAT_STYLES.all;
  const filtered = sports.filter(s =>
    !(['fantasy', 'dfs'].includes(selectedCategory) && s.id.startsWith('ncaa'))
  );

  if (filtered.length === 0) return null;

  return (
    <div className="relative px-3">
      <div className="absolute right-3 inset-y-0 w-6 bg-gradient-to-l from-[var(--bg-overlay)] to-transparent z-10 pointer-events-none" />
      <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5 pr-6">
        {/* All sports pill */}
        <button
          onClick={() => onSelect('')}
          className={cn(
            'flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all duration-150 flex-shrink-0 border',
            selectedSport === ''
              ? `${styles.sport} border`
              : 'border-[var(--border-subtle)]/50 text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-surface)]',
          )}
        >
          All
        </button>

        {filtered.map(sport => {
          const isActive = selectedSport === sport.id;
          return (
            <button
              key={sport.id}
              onClick={() => onSelect(isActive ? '' : sport.id)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all duration-150 flex-shrink-0 border',
                isActive
                  ? `${styles.sport} border`
                  : sport.isInSeason
                    ? 'border-transparent text-[var(--text-muted)] hover:text-foreground hover:bg-[var(--bg-surface)]'
                    : 'border-transparent text-[var(--text-faint)] hover:bg-[var(--bg-surface)]',
              )}
            >
              {sport.isInSeason && (
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  isActive ? 'bg-current' : 'bg-emerald-400',
                )} />
              )}
              {sport.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Kalshi Topic Chips ────────────────────────────────────────────────────────

function KalshiTopics({
  selectedTopic,
  onSelect,
}: {
  selectedTopic: string;
  onSelect: (topic: string) => void;
}) {
  return (
    <div className="px-3">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {KALSHI_TOPICS.map(topic => {
          const isActive = topic === 'All' ? selectedTopic === '' : selectedTopic === topic;
          return (
            <button
              key={topic}
              onClick={() => onSelect(topic === 'All' ? '' : (selectedTopic === topic ? '' : topic))}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-150 border',
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                  : 'border-[var(--border-subtle)]/50 text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-surface)]',
              )}
            >
              {topic}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  if (query) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
        <div className="w-10 h-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center mb-3">
          <Search className="w-4 h-4 text-[var(--text-faint)]" />
        </div>
        <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">No results found</p>
        <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">
          Nothing matches <span className="font-semibold text-[var(--text-muted)]">&ldquo;{query}&rdquo;</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/20 flex items-center justify-center mb-4">
        <MessageSquare className="w-5 h-5 text-blue-400/70" />
      </div>
      <p className="text-xs font-semibold text-[var(--text-muted)] mb-1.5">No analyses yet</p>
      <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">
        Start a new analysis to get live odds, props, and AI insights
      </p>
    </div>
  );
}

// ── Main Sidebar ───────────────────────────────────────────────────────────────

export function Sidebar({
  onNewChat,
  chatSearch,
  setChatSearch,
  activeChat,
  onSelectChat,
  filteredChats,
  editingChatId,
  editingChatTitle,
  setEditingChatTitle,
  onEditChatTitle,
  onSaveChatTitle,
  onKeyDownChatTitle,
  onStarChat,
  onDeleteChat,
  categories,
  sports,
  setSuggestedPrompts,
  setLastUserQuery,
  isLoadingChats = false,
  onNavigate,
}: SidebarProps) {
  const {
    sidebarOpen, setSidebarOpen,
    selectedCategory, selectCategory,
    selectedSport, setSelectedSport,
    selectedKalshiTopic, setSelectedKalshiTopic,
  } = useAppStore();

  const { user } = useUserStore();
  const { setShowUserLightbox } = useModalState();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const SCROLL_KEY = 'sidebar_scroll_v2';

  // Restore scroll position
  useEffect(() => {
    if (!sidebarOpen || !scrollRef.current) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) scrollRef.current.scrollTop = Number(saved);
  }, [sidebarOpen]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      sessionStorage.setItem(SCROLL_KEY, String(scrollRef.current.scrollTop));
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/') {
        e.preventDefault();
        if (!sidebarOpen) setSidebarOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
        return;
      }
      if (e.key === 'Escape') {
        if (chatSearch) { setChatSearch(''); return; }
        setSidebarOpen(false);
        return;
      }
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const flat = filteredChats;
        if (flat.length === 0) return;
        const idx = flat.findIndex(c => c.id === activeChat);
        const next = e.key === 'j'
          ? Math.min(idx + 1, flat.length - 1)
          : Math.max(idx - 1, 0);
        onSelectChat(flat[next].id);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filteredChats, activeChat, chatSearch, onSelectChat, setChatSearch, setSidebarOpen, sidebarOpen]);

  const handleSelectChatWithClose = useCallback((id: string) => {
    onSelectChat(id);
    setSidebarOpen(false);
  }, [onSelectChat, setSidebarOpen]);

  function handleCategorySelect(catId: string) {
    selectCategory(catId as AppCategory);
    if (catId !== 'kalshi') setSelectedKalshiTopic('');
    if (catId === 'kalshi') setSelectedSport('');
    setSuggestedPrompts([]);
    setLastUserQuery('');
  }

  const starredChats = filteredChats.filter(c => c.starred);
  const unstarredChats = filteredChats.filter(c => !c.starred);
  const dateGroups = mounted
    ? groupChatsByDate(unstarredChats)
    : (unstarredChats.length > 0 ? [{ label: 'Recent', chats: unstarredChats }] : []);

  const totalChatCount = filteredChats.length;

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-[var(--bg-overlay)] border-r border-[var(--border-subtle)] overflow-hidden flex-shrink-0',
        sidebarOpen ? 'w-72' : 'w-72 md:w-14',
        'md:transition-all md:duration-300 md:ease-in-out',
      )}
    >
      {/* ── Collapsed icon rail (desktop only) ──────────────────────────────── */}
      {!sidebarOpen && (
        <div className="hidden md:flex flex-col h-full items-center">
          <IconRail categories={categories} onNewChat={onNewChat} />
        </div>
      )}

      {/* ── Full sidebar ─────────────────────────────────────────────────────── */}
      <div className={cn('flex flex-col h-full', !sidebarOpen && 'md:hidden')}>

        {/* Header */}
        <div className="flex-shrink-0 border-b border-[var(--border-subtle)]">
          {/* Branding row */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[13px] font-black tracking-tight text-foreground">
                Leverage <span className="text-blue-400">AI</span>
              </span>
            </div>

            {/* Collapse button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-faint)] hover:text-foreground hover:bg-[var(--bg-surface)] transition-all duration-150 group"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* New Analysis CTA */}
          <div className="px-3 pb-3">
            <button
              onClick={onNewChat}
              className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white px-4 py-2.5 font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 group"
            >
              {/* Shimmer sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />
              <Plus className="w-4 h-4 relative z-10 group-hover:rotate-90 transition-transform duration-300" />
              <span className="relative z-10">New Analysis</span>
            </button>
          </div>

          {/* Search */}
          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none" />
              <input
                ref={searchRef}
                value={chatSearch}
                onChange={(e: any) => setChatSearch(e.target.value)}
                placeholder="Search chats…"
                aria-label="Search chats"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] focus:border-blue-500/50 rounded-xl py-2 pl-9 pr-8 text-[13px] text-foreground placeholder-[var(--text-faint)] focus:outline-none transition-colors duration-150"
              />
              {chatSearch ? (
                <button
                  onClick={() => setChatSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-faint)] hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : (
                <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[var(--text-faint)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-1 py-0.5 pointer-events-none">/</kbd>
              )}
            </div>
          </div>

          {/* Category tabs */}
          <div className="pb-2.5">
            <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--text-faint)] px-3 mb-2">Platform</div>
            <CategoryTabs
              categories={categories}
              selectedCategory={selectedCategory}
              onSelect={handleCategorySelect}
            />
          </div>

          {/* Sport or Kalshi sub-filter */}
          {selectedCategory !== 'kalshi' && sports.length > 0 && (
            <div className="pb-3">
              <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--text-faint)] px-3 mb-2">
                Sport
              </div>
              <SportChips
                sports={sports}
                selectedSport={selectedSport}
                selectedCategory={selectedCategory}
                onSelect={setSelectedSport}
              />
            </div>
          )}

          {selectedCategory === 'kalshi' && (
            <div className="pb-3">
              <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--text-faint)] px-3 mb-2">Topic</div>
              <KalshiTopics
                selectedTopic={selectedKalshiTopic}
                onSelect={setSelectedKalshiTopic}
              />
            </div>
          )}
        </div>

        {/* ── Chat list ─────────────────────────────────────────────────────── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto py-2 space-y-3 custom-scrollbar pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
        >
          {isLoadingChats && <ChatSkeleton />}

          {/* Starred chats */}
          {!isLoadingChats && starredChats.length > 0 && (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--text-faint)]">Starred</span>
                <div className="flex-1 h-px bg-[var(--border-subtle)] opacity-50" />
                <span className="text-[9px] font-bold text-[var(--text-faint)] tabular-nums opacity-70">{starredChats.length}</span>
              </div>
              <div className="px-2 space-y-0.5">
                {starredChats.map((chat, i) => (
                  <div
                    key={chat.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
                  >
                    <ChatCard
                      chat={chat}
                      isActive={activeChat === chat.id}
                      editingChatId={editingChatId}
                      editingChatTitle={editingChatTitle}
                      setEditingChatTitle={setEditingChatTitle}
                      onEditChatTitle={onEditChatTitle}
                      onSaveChatTitle={onSaveChatTitle}
                      onKeyDownChatTitle={onKeyDownChatTitle}
                      onSelectChat={handleSelectChatWithClose}
                      onStarChat={onStarChat}
                      onDeleteChat={onDeleteChat}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Date-grouped chats */}
          {!isLoadingChats && dateGroups.map(group => (
            <div key={group.label} className="space-y-0.5">
              <SectionHeader label={group.label} count={group.chats.length} />
              <div className="px-2 space-y-0.5">
                {group.chats.map((chat, i) => (
                  <div
                    key={chat.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
                  >
                    <ChatCard
                      chat={chat}
                      isActive={activeChat === chat.id}
                      editingChatId={editingChatId}
                      editingChatTitle={editingChatTitle}
                      setEditingChatTitle={setEditingChatTitle}
                      onEditChatTitle={onEditChatTitle}
                      onSaveChatTitle={onSaveChatTitle}
                      onKeyDownChatTitle={onKeyDownChatTitle}
                      onSelectChat={handleSelectChatWithClose}
                      onStarChat={onStarChat}
                      onDeleteChat={onDeleteChat}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {!isLoadingChats && filteredChats.length === 0 && (
            <EmptyState query={chatSearch} />
          )}
        </div>

        {/* ── User profile footer ──────────────────────────────────────────── */}
        {user && (
          <button
            onClick={() => setShowUserLightbox(true)}
            className="flex-shrink-0 border-t border-[var(--border-subtle)] px-3 py-2.5 flex items-center gap-2.5 hover:bg-[var(--bg-surface)] transition-colors duration-150 group"
            aria-label="Open profile"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-transparent group-hover:ring-blue-500/30 transition-all duration-150">
              {user.avatar
                ? <Image src={user.avatar} className="w-8 h-8 object-cover" alt="" width={32} height={32} />
                : (
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <span className="text-[11px] font-black text-white">{user.name[0]?.toUpperCase()}</span>
                  </div>
                )
              }
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[12px] font-bold text-foreground truncate leading-tight">{user.name}</div>
              <div className="text-[10px] text-[var(--text-faint)] truncate leading-tight">{user.email}</div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)] flex-shrink-0 group-hover:text-[var(--text-muted)] group-hover:translate-x-0.5 transition-all duration-150" />
          </button>
        )}
      </div>
    </div>
  );
}
