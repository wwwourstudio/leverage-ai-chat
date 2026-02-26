'use client';

import { Trophy, Target, Zap, AlertTriangle, User, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

// ── Position badge ────────────────────────────────────────────────────────────
const POS_COLORS: Record<string, string> = {
  QB:  'text-red-400    bg-red-400/10    border-red-400/30',
  RB:  'text-green-400  bg-green-400/10  border-green-400/30',
  WR:  'text-blue-400   bg-blue-400/10   border-blue-400/30',
  TE:  'text-orange-400 bg-orange-400/10 border-orange-400/30',
  K:   'text-purple-400 bg-purple-400/10 border-purple-400/30',
  DEF: 'text-slate-400  bg-slate-400/10  border-slate-400/30',
};
function PosBadge({ pos }: { pos: string }) {
  const c = POS_COLORS[pos] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/30';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border', c)}>
      {pos}
    </span>
  );
}

// ── Tier badge ────────────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: number }) {
  const label = ['T1', 'T2', 'T3', 'T4'][Math.min(tier - 1, 3)] ?? 'T4';
  const c = tier === 1 ? 'text-yellow-400 bg-yellow-400/10'
    : tier === 2     ? 'text-emerald-400 bg-emerald-400/10'
    : 'text-slate-400 bg-slate-400/10';
  return <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold', c)}>{label}</span>;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  target:  { label: 'TARGET',  dot: 'bg-teal-400',    text: 'text-teal-400' },
  value:   { label: 'VALUE',   dot: 'bg-emerald-400', text: 'text-emerald-400' },
  sleeper: { label: 'SLEEPER', dot: 'bg-indigo-400',  text: 'text-indigo-400' },
  hot:     { label: 'HOT',     dot: 'bg-red-400',     text: 'text-red-400' },
  alert:   { label: 'ALERT',   dot: 'bg-red-400',     text: 'text-red-400' },
};

// ── Shared card shell ─────────────────────────────────────────────────────────
function Shell({
  title, category, subcategory, gradient,
  status, Icon, children, onAnalyze,
}: {
  title: string; category: string; subcategory: string; gradient: string;
  status: string; Icon: React.ElementType; children: React.ReactNode;
  onAnalyze?: () => void;
}) {
  const s = STATUS[status] ?? STATUS.value;
  return (
    <article className="group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.12_0.015_280)] border border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)] transition-all duration-200">
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} />
      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5 relative">
        {/* header */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-[oklch(0.18_0.02_280)] flex items-center justify-center shrink-0">
              <Icon className="w-3 h-3 text-[oklch(0.60_0.01_280)]" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">{category}</span>
            <span className="text-[oklch(0.3_0.01_280)]">/</span>
            <span className="text-[11px] font-medium text-[oklch(0.45_0.01_280)] truncate">{subcategory}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', s.dot)} />
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', s.text)}>{s.label}</span>
          </div>
        </div>
        <h3 className="text-base sm:text-lg font-bold text-[oklch(0.95_0.005_85)] leading-snug mb-3">{title}</h3>
        {children}
        {onAnalyze && (
          <button onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 py-2.5 rounded-xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-[oklch(0.85_0.005_85)] hover:bg-[oklch(0.14_0.01_280)] transition-all duration-150">
            Full Analysis <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

// ── VBD Rankings ──────────────────────────────────────────────────────────────
function VBDCard({ data, ...p }: FantasyCardProps) {
  const { players = [], tierCliff, scoringFormat, leagueSize } = data;
  return (
    <Shell {...p} status={data.status ?? 'target'} Icon={Trophy}>
      <div className="space-y-1">
        {players.slice(0, 8).map((pl: any) => {
          const isCliff = tierCliff && pl.name === tierCliff.cliffAfterName;
          return (
            <div key={pl.name}>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[oklch(0.10_0.01_280)] hover:bg-[oklch(0.13_0.01_280)] transition-colors">
                <span className="text-[11px] font-bold tabular-nums text-[oklch(0.40_0.01_280)] w-4 shrink-0">{pl.rank}</span>
                <span className="text-xs font-semibold text-[oklch(0.88_0.005_85)] flex-1 truncate min-w-0">
                  {pl.name}
                  <span className="text-[10px] font-normal text-[oklch(0.45_0.01_280)] ml-1">{pl.team}</span>
                </span>
                <PosBadge pos={pl.pos} />
                <TierBadge tier={pl.tier} />
                <span className="text-[11px] font-black tabular-nums text-[oklch(0.88_0.005_85)] w-10 text-right shrink-0">+{pl.vbd}</span>
              </div>
              {isCliff && (
                <div className="flex items-center gap-2 py-0.5 px-2.5">
                  <div className="flex-1 h-px bg-yellow-500/40" />
                  <span className="text-[10px] font-bold text-yellow-400 whitespace-nowrap">
                    ▼ {tierCliff.dropPct.toFixed(1)}% DROP
                  </span>
                  <div className="flex-1 h-px bg-yellow-500/40" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-[oklch(0.40_0.01_280)]">VBD = pts above replacement · {scoringFormat ?? 'PPR'} · {leagueSize ?? 12}-team</p>
    </Shell>
  );
}

// ── Tier Cliffs ───────────────────────────────────────────────────────────────
function CliffCard({ data, ...p }: FantasyCardProps) {
  const { cliffs = [], description } = data;
  return (
    <Shell {...p} status="alert" Icon={AlertTriangle}>
      {description && <p className="text-xs text-[oklch(0.50_0.01_280)] leading-relaxed mb-3">{description}</p>}
      <div className="space-y-2">
        {cliffs.map((c: any, i: number) => {
          const urg = c.urgency ?? 0.5;
          const col = urg > 0.7
            ? 'border-red-500/40 bg-red-500/5 text-red-400'
            : urg > 0.4
            ? 'border-yellow-500/40 bg-yellow-500/5 text-yellow-400'
            : 'border-blue-500/40 bg-blue-500/5 text-blue-400';
          return (
            <div key={i} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', col)}>
              <PosBadge pos={c.pos} />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold">
                  Cliff after <span className="font-black">{c.cliffAfterName}</span>
                </span>
              </div>
              <span className="text-[11px] font-black tabular-nums shrink-0">{c.dropPcts?.toFixed(1)}% ↓</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-[oklch(0.40_0.01_280)]">Miss these players and you may wait 3–4 rounds for equivalent value.</p>
    </Shell>
  );
}

// ── Draft Recommendation ──────────────────────────────────────────────────────
function DraftCard({ data, ...p }: FantasyCardProps) {
  const { bestPick, leveragePicks = [], tierCliffAlerts = [] } = data;
  return (
    <Shell {...p} status="target" Icon={Target}>
      {bestPick && (
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 px-3 py-2.5 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block mb-1">Best Pick</span>
          <div className="flex items-center gap-2">
            <PosBadge pos={bestPick.pos} />
            <TierBadge tier={bestPick.tier} />
            <span className="text-sm font-black text-[oklch(0.95_0.005_85)]">{bestPick.name}</span>
            <span className="text-[11px] text-[oklch(0.50_0.01_280)]">{bestPick.team}</span>
            <span className="ml-auto text-sm font-black tabular-nums text-teal-400">+{bestPick.vbd}</span>
          </div>
          {bestPick.reason && <p className="text-[11px] text-[oklch(0.50_0.01_280)] mt-1 leading-relaxed">{bestPick.reason}</p>}
        </div>
      )}
      {leveragePicks.length > 0 && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[oklch(0.45_0.01_280)] mb-1.5">Leverage Plays</p>
          <div className="space-y-1.5">
            {leveragePicks.slice(0, 3).map((lp: any, i: number) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[oklch(0.10_0.01_280)]">
                <span className="text-[10px] font-bold text-[oklch(0.40_0.01_280)] w-3">{i + 1}</span>
                <PosBadge pos={lp.pos} />
                <span className="text-xs font-semibold text-[oklch(0.85_0.005_85)] flex-1 truncate">{lp.name}</span>
                <span className="text-[10px] text-[oklch(0.45_0.01_280)] truncate max-w-[110px] hidden sm:block">{lp.reason}</span>
                <span className="text-[11px] font-black tabular-nums text-[oklch(0.85_0.005_85)] shrink-0">+{lp.vbd}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {tierCliffAlerts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tierCliffAlerts.map((a: string, i: number) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border border-yellow-500/30 text-yellow-400 bg-yellow-500/5">⚠ {a}</span>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ── Waiver Wire ───────────────────────────────────────────────────────────────
function WaiverCard({ data, ...p }: FantasyCardProps) {
  const { targets = [], description, budgetNote } = data;
  return (
    <Shell {...p} status="hot" Icon={Zap}>
      {description && <p className="text-xs text-[oklch(0.50_0.01_280)] leading-relaxed mb-3">{description}</p>}
      <div className="space-y-2">
        {targets.slice(0, 4).map((t: any, i: number) => (
          <div key={i} className="px-2.5 py-2 rounded-lg bg-[oklch(0.10_0.01_280)]">
            <div className="flex items-center gap-2 mb-0.5">
              <PosBadge pos={t.pos} />
              <span className="text-xs font-black text-[oklch(0.92_0.005_85)]">{t.name}</span>
              <span className="text-[10px] text-[oklch(0.45_0.01_280)]">{t.team}</span>
              <span className="ml-auto text-[10px] text-[oklch(0.45_0.01_280)]">{t.rostered}% rostered</span>
            </div>
            <div className="flex items-center gap-3 mb-0.5">
              <span className="text-[10px] font-bold text-[oklch(0.45_0.01_280)]">FAAB</span>
              <span className="text-sm font-black text-teal-400">${t.faabBid}</span>
              <span className="text-[10px] text-[oklch(0.40_0.01_280)]">({t.faabPct}%)</span>
              <span className="text-[10px] font-bold text-[oklch(0.45_0.01_280)]">BREAKOUT</span>
              <span className="text-sm font-black text-orange-400">{t.breakoutScore?.toFixed(1)}σ</span>
            </div>
            <p className="text-[10px] text-[oklch(0.45_0.01_280)] leading-relaxed">{t.reason}</p>
          </div>
        ))}
      </div>
      {budgetNote && <p className="mt-2 text-[10px] text-[oklch(0.38_0.01_280)]">{budgetNote}</p>}
    </Shell>
  );
}

// ── Player Projection ─────────────────────────────────────────────────────────
function ProjectionCard({ data, ...p }: FantasyCardProps) {
  const { pos, team, pts, vbd, adp, tier, analysis } = data;
  return (
    <Shell {...p} status={data.status ?? 'value'} Icon={User}>
      <div className="flex items-center gap-2 mb-3">
        {pos && <PosBadge pos={pos} />}
        {tier && <TierBadge tier={tier} />}
        {team && <span className="text-xs text-[oklch(0.55_0.01_280)] font-medium">{team}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Proj Pts', val: pts, color: '' },
          { label: 'VBD',      val: vbd != null ? `${vbd >= 0 ? '+' : ''}${vbd}` : null, color: vbd >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'ADP',      val: adp, color: '' },
        ].filter(s => s.val != null).map(s => (
          <div key={s.label} className="flex flex-col items-center rounded-lg bg-[oklch(0.10_0.01_280)] py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(0.45_0.01_280)]">{s.label}</span>
            <span className={cn('text-lg font-black tabular-nums text-[oklch(0.92_0.005_85)]', s.color)}>{s.val}</span>
          </div>
        ))}
      </div>
      {analysis && <p className="text-xs text-[oklch(0.55_0.01_280)] leading-relaxed">{analysis}</p>}
    </Shell>
  );
}

// ── Legacy generic card (backward compat) ─────────────────────────────────────
function LegacyCard({ title, category, subcategory, gradient, data, status, onAnalyze }: FantasyCardProps) {
  const s = STATUS[status] ?? STATUS.value;
  const { focus, description, tips, projectedPoints, adpValue, rosterPct, targetPlayers, targetPosition, platforms } = data;
  const stats = [
    projectedPoints && { label: 'Proj Pts', value: projectedPoints },
    adpValue        && { label: 'ADP',      value: adpValue },
    rosterPct       && { label: 'Roster%',  value: rosterPct },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <article className="group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.12_0.015_280)] border border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)] transition-all duration-200">
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} />
      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5 relative">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-[oklch(0.18_0.02_280)] flex items-center justify-center shrink-0">
              <Trophy className="w-3 h-3 text-[oklch(0.60_0.01_280)]" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">{category}</span>
            <span className="text-[oklch(0.3_0.01_280)]">/</span>
            <span className="text-[11px] font-medium text-[oklch(0.45_0.01_280)] truncate">{subcategory}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', s.dot)} />
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', s.text)}>{s.label}</span>
          </div>
        </div>
        <h3 className="text-base sm:text-lg font-bold text-[oklch(0.95_0.005_85)] leading-snug mb-1">{title}</h3>
        {(focus || description) && (
          <p className="text-sm text-[oklch(0.55_0.01_280)] leading-relaxed mb-3">{focus || description}</p>
        )}
        {stats.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.map(s2 => (
              <div key={s2.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(0.45_0.01_280)]">{s2.label}</span>
                <span className="text-sm font-black tabular-nums text-[oklch(0.92_0.005_85)]">{String(s2.value)}</span>
              </div>
            ))}
          </div>
        )}
        {tips && (
          <p className="mt-3 text-xs text-[oklch(0.50_0.01_280)] leading-relaxed">
            {Array.isArray(tips) ? tips.join(' — ') : tips}
          </p>
        )}
        {onAnalyze && (
          <button onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 py-2.5 rounded-xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-[oklch(0.85_0.005_85)] hover:bg-[oklch(0.14_0.01_280)] transition-all duration-150">
            View Full Analysis <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function FantasyCard(props: FantasyCardProps) {
  const t = props.data?.fantasyCardType as string | undefined;
  let card;
  if (t === 'vbd_rankings')         card = <VBDCard        {...props} />;
  else if (t === 'tier_cliff')      card = <CliffCard       {...props} />;
  else if (t === 'draft_recommendation') card = <DraftCard  {...props} />;
  else if (t === 'waiver')          card = <WaiverCard      {...props} />;
  else if (t === 'projection')      card = <ProjectionCard  {...props} />;
  else                              card = <LegacyCard      {...props} />;
  return <div className="animate-fade-in-up">{card}</div>;
}
