'use client';

import { memo } from 'react';
import { Award, Users, Gamepad2, ChevronRight, TrendingUp, Star, Zap, Link2, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  label: string; dotCls: string; textCls: string; bgCls: string; headerGrad: string;
}> = {
  optimal: {
    label: 'OPTIMAL',
    dotCls: 'bg-sky-400',
    textCls: 'text-sky-400',
    bgCls: 'bg-sky-500/15 border-sky-500/30',
    headerGrad: 'from-sky-600/75 via-blue-700/55 to-sky-900/35',
  },
  value: {
    label: 'VALUE',
    dotCls: 'bg-emerald-400',
    textCls: 'text-emerald-400',
    bgCls: 'bg-emerald-500/15 border-emerald-500/30',
    headerGrad: 'from-emerald-600/75 via-teal-700/55 to-emerald-900/35',
  },
  elite: {
    label: 'ELITE',
    dotCls: 'bg-purple-400',
    textCls: 'text-purple-400',
    bgCls: 'bg-purple-500/15 border-purple-500/30',
    headerGrad: 'from-purple-600/75 via-violet-700/55 to-purple-900/35',
  },
  hot: {
    label: 'HOT',
    dotCls: 'bg-red-400',
    textCls: 'text-red-400',
    bgCls: 'bg-red-500/15 border-red-500/30',
    headerGrad: 'from-red-600/75 via-rose-700/55 to-red-900/35',
  },
};

/** Letter-grade value badge based on salary efficiency (proj pts / salary * 1000) */
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
    <div className={cn('flex flex-col items-center justify-center w-11 h-11 rounded-xl border font-black shrink-0', color)}>
      <span className="text-xl leading-none">{grade}</span>
      <span className="text-[7px] uppercase tracking-wider opacity-70">grade</span>
    </div>
  );
}

/** Visual ownership progress bar + tier badge */
function OwnershipBar({ pct }: { pct: number }) {
  const tier = pct >= 35 ? { label: 'CHALKY',   barCls: 'bg-red-400',    textCls: 'text-red-400',    badgeCls: 'bg-red-500/10 border-red-500/25 text-red-400' }
    : pct >= 20          ? { label: 'POPULAR',   barCls: 'bg-amber-400',  textCls: 'text-amber-400',  badgeCls: 'bg-amber-500/10 border-amber-500/25 text-amber-400' }
    : pct >= 10          ? { label: 'MODERATE',  barCls: 'bg-blue-400',   textCls: 'text-blue-400',   badgeCls: 'bg-blue-500/10 border-blue-500/25 text-blue-400' }
    :                      { label: 'LEVERAGE',  barCls: 'bg-emerald-400', textCls: 'text-emerald-400', badgeCls: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3 text-[oklch(0.45_0.01_280)]" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.42_0.01_280)]">Field Ownership</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[10px] font-black tabular-nums', tier.textCls)}>{pct.toFixed(1)}%</span>
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider', tier.badgeCls)}>
            <Star className="w-2 h-2" />{tier.label}
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', tier.barCls)}
          style={{ width: `${Math.min(100, pct)}%`, opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

/** Value efficiency bar: pts/$1K — cap at 8.0 for full fill */
function ValueEfficiencyBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 8) * 100);
  const barCls = score >= 5.5 ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
    : score >= 4.5            ? 'bg-gradient-to-r from-blue-500 to-indigo-400'
    : score >= 3.5            ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
    :                           'bg-gradient-to-r from-red-500 to-rose-400';
  const textCls = score >= 5.5 ? 'text-emerald-400' : score >= 4.5 ? 'text-blue-400' : score >= 3.5 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-3 h-3 text-[oklch(0.45_0.01_280)]" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.42_0.01_280)]">Value Efficiency</span>
        </div>
        <span className={cn('text-[10px] font-black tabular-nums', textCls)}>{score.toFixed(2)}x pts/$K</span>
      </div>
      <div className="h-1.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barCls)}
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
  data,
  status,
  onAnalyze,
  isHero = false,
}: DFSCardProps) {
  const cfg = statusConfig[status] || statusConfig.value;

  const {
    player, team, position,
    targetGame, targetPlayers, description,
    platforms, tips, salary, projection, ownership,
    boomCeiling, bustFloor, realData,
    cardCategory, recentDKPts, recentGamesAvg,
    homeDKAvg, roadDKAvg, homeSplitGames, roadSplitGames,
    stackTeam, stackType, stackPartners, playerId, // structural — exclude from overflow
    matchupScore, parkFactor,
    ...rest
  } = data;

  const matchupScoreNum = matchupScore ? parseFloat(String(matchupScore)) : null;
  const parkFactorNum = parkFactor ? parseFloat(String(parkFactor)) : null;

  const projNum      = parseFloat(String(projection  || '').replace(/[^0-9.]/g, ''));
  const salaryNum    = parseFloat(String(salary      || '').replace(/[^0-9.]/g, ''));
  const ownershipNum = parseFloat(String(ownership   || '').replace(/[^0-9.]/g, ''));
  const valueScore   = projNum > 0 && salaryNum > 0 ? projNum / (salaryNum / 1000) : null;

  const hasCorePlay  = Boolean(player && (salary || projection || ownership));
  const stackPlayers = Array.isArray(targetPlayers) ? targetPlayers : targetPlayers ? [targetPlayers] : [];

  const extraKeys = Object.keys(rest).filter(k =>
    !['status', 'sport', 'insight', 'source', 'focus', 'value', 'dkValue', 'matchupScore', 'parkFactor', 'hrProb'].includes(k) && rest[k] != null
  );

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.09_0.012_280)] border transition-all duration-300',
      isHero
        ? 'border-[oklch(0.28_0.025_260)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.15)]'
        : 'border-[oklch(0.18_0.016_280)] hover:border-[oklch(0.28_0.02_280)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.08)]',
    )}>

      {/* ── Gradient header ──────────────────────────────────────────── */}
      <div className={cn('relative px-4 pt-3.5 pb-3 bg-gradient-to-br', cfg.headerGrad)}>
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {realData && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold text-emerald-400/80">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              LIVE
            </span>
          )}
          {cardCategory && (
            <span className={cn('text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border',
              cardCategory === 'value'      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' :
              cardCategory === 'matchup'    ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' :
              cardCategory === 'contrarian' ? 'bg-violet-500/10 border-violet-500/25 text-violet-400' :
              cardCategory === 'chalk'      ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' :
              'bg-white/5 border-white/10 text-white/50'
            )}>
              {cardCategory === 'value'      ? 'VALUE' :
               cardCategory === 'matchup'    ? 'MATCHUP' :
               cardCategory === 'contrarian' ? 'CONTRARIAN' :
               cardCategory === 'chalk'      ? 'CHALK' : 'OPTIMAL'}
            </span>
          )}
          <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', cfg.dotCls)} />
          <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.textCls)}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Gamepad2 className="w-3 h-3 text-white/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{category}</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50 truncate">{subcategory}</span>
        </div>
        <h3 className={cn('font-black text-white leading-snug text-balance pr-20', isHero ? 'text-lg' : 'text-sm')}>
          {title}
        </h3>
      </div>

      <div className="px-4 pb-4 space-y-3">

        {/* ── Core Play ─────────────────────────────────────────────── */}
        {hasCorePlay && (
          <div className="mt-3 rounded-xl border border-teal-500/30 bg-teal-500/6 px-3 py-3">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="text-[8px] font-black uppercase tracking-wider text-teal-400">Core Play</span>
              {position && (
                <span className="text-[8px] font-black text-teal-300/70 bg-teal-500/10 border border-teal-500/25 px-1.5 py-0.5 rounded-full">
                  {position}
                </span>
              )}
              {team && (
                <span className="text-[9px] font-bold text-white/60 ml-1">{team}</span>
              )}
            </div>
            {player && (
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className={cn('font-black text-white leading-tight', isHero ? 'text-xl' : 'text-lg')}>{player}</span>
                {valueScore !== null && <ValueGrade score={valueScore} />}
              </div>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {salary && (
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-1.5 py-2">
                  <span className="text-[7px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">Salary</span>
                  <span className="text-sm font-black text-white tabular-nums">{String(salary)}</span>
                </div>
              )}
              {projection && (
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-1.5 py-2">
                  <span className="text-[7px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">Proj Pts</span>
                  <span className="text-sm font-black text-emerald-400 tabular-nums">{String(projection)}</span>
                </div>
              )}
              {ownership && (
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-1.5 py-2">
                  <span className="text-[7px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">Own%</span>
                  <span className="text-sm font-black text-white tabular-nums">{String(ownership)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Value efficiency bar (when core play shown and value computed) ── */}
        {hasCorePlay && valueScore !== null && (
          <ValueEfficiencyBar score={valueScore} />
        )}

        {/* ── Ownership risk bar ─────────────────────────────────────── */}
        {!isNaN(ownershipNum) && ownershipNum > 0 && (
          <div className="px-3 py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)]">
            <OwnershipBar pct={ownershipNum} />
          </div>
        )}

        {/* ── Ceiling / floor ───────────────────────────────────────── */}
        {(boomCeiling || bustFloor) && (
          <div className="grid grid-cols-2 gap-1.5">
            {boomCeiling && (
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-2 py-2">
                <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400/70">Ceiling</span>
                <span className="text-sm font-black text-emerald-400 tabular-nums">{String(boomCeiling)}</span>
              </div>
            )}
            {bustFloor && (
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-red-500/8 border border-red-500/20 px-2 py-2">
                <span className="text-[8px] font-bold uppercase tracking-wider text-red-400/70">Floor</span>
                <span className="text-sm font-black text-red-400 tabular-nums">{String(bustFloor)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Recent Form sparkline ─────────────────────────────────── */}
        {recentDKPts && (() => {
          const pts = String(recentDKPts).split(',').map(Number).filter(n => !isNaN(n));
          if (pts.length === 0) return null;
          const max = Math.max(...pts, 1);
          return (
            <div className="rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-3 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-black uppercase tracking-wider text-[oklch(0.38_0.01_280)]">Recent Form</span>
                {recentGamesAvg && (
                  <span className="text-[9px] text-white/50 tabular-nums">{recentGamesAvg}</span>
                )}
              </div>
              <div className="flex items-end gap-1 h-8">
                {pts.map((p, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className={cn('w-full rounded-sm',
                        p >= max * 0.7 ? 'bg-emerald-500' : p >= max * 0.4 ? 'bg-blue-500' : 'bg-red-500/60'
                      )}
                      style={{ height: `${Math.round((p / max) * 24) + 4}px` }}
                    />
                    <span className="text-[7px] text-white/30 tabular-nums">{p.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Home / Road splits ────────────────────────────────────── */}
        {(homeDKAvg || roadDKAvg) && (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-2 py-2 text-center">
              <span className="text-[7px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)] block mb-0.5">
                Home {homeSplitGames ? `· ${homeSplitGames}` : ''}
              </span>
              <span className="text-sm font-black text-white tabular-nums">{homeDKAvg ?? '—'}</span>
              <span className="text-[8px] text-white/40 ml-0.5">DK avg</span>
            </div>
            <div className="rounded-lg bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-2 py-2 text-center">
              <span className="text-[7px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)] block mb-0.5">
                Road {roadSplitGames ? `· ${roadSplitGames}` : ''}
              </span>
              <span className="text-sm font-black text-white tabular-nums">{roadDKAvg ?? '—'}</span>
              <span className="text-[8px] text-white/40 ml-0.5">DK avg</span>
            </div>
          </div>
        )}

        {/* ── Matchup score bar ─────────────────────────────────────── */}
        {matchupScoreNum !== null && !isNaN(matchupScoreNum) && (
          <div className="rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-3 py-2.5 space-y-1">
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wide">
              <span className="text-[oklch(0.40_0.01_280)]">Matchup Score</span>
              <span className={cn(
                matchupScoreNum >= 70 ? 'text-emerald-400' : matchupScoreNum >= 50 ? 'text-amber-400' : 'text-red-400'
              )}>{Math.round(matchupScoreNum)}/100</span>
            </div>
            <div className="h-1.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700',
                  matchupScoreNum >= 70 ? 'bg-emerald-500' : matchupScoreNum >= 50 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${Math.min(100, matchupScoreNum)}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Stack section ─────────────────────────────────────────── */}
        {stackPlayers.length > 0 && (
          <div className="rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Link2 className="w-3 h-3 text-indigo-400" />
              <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400">Stack Correlation</span>
              {targetGame && (
                <span className="ml-auto text-[9px] font-bold text-[oklch(0.48_0.01_280)] bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] px-2 py-0.5 rounded-md">
                  <Award className="w-2.5 h-2.5 inline mr-1" />{targetGame}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stackPlayers.map((sp: string, i: number) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-[10px] font-bold text-indigo-300">
                  {sp}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Context chips (game / platforms when no stack) ─────────── */}
        {!stackPlayers.length && (targetGame || platforms || parkFactorNum) && (
          <div className="flex flex-wrap gap-1.5">
            {targetGame && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] font-medium text-[oklch(0.58_0.01_280)]">
                <Award className="w-2.5 h-2.5" />{targetGame}
              </span>
            )}
            {platforms && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] font-medium text-[oklch(0.58_0.01_280)]">
                {Array.isArray(platforms) ? platforms.join(' · ') : String(platforms)}
              </span>
            )}
            {parkFactorNum !== null && !isNaN(parkFactorNum) && (
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border',
                parkFactorNum >= 1.05 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : parkFactorNum <= 0.96 ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-[oklch(0.13_0.015_280)] border-[oklch(0.19_0.015_280)] text-[oklch(0.55_0.01_280)]',
              )}>
                Park {parkFactorNum.toFixed(2)}x {parkFactorNum >= 1.05 ? '· Hitter-friendly' : parkFactorNum <= 0.96 ? '· Pitcher-friendly' : ''}
              </span>
            )}
          </div>
        )}

        {/* ── Platforms chip when stack is already shown ───────────── */}
        {stackPlayers.length > 0 && platforms && (
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] font-medium text-[oklch(0.58_0.01_280)]">
              {Array.isArray(platforms) ? platforms.join(' · ') : String(platforms)}
            </span>
          </div>
        )}

        {/* ── Tips ─────────────────────────────────────────────────── */}
        {tips && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[oklch(0.60_0.01_280)] leading-relaxed">
              {Array.isArray(tips) ? tips.join(' · ') : String(tips)}
            </p>
          </div>
        )}

        {/* ── Description fallback ──────────────────────────────────── */}
        {!hasCorePlay && description && (
          <div className="rounded-xl border border-[oklch(0.20_0.015_280)] bg-[oklch(0.08_0.01_280)] px-3 py-2.5 mt-3">
            <span className="text-[8px] font-black uppercase tracking-widest text-[oklch(0.38_0.01_280)] mb-1 block">Overview</span>
            <p className="text-[11px] text-[oklch(0.52_0.01_280)] leading-relaxed">{description}</p>
          </div>
        )}

        {/* ── Overflow key-value data ───────────────────────────────── */}
        {extraKeys.length > 0 && (
          <div className="space-y-1">
            {extraKeys.map(k => (
              <div key={k} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[oklch(0.08_0.01_280)]">
                <span className="text-[10px] font-semibold text-[oklch(0.42_0.01_280)] uppercase tracking-wide">
                  {k.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className={cn('text-xs font-black tabular-nums',
                  String(rest[k]).endsWith('%') ? 'text-amber-400' : 'text-white'
                )}>{String(rest[k])}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] text-xs font-semibold text-[oklch(0.46_0.01_280)] hover:text-white hover:bg-[oklch(0.14_0.015_280)] hover:border-[oklch(0.26_0.02_280)] transition-all duration-150"
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
