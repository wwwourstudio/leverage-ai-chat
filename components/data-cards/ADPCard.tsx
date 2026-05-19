'use client';

import { memo } from 'react';
import { BarChart2, ChevronRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ADPCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, any>;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

interface ADPPlayerRow {
  rank: number;
  displayName: string;
  playerName?: string;
  adp: number;
  positions: string;
  team: string;
  valueDelta?: number;
  isValuePick?: boolean;
  auctionValue?: number;
}

// ── Position badge (sport-colored) ────────────────────────────────────────────

const POS_COLORS: Record<string, string> = {
  SP:  'text-cyan-400   bg-cyan-400/20   border-cyan-400/30',
  RP:  'text-violet-400 bg-violet-400/20 border-violet-400/30',
  C:   'text-yellow-400 bg-yellow-400/20 border-yellow-400/30',
  '1B':'text-pink-400   bg-pink-400/20   border-pink-400/30',
  '2B':'text-lime-400   bg-lime-400/20   border-lime-400/30',
  '3B':'text-amber-400  bg-amber-400/20  border-amber-400/30',
  SS:  'text-teal-400   bg-teal-400/20   border-teal-400/30',
  OF:  'text-sky-400    bg-sky-400/20    border-sky-400/30',
  DH:  'text-orange-400 bg-orange-400/20 border-orange-400/30',
  P:   'text-indigo-400 bg-indigo-400/20 border-indigo-400/30',
  QB:  'text-red-400    bg-red-400/20    border-red-400/30',
  RB:  'text-orange-400 bg-orange-400/20 border-orange-400/30',
  WR:  'text-indigo-400 bg-indigo-400/20 border-indigo-400/30',
  TE:  'text-pink-400   bg-pink-400/20   border-pink-400/30',
  K:   'text-gray-400   bg-gray-400/20   border-gray-400/30',
  DST: 'text-slate-400  bg-slate-400/20  border-slate-400/30',
};

function PosBadge({ positions }: { positions: string }) {
  // Show only the first listed position (most primary)
  const primary = positions.split(',')[0]?.trim() ?? positions;
  const c = POS_COLORS[primary] ?? 'text-gray-400 bg-gray-400/12 border-gray-400/30';
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider shrink-0',
      c,
    )}>
      {primary}
    </span>
  );
}

// ── Rank circle ───────────────────────────────────────────────────────────────

function RankCircle({ rank }: { rank: number }) {
  const c = rank <= 12
    ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-300 shadow-[0_0_8px_oklch(0.8_0.18_80/0.25)]'
    : rank <= 50
    ? 'bg-blue-400/15 border-blue-400/40 text-blue-300'
    : rank <= 150
    ? 'bg-sky-400/15 border-sky-400/40 text-sky-300'
    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-faint)]';
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-7 h-7 rounded-full border text-[9px] font-black tabular-nums shrink-0',
      c,
    )}>
      {rank}
    </span>
  );
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string; text: string; badgeCls: string; headerGrad: string }> = {
  optimal: { label: 'OPTIMAL',  dot: 'bg-blue-400', text: 'text-blue-400', badgeCls: 'bg-blue-500/15 border-blue-500/30 text-blue-400', headerGrad: 'from-blue-600/25 dark:via-cyan-800/10' },
  value:   { label: 'VALUE',    dot: 'bg-cyan-400',    text: 'text-cyan-400',    badgeCls: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',           headerGrad: 'from-cyan-600/25 dark:via-teal-800/10' },
  target:  { label: 'TARGET',   dot: 'bg-teal-400',    text: 'text-teal-400',    badgeCls: 'bg-teal-500/15 border-teal-500/30 text-teal-400',           headerGrad: 'from-teal-600/25 dark:via-cyan-800/10' },
  hot:     { label: 'HOT',      dot: 'bg-red-400',     text: 'text-red-400',     badgeCls: 'bg-red-500/15 border-red-500/30 text-red-400',              headerGrad: 'from-red-600/25 dark:via-rose-800/10' },
  edge:    { label: 'EDGE',     dot: 'bg-indigo-400',  text: 'text-indigo-400',  badgeCls: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',     headerGrad: 'from-indigo-600/25 dark:via-violet-800/10' },
};

// ── Main component ────────────────────────────────────────────────────────────

export const ADPCard = memo(function ADPCard({
  title,
  category,
  subcategory,
  data,
  status,
  onAnalyze,
  isHero,
}: ADPCardProps) {
  const s = STATUS_CFG[status] ?? STATUS_CFG.value;

  // Players are stored as a JSON string in data.players (set by the route)
  let players: ADPPlayerRow[] = [];
  try {
    players = typeof data.players === 'string'
      ? JSON.parse(data.players)
      : Array.isArray(data.players)
        ? data.players
        : [];
  } catch {
    players = [];
  }

  const source: string = typeof data.source === 'string' ? data.source : 'NFBC 2025 ADP';
  const totalInDataset: number | undefined = typeof data.totalInDataset === 'number' ? data.totalInDataset : undefined;

  const maxRows = isHero ? 12 : 8;
  const hasValuePicks = players.some(p => p.isValuePick);
  const hasAuctionValues = players.some(p => p.auctionValue != null);

  return (
    <div className="animate-fade-in-up">
      <article className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-300',
        isHero
          ? 'border-[var(--border-hover)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.15)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow,0_0_24px_oklch(0.3_0.06_280/0.12))]',
      )}>

        {/* ── Gradient header ──────────────────────────────────────────── */}
        <div className={cn('relative px-4 pt-4 pb-3 bg-gradient-to-br to-transparent border-b border-[var(--border-subtle)]', s.headerGrad)}>
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-32 h-16 bg-white/3 rounded-bl-full blur-2xl pointer-events-none" />

          {/* Status badge */}
          <div className="absolute top-3 right-3">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider',
              s.badgeCls,
            )}>
              <span className={cn('w-1 h-1 rounded-full animate-pulse', s.dot)} />
              {s.label}
            </span>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <BarChart2 className="w-3 h-3 text-[var(--text-muted)]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">{category}</span>
            <span className="text-[var(--text-faint)]">·</span>
            <span className="text-[9px] text-[var(--text-muted)] truncate">{subcategory}</span>
          </div>
          <h3 className={cn('font-black text-[var(--foreground)] leading-snug text-balance pr-20', isHero ? 'text-lg' : 'text-sm')}>
            {title}
          </h3>

          {/* Source tag */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[9px] text-[var(--text-faint)] font-bold">{source}</span>
            {totalInDataset && (
              <span className="text-[9px] text-[var(--text-faint)]">· {totalInDataset} players ranked</span>
            )}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="px-3 pb-4 pt-3 space-y-3">
          {/* Column headers */}
          {players.length > 0 && (
            <div className="flex items-center gap-2 px-2">
              <span className="w-7 shrink-0" />
              <span className="flex-1 text-[8px] font-black uppercase tracking-wider text-[var(--text-faint)]">Player</span>
              {hasAuctionValues && (
                <span className="w-10 text-right text-[8px] font-black uppercase tracking-wider text-[var(--text-faint)] shrink-0">$Val</span>
              )}
              <span className="w-12 text-right text-[8px] font-black uppercase tracking-wider text-[var(--text-faint)] shrink-0">
                {hasValuePicks ? 'ADP / Δ' : 'ADP'}
              </span>
            </div>
          )}

          {/* Player rows */}
          <div className="space-y-1">
            {players.slice(0, maxRows).map((p, idx) => {
              const isTopPick = p.rank <= 12;
              const rowBg = p.isValuePick
                ? 'bg-blue-500/8 border-blue-500/20'
                : idx === 0
                ? 'bg-indigo-500/8 border-indigo-500/15'
                : isTopPick
                ? 'bg-yellow-400/5 border-yellow-400/15'
                : idx % 2 === 0
                ? 'bg-[var(--bg-elevated)]/60 border-[var(--border-subtle)]'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]';

              return (
                <div
                  key={`${p.displayName}-${p.rank}`}
                  className={cn(
                    'flex items-center gap-2 px-2 py-2 rounded-xl border transition-colors hover:bg-[var(--bg-surface)]',
                    rowBg,
                  )}
                >
                  {/* Rank circle */}
                  <RankCircle rank={p.rank} />

                  {/* Name + team */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-black text-[var(--foreground)] truncate block">
                      {p.displayName}
                    </span>
                    {p.team && (
                      <span className="text-[9px] font-bold text-[var(--text-muted)]">{p.team}</span>
                    )}
                  </div>

                  {/* Sleeper badge */}
                  {p.isValuePick && (
                    <span className="text-[8px] font-black uppercase tracking-wider text-blue-400 bg-blue-400/10 border border-blue-400/25 px-1.5 py-0.5 rounded-full shrink-0">
                      SLEEPER
                    </span>
                  )}

                  {/* Position badge */}
                  {p.positions && <PosBadge positions={p.positions} />}

                  {/* Auction value chip */}
                  {hasAuctionValues && (
                    <span className={cn(
                      'inline-flex items-center justify-center w-10 text-right shrink-0',
                      p.auctionValue != null
                        ? 'text-[11px] font-black tabular-nums text-amber-400'
                        : 'text-[10px] text-[var(--text-faint)]',
                    )}>
                      {p.auctionValue != null ? `$${p.auctionValue}` : '—'}
                    </span>
                  )}

                  {/* ADP + delta */}
                  <div className="w-12 text-right shrink-0">
                    <span className="text-[13px] font-black tabular-nums text-cyan-400 block leading-tight">
                      {p.adp.toFixed(1)}
                    </span>
                    {p.valueDelta != null && p.valueDelta > 0 && (
                      <span className="text-[9px] font-black text-blue-400 tabular-nums leading-none block">
                        +{p.valueDelta.toFixed(0)}
                      </span>
                    )}
                    {p.valueDelta != null && p.valueDelta < -5 && (
                      <span className="text-[9px] font-black text-red-400 tabular-nums leading-none block">
                        {p.valueDelta.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {players.length === 0 && (
            <div className="py-6 text-center">
              <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-3">
                <BarChart2 className="w-5 h-5 text-[var(--text-faint)]" />
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                No ADP data matched — try broadening your search.
              </p>
            </div>
          )}

          {/* Footer: source info */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-[var(--text-faint)]" />
              <span className="text-[9px] font-bold text-[var(--text-faint)]">
                {source}{totalInDataset ? ` · ${totalInDataset} players ranked` : ''}
              </span>
            </div>
          </div>

          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600/20 to-violet-600/20 border border-indigo-500/30 text-xs font-bold text-indigo-300 hover:from-indigo-600/30 hover:to-violet-600/30 hover:text-[var(--foreground)] hover:border-indigo-500/50 transition-all duration-150"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Full Analysis
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </article>
    </div>
  );
});
