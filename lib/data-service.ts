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

/**
 * Safely parse JSON with error handling
 */
async function safeJsonParse(response: Response): Promise<any> {
  try {
    // Get the text from the response (read once — clone removed as it was unused)
    const text = await response.text();
    
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Response length: ${text.length} bytes`);
    
    // Check if it's empty
    if (!text || text.trim().length === 0) {
      console.error(`${LOG_PREFIXES.DATA_SERVICE} Empty response body received`);
      throw new Error('Empty response body');
    }
    
    // Check for common non-JSON responses
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      console.error(`${LOG_PREFIXES.DATA_SERVICE} Received HTML instead of JSON`);
      throw new Error('Server returned HTML instead of JSON (possible error page)');
    }
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(text);
      console.log(`${LOG_PREFIXES.DATA_SERVICE} Successfully parsed JSON`);
      return parsed;
    } catch (parseError) {
      // Log the first 500 characters for better debugging
      const preview = text.length > 500 ? text.substring(0, 500) + '...' : text;
      console.error(`${LOG_PREFIXES.DATA_SERVICE} JSON parse failed`);
      console.error(`${LOG_PREFIXES.DATA_SERVICE} Response preview:`, preview);
      console.error(`${LOG_PREFIXES.DATA_SERVICE} Parse error:`, parseError instanceof Error ? parseError.message : 'Unknown');
      
      // Try to extract any useful info from malformed JSON
      if (text.includes('"error"')) {
        const errorMatch = text.match(/"error":\s*"([^"]*)"/);
        if (errorMatch) {
          throw new Error(`Server error: ${errorMatch[1]}`);
        }
      }
      
      throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIXES.DATA_SERVICE} Response parsing failed:`, errorMessage);
    throw new Error(`Response parsing failed: ${errorMessage}`);
  }
}

/**
 * Fetch dynamic cards based on context
 * CLIENT-SIDE ONLY - Do not call from server components
 */
export async function fetchDynamicCards(params: {
  sport?: string;
  category?: string;
  userContext?: any;
  limit?: number;
  draftGroupId?: number;
}): Promise<DynamicCard[]> {
  // Skip if running on server
  if (typeof window === 'undefined') {
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Skipping fetchDynamicCards on server`);
    return [];
  }

  console.log(`${LOG_PREFIXES.DATA_SERVICE} Fetching cards:`, JSON.stringify(params));
  
  // Sort keys for a deterministic cache key regardless of object property order
  const cacheKey = `cards:${JSON.stringify(params, Object.keys(params).sort())}`;
  const cached = cache.get(cacheKey, CARDS_TTL);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(API_ENDPOINTS.CARDS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`${LOG_PREFIXES.DATA_SERVICE} ✗ API Error Response:`, errorText.substring(0, 500));
      throw new Error(`Cards API returned ${response.status}: ${errorText.substring(0, 100)}`);
    }

    // Validate JSON response
    const contentType = response.headers.get('content-type');
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Response Content-Type: ${contentType}`);
    
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Cards API returned non-JSON response');
    }

    console.log(`${LOG_PREFIXES.DATA_SERVICE} → Parsing JSON response...`);
    const result = await safeJsonParse(response);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} ✓ JSON parsed successfully`);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Result structure:`, Object.keys(result));
    
    const cards = Array.isArray(result.cards) ? result.cards : [];
    console.log(`${LOG_PREFIXES.DATA_SERVICE} ✓ Extracted ${cards.length} cards from response`);
    
    if (cards.length > 0) {
      console.log(`${LOG_PREFIXES.DATA_SERVICE} Card types:`, cards.map((c: DynamicCard) => c.type));
      console.log(`${LOG_PREFIXES.DATA_SERVICE} Card categories:`, cards.map((c: DynamicCard) => c.category));
      console.log(`${LOG_PREFIXES.DATA_SERVICE} Sample card:`, JSON.stringify(cards[0], null, 2));
    } else {
      console.log(`${LOG_PREFIXES.DATA_SERVICE} ⚠ WARNING: Zero cards returned!`);
      console.log(`${LOG_PREFIXES.DATA_SERVICE} Full API response:`, JSON.stringify(result, null, 2));
    }

    cache.set(cacheKey, cards);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} ✓ Cached ${cards.length} cards`);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} ========================================`);
    return cards;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    console.log(`${LOG_PREFIXES.DATA_SERVICE} ✗ FETCH ERROR:`, errorMessage);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Error stack:`, errorStack);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} Returning empty array as fallback`);
    console.log(`${LOG_PREFIXES.DATA_SERVICE} ========================================`);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

