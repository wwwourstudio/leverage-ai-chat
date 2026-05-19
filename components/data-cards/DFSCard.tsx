'use client';

import { memo, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Award, CheckCircle2, Users, Gamepad2, ChevronRight, TrendingUp, Star, Zap, Link2, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ESPN_TEAM_ABBR } from '@/lib/constants';

function getTeamLogoAbbr(teamName: string): string | null {
  if (!teamName) return null;
  return ESPN_TEAM_ABBR[teamName.trim()] ?? null;
}

function TeamLogo({ team, sport, size = 24 }: { team: string; sport?: string; size?: number }) {
  const abbr = getTeamLogoAbbr(team);
  if (!abbr) return null;
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

/** Letter-grade value badge — pts/$1K scale (5.5=A, 4.5=B, 3.5=C, <3.5=D) */
function ValueGrade({ score }: { score: number }) {
  const grade = score >= 5.5 ? 'A' : score >= 4.5 ? 'B' : score >= 3.5 ? 'C' : 'D';
  const cls =
    grade === 'A' ? 'text-blue-300 bg-blue-500/15 border-blue-500/35'
    : grade === 'B' ? 'text-blue-300 bg-blue-500/15 border-blue-500/35'
    : grade === 'C' ? 'text-amber-300 bg-amber-500/15 border-amber-500/35'
    : 'text-red-300 bg-red-500/15 border-red-500/35';
  return (
    <div className={cn('flex flex-col items-center justify-center w-12 h-12 rounded-xl border font-black shrink-0 animate-badge-pop', cls)}>
      <span className="text-xl leading-none">{grade}</span>
      <span className="text-[7px] uppercase tracking-wider opacity-70">value</span>
    </div>
  );
}

/** Ownership bar with tier badge */
function OwnershipBar({ pct }: { pct: number }) {
  const tier = pct >= 35
    ? { label: 'CHALKY',   bar: 'from-red-500 to-rose-400',      txt: 'text-red-400',     badge: 'bg-red-500/10 border-red-500/25 text-red-400' }
    : pct >= 20
    ? { label: 'POPULAR',  bar: 'from-amber-500 to-yellow-400',  txt: 'text-amber-400',   badge: 'bg-amber-500/10 border-amber-500/25 text-amber-400' }
    : pct >= 10
    ? { label: 'MODERATE', bar: 'from-blue-500 to-indigo-400',   txt: 'text-blue-400',    badge: 'bg-blue-500/10 border-blue-500/25 text-blue-400' }
    :  { label: 'LEVERAGE', bar: 'from-blue-500 to-teal-400', txt: 'text-blue-400', badge: 'bg-blue-500/10 border-blue-500/25 text-blue-400' };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3 text-[var(--text-faint)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Ownership</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[11px] font-black tabular-nums', tier.txt)}>{pct.toFixed(1)}%</span>
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider', tier.badge)}>
            <Star className="w-2 h-2" />{tier.label}
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', tier.bar)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

/** Ceiling/floor range bar with p50 marker */
function CeilingFloorBar({ ceiling, floor, projection }: { ceiling: number; floor: number; projection: number }) {
  const range = ceiling - floor;
  if (range <= 0) return null;
  const projPct = Math.min(100, ((projection - floor) / range) * 100);
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Outcome Range</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-red-400 tabular-nums">Floor {floor.toFixed(1)}</span>
          <span className="text-[var(--text-faint)] text-[9px]">–</span>
          <span className="text-[10px] font-bold text-blue-400 tabular-nums">Ceil {ceiling.toFixed(1)}</span>
        </div>
      </div>
      <div className="relative h-2 rounded-full overflow-visible">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/30 via-amber-400/20 to-blue-500/30" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-red-400/70" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-blue-400/70" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[var(--bg-elevated)] dark:bg-white border-2 border-[var(--cat-dfs,oklch(0.72_0.20_80))] shadow-[0_0_6px_oklch(0.72_0.20_80/0.5)] transition-all duration-500"
          style={{ left: `calc(${projPct}% - 5px)` }}
        />
      </div>
      <div className="flex items-center justify-center">
        <span className="text-[9px] text-[var(--text-muted)]">Proj: <span className="text-[var(--foreground)] font-black">{projection.toFixed(1)}</span></span>
      </div>
    </div>
  );
}

/** Matchup score meter */
function MatchupMeter({ score }: { score: number }) {
  const colorCls = score >= 70 ? 'from-blue-500 to-teal-400' : score >= 50 ? 'from-amber-500 to-yellow-400' : 'from-red-500 to-rose-400';
  const textCls  = score >= 70 ? 'text-blue-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  const label    = score >= 70 ? 'GREAT' : score >= 50 ? 'OK' : 'TOUGH';
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Target className="w-3 h-3 text-[var(--text-faint)]" />
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Matchup</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[13px] font-black tabular-nums', textCls)}>{Math.round(score)}</span>
          <span className="text-[var(--text-faint)] text-[10px]">/100</span>
          <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wide',
            score >= 70 ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
              : score >= 50 ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              : 'bg-red-500/15 border-red-500/30 text-red-400',
          )}>{label}</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
        <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', colorCls)} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </div>
  );
}

/** DK/FD platform toggle */
function PlatformToggle({ value, onChange }: { value: 'DK' | 'FD'; onChange: (v: 'DK' | 'FD') => void }) {
  return (
    <div className="inline-flex items-center rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-0.5 gap-0.5">
      {(['DK', 'FD'] as const).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            'px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-150',
            value === p
              ? 'bg-[var(--cat-dfs,oklch(0.72_0.20_80))] text-black shadow-sm'
              : 'text-[var(--foreground)]/50 hover:text-[var(--foreground)]/80',
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function hasVal(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  return s !== '' && s !== '—' && s !== '-';
}

export const DFSCard = memo(function DFSCard({
  title, category, subcategory, data, status, onAnalyze, isHero = false,
}: DFSCardProps) {
  const [platform, setPlatform] = useState<'DK' | 'FD'>('DK');

  const {
    player, team, position, sport,
    targetGame, targetPlayers, description,
    platforms, tips, salary, projection, ownership,
    boomCeiling, bustFloor, realData,
    cardCategory, recentDKPts, recentGamesAvg,
    homeDKAvg, roadDKAvg, homeSplitGames, roadSplitGames,
    stackTeam, stackPartners, playerId, isStack,
    matchupScore, parkFactor,
    fdSalary,
    hrProb, isPlaying, availabilityReason, confirmedStarter, stackType,
    ...rest
  } = data;

  // Use FD salary if platform=FD and available
  const displaySalary  = platform === 'FD' && fdSalary ? fdSalary : salary;
  const platformLabel  = platform === 'DK' ? 'DK' : 'FD';

  const matchupScoreNum = matchupScore ? parseFloat(String(matchupScore)) : null;
  const parkFactorNum   = parkFactor   ? parseFloat(String(parkFactor))   : null;

  const projNum      = parseFloat(String(projection    || '').replace(/[^0-9.]/g, ''));
  const salaryNum    = parseFloat(String(displaySalary || '').replace(/[^0-9.]/g, ''));
  const ownershipNum = parseFloat(String(ownership     || '').replace(/[^0-9.]/g, ''));
  const valueScore   = projNum > 0 && salaryNum > 0 ? projNum / (salaryNum / 1000) : null;

  const ceilingNum   = parseFloat(String(boomCeiling || '').replace(/[^0-9.]/g, ''));
  const floorNum     = parseFloat(String(bustFloor   || '').replace(/[^0-9.]/g, ''));
  const hasRangeBar  = !isNaN(ceilingNum) && ceilingNum > 0 && !isNaN(floorNum) && floorNum >= 0 && !isNaN(projNum) && projNum > 0;

  const hasCorePlay  = Boolean(player && (salary || projection || ownership));
  const isStackPlay  = Boolean(isStack || position === 'STACK');
  const stackPlayers = Array.isArray(targetPlayers) ? targetPlayers : targetPlayers ? [targetPlayers] : [];

  const extraKeys = Object.keys(rest).filter(k =>
    !['status', 'sport', 'insight', 'source', 'focus', 'value', 'dkValue', 'matchupScore', 'parkFactor', 'hrProb'].includes(k) && rest[k] != null
  );

  const categoryBadgeCls =
    cardCategory === 'value'      ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' :
    cardCategory === 'matchup'    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' :
    cardCategory === 'contrarian' ? 'bg-violet-500/15 border-violet-500/30 text-violet-400' :
    cardCategory === 'chalk'      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
    'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-faint)]';
  const categoryLabel =
    cardCategory === 'value' ? 'VALUE' : cardCategory === 'matchup' ? 'MATCHUP' :
    cardCategory === 'contrarian' ? 'CONTRARIAN' : cardCategory === 'chalk' ? 'CHALK' : 'OPTIMAL';

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-300',
      isHero
        ? 'border-[var(--border-hover)] shadow-[0_0_32px_oklch(0.72_0.20_80/0.15)]'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_24px_oklch(0.72_0.20_80/0.12)]',
    )}>

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="relative px-4 pr-3 pt-4 pb-3 bg-gradient-to-br from-[var(--cat-dfs,oklch(0.72_0.20_80))]/20 dark:via-amber-900/5 to-transparent border-b border-[var(--border-subtle)]">
        <div className="absolute top-0 right-0 w-40 h-20 bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/5 rounded-bl-full blur-3xl pointer-events-none" />

        {/* Top row: breadcrumb + badges */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Gamepad2 className="w-3 h-3 text-[var(--cat-dfs,oklch(0.72_0.20_80))]/70 shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/60">{category}</span>
            <span className="text-[var(--foreground)]/30">·</span>
            <span className="text-[9px] text-[var(--foreground)]/50 truncate">{subcategory}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {realData && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[9px] font-bold uppercase tracking-wide">
                <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />LIVE
              </span>
            )}
            {cardCategory && (
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider', categoryBadgeCls)}>
                {categoryLabel}
              </span>
            )}
            <PlatformToggle value={platform} onChange={setPlatform} />
          </div>
        </div>

        {/* Title */}
        <h3 className={cn('font-black text-[var(--foreground)] leading-snug text-balance', isHero ? 'text-lg' : 'text-sm')}>
          {title}
        </h3>

        {/* Player spotlight */}
        {hasCorePlay && !isStackPlay && (
          <div className="mt-2.5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                {position && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/15 border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/30 text-[9px] font-black text-[var(--cat-dfs,oklch(0.72_0.20_80))] uppercase tracking-wider">
                    {position}
                  </span>
                )}
                {team && <span className="text-[10px] font-bold text-[var(--foreground)]/50">{team}</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {team && <TeamLogo team={team} sport={sport} size={32} />}
                <span className={cn('font-black text-[var(--foreground)] leading-tight', isHero ? 'text-2xl' : 'text-xl')}>
                  {player}
                </span>
                {confirmedStarter && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-[9px] font-black text-blue-400 uppercase tracking-wider">
                    <CheckCircle2 className="w-2.5 h-2.5" />Confirmed
                  </span>
                )}
              </div>
            </div>
            {valueScore !== null && <ValueGrade score={valueScore} />}
          </div>
        )}

        {/* Stack headline */}
        {isStackPlay && (
          <div className="mt-2 flex items-center gap-1.5">
            {(stackTeam || team) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-black text-[var(--foreground)]">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Stack: {stackTeam ?? team}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ══ AVAILABILITY WARNING ═════════════════════════════════════════════ */}
      {isPlaying === false && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-black text-red-400 uppercase tracking-wider">Not Playing</span>
            {availabilityReason && availabilityReason !== 'available' && (
              <span className="text-[10px] text-red-300/70 ml-1.5">
                ({availabilityReason === 'IL' ? 'Injured List' : availabilityReason === 'scratched' ? 'Scratched' : availabilityReason === 'not-in-lineup' ? 'Not in lineup' : availabilityReason === 'no-game' ? 'No game today' : availabilityReason})
              </span>
            )}
          </div>
        </div>
      )}

      {/* ══ STATS ZONE ══════════════════════════════════════════════════════ */}
      <div className="px-4 pt-3 pb-0 space-y-3">

        {/* Core play stat tiles */}
        {hasCorePlay && !isStackPlay && (
          <div className="grid grid-cols-3 gap-1.5">
            {/* Salary */}
            {hasVal(displaySalary) && displaySalary !== '$0' && (
              <div className="flex flex-col items-center gap-1 rounded-xl bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/8 border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/25 px-2 py-2.5">
                <span className="text-[8px] font-black uppercase tracking-wider text-[var(--cat-dfs,oklch(0.72_0.20_80))]/70">{platformLabel} Salary</span>
                <span className="text-base font-black text-[var(--cat-dfs,oklch(0.72_0.20_80))] tabular-nums leading-tight">{String(displaySalary)}</span>
                {salaryNum > 0 && (
                  <div className="w-full mt-0.5">
                    <div className="h-0.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--cat-dfs,oklch(0.72_0.20_80))]" style={{ width: `${Math.min(100, (salaryNum / 50000) * 100).toFixed(1)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Projection */}
            {hasVal(projection) && (
              <div className="flex flex-col items-center gap-1 rounded-xl bg-blue-500/8 border border-blue-500/20 px-2 py-2.5">
                <span className="text-[8px] font-black uppercase tracking-wider text-blue-400/70">Proj Pts</span>
                <span className="text-base font-black text-blue-400 tabular-nums leading-tight">{String(projection)}</span>
                {!isNaN(projNum) && projNum > 0 && (
                  <div className="w-full mt-0.5">
                    <div className="h-0.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400" style={{ width: `${Math.min(100, (projNum / 40) * 100).toFixed(1)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Ownership */}
            {hasVal(ownership) && (
              <div className="flex flex-col items-center gap-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-2.5">
                <span className="text-[8px] font-black uppercase tracking-wider text-[var(--text-muted)]">Own%</span>
                <span className="text-base font-black text-[var(--foreground)] tabular-nums leading-tight">{String(ownership)}</span>
                {!isNaN(ownershipNum) && ownershipNum > 0 && (
                  <div className="w-full mt-0.5">
                    <div className="h-0.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500',
                          ownershipNum >= 35 ? 'bg-red-400' : ownershipNum >= 20 ? 'bg-amber-400' : ownershipNum >= 10 ? 'bg-blue-400' : 'bg-blue-400'
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

        {/* Stack play */}
        {isStackPlay && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/6 px-3 py-3 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">Stack Recommendation</span>
            {targetGame && <p className="text-sm font-bold text-[var(--foreground)]">{targetGame}</p>}
            <div className="grid grid-cols-2 gap-1.5">
              {hasVal(projection) && (
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-1.5 py-2">
                  <span className="text-[7px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Proj Pts</span>
                  <span className="text-sm font-black text-blue-400 tabular-nums">{String(projection)}</span>
                </div>
              )}
              {hasVal(ownership) && (
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-1.5 py-2">
                  <span className="text-[7px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Own %</span>
                  <span className="text-sm font-black text-[var(--foreground)] tabular-nums">{String(ownership)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isStackPlay && !hasCorePlay && (
          <div className="rounded-xl border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/20 bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/5 px-4 py-4 text-center">
            <Gamepad2 className="w-6 h-6 text-[var(--cat-dfs,oklch(0.72_0.20_80))]/40 mx-auto mb-2" />
            <p className="text-[11px] text-[var(--text-faint)]">Ask about a slate to populate salary &amp; projections</p>
          </div>
        )}
      </div>

      {/* ══ ANALYTICS ZONE ══════════════════════════════════════════════════ */}
      <div className="px-4 pb-4 pt-2 space-y-2.5">

        {/* Value efficiency — compact row */}
        {!isStackPlay && hasCorePlay && valueScore !== null && (() => {
          const valPct = Math.min(100, (valueScore / 8) * 100);
          const valCls = valueScore >= 5.5 ? 'from-blue-500 to-teal-400' : valueScore >= 4.5 ? 'from-blue-500 to-indigo-400' : valueScore >= 3.5 ? 'from-amber-500 to-yellow-400' : 'from-red-500 to-rose-400';
          const valTxt = valueScore >= 5.5 ? 'text-blue-400' : valueScore >= 4.5 ? 'text-blue-400' : valueScore >= 3.5 ? 'text-amber-400' : 'text-red-400';
          return (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Value Efficiency</span>
                <span className={cn('text-[11px] font-black tabular-nums', valTxt)}>{valueScore.toFixed(2)}x pts/$K</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', valCls)} style={{ width: `${valPct}%` }} />
                {/* League avg tick at 4.0 = 50% */}
                <div className="absolute top-0 bottom-0 w-px bg-[var(--foreground)]/20" style={{ left: '50%' }} />
              </div>
            </div>
          );
        })()}

        {/* Ownership bar */}
        {!isStackPlay && !isNaN(ownershipNum) && ownershipNum > 0 && (
          <div className="px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
            <OwnershipBar pct={ownershipNum} />
          </div>
        )}

        {/* Ceiling/floor range */}
        {hasRangeBar ? (
          <CeilingFloorBar ceiling={ceilingNum} floor={floorNum} projection={projNum} />
        ) : (boomCeiling || bustFloor) && (
          <div className="grid grid-cols-2 gap-1.5">
            {boomCeiling && (
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-blue-500/8 border border-blue-500/20 px-2 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400/70">Ceiling</span>
                <span className="text-sm font-black text-blue-400 tabular-nums">{String(boomCeiling)}</span>
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

        {/* Matchup score */}
        {matchupScoreNum !== null && !isNaN(matchupScoreNum) && (
          <MatchupMeter score={matchupScoreNum} />
        )}

        {/* Recent form sparkline */}
        {recentDKPts && (() => {
          const pts = String(recentDKPts).split(',').map(Number).filter(n => !isNaN(n));
          if (!pts.length) return null;
          const max = Math.max(...pts, 1);
          return (
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Recent Form</span>
                {recentGamesAvg && <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{recentGamesAvg}</span>}
              </div>
              <div className="flex items-end gap-1 h-8">
                {pts.map((pt, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className={cn('w-full rounded-sm', pt >= max * 0.7 ? 'bg-blue-500' : pt >= max * 0.4 ? 'bg-blue-500' : 'bg-red-500/60')}
                      style={{ height: `${Math.round((pt / max) * 24) + 4}px` }}
                    />
                    <span className="text-[7px] text-[var(--text-faint)] tabular-nums">{pt.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Home/road splits */}
        {(homeDKAvg || roadDKAvg) && (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-2.5 text-center">
              <span className="text-[8px] font-black uppercase tracking-wider text-[var(--text-muted)] block mb-1">Home {homeSplitGames ? `· ${homeSplitGames}G` : ''}</span>
              <div className="flex items-baseline justify-center gap-0.5">
                <span className="text-base font-black text-[var(--foreground)] tabular-nums">{homeDKAvg ?? '—'}</span>
                <span className="text-[9px] text-[var(--text-faint)]">{platformLabel}</span>
              </div>
            </div>
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-2.5 text-center">
              <span className="text-[8px] font-black uppercase tracking-wider text-[var(--text-muted)] block mb-1">Road {roadSplitGames ? `· ${roadSplitGames}G` : ''}</span>
              <div className="flex items-baseline justify-center gap-0.5">
                <span className="text-base font-black text-[var(--foreground)] tabular-nums">{roadDKAvg ?? '—'}</span>
                <span className="text-[9px] text-[var(--text-faint)]">{platformLabel}</span>
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
              {stackType && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-[8px] font-black text-indigo-300 uppercase tracking-wider">
                  {stackType === 'full' ? 'Full Stack' : stackType === 'mini' ? 'Mini-Stack' : stackType}
                </span>
              )}
              {targetGame && (
                <span className="ml-auto text-[9px] font-bold text-[var(--text-faint)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full">
                  <Award className="w-2 h-2 inline mr-0.5" />{targetGame}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stackPlayers.map((sp: string | { name?: string; team?: string; [k: string]: unknown }, i: number) => {
                const spName = typeof sp === 'string' ? sp : (sp.name ?? String(sp));
                const spTeam = typeof sp === 'string' ? null : sp.team ?? null;
                return (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-[10px] font-bold text-indigo-300">
                    {spTeam && <TeamLogo team={spTeam as string} sport={sport} size={18} />}
                    {spName}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* HR probability chip — hitters only */}
        {hrProb && position && !['SP', 'P', 'RP'].includes(String(position).toUpperCase()) && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/8 border border-rose-500/20">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">HR Prob</span>
            <span className="ml-auto text-sm font-black text-rose-300 tabular-nums">{String(hrProb)}</span>
          </div>
        )}

        {/* Context chips: game + park factor */}
        {(targetGame || parkFactorNum) && !stackPlayers.length && (
          <div className="flex flex-wrap gap-1.5">
            {targetGame && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-faint)]">
                <Award className="w-2.5 h-2.5" />{targetGame}
              </span>
            )}
            {parkFactorNum !== null && !isNaN(parkFactorNum!) && (
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                parkFactorNum! >= 1.05 ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  : parkFactorNum! <= 0.96 ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-faint)]',
              )}>
                Park {parkFactorNum!.toFixed(2)}x {parkFactorNum! >= 1.05 ? '· Hitter-friendly' : parkFactorNum! <= 0.96 ? '· Pitcher-friendly' : ''}
              </span>
            )}
          </div>
        )}

        {/* Tips */}
        {tips && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/5 border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/20">
            <Zap className="w-3 h-3 text-[var(--cat-dfs,oklch(0.72_0.20_80))] shrink-0 mt-0.5" />
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

        {/* Overflow key-value */}
        {extraKeys.length > 0 && (
          <div className="space-y-1">
            {extraKeys.map(k => (
              <div key={k} className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]/50 last:border-0">
                <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide">
                  {k.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className={cn('text-sm font-bold tabular-nums', String(rest[k]).endsWith('%') ? 'text-amber-400' : 'text-[var(--foreground)]')}>
                  {String(rest[k])}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Action button */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-gradient-to-r from-[var(--cat-dfs,oklch(0.72_0.20_80))]/20 to-amber-600/20 border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/30 text-xs font-bold text-[var(--cat-dfs,oklch(0.72_0.20_80))] hover:from-[var(--cat-dfs,oklch(0.72_0.20_80))]/30 hover:to-amber-600/30 hover:text-[var(--foreground)] hover:border-[var(--cat-dfs,oklch(0.72_0.20_80))]/50 transition-all duration-150"
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
