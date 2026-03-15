/**
 * Server Component Wrapper for Main Chat Interface
 *
 * Fetches initial data server-side for better performance and SEO.
 * Passes pre-fetched data to client component for hydration.
 *
 * @module app/page-wrapper
 * @version 4
 */

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { loadServerData, type ServerDataResult } from '@/lib/server-data-loader';
import { logEnvValidation, validateServerEnv } from '@/lib/config';
import { CardGrid } from '@/components/data-cards/CardSkeleton';
import UnifiedAIPlatform from '@/app/page-client';

export type ServerDataProps = ServerDataResult;

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

function PageSkeleton() {
  return (
    <div className="flex h-screen bg-[oklch(0.08_0.01_280)] text-white overflow-hidden">
      {/* Sidebar skeleton */}
      <div className="w-72 flex-shrink-0 bg-[oklch(0.10_0.01_280)] border-r border-[oklch(0.18_0.015_280)] flex flex-col gap-3 p-4">
        <div className="h-9 rounded-lg bg-[oklch(0.16_0.015_280)] animate-pulse" />
        <div className="flex flex-col gap-2 mt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-[oklch(0.13_0.015_280)] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 flex-shrink-0 bg-[oklch(0.10_0.01_280)] border-b border-[oklch(0.18_0.015_280)] animate-pulse" />
        <div className="flex-1 overflow-auto p-6">
          <CardGrid count={3} />
        </div>
      </div>
    </div>
  );
}
