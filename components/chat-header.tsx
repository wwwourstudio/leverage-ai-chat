'use client';

import { Menu, TrendingUp, Bell, Settings } from 'lucide-react';

interface ChatHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isLoggedIn: boolean;
  user: { name: string; email: string; avatar?: string } | null;
  onOpenUserLightbox: () => void;
  onOpenAlerts: () => void;
  onOpenSettings: () => void;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
}

export function ChatHeader({
  sidebarOpen,
  onToggleSidebar,
  isLoggedIn,
  user,
  onOpenUserLightbox,
  onOpenAlerts,
  onOpenSettings,
  onOpenLogin,
  onOpenSignup,
}: ChatHeaderProps) {
  return (
    <div className="relative bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-b border-[var(--border-subtle)] px-3 py-3 md:px-6 md:py-4 shadow-2xl backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-transparent pointer-events-none"></div>
      <div className="relative flex items-center justify-between max-w-6xl mx-auto">
        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={onToggleSidebar}
            className="group p-2.5 hover:bg-gray-800/70 rounded-xl transition-all duration-300 active:scale-95 bg-transparent"
          >
            <Menu className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
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

        {/* Right: user card (desktop only) + bell + settings / auth buttons */}
        <div className="flex items-center gap-2 md:gap-3">
          {isLoggedIn && user ? (
            <>
              {/* User profile card — hidden on mobile, use sidebar avatar instead */}
              <div
                className="hidden md:flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-900/50 border border-gray-800 cursor-pointer hover:border-gray-700 hover:bg-gray-800/50 transition-all"
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
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-950"></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">{user.name}</span>
                    <span className="text-[10px] text-[var(--text-faint)]">{user.email}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onOpenAlerts}
                className="relative p-2.5 hover:bg-gray-800/70 rounded-xl transition-all duration-300 group active:scale-95 bg-transparent"
              >
                <Bell className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-950 shadow-lg shadow-red-500/50 animate-pulse"></div>
              </button>
              <button
                onClick={onOpenSettings}
                className="p-2.5 hover:bg-gray-800/70 rounded-xl transition-all duration-300 group active:scale-95 bg-transparent"
              >
                <Settings className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onOpenLogin}
                className="px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-gray-800 bg-gray-900/50 hover:bg-gray-800/70 hover:border-gray-700 text-gray-300 hover:text-white text-xs md:text-sm font-semibold transition-all"
              >
                Log in
              </button>
              <button
                onClick={onOpenSignup}
                className="px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs md:text-sm font-bold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
