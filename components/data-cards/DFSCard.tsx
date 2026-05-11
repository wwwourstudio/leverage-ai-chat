'use client';

import { memo } from 'react';
import Image from 'next/image';
import { Award, Users, Gamepad2, ChevronRight, TrendingUp, Star, Zap, Link2, BarChart2, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ESPN_TEAM_ABBR } from '@/lib/constants';

/** Resolve ESPN CDN team logo URL from team name + optional sport slug. Returns null if not found. */
function getTeamLogoAbbr(teamName: string): string | null {
  if (!teamName) return null;
  return ESPN_TEAM_ABBR[teamName.trim()] ?? null;
}

function TeamLogo({ team, sport, size = 24 }: { team: string; sport?: string; size?: number }) {
  const abbr = getTeamLogoAbbr(team);
  if (!abbr) return null;
  // Derive sport slug for ESPN CDN
  const slug = sport?.includes('basketball') ? 'nba'
    : sport?.includes('baseball') ? 'mlb'
    : sport?.includes('hockey') ? 'nhl'
    : 'nfl';
  const src = `https://a.espncdn.com/i/teamlogos/${slug}/500/${abbr}.png`;
  return (
    <Image
      src={src}
      alt={team}
      width={size}
      height={size}
      className="rounded-full object-contain shrink-0"
      unoptimized
    />
  );
}

interface DFSCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, any>;
  status: string;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
  isHero?: boolean;
}

const statusConfig: Record<string, {
  label: string; dotCls: string; textCls: string; badgeCls: string; headerGrad: string;
}> = {
  optimal: {
    label: 'OPTIMAL',
    dotCls: 'bg-sky-400',
    textCls: 'text-sky-400',
    badgeCls: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
    headerGrad: 'from-indigo-600/25 via-violet-800/10',
  },
  value: {
    label: 'VALUE',
    dotCls: 'bg-emerald-400',
    textCls: 'text-emerald-400',
    badgeCls: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    headerGrad: 'from-indigo-600/25 via-violet-800/10',
  },
  elite: {
    label: 'ELITE',
    dotCls: 'bg-purple-400',
    textCls: 'text-purple-400',
    badgeCls: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
    headerGrad: 'from-violet-600/25 via-purple-800/10',
  },
  hot: {
    label: 'HOT',
    dotCls: 'bg-red-400',
    textCls: 'text-red-400',
    badgeCls: 'bg-red-500/15 border-red-500/30 text-red-300',
    headerGrad: 'from-red-600/25 via-rose-800/10',
  },
};

/** Letter-grade value badge based on salary efficiency (proj pts / salary * 1000) */
function ValueGrade({ score }: { score: number }) {
  const grade = score >= 1.4 ? 'A' : score >= 1.3 ? 'B' : score >= 1.2 ? 'C' : score >= 1.1 ? 'D' : 'F';
  const color =
    grade === 'A' ? 'text-violet-300 bg-violet-500/15 border-violet-500/35'
    : grade === 'B' ? 'text-blue-300 bg-blue-500/15 border-blue-500/35'
    : grade === 'C' ? 'text-slate-300 bg-slate-500/15 border-slate-500/35'
    : grade === 'D' ? 'text-[var(--text-muted)] bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
    : 'text-red-400/70 bg-red-500/8 border-red-500/20';
  return (
    <div className={cn('flex flex-col items-center justify-center w-12 h-12 rounded-xl border font-black shrink-0', color)}>
      <span className="text-xl leading-none">{grade}</span>
      <span className="text-[7px] uppercase tracking-wider opacity-70">grade</span>
    </div>
  );
}

/** Ownership progress bar with tier badge */
function OwnershipBar({ pct }: { pct: number }) {
  const tier = pct >= 35 ? { label: 'CHALKY',   barCls: 'from-red-500 to-rose-400',      textCls: 'text-red-400',    badgeCls: 'bg-red-500/10 border-red-500/25 text-red-400' }
    : pct >= 20          ? { label: 'POPULAR',   barCls: 'from-amber-500 to-yellow-400',  textCls: 'text-amber-400',  badgeCls: 'bg-amber-500/10 border-amber-500/25 text-amber-400' }
    : pct >= 10          ? { label: 'MODERATE',  barCls: 'from-blue-500 to-indigo-400',   textCls: 'text-blue-400',   badgeCls: 'bg-blue-500/10 border-blue-500/25 text-blue-400' }
    :                      { label: 'LEVERAGE',  barCls: 'from-emerald-500 to-teal-400',  textCls: 'text-emerald-400', badgeCls: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3 text-[var(--text-faint)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Field Ownership</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[11px] font-black tabular-nums', tier.textCls)}>{pct.toFixed(1)}%</span>
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider', tier.badgeCls)}>
            <Star className="w-2 h-2" />{tier.label}
          </span>
        </div>
      </div>
      <div className="h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden mt-1">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', tier.barCls)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

/** Value efficiency bar: pts/$1K — cap at 8.0 for full fill */
function ValueEfficiencyBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 8) * 100);
  // League avg marker at 4.0 pts/$K = 50%
  const leagueAvgPct = 50;
  const barCls = score >= 5.5 ? 'from-emerald-500 to-teal-400'
    : score >= 4.5            ? 'from-blue-500 to-indigo-400'
    : score >= 3.5            ? 'from-amber-500 to-yellow-400'
    :                           'from-red-500 to-rose-400';
  const textCls = score >= 5.5 ? 'text-emerald-400' : score >= 4.5 ? 'text-blue-400' : score >= 3.5 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-3 h-3 text-[var(--text-faint)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Value Efficiency</span>
        </div>
        <span className={cn('text-[11px] font-black tabular-nums', textCls)}>{score.toFixed(2)}x pts/$K</span>
      </div>
      <div className="relative h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden mt-1">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', barCls)}
          style={{ width: `${pct}%` }}
        />
        {/* League avg tick */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/30"
          style={{ left: `${leagueAvgPct}%` }}
        />
      </div>
      <div className="flex justify-end">
        <span className="text-[8px] text-[var(--text-faint)]">league avg →</span>
      </div>
    </div>
  );
}

/** Ceiling/floor range bar */
function CeilingFloorBar({ ceiling, floor, projection }: { ceiling: number; floor: number; projection: number }) {
  const range = ceiling - floor;
  if (range <= 0) return null;
  const projPct = range > 0 ? Math.min(100, ((projection - floor) / range) * 100) : 50;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Outcome Range</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-red-400 tabular-nums">Floor {floor.toFixed(1)}</span>
          <span className="text-[var(--text-faint)] text-[9px]">–</span>
          <span className="text-[10px] font-bold text-emerald-400 tabular-nums">Ceil {ceiling.toFixed(1)}</span>
        </div>
      </div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500/20 via-amber-400/20 to-emerald-500/20 overflow-visible">
        {/* Track */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/30 via-amber-400/20 to-emerald-500/30" />
        {/* Min tick */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-red-400/70" />
        {/* Max tick */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-emerald-400/70" />
        {/* Projection marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-indigo-400 shadow-[0_0_6px_oklch(0.6_0.2_280/0.6)] transition-all duration-500"
          style={{ left: `calc(${projPct}% - 5px)` }}
        />
      </div>
      <div className="flex items-center justify-center">
        <span className="text-[9px] text-[var(--text-muted)]">Proj: <span className="text-white font-black">{projection.toFixed(1)}</span></span>
      </div>
    </div>
  );
}

/** Matchup score meter */
function MatchupMeter({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const colorCls = score >= 70
    ? 'from-emerald-500 to-teal-400'
    : score >= 50
    ? 'from-amber-500 to-yellow-400'
    : 'from-red-500 to-rose-400';
  const textCls = score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  const label = score >= 70 ? 'GREAT' : score >= 50 ? 'OK' : 'TOUGH';

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Target className="w-3 h-3 text-[var(--text-faint)]" />
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Matchup Score</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[13px] font-black tabular-nums', textCls)}>{Math.round(score)}</span>
          <span className="text-[var(--text-faint)] text-[10px]">/100</span>
          <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wide',
            score >= 70
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : score >= 50
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              : 'bg-red-500/15 border-red-500/30 text-red-400',
          )}>
            {label}
          </span>
        </div>
      </div>
      <div className="h-1 rounded-full bg-[var(--bg-surface)] overflow-hidden mt-1">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', colorCls)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export const DFSCard = memo(function DFSCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
  isHero = false,
}: DFSCardProps) {
  const cfg = statusConfig[status] || statusConfig.value;

  const {
    player, team, position, sport,
    targetGame, targetPlayers, description,
    platforms, tips, salary, projection, ownership,
    boomCeiling, bustFloor, realData,
    cardCategory, recentDKPts, recentGamesAvg,
    homeDKAvg, roadDKAvg, homeSplitGames, roadSplitGames,
    stackTeam, stackType, stackPartners, playerId, isStack, // structural — exclude from overflow
    matchupScore, parkFactor,
    ...rest
  } = data;

  const matchupScoreNum = matchupScore ? parseFloat(String(matchupScore)) : null;
  const parkFactorNum = parkFactor ? parseFloat(String(parkFactor)) : null;

  const projNum      = parseFloat(String(projection  || '').replace(/[^0-9.]/g, ''));
  const salaryNum    = parseFloat(String(salary      || '').replace(/[^0-9.]/g, ''));
  const ownershipNum = parseFloat(String(ownership   || '').replace(/[^0-9.]/g, ''));
  const valueScore   = projNum > 0 && salaryNum > 0 ? projNum / (salaryNum / 1000) : null;

  const ceilingNum = parseFloat(String(boomCeiling || '').replace(/[^0-9.]/g, ''));
  const floorNum   = parseFloat(String(bustFloor   || '').replace(/[^0-9.]/g, ''));
  const hasRangeBar = !isNaN(ceilingNum) && ceilingNum > 0 && !isNaN(floorNum) && floorNum >= 0 && !isNaN(projNum) && projNum > 0;

  const hasCorePlay  = Boolean(player && (salary || projection || ownership));
  const isStackPlay  = Boolean(isStack || position === 'STACK');
  const stackPlayers = Array.isArray(targetPlayers) ? targetPlayers : targetPlayers ? [targetPlayers] : [];

  const extraKeys = Object.keys(rest).filter(k =>
    !['status', 'sport', 'insight', 'source', 'focus', 'value', 'dkValue', 'matchupScore', 'parkFactor', 'hrProb'].includes(k) && rest[k] != null
  );

  // Resolve gradient: prefer prop, fall back to status config
  const headerGrad = gradient || cfg.headerGrad;

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-300',
      isHero
        ? 'border-[var(--border-hover)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.15)]'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow,0_0_24px_oklch(0.3_0.06_280/0.12))]',
    )}>

      {/* ══ ZONE 1: PLAYER HEADER (gradient) ════════════════════════════ */}
      <div className={cn('relative px-4 pr-10 pt-4 pb-3 bg-gradient-to-br to-transparent border-b border-[var(--border-subtle)]', headerGrad)}>
        {/* Decorative glow orb */}
        <div className="absolute top-0 right-0 w-40 h-20 bg-white/3 rounded-bl-full blur-3xl pointer-events-none" />

        {/* Breadcrumb + status badges inline — no absolute positioning to avoid conflict with outer overlay badges */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Gamepad2 className="w-3 h-3 text-white/60 shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/60">{category}</span>
            <span className="text-white/30">·</span>
            <span className="text-[9px] text-white/50 truncate">{subcategory}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {realData && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold uppercase tracking-wide">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            )}
            {cardCategory && (
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider',
                cardCategory === 'value'      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                cardCategory === 'matchup'    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' :
                cardCategory === 'contrarian' ? 'bg-violet-500/15 border-violet-500/30 text-violet-400' :
                cardCategory === 'chalk'      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-faint)]'
              )}>
                {cardCategory === 'value'      ? 'VALUE' :
                 cardCategory === 'matchup'    ? 'MATCHUP' :
                 cardCategory === 'contrarian' ? 'CONTRARIAN' :
                 cardCategory === 'chalk'      ? 'CHALK' : 'OPTIMAL'}
              </span>
            )}
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider',
              cfg.badgeCls,
            )}>
              <span className={cn('w-1 h-1 rounded-full animate-pulse', cfg.dotCls)} />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className={cn('font-black text-white leading-snug text-balance', isHero ? 'text-lg' : 'text-sm')}>
          {title}
        </h3>

        {/* Player spotlight — show name prominently when it's a core play */}
        {hasCorePlay && !isStackPlay && (
          <div className="mt-2 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                {position && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-[9px] font-black text-white/80 uppercase tracking-wider">
                    {position}
                  </span>
                )}
                {team && (
                  <span className="text-[10px] font-bold text-white/50">{team}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {team && (
                  <TeamLogo team={team} sport={sport} size={28} />
                )}
                <span className={cn('font-black text-white leading-tight', isHero ? 'text-2xl' : 'text-xl')}>
                  {player}
                </span>
              </div>
            </div>
            {valueScore !== null && <ValueGrade score={valueScore} />}
          </div>
        )}

        {/* Stack headline */}
        {isStackPlay && (
          <div className="mt-2 flex items-center gap-1.5">
            {(stackTeam || team) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] font-black text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Stack: {stackTeam ?? team}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ══ ZONE 2: STATS GRID ═══════════════════════════════════════════ */}
      <div className="px-4 pt-3 pb-0 space-y-3">

        {/* Core play stat tiles */}
        {hasCorePlay && !isStackPlay && (
          <div className="grid grid-cols-3 gap-1.5">
            {/* Salary tile */}
            {salary && salary !== '—' && salary !== '' && salary !== '$0' && (
              <div className="flex flex-col items-center gap-1 rounded-xl bg-violet-500/8 border border-violet-500/20 px-2 py-2.5">
                <span className="text-[8px] font-black uppercase tracking-wider text-violet-400/70">Salary</span>
                <span className="text-base font-black text-violet-300 tabular-nums leading-tight">{String(salary)}</span>
                {salaryNum > 0 && (
                  <div className="w-full mt-1">
                    <div className="h-0.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400"
                        style={{ width: `${Math.min(100, (salaryNum / 50000) * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Projection tile */}
            {projection && (
              <div className="flex flex-col items-center gap-1 rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-2 py-2.5">
                <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400/70">Proj Pts</span>
                <span className="text-base font-black text-emerald-400 tabular-nums leading-tight">{String(projection)}</span>
                {!isNaN(projNum) && projNum > 0 && (
                  <div className="w-full mt-1">
                    {/* Bar vs league avg ~20 pts */}
                    <div className="h-0.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                        style={{ width: `${Math.min(100, (projNum / 40) * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Ownership tile */}
            {ownership && (
              <div className="flex flex-col items-center gap-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-2.5">
                <span className="text-[8px] font-black uppercase tracking-wider text-[var(--text-muted)]">Own%</span>
                <span className="text-base font-black text-white tabular-nums leading-tight">{String(ownership)}</span>
                {!isNaN(ownershipNum) && ownershipNum > 0 && (
                  <div className="w-full mt-1">
                    <div className="h-0.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500',
                          ownershipNum >= 35 ? 'bg-red-400' : ownershipNum >= 20 ? 'bg-amber-400' : ownershipNum >= 10 ? 'bg-blue-400' : 'bg-emerald-400'
                        )}
                        style={{ width: `${Math.min(100, ownershipNum)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stack play: simple stat tiles */}
        {isStackPlay && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/6 px-3 py-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">Stack Recommendation</span>
            </div>
            {targetGame && (
              <p className="text-sm font-bold text-white">{targetGame}</p>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {projection && (
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-1.5 py-2">
                  <span className="text-[7px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Proj Pts</span>
                  <span className="text-sm font-black text-emerald-400 tabular-nums">{String(projection)}</span>
                </div>
              )}
              {ownership && (
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-1.5 py-2">
                  <span className="text-[7px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Own %</span>
                  <span className="text-sm font-black text-white tabular-nums">{String(ownership)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isStackPlay && !hasCorePlay && !salary && !projection && !ownership && (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex flex-col items-center gap-1 rounded-xl bg-violet-500/8 border border-violet-500/20 px-2 py-2.5">
              <span className="text-[8px] font-black uppercase tracking-wider text-violet-400/70">Salary Cap</span>
              <span className="text-[11px] font-bold text-[var(--text-faint)]">Ask about a slate</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-2 py-2.5">
              <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400/70">Target</span>
              <span className="text-[11px] font-bold text-[var(--text-faint)]">or matchup</span>
            </div>
          </div>
        )}

        {/* Grade summary row */}
        {data.gradesSummary && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Lineup</span>
            <span className="text-[10px] font-bold text-white/80 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full">
              {String(data.gradesSummary)}
            </span>
          </div>
        )}
      </div>

      {/* ══ ZONE 3: ANALYTICS ═══════════════════════════════════════════ */}
      <div className="px-4 pb-4 pt-2 space-y-2.5">

        {/* Value efficiency bar (player cards only) */}
        {!isStackPlay && hasCorePlay && valueScore !== null && (
          <ValueEfficiencyBar score={valueScore} />
        )}

        {/* Ownership bar */}
        {!isStackPlay && !isNaN(ownershipNum) && ownershipNum > 0 && (
          <div className="px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
            <OwnershipBar pct={ownershipNum} />
          </div>
        )}

        {/* Ceiling / floor range bar */}
        {hasRangeBar ? (
          <CeilingFloorBar ceiling={ceilingNum} floor={floorNum} projection={projNum} />
        ) : (boomCeiling || bustFloor) && (
          <div className="grid grid-cols-2 gap-1.5">
            {boomCeiling && (
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-2 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/70">Ceiling</span>
                <span className="text-sm font-black text-emerald-400 tabular-nums">{String(boomCeiling)}</span>
              </div>
            )}
            {bustFloor && (
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-red-500/8 border border-red-500/20 px-2 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400/70">Floor</span>
                <span className="text-sm font-black text-red-400 tabular-nums">{String(bustFloor)}</span>
              </div>
            )}
          </div>
        )}

        {/* Matchup score meter */}
        {matchupScoreNum !== null && !isNaN(matchupScoreNum) && (
          <MatchupMeter score={matchupScoreNum} />
        )}

        {/* Recent Form sparkline */}
        {recentDKPts && (() => {
          const pts = String(recentDKPts).split(',').map(Number).filter(n => !isNaN(n));
          if (pts.length === 0) return null;
          const max = Math.max(...pts, 1);
          return (
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Recent Form</span>
                {recentGamesAvg && (
                  <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{recentGamesAvg}</span>
                )}
              </div>
              <div className="flex items-end gap-1 h-8">
                {pts.map((pt, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className={cn('w-full rounded-sm',
                        pt >= max * 0.7 ? 'bg-emerald-500' : pt >= max * 0.4 ? 'bg-blue-500' : 'bg-red-500/60'
                      )}
                      style={{ height: `${Math.round((pt / max) * 24) + 4}px` }}
                    />
                    <span className="text-[7px] text-[var(--text-faint)] tabular-nums">{pt.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Home / road splits */}
        {(homeDKAvg || roadDKAvg) && (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-2.5 text-center">
              <span className="text-[8px] font-black uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                Home {homeSplitGames ? `· ${homeSplitGames}G` : ''}
              </span>
              <div className="flex items-baseline justify-center gap-0.5">
                <span className="text-base font-black text-white tabular-nums">{homeDKAvg ?? '—'}</span>
                <span className="text-[9px] text-[var(--text-faint)]">DK</span>
              </div>
            </div>
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-2.5 text-center">
              <span className="text-[8px] font-black uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                Road {roadSplitGames ? `· ${roadSplitGames}G` : ''}
              </span>
              <div className="flex items-baseline justify-center gap-0.5">
                <span className="text-base font-black text-white tabular-nums">{roadDKAvg ?? '—'}</span>
                <span className="text-[9px] text-[var(--text-faint)]">DK</span>
              </div>
            </div>
          </div>
        )}

        {/* Stack correlation */}
        {stackPlayers.length > 0 && (
          <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Link2 className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Stack Correlation</span>
              {targetGame && (
                <span className="ml-auto text-[9px] font-bold text-[var(--text-faint)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full">
                  <Award className="w-2 h-2 inline mr-0.5" />{targetGame}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stackPlayers.map((sp: string | { name?: string; team?: string; [k: string]: unknown }, i: number) => {
                const spName  = typeof sp === 'string' ? sp : (sp.name ?? String(sp));
                const spTeam  = typeof sp === 'string' ? null : sp.team ?? null;
                return (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-[10px] font-bold text-indigo-300">
                    {spTeam && (
                      <TeamLogo team={spTeam as string} sport={sport} size={22} />
                    )}
                    {spName}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Context chips */}
        {!stackPlayers.length && (targetGame || platforms || parkFactorNum) && (
          <div className="flex flex-wrap gap-1.5">
            {targetGame && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-faint)]">
                <Award className="w-2.5 h-2.5" />{targetGame}
              </span>
            )}
            {platforms && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-faint)]">
                {Array.isArray(platforms) ? platforms.join(' · ') : String(platforms)}
              </span>
            )}
            {parkFactorNum !== null && !isNaN(parkFactorNum) && (
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                parkFactorNum >= 1.05 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : parkFactorNum <= 0.96 ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-faint)]',
              )}>
                Park {parkFactorNum.toFixed(2)}x {parkFactorNum >= 1.05 ? '· Hitter-friendly' : parkFactorNum <= 0.96 ? '· Pitcher-friendly' : ''}
              </span>
            )}
          </div>
        )}

        {/* Platforms chip when stack is already shown */}
        {stackPlayers.length > 0 && platforms && (
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-faint)]">
              {Array.isArray(platforms) ? platforms.join(' · ') : String(platforms)}
            </span>
          </div>
        )}

        {/* Tips */}
        {tips && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {Array.isArray(tips) ? tips.join(' · ') : String(tips)}
            </p>
          </div>
        )}

        {/* Description fallback */}
        {!isStackPlay && !hasCorePlay && description && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1 block">Overview</span>
            <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">{description}</p>
          </div>
        )}

        {/* Overflow key-value data */}
        {extraKeys.length > 0 && (
          <div className="space-y-1">
            {extraKeys.map(k => (
              <div key={k} className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]/50 last:border-0">
                <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide">
                  {k.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className={cn('text-sm font-bold tabular-nums',
                  String(rest[k]).endsWith('%') ? 'text-amber-400' : 'text-white'
                )}>{String(rest[k])}</span>
              </div>
            ))}
          </div>
        )}

        {/* ══ ZONE 3 ACTION ROW ══════════════════════════════════════════ */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600/20 to-violet-600/20 border border-indigo-500/30 text-xs font-bold text-indigo-300 hover:from-indigo-600/30 hover:to-violet-600/30 hover:text-white hover:border-indigo-500/50 transition-all duration-150"
            aria-label={`Analyze ${title}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            View Full Analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
});
