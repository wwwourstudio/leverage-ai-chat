'use client';

import { useEffect, useState } from 'react';
import { Zap, AlertCircle, RotateCcw } from 'lucide-react';

interface AIProgressIndicatorProps {
  startTime?: number;
  stage?: 'analyzing' | 'processing' | 'finalizing' | 'slow' | 'reverifying';
}

export function AIProgressIndicator({ startTime, stage = 'analyzing' }: AIProgressIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState(stage);

  useEffect(() => {
    if (stage === 'reverifying') {
      setStatus('reverifying');
      return;
    }
    const start = startTime || Date.now();
    const interval = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(ms);
      if (ms < 3000) setStatus('analyzing');
      else if (ms < 8000) setStatus('processing');
      else if (ms < 15000) setStatus('finalizing');
      else setStatus('slow');
    }, 100);
    return () => clearInterval(interval);
  }, [startTime, stage]);

  const statusConfig = {
    analyzing:   { label: 'Grok 4 analyzing...', color: 'text-blue-400',   bar: 'bg-blue-500',   glow: 'shadow-blue-500/30' },
    processing:  { label: 'Processing patterns...', color: 'text-purple-400', bar: 'bg-purple-500', glow: 'shadow-purple-500/30' },
    finalizing:  { label: 'Generating insights...', color: 'text-indigo-400', bar: 'bg-indigo-500', glow: 'shadow-indigo-500/30' },
    slow:        { label: 'Deep analysis in progress...', color: 'text-orange-400', bar: 'bg-orange-500', glow: 'shadow-orange-500/20' },
    reverifying: { label: 'Re-verifying integrity...', color: 'text-amber-400', bar: 'bg-amber-400', glow: 'shadow-amber-500/20' },
  };

  const cfg = statusConfig[status] || statusConfig.analyzing;

  const progressPct = (() => {
    if (status === 'reverifying') return 80;
    if (elapsed < 3000) return (elapsed / 3000) * 35;
    if (elapsed < 8000) return 35 + ((elapsed - 3000) / 5000) * 40;
    if (elapsed < 15000) return 75 + ((elapsed - 8000) / 7000) * 20;
    return 95;
  })();

  const formatTime = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

  return (
    <div className="flex items-center gap-3">
      {/* Pulsing icon */}
      <div className={`relative flex-shrink-0 w-7 h-7 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center shadow-lg ${cfg.glow}`}>
        {status === 'reverifying'
          ? <RotateCcw className={`w-3.5 h-3.5 ${cfg.color} animate-spin`} style={{ animationDuration: '1.4s' }} />
          : status === 'slow'
            ? <AlertCircle className={`w-3.5 h-3.5 ${cfg.color} animate-pulse`} />
            : <Zap className={`w-3.5 h-3.5 ${cfg.color} animate-pulse`} />
        }
        {/* Outer ring pulse */}
        <span className={`absolute inset-0 rounded-lg border ${cfg.color.replace('text-', 'border-')}/30 animate-ping`} />
      </div>

      {/* Status + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
          <span className="text-[10px] text-gray-600 font-mono tabular-nums">{formatTime(elapsed)}</span>
        </div>
        {/* Thin animated progress bar */}
        <div className="h-[2px] w-full bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`relative h-full ${cfg.bar} rounded-full transition-all duration-300 ease-out overflow-hidden ${elapsed > 15000 ? 'animate-pulse' : ''}`}
            style={{ width: `${progressPct}%` }}
          >
            {progressPct < 95 && (
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            )}
          </div>
        </div>
        {elapsed > 10000 && (
          <p className="text-[10px] text-gray-600 mt-1">Complex query — high-precision analysis takes a moment</p>
        )}
      </div>
    </div>
  );
}
