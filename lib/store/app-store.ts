'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SystemStatus = 'ok' | 'degraded' | 'down';
export type AppCategory = 'all' | 'betting' | 'kalshi' | 'dfs' | 'fantasy' | 'props';

interface AppStore {
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  // Category / sport filter
  selectedCategory: AppCategory;
  selectedSport: string;
  selectedKalshiTopic: string;
  /** Set category and auto-clear kalshiBettingBannerVisible when leaving Kalshi */
  selectCategory: (catId: AppCategory) => void;
  setSelectedSport: (v: string) => void;
  setSelectedKalshiTopic: (v: string) => void;
  // System health
  systemStatus: SystemStatus;
  setSystemStatus: (v: SystemStatus) => void;
  // AI options
  deepThink: boolean;
  toggleDeepThink: () => void;
  // Banners
  kalshiBettingBannerVisible: boolean;
  setKalshiBettingBannerVisible: (v: boolean) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      selectedCategory: 'all' as AppCategory,
      selectedSport: '',
      selectedKalshiTopic: '',
      systemStatus: 'ok',
      deepThink: false,
      kalshiBettingBannerVisible: false,

      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      selectCategory: (catId) =>
        set({ selectedCategory: catId, ...(catId !== 'kalshi' && { kalshiBettingBannerVisible: false }) }),
      setSelectedSport: (v) => set({ selectedSport: v }),
      setSelectedKalshiTopic: (v) => set({ selectedKalshiTopic: v }),
      setSystemStatus: (v) => set({ systemStatus: v }),
      toggleDeepThink: () => set((s) => ({ deepThink: !s.deepThink })),
      setKalshiBettingBannerVisible: (v) => set({ kalshiBettingBannerVisible: v }),
    }),
    {
      name: 'leverage-app-prefs',
      partialize: (state) => ({
        selectedCategory: state.selectedCategory,
        selectedSport: state.selectedSport,
        deepThink: state.deepThink,
      }),
    },
  ),
);
