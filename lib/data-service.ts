/**
 * Data Service (Client-Side)
 * Fetches dynamic data from internal API routes for use in client components.
 */

import {
  CACHE_CONFIG,
  API_ENDPOINTS,
  LOG_PREFIXES,
} from '@/lib/constants';
import { TtlCache } from '@/lib/utils/cache';
import type { CardData } from '@/lib/types';

/** @deprecated Import CardData from @/lib/types instead. */
export type DynamicCard = CardData;

export interface UserInsights {
  totalValue: number;
  winRate: number;
  roi: number;
  activeContests: number;
  totalInvested: number;
  avgConfidence?: number;
  dataSource: string;
  message?: string;
}

const CARDS_TTL = CACHE_CONFIG.CARDS_TTL;

const cache = new TtlCache<any>(100);
const inflightRequests = new Map<string, Promise<DynamicCard[]>>();

async function safeJsonParse(response: Response): Promise<any> {
  const text = await response.text();

  if (!text || text.trim().length === 0) throw new Error('Empty response body');
  if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
    throw new Error('Server returned HTML instead of JSON (possible error page)');
  }

  try {
    return JSON.parse(text);
  } catch (parseError) {
    const preview = text.length > 200 ? text.substring(0, 200) + '…' : text;
    if (text.includes('"error"')) {
      const m = text.match(/"error":\s*"([^"]*)"/);
      if (m) throw new Error(`Server error: ${m[1]}`);
    }
    throw new Error(`Invalid JSON (${parseError instanceof Error ? parseError.message : 'parse failed'}): ${preview}`);
  }
}

/**
 * Fetch dynamic cards based on context.
 * CLIENT-SIDE ONLY — do not call from server components.
 */
export async function fetchDynamicCards(params: {
  sport?: string;
  category?: string;
  userContext?: any;
  limit?: number;
  draftGroupId?: number;
}): Promise<DynamicCard[]> {
  if (typeof window === 'undefined') return [];

  const cacheKey = `cards:${JSON.stringify(params, Object.keys(params).sort())}`;
  const cached = cache.get(cacheKey, CARDS_TTL);
  if (cached !== undefined) return cached;

  // Coalesce duplicate in-flight requests for the same params into one fetch
  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey)!;
  }

  const fetchPromise = (async (): Promise<DynamicCard[]> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(API_ENDPOINTS.CARDS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Cards API ${response.status}: ${errText.substring(0, 100)}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Cards API returned non-JSON response');
      }

      const result = await safeJsonParse(response);
      const cards: DynamicCard[] = Array.isArray(result.cards) ? result.cards : [];

      if (cards.length === 0) {
        console.warn(`${LOG_PREFIXES.DATA_SERVICE} Zero cards returned`, { params });
      }

      cache.set(cacheKey, cards);
      return cards;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${LOG_PREFIXES.DATA_SERVICE} fetchDynamicCards failed:`, msg);
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  })();

  inflightRequests.set(cacheKey, fetchPromise);
  fetchPromise.finally(() => inflightRequests.delete(cacheKey));
  return fetchPromise;
}
