/**
 * adp-data.ts — thin re-export shim
 *
 * This file exists solely to bust the Turbopack chunk cache for the old
 * lib/adp-data.ts artifact (chunk lib_eb70efe0). The canonical implementation
 * lives in lib/adp-data-service.ts.
 *
 * IMPORTANT: All Supabase access is in adp-data-service.ts. This shim overrides
 * getADPData and loadADPFromSupabase with browser-safe no-ops so that even if
 * the stale compiled chunk runs this module, it never touches @supabase/supabase-js.
 */

export type { NFBCPlayer, ADPQueryParams } from '@/lib/adp-data-service';
export { queryADP, parseTSV, clearADPCache, saveADPToSupabase } from '@/lib/adp-data-service';

import type { NFBCPlayer } from '@/lib/adp-data-service';

/**
 * Browser-safe override: always returns [] in the browser.
 * In server context, delegates to the real implementation.
 */
export async function getADPData(forceRefresh = false): Promise<NFBCPlayer[]> {
  if (typeof window !== 'undefined') return [];
  const { getADPData: _getADPData } = await import('@/lib/adp-data-service');
  return _getADPData(forceRefresh);
}

/**
 * Browser-safe override: always returns null in the browser.
 * In server context, delegates to the real implementation.
 */
export async function loadADPFromSupabase(sport = 'mlb', allowStale = false): Promise<NFBCPlayer[] | null> {
  if (typeof window !== 'undefined') return null;
  const { loadADPFromSupabase: _load } = await import('@/lib/adp-data-service');
  return _load(sport, allowStale);
}
