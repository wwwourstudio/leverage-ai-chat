'use client';

export interface DatabaseStatusBannerProps {
  onDismiss?: () => void;
}

// Permanently suppressed — the /api/insights health-check was returning HTML
// instead of JSON and causing SyntaxError crashes on every page load.
export function DatabaseStatusBanner(_props: DatabaseStatusBannerProps): null {
  return null;
}
