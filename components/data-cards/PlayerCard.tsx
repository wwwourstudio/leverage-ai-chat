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
  if (val >= great) return 'text-amber-400';
  if (val >= good) return 'text-blue-400';
  return 'text-white/50';
}

// Determine tier based on ADP rank and value
function getTier(player: PlayerResult): { label: string; style: string; gradient: string } {
  const adp = player.adp ?? Infinity;
  const isValue = player.is_value_pick;

  if (isValue || (player.value_delta != null && player.value_delta >= 10)) {
    return {
      label: 'VALUE',
      style: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
      gradient: 'from-emerald-600/25 dark:via-emerald-800/10 to-transparent',
    };
  }
  if (adp <= 24) {
    return {
      label: 'ELITE',
      style: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
      gradient: 'from-amber-600/25 dark:via-orange-800/10 to-transparent',
    };
  }
  if (adp <= 75) {
    return {
      label: 'TOP',
      style: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
      gradient: 'from-blue-600/25 dark:via-blue-800/10 to-transparent',
    };
  }
  return {
    label: 'ROSTER',
    style: 'bg-slate-500/10 border-slate-500/25 text-slate-400',
    gradient: 'from-slate-600/20 dark:via-slate-800/10 to-transparent',
  };
}

export function PlayerCard({ player, onAsk, variant = 'default' }: PlayerCardProps) {
  const name = player.display_name ?? player.player_name ?? 'Unknown Player';
  const tier = getTier(player);
  const hasStatcast =
    player.xwoba != null ||
    player.barrel_rate != null ||
    player.hard_hit_pct != null ||
    player.avg_exit_velocity != null;

  const valueDeltaPositive = player.value_delta != null && player.value_delta > 0;

  return (
    <div className="group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow,0_0_40px_rgb(0_0_0/0.3))] transition-all duration-300 flex flex-col">
      {/* Ambient tier gradient */}
      <div
        className={cn('absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none', tier.gradient)}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-3 p-4">
        {/* Header: player name + tier + team */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[15px] font-black text-white/95 truncate leading-tight">{name}</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {[player.team, player.positions].filter(Boolean).join(' · ')}
            </div>
          </div>
          {/* Tier badge */}
          <span className={cn(
            'text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border shrink-0',
            tier.style,
          )}>
            {tier.label}
          </span>
        </div>

        {/* ADP rank + value delta hero row */}
        <div className="flex items-center gap-2">
          {player.adp != null && (
            <div className="flex-1 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">ADP Rank</p>
              <p className="text-2xl font-black tabular-nums text-foreground/90">
                #{player.adp.toFixed(1)}
              </p>
            </div>
          )}

          {player.value_delta != null && (
            <div className={cn(
              'flex-1 rounded-2xl border p-3 text-center',
              valueDeltaPositive
                ? 'bg-emerald-500/12 border-emerald-500/25'
                : 'bg-red-500/10 border-red-500/20',
            )}>
              <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Value Δ</p>
              <p className={cn(
                'text-2xl font-black tabular-nums',
                valueDeltaPositive ? 'text-emerald-400' : 'text-red-400',
              )}>
                {valueDeltaPositive ? '+' : ''}{player.value_delta.toFixed(1)}
              </p>
            </div>
          )}

          {player.is_value_pick && player.value_delta == null && (
            <div className="flex-1 rounded-2xl bg-emerald-500/12 border border-emerald-500/25 p-3 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Signal</p>
              <p className="text-sm font-black text-emerald-400">VALUE</p>
            </div>
          )}
        </div>

        {/* DFS salary row */}
        {variant === 'dfs' && (player.dk_pts_mean != null || player.auction_value != null) && (
          <div className="flex gap-2">
            {player.auction_value != null && (
              <div className="flex-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2.5 text-center">
                <div className="text-base font-black text-foreground tabular-nums">
                  ${player.auction_value}
                </div>
                <div className="text-[9px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">Auction</div>
              </div>
            )}
            {player.dk_pts_mean != null && (
              <div className="flex-1 rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5 text-center">
                <div className="text-base font-black text-blue-400 tabular-nums">
                  {player.dk_pts_mean.toFixed(1)}
                </div>
                <div className="text-[9px] text-blue-400/60 mt-0.5 uppercase tracking-wide">DK pts</div>
              </div>
            )}
            {player.matchup_score != null && (
              <div className="flex-1 rounded-xl bg-violet-500/10 border border-violet-500/20 p-2.5 text-center">
                <div className="text-base font-black text-violet-400 tabular-nums">
                  {player.matchup_score.toFixed(0)}
                </div>
                <div className="text-[9px] text-violet-400/60 mt-0.5 uppercase tracking-wide">Matchup</div>
              </div>
            )}
          </div>
        )}

        {/* Statcast metrics grid */}
        {hasStatcast && (
          <div className={cn(
            'grid gap-1.5',
            [player.xwoba, player.barrel_rate, player.hard_hit_pct, player.avg_exit_velocity].filter(v => v != null).length >= 3
              ? 'grid-cols-4'
              : 'grid-cols-2',
          )}>
            {player.xwoba != null && (
              <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2.5 text-center">
                <div className={cn('text-base font-black tabular-nums', statColor(player.xwoba, 0.33, 0.38))}>
                  {player.xwoba.toFixed(3)}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">xwOBA</div>
              </div>
            )}
            {player.barrel_rate != null && (
              <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2.5 text-center">
                <div className={cn('text-base font-black tabular-nums', statColor(player.barrel_rate, 10, 18))}>
                  {player.barrel_rate.toFixed(1)}%
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">Barrel%</div>
              </div>
            )}
            {player.hard_hit_pct != null && (
              <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2.5 text-center">
                <div className={cn('text-base font-black tabular-nums', statColor(player.hard_hit_pct, 42, 52))}>
                  {player.hard_hit_pct.toFixed(1)}%
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">HH%</div>
              </div>
            )}
            {player.avg_exit_velocity != null && (
              <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2.5 text-center">
                <div className={cn('text-base font-black tabular-nums', statColor(player.avg_exit_velocity, 89, 92))}>
                  {player.avg_exit_velocity.toFixed(1)}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">Avg EV</div>
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
            className="w-full text-[11px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-xl py-2 transition-all duration-150"
          >
            Deep dive on {name} →
          </button>
        )}
      </div>
    </div>
  );
}
