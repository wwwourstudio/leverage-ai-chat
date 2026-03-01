'use client';

import { Trophy, Target, Zap, AlertTriangle, User, ChevronRight, TrendingUp, ArrowUpRight, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlayerAvatar } from './PlayerAvatar';
import { getPlayerHeadshotUrl } from '@/lib/constants';

interface FantasyCardProps {
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

// ── Position badge ─────────────────────────────────────────────────────────────
const POS_COLORS: Record<string, string> = {
  // NFL
  QB:  'text-red-400    bg-red-400/12    border-red-400/30',
  RB:  'text-green-400  bg-green-400/12  border-green-400/30',
  WR:  'text-blue-400   bg-blue-400/12   border-blue-400/30',
  TE:  'text-orange-400 bg-orange-400/12 border-orange-400/30',
  K:   'text-purple-400 bg-purple-400/12 border-purple-400/30',
  DEF: 'text-slate-400  bg-slate-400/12  border-slate-400/30',
  // MLB
  SP:  'text-cyan-400   bg-cyan-400/12   border-cyan-400/30',
  RP:  'text-violet-400 bg-violet-400/12 border-violet-400/30',
  C:   'text-yellow-400 bg-yellow-400/12 border-yellow-400/30',
  '1B':'text-pink-400   bg-pink-400/12   border-pink-400/30',
  '2B':'text-lime-400   bg-lime-400/12   border-lime-400/30',
  '3B':'text-amber-400  bg-amber-400/12  border-amber-400/30',
  SS:  'text-teal-400   bg-teal-400/12   border-teal-400/30',
  OF:  'text-sky-400    bg-sky-400/12    border-sky-400/30',
  // NBA
  PG:  'text-blue-400   bg-blue-400/12   border-blue-400/30',
  SG:  'text-indigo-400 bg-indigo-400/12 border-indigo-400/30',
  SF:  'text-green-400  bg-green-400/12  border-green-400/30',
  PF:  'text-orange-400 bg-orange-400/12 border-orange-400/30',
};
function PosBadge({ pos }: { pos: string }) {
  const c = POS_COLORS[pos] ?? 'text-gray-400 bg-gray-400/12 border-gray-400/30';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider', c)}>
      {pos}
    </span>
  );
}

// ── Tier badge ────────────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: number }) {
  const labels = ['T1', 'T2', 'T3', 'T4'];
  const label = labels[Math.min(tier - 1, 3)] ?? 'T4';
  const c = tier === 1 ? 'text-yellow-400 bg-yellow-400/12 border-yellow-400/30'
    : tier === 2       ? 'text-emerald-400 bg-emerald-400/12 border-emerald-400/30'
    : tier === 3       ? 'text-blue-400 bg-blue-400/12 border-blue-400/30'
    : 'text-slate-400 bg-slate-400/12 border-slate-400/30';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-black', c)}>{label}</span>
  );
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, {
  label: string; dot: string; text: string; headerGrad: string;
}> = {
  target:  { label: 'TARGET',  dot: 'bg-teal-400',    text: 'text-teal-400',    headerGrad: 'from-teal-600/75 via-cyan-700/55 to-teal-900/35' },
  value:   { label: 'VALUE',   dot: 'bg-emerald-400', text: 'text-emerald-400', headerGrad: 'from-emerald-600/75 via-green-700/55 to-emerald-900/35' },
  sleeper: { label: 'SLEEPER', dot: 'bg-indigo-400',  text: 'text-indigo-400',  headerGrad: 'from-indigo-600/75 via-violet-700/55 to-indigo-900/35' },
  hot:     { label: 'HOT',     dot: 'bg-red-400',     text: 'text-red-400',     headerGrad: 'from-red-600/75 via-rose-700/55 to-red-900/35' },
  alert:   { label: 'ALERT',   dot: 'bg-amber-400',   text: 'text-amber-400',   headerGrad: 'from-amber-600/75 via-yellow-700/55 to-amber-900/35' },
};

// ── Shared shell ─────────────────────────────────────────────────────────────
function Shell({
  title, category, subcategory,
  status, Icon, children, onAnalyze, isHero,
}: {
  title: string; category: string; subcategory: string;
  status: string; Icon: React.ElementType; children: React.ReactNode;
  onAnalyze?: () => void; isHero?: boolean;
}) {
  const s = STATUS_CFG[status] ?? STATUS_CFG.value;
  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.09_0.012_280)] border transition-all duration-300',
      isHero
        ? 'border-[oklch(0.28_0.025_260)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.15)]'
        : 'border-[oklch(0.18_0.016_280)] hover:border-[oklch(0.28_0.02_280)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.08)]',
    )}>
      {/* Gradient header */}
      <div className={cn('relative px-4 pt-3.5 pb-3 bg-gradient-to-br', s.headerGrad)}>
        {/* Status top-right */}
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', s.dot)} />
          <span className={cn('text-[9px] font-black uppercase tracking-widest', s.text)}>{s.label}</span>
        </div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className="w-3 h-3 text-white/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{category}</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50 truncate">{subcategory}</span>
        </div>
        <h3 className={cn('font-black text-white leading-snug text-balance pr-16', isHero ? 'text-lg' : 'text-sm')}>
          {title}
        </h3>
      </div>

      <div className="px-4 pb-4 pt-3 space-y-3">
        {children}
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
  );
}

// Tier-colored rank circle for VBD rows
function RankCircle({ rank, tier }: { rank: number; tier: number }) {
  const c = tier === 1
    ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-300'
    : tier === 2
    ? 'bg-slate-400/15 border-slate-400/40 text-slate-300'
    : tier === 3
    ? 'bg-amber-700/20 border-amber-700/40 text-amber-500'
    : 'bg-[oklch(0.10_0.01_280)] border-[oklch(0.18_0.01_280)] text-[oklch(0.38_0.01_280)]';
  return (
    <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full border text-[9px] font-black shrink-0', c)}>
      {rank}
    </span>
  );
}

// ── VBD Rankings ───────────────────────────────────────────────────────────────
function VBDCard({ data, isHero, ...p }: FantasyCardProps) {
  const { players = [], tierCliff, scoringFormat, leagueSize, sport } = data;
  const avatarSport = sport?.toLowerCase() || p.category?.toLowerCase();
  return (
    <Shell {...p} status={data.status ?? 'target'} Icon={Trophy}>
      <div className="space-y-1">
        {players.slice(0, isHero ? 8 : 6).map((pl: any, idx: number) => {
          const isCliff = tierCliff && pl.name === tierCliff.cliffAfterName;
          const photoUrl = pl.photoUrl ?? getPlayerHeadshotUrl(pl.name);
          const rowBg = idx === 0
            ? 'bg-teal-500/8 border-teal-500/20 shadow-[inset_0_0_0_1px_oklch(0.5_0.15_170/0.08)]'
            : 'bg-[oklch(0.08_0.01_280)] border-[oklch(0.15_0.01_280)]';
          return (
            <div key={pl.name}>
              <div className={cn('flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors hover:bg-[oklch(0.12_0.01_280)]', rowBg)}>
                <RankCircle rank={pl.rank ?? idx + 1} tier={pl.tier ?? 4} />
                <PlayerAvatar playerName={pl.name} photoUrl={photoUrl} sport={avatarSport} size="sm" />
                <span className="text-xs font-bold text-white flex-1 truncate min-w-0">
                  {pl.name}
                  <span className="text-[10px] font-normal text-[oklch(0.42_0.01_280)] ml-1">{pl.team}</span>
                </span>
                <PosBadge pos={pl.pos} />
                <TierBadge tier={pl.tier} />
                <span className="text-[11px] font-black tabular-nums text-emerald-400 w-10 text-right shrink-0">+{pl.vbd}</span>
              </div>
              {isCliff && (
                <div className="flex items-center gap-2 py-1 px-2">
                  <div className="flex-1 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                  <span className="text-[9px] font-black text-amber-400 whitespace-nowrap flex items-center gap-1">
                    ▼ TIER CLIFF — {tierCliff.dropPct?.toFixed(1)}% DROP
                  </span>
                  <div className="flex-1 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-[oklch(0.35_0.01_280)] pt-1">
        VBD = pts above replacement · {scoringFormat ?? 'PPR'} · {leagueSize ?? 12}-team
      </p>
    </Shell>
  );
}

// ── Tier Cliffs ────────────────────────────────────────────────────────────────
function CliffCard({ data, ...p }: FantasyCardProps) {
  const { cliffs = [], description } = data;
  return (
    <Shell {...p} status="alert" Icon={AlertTriangle}>
      {description && (
        <p className="text-xs text-[oklch(0.52_0.01_280)] leading-relaxed">{description}</p>
      )}
      <div className="space-y-2">
        {cliffs.map((c: any, i: number) => {
          const urg = c.urgency ?? 0.5;
          const variant = urg > 0.7
            ? 'border-red-500/35 bg-red-500/6 text-red-400'
            : urg > 0.4
            ? 'border-amber-500/35 bg-amber-500/6 text-amber-400'
            : 'border-blue-500/35 bg-blue-500/6 text-blue-400';
          return (
            <div key={i} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2', variant)}>
              <PosBadge pos={c.pos} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold">
                  Cliff after <span className="font-black">{c.cliffAfterName}</span>
                </span>
              </div>
              <span className="text-sm font-black tabular-nums shrink-0">{c.dropPcts?.toFixed(1)}% ↓</span>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-[oklch(0.35_0.01_280)]">
        Miss these positions and you wait 3–4 rounds for equivalent value.
      </p>
    </Shell>
  );
}

// ── Draft Recommendation ───────────────────────────────────────────────────────
function DraftCard({ data, ...p }: FantasyCardProps) {
  const { bestPick, leveragePicks = [], tierCliffAlerts = [] } = data;
  return (
    <Shell {...p} status="target" Icon={Target}>
      {bestPick && (
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/6 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-teal-400">Best Pick</span>
            <ArrowUpRight className="w-3 h-3 text-teal-400" />
          </div>
          <div className="flex items-center gap-2">
            <PosBadge pos={bestPick.pos} />
            <TierBadge tier={bestPick.tier} />
            <span className="text-sm font-black text-white">{bestPick.name}</span>
            <span className="text-xs text-[oklch(0.48_0.01_280)]">{bestPick.team}</span>
            <span className="ml-auto text-sm font-black text-teal-400">+{bestPick.vbd}</span>
          </div>
          {bestPick.reason && (
            <p className="text-[11px] text-[oklch(0.48_0.01_280)] mt-1.5 leading-relaxed">{bestPick.reason}</p>
          )}
        </div>
      )}
      {leveragePicks.length > 0 && (
        <>
          <p className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.42_0.01_280)]">Leverage Plays</p>
          <div className="space-y-1.5">
            {leveragePicks.slice(0, 3).map((lp: any, i: number) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.15_0.01_280)]">
                <span className="text-[10px] font-black text-[oklch(0.38_0.01_280)] w-3 shrink-0">{i + 1}</span>
                <PosBadge pos={lp.pos} />
                <span className="text-xs font-bold text-white flex-1 truncate">{lp.name}</span>
                <span className="text-[10px] text-[oklch(0.42_0.01_280)] truncate max-w-[110px] hidden sm:block">{lp.reason}</span>
                <span className="text-xs font-black tabular-nums text-white shrink-0">+{lp.vbd}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {tierCliffAlerts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tierCliffAlerts.map((a: string, i: number) => (
            <span key={i} className="text-[9px] px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-400 bg-amber-500/6">
              ⚠ {a}
            </span>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ── Waiver Wire ────────────────────────────────────────────────────────────────
function WaiverCard({ data, isHero, ...p }: FantasyCardProps) {
  const { targets = [], description, budgetNote, sport } = data;
  const avatarSport = sport?.toLowerCase() || p.category?.toLowerCase();
  return (
    <Shell {...p} status="hot" Icon={Zap}>
      {description && (
        <p className="text-xs text-[oklch(0.52_0.01_280)] leading-relaxed">{description}</p>
      )}
      <div className="space-y-2">
        {targets.slice(0, isHero ? 4 : 3).map((t: any, i: number) => {
          const photoUrl = t.photoUrl ?? getPlayerHeadshotUrl(t.name);
          const isHot = t.breakoutScore >= 2;
          const isMedium = t.breakoutScore >= 1.5;
          const urgencyBorder = isHot
            ? 'border-red-500/30 bg-red-500/5'
            : isMedium
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-[oklch(0.16_0.015_280)] bg-[oklch(0.08_0.01_280)]';
          return (
            <div key={i} className={cn('px-3 py-2.5 rounded-xl border', urgencyBorder)}>
              <div className="flex items-center gap-2 mb-2">
                <PlayerAvatar playerName={t.name} photoUrl={photoUrl} sport={avatarSport} size="sm" />
                <PosBadge pos={t.pos} />
                <span className="text-xs font-black text-white leading-tight">{t.name}</span>
                <span className="text-[10px] text-[oklch(0.42_0.01_280)]">{t.team}</span>
                <div className="ml-auto flex items-center gap-1.5 shrink-0">
                  {isHot && (
                    <span className="flex items-center gap-0.5 text-[8px] font-black uppercase text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                      <Flame className="w-2.5 h-2.5" /> ADD NOW
                    </span>
                  )}
                  {t.rostered != null && (
                    <span className="text-[9px] text-[oklch(0.40_0.01_280)]">{t.rostered}% owned</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mb-1.5">
                {t.faabBid != null && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-[oklch(0.42_0.01_280)]">FAAB</span>
                    <span className="text-base font-black text-teal-400 tabular-nums">${t.faabBid}</span>
                    {t.faabPct != null && (
                      <span className="text-[9px] text-[oklch(0.38_0.01_280)]">({t.faabPct}%)</span>
                    )}
                  </div>
                )}
                {t.breakoutScore != null && (
                  <div className="flex items-center gap-1 ml-3">
                    <span className="text-[9px] font-bold text-[oklch(0.42_0.01_280)]">BREAKOUT</span>
                    <span className={cn('text-base font-black tabular-nums', isHot ? 'text-red-400' : isMedium ? 'text-amber-400' : 'text-orange-400')}>
                      {t.breakoutScore.toFixed(1)}σ
                    </span>
                  </div>
                )}
              </div>
              {t.reason && (
                <p className="text-[10px] text-[oklch(0.48_0.01_280)] leading-relaxed">{t.reason}</p>
              )}
            </div>
          );
        })}
      </div>
      {budgetNote && (
        <p className="text-[9px] text-[oklch(0.35_0.01_280)] pt-0.5">{budgetNote}</p>
      )}
    </Shell>
  );
}

// ── Player Projection ──────────────────────────────────────────────────────────
function ProjectionCard({ data, ...p }: FantasyCardProps) {
  const { pos, team, pts, vbd, adp, tier, analysis } = data;
  const vbdNum = typeof vbd === 'number' ? vbd : parseFloat(String(vbd ?? 0));
  return (
    <Shell {...p} status={data.status ?? 'value'} Icon={User}>
      <div className="flex items-center gap-2">
        {pos && <PosBadge pos={pos} />}
        {tier && <TierBadge tier={tier} />}
        {team && <span className="text-xs text-[oklch(0.52_0.01_280)] font-medium">{team}</span>}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Proj Pts', val: pts,  color: 'text-white' },
          { label: 'VBD',      val: vbd != null ? `${vbdNum >= 0 ? '+' : ''}${vbdNum}` : null, color: vbdNum >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'ADP',      val: adp,  color: 'text-white' },
        ].filter(s => s.val != null).map(s => (
          <div key={s.label} className="flex flex-col items-center gap-0.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] py-2.5">
            <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">{s.label}</span>
            <span className={cn('text-lg font-black tabular-nums', s.color)}>{s.val}</span>
          </div>
        ))}
      </div>
      {analysis && (
        <p className="text-xs text-[oklch(0.52_0.01_280)] leading-relaxed">{analysis}</p>
      )}
    </Shell>
  );
}

// ── Legacy / generic fallback ──────────────────────────────────────────────────
function LegacyCard({ title, category, subcategory, gradient, data, status, onAnalyze, isHero }: FantasyCardProps) {
  const { focus, description, tips, projectedPoints, adpValue, rosterPct, targetPlayers, platforms } = data;
  const stats = [
    projectedPoints && { label: 'Proj Pts', val: projectedPoints },
    adpValue        && { label: 'ADP',      val: adpValue },
    rosterPct       && { label: 'Roster%',  val: rosterPct },
  ].filter(Boolean) as { label: string; val: string }[];

  const s = STATUS_CFG[status] ?? STATUS_CFG.value;
  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.09_0.012_280)] border transition-all duration-300',
      isHero ? 'border-[oklch(0.28_0.025_260)]' : 'border-[oklch(0.18_0.016_280)] hover:border-[oklch(0.28_0.02_280)]',
    )}>
      {/* Gradient header */}
      <div className={cn('relative px-4 pt-3.5 pb-3 bg-gradient-to-br', s.headerGrad)}>
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', s.dot)} />
          <span className={cn('text-[9px] font-black uppercase tracking-widest', s.text)}>{s.label}</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Trophy className="w-3 h-3 text-white/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{category}</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50">{subcategory}</span>
        </div>
        <h3 className={cn('font-black text-white leading-snug pr-16', isHero ? 'text-lg' : 'text-sm')}>{title}</h3>
      </div>

      <div className="px-4 pb-4 pt-3 space-y-3">
        {(focus || description) && (
          <p className="text-xs text-[oklch(0.52_0.01_280)] leading-relaxed">{focus || description}</p>
        )}
        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {stats.map(s2 => (
              <div key={s2.label} className="flex flex-col items-center gap-0.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] py-2">
                <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">{s2.label}</span>
                <span className="text-sm font-black text-white tabular-nums">{String(s2.val)}</span>
              </div>
            ))}
          </div>
        )}
        {tips && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)]">
            <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[oklch(0.55_0.01_280)] leading-relaxed">
              {Array.isArray(tips) ? tips.join(' · ') : String(tips)}
            </p>
          </div>
        )}
        {(targetPlayers || platforms) && (
          <div className="flex flex-wrap gap-1.5">
            {targetPlayers && (
              <span className="px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] text-[oklch(0.55_0.01_280)]">
                {targetPlayers}
              </span>
            )}
            {platforms && (
              <span className="px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] text-[oklch(0.55_0.01_280)]">
                {Array.isArray(platforms) ? platforms.join(', ') : String(platforms)}
              </span>
            )}
          </div>
        )}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] text-xs font-semibold text-[oklch(0.46_0.01_280)] hover:text-white hover:bg-[oklch(0.14_0.015_280)] hover:border-[oklch(0.26_0.02_280)] transition-all duration-150"
          >
            View Full Analysis <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export function FantasyCard(props: FantasyCardProps) {
  const t = props.data?.fantasyCardType as string | undefined;
  let card;
  if (t === 'vbd_rankings')              card = <VBDCard        {...props} />;
  else if (t === 'tier_cliff')           card = <CliffCard      {...props} />;
  else if (t === 'draft_recommendation') card = <DraftCard      {...props} />;
  else if (t === 'waiver')               card = <WaiverCard     {...props} />;
  else if (t === 'projection')           card = <ProjectionCard {...props} />;
  else                                   card = <LegacyCard     {...props} />;
  return <div className="animate-fade-in-up">{card}</div>;
}
