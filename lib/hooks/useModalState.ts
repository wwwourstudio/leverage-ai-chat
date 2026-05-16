'use client';

import { create } from 'zustand';

// ── Zustand store (single global instance) ───────────────────────────────────

interface ModalStoreState {
  showLoginModal: boolean;
  showSignupModal: boolean;
  showUserLightbox: boolean;
  showSettingsLightbox: boolean;
  showAlertsLightbox: boolean;
  showWatchlistLightbox: boolean;
  showStripeLightbox: boolean;
  showPurchaseModal: boolean;
  showSubscriptionModal: boolean;
  showCommandPalette: boolean;
  showLimitNotification: boolean;
  setShowLoginModal: (v: boolean) => void;
  setShowSignupModal: (v: boolean) => void;
  setShowUserLightbox: (v: boolean) => void;
  setShowSettingsLightbox: (v: boolean) => void;
  setShowAlertsLightbox: (v: boolean) => void;
  setShowWatchlistLightbox: (v: boolean) => void;
  setShowStripeLightbox: (v: boolean) => void;
  setShowPurchaseModal: (v: boolean) => void;
  setShowSubscriptionModal: (v: boolean) => void;
  setShowCommandPalette: (v: boolean | ((prev: boolean) => boolean)) => void;
  setShowLimitNotification: (v: boolean) => void;
}

const useModalStore = create<ModalStoreState>()((set) => ({
  showLoginModal: false,
  showSignupModal: false,
  showUserLightbox: false,
  showSettingsLightbox: false,
  showAlertsLightbox: false,
  showWatchlistLightbox: false,
  showStripeLightbox: false,
  showPurchaseModal: false,
  showSubscriptionModal: false,
  showCommandPalette: false,
  showLimitNotification: false,
  setShowLoginModal: (v) => set({ showLoginModal: v }),
  setShowSignupModal: (v) => set({ showSignupModal: v }),
  setShowUserLightbox: (v) => set({ showUserLightbox: v }),
  setShowSettingsLightbox: (v) => set({ showSettingsLightbox: v }),
  setShowAlertsLightbox: (v) => set({ showAlertsLightbox: v }),
  setShowWatchlistLightbox: (v) => set({ showWatchlistLightbox: v }),
  setShowStripeLightbox: (v) => set({ showStripeLightbox: v }),
  setShowPurchaseModal: (v) => set({ showPurchaseModal: v }),
  setShowSubscriptionModal: (v) => set({ showSubscriptionModal: v }),
  setShowCommandPalette: (fn) =>
    set((s) => ({ showCommandPalette: typeof fn === 'function' ? fn(s.showCommandPalette) : fn })),
  setShowLimitNotification: (v) => set({ showLimitNotification: v }),
}));

// ── Public hook (backward-compatible API) ─────────────────────────────────────

export type { ModalStoreState as ModalState };

export function useModalState() {
  return useModalStore();
}
