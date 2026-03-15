// page-client.tsx — re-export shim with explicit banner import to register
// a fresh Turbopack module factory for database-status-banner in the HMR runtime.
'use client';
import '@/components/database-status-banner';
export { default } from './unified-platform';
