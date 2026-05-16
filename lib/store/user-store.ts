'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
}

interface UserStore {
  isLoggedIn: boolean;
  user: UserProfile | null;
  customInstructions: string;
  alertCount: number;
  savedPlayersCount: number;
  savedCardsCount: number;
  purchaseAmount: string;
  speakingMessageId: string | null;

  setIsLoggedIn: (v: boolean) => void;
  setUser: (u: UserProfile | null) => void;
  setCustomInstructions: (v: string) => void;
  setAlertCount: (n: number) => void;
  setSavedPlayersCount: (n: number) => void;
  setSavedCardsCount: (n: number) => void;
  setPurchaseAmount: (v: string) => void;
  setSpeakingMessageId: (id: string | null) => void;
  /** Full sign-out: clears user, isLoggedIn, and local fantasy data */
  signOut: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      user: null,
      customInstructions: '',
      alertCount: 0,
      savedPlayersCount: 0,
      savedCardsCount: 0,
      purchaseAmount: '',
      speakingMessageId: null,

      setIsLoggedIn: (v) => set({ isLoggedIn: v }),
      setUser: (u) => set({ user: u }),
      setCustomInstructions: (v) => set({ customInstructions: v }),
      setAlertCount: (n) => set({ alertCount: n }),
      setSavedPlayersCount: (n) => set({ savedPlayersCount: n }),
      setSavedCardsCount: (n) => set({ savedCardsCount: n }),
      setPurchaseAmount: (v) => set({ purchaseAmount: v }),
      setSpeakingMessageId: (id) => set({ speakingMessageId: id }),
      signOut: () => set({ isLoggedIn: false, user: null }),
    }),
    {
      name: 'leverage-user-prefs',
      partialize: (state) => ({
        customInstructions: state.customInstructions,
      }),
    },
  ),
);
