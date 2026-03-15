/**
 * Fantasy Projections Seeder — server-only
 *
 * Fetches player projections from Supabase (api.fantasy_projections) and seeds
 * the in-memory projections cache so generateFantasyCards() returns live data
 * instead of the hardcoded fallback arrays.
 *
 * IMPORTANT: Do NOT import this module from client components. It uses
 * lib/supabase/server.ts (next/headers) which is server-only.
 *
 * Usage (from API routes / server components):
 *   import { seedProjectionsFromSupabase } from '@/lib/fantasy/projections-seeder';
 *   await seedProjectionsFromSupabase('mlb', 2026);
 *
 * The function is safe to call fire-and-forget (no await) when you want to
 * warm the cache asynchronously without blocking the response.
 */

import { seedProjectionsCache } from '@/lib/fantasy/projections-cache';
import type { GenericProjection } from '@/lib/fantasy/projections-cache';

type Sport = 'nfl' | 'mlb' | 'nba';

/**
 * Fetches up to 300 player projections for the given sport/season from
 * api.fantasy_projections and seeds the in-memory cache.
 *
 * @returns Number of players successfully seeded (0 = Supabase unavailable or empty)
 */
export async function seedProjectionsFromSupabase(sport: Sport, season: number): Promise<number> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data, error } = await supabase
      .schema('api')
      .from('fantasy_projections')
      .select('player_name, position, stats, fantasy_points, adp')
      .eq('sport', sport)
      .eq('season_year', season)
      .order('fantasy_points', { ascending: false })
      .limit(300);

    if (error || !data?.length) return 0;

    const players: GenericProjection[] = data
      .map((row: any) => ({
        name: row.player_name ?? '',
        team: (row.stats as Record<string, string> | null)?.team ?? '',
        pos:  row.position ?? '',
        pts:  (row.fantasy_points as number) ?? 0,
        adp:  (row.adp as number) ?? 999,
      }))
      .filter((p: GenericProjection) => p.name.length > 0);

    if (players.length > 0) {
      seedProjectionsCache(sport, season, players);
      console.log(`[v0] [projections] Seeded ${players.length} ${sport.toUpperCase()} players (season ${season}) from Supabase`);
    }

    return players.length;
  } catch (err) {
    console.warn(`[v0] [projections] Supabase seed failed for ${sport}/${season}:`, err);
    return 0;
  }
}
