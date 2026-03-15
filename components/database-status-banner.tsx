'use client';

export interface DatabaseStatusBannerProps {
  onDismiss?: () => void;
}

// v5 — permanently suppressed. The /api/insights health-check was returning
// HTML instead of JSON causing SyntaxError crashes on every page load.
// This component is no longer rendered anywhere in the app.
export function DatabaseStatusBanner(_props: DatabaseStatusBannerProps): null {
  return null;
}
