/**
 * useOddsRealtime
 *
 * Subscribes to Supabase Realtime INSERT events on the `api.odds_snapshots`
 * and `api.model_predictions` tables so that chat cards update automatically
 * when the cron worker writes new odds without a page refresh.
 *
 * Usage:
 *   useOddsRealtime({
 *     gameIds: ['abc123', 'def456'],
 *     onOddsUpdate: (snap) => console.log('New snapshot', snap),
 *     onPredictionUpdate: (pred) => console.log('New prediction', pred),
 *   });
 *
 * The hook subscribes on mount and unsubscribes on unmount (or when gameIds changes).
 * Pass an empty array for gameIds to subscribe to ALL games.
 */

'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface OddsSnapshot {
  id: string;
  game_id: string;
  bookmaker: string;
  market: string;
  outcome: string;
  price: number;
  point: number | null;
  captured_at: string;
}

export interface ModelPredictionUpdate {
  id: string;
  game_id: string;
  market: string;
  outcome: string;
  model_probability: number;
  fair_odds: number;
  expected_value: number;
  kelly_fraction: number | null;
  bookmaker: string | null;
  best_price: number | null;
  model_name: string;
  created_at: string;
}

interface UseOddsRealtimeOptions {
  /** Odds API event IDs to filter on. Empty array = subscribe to all games. */
  gameIds?: string[];
  /** Called when a new odds snapshot arrives. */
  onOddsUpdate?: (snapshot: OddsSnapshot) => void;
  /** Called when a new model prediction arrives (positive EV signals). */
  onPredictionUpdate?: (prediction: ModelPredictionUpdate) => void;
  /** Minimum EV threshold for prediction updates (default: 0.05). */
  evThreshold?: number;
  /** Set false to pause the subscription without unmounting. */
  enabled?: boolean;
}

export function useOddsRealtime({
  gameIds = [],
  onOddsUpdate,
  onPredictionUpdate,
  evThreshold = 0.05,
  enabled = true,
}: UseOddsRealtimeOptions = {}): void {
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Stable serialised key to detect meaningful gameIds changes
  const gameIdsKey = gameIds.slice().sort().join(',');

  useEffect(() => {
    if (!enabled) return;
    if (!onOddsUpdate && !onPredictionUpdate) return;

    const supabase = createClient();
    const channelName = `odds-realtime-${gameIdsKey || 'all'}`;

    const channel = supabase.channel(channelName);

    // ── odds_snapshots subscription ─────────────────────────────────────────
    if (onOddsUpdate) {
      const snapshotFilter =
        gameIds.length === 1
          ? `game_id=eq.${gameIds[0]}`
          : undefined; // Supabase supports single-value eq filters on realtime

      channel.on(
        'postgres_changes' as Parameters<typeof channel.on>[0],
        {
          event: 'INSERT',
          schema: 'api',
          table: 'odds_snapshots',
          ...(snapshotFilter ? { filter: snapshotFilter } : {}),
        },
        (payload: { new: OddsSnapshot }) => {
          const snap = payload.new;
          // Client-side filter when multiple gameIds provided
          if (gameIds.length > 1 && !gameIds.includes(snap.game_id)) return;
          onOddsUpdate(snap);
        },
      );
    }

    // ── model_predictions subscription ─────────────────────────────────────
    if (onPredictionUpdate) {
      channel.on(
        'postgres_changes' as Parameters<typeof channel.on>[0],
        {
          event: 'INSERT',
          schema: 'api',
          table: 'model_predictions',
        },
        (payload: { new: ModelPredictionUpdate }) => {
          const pred = payload.new;
          // Filter by EV threshold + optional game list
          if (pred.expected_value < evThreshold) return;
          if (gameIds.length > 0 && !gameIds.includes(pred.game_id)) return;
          onPredictionUpdate(pred);
        },
      );
    }

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[v0] [use-odds-realtime] Subscribed (${channelName})`);
      } else if (status === 'CHANNEL_ERROR') {
        console.warn(`[v0] [use-odds-realtime] Channel error (${channelName})`);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        console.log(`[v0] [use-odds-realtime] Unsubscribed (${channelName})`);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameIdsKey]);
}
