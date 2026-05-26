'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRealtime } from './use-realtime';
import { invalidateCardsCache } from '@/lib/data-service';
import { useAppStore } from '@/lib/store/app-store';

export interface UseCardRefreshOptions {
  /** Async function to call after cache is invalidated; must be stable (useCallback). */
  onRefresh: () => Promise<void>;
  /** When false, realtime subscription is inactive (default: true). */
  enabled?: boolean;
}

/**
 * Subscribes to Supabase `live_odds_cache` INSERT/UPDATE events.
 * On each event: invalidates the in-memory TTL cache then calls `onRefresh`.
 * Updates `cardLiveSubscribed` and `cardLiveRefreshAt` in the global app store
 * so CardLayout can show the Live indicator without prop drilling.
 */
export function useCardRefresh({ onRefresh, enabled = true }: UseCardRefreshOptions) {
  const { setCardLiveSubscribed, setCardLiveRefreshAt } = useAppStore();
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  const handleEvent = useCallback((payload: any) => {
    if (!enabled) return;
    if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;
    invalidateCardsCache();
    onRefreshRef.current().then(() => {
      setCardLiveRefreshAt(Date.now());
    }).catch(() => {/* non-critical */});
  }, [enabled, setCardLiveRefreshAt]);

  // Subscribe via existing useRealtime callback form
  useRealtime('live_odds_cache', handleEvent);

  // Track subscription status in the store
  useEffect(() => {
    if (!enabled) {
      setCardLiveSubscribed(false);
      return;
    }
    setCardLiveSubscribed(true);
    return () => setCardLiveSubscribed(false);
  }, [enabled, setCardLiveSubscribed]);
}
