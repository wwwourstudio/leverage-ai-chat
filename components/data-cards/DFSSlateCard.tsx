'use client';

import { memo } from 'react';
import { Trophy, ChevronRight, TrendingUp, Users, Target, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlatePlayer {
  position:     string;
  player:       string;
  team:         string;
  salary:       string;
  projection:   string;
  ownership:    string;
  dkValue:      string;
  matchupScore: string;
  cardCategory: string;
  stackTeam?:   string;
  /** False when player is unavailable for this contest (IL / scratched / no game / not in confirmed lineup). */
  isPlaying?:   boolean;
  confirmedStarter?: boolean;
}

interface DFSSlateCardProps {
  title:       string;
  data:        Record<string, any>;
  onAnalyze?:  () => void;
  isHero?:     boolean;
}

// Position color map — keyed by position abbreviation
const POS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SP:   { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/35' },
  RP:   { bg: 'bg-sky-500/20',    text: 'text-sky-300',    border: 'border-sky-500/35' },
  C:    { bg: 'bg-teal-500/20',   text: 'text-teal-300',   border: 'border-teal-500/35' },
  '1B': { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/35' },
  '2B': { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/35' },
  '3B': { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/35' },
  SS:   { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/35' },
  OF:   { bg: 'bg-amber-500/20',  text: 'text-amber-300',  border: 'border-amber-500/35' },
  UTIL: { bg: 'bg-slate-500/20',  text: 'text-slate-300',  border: 'border-slate-500/35' },
  P:    { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/35' },
};

function PositionBadge({ position }: { position: string }) {
  const colors = POS_COLORS[position] ?? { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/35' };
  return (
    <span className={cn(
      'inline-flex items-center justify-center rounded-lg border font-black text-[9px] uppercase px-1.5 py-0.5 min-w-[30px] shrink-0',
      colors.bg, colors.text, colors.border,
    )}>
      {position}
    </span>
  );
}

/** Letter-grade value badge */
function ValueGrade({ score }: { score: number }) {
  const grade = score >= 5.5 ? 'A' : score >= 4.5 ? 'B' : score >= 3.5 ? 'C' : 'D';
  const color = grade === 'A'
    ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/35'
    : grade === 'B'
    ? 'text-blue-300 bg-blue-500/15 border-blue-500/35'
    : grade === 'C'
    ? 'text-amber-300 bg-amber-500/15 border-amber-500/35'
    : 'text-red-300 bg-red-500/15 border-red-500/35';
  return (
    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-lg border font-black text-[10px] shrink-0', color)}>
      {grade}
    </span>
  );
}

function formatSlateStartTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' });
}

export const DFSSlateCard = memo(function DFSSlateCard({
  title,
  data,
  onAnalyze,
  isHero = false,
}: DFSSlateCardProps) {
  // Defense-in-depth: never render players who aren't playing, even if the
  // builder somehow let them through.
  const rawSlate: SlatePlayer[] = Array.isArray(data.slate) ? data.slate : [];
  const slate = rawSlate.filter(p => p.isPlaying !== false);
  const topStack: string | undefined = data.topStack;
  const totalProjPts: string = data.totalProjPts ?? '—';
  const totalSalary:  string = data.totalSalary  ?? '—';
  const gamesCount:   string = data.gamesCount   ?? '—';
  const capValid:     boolean = data.capValid !== false; // default true if not provided
  const playingTodayCount: number = typeof data.playingTodayCount === 'number' ? data.playingTodayCount : slate.length;
  const slateLabel:   string | undefined = data.slateLabel;
  const draftGroupId: number | undefined = typeof data.draftGroupId === 'number' ? data.draftGroupId : undefined;
  const slateStart:   string = formatSlateStartTime(data.slateStartDate);
  const degradedMode: boolean = data.degradedMode === true;
  const degradedReason: string | undefined = data.degradedReason;
  const insufficientPool: boolean = data.insufficientPool === true;
  const slateGames: Array<{ gameId: number; awayTeamAbbr: string; homeTeamAbbr: string; startTime: string; awayPitcher?: string; homePitcher?: string }> =
    Array.isArray(data.slateGames) ? data.slateGames : [];

  // Parse total salary as a number for the cap bar
  const totalSalaryNum = parseInt(String(totalSalary).replace(/[^0-9]/g, ''), 10) || 0;
  const totalSalaryFull = totalSalaryNum < 1000 ? totalSalaryNum * 1000 : totalSalaryNum; // handle "$49k" → 49000
  const capPct = Math.min(100, (totalSalaryFull / 50000) * 100);

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-300',
      isHero
        ? 'border-[var(--border-hover)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.15)]'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow,0_0_24px_oklch(0.3_0.06_280/0.12))]',
    )}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="relative px-4 pt-4 pb-3 bg-gradient-to-br from-indigo-600/25 via-violet-800/10 to-transparent border-b border-[var(--border-subtle)]">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-40 h-20 bg-violet-500/6 rounded-bl-full blur-3xl pointer-events-none" />

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wide">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            REAL
          </span>
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
        </div>

        <div className="flex items-center gap-1.5 mb-1.5">
          <Users className="w-3 h-3 text-white/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/60">MLB</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50">DraftKings Optimal</span>
        </div>
        <h3 className={cn('font-black text-white leading-snug pr-20', isHero ? 'text-lg' : 'text-sm')}>
          {title}
        </h3>

        {/* Slate identity row */}
        {slateLabel && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300">
              {slateLabel}
            </span>
            {gamesCount !== '—' && (
              <>
                <span className="text-white/30 text-[9px]">·</span>
                <span className="text-[9px] text-white/70 font-semibold">{gamesCount} games</span>
              </>
            )}
            {slateStart && (
              <>
                <span className="text-white/30 text-[9px]">·</span>
                <span suppressHydrationWarning className="inline-flex items-center gap-1 text-[9px] text-white/60">
                  <Clock className="w-2.5 h-2.5" />
                  {slateStart}
                </span>
              </>
            )}
            {draftGroupId != null && (
              <span className="text-[8px] text-white/30 tabular-nums">#{draftGroupId}</span>
            )}
          </div>
        )}

        {/* Summary pills */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {totalSalary !== '—' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black tabular-nums">
              {totalSalary} used
            </span>
          )}
          {totalProjPts !== '—' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black tabular-nums">
              {totalProjPts} pts
            </span>
          )}
          {!slateLabel && gamesCount !== '—' && (
            <span className="text-[9px] text-white/50">{gamesCount} games</span>
          )}
        </div>

        {/* Stack callout */}
        {topStack && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[9px] font-black text-indigo-300 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            {topStack}
          </div>
        )}
      </div>

      {/* ── Degraded-mode banner ────────────────────────────────────────── */}
      {(degradedMode || insufficientPool) && (
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/8">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 mb-0.5">
            {insufficientPool ? 'Slate too thin' : 'Projection only'}
          </div>
          <div className="text-[10px] text-amber-100/70 leading-snug">
            {insufficientPool
              ? 'Not enough confirmed available players in this contest pool to build a full lineup. Wait for lineups to lock and try again.'
              : 'DraftKings contest feed unavailable — lineup built from LeverageMetrics projections. Salary and ownership are modeled estimates, not DK-validated.'}
            {degradedReason ? ` (${degradedReason})` : ''}
          </div>
        </div>
      )}

      {/* ── Slate games ────────────────────────────────────────────────── */}
      {slateGames.length > 0 && (
        <div className="mx-3 mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5">
          <p className="text-[8px] font-black uppercase tracking-wider text-[var(--text-faint)] mb-2">Games on Slate</p>
          <div className="grid grid-cols-2 gap-1.5">
            {slateGames.map(g => (
              <div key={g.gameId} className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-1.5">
                <div className="flex items-center gap-1 text-[11px] font-black text-white">
                  <span>{g.awayTeamAbbr}</span>
                  <span className="text-white/30 text-[8px]">@</span>
                  <span>{g.homeTeamAbbr}</span>
                  {g.startTime && (
                    <span suppressHydrationWarning className="ml-auto text-[8px] font-semibold text-white/40 tabular-nums">
                      {new Date(g.startTime).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}
                    </span>
                  )}
                </div>
                {(g.awayPitcher || g.homePitcher) && (
                  <div className="text-[8px] text-[var(--text-faint)] truncate mt-0.5">
                    {g.awayPitcher?.split(' ').pop() ?? 'TBD'} vs. {g.homePitcher?.split(' ').pop() ?? 'TBD'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Column header ──────────────────────────────────────────────── */}
      {slate.length > 0 && (
        <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
          <span className="w-[30px] shrink-0" />
          <span className="flex-1 text-[8px] font-black uppercase tracking-wider text-[var(--text-faint)]">Player</span>
          <span className="text-[8px] font-black uppercase tracking-wider text-[var(--text-faint)] text-right">Salary</span>
          <span className="w-[36px] text-[8px] font-black uppercase tracking-wider text-[var(--text-faint)] text-right ml-2">Proj</span>
          <span className="w-[36px] text-[8px] font-black uppercase tracking-wider text-[var(--text-faint)] text-right">Own</span>
          <span className="w-6 shrink-0" />
        </div>
      )}

      {/* ── Lineup rows ────────────────────────────────────────────────── */}
      <div className="pb-4">
        {slate.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-5 h-5 text-[var(--text-faint)]" />
            </div>
            <p className="text-[11px] text-[var(--text-faint)]">
              {degradedMode || insufficientPool ? 'No lineup posted — see banner above.' : 'Lineup data unavailable'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]/50">
            {slate.map((p, i) => {
              const isPitcher = p.position === 'SP' || p.position === 'RP';
              const dkValNum  = parseFloat(p.dkValue) || 0;
              const isStack   = Boolean(p.stackTeam);
              const ownNum    = parseFloat(p.ownership) || 0;

              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 group/row hover:bg-[var(--bg-elevated)]/50 transition-colors',
                    i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-elevated)]/30',
                  )}
                >
                  {/* Position badge */}
                  <PositionBadge position={p.position} />

                  {/* Player name + team */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-white text-[12px] truncate">{p.player}</span>
                      <span className="text-[10px] font-bold text-white/40 shrink-0">{p.team}</span>
                      {isStack && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 uppercase tracking-wide shrink-0">
                          STK
                        </span>
                      )}
                    </div>
                    {/* Ownership progress bar */}
                    {ownNum > 0 && (
                      <div className="h-0.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden mt-1 w-full max-w-[80px]">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500',
                            ownNum >= 35 ? 'bg-red-400' : ownNum >= 20 ? 'bg-amber-400' : ownNum >= 10 ? 'bg-blue-400' : 'bg-emerald-400'
                          )}
                          style={{ width: `${Math.min(100, ownNum)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Salary */}
                  <span className="text-[11px] font-black text-amber-400 tabular-nums shrink-0">{p.salary}</span>

                  {/* Projection */}
                  <div className="flex items-center gap-0.5 w-[36px] justify-end shrink-0">
                    <Target className="w-2.5 h-2.5 text-emerald-500/60 shrink-0" />
                    <span className="text-[11px] font-black text-emerald-400 tabular-nums">{p.projection}</span>
                  </div>

                  {/* Ownership % */}
                  <span className="text-[10px] text-white/40 tabular-nums w-[36px] text-right shrink-0">{p.ownership}</span>

                  {/* Grade */}
                  <ValueGrade score={dkValNum} />
                </div>
              );
            })}
          </div>
        )}

        {/* ── Cap status bar ──────────────────────────────────────────── */}
        {slate.length > 0 && totalSalary !== '—' && (
          <div className="mx-3 mt-3 mb-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Salary Cap
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black tabular-nums text-amber-400">
                  {totalSalary} / $50k
                </span>
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider',
                  capValid
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/25 text-red-400',
                )}>
                  {capValid ? '✓ CAP VALID' : '✗ OVER CAP'}
                </span>
              </div>
            </div>
            <div className="h-1 rounded-full bg-[var(--bg-surface)] overflow-hidden mt-1">
              <div
                className={cn('h-full rounded-full transition-all duration-700',
                  capValid ? 'bg-gradient-to-r from-indigo-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-rose-400'
                )}
                style={{ width: `${capPct}%` }}
              />
            </div>
            {playingTodayCount > 0 && playingTodayCount < slate.length && (
              <div className="text-[9px] text-amber-400 font-bold">
                {playingTodayCount}/{slate.length} players confirmed playing today
              </div>
            )}
            {playingTodayCount === slate.length && slate.length > 0 && (
              <div className="text-[9px] text-emerald-400 font-bold">
                All {slate.length} players confirmed playing today ✓
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        {onAnalyze && (
          <div className="px-4 pt-3">
            <button
              onClick={onAnalyze}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600/20 to-violet-600/20 border border-indigo-500/30 text-xs font-bold text-indigo-300 hover:from-indigo-600/30 hover:to-violet-600/30 hover:text-white hover:border-indigo-500/50 transition-all duration-150"
              aria-label="View full DFS analysis"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              View Full Analysis
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
});
