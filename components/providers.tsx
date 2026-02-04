'use client';

import React from 'react';
import { ErrorBoundary } from './error-boundary';

/**
 * Client-side providers wrapper
 * Wraps children with error boundary and other client-side providers
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
