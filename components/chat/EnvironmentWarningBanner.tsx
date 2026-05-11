'use client';

import { AlertTriangle } from 'lucide-react';

interface EnvironmentWarningBannerProps {
  missingKeys: string[];
}

export function EnvironmentWarningBanner({ missingKeys }: EnvironmentWarningBannerProps) {
  if (missingKeys.length === 0) return null;

  return (
    <div className="absolute top-0 left-0 right-0 bg-amber-600/90 backdrop-blur-sm border-b border-amber-500/50 px-4 py-2 z-50 flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-white flex-shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-semibold">Missing API Keys:</span> {missingKeys.join(', ')}. Some features may not work properly.
      </div>
      <a
        href="/admin/setup"
        className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md transition-colors whitespace-nowrap"
      >
        Configure →
      </a>
    </div>
  );
}
