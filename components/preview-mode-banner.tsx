'use client';

import { useEffect, useState } from 'react';
import { isInV0Preview } from '@/lib/preview-mode';
import { AlertCircle, ExternalLink } from 'lucide-react';

export function PreviewModeBanner() {
  const [isPreview, setIsPreview] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsPreview(isInV0Preview());
  }, []);

  if (!isPreview || !isVisible) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-500/90 to-amber-600/90 backdrop-blur-sm border-b border-orange-400/20 shadow-lg">
      <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-sm font-semibold text-white">
              v0 Preview Mode
            </span>
            <span className="text-xs sm:text-sm text-white/90">
              Authentication & database features disabled due to browser restrictions
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium text-white transition-colors border border-white/20"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open in New Tab</span>
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
            aria-label="Dismiss banner"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
