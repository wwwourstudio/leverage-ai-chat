'use client';

import { useState, useCallback } from 'react';
import { Menu, TrendingUp, Bell, Settings, LogIn, UserPlus, Download, Share2, Check, Copy, Zap } from 'lucide-react';
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

  const hasMessages = messages.filter(m => !('isWelcome' in m && (m as any).isWelcome)).length > 0;

  const handleExportMarkdown = useCallback(() => {
    if (!activeChat) return;
    downloadFile(exportChatAsMarkdown(activeChat, messages), chatFilename(activeChat.title, 'md'), 'text/markdown');
    setShowExportMenu(false);
  }, [activeChat, messages]);

  const handleExportJSON = useCallback(() => {
    if (!activeChat) return;
    downloadFile(exportChatAsJSON(activeChat, messages), chatFilename(activeChat.title, 'json'), 'application/json');
    setShowExportMenu(false);
  }, [activeChat, messages]);

  const handleShare = useCallback(async () => {
    if (!activeChat || shareState !== 'idle') return;
    setShareState('loading');
    try {
      const res = await fetch(`/api/chats/${activeChat.id}/share`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.shareToken) {
        await navigator.clipboard.writeText(`${window.location.origin}/share/${data.shareToken}`);
        setShareState('copied');
        setTimeout(() => setShareState('idle'), 2500);
      } else {
        setShareState('idle');
      }
    } catch {
      setShareState('idle');
    }
  }, [activeChat, shareState]);

  return (
    <div className="relative border-b border-[oklch(0.16_0.016_280)] bg-[oklch(0.09_0.01_280)] backdrop-blur-xl">
      {/* Subtle gradient top accent */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent pointer-events-none" />

      <div className="relative flex items-center justify-between px-3 py-3 md:px-5 md:py-3.5 max-w-6xl mx-auto">
        {/* Left: toggle + wordmark */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-[oklch(0.14_0.01_280)] rounded-xl transition-all duration-200 active:scale-95 text-[oklch(0.45_0.01_280)] hover:text-white group"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" style={{width:'18px',height:'18px'}} />
          </button>

          <div className="flex items-center gap-2.5">
            {/* Logo */}
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 blur-[6px] opacity-35" />
              <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <h1 className="text-sm font-black tracking-tight text-white">
                Leverage<span className="text-emerald-400"> AI</span>
              </h1>
              <p className="hidden sm:block text-[9px] font-semibold text-[oklch(0.38_0.01_280)] tracking-widest uppercase mt-0.5">
                Sports Intelligence
              </p>
            </div>
          </div>

          {/* Live indicator — desktop only */}
          <div className="hidden md:flex items-center gap-1.5 ml-1 px-2 py-1 rounded-lg bg-[oklch(0.12_0.012_280)] border border-[oklch(0.20_0.016_280)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-semibold text-[oklch(0.42_0.01_280)]">Live</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Export */}
          {hasMessages && activeChat && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(v => !v)}
                className="p-2 hover:bg-[oklch(0.14_0.01_280)] rounded-xl transition-all duration-200 active:scale-95 text-[oklch(0.42_0.01_280)] hover:text-white"
                title="Export chat"
              >
                <Download style={{width:'16px',height:'16px'}} />
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 bg-[oklch(0.12_0.012_280)] border border-[oklch(0.22_0.018_280)] rounded-xl shadow-2xl shadow-black/50 overflow-hidden min-w-[156px]">
                    {[
                      { label: 'Export as Markdown', fn: handleExportMarkdown },
                      { label: 'Export as JSON', fn: handleExportJSON },
                    ].map(({ label, fn }) => (
                      <button key={label} onClick={fn} className="w-full px-4 py-2.5 text-xs text-left text-[oklch(0.72_0.01_280)] hover:text-white hover:bg-[oklch(0.18_0.015_280)] transition-colors font-medium">
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Share */}
          {isLoggedIn && hasMessages && activeChat && (
            <button
              onClick={handleShare}
              disabled={shareState === 'loading'}
              className="p-2 hover:bg-[oklch(0.14_0.01_280)] rounded-xl transition-all duration-200 active:scale-95 text-[oklch(0.42_0.01_280)] hover:text-white disabled:opacity-50"
              title={shareState === 'copied' ? 'Link copied!' : 'Share chat'}
            >
              {shareState === 'copied'
                ? <Check style={{width:'16px',height:'16px'}} className="text-emerald-400" />
                : shareState === 'loading'
                  ? <Copy style={{width:'16px',height:'16px'}} className="animate-pulse" />
                  : <Share2 style={{width:'16px',height:'16px'}} />}
            </button>
          )}

          {isLoggedIn && user ? (
            <>
              {/* User card — desktop */}
              <button
                onClick={onOpenUserLightbox}
                className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[oklch(0.12_0.012_280)] border border-[oklch(0.20_0.016_280)] hover:border-[oklch(0.30_0.025_260)] hover:bg-[oklch(0.16_0.016_280)] transition-all duration-200 group"
              >
                <div className="relative">
                  <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black">
                    {user.avatar
                      ? <img src={user.avatar} alt={user.name} className="w-full h-full rounded-lg object-cover" />
                      : user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-[oklch(0.12_0.012_280)]" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[11px] font-bold text-white leading-none">{user.name.split(' ')[0]}</span>
                  <span className="text-[9px] text-[oklch(0.38_0.01_280)] leading-none mt-0.5">Pro</span>
                </div>
              </button>

              <button
                onClick={onOpenAlerts}
                className="relative p-2 hover:bg-[oklch(0.14_0.01_280)] rounded-xl transition-all duration-200 active:scale-95 text-[oklch(0.42_0.01_280)] hover:text-white"
              >
                <Bell style={{width:'16px',height:'16px'}} />
                {alertCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-[oklch(0.09_0.01_280)] animate-pulse" />
                )}
              </button>
              <button
                onClick={onOpenSettings}
                className="p-2 hover:bg-[oklch(0.14_0.01_280)] rounded-xl transition-all duration-200 active:scale-95 text-[oklch(0.42_0.01_280)] hover:text-white"
              >
                <Settings style={{width:'16px',height:'16px'}} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onOpenLogin}
                className="px-3 py-1.5 rounded-xl border border-[oklch(0.20_0.016_280)] bg-[oklch(0.12_0.012_280)] hover:bg-[oklch(0.16_0.016_280)] hover:border-[oklch(0.30_0.02_280)] text-[oklch(0.55_0.01_280)] hover:text-white text-xs font-semibold transition-all duration-200 flex items-center gap-1.5"
              >
                <LogIn style={{width:'13px',height:'13px'}} className="md:hidden" />
                <span className="hidden md:inline">Log in</span>
              </button>
              <button
                onClick={onOpenSignup}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all duration-200 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/35 flex items-center gap-1.5"
              >
                <UserPlus style={{width:'13px',height:'13px'}} className="md:hidden" />
                <span className="hidden md:inline">Sign up</span>
                <Zap style={{width:'11px',height:'11px'}} className="hidden md:inline opacity-80" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
