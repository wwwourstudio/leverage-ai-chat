/**
 * Enhanced Server-Side Data Loader
 * 
 * Centralized data fetching for server components with:
 * - Parallel API requests for optimal performance
 * - Comprehensive error handling
 * - Cache control strategies
 * - Environment variable validation
 * - Fallback data strategies
 * 
 * @module lib/server-data-loader
 */

import { createClient } from '@/lib/supabase/server';
import { validateServerEnv, getMissingAPIKeys } from '@/lib/env-validator';
import { generateContextualCards } from '@/lib/cards-generator';

export interface ServerDataResult {
  initialCards: any[];
  initialInsights: any;
  userSession: any;
  serverTime: string;
  missingKeys: string[];
  envErrors: string[];
  dataSourcesUsed: string[];
  fetchErrors: string[];
}

interface FetchOptions {
  category?: string;
  sport?: string;
  limit?: number;
  includeKalshi?: boolean;
  includeOdds?: boolean;
}

/**
 * Fetch initial cards by calling the generator directly (no HTTP round-trip).
 * This avoids the NEXT_PUBLIC_SITE_URL / localhost:3000 problem in serverless.
 */
async function fetchInitialCards(options: FetchOptions = {}): Promise<{
  cards: any[];
  sources: string[];
  errors: string[];
}> {
  const { category = 'all', sport, limit = 12 } = options;

  try {
    console.log('[v0] Server: Generating cards directly (category:', category, ', sport:', sport ?? 'any', ')');
    const cards = await generateContextualCards(category, sport, Math.min(limit, 12));
    console.log('[v0] Server: ✓ Generated', cards.length, 'cards');
    return { cards, sources: ['cards-generator'], errors: [] };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[v0] Server: ✗ Error generating cards:', errorMessage);
    return { cards: [], sources: [], errors: [errorMessage] };
  }
}

/**
 * Fetch user insights from database
 */
async function fetchUserInsights(userId?: string): Promise<{
  insights: any;
  errors: string[];
}> {
  if (!userId) {
    return { insights: null, errors: [] };
  }

  try {
    const supabase = await createClient();
    
    // Fetch user stats, preferences, and history in parallel
    const [statsResult, preferencesResult] = await Promise.all([
      supabase.from('user_stats').select('*').eq('user_id', userId).single(),
      supabase.from('user_preferences').select('*').eq('user_id', userId).single(),
    ]);

    const insights = {
      stats: statsResult.data || null,
      preferences: preferencesResult.data || null,
    };

    console.log('[v0] Server: ✓ Fetched user insights for', userId);
    return { insights, errors: [] };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[v0] Server: ✗ Error fetching user insights:', errorMessage);
    return { insights: null, errors: [errorMessage] };
  }
}

/**
 * Get authenticated user session
 */
async function fetchUserSession(): Promise<{
  session: any;
  errors: string[];
}> {
  try {
    const supabase = await createClient();
    // Use getUser() instead of getSession() — getUser() authenticates against
    // the Supabase Auth server so the returned user object is verified.
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      // PGRST errors for unauthenticated state are expected — not a real error
      if (error.message?.includes('Auth session missing')) {
        return { session: null, errors: [] };
      }
      console.error('[v0] Server: Auth error:', error.message);
      return { session: null, errors: [error.message] };
    }

    if (user) {
      console.log('[v0] Server: ✓ User authenticated:', user.email);
      return {
        session: {
          user: {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email?.split('@')[0],
          }
        },
        errors: [],
      };
    }

    console.log('[v0] Server: User not authenticated');
    return { session: null, errors: [] };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[v0] Server: ✗ Session fetch error:', errorMessage);
    return { session: null, errors: [errorMessage] };
  }
}

/**
 * Master data loader - fetches all server-side data in parallel
 */
export async function loadServerData(options: FetchOptions = {}): Promise<ServerDataResult> {
  console.log('[v0] Server: === Starting server-side data load ===');
  const startTime = Date.now();

  // Validate environment first
  const envValidation = validateServerEnv();
  const missingKeys = getMissingAPIKeys();

  if (missingKeys.length > 0) {
    console.warn('[v0] Server: ⚠ Missing API keys:', missingKeys.join(', '));
  }

  // Cards are no longer pre-loaded on the welcome screen.
  // They are only generated on-demand for actual AI responses.
  // This saves ~4 Odds API calls per page load.
  const cardsResult = { cards: [] as any[], sources: [] as string[], errors: [] as string[] };
  const [sessionResult] = await Promise.all([
    fetchUserSession(),
  ]);

  // Fetch user-specific insights if authenticated
  let insightsResult = { insights: null, errors: [] as string[] };
  if (sessionResult.session?.user?.id) {
    insightsResult = await fetchUserInsights(sessionResult.session.user.id);
  }

  const loadTime = Date.now() - startTime;
  console.log(`[v0] Server: ✓ Data load complete in ${loadTime}ms`);

  // Aggregate all errors
  const allErrors = [
    ...cardsResult.errors,
    ...sessionResult.errors,
    ...insightsResult.errors,
    ...envValidation.errors,
  ];

  if (allErrors.length > 0) {
    console.error('[v0] Server: Errors during data load:', allErrors);
  }

  return {
    initialCards: cardsResult.cards,
    initialInsights: insightsResult.insights,
    userSession: sessionResult.session,
    serverTime: new Date().toISOString(),
    missingKeys,
    envErrors: envValidation.errors,
    dataSourcesUsed: cardsResult.sources,
    fetchErrors: allErrors,
  };
}

/**
 * Prefetch specific category/sport data
 */
export async function prefetchCategoryData(category: string, sport?: string): Promise<ServerDataResult> {
  return loadServerData({
    category,
    sport,
    limit: 20,
    includeKalshi: true,
    includeOdds: true,
  });
}
