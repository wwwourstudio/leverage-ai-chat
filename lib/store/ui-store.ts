/**
 * Zustand store for global UI state.
 *
 * Consolidates sidebar, modal, and filter state that was previously scattered
 * across page-client.tsx as individual useState calls. Components can consume
 * this store directly, eliminating the 18-prop Sidebar interface and reducing
 * prop drilling.
 *
 * Usage:
 *   import { useUIStore } from '@/lib/store/ui-store';
 *   const { sidebarOpen, setSidebarOpen } = useUIStore();
 */

import { create } from 'zustand';

// ── Modal enum ───────────────────────────────────────────────────────────────
// Replaces 6+ individual boolean flags (showSettingsLightbox, showAlertsLightbox, etc.)
export type ActiveModal = 'none' | 'settings' | 'alerts' | 'stripe' | 'user' | 'adp';

// ── Store interface ──────────────────────────────────────────────────────────
interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  chatSearch: string;
  selectedCategory: string;
  selectedSport: string;
  editingChatId: string | null;
  editingChatTitle: string;

  // Active modal (replaces multiple boolean flags)
  activeModal: ActiveModal;

  // Actions — sidebar
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setChatSearch: (q: string) => void;
  setSelectedCategory: (c: string) => void;
  setSelectedSport: (s: string) => void;
  setEditingChatId: (id: string | null) => void;
  setEditingChatTitle: (title: string) => void;

  // Actions — modals
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  sidebarOpen: false, // corrected to true on desktop by useEffect in consuming components
  chatSearch: '',
  selectedCategory: 'all',
  selectedSport: '',
  editingChatId: null,
  editingChatTitle: '',
  activeModal: 'none',

  // ── Sidebar actions ────────────────────────────────────────────────────────
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setChatSearch: (q) => set({ chatSearch: q }),
  setSelectedCategory: (c) => set({ selectedCategory: c }),
  setSelectedSport: (s) => set({ selectedSport: s }),
  setEditingChatId: (id) => set({ editingChatId: id }),
  setEditingChatTitle: (title) => set({ editingChatTitle: title }),

  // ── Modal actions ──────────────────────────────────────────────────────────
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: 'none' }),
}));
