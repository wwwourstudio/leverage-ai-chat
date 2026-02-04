'use client';

import { ReactNode } from 'react';
import { SystemStatusBanner } from './system-status-banner';

/**
 * Wrapper component that adds system status banner to any page
 * Usage: Wrap your page content with <WithSystemStatus>...</WithSystemStatus>
 */
export function WithSystemStatus({ children }: { children: ReactNode }) {
  return (
    <>
      <SystemStatusBanner />
      {children}
    </>
  );
}
