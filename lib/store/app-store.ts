'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SystemStatus = 'ok' | 'degraded' | 'down';
export type AppCategory = 'all' | 'betting' | 'kalshi' | 'dfs' | 'fantasy' | 'props';
export type CardSortBy = 'default' | 'value' | 'time' | 'alpha';

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
  // Card filtering / sorting (cardSearch is NOT persisted — session only)
  cardSortBy: CardSortBy;
  cardSearch: string;
  setCardSortBy: (v: CardSortBy) => void;
  setCardSearch: (v: string) => void;
  // Live card connection state (set by useCardRefresh hook)
  cardLiveSubscribed: boolean;
  cardLiveRefreshAt: number | null;
  setCardLiveSubscribed: (v: boolean) => void;
  setCardLiveRefreshAt: (v: number | null) => void;
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
      cardSortBy: 'default' as CardSortBy,
      cardSearch: '',
      cardLiveSubscribed: false,
      cardLiveRefreshAt: null,

      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      selectCategory: (catId) =>
        set({ selectedCategory: catId, ...(catId !== 'kalshi' && { kalshiBettingBannerVisible: false }) }),
      setSelectedSport: (v) => set({ selectedSport: v }),
      setSelectedKalshiTopic: (v) => set({ selectedKalshiTopic: v }),
      setSystemStatus: (v) => set({ systemStatus: v }),
      toggleDeepThink: () => set((s) => ({ deepThink: !s.deepThink })),
      setKalshiBettingBannerVisible: (v) => set({ kalshiBettingBannerVisible: v }),
      setCardSortBy: (v) => set({ cardSortBy: v }),
      setCardSearch: (v) => set({ cardSearch: v }),
      setCardLiveSubscribed: (v) => set({ cardLiveSubscribed: v }),
      setCardLiveRefreshAt: (v) => set({ cardLiveRefreshAt: v }),
    }),
    {
      name: 'leverage-app-prefs',
      partialize: (state) => ({
        selectedCategory: state.selectedCategory,
        selectedSport: state.selectedSport,
        selectedKalshiTopic: state.selectedKalshiTopic,
        deepThink: state.deepThink,
        cardSortBy: state.cardSortBy,
        // cardSearch intentionally excluded — session only
        // live state intentionally excluded — reset each session
      }),
    },
  ),
);
