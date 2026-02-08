'use client';

import { useEffect, useState } from 'react';
import { isInV0Preview } from '@/lib/preview-mode';
import { X, ExternalLink } from 'lucide-react';

export function PreviewModeBanner() {
  const [isPreview, setIsPreview] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsPreview(isInV0Preview());
    
    // Check if user has dismissed this session
    const dismissed = sessionStorage.getItem('v0-preview-banner-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('v0-preview-banner-dismissed', 'true');
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  if (!isPreview || isDismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/95 backdrop-blur-sm text-amber-950 px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight">
              Browser Restriction Detected
            </p>
            <p className="text-xs text-amber-900 leading-tight mt-0.5">
              Authentication features are disabled in the embedded preview. Open in a new tab for full functionality.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleOpenInNewTab}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-950 text-amber-50 rounded-md hover:bg-amber-900 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-950 focus:ring-offset-2 focus:ring-offset-amber-500"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in New Tab
          </button>
          
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-md hover:bg-amber-600/50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-950"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
