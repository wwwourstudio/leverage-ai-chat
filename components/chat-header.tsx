'use client';

import { useState, useCallback } from 'react';
import { Menu, TrendingUp, Bell, Settings, LogIn, UserPlus, Download, Share2, Check, Copy } from 'lucide-react';
import { exportChatAsMarkdown, exportChatAsJSON, downloadFile, chatFilename, type ExportMessage, type ExportChat } from '@/lib/chat-export';

interface ChatHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isLoggedIn: boolean;
  user: { name: string; email: string; avatar?: string } | null;
  onOpenUserLightbox: () => void;
  onOpenAlerts: () => void;
  alertCount: number;
  onOpenSettings: () => void;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
  // Export / share props (optional — hidden when not provided)
  activeChat?: ExportChat | null;
  messages?: ExportMessage[];
}

export function ChatHeader({
  sidebarOpen,
  onToggleSidebar,
  isLoggedIn,
  user,
  onOpenUserLightbox,
  onOpenAlerts,
  alertCount,
  onOpenSettings,
  onOpenLogin,
  onOpenSignup,
  activeChat,
  messages = [],
}: ChatHeaderProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'copied'>('idle');

  const hasMessages = messages.filter((m) => !('isWelcome' in m && (m as any).isWelcome)).length > 0;

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
        setTimeout(() => setShareState('idle'), 2500);
      } else {
        console.error('[ChatHeader] Share failed:', data.error);
        setShareState('idle');
      }
    } catch (err) {
      console.error('[ChatHeader] Share error:', err);
      setShareState('idle');
    }
  }, [activeChat, shareState]);

  return (
    <div className="relative bg-[var(--bg-overlay)] border-b border-[var(--border-subtle)] px-3 py-3 md:px-6 md:py-4 shadow-2xl backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-transparent pointer-events-none"></div>
      <div className="relative flex items-center justify-between max-w-6xl mx-auto">
        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={onToggleSidebar}
            className="group p-2.5 hover:bg-[var(--bg-elevated)] rounded-xl transition-all duration-300 active:scale-95 bg-transparent"
          >
            <Menu className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" />
          </button>
          <div className="flex items-center gap-2 md:gap-3">
            {/* Logo mark */}
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 blur-md opacity-40" />
              <div className="relative w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex flex-col leading-none gap-0.5">
              <h1 className="text-sm md:text-base font-black tracking-tight text-white">
                Leverage<span className="text-blue-400"> AI</span>
              </h1>
              <p className="hidden sm:block text-[10px] font-semibold text-[var(--text-muted)] tracking-widest uppercase">Sports Intelligence</p>
            </div>
          </div>
        </div>

        {/* Right: export/share + user actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Export dropdown — shown when there are messages */}
          {hasMessages && activeChat && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((v: any) => !v)}
                className="p-2.5 hover:bg-[var(--bg-elevated)] rounded-xl transition-all duration-300 group active:scale-95 bg-transparent"
                title="Export chat"
              >
                <Download className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" />
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden min-w-[160px]">
                    <button
                      onClick={handleExportMarkdown}
                      className="w-full px-4 py-3 text-sm text-left text-gray-200 hover:bg-gray-800 transition-colors flex items-center gap-2"
                    >
                      <span>Export as Markdown</span>
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="w-full px-4 py-3 text-sm text-left text-gray-200 hover:bg-gray-800 transition-colors flex items-center gap-2"
                    >
                      <span>Export as JSON</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Share button — shown when logged in and has messages */}
          {isLoggedIn && hasMessages && activeChat && (
            <button
              onClick={handleShare}
              disabled={shareState === 'loading'}
              className="p-2.5 hover:bg-[var(--bg-elevated)] rounded-xl transition-all duration-300 group active:scale-95 bg-transparent disabled:opacity-50"
              title={shareState === 'copied' ? 'Link copied!' : 'Share chat'}
            >
              {shareState === 'copied' ? (
                <Check className="w-5 h-5 text-green-400 transition-colors" />
              ) : shareState === 'loading' ? (
                <Copy className="w-5 h-5 text-[var(--text-muted)] animate-pulse" />
              ) : (
                <Share2 className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" />
              )}
            </button>
          )}

          {isLoggedIn && user ? (
            <>
              {/* User profile card — hidden on mobile */}
              <div
                className="hidden md:flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] cursor-pointer hover:border-[var(--border-hover,oklch(0.30_0.02_280))] hover:bg-[var(--bg-elevated)] transition-all"
                onClick={onOpenUserLightbox}
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
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[var(--bg-overlay)]"></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">{user.name}</span>
                    <span className="text-[10px] text-[var(--text-faint)]">{user.email}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onOpenAlerts}
                className="relative p-2.5 hover:bg-[var(--bg-elevated)] rounded-xl transition-all duration-300 group active:scale-95 bg-transparent"
              >
                <Bell className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" />
                {alertCount > 0 && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[var(--bg-overlay)] shadow-lg shadow-red-500/50 animate-pulse"></div>
                )}
              </button>
              <button
                onClick={onOpenSettings}
                className="p-2.5 hover:bg-[var(--bg-elevated)] rounded-xl transition-all duration-300 group active:scale-95 bg-transparent"
              >
                <Settings className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onOpenLogin}
                className="p-1.5 md:px-4 md:py-2 rounded-xl md:border md:border-[var(--border-subtle)] md:bg-[var(--bg-overlay)] hover:bg-[var(--bg-elevated)] md:hover:border-[oklch(0.28_0.02_280)] text-[var(--text-muted)] hover:text-white text-xs md:text-sm font-semibold transition-all"
              >
                <LogIn className="w-4 h-4 md:hidden" />
                <span className="hidden md:inline">Log in</span>
              </button>
              <button
                onClick={onOpenSignup}
                className="p-1.5 md:px-4 md:py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs md:text-sm font-bold transition-all md:shadow-lg md:shadow-blue-500/25 hover:shadow-blue-500/40"
              >
                <UserPlus className="w-4 h-4 md:hidden" />
                <span className="hidden md:inline">Sign up</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
