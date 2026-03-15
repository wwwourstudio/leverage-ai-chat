/**
 * Server Component Wrapper for Main Chat Interface
 *
 * Fetches initial data server-side for better performance and SEO.
 * Passes pre-fetched data to client component for hydration.
 *
 * @module app/page-wrapper
 * @version 5
 */

import { Suspense } from 'react';
import { loadServerData, type ServerDataResult } from '@/lib/server-data-loader';
import { logEnvValidation, validateServerEnv } from '@/lib/config';
import { CardGrid } from '@/components/data-cards/CardSkeleton';
import UnifiedAIPlatform from '@/app/page-client';

export const dynamic = 'force-dynamic';

export type ServerDataProps = ServerDataResult;

async function fetchInitialServerData(): Promise<ServerDataProps> {
  const envValidation = validateServerEnv();
  logEnvValidation(envValidation, 'server');

  const serverData = await loadServerData({
    category: 'all',
    limit: 12,
    includeKalshi: true,
    includeOdds: true,
  });

  return JSON.parse(JSON.stringify(serverData));
}

export default async function Page() {
  const serverData = await fetchInitialServerData();

  return (
    <Suspense fallback={<PageSkeleton />}>
      <UnifiedAIPlatform serverData={serverData} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex h-screen bg-[oklch(0.08_0.01_280)] text-white overflow-hidden">
      <div className="w-72 flex-shrink-0 bg-[oklch(0.10_0.01_280)] border-r border-[oklch(0.18_0.015_280)] flex flex-col gap-3 p-4">
        <div className="h-9 rounded-lg bg-[oklch(0.16_0.015_280)] animate-pulse" />
        <div className="flex flex-col gap-2 mt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-[oklch(0.13_0.015_280)] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 flex-shrink-0 bg-[oklch(0.10_0.01_280)] border-b border-[oklch(0.18_0.015_280)] animate-pulse" />
        <div className="flex-1 overflow-auto p-6">
          <CardGrid count={3} />
        </div>
      </div>
    </div>
  );
}
