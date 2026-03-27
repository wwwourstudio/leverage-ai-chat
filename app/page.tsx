/**
 * Server Component Wrapper for Main Chat Interface
 *
 * Fetches initial data server-side for better performance and SEO.
 * Passes pre-fetched data to client component for hydration.
 *
 * @module app/page-wrapper
 */

// ISR: re-render the static shell at most once per minute.
// User-specific data (auth, credits, instructions, chats) is fetched
// client-side via /api/init so the page shell stays cacheable.
export const revalidate = 60;

import { Suspense } from 'react';
import { loadServerData, type ServerDataResult } from '@/lib/server-data-loader';
import { logEnvValidation, validateServerEnv } from '@/lib/config';
import UnifiedAIPlatform from './page-client';
import { PageSkeleton } from '@/components/index/PageSkeleton';

export type ServerDataProps = ServerDataResult;

async function fetchInitialServerData(): Promise<ServerDataProps> {
  if (process.env.NODE_ENV === 'development') console.log('[v0] Server: === Page Load - Fetching All Data ===');

  // Log environment validation for debugging
  const envValidation = validateServerEnv();
  logEnvValidation(envValidation, 'server');

  // Use enhanced data loader with parallel fetching and comprehensive error handling
  const serverData = await loadServerData({
    category: 'all',
    limit: 12,
    includeKalshi: true,
    includeOdds: true,
  });

  // Log data fetch results (dev only)
  if (process.env.NODE_ENV === 'development') {
    console.log('[v0] Server: Data fetch summary:');
    console.log('  - Cards:', serverData.initialCards.length);
    console.log('  - Session:', serverData.userSession ? 'authenticated' : 'anonymous');
    console.log('  - Sources:', serverData.dataSourcesUsed.join(', '));
    console.log('  - Missing Keys:', serverData.missingKeys.length);
    console.log('  - Errors:', serverData.fetchErrors.length);
  }

  // Ensure all data is JSON-serializable for the RSC -> Client Component boundary.
  // Complex objects (Dates, undefined, functions) get stripped during serialization.
  return JSON.parse(JSON.stringify(serverData));
}

export default async function Page() {
  const serverData = await fetchInitialServerData();

  // Display data quality metrics in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[v0] Page: Hydrating with server data:', {
      cardsCount: serverData.initialCards.length,
      hasSession: !!serverData.userSession,
      dataQuality: serverData.fetchErrors.length === 0 ? 'GOOD' : 'DEGRADED',
      sources: serverData.dataSourcesUsed,
    });
  }

  return (
    <Suspense fallback={<PageSkeleton />}>
      <UnifiedAIPlatform serverData={serverData} />
    </Suspense>
  );
}

