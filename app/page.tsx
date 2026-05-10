import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/index/PageSkeleton';

// Load the full UI client-only. This eliminates React error #418 (hydration
// mismatch) by ensuring the server never renders auth-dependent or
// localStorage-dependent HTML — the server always sends the same neutral
// skeleton, and the full UI renders exclusively on the client.
const UnifiedAIPlatform = dynamic(() => import('./page-client'), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function Page() {
  return <UnifiedAIPlatform />;
}
