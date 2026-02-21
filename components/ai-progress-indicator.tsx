'use client';

import { useEffect, useState } from 'react';
import { Clock, Zap, AlertCircle } from 'lucide-react';

interface AIProgressIndicatorProps {
  startTime?: number;
  stage?: 'analyzing' | 'processing' | 'finalizing' | 'slow' | 'reverifying';
}

export function AIProgressIndicator({ startTime, stage = 'analyzing' }: AIProgressIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState(stage);

  useEffect(() => {
    // If an explicit stage is forced (e.g. reverifying), respect it
    if (stage === 'reverifying') {
      setStatus('reverifying');
      return;
    }
    const start = startTime || Date.now();
    const interval = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(ms);

      // Update status based on elapsed time
      if (ms < 3000) setStatus('analyzing');
      else if (ms < 8000) setStatus('processing');
      else if (ms < 15000) setStatus('finalizing');
      else setStatus('slow');
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, stage]);

  const getStatusMessage = () => {
    switch (status) {
      case 'analyzing':
        return 'Grok 4 neurons firing...';
      case 'processing':
        return 'Processing complex patterns...';
      case 'finalizing':
        return 'Generating insights...';
      case 'slow':
        return 'Heavy analysis in progress...';
      case 'reverifying':
        return 'Re-verifying response integrity...';
      default:
        return 'Working on it...';
    }
  };

  const getIcon = () => {
    if (status === 'reverifying') return <AlertCircle className="w-4 h-4 text-amber-400" />;
    if (status === 'slow') return <AlertCircle className="w-4 h-4 text-orange-400" />;
    if (elapsed > 5000) return <Clock className="w-4 h-4 text-blue-400" />;
    return <Zap className="w-4 h-4 text-purple-400" />;
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getProgressColor = () => {
    if (status === 'reverifying') return 'bg-amber-400';
    if (elapsed < 3000) return 'bg-blue-400';
    if (elapsed < 8000) return 'bg-purple-400';
    if (elapsed < 15000) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const getProgressWidth = () => {
    // Progress bar that fills gradually, then pulses at 100%
    if (elapsed < 3000) return (elapsed / 3000) * 30;
    if (elapsed < 8000) return 30 + ((elapsed - 3000) / 5000) * 40;
    if (elapsed < 15000) return 70 + ((elapsed - 8000) / 7000) * 25;
    return 95; // Stay at 95% when slow
  };

  return (
    <div className="space-y-3">
      {/* Status Message */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        <span className="text-sm font-semibold text-transparent bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text">
          {getStatusMessage()}
        </span>
        {getIcon()}
      </div>

      {/* Skeleton Lines */}
      <div className="space-y-2">
        <div className="h-2 bg-gray-800/60 rounded-full animate-pulse w-full"></div>
        <div className="h-2 bg-gray-800/60 rounded-full animate-pulse w-5/6"></div>
        <div className="h-2 bg-gray-800/60 rounded-full animate-pulse w-4/6"></div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Processing</span>
          <span className="font-mono">{formatTime(elapsed)}</span>
        </div>
        <div className="h-1 bg-gray-800/60 rounded-full overflow-hidden">
          <div
            className={`h-full ${getProgressColor()} transition-all duration-300 ease-out ${elapsed > 15000 ? 'animate-pulse' : ''
              }`}
            style={{ width: `${getProgressWidth()}%` }}
          />
        </div>
        {elapsed > 10000 && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Complex query detected - this may take a moment
          </p>
        )}
        {elapsed > 20000 && (
          <p className="text-xs text-orange-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Still processing - consider simplifying your query if this continues
          </p>
        )}
      </div>
    </div>
  );
}
