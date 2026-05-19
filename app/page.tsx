import { PageLoader } from './page-loader';
import type { ServerDataProps } from '@/app/types/chat';

export const dynamic = 'force-dynamic';

async function getServerData(): Promise<ServerDataProps> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/init`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      return {
        initialCards: [],
        initialInsights: null,
        userSession: null,
        serverTime: new Date().toISOString(),
        missingKeys: [],
        envErrors: [],
        dataSourcesUsed: [],
        fetchErrors: ['Failed to fetch initial data'],
      };
    }
    const data = await res.json();
    return {
      initialCards: data.initialCards || [],
      initialInsights: data.insights || null,
      userSession: data.userSession || null,
      serverTime: new Date().toISOString(),
      missingKeys: data.missingKeys || [],
      envErrors: data.envErrors || [],
      dataSourcesUsed: data.dataSourcesUsed || [],
      fetchErrors: data.fetchErrors || [],
    };
  } catch (err) {
    console.error('[v0] Error fetching server data:', err);
    return {
      initialCards: [],
      initialInsights: null,
      userSession: null,
      serverTime: new Date().toISOString(),
      missingKeys: [],
      envErrors: [],
      dataSourcesUsed: [],
      fetchErrors: ['Error fetching initial data'],
    };
  }
}

export default async function Page() {
  const serverData = await getServerData();
  return <PageLoader serverData={serverData} />;
}
