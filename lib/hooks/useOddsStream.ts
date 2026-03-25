'use client';

/**
 * useOddsStream
 *
 * Subscribes to the four normalized odds tables in real-time.
 * Built on top of the generic useRealtime() hook — each stream is an
 * independent Supabase channel so they update independently.
 *
 * Usage:
 *   const { odds, oddsHistory, playerProps, lineMovements } = useOddsStream('basketball_nba');
 *
 * Each stream returns { data, loading, error } — the same shape as useRealtime().
 */

import { useMemo } from 'react';
import { useRealtime } from '@/lib/hooks/use-realtime';

// ── Table row types (minimal — extend as needed) ──────────────────────────────

export interface OddsRow {
  id: string;
  game_id: string;
  sportsbook_id: string;
  market: string;
  selection: string;
  line: number | null;
  price: number;
  updated_at: string;
}

export interface OddsHistoryRow extends OddsRow {
  timestamp: string;
}

export interface PlayerPropRow {
  id: string;
  game_id: string;
  player_id: string;
  sportsbook_id: string;
  market_id: string;
  line: number;
  over_price: number;
  under_price: number;
  updated_at: string;
}

export interface LineMovementRow {
  id: string;
  game_id: string;
  market: string;
  selection: string;
  opening_line: number;
  current_line: number;
  movement: number;
  detected_at: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface OddsStreamState {
  /** Current odds lines from api.odds */
  odds: ReturnType<typeof useRealtime<OddsRow>>;
  /** Append-only snapshots from api.odds_history */
  oddsHistory: ReturnType<typeof useRealtime<OddsHistoryRow>>;
  /** Current player prop lines from api.player_props */
  playerProps: ReturnType<typeof useRealtime<PlayerPropRow>>;
  /** Game-level line movements (≥1 pt) from api.line_movements */
  lineMovements: ReturnType<typeof useRealtime<LineMovementRow>>;
}

/**
 * @param sport  Optional sport key to filter odds and player_props streams.
 *               If omitted, all sports are streamed.
 *               Passed as a Supabase eq filter on the `sport` column of the
 *               joined games table — only works if your view exposes sport
 *               directly on the table row. For the normalized schema you may
 *               need to denormalize sport onto odds/player_props rows, or
 *               filter client-side from the joined data.
 */
export function useOddsStream(sport?: string): OddsStreamState {
  // Memoize filter objects to prevent re-subscription on every render cycle.
  // useRealtime() depends on filter?.column + filter?.value in its effect deps.
  const oddsFilter = useMemo(
    () => (sport ? { column: 'sport' as const, value: sport } : undefined),
    [sport]
  );

  const odds         = useRealtime<OddsRow>('odds');
  const oddsHistory  = useRealtime<OddsHistoryRow>('odds_history');
  // player_props doesn't have a sport column directly, but the filter is passed
  // through for future schema versions that denormalize sport onto the row.
  const playerProps  = useRealtime<PlayerPropRow>('player_props', oddsFilter);
  const lineMovements = useRealtime<LineMovementRow>('line_movements');

  return { odds, oddsHistory, playerProps, lineMovements };
}
