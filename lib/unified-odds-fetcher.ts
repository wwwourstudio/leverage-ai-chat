/**
 * Unified Odds Fetcher
 *
 * Re-export shim -- the canonical implementation lives in lib/odds/index.ts.
 * This file exists because cards-generator.ts dynamically imports
 * `@/lib/unified-odds-fetcher` for the `getOddsWithCache` helper.
 */
export { getOddsWithCache, fetchLiveOdds, clearOddsCache } from '@/lib/odds/index';
