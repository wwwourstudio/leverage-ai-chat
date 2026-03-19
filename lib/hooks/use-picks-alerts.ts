'use client';

/**
 * usePicksAlerts
 *
 * Subscribes to live updates on the `api.daily_picks` table and fires a
 * toast notification whenever a pick is updated to ELITE tier with sharp
 * money confirmed (sharp_boosted = true).
 *
 * Deduplication: each pick ID is only alerted once per mount to prevent
 * re-triggering on the same row being re-processed.
 *
 * Usage:
 *   'use client';
 *   import { usePicksAlerts } from '@/lib/hooks/use-picks-alerts';
 *
 *   export function MyLayout() {
 *     usePicksAlerts();          // fire-and-forget; toasts appear globally
 *     return <>{children}</>;
 *   }
 *
 * Prerequisites:
 *   - <ToastProvider> must be a parent in the tree
 *   - Supabase Realtime must be enabled for `api.daily_picks`
 *     (run: ALTER PUBLICATION supabase_realtime ADD TABLE api.daily_picks;)
 */

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/toast-provider';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PicksAlertOptions {
  /**
   * Minimum tier to alert on.
   * 'ELITE' (default) — only the highest-confidence picks
   * 'STRONG'          — include STRONG tier as well
   */
  minTier?: 'ELITE' | 'STRONG';
  /**
   * If true, only alert when the pick also has sharp_boosted = true.
   * Default: true (reduces false positives significantly).
   */
  requireSharp?: boolean;
  /**
   * Cooldown between toasts for the same pick_id (ms).
   * Prevents duplicate alerts if a pick is re-processed multiple times.
   * Default: 60_000 (1 minute)
   */
  cooldownMs?: number;
}

interface DailyPickPayload {
  id: number;
  player_name: string;
  tier: string;
  score: number;
  sharp_boosted: boolean;
  home_team: string | null;
  away_team: string | null;
  adjusted_edge: number;
}

// ── Tier ordering ──────────────────────────────────────────────────────────────

const TIER_RANK: Record<string, number> = { ELITE: 3, STRONG: 2, LEAN: 1, PASS: 0 };

function tierAtLeast(actual: string, min: string): boolean {
  return (TIER_RANK[actual] ?? 0) >= (TIER_RANK[min] ?? 99);
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function usePicksAlerts(options: PicksAlertOptions = {}): void {
  const {
    minTier      = 'ELITE',
    requireSharp = true,
    cooldownMs   = 60_000,
  } = options;

  const toast     = useToast();
  const alertedAt = useRef<Map<number, number>>(new Map());
  const supabase  = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('daily_picks_alerts')
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'api',
          table:  'daily_picks',
        },
        (payload: { new: DailyPickPayload }) => {
          const pick = payload.new;

          // Filter: tier requirement
          if (!tierAtLeast(pick.tier, minTier)) return;

          // Filter: sharp requirement
          if (requireSharp && !pick.sharp_boosted) return;

          // Deduplication cooldown
          const lastAlerted = alertedAt.current.get(pick.id) ?? 0;
          if (Date.now() - lastAlerted < cooldownMs) return;
          alertedAt.current.set(pick.id, Date.now());

          // Build message
          const gameCtx = pick.home_team && pick.away_team
            ? ` (${pick.away_team} @ ${pick.home_team})`
            : '';
          const edgeStr = pick.adjusted_edge > 0
            ? ` +${pick.adjusted_edge.toFixed(1)}pp edge`
            : '';
          const sharpTag = pick.sharp_boosted ? ' • Sharp ' : '';

          const message =
            `${pick.tier} PICK: ${pick.player_name}${gameCtx} —${sharpTag}${edgeStr}`;

          if (pick.tier === 'ELITE') {
            toast.success(message);
          } else {
            toast.info(message);
          }
        },
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.info('[usePicksAlerts] Subscribed to daily_picks realtime');
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[usePicksAlerts] Realtime channel error — alerts paused');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minTier, requireSharp, cooldownMs]);
}
