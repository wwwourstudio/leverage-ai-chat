'use client';

import { memo, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, ExternalLink, Zap, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlayerAvatar } from './PlayerAvatar';
import { getPlayerHeadshotUrl, getTeamLogoUrl } from '@/lib/constants';

interface BettingCardData {
  matchup?: string;
  game?: string;
  team?: string;
  finalScore?: string;
  homeOdds?: string;
  awayOdds?: string;
  homeSpread?: string;
  awaySpread?: string;
  overUnder?: string;
  bestLine?: string;
  line?: string;
  over?: string;
  under?: string;
  odds?: string;
  book?: string;
  bookmaker?: string;
  bookmakerCount?: number | string;
  edge?: string;
  impliedWin?: string;
  impliedProb?: string;
  movement?: string;
  confidence?: number | string;
  marketEfficiency?: string;
  recommendation?: string;
  gameTime?: string;
  player?: string;
  stat?: string;
  lineChange?: string;
  oldLine?: string;
  newLine?: string;
  direction?: string;
  sharpMoney?: string;
  sharpPct?: number | string;
  timestamp?: string;
  kellyFraction?: string;
  recommendedStake?: string;
  expectedValue?: string;
  totalBankroll?: string;
  deployed?: string;
  available?: string;
  utilizationRate?: string;
  activeBets?: number | string;
  description?: string;
  note?: string;
  sport?: string;
  status?: string;
  realData?: boolean;
  atsRecord?: string;
  h2hRecord?: string;
  homeRecord?: string;
  awayRecord?: string;
  injuryAlert?: string;
  weatherNote?: string;
  [key: string]: any;
}

interface BettingCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: BettingCardData;
  status: string;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
  isHero?: boolean;
}

/** Parse "Away @ Home" or "Away vs Home" */
function parseTeams(matchup?: string): { away: string; home: string } | null {
  if (!matchup) return null;
  const atIdx = matchup.indexOf(' @ ');
  if (atIdx >= 0) return { away: matchup.slice(0, atIdx).trim(), home: matchup.slice(atIdx + 3).trim() };
  const vsMatch = matchup.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (vsMatch) return { away: vsMatch[1].trim(), home: vsMatch[2].trim() };
  return null;
}

/** Team abbreviation — last word for city+name patterns */
function abbr(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return words[words.length - 1].slice(0, 3).toUpperCase();
}

/** Format moneyline odds with +/- */
function fmtML(val?: string): { display: string; positive: boolean } | null {
  if (!val || val === 'N/A' || val === '—') return null;
  const n = Number(val);
  if (isNaN(n)) return { display: val, positive: false };
  return { display: n > 0 ? `+${n}` : String(n), positive: n > 0 };
}

/** Parse "O/U 238.5: Over -118 / Under -112" */
function parseOU(raw?: string): { total: string; overJ?: string; underJ?: string } | null {
  if (!raw || raw === 'N/A') return null;
  const full = raw.match(/O\/U\s*([\d.]+)(?::\s*Over\s*([+-]?\d+)\s*\/\s*Under\s*([+-]?\d+))?/i);
  if (full) return { total: full[1], overJ: full[2], underJ: full[3] };
  const num = raw.match(/([\d.]+)/);
  return num ? { total: num[1] } : null;
}

/** Parse "+10.5 (-136)" */
function parseSpread(raw?: string): { pts: string; juice?: string } | null {
  if (!raw || raw === 'N/A') return null;
  const m = raw.match(/([+-]?[\d.]+)\s*(?:\(([^)]+)\))?/);
  return m ? { pts: m[1], juice: m[2] } : null;
}

/** Sport gradient / accent colours */
function sportAccent(sport?: string): { bar: string; glow: string; avatar: string } {
  if (sport?.includes('basketball')) return {
    bar: 'from-orange-500 to-amber-400',
    glow: 'shadow-[0_0_24px_oklch(0.65_0.18_45/0.10)]',
    avatar: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  };
  if (sport?.includes('hockey')) return {
    bar: 'from-sky-500 to-blue-400',
    glow: 'shadow-[0_0_24px_oklch(0.65_0.15_230/0.10)]',
    avatar: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  };
  if (sport?.includes('baseball')) return {
    bar: 'from-indigo-500 to-violet-400',
    glow: 'shadow-[0_0_24px_oklch(0.55_0.18_280/0.10)]',
    avatar: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  };
  if (sport?.includes('soccer') || sport?.includes('football')) return {
    bar: 'from-green-500 to-emerald-400',
    glow: 'shadow-[0_0_24px_oklch(0.65_0.18_145/0.10)]',
    avatar: 'bg-green-500/15 text-green-300 border-green-500/30',
  };
  // NFL fallback
  return {
    bar: 'from-green-500 to-emerald-400',
    glow: 'shadow-[0_0_24px_oklch(0.60_0.15_145/0.10)]',
    avatar: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  };
}

/** Implied probability from American moneyline */
function impliedProb(ml?: string): number | null {
  const n = Number(ml);
  if (!ml || isNaN(n)) return null;
  return n < 0 ? Math.round((-n / (-n + 100)) * 100) : Math.round((100 / (n + 100)) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamLogo — shows ESPN logo with initials fallback
// ─────────────────────────────────────────────────────────────────────────────
function TeamLogo({
  name, sport, size = 'md', avatarCls, className,
}: {
  name: string; sport?: string; size?: 'sm' | 'md' | 'lg'; avatarCls: string; className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoUrl = getTeamLogoUrl(name, sport);
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
  const textSizes = { sm: 'text-[10px]', md: 'text-[11px]', lg: 'text-xs' };

  if (logoUrl && !imgFailed) {
    return (
      <div className={cn('rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-white/4', sizes[size], className)}>
        <img
          src={logoUrl}
          alt={name}
          className="w-full h-full object-contain p-0.5 drop-shadow-sm"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }
  return (
    <div className={cn(
      'rounded-xl border flex items-center justify-center shrink-0 font-black',
      sizes[size], textSizes[size], avatarCls, className,
    )}>
      {abbr(name)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MiniProbBar — compact probability bar for confidence / sharp money
// ─────────────────────────────────────────────────────────────────────────────
function MiniProbBar({ pct, label, color = 'bg-blue-400' }: { pct: number; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-semibold text-[oklch(0.45_0.01_280)] w-14 shrink-0 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[oklch(0.16_0.015_280)] overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums text-[oklch(0.75_0.005_85)] w-7 text-right shrink-0">{pct}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SparkLine — mini SVG sparkline for line movement
// ─────────────────────────────────────────────────────────────────────────────
function SparkArrow({ direction, value }: { direction: 'up' | 'down' | 'flat'; value: string }) {
  return (
    <div className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold',
      direction === 'up' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      : direction === 'down' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
      : 'bg-[oklch(0.14_0.01_280)] text-[oklch(0.50_0.01_280)] border border-[oklch(0.20_0.015_280)]',
    )}>
      {direction === 'up' && <TrendingUp className="w-2.5 h-2.5" />}
      {direction === 'down' && <TrendingDown className="w-2.5 h-2.5" />}
      {direction === 'flat' && <Minus className="w-2.5 h-2.5" />}
      {value}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OddsBox
// ─────────────────────────────────────────────────────────────────────────────
function OddsBox({
  label, value, sub, positive, span = 1, highlight,
}: {
  label: string; value: string; sub?: string; positive?: boolean; span?: number; highlight?: boolean;
}) {
  const valueColor = positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-[oklch(0.92_0.005_85)]';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg border transition-colors',
        highlight
          ? 'bg-blue-500/10 border-blue-500/20'
          : 'bg-[oklch(0.09_0.01_280)] border-[oklch(0.18_0.015_280)]',
      )}
      style={span > 1 ? { gridColumn: `span ${span}` } : undefined}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.40_0.01_280)]">{label}</span>
      <span className={cn('text-sm font-black tabular-nums', valueColor)}>{value}</span>
      {sub && <span className="text-[9px] text-[oklch(0.40_0.01_280)] leading-none">{sub}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main card
// ─────────────────────────────────────────────────────────────────────────────
export const BettingCard = memo(function BettingCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
  isHero = false,
}: BettingCardProps) {
  const teams = parseTeams(data.matchup || data.game);
  const homeML = fmtML(data.homeOdds);
  const awayML = fmtML(data.awayOdds);
  const spreadHome = parseSpread(data.homeSpread);
  const spreadAway = parseSpread(data.awaySpread);
  const ou = parseOU(data.overUnder);
  const hasOdds = !!(homeML || awayML || spreadHome || ou);
  const isFinal = data.status === 'FINAL' || !!data.finalScore;
  const accent = sportAccent(data.sport);

  // Player prop detection
  const isPlayerProp = !!(data.player) || subcategory.toLowerCase().includes('prop');
  const playerPhotoUrl = isPlayerProp && data.player
    ? (data.playerPhotoUrl ?? getPlayerHeadshotUrl(data.player))
    : null;

  // Line movement
  const rawMove = data.lineMove ?? data.movement ?? data.lineChange ?? '';
  const moveNum = parseFloat(String(rawMove));
  const moveDir: 'up' | 'down' | 'flat' =
    !isNaN(moveNum) ? (moveNum > 0 ? 'up' : moveNum < 0 ? 'down' : 'flat')
    : String(rawMove).includes('+') ? 'up' : String(rawMove).includes('-') ? 'down' : 'flat';
  const hasLineMove = !!(rawMove && String(rawMove) !== '0');

  // Sharp money %
  const sharpPct = typeof data.sharpPct === 'number' ? data.sharpPct
    : typeof data.sharpPct === 'string' ? parseFloat(data.sharpPct)
    : data.sharpMoney?.match?.(/(\d+)%/) ? parseFloat(data.sharpMoney.match(/(\d+)%/)![1])
    : null;

  // Confidence
  const confPct = typeof data.confidence === 'number' ? data.confidence
    : typeof data.confidence === 'string' ? parseFloat(data.confidence)
    : null;

  // Implied probs from ML
  const homeProb = impliedProb(data.homeOdds);
  const awayProb = impliedProb(data.awayOdds);

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.11_0.012_280)] border transition-all duration-300 animate-fade-in-up',
      isHero
        ? `border-[oklch(0.28_0.025_260)] ${accent.glow}`
        : 'border-[oklch(0.20_0.018_280)] hover:border-[oklch(0.28_0.02_280)]',
    )}>
      {/* Top gradient bar */}
      <div className={cn('absolute left-0 top-0 right-0 h-[2px] bg-gradient-to-r', accent.bar)} />

      <div className={cn('p-4', isHero && 'p-5')}>
        {/* ── Row 1: category label + game time ───────────── */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[oklch(0.50_0.01_280)]">{category}</span>
            <span className="text-[oklch(0.28_0.01_280)]">·</span>
            <span className="text-[10px] text-[oklch(0.40_0.01_280)] truncate max-w-[130px]">{subcategory}</span>
            {data.realData && (
              <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          {data.gameTime && (
            <span className="flex items-center gap-1 text-[10px] text-[oklch(0.40_0.01_280)] shrink-0">
              <Clock className="w-3 h-3" />
              {data.gameTime}
            </span>
          )}
        </div>

        {/* ── Player prop header ───────────────────────────── */}
        {isPlayerProp && data.player && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2.5 rounded-xl bg-[oklch(0.09_0.01_280)] border border-[oklch(0.18_0.015_280)]">
            <PlayerAvatar playerName={data.player} photoUrl={playerPhotoUrl} sport={data.sport} size={isHero ? 'lg' : 'md'} />
            <div className="min-w-0 flex-1">
              <p className={cn('font-black text-[oklch(0.95_0.005_85)] truncate', isHero ? 'text-base' : 'text-sm')}>{data.player}</p>
              {data.stat && <p className="text-[11px] text-[oklch(0.45_0.01_280)] truncate">{data.stat}</p>}
            </div>
            {data.odds && (
              <span className={cn('font-black tabular-nums shrink-0', Number(data.odds) > 0 ? 'text-emerald-400' : 'text-red-400', isHero ? 'text-xl' : 'text-base')}>
                {Number(data.odds) > 0 ? `+${data.odds}` : data.odds}
              </span>
            )}
          </div>
        )}

        {/* ── Team matchup hero ────────────────────────────── */}
        {!isPlayerProp && teams ? (
          <div className={cn(
            'rounded-xl border border-[oklch(0.18_0.015_280)] mb-3 overflow-hidden',
            'bg-gradient-to-b from-[oklch(0.13_0.015_280)] to-[oklch(0.10_0.01_280)]',
          )}>
            <div className="flex items-center gap-2 px-3 py-3">
              {/* Away */}
              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <TeamLogo name={teams.away} sport={data.sport} size={isHero ? 'lg' : 'md'} avatarCls={accent.avatar} />
                <span className="text-[11px] font-bold text-[oklch(0.82_0.005_85)] text-center leading-tight truncate w-full text-center">{teams.away}</span>
                {awayML && (
                  <span className={cn('text-sm font-black tabular-nums', awayML.positive ? 'text-emerald-400' : 'text-[oklch(0.75_0.005_85)]')}>
                    {awayML.display}
                  </span>
                )}
                {awayProb && <span className="text-[9px] text-[oklch(0.40_0.01_280)] tabular-nums">{awayProb}% win</span>}
              </div>

              {/* Centre: scores or VS + time */}
              <div className="flex flex-col items-center gap-1 shrink-0 px-2">
                {isFinal && data.finalScore ? (
                  <>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">FINAL</span>
                    <span className="text-base font-black text-[oklch(0.92_0.005_85)] tabular-nums">{data.finalScore}</span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-bold text-[oklch(0.35_0.01_280)]">@</span>
                    {data.gameTime && <span className="text-[9px] text-[oklch(0.35_0.01_280)]">{data.gameTime}</span>}
                  </>
                )}
              </div>

              {/* Home */}
              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <TeamLogo name={teams.home} sport={data.sport} size={isHero ? 'lg' : 'md'} avatarCls={accent.avatar} />
                <span className="text-[11px] font-bold text-[oklch(0.82_0.005_85)] text-center leading-tight truncate w-full text-center">{teams.home}</span>
                {homeML && (
                  <span className={cn('text-sm font-black tabular-nums', homeML.positive ? 'text-emerald-400' : 'text-[oklch(0.75_0.005_85)]')}>
                    {homeML.display}
                  </span>
                )}
                {homeProb && <span className="text-[9px] text-[oklch(0.40_0.01_280)] tabular-nums">{homeProb}% win</span>}
              </div>
            </div>

            {/* Win probability bar */}
            {awayProb && homeProb && (
              <div className="px-3 pb-2.5">
                <div className="relative h-2 rounded-full overflow-hidden bg-[oklch(0.14_0.01_280)]">
                  <div
                    className={cn('absolute left-0 top-0 h-full rounded-l-full bg-gradient-to-r', accent.bar, 'opacity-70')}
                    style={{ width: `${awayProb}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[8px] text-[oklch(0.35_0.01_280)]">
                  <span>{teams.away} {awayProb}%</span>
                  <span>{homeProb}% {teams.home}</span>
                </div>
              </div>
            )}
          </div>
        ) : !isPlayerProp && (
          <p className="text-sm font-semibold text-[oklch(0.85_0.005_85)] mb-3 truncate">{title}</p>
        )}

        {/* ── Odds grid ────────────────────────────────────── */}
        {hasOdds && !isFinal && (
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {(spreadHome || spreadAway) && (
              <OddsBox
                label={teams ? `${abbr(teams.away)} SPD` : 'Spread'}
                value={spreadAway?.pts ?? spreadHome?.pts ?? '—'}
                sub={spreadAway?.juice ? `(${spreadAway.juice})` : spreadHome?.juice ? `(${spreadHome.juice})` : undefined}
              />
            )}
            {ou && (
              <OddsBox
                label="O/U Total"
                value={ou.total}
                sub={ou.overJ ? `O${ou.overJ}` : 'Total'}
                span={(spreadHome || spreadAway) ? 2 : 3}
                highlight
              />
            )}
            {!spreadHome && !spreadAway && !ou && (homeML || awayML) && (
              <>
                <OddsBox label={teams ? abbr(teams.away) : 'Away'} value={awayML?.display ?? '—'} positive={awayML?.positive} />
                <OddsBox label={teams ? abbr(teams.home) : 'Home'} value={homeML?.display ?? '—'} positive={homeML?.positive} span={2} />
              </>
            )}
          </div>
        )}

        {/* ── Description (no-odds fallback) ──────────────── */}
        {data.description && !hasOdds && (
          <p className="text-xs text-[oklch(0.50_0.01_280)] mb-3 leading-relaxed">{data.description}</p>
        )}

        {/* ── Analytics panel ─────────────────────────────── */}
        {(confPct !== null || sharpPct !== null || hasLineMove) && (
          <div className="rounded-xl bg-[oklch(0.09_0.01_280)] border border-[oklch(0.17_0.015_280)] p-3 mb-3 space-y-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.45_0.01_280)]">Market Analytics</span>
            </div>
            {confPct !== null && (
              <MiniProbBar pct={Math.round(confPct)} label="Confidence" color={confPct >= 70 ? 'bg-emerald-400' : confPct >= 50 ? 'bg-blue-400' : 'bg-amber-400'} />
            )}
            {sharpPct !== null && (
              <MiniProbBar pct={Math.round(sharpPct)} label="Sharp $" color="bg-purple-400" />
            )}
            {hasLineMove && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-semibold text-[oklch(0.45_0.01_280)] w-14 shrink-0 uppercase tracking-wider">Line Move</span>
                <SparkArrow direction={moveDir} value={!isNaN(moveNum) && moveNum !== 0 ? (moveNum > 0 ? `+${moveNum}` : String(moveNum)) : String(rawMove)} />
                {data.openLine && (
                  <span className="text-[9px] text-[oklch(0.38_0.01_280)] ml-auto">Open: {data.openLine}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Records & context ───────────────────────────── */}
        {(data.atsRecord || data.h2hRecord || data.homeRecord || data.awayRecord || data.injuryAlert || data.weatherNote) && (
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {data.atsRecord && (
              <div className="rounded-lg bg-[oklch(0.09_0.01_280)] border border-[oklch(0.17_0.015_280)] px-2.5 py-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.40_0.01_280)]">ATS Record</div>
                <div className="text-xs font-black text-[oklch(0.88_0.005_85)] mt-0.5">{data.atsRecord}</div>
              </div>
            )}
            {data.h2hRecord && (
              <div className="rounded-lg bg-[oklch(0.09_0.01_280)] border border-[oklch(0.17_0.015_280)] px-2.5 py-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.40_0.01_280)]">H2H Record</div>
                <div className="text-xs font-black text-[oklch(0.88_0.005_85)] mt-0.5">{data.h2hRecord}</div>
              </div>
            )}
            {data.homeRecord && (
              <div className="rounded-lg bg-[oklch(0.09_0.01_280)] border border-[oklch(0.17_0.015_280)] px-2.5 py-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.40_0.01_280)]">Home</div>
                <div className="text-xs font-black text-[oklch(0.88_0.005_85)] mt-0.5">{data.homeRecord}</div>
              </div>
            )}
            {data.awayRecord && (
              <div className="rounded-lg bg-[oklch(0.09_0.01_280)] border border-[oklch(0.17_0.015_280)] px-2.5 py-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.40_0.01_280)]">Away</div>
                <div className="text-xs font-black text-[oklch(0.88_0.005_85)] mt-0.5">{data.awayRecord}</div>
              </div>
            )}
            {data.injuryAlert && (
              <div className="col-span-2 rounded-lg bg-red-500/5 border border-red-500/20 px-2.5 py-1.5 flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-red-400 shrink-0" />
                <span className="text-[10px] text-red-300">{data.injuryAlert}</span>
              </div>
            )}
            {data.weatherNote && (
              <div className="col-span-2 rounded-lg bg-sky-500/5 border border-sky-500/20 px-2.5 py-1.5">
                <span className="text-[10px] text-sky-300">☁ {data.weatherNote}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Recommendation ──────────────────────────────── */}
        {data.recommendation && (
          <div className="px-3 py-2 rounded-xl bg-[oklch(0.09_0.01_280)] border border-[oklch(0.18_0.015_280)] mb-3">
            <p className="text-xs text-[oklch(0.65_0.005_85)] leading-relaxed">{data.recommendation}</p>
          </div>
        )}

        {/* ── Footer: bookmaker + analyze ─────────────────── */}
        <div className="flex items-center justify-between pt-2 border-t border-[oklch(0.18_0.018_280)]">
          <div className="flex items-center gap-2">
            {data.bookmaker && (
              <span className="text-[10px] font-semibold text-[oklch(0.45_0.01_280)] bg-[oklch(0.14_0.015_280)] px-2 py-0.5 rounded-md border border-[oklch(0.20_0.015_280)]">
                {data.bookmaker}
              </span>
            )}
            {data.bookmakerCount && Number(data.bookmakerCount) > 1 && (
              <span className="text-[10px] text-[oklch(0.38_0.01_280)]">+{Number(data.bookmakerCount) - 1} books</span>
            )}
          </div>
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="flex items-center gap-1 text-[10px] font-semibold text-[oklch(0.45_0.01_280)] hover:text-blue-400 transition-colors"
            >
              Analyze <ExternalLink className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
});
