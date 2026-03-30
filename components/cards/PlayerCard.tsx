'use client';

import { cn } from '@/lib/utils';

export interface PlayerResult {
  // From nfbc_adp table
  player_name?: string;
  display_name?: string;
  team?: string;
  positions?: string;
  adp?: number;
  rank?: number;
  value_delta?: number;
  is_value_pick?: boolean;
  auction_value?: number;
  sport?: string;
  // From statcast_daily (if joined or enriched)
  xwoba?: number;
  barrel_rate?: number;
  hard_hit_pct?: number;
  avg_exit_velocity?: number;
  // From projections (if enriched)
  dk_pts_mean?: number;
  matchup_score?: number;
}

interface PlayerCardProps {
  player: PlayerResult;
  onAsk?: (query: string) => void;
  variant?: 'dfs' | 'statcast' | 'default';
}

function statColor(val: number, good: number, great: number): string {
  if (val >= great) return 'text-blue-400';
  if (val >= good) return 'text-violet-400';
  return 'text-white/50';
}

export function PlayerCard({ player, onAsk, variant = 'default' }: PlayerCardProps) {
  const name = player.display_name ?? player.player_name ?? 'Unknown Player';
  const hasStatcast =
    player.xwoba != null ||
    player.barrel_rate != null ||
    player.hard_hit_pct != null ||
    player.avg_exit_velocity != null;

  return (
    <div className="bg-[oklch(0.11_0.01_280)] border border-[oklch(0.18_0.02_280)] rounded-xl p-4 flex flex-col gap-3 hover:border-[oklch(0.28_0.05_270)] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[13px] font-semibold text-white/90">{name}</div>
          <div className="text-[11px] text-[oklch(0.45_0.01_280)]">
            {[player.team, player.positions].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {player.adp != null && (
            <span className="text-[10px] text-[oklch(0.38_0.01_280)]">
              ADP {player.adp.toFixed(1)}
            </span>
          )}
          {player.is_value_pick && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
              Value Pick
            </span>
          )}
          {player.value_delta != null && !player.is_value_pick && (
            <span
              className={cn(
                'text-[11px] font-bold px-2 py-0.5 rounded',
                player.value_delta > 0
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'bg-[oklch(0.16_0.01_280)] text-white/40',
              )}
            >
              {player.value_delta > 0 ? '+' : ''}
              {player.value_delta.toFixed(1)} Δ
            </span>
          )}
        </div>
      </div>

      {/* DFS salary row */}
      {variant === 'dfs' && (player.dk_pts_mean != null || player.auction_value != null) && (
        <div className="flex gap-2 text-[11px]">
          {player.auction_value != null && (
            <span className="bg-[oklch(0.14_0.01_280)] rounded px-2 py-1 text-white/60">
              ${player.auction_value} auction
            </span>
          )}
          {player.dk_pts_mean != null && (
            <span className="bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1 text-blue-400 font-semibold ml-auto">
              {player.dk_pts_mean.toFixed(1)} DK pts
            </span>
          )}
          {player.matchup_score != null && (
            <span className="bg-violet-500/10 border border-violet-500/20 rounded px-2 py-1 text-violet-400">
              {player.matchup_score.toFixed(0)} matchup
            </span>
          )}
        </div>
      )}

      {/* Statcast stats grid */}
      {hasStatcast && (
        <div className="grid grid-cols-4 gap-1">
          {player.xwoba != null && (
            <div className="bg-[oklch(0.08_0.01_280)] rounded p-2 text-center">
              <div
                className={cn(
                  'text-[13px] font-bold tabular-nums',
                  statColor(player.xwoba, 0.33, 0.38),
                )}
              >
                {player.xwoba.toFixed(3)}
              </div>
              <div className="text-[9px] text-white/30 mt-0.5">xwOBA</div>
            </div>
          )}
          {player.barrel_rate != null && (
            <div className="bg-[oklch(0.08_0.01_280)] rounded p-2 text-center">
              <div
                className={cn(
                  'text-[13px] font-bold tabular-nums',
                  statColor(player.barrel_rate, 10, 18),
                )}
              >
                {player.barrel_rate.toFixed(1)}%
              </div>
              <div className="text-[9px] text-white/30 mt-0.5">Barrel%</div>
            </div>
          )}
          {player.hard_hit_pct != null && (
            <div className="bg-[oklch(0.08_0.01_280)] rounded p-2 text-center">
              <div
                className={cn(
                  'text-[13px] font-bold tabular-nums',
                  statColor(player.hard_hit_pct, 42, 52),
                )}
              >
                {player.hard_hit_pct.toFixed(1)}%
              </div>
              <div className="text-[9px] text-white/30 mt-0.5">HH%</div>
            </div>
          )}
          {player.avg_exit_velocity != null && (
            <div className="bg-[oklch(0.08_0.01_280)] rounded p-2 text-center">
              <div
                className={cn(
                  'text-[13px] font-bold tabular-nums',
                  statColor(player.avg_exit_velocity, 89, 92),
                )}
              >
                {player.avg_exit_velocity.toFixed(1)}
              </div>
              <div className="text-[9px] text-white/30 mt-0.5">Avg EV</div>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      {onAsk && (
        <button
          onClick={() =>
            onAsk(
              `Analyze ${name} (${player.team ?? ''}, ${player.positions ?? ''}) — Statcast profile, DFS value, and current outlook.`,
            )
          }
          className="w-full text-[11px] font-semibold text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/40 rounded-lg py-1.5 transition-colors"
        >
          Deep dive on {name} →
        </button>
      )}
    </div>
  );
}
