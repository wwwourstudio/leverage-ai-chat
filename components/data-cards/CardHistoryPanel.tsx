'use client';

import { memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface HistorySnapshot {
  ts: string;
  data: Record<string, any>;
}

interface CardHistoryPanelProps {
  cardKey: string;
  currentData: Record<string, any>;
}

function formatAge(isoTs: string): string {
  const diffMs = Date.now() - new Date(isoTs).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export const CardHistoryPanel = memo(function CardHistoryPanel({
  cardKey,
  currentData,
}: CardHistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<HistorySnapshot[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`card_history:${cardKey}`);
      setSnapshots(raw ? JSON.parse(raw) : []);
    } catch {}
  }, [cardKey]);

  // Identify up to 3 numeric keys that appear in current data
  const numericKeys = Object.entries(currentData)
    .filter(([k, v]) => k !== 'realData' && k !== 'status' && typeof v === 'number' && isFinite(v as number))
    .map(([k]) => k)
    .slice(0, 3);

  if (snapshots.length === 0 && numericKeys.length === 0) {
    return (
      <div className="animate-history-open border border-[var(--border-subtle)] rounded-b-xl bg-[var(--bg-overlay)] px-3 py-2.5 -mt-2">
        <p className="text-[10px] text-[var(--text-faint)] text-center">No history yet — revisit this card to build a record</p>
      </div>
    );
  }

  return (
    <div className="animate-history-open border border-[var(--border-subtle)] border-t-0 rounded-b-xl bg-[var(--bg-overlay)] px-3 py-2.5 -mt-2">
      <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--text-faint)] mb-2">History</div>

      {/* Sparkline charts for numeric metrics */}
      {numericKeys.length > 0 && (
        <div className="space-y-2 mb-3">
          {numericKeys.map(key => {
            const allValues = [
              currentData[key] as number,
              ...snapshots.map(s => s.data[key]).filter((v): v is number => typeof v === 'number' && isFinite(v)),
            ];
            const min = Math.min(...allValues);
            const max = Math.max(...allValues);
            const range = max - min || 1;

            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-semibold text-[var(--text-faint)] capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[9px] font-bold text-foreground tabular-nums">
                    {typeof currentData[key] === 'number'
                      ? Number.isInteger(currentData[key]) ? currentData[key] : (currentData[key] as number).toFixed(2)
                      : currentData[key]}
                  </span>
                </div>
                <div className="flex items-end gap-0.5 h-6">
                  {allValues.map((v, i) => {
                    const pct = ((v - min) / range) * 100;
                    return (
                      <div
                        key={i}
                        title={String(v)}
                        style={{ height: `${Math.max(pct, 8)}%` }}
                        className={cn(
                          'flex-1 rounded-sm transition-all duration-300',
                          i === 0 ? 'bg-blue-400' : 'bg-[var(--border-hover)]',
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timestamp list with delta */}
      {snapshots.length > 0 && (
        <div className="space-y-1">
          {snapshots.slice(0, 5).map((snap, i) => {
            // Compute net numeric delta vs current
            let ups = 0;
            let downs = 0;
            for (const [k, v] of Object.entries(currentData)) {
              const prev = snap.data[k];
              if (typeof v === 'number' && typeof prev === 'number' && v !== prev) {
                v > prev ? ups++ : downs++;
              }
            }
            const delta = ups > downs ? '↑' : downs > ups ? '↓' : '—';
            const deltaColor = ups > downs
              ? 'text-blue-400'
              : downs > ups ? 'text-red-400' : 'text-[var(--text-faint)]';

            return (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[9px] text-[var(--text-faint)]">{formatAge(snap.ts)}</span>
                <span className={cn('text-[9px] font-bold tabular-nums', deltaColor)}>{delta}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
