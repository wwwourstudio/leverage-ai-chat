'use client';

import { create } from 'zustand';
import type { FantasyLeague } from '@/components/index/FantasyLeagueSetup';

interface FantasyStore {
  fantasyLeague: FantasyLeague | null;
  fantasySetupStep: number;
  fantasySetupData: Partial<FantasyLeague>;

  setFantasyLeague: (league: FantasyLeague | null) => void;
  setFantasySetupStep: (fn: number | ((prev: number) => number)) => void;
  setFantasySetupData: (fn: Partial<FantasyLeague> | ((prev: Partial<FantasyLeague>) => Partial<FantasyLeague>)) => void;
  resetSetup: () => void;
}

const DEFAULT_SETUP: Partial<FantasyLeague> = {
  sport: 'nfl',
  platform: 'espn',
  teams: 12,
  leagueType: 'ppr',
};

export const useFantasyStore = create<FantasyStore>()((set) => ({
  fantasyLeague: null,
  fantasySetupStep: 0,
  fantasySetupData: DEFAULT_SETUP,

  setFantasyLeague: (league) => set({ fantasyLeague: league }),
  setFantasySetupStep: (fn) =>
    set((s) => ({ fantasySetupStep: typeof fn === 'function' ? fn(s.fantasySetupStep) : fn })),
  setFantasySetupData: (fn) =>
    set((s) => ({ fantasySetupData: typeof fn === 'function' ? fn(s.fantasySetupData) : fn })),
  resetSetup: () => set({ fantasySetupStep: 0, fantasySetupData: DEFAULT_SETUP }),
}));
