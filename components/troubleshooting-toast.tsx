'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, XCircle, ExternalLink, X, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TroubleshootingInfo {
  issue: string;
  solution: string;
  steps: string[];
  documentationLink?: string;
}

interface TroubleshootingToastProps {
  error: string;
  troubleshooting?: TroubleshootingInfo;
  onDismiss?: () => void;
  autoHide?: boolean;
}

export function TroubleshootingToast({ 
  error, 
  troubleshooting, 
  onDismiss,
  autoHide = false 
}: TroubleshootingToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [autoHide, onDismiss]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 shadow-2xl backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <h4 className="text-sm font-semibold text-red-400">Data Fetch Failed</h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="h-6 w-6 p-0 hover:bg-red-500/20"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <p className="text-xs text-foreground/70 mb-2">{error}</p>

            {troubleshooting && (
              <div className="space-y-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs font-medium text-red-300 hover:text-red-200 underline"
                >
                  {isExpanded ? 'Hide' : 'Show'} troubleshooting steps
                </button>

                {isExpanded && (
                  <div className="space-y-2 pt-2 border-t border-red-500/20">
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1">Issue:</p>
                      <p className="text-xs text-foreground/60">{troubleshooting.issue}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1">Solution:</p>
                      <p className="text-xs text-foreground/60">{troubleshooting.solution}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1">Steps:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs text-foreground/60">
                        {troubleshooting.steps.map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    {troubleshooting.documentationLink && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="w-full h-8 text-xs mt-2"
                      >
                        <a 
                          href={troubleshooting.documentationLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Full Documentation
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.reload()}
                className="h-7 text-xs flex-1"
              >
                <RefreshCw className="w-3 h-3 mr-1.5" />
                Retry
              </Button>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="h-7 text-xs flex-1"
              >
                <a href="/api/health" target="_blank" rel="noopener noreferrer">
                  <CheckCircle className="w-3 h-3 mr-1.5" />
                  Check Status
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage troubleshooting toast state
 */
export function useTroubleshootingToast() {
  const [toast, setToast] = useState<{
    error: string;
    troubleshooting?: TroubleshootingInfo;
  } | null>(null);

  const showToast = (error: string, troubleshooting?: TroubleshootingInfo) => {
    setToast({ error, troubleshooting });
  };

  const hideToast = () => {
    setToast(null);
  };

  return {
    toast,
    showToast,
    hideToast,
  };
}
