/**
 * Server Component Wrapper for Main Chat Interface
 *
 * Fetches initial data server-side for better performance and SEO.
 * Passes pre-fetched data to client component for hydration.
 *
 * @module app/page-wrapper
 */

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { loadServerData, type ServerDataResult } from '@/lib/server-data-loader';
import { logEnvValidation, validateServerEnv } from '@/lib/env-validator';
import UnifiedAIPlatform from './page-client';

export interface ServerDataProps extends ServerDataResult {
  // Extended with data source tracking
}

async function fetchInitialServerData(): Promise<ServerDataProps> {
  console.log('[v0] Server: === Page Load - Fetching All Data ===');

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

  // Log data fetch results
  console.log('[v0] Server: Data fetch summary:');
  console.log('  - Cards:', serverData.initialCards.length);
  console.log('  - Session:', serverData.userSession ? 'authenticated' : 'anonymous');
  console.log('  - Sources:', serverData.dataSourcesUsed.join(', '));
  console.log('  - Missing Keys:', serverData.missingKeys.length);
  console.log('  - Errors:', serverData.fetchErrors.length);

  return serverData;
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

function PageSkeleton() {
  return (
    <div className="flex h-screen bg-gray-950 text-white animate-pulse">
      <div className="flex-1 flex flex-col">
        <div className="h-16 bg-gray-900/50 border-b border-gray-800/50" />
        <div className="flex-1 p-6 space-y-4">
          <div className="h-20 bg-gray-900/30 rounded-lg" />
          <div className="h-20 bg-gray-900/30 rounded-lg" />
          <div className="h-20 bg-gray-900/30 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
