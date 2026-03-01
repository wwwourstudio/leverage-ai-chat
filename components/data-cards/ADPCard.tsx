'use client';

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

// ── Position badge (matches FantasyCard colours) ───────────────────────────────

const POS_COLORS: Record<string, string> = {
  SP:  'text-cyan-400   bg-cyan-400/12   border-cyan-400/30',
  RP:  'text-violet-400 bg-violet-400/12 border-violet-400/30',
  C:   'text-yellow-400 bg-yellow-400/12 border-yellow-400/30',
  '1B':'text-pink-400   bg-pink-400/12   border-pink-400/30',
  '2B':'text-lime-400   bg-lime-400/12   border-lime-400/30',
  '3B':'text-amber-400  bg-amber-400/12  border-amber-400/30',
  SS:  'text-teal-400   bg-teal-400/12   border-teal-400/30',
  OF:  'text-sky-400    bg-sky-400/12    border-sky-400/30',
  DH:  'text-orange-400 bg-orange-400/12 border-orange-400/30',
  P:   'text-indigo-400 bg-indigo-400/12 border-indigo-400/30',
};

function PosBadge({ positions }: { positions: string }) {
  // Show only the first listed position (most primary)
  const primary = positions.split(',')[0]?.trim() ?? positions;
  const c = POS_COLORS[primary] ?? 'text-gray-400 bg-gray-400/12 border-gray-400/30';
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider shrink-0',
      c,
    )}>
      {primary}
    </span>
  );
}

// ── Rank circle ───────────────────────────────────────────────────────────────

function RankCircle({ rank }: { rank: number }) {
  const c = rank <= 12
    ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-300'
    : rank <= 50
    ? 'bg-emerald-400/15 border-emerald-400/40 text-emerald-300'
    : rank <= 150
    ? 'bg-sky-400/15 border-sky-400/40 text-sky-300'
    : 'bg-[oklch(0.10_0.01_280)] border-[oklch(0.18_0.01_280)] text-[oklch(0.38_0.01_280)]';
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-6 h-6 rounded-full border text-[9px] font-black tabular-nums shrink-0',
      c,
    )}>
      {rank}
    </span>
  );
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string; text: string; headerGrad: string }> = {
  optimal: { label: 'OPTIMAL',  dot: 'bg-emerald-400', text: 'text-emerald-400', headerGrad: 'from-emerald-600/75 via-teal-700/55 to-emerald-900/35' },
  value:   { label: 'VALUE',    dot: 'bg-cyan-400',    text: 'text-cyan-400',    headerGrad: 'from-cyan-600/75 via-teal-700/55 to-cyan-900/35' },
  target:  { label: 'TARGET',   dot: 'bg-teal-400',    text: 'text-teal-400',    headerGrad: 'from-teal-600/75 via-cyan-700/55 to-teal-900/35' },
  hot:     { label: 'HOT',      dot: 'bg-red-400',     text: 'text-red-400',     headerGrad: 'from-red-600/75 via-rose-700/55 to-red-900/35' },
  edge:    { label: 'EDGE',     dot: 'bg-indigo-400',  text: 'text-indigo-400',  headerGrad: 'from-indigo-600/75 via-violet-700/55 to-indigo-900/35' },
};

// ── Main component ────────────────────────────────────────────────────────────

export function ADPCard({
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
        'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.09_0.012_280)] border transition-all duration-300',
        isHero
          ? 'border-[oklch(0.28_0.025_260)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.15)]'
          : 'border-[oklch(0.18_0.016_280)] hover:border-[oklch(0.28_0.02_280)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.08)]',
      )}>
        {/* Gradient header */}
        <div className={cn('relative px-4 pt-3.5 pb-3 bg-gradient-to-br', s.headerGrad)}>
          {/* Status badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', s.dot)} />
            <span className={cn('text-[9px] font-black uppercase tracking-widest', s.text)}>{s.label}</span>
          </div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <BarChart2 className="w-3 h-3 text-white/60" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{category}</span>
            <span className="text-white/30">·</span>
            <span className="text-[9px] text-white/50 truncate">{subcategory}</span>
          </div>
          <h3 className={cn('font-black text-white leading-snug text-balance pr-16', isHero ? 'text-lg' : 'text-sm')}>
            {title}
          </h3>
        </div>

        {/* Body */}
        <div className="px-4 pb-4 pt-3 space-y-3">
          {/* Column headers */}
          {players.length > 0 && (
            <div className="flex items-center gap-2 px-2">
              <span className="w-6 shrink-0" />
              <span className="flex-1 text-[9px] font-black uppercase tracking-wider text-[oklch(0.38_0.01_280)]">Player</span>
              {hasAuctionValues && (
                <span className="w-8 text-right text-[9px] font-black uppercase tracking-wider text-[oklch(0.38_0.01_280)] shrink-0">$Val</span>
              )}
              <span className="w-10 text-right text-[9px] font-black uppercase tracking-wider text-[oklch(0.38_0.01_280)] shrink-0">
                {hasValuePicks ? 'ADP/Δ' : 'ADP'}
              </span>
            </div>
          )}

          {/* Player rows */}
          <div className="space-y-1">
            {players.slice(0, maxRows).map((p, idx) => {
              const isTopPick = p.rank <= 12;
              const rowBg = p.isValuePick
                ? 'bg-emerald-500/10 border-emerald-500/25'
                : idx === 0
                ? 'bg-teal-500/8 border-teal-500/20'
                : isTopPick
                ? 'bg-yellow-400/5 border-yellow-400/15'
                : 'bg-[oklch(0.08_0.01_280)] border-[oklch(0.15_0.01_280)]';

              return (
                <div
                  key={`${p.displayName}-${p.rank}`}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors hover:bg-[oklch(0.12_0.01_280)]',
                    rowBg,
                  )}
                >
                  <RankCircle rank={p.rank} />
                  <span className="text-xs font-bold text-white flex-1 truncate min-w-0">
                    {p.displayName}
                    {p.team && (
                      <span className="text-[10px] font-normal text-[oklch(0.42_0.01_280)] ml-1">{p.team}</span>
                    )}
                  </span>
                  {p.isValuePick && (
                    <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-400/12 border border-emerald-400/30 px-1 py-0.5 rounded shrink-0">
                      SLEEPER
                    </span>
                  )}
                  {p.positions && <PosBadge positions={p.positions} />}
                  {hasAuctionValues && (
                    <span className="text-[10px] font-bold tabular-nums text-amber-400 w-8 text-right shrink-0">
                      {p.auctionValue != null ? `$${p.auctionValue}` : '—'}
                    </span>
                  )}
                  <div className="w-10 text-right shrink-0">
                    <span className="text-[11px] font-black tabular-nums text-cyan-400">
                      {p.adp.toFixed(1)}
                    </span>
                    {p.valueDelta != null && p.valueDelta > 0 && (
                      <span className="block text-[8px] font-bold text-emerald-400 tabular-nums leading-none">
                        +{p.valueDelta.toFixed(0)}
                      </span>
                    )}
                    {p.valueDelta != null && p.valueDelta < -5 && (
                      <span className="block text-[8px] font-bold text-amber-400 tabular-nums leading-none">
                        {p.valueDelta.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {players.length === 0 && (
            <p className="text-xs text-[oklch(0.45_0.01_280)] text-center py-3">
              No ADP data matched — try broadening your search.
            </p>
          )}

          {/* Footer: source + dataset size */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-[oklch(0.32_0.01_280)]" />
              <span className="text-[9px] font-bold text-[oklch(0.32_0.01_280)]">
                {source}{totalInDataset ? ` · ${totalInDataset} players ranked` : ''}
              </span>
            </div>
          </div>

          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] text-xs font-semibold text-[oklch(0.46_0.01_280)] hover:text-white hover:bg-[oklch(0.14_0.015_280)] hover:border-[oklch(0.26_0.02_280)] transition-all duration-150"
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
}
