// page-client.tsx — compatibility shim. Canonical implementation in unified-platform.tsx.
// The explicit banner import registers the module factory in the Turbopack HMR runtime,
// resolving the stale chunk reference to database-status-banner from the old compiled output.
'use client';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DatabaseStatusBanner } from '@/components/database-status-banner';
export { default } from '@/app/unified-platform';
