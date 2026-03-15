'use client';

interface DatabaseStatusBannerProps {
  onDismiss?: () => void;
}

// This banner is permanently suppressed — the /api/insights health-check route
// is not required for core app functionality and was causing JSON parse errors.
export function DatabaseStatusBanner(_props: DatabaseStatusBannerProps) {
  return null;
}
