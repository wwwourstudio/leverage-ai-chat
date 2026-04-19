'use client';

import { useState, useEffect, memo } from 'react';
import { Plus, Search, Star, Trash2, MessageSquare, Edit3, CheckCircle, LayoutGrid, TrendingUp, Trophy, Award, BarChart3, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';

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

/** Returns a Tailwind left-border accent class based on the chat's first tag */
function tagAccentClass(tags: string[]): string {
  const first = (tags[0] ?? '').toLowerCase();
  if (first === 'betting' || first === 'multi-platform') return 'border-l-2 border-l-blue-500/60';
  if (first === 'fantasy')  return 'border-l-2 border-l-emerald-500/60';
  if (first === 'dfs')      return 'border-l-2 border-l-yellow-500/60';
  if (first === 'kalshi')   return 'border-l-2 border-l-cyan-500/60';
  if (first === 'mlb')      return 'border-l-2 border-l-red-500/60';
  if (first === 'nfl')      return 'border-l-2 border-l-amber-500/60';
  if (first === 'nba')      return 'border-l-2 border-l-orange-500/60';
  if (first === 'nhl')      return 'border-l-2 border-l-sky-500/60';
  return 'border-l-2 border-l-[var(--border-subtle)]';
}

/** Groups non-starred chats by recency */
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
    if (t >= todayMs)       groups[0].chats.push(chat);
    else if (t >= yesterMs) groups[1].chats.push(chat);
    else if (t >= weekAgoMs) groups[2].chats.push(chat);
    else                    groups[3].chats.push(chat);
  }

  return groups.filter(g => g.chats.length > 0);
}

/** Icon to use in icon-rail for each category id */
const RAIL_ICONS: Record<string, React.FC<{ className?: string }>> = {
  all:     LayoutGrid,
  betting: TrendingUp,
  fantasy: Trophy,
  dfs:     Award,
  kalshi:  BarChart3,
};

// ── Chat Card ─────────────────────────────────────────────────────────────────
// Memoized so that only the active/editing card re-renders during search input
// changes — prevents all 50+ cards from reconciling on every keystroke.

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
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectChat(chat.id); } }}
      className={cn(
        'group relative w-full text-left rounded-xl p-2.5 cursor-pointer transition-all duration-200 overflow-hidden',
        tagAccentClass(chat.tags),
        isActive
          ? 'bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 border border-blue-500/30 shadow-lg shadow-blue-500/10'
          : 'bg-[var(--bg-overlay)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] hover:border-[var(--border-subtle)]',
      )}
    >
      {isActive && (
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-1.5 mb-1 group/title">
            <MessageSquare className={cn(
              'w-3 h-3 flex-shrink-0 transition-colors',
              isActive ? 'text-blue-400' : 'text-[var(--text-faint)]',
            )} />
            {isEditing ? (
              <div className="flex-1 flex items-center gap-1">
                <input
                  type="text"
                  value={editingChatTitle}
                  onChange={(e: any) => setEditingChatTitle(e.target.value)}
                  onKeyDown={(e: any) => onKeyDownChatTitle(e, chat.id)}
                  onBlur={() => onSaveChatTitle(chat.id)}
                  className="flex-1 bg-[var(--bg-elevated)] border border-blue-500/50 rounded-md px-2 py-0.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  autoFocus
                  onClick={(e: any) => e.stopPropagation()}
                />
                <button
                  onClick={(e: any) => { e.stopPropagation(); onSaveChatTitle(chat.id); }}
                  className="p-0.5 hover:bg-[var(--bg-elevated)] rounded transition-all"
                >
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-1 min-w-0">
                <h3 className="text-xs font-bold text-foreground truncate flex-1">{chat.title}</h3>
                <button
                  onClick={(e: any) => onEditChatTitle(chat.id, chat.title, e)}
                  className="opacity-0 group-hover/title:opacity-100 p-0.5 hover:bg-[var(--bg-elevated)] rounded transition-all flex-shrink-0"
                  title="Edit title"
                >
                  <Edit3 className="w-2.5 h-2.5 text-[var(--text-faint)] hover:text-blue-400" />
                </button>
              </div>
            )}
          </div>

          {/* Preview */}
          <p className="text-[11px] text-[var(--text-faint)] truncate mb-1.5 leading-tight pl-[18px]">
            {chat.preview}
          </p>

          {/* Tags + timestamp */}
          <div className="flex items-center justify-between gap-2 pl-[18px]">
            <div className="flex items-center gap-1 flex-wrap">
              {chat.tags.slice(0, 2).map((tag, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-wide"
                >
                  {tag}
                </span>
              ))}
            </div>
            <span suppressHydrationWarning className="text-[9px] text-[var(--text-faint)] whitespace-nowrap">
              {formatRelativeTime(chat.timestamp)}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button
            onClick={(e: any) => onStarChat(chat.id, e)}
            className={cn(
              'p-1 rounded-md hover:bg-[var(--bg-elevated)] transition-all',
              chat.starred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
            title={chat.starred ? 'Unstar' : 'Star'}
          >
            <Star className={cn(
              'w-3 h-3',
              chat.starred ? 'text-yellow-400 fill-yellow-400' : 'text-[var(--text-faint)]',
            )} />
          </button>
          <button
            onClick={(e: any) => onDeleteChat(chat.id, e)}
            className="p-1 rounded-md hover:bg-[var(--bg-elevated)] opacity-0 group-hover:opacity-100 transition-all"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 text-[var(--text-faint)] hover:text-red-400 transition-colors" />
          </button>
        </div>
      </div>
    </button>
  );
});


// ── Icon Rail ─────────────────────────────────────────────────────────────────

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
    <div className="w-14 flex flex-col items-center py-3 gap-1 h-full">
      {/* New Analysis button */}
      <button
        onClick={onNewChat}
        className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 flex items-center justify-center transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 mb-2 flex-shrink-0"
        title="New Analysis"
      >
        <Plus className="w-4 h-4 text-white" />
      </button>

      {/* Category icons */}
      <div className="flex flex-col items-center gap-1 w-full px-2">
        {categories.map(cat => {
          const Icon = RAIL_ICONS[cat.id] ?? cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              title={cat.name}
              className={cn(
                'w-full h-9 rounded-xl flex items-center justify-center transition-all duration-200',
                isActive
                  ? 'bg-[var(--bg-elevated)]'
                  : 'hover:bg-[var(--bg-surface)]',
              )}
            >
              <Icon className={cn(
                'w-4 h-4 transition-colors',
                isActive ? cat.color : 'text-[var(--text-faint)]',
              )} />
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar — only shown when logged in */}
      {user && (
        <div
          className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mb-1 cursor-pointer hover:ring-2 hover:ring-blue-400/50 active:scale-95 transition-all"
          title={user.name}
          onClick={onUserClick}
        >
          {user.avatar
            ? <img src={user.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
            : <span className="text-[11px] font-black text-white">{user.name[0]?.toUpperCase()}</span>
          }
        </div>
      )}
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
  // Avoid server/client hydration mismatch (#418): date grouping uses Date.now() which
  // differs between UTC server and local-timezone client. Defer to after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const starredChats = filteredChats.filter(c => c.starred);
  const unstarredChats = filteredChats.filter(c => !c.starred);
  // Before hydration completes, put all chats under "Recent" (stable SSR output).
  // After mount, switch to proper date groups.
  const dateGroups = mounted
    ? groupChatsByDate(unstarredChats)
    : (unstarredChats.length > 0 ? [{ label: 'Recent', chats: unstarredChats }] : []);

  const KALSHI_TOPICS = ['Trending', 'Politics', 'Sports', 'Culture', 'Crypto', 'Climate', 'Economics', 'Mentions', 'Companies', 'Financials', 'Tech & Science'];

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-[var(--bg-overlay)] border-r border-[var(--border-subtle)] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0',
        open ? 'w-72' : 'w-14',
      )}
    >
      {/* Icon rail (always rendered when closed) */}
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

      {/* Full sidebar (rendered when open) */}
      {open && (
        <>
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="px-3 pt-3 pb-3 border-b border-[var(--border-subtle)] bg-[var(--bg-overlay)] space-y-3 flex-shrink-0">
            {/* New Analysis button */}
            <button
              onClick={onNewChat}
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white rounded-xl px-4 py-2.5 transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 flex items-center justify-center gap-2 font-bold group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <Plus className="w-4 h-4 relative z-10 group-hover:rotate-90 transition-transform duration-300" />
              <span className="relative z-10 text-sm">New Analysis</span>
            </button>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none" />
              <input
                value={chatSearch}
                onChange={(e: any) => setChatSearch(e.target.value)}
                placeholder="Search chats…"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg py-2 pl-8 pr-3 text-sm text-[var(--text-muted)] placeholder-[var(--text-faint)] focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>

            {/* Platform category pills */}
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-1.5 px-0.5">Platform</div>
              <div className="relative">
                <div className="absolute right-0 inset-y-0 w-10 bg-gradient-to-l from-[var(--bg-overlay)] to-transparent z-10 pointer-events-none" />
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide pr-10">
                  {categories.map(cat => {
                    const Icon = cat.icon;
                    const isActive = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setSuggestedPrompts([]);
                          setLastUserQuery('');
                        }}
                        title={cat.desc}
                        className={cn(
                          'group/pill flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all duration-200 whitespace-nowrap flex-shrink-0',
                          isActive
                            ? 'bg-[var(--bg-elevated)] text-foreground'
                            : 'text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-surface)]',
                        )}
                      >
                        <Icon className={cn(
                          'w-3 h-3 transition-colors',
                          isActive ? cat.color : 'text-[var(--text-faint)] group-hover/pill:text-[var(--text-muted)]',
                        )} />
                        <span>{cat.id === 'all' ? 'ALL' : cat.name.toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sport / Kalshi sub-filter */}
              {selectedCategory !== 'kalshi' && (
                <div className="relative mt-1.5">
                  <div className="absolute right-0 inset-y-0 w-10 bg-gradient-to-l from-[var(--bg-overlay)] to-transparent z-10 pointer-events-none" />
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide pr-10">
                    {sports
                      .filter(s => !(['fantasy', 'dfs'].includes(selectedCategory) && s.id.startsWith('ncaa')))
                      .map(sport => {
                        const isActive = selectedSport === sport.id;
                        return (
                          <button
                            key={sport.id}
                            onClick={() => setSelectedSport(isActive ? '' : sport.id)}
                            className={cn(
                              'flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold transition-all duration-200 whitespace-nowrap flex-shrink-0',
                              isActive
                                ? 'bg-blue-600/20 text-blue-300'
                                : sport.isInSeason
                                  ? 'text-[var(--text-muted)] hover:text-foreground hover:bg-[var(--bg-surface)]'
                                  : 'text-[var(--text-faint)] hover:text-[var(--text-faint)] hover:bg-[var(--bg-surface)]',
                            )}
                          >
                            {sport.isInSeason && !isActive && (
                              <span className="w-1 h-1 rounded-full bg-green-400/60 shrink-0" />
                            )}
                            {sport.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {selectedCategory === 'kalshi' && (
                <div className="relative mt-1.5">
                  <div className="absolute right-0 inset-y-0 w-10 bg-gradient-to-l from-[var(--bg-overlay)] to-transparent z-10 pointer-events-none" />
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide pr-10">
                    {KALSHI_TOPICS.map(topic => (
                      <button
                        key={topic}
                        onClick={() => setSelectedSport(selectedSport === topic ? '' : topic)}
                        className={cn(
                          'px-2 py-1 rounded-full text-[9px] font-bold transition-all duration-200 whitespace-nowrap flex-shrink-0',
                          selectedSport === topic
                            ? 'bg-cyan-600/20 text-cyan-300'
                            : 'text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-surface)]',
                        )}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Chat list ──────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
            {/* Loading skeletons */}
            {isLoadingChats && (
              <div className="space-y-1.5 px-1 pt-1" aria-busy="true" aria-label="Loading chats">
                {[1, 0.8, 0.9, 0.75, 0.85].map((w, i) => (
                  <div key={i} className="relative flex items-center gap-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] h-[52px] px-3 overflow-hidden">
                    <div className="w-0.5 h-full absolute left-0 top-0 bg-[var(--border-subtle)] rounded-l-xl" />
                    <div className="flex-1 space-y-1.5 pl-1">
                      <div className="h-2.5 rounded-full bg-[var(--bg-elevated)] animate-pulse" style={{ width: `${w * 100}%` }} />
                      <div className="h-2 rounded-full bg-[var(--bg-surface)] animate-pulse" style={{ width: `${w * 60}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Starred section */}
            {starredChats.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">Starred</span>
                  </div>
                  <span className="text-[9px] font-bold text-[var(--text-faint)]">{starredChats.length}</span>
                </div>
                {starredChats.map((chat, i) => (
                  <div
                    key={chat.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${Math.min(i * 40, 280)}ms` }}
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
                      onSelectChat={onSelectChat}
                      onStarChat={onStarChat}
                      onDeleteChat={onDeleteChat}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Date-grouped sections */}
            {dateGroups.map(group => (
              <div key={group.label} className="space-y-1">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">
                    {group.label}
                  </span>
                  <span className="text-[9px] font-bold text-[var(--text-faint)]">{group.chats.length}</span>
                </div>
                {group.chats.map((chat, i) => (
                  <div
                    key={chat.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${Math.min(i * 40, 280)}ms` }}
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
                      onSelectChat={onSelectChat}
                      onStarChat={onStarChat}
                      onDeleteChat={onDeleteChat}
                    />
                  </div>
                ))}
              </div>
            ))}

            {/* Empty state */}
            {filteredChats.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-10 h-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center mb-3">
                  <MessageSquare className="w-5 h-5 text-[var(--text-faint)]" />
                </div>
                <p className="text-xs font-bold text-[var(--text-faint)] mb-1">No chats found</p>
                <p className="text-[10px] text-[var(--text-faint)]">
                  {chatSearch ? 'Try a different search term' : 'Start a new analysis above'}
                </p>
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}
