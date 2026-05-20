import { PageLoader } from './page-loader';
import type { ServerDataProps } from '@/app/types/chat';

export const dynamic = 'force-dynamic';

// Return safe empty defaults — the client hydrates all data via /api/init on mount.
// A self-referential HTTP fetch to localhost:3000/api/init fails in Vercel serverless
// environments when NEXT_PUBLIC_SITE_URL is not set, generating spurious error logs
// on every page load despite a 200 response.
function getServerData(): ServerDataProps {
  return {
    initialCards: [],
    initialInsights: null,
    userSession: null,
    serverTime: new Date().toISOString(),
    missingKeys: [],
    envErrors: [],
    dataSourcesUsed: [],
    fetchErrors: [],
  };
}

export default async function Page() {
  const serverData = getServerData();
  return <PageLoader serverData={serverData} />;
}
