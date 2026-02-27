'use client';

import { useEffect, useState } from 'react';
import { Zap, AlertCircle, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIProgressIndicatorProps {
  startTime?: number;
  stage?: 'analyzing' | 'processing' | 'finalizing' | 'slow' | 'reverifying';
  onCancel?: () => void;
}

const STATUS_CONFIG = {
  analyzing:   { label: 'Grok 4 analyzing...',         color: 'text-blue-400',   bar: 'bg-blue-500',    ring: 'border-blue-500/30' },
  processing:  { label: 'Processing patterns...',       color: 'text-purple-400', bar: 'bg-purple-500',  ring: 'border-purple-500/30' },
  finalizing:  { label: 'Generating insights...',       color: 'text-indigo-400', bar: 'bg-indigo-500',  ring: 'border-indigo-500/30' },
  slow:        { label: 'Deep analysis in progress...', color: 'text-amber-400',  bar: 'bg-amber-500',   ring: 'border-amber-500/30' },
  reverifying: { label: 'Re-verifying integrity...',    color: 'text-amber-300',  bar: 'bg-amber-400',   ring: 'border-amber-500/30' },
} as const;

export function AIProgressIndicator({ startTime, stage = 'analyzing', onCancel }: AIProgressIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<keyof typeof STATUS_CONFIG>(stage);

  useEffect(() => {
    if (stage === 'reverifying') { setStatus('reverifying'); return; }
    const start = startTime ?? Date.now();
    const id = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(ms);
      if      (ms < 3000)  setStatus('analyzing');
      else if (ms < 8000)  setStatus('processing');
      else if (ms < 15000) setStatus('finalizing');
      else                 setStatus('slow');
    }, 120);
    return () => clearInterval(id);
  }, [startTime, stage]);

  const cfg = STATUS_CONFIG[status];

  const pct = (() => {
    if (status === 'reverifying') return 80;
    if (elapsed < 3000)  return (elapsed / 3000) * 35;
    if (elapsed < 8000)  return 35 + ((elapsed - 3000) / 5000) * 40;
    if (elapsed < 15000) return 75 + ((elapsed - 8000) / 7000) * 20;
    return 95;
  })();

  const fmt = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

  return (
    <div className="flex items-start gap-3 py-0.5">

      {/* Pulsing icon */}
      <div className={cn(
        'relative flex-shrink-0 w-7 h-7 rounded-lg bg-[oklch(0.11_0.012_280)] border flex items-center justify-center',
        cfg.ring,
      )}>
        {status === 'reverifying'
          ? <RotateCcw className={cn('w-3.5 h-3.5 animate-spin', cfg.color)} style={{ animationDuration: '1.4s' }} />
          : status === 'slow'
            ? <AlertCircle className={cn('w-3.5 h-3.5 animate-pulse', cfg.color)} />
            : <Zap className={cn('w-3.5 h-3.5 animate-pulse', cfg.color)} />
        }
        <span className={cn('absolute inset-0 rounded-lg border animate-ping opacity-60', cfg.ring)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-600 font-mono tabular-nums">{fmt(elapsed)}</span>

            {/* Cancel button — always available while loading */}
            {onCancel && (
              <button
                onClick={onCancel}
                aria-label="Cancel analysis"
                className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-red-400 transition-colors font-medium px-1.5 py-0.5 rounded hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-[2px] w-full bg-[oklch(0.16_0.015_280)] rounded-full overflow-hidden">
          <div
            className={cn(
              'relative h-full rounded-full transition-[width] duration-300 ease-out overflow-hidden',
              cfg.bar,
              elapsed > 15000 && 'animate-pulse',
            )}
            style={{ width: `${pct}%` }}
          >
            {pct < 95 && (
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
            )}
          </div>
        </div>

        {elapsed > 10000 && (
          <p className="text-[10px] text-gray-600 mt-1.5 leading-tight">
            Complex query — high-precision analysis takes a moment.{' '}
            {onCancel && <button onClick={onCancel} className="text-red-400/70 hover:text-red-400 transition-colors underline underline-offset-2">Cancel</button>}
          </p>
        )}
      </div>
    </div>
  );
}
