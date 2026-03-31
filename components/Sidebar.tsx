'use client';

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  PenSquare, Search, Star, Trash2, Edit3, Check,
  LayoutGrid, TrendingUp, Trophy, Award, BarChart3,
  MoreHorizontal, UserCircle, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  open: boolean;
  onNewChat: () => void;
  chatSearch: string;
  setChatSearch: (v: string) => void;
  activeChat: string;
  onSelectChat: (id: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  selectedSport: string;
  setSelectedSport: (s: string) => void;
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
  user: { name: string; email: string; avatar?: string } | null;
  onUserClick?: () => void;
  isLoadingChats?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60_000)          return 'now';
  if (diff < 3_600_000)       return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000)      return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000)  return `${Math.floor(diff / 86_400_000)}d`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupChatsByDate(chats: Chat[]): Array<{ label: string; chats: Chat[] }> {
  const todayMs    = new Date().setHours(0, 0, 0, 0);
  const yesterMs   = todayMs - 86_400_000;
  const weekAgoMs  = todayMs - 7  * 86_400_000;
  const monthAgoMs = todayMs - 30 * 86_400_000;

  const groups: Array<{ label: string; chats: Chat[] }> = [
    { label: 'Today',            chats: [] },
    { label: 'Yesterday',        chats: [] },
    { label: 'Previous 7 days',  chats: [] },
    { label: 'Previous 30 days', chats: [] },
    { label: 'Older',            chats: [] },
  ];

  for (const chat of chats) {
    const t = new Date(chat.timestamp).getTime();
    if      (t >= todayMs)    groups[0].chats.push(chat);
    else if (t >= yesterMs)   groups[1].chats.push(chat);
    else if (t >= weekAgoMs)  groups[2].chats.push(chat);
    else if (t >= monthAgoMs) groups[3].chats.push(chat);
    else                      groups[4].chats.push(chat);
  }

  return groups.filter(g => g.chats.length > 0);
}

const RAIL_ICONS: Record<string, React.FC<{ className?: string }>> = {
  all:     LayoutGrid,
  betting: TrendingUp,
  fantasy: Trophy,
  dfs:     Award,
  kalshi:  BarChart3,
};

const KALSHI_TOPICS = ['Trending', 'Politics', 'Sports', 'Culture', 'Crypto', 'Economics', 'Tech'];

// ── Chat row "..." dropdown ────────────────────────────────────────────────────

function ChatMenu({
  chat,
  onStar,
  onRename,
  onDelete,
}: {
  chat: Chat;
  onStar: (e: React.MouseEvent) => void;
  onRename: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="p-1 rounded-md text-[oklch(0.45_0.01_280)] hover:text-[oklch(0.75_0.01_280)] hover:bg-[oklch(0.20_0.01_280)] transition-colors"
        aria-label="Chat options"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-xl bg-[oklch(0.14_0.01_280)] border border-[oklch(0.21_0.015_280)] shadow-2xl shadow-black/50 py-1 overflow-hidden">
          <button
            onClick={(e) => { onStar(e); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[oklch(0.72_0.01_280)] hover:bg-[oklch(0.19_0.01_280)] hover:text-white transition-colors"
          >
            <Star className={cn('w-3.5 h-3.5 flex-shrink-0', chat.starred ? 'fill-yellow-400 text-yellow-400' : '')} />
            {chat.starred ? 'Unstar' : 'Star'}
          </button>
          <button
            onClick={(e) => { onRename(e); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[oklch(0.72_0.01_280)] hover:bg-[oklch(0.19_0.01_280)] hover:text-white transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 flex-shrink-0" />
            Rename
          </button>
          <div className="my-1 h-px bg-[oklch(0.19_0.01_280)]" />
          <button
            onClick={(e) => { onDelete(e); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
            Delete
          </button>
        </div>
      )}
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

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[oklch(0.14_0.015_280)] border border-blue-500/40">
        <input
          type="text"
          value={editingChatTitle}
          onChange={(e: any) => setEditingChatTitle(e.target.value)}
          onKeyDown={(e: any) => onKeyDownChatTitle(e, chat.id)}
          onBlur={() => onSaveChatTitle(chat.id)}
          className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-[oklch(0.40_0.01_280)] focus:outline-none"
          autoFocus
          onClick={(e: any) => e.stopPropagation()}
        />
        <button
          onClick={(e: any) => { e.stopPropagation(); onSaveChatTitle(chat.id); }}
          className="p-0.5 hover:bg-[oklch(0.20_0.01_280)] rounded transition-colors flex-shrink-0"
        >
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="group relative flex items-center">
      <button
        type="button"
        onClick={() => onSelectChat(chat.id)}
        className={cn(
          'flex-1 min-w-0 flex items-center gap-2 px-2 py-[7px] rounded-lg text-left transition-colors',
          isActive
            ? 'bg-[oklch(0.16_0.015_280)] text-white'
            : 'text-[oklch(0.68_0.01_280)] hover:bg-[oklch(0.13_0.01_280)] hover:text-[oklch(0.82_0.01_280)]',
        )}
      >
        {chat.starred && (
          <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />
        )}
        <span className="flex-1 min-w-0 text-sm truncate leading-snug pr-1">
          {chat.title}
        </span>
        <span
          suppressHydrationWarning
          className="text-[10px] text-[oklch(0.38_0.01_280)] whitespace-nowrap flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {formatRelativeTime(chat.timestamp)}
        </span>
      </button>

      {/* "..." context menu — visible on hover/active */}
      <div className={cn(
        'absolute right-0.5 top-1/2 -translate-y-1/2 transition-opacity',
        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}>
        <ChatMenu
          chat={chat}
          onStar={(e) => onStarChat(chat.id, e)}
          onRename={(e) => onEditChatTitle(chat.id, chat.title, e)}
          onDelete={(e) => onDeleteChat(chat.id, e)}
        />
      </div>
    </div>
  );
});

// ── Collapsed icon rail ────────────────────────────────────────────────────────

function IconRail({
  categories,
  selectedCategory,
  setSelectedCategory,
  onNewChat,
  user,
  onUserClick,
}: {
  categories: CategoryDef[];
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  onNewChat: () => void;
  user: { name: string; email?: string; avatar?: string } | null;
  onUserClick?: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-3 gap-0.5 h-full w-full">
      {/* New chat */}
      <button
        onClick={onNewChat}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-[oklch(0.60_0.01_280)] hover:text-white hover:bg-[oklch(0.16_0.01_280)] transition-colors mb-2 flex-shrink-0"
        title="New Analysis"
      >
        <PenSquare className="w-4.5 h-4.5" />
      </button>

      {/* Search placeholder */}
      <button
        className="w-9 h-9 rounded-xl flex items-center justify-center text-[oklch(0.42_0.01_280)] hover:text-[oklch(0.65_0.01_280)] hover:bg-[oklch(0.13_0.01_280)] transition-colors flex-shrink-0"
        title="Search"
      >
        <Search className="w-4 h-4" />
      </button>

      <div className="my-1.5 h-px w-6 bg-[oklch(0.20_0.01_280)] flex-shrink-0" />

      {/* Category icons */}
      {categories.map(cat => {
        const Icon = RAIL_ICONS[cat.id] ?? cat.icon;
        const isActive = selectedCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            title={cat.name}
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
              isActive ? 'bg-[oklch(0.16_0.015_280)]' : 'hover:bg-[oklch(0.13_0.01_280)]',
            )}
          >
            <Icon className={cn(
              'w-4 h-4 transition-colors',
              isActive ? cat.color : 'text-[oklch(0.38_0.01_280)]',
            )} />
          </button>
        );
      })}

      <div className="flex-1" />

      {/* User avatar */}
      {user ? (
        <button
          onClick={onUserClick}
          title={user.name}
          className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 hover:ring-2 hover:ring-[oklch(0.40_0.01_280)] transition-all mb-1"
        >
          {user.avatar
            ? <img src={user.avatar} className="w-full h-full object-cover" alt="" />
            : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <span className="text-[11px] font-bold text-white">{user.name[0]?.toUpperCase()}</span>
              </div>
            )
          }
        </button>
      ) : (
        <div className="w-8 h-8 rounded-full bg-[oklch(0.14_0.01_280)] flex items-center justify-center mb-1">
          <UserCircle className="w-4 h-4 text-[oklch(0.38_0.01_280)]" />
        </div>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-2 pt-4 pb-1">
      <span className="text-[11px] font-semibold text-[oklch(0.42_0.01_280)]">{label}</span>
    </div>
  );
}

// ── Main Sidebar ───────────────────────────────────────────────────────────────

export function Sidebar({
  open,
  onNewChat,
  chatSearch,
  setChatSearch,
  activeChat,
  onSelectChat,
  selectedCategory,
  setSelectedCategory,
  selectedSport,
  setSelectedSport,
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
  user,
  onUserClick,
  isLoadingChats = false,
}: SidebarProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const starredChats   = filteredChats.filter(c => c.starred);
  const unstarredChats = filteredChats.filter(c => !c.starred);
  const dateGroups = mounted
    ? groupChatsByDate(unstarredChats)
    : (unstarredChats.length > 0 ? [{ label: 'Recent', chats: unstarredChats }] : []);

  const handleSelectCategory = useCallback((id: string) => {
    setSelectedCategory(id);
    setSelectedSport('');
    setSuggestedPrompts([]);
    setLastUserQuery('');
  }, [setSelectedCategory, setSelectedSport, setSuggestedPrompts, setLastUserQuery]);

  const chatCardProps = {
    editingChatId,
    editingChatTitle,
    setEditingChatTitle,
    onEditChatTitle,
    onSaveChatTitle,
    onKeyDownChatTitle,
    onSelectChat,
    onStarChat,
    onDeleteChat,
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-[oklch(0.09_0.008_280)] border-r border-[oklch(0.15_0.012_280)] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0',
        open ? 'w-64' : 'w-[52px]',
      )}
    >
      {/* ── Collapsed rail ──────────────────────────────────────────────────── */}
      {!open && (
        <IconRail
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          onNewChat={onNewChat}
          user={user}
          onUserClick={onUserClick}
        />
      )}

      {/* ── Full sidebar ────────────────────────────────────────────────────── */}
      {open && (
        <div className="flex flex-col h-full min-h-0">

          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
            <span className="text-[13px] font-semibold text-[oklch(0.72_0.01_280)] tracking-tight select-none">
              Leverage <span className="text-white">AI</span>
            </span>
            <button
              onClick={onNewChat}
              className="p-1.5 rounded-lg text-[oklch(0.50_0.01_280)] hover:text-white hover:bg-[oklch(0.16_0.01_280)] transition-colors"
              title="New Analysis"
            >
              <PenSquare className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-2 pb-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[oklch(0.38_0.01_280)] pointer-events-none" />
              <input
                value={chatSearch}
                onChange={(e: any) => setChatSearch(e.target.value)}
                placeholder="Search chats…"
                className="w-full bg-[oklch(0.13_0.01_280)] border border-[oklch(0.19_0.015_280)] rounded-lg py-1.5 pl-8 pr-3 text-[13px] text-[oklch(0.75_0.01_280)] placeholder-[oklch(0.35_0.01_280)] focus:outline-none focus:border-[oklch(0.35_0.02_260)] transition-colors"
              />
            </div>
          </div>

          {/* Platform category tabs */}
          <div className="px-2 pb-2 flex-shrink-0">
            <div className="flex gap-0.5 overflow-x-auto scrollbar-hide">
              {categories.map(cat => {
                const Icon = RAIL_ICONS[cat.id] ?? cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.id)}
                    title={cat.desc}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors whitespace-nowrap flex-shrink-0',
                      isActive
                        ? 'bg-[oklch(0.16_0.015_280)] text-white'
                        : 'text-[oklch(0.46_0.01_280)] hover:text-[oklch(0.72_0.01_280)] hover:bg-[oklch(0.13_0.01_280)]',
                    )}
                  >
                    <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', isActive ? cat.color : '')} />
                    <span>{cat.id === 'all' ? 'All' : cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Sport sub-filter */}
            {selectedCategory !== 'kalshi' && sports.length > 0 && (
              <div className="flex gap-1 mt-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                {sports
                  .filter(s => !(['fantasy', 'dfs'].includes(selectedCategory) && s.id.startsWith('ncaa')))
                  .map(sport => {
                    const isActive = selectedSport === sport.id;
                    return (
                      <button
                        key={sport.id}
                        onClick={() => setSelectedSport(isActive ? '' : sport.id)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap flex-shrink-0',
                          isActive
                            ? 'bg-blue-600/20 text-blue-300'
                            : sport.isInSeason
                              ? 'text-[oklch(0.52_0.01_280)] hover:text-white hover:bg-[oklch(0.14_0.01_280)]'
                              : 'text-[oklch(0.32_0.01_280)] hover:text-[oklch(0.50_0.01_280)] hover:bg-[oklch(0.12_0.01_280)]',
                        )}
                      >
                        {sport.isInSeason && !isActive && (
                          <span className="w-1 h-1 rounded-full bg-green-400/70 flex-shrink-0" />
                        )}
                        {sport.name}
                      </button>
                    );
                  })}
              </div>
            )}

            {selectedCategory === 'kalshi' && (
              <div className="flex gap-1 mt-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                {KALSHI_TOPICS.map(topic => (
                  <button
                    key={topic}
                    onClick={() => setSelectedSport(selectedSport === topic ? '' : topic)}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap flex-shrink-0',
                      selectedSport === topic
                        ? 'bg-cyan-600/20 text-cyan-300'
                        : 'text-[oklch(0.38_0.01_280)] hover:text-[oklch(0.58_0.01_280)] hover:bg-[oklch(0.13_0.01_280)]',
                    )}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-3 h-px bg-[oklch(0.16_0.012_280)] flex-shrink-0" />

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 pb-2">

            {/* Loading skeletons */}
            {isLoadingChats && (
              <div className="space-y-0.5 px-2 pt-3" aria-busy="true" aria-label="Loading chats">
                {[0.9, 0.7, 0.85, 0.6, 0.8].map((w, i) => (
                  <div key={i} className="px-2 py-[7px] rounded-lg flex items-center gap-2">
                    <div className="h-[13px] rounded-full bg-[oklch(0.15_0.01_280)] animate-pulse" style={{ width: `${w * 100}%` }} />
                  </div>
                ))}
              </div>
            )}

            {/* Starred */}
            {!isLoadingChats && starredChats.length > 0 && (
              <div>
                <SectionHeader label="Starred" />
                <div className="px-1.5 space-y-0.5">
                  {starredChats.map(chat => (
                    <ChatCard key={chat.id} chat={chat} isActive={activeChat === chat.id} {...chatCardProps} />
                  ))}
                </div>
              </div>
            )}

            {/* Date groups */}
            {!isLoadingChats && dateGroups.map(group => (
              <div key={group.label}>
                <SectionHeader label={group.label} />
                <div className="px-1.5 space-y-0.5">
                  {group.chats.map(chat => (
                    <ChatCard key={chat.id} chat={chat} isActive={activeChat === chat.id} {...chatCardProps} />
                  ))}
                </div>
              </div>
            ))}

            {/* Empty state */}
            {!isLoadingChats && filteredChats.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <p className="text-[13px] text-[oklch(0.42_0.01_280)]">
                  {chatSearch ? 'No chats found' : 'No chats yet'}
                </p>
                <p className="text-[11px] text-[oklch(0.30_0.01_280)] mt-0.5">
                  {chatSearch ? 'Try a different search' : 'Start a new analysis above'}
                </p>
              </div>
            )}
          </div>

          {/* User profile */}
          <div className="flex-shrink-0 border-t border-[oklch(0.15_0.012_280)]">
            <button
              onClick={onUserClick}
              className="w-full flex items-center gap-2.5 px-3 py-3 hover:bg-[oklch(0.13_0.01_280)] transition-colors group"
            >
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                {user?.avatar
                  ? <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                  : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-white">
                        {(user?.name ?? '?')[0]?.toUpperCase()}
                      </span>
                    </div>
                  )
                }
              </div>

              {/* Name + email */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-medium text-[oklch(0.80_0.01_280)] truncate leading-tight">
                  {user?.name ?? 'Guest'}
                </p>
                {user?.email && (
                  <p className="text-[10px] text-[oklch(0.40_0.01_280)] truncate leading-tight">
                    {user.email}
                  </p>
                )}
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-[oklch(0.38_0.01_280)] group-hover:text-[oklch(0.55_0.01_280)] transition-colors flex-shrink-0" />
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
