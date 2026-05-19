'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/index/PageSkeleton';
import type { ServerDataProps } from '@/app/types/chat';

// dynamic + ssr:false must live in a Client Component (Next.js App Router rule).
// This thin wrapper is imported by the Server Component page.tsx so the full UI
// renders exclusively on the client, eliminating React hydration mismatch #418.
const UnifiedAIPlatform = dynamic(() => import('./page-client'), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

interface PageLoaderProps {
  serverData?: ServerDataProps;
}

export function PageLoader({ serverData }: PageLoaderProps) {
  return <UnifiedAIPlatform serverData={serverData} />;
}
