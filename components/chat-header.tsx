'use client';

import { memo, useState, useCallback } from 'react';
import Image from 'next/image';
import { Menu, X, TrendingUp, Bell, Settings, LogIn, UserPlus, Download, Share2, Check, Copy, Bookmark } from 'lucide-react';
import { exportChatAsMarkdown, exportChatAsJSON, downloadFile, chatFilename, type ExportMessage, type ExportChat } from '@/lib/chat-export';
import { useToast } from '@/components/toast-provider';
import { useAppStore } from '@/lib/store/app-store';
import { useUserStore } from '@/lib/store/user-store';
import { useModalState } from '@/lib/hooks/useModalState';

interface ChatHeaderProps {
  activeChat?: ExportChat | null;
  messages?: ExportMessage[];
}

const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  betting: { bg: 'bg-orange-500/10', border: 'border-orange-500/25', text: 'text-orange-400', label: 'Sports Betting' },
  fantasy: { bg: 'bg-violet-500/10', border: 'border-violet-500/25', text: 'text-violet-400', label: 'Fantasy' },
  dfs:     { bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  text: 'text-amber-400',  label: 'DFS' },
  kalshi:  { bg: 'bg-cyan-500/10',   border: 'border-cyan-500/25',   text: 'text-cyan-400',   label: 'Kalshi' },
};

const SPORT_LABELS: Record<string, string> = {
  mlb: 'MLB', nba: 'NBA', nhl: 'NHL', nfl: 'NFL',
  'ncaa-football': 'NCAAF', 'ncaa-basketball': 'NCAAB', 'ncaa-basketball-w': 'NCAAW',
};

export const ChatHeader = memo(function ChatHeader({ activeChat, messages = [] }: ChatHeaderProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'copied'>('idle');
  const toast = useToast();

  // Store reads — no prop drilling needed
  const { sidebarOpen, toggleSidebar, selectedCategory, selectedSport, systemStatus } = useAppStore();
  const { isLoggedIn, user, alertCount, savedPlayersCount, savedCardsCount } = useUserStore();
  const {
    setShowUserLightbox, setShowAlertsLightbox, setShowSettingsLightbox,
    setShowWatchlistLightbox, setShowLoginModal, setShowSignupModal,
  } = useModalState();

  const hasMessages = messages.filter((m) => !('isWelcome' in m && (m as any).isWelcome)).length > 0;
  const watchlistCount = savedPlayersCount + savedCardsCount;
  const catStyle = CATEGORY_STYLES[selectedCategory];
  const sportLabel = SPORT_LABELS[selectedSport] || (selectedSport ? selectedSport.toUpperCase() : null);

  const handleExportMarkdown = useCallback(() => {
    if (!activeChat) return;
    const md = exportChatAsMarkdown(activeChat, messages);
    downloadFile(md, chatFilename(activeChat.title, 'md'), 'text/markdown');
    setShowExportMenu(false);
  }, [activeChat, messages]);

  const handleExportJSON = useCallback(() => {
    if (!activeChat) return;
    const json = exportChatAsJSON(activeChat, messages);
    downloadFile(json, chatFilename(activeChat.title, 'json'), 'application/json');
    setShowExportMenu(false);
  }, [activeChat, messages]);

  const handleShare = useCallback(async () => {
    if (!activeChat || shareState !== 'idle') return;
    setShareState('loading');
    try {
      const res = await fetch(`/api/chats/${activeChat.id}/share`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.shareToken) {
        const shareUrl = `${window.location.origin}/share/${data.shareToken}`;
        await navigator.clipboard.writeText(shareUrl);
        setShareState('copied');
        toast.success('Share link copied');
        setTimeout(() => setShareState('idle'), 2500);
      } else {
        setShareState('idle');
      }
    } catch {
      setShareState('idle');
    }
  }, [activeChat, shareState, toast]);

  return (
    <header className="relative bg-[var(--bg-overlay)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] px-4 py-3 shadow-sm">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative flex items-center justify-between gap-3 max-w-6xl mx-auto">
        {/* Left: hamburger + logo + context chips */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            className="group shrink-0 p-2.5 hover:bg-[var(--bg-elevated)] rounded-xl transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            {sidebarOpen
              ? <X className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" />
              : <Menu className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" />}
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 blur-md opacity-40" />
              <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <TrendingUp className="w-4.5 h-4.5 text-white" />
              </div>
            </div>
            <div className="flex flex-col leading-none gap-0.5">
              <span className="text-sm font-black tracking-tight text-white">
                Leverage<span className="text-blue-400"> AI</span>
              </span>
              <span className="hidden sm:block text-[9px] font-semibold text-[var(--text-muted)] tracking-widest uppercase">Sports Intelligence</span>
            </div>
          </div>

          {/* Desktop context strip: category + sport + system status */}
          <div className="hidden lg:flex items-center gap-1.5 ml-2">
            {catStyle && (
              <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${catStyle.bg} ${catStyle.border} ${catStyle.text}`}>
                {catStyle.label}
              </span>
            )}
            {sportLabel && (
              <span className="inline-flex text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                {sportLabel}
              </span>
            )}
            {/* System status dot */}
            <span
              title={systemStatus === 'ok' ? 'All systems operational' : systemStatus === 'degraded' ? 'Some services degraded' : 'Service disruption'}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                systemStatus === 'ok' ? 'bg-emerald-500 animate-pulse' :
                systemStatus === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
              }`} />
            </span>
          </div>
        </div>

        {/* Right: export / share / user actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {hasMessages && activeChat && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="p-2.5 hover:bg-[var(--bg-elevated)] rounded-xl transition-all duration-200 group active:scale-95"
                title="Export chat"
              >
                <Download className="w-4 h-4 text-[var(--text-muted)] group-hover:text-white transition-colors" />
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden min-w-[160px]">
                    <button onClick={handleExportMarkdown} className="w-full px-4 py-3 text-sm text-left text-gray-200 hover:bg-[var(--bg-elevated)] transition-colors">
                      Export as Markdown
                    </button>
                    <button onClick={handleExportJSON} className="w-full px-4 py-3 text-sm text-left text-gray-200 hover:bg-[var(--bg-elevated)] transition-colors">
                      Export as JSON
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {isLoggedIn && hasMessages && activeChat && (
            <button
              onClick={handleShare}
              disabled={shareState === 'loading'}
              className="p-2.5 hover:bg-[var(--bg-elevated)] rounded-xl transition-all duration-200 group active:scale-95 disabled:opacity-50"
              title={shareState === 'copied' ? 'Link copied!' : 'Share chat'}
            >
              {shareState === 'copied' ? <Check className="w-4 h-4 text-blue-400" />
                : shareState === 'loading' ? <Copy className="w-4 h-4 text-[var(--text-muted)] animate-pulse" />
                : <Share2 className="w-4 h-4 text-[var(--text-muted)] group-hover:text-white transition-colors" />}
            </button>
          )}

          {isLoggedIn && user ? (
            <>
              {/* User profile card — desktop only */}
              <button
                onClick={() => setShowUserLightbox(true)}
                className="hidden md:flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] transition-all cursor-pointer"
              >
                <div className="relative">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                    {user.avatar
                      ? <Image src={user.avatar} alt={user.name} width={32} height={32} className="w-full h-full object-cover" />
                      : user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-violet-500 rounded-full border-2 border-[var(--bg-overlay)]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-white leading-tight">{user.name}</span>
                  <span className="text-[10px] text-[var(--text-faint)] leading-tight">{user.email}</span>
                </div>
              </button>

              {/* Mobile: user avatar button only */}
              <button
                onClick={() => setShowUserLightbox(true)}
                className="md:hidden p-1.5 hover:bg-[var(--bg-elevated)] rounded-xl transition-all group active:scale-95"
              >
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                  {user.avatar
                    ? <Image src={user.avatar} alt={user.name} width={28} height={28} className="w-full h-full object-cover" />
                    : user.name.charAt(0).toUpperCase()}
                </div>
              </button>

              <button
                onClick={() => setShowWatchlistLightbox(true)}
                className="relative p-2 hover:bg-[var(--bg-elevated)] rounded-xl transition-all group active:scale-95"
                title="Bookmarks"
              >
                <Bookmark className={`w-4 h-4 transition-colors ${watchlistCount > 0 ? 'text-blue-400 fill-blue-400' : 'text-[var(--text-muted)] group-hover:text-white'}`} />
                {watchlistCount > 0 && (
                  <div className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 bg-blue-500 rounded-full border border-[var(--bg-overlay)] flex items-center justify-center">
                    <span className="text-[8px] font-black text-white">{watchlistCount}</span>
                  </div>
                )}
              </button>

              <button
                onClick={() => setShowAlertsLightbox(true)}
                className="relative p-2 hover:bg-[var(--bg-elevated)] rounded-xl transition-all group active:scale-95"
                title="Alerts"
              >
                <Bell className="w-4 h-4 text-[var(--text-muted)] group-hover:text-white transition-colors" />
                {alertCount > 0 && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[var(--bg-overlay)] animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setShowSettingsLightbox(true)}
                className="p-2 hover:bg-[var(--bg-elevated)] rounded-xl transition-all group active:scale-95"
                title="Settings"
              >
                <Settings className="w-4 h-4 text-[var(--text-muted)] group-hover:text-white transition-colors" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] text-[var(--text-muted)] hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log in</span>
              </button>
              <button
                onClick={() => setShowSignupModal(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign up</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
});
