/**
 * fetchOdds.ts
 *
 * Thin wrapper around fetchLiveOdds() that returns typed NormalizedOdd rows
 * instead of the raw Odds API JSON blob.
 *
 * Use this instead of fetchLiveOdds() when you need flat, relational-ready data.
 */

import { fetchLiveOdds, ODDS_MARKETS, BETTING_REGIONS, type OddsAPIOptions } from './index';
import { normalizeOddsResponse, type NormalizedOdd, type OddsApiEvent } from './normalizeOdds';
import { getOddsApiKey } from '@/lib/config';
import { LOG_PREFIXES } from '@/lib/constants';

export type { NormalizedOdd };

/**
 * Fetch live odds for a sport and return them as flat NormalizedOdd rows.
 *
 * @param sport  Sport key, e.g. "basketball_nba"
 * @param options  Optional overrides for markets, regions, oddsFormat, etc.
 *                 apiKey is sourced from env via getOddsApiKey() if not provided.
 */
export async function fetchOdds(
  sport: string,
  options?: Partial<Omit<OddsAPIOptions, 'apiKey'>>
): Promise<NormalizedOdd[]> {
  const apiKey = getOddsApiKey();
  if (!apiKey) {
    console.warn(`${LOG_PREFIXES.API} [fetchOdds] ODDS_API_KEY not configured`);
    return [];
  }

  try {
    const raw: OddsApiEvent[] = await fetchLiveOdds(sport, {
      apiKey,
      markets: [ODDS_MARKETS.H2H, ODDS_MARKETS.SPREADS, ODDS_MARKETS.TOTALS],
      regions: [BETTING_REGIONS.US],
      oddsFormat: 'american',
      ...options,
    });

    if (!Array.isArray(raw)) return [];

    const normalized = normalizeOddsResponse(sport, raw);
    console.log(`${LOG_PREFIXES.API} [fetchOdds] ${sport}: ${normalized.length} rows`);
    return normalized;
  } catch (err) {
    console.error(`${LOG_PREFIXES.API} [fetchOdds] Error for ${sport}:`, err);
    return [];
  }
}
