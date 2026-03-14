'use client';

/**
 * ExplainabilityTimeline
 *
 * Renders a vertical timeline of market events: odds moves, anomaly detections,
 * Kalshi divergences, and velocity spikes for a given market snapshot.
 */

import type { TimelineEvent } from '@/lib/market-intelligence';

interface Props {
  events: TimelineEvent[];
}

const TYPE_STYLES: Record<string, { icon: string; color: string }> = {
  odds_move: { icon: '📈', color: 'text-blue-400' },
  anomaly_detected: { icon: '⚠️', color: 'text-red-400' },
  kalshi_diverge: { icon: '🔀', color: 'text-purple-400' },
  velocity_spike: { icon: '⚡', color: 'text-amber-400' },
  snapshot: { icon: '📷', color: 'text-white/40' },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function ExplainabilityTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-white/40">
        No timeline events yet
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-white/10" />

      {events.map((event, idx) => {
        const style = TYPE_STYLES[event.type] ?? TYPE_STYLES.snapshot;
        return (
          <div key={idx} className="relative flex gap-3 pb-4">
            {/* Timeline dot */}
            <div className="relative z-10 flex-shrink-0 w-7 h-7 rounded-full bg-black border border-white/15 flex items-center justify-center text-xs">
              {style.icon}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`text-xs font-medium ${style.color}`}>
                  {event.description}
                </span>
                <span className="text-xs text-white/30 shrink-0 font-mono">
                  {formatTime(event.timestamp)}
                </span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">{event.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
