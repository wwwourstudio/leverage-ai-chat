'use client';

export interface DFSProjection {
  player_name: string;
  player_type: string;
  dk_pts_mean: number;
  matchup_score?: number;
  p10?: number;
  p50?: number;
  p90?: number;
  park_factor?: number;
  weather_adj?: number;
}

interface DFSLineupCardProps {
  lineup: DFSProjection[];
  totalProjected?: number;
  site?: string;
  onAsk?: (query: string) => void;
}

export function DFSLineupCard({ lineup, totalProjected, site = 'DK', onAsk }: DFSLineupCardProps) {
  const total =
    totalProjected ?? lineup.reduce((sum, p) => sum + (p.dk_pts_mean ?? 0), 0);

  return (
    <div className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-blue-400/70">
          {site} Projections
        </span>
        <div className="flex gap-3 text-[10px] text-[var(--text-muted)]">
          <span>{total.toFixed(1)} pts proj.</span>
        </div>
      </div>

      {/* Roster rows */}
      <div className="flex flex-col gap-1">
        {lineup.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-2 py-1 border-b border-[var(--border-subtle)] last:border-0"
          >
            <span className="text-[9px] font-mono text-violet-400/60 w-14 text-right uppercase shrink-0">
              {p.player_type}
            </span>
            <span className="flex-1 text-[12px] text-white/80 truncate">{p.player_name}</span>
            {p.p90 != null && (
              <span className="text-[10px] text-[var(--text-faint)] tabular-nums">
                P90: {p.p90.toFixed(1)}
              </span>
            )}
            <span className="text-[11px] font-semibold text-blue-400 tabular-nums w-14 text-right shrink-0">
              {p.dk_pts_mean?.toFixed(1)} pts
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      {onAsk && lineup.length > 0 && (
        <button
          onClick={() =>
            onAsk(
              `Evaluate this DFS lineup: ${lineup.map(p => p.player_name).join(', ')} — any swaps to improve ceiling or floor?`,
            )
          }
          className="w-full text-[11px] font-semibold text-blue-400 border border-blue-500/20 hover:border-blue-500/40 rounded-lg py-1.5 transition-colors"
        >
          Optimize this lineup →
        </button>
      )}
    </div>
  );
}
