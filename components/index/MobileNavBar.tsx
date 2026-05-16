'use client';

import { Layers, TrendingUp, Trophy, Award, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store/app-store';

const TABS = [
  { id: 'all',     label: 'All',     icon: Layers,     accent: 'text-blue-400',   activeBg: 'bg-blue-500/20',   activeBorder: 'border-blue-500/40' },
  { id: 'betting', label: 'Bet',     icon: TrendingUp, accent: 'text-orange-400', activeBg: 'bg-orange-500/20', activeBorder: 'border-orange-500/40' },
  { id: 'fantasy', label: 'Fantasy', icon: Trophy,     accent: 'text-violet-400', activeBg: 'bg-violet-500/20', activeBorder: 'border-violet-500/40' },
  { id: 'dfs',     label: 'DFS',     icon: Award,      accent: 'text-amber-400',  activeBg: 'bg-amber-500/20',  activeBorder: 'border-amber-500/40' },
  { id: 'kalshi',  label: 'Kalshi',  icon: BarChart3,  accent: 'text-cyan-400',   activeBg: 'bg-cyan-500/20',   activeBorder: 'border-cyan-500/40' },
] as const;

export function MobileNavBar() {
  const { selectedCategory, selectCategory } = useAppStore();

  return (
    <nav
      className="lg:hidden flex items-center justify-around bg-[var(--bg-overlay)]/95 backdrop-blur-xl border-t border-[var(--border-subtle)] px-1 py-1 safe-area-bottom"
      aria-label="Category navigation"
    >
      {TABS.map((tab) => {
        const isActive = selectedCategory === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => selectCategory(tab.id)}
            aria-pressed={isActive}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-0 flex-1',
              isActive
                ? cn(tab.activeBg, tab.activeBorder, 'border', tab.accent)
                : 'text-white/40 hover:text-white/70',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-wide truncate">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
