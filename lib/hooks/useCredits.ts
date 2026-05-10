'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FREE_TIER } from '@/lib/constants';

const LIMIT_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY_CREDITS = 'userCredits';
const STORAGE_KEY_RATE = 'chatRateLimit';

interface CreditData { credits: number; resetTime: number; }
interface RateLimitData { count: number; resetTime: number; }

export function useCredits() {
  const [creditsRemaining, setCreditsRemaining] = useState(FREE_TIER.MESSAGE_LIMIT);
  const [supabaseProfileId, setSupabaseProfileId] = useState<string | null>(null);

  // Sync from localStorage on mount — reads the real persisted balance
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY_CREDITS);
    if (!raw) return;
    try {
      const parsed: CreditData = JSON.parse(raw);
      if (Date.now() <= parsed.resetTime) {
        setCreditsRemaining(parsed.credits);
      } else {
        setCreditsRemaining(FREE_TIER.MESSAGE_LIMIT);
      }
    } catch { /* corrupted — leave default */ }
  }, []);

  const getCreditData = useCallback((): CreditData => {
    if (typeof window === 'undefined') {
      return { credits: FREE_TIER.MESSAGE_LIMIT, resetTime: Date.now() + LIMIT_DURATION };
    }
    const raw = localStorage.getItem(STORAGE_KEY_CREDITS);
    if (!raw) {
      const initial = { credits: FREE_TIER.MESSAGE_LIMIT, resetTime: Date.now() + LIMIT_DURATION };
      localStorage.setItem(STORAGE_KEY_CREDITS, JSON.stringify(initial));
      return initial;
    }
    let parsed: CreditData;
    try {
      parsed = JSON.parse(raw);
    } catch {
      localStorage.removeItem(STORAGE_KEY_CREDITS);
      const initial = { credits: FREE_TIER.MESSAGE_LIMIT, resetTime: Date.now() + LIMIT_DURATION };
      localStorage.setItem(STORAGE_KEY_CREDITS, JSON.stringify(initial));
      return initial;
    }
    if (Date.now() > parsed.resetTime) {
      const reset = { credits: FREE_TIER.MESSAGE_LIMIT, resetTime: Date.now() + LIMIT_DURATION };
      localStorage.setItem(STORAGE_KEY_CREDITS, JSON.stringify(reset));
      return reset;
    }
    return parsed;
  }, []);

  const syncCreditsToSupabase = useCallback(async (newCredits: number) => {
    if (!supabaseProfileId) return;
    try {
      const supabase = createClient();
      await supabase
        .from('user_profiles')
        .update({ credits_remaining: newCredits, updated_at: new Date().toISOString() })
        .eq('id', supabaseProfileId);
    } catch (err) {
      console.error('[Credits] Supabase sync failed:', err);
    }
  }, [supabaseProfileId]);

  // Returns false when credits are exhausted — caller should show the paywall
  const consumeCredit = useCallback((): boolean => {
    const data = getCreditData();
    if (data.credits <= 0) return false;
    const newCredits = data.credits - 1;
    localStorage.setItem(STORAGE_KEY_CREDITS, JSON.stringify({ ...data, credits: newCredits }));
    setCreditsRemaining(newCredits);
    syncCreditsToSupabase(newCredits);
    return true;
  }, [getCreditData, syncCreditsToSupabase]);

  const addCredits = useCallback((amount: number): void => {
    const data = getCreditData();
    const newCredits = data.credits + amount;
    localStorage.setItem(STORAGE_KEY_CREDITS, JSON.stringify({ ...data, credits: newCredits }));
    setCreditsRemaining(newCredits);
    syncCreditsToSupabase(newCredits);
  }, [getCreditData, syncCreditsToSupabase]);

  const getRateLimitData = useCallback((): RateLimitData => {
    if (typeof window === 'undefined') {
      return { count: 0, resetTime: Date.now() + LIMIT_DURATION };
    }
    const raw = localStorage.getItem(STORAGE_KEY_RATE);
    if (!raw) {
      const initial = { count: 0, resetTime: Date.now() + LIMIT_DURATION };
      localStorage.setItem(STORAGE_KEY_RATE, JSON.stringify(initial));
      return initial;
    }
    let parsed: RateLimitData;
    try {
      parsed = JSON.parse(raw);
    } catch {
      localStorage.removeItem(STORAGE_KEY_RATE);
      const initial = { count: 0, resetTime: Date.now() + LIMIT_DURATION };
      localStorage.setItem(STORAGE_KEY_RATE, JSON.stringify(initial));
      return initial;
    }
    if (Date.now() > parsed.resetTime) {
      const reset = { count: 0, resetTime: Date.now() + LIMIT_DURATION };
      localStorage.setItem(STORAGE_KEY_RATE, JSON.stringify(reset));
      return reset;
    }
    return parsed;
  }, []);

  const canCreateNewChat = useCallback((): boolean => {
    return getRateLimitData().count < FREE_TIER.CHAT_LIMIT;
  }, [getRateLimitData]);

  const updateRateLimitCount = useCallback(() => {
    const data = getRateLimitData();
    const updated = { ...data, count: data.count + 1 };
    localStorage.setItem(STORAGE_KEY_RATE, JSON.stringify(updated));
    return updated;
  }, [getRateLimitData]);

  return {
    creditsRemaining,
    setCreditsRemaining,
    supabaseProfileId,
    setSupabaseProfileId,
    getCreditData,
    syncCreditsToSupabase,
    consumeCredit,
    addCredits,
    getRateLimitData,
    canCreateNewChat,
    updateRateLimitCount,
  };
}
