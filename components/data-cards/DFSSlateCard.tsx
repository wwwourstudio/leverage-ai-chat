'use client';

import { memo } from 'react';
import { ChevronRight, TrendingUp, Users, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnifiedCardShell } from './UnifiedCardShell';
import { CardsEmptyState, CardsErrorState } from './CardStates';

interface SlatePlayer {
  position: string;
  player: string;
  team: string;
  salary: string;
  projection: string;
  ownership: string;
  dkValue: string;
  stackTeam?: string;
  isPlaying?: boolean;
}

interface DFSSlateCardProps {
  title: string;
  data: Record<string, any>;
  onAnalyze?: () => void;
  isHero?: boolean;
}

const POS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SP: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/35' },
  RP: { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/35' },
  C: { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/35' },
  '1B': { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/35' },
  '2B': { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/35' },
  '3B': { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/35' },
  SS: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/35' },
  OF: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/35' },
  UTIL: { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/35' },
  P: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/35' },
};

function PositionBadge({ position }: { position: string }) {
  const colors = POS_COLORS[position] ?? { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/35' };
  return <span className={cn('inline-flex items-center justify-center rounded-lg border font-black text-[9px] uppercase px-1.5 py-0.5 min-w-[30px] shrink-0', colors.bg, colors.text, colors.border)}>{position}</span>;
}

function ValueGrade({ score }: { score: number }) {
  const grade = score >= 5.5 ? 'A' : score >= 4.5 ? 'B' : score >= 3.5 ? 'C' : 'D';
  const color = grade === 'A' ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/35' : grade === 'B' ? 'text-blue-300 bg-blue-500/15 border-blue-500/35' : grade === 'C' ? 'text-amber-300 bg-amber-500/15 border-amber-500/35' : 'text-red-300 bg-red-500/15 border-red-500/35';
  return <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-lg border font-black text-[10px] shrink-0', color)}>{grade}</span>;
}

export const DFSSlateCard = memo(function DFSSlateCard({ title, data, onAnalyze, isHero = false }: DFSSlateCardProps) {
  const rawSlate: SlatePlayer[] = Array.isArray(data.slate) ? data.slate : [];
  const slate = rawSlate.filter(p => p.isPlaying !== false);

  if (data.error) {
    return <CardsErrorState message={String(data.error)} />;
  }
  if (!Array.isArray(data.slate)) {
    return <CardsEmptyState message="DFS slate is still loading. Try again in a moment." />;
  }

  const totalSalary = data.totalSalary ?? '—';
  const totalProjPts = data.totalProjPts ?? '—';
  const topStack = data.topStack as string | undefined;
  const capValid = data.capValid !== false;

  return (
    <UnifiedCardShell className={cn('overflow-hidden', isHero && 'border-[var(--ui-card-border-hover)] shadow-[var(--ui-shadow-elevated)]')} interactive={!isHero}>
      <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-indigo-600/25 via-violet-800/10 to-transparent border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5 mb-1.5 text-white/70">
          <Users className="w-3 h-3" />
          <span className="text-[9px] font-black uppercase tracking-widest">DFS</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px]">DraftKings Optimal</span>
        </div>
        <h3 className={cn('font-black text-white leading-snug', isHero ? 'text-lg' : 'text-sm')}>{title}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black">{totalSalary} used</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black">{totalProjPts} pts</span>
          {topStack && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-black">{topStack}</span>}
        </div>
      </div>

      <div className="px-3 pt-3 pb-2 grid grid-cols-[32px,1fr,60px,48px,36px] gap-2 text-[8px] font-black uppercase tracking-wider text-[var(--text-faint)]">
        <span />
        <span>Player</span><span className="text-right">Salary</span><span className="text-right">Proj</span><span className="text-right">Val</span>
      </div>

      {slate.length === 0 ? (
        <div className="px-4 pb-4"><CardsEmptyState message="No playable DFS lineup available for this slate yet." /></div>
      ) : (
        <div className="pb-3 divide-y divide-[var(--border-subtle)]/50">
          {slate.map((p, i) => {
            const ownNum = parseFloat(p.ownership) || 0;
            const dkValNum = parseFloat(p.dkValue) || 0;
            return (
              <div key={`${p.player}-${i}`} className={cn('flex items-center gap-2 px-3 py-2.5', i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-elevated)]/30')}>
                <PositionBadge position={p.position} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><span className="font-black text-white text-[12px] truncate">{p.player}</span><span className="text-[10px] font-bold text-white/40">{p.team}</span></div>
                  <div className="mt-1 h-0.5 rounded-full bg-[var(--bg-elevated)] max-w-[84px] overflow-hidden">
                    <div className={cn('h-full rounded-full', ownNum >= 35 ? 'bg-red-400' : ownNum >= 20 ? 'bg-amber-400' : ownNum >= 10 ? 'bg-blue-400' : 'bg-emerald-400')} style={{ width: `${Math.min(100, ownNum)}%` }} />
                  </div>
                </div>
                <span className="text-[11px] font-black text-amber-400 tabular-nums">{p.salary}</span>
                <div className="flex items-center gap-0.5 w-[48px] justify-end"><Target className="w-2.5 h-2.5 text-emerald-500/60" /><span className="text-[11px] font-black text-emerald-400 tabular-nums">{p.projection}</span></div>
                <ValueGrade score={dkValNum} />
              </div>
            );
          })}
        </div>
      )}

      <div className="mx-3 mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-muted)]">Salary Cap</span>
          <span className={cn('font-black', capValid ? 'text-emerald-400' : 'text-red-400')}>{capValid ? 'Valid' : 'Over cap'}</span>
        </div>
      </div>

      {onAnalyze && (
        <div className="px-4 pb-4">
          <button onClick={onAnalyze} className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600/20 to-violet-600/20 border border-indigo-500/30 text-xs font-bold text-indigo-300 hover:text-white transition-all">
            <TrendingUp className="w-3.5 h-3.5" />View Full DFS Analysis<ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </UnifiedCardShell>
  );
});
