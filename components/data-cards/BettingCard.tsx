'use client';

import { memo, useState } from 'react';
import {
  Clock, TrendingUp, TrendingDown, Minus,
  ChevronRight, Zap, Shield, AlertTriangle, Wind, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlayerAvatar } from './PlayerAvatar';
import { getPlayerHeadshotUrl, getTeamLogoUrl } from '@/lib/constants';

interface BookEntry {
  name: string;
  homeOdds: string | null;
  awayOdds: string | null;
}

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
  /** Top 3 bookmakers with H2H ML odds for side-by-side comparison */
  books?: BookEntry[];
  /** Best available home moneyline across all books */
  bestHomeOdds?: string;
  /** Best available away moneyline across all books */
  bestAwayOdds?: string;
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
  lineMove?: string;
  openLine?: string;
  oldLine?: string;
  newLine?: string;
  direction?: string;
  sharpMoney?: string;
  sharpPct?: number | string;
  timestamp?: string;
  kellyFraction?: string;
  recommendedStake?: string;
  expectedValue?: string;
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
  playerPhotoUrl?: string;
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

function parseTeams(matchup?: string): { away: string; home: string } | null {
  if (!matchup) return null;
  const atIdx = matchup.indexOf(' @ ');
  if (atIdx >= 0) return { away: matchup.slice(0, atIdx).trim(), home: matchup.slice(atIdx + 3).trim() };
  const vsMatch = matchup.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (vsMatch) return { away: vsMatch[1].trim(), home: vsMatch[2].trim() };
  return null;
}

function abbr(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return words[words.length - 1].slice(0, 3).toUpperCase();
}

function fmtML(val?: string): { display: string; positive: boolean } | null {
  if (!val || val === 'N/A' || val === '—') return null;
  const n = Number(val);
  if (isNaN(n)) return { display: val, positive: false };
  return { display: n > 0 ? `+${n}` : String(n), positive: n > 0 };
}

function parseOU(raw?: string): { total: string; overJ?: string; underJ?: string } | null {
  if (!raw || raw === 'N/A') return null;
  const full = raw.match(/O\/U\s*([\d.]+)(?::\s*Over\s*([+-]?\d+)\s*\/\s*Under\s*([+-]?\d+))?/i);
  if (full) return { total: full[1], overJ: full[2], underJ: full[3] };
  const num = raw.match(/([\d.]+)/);
  return num ? { total: num[1] } : null;
}

function parseSpread(raw?: string): { pts: string; juice?: string } | null {
  if (!raw || raw === 'N/A') return null;
  const m = raw.match(/([+-]?[\d.]+)\s*(?:\(([^)]+)\))?/);
  return m ? { pts: m[1], juice: m[2] } : null;
}

function impliedProb(ml?: string): number | null {
  const n = Number(ml);
  if (!ml || isNaN(n)) return null;
  return n < 0 ? Math.round((-n / (-n + 100)) * 100) : Math.round((100 / (n + 100)) * 100);
}

/** Calculate bookmaker overround (vig) as a percentage */
function calcVig(homeML?: string, awayML?: string): number | null {
  const h = impliedProb(homeML);
  const a = impliedProb(awayML);
  if (h === null || a === null) return null;
  return Math.round((h + a - 100) * 10) / 10;
}

/** Sport-specific gradient + accent colours */
function sportTheme(sport?: string): {
  headerGrad: string;
  accentColor: string;
  avatarCls: string;
  probBarColor: string;
} {
  if (sport?.includes('basketball')) return {
    headerGrad: 'from-orange-600/80 via-amber-700/60 to-orange-900/40',
    accentColor: 'text-orange-400',
    avatarCls: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    probBarColor: 'from-orange-500 to-amber-400',
  };
  if (sport?.includes('hockey')) return {
    headerGrad: 'from-sky-600/80 via-blue-700/60 to-sky-900/40',
    accentColor: 'text-sky-400',
    avatarCls: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    probBarColor: 'from-sky-500 to-blue-400',
  };
  if (sport?.includes('baseball')) return {
    headerGrad: 'from-indigo-600/80 via-violet-700/60 to-indigo-900/40',
    accentColor: 'text-indigo-400',
    avatarCls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    probBarColor: 'from-indigo-500 to-violet-400',
  };
  // NFL / soccer / default → green
  return {
    headerGrad: 'from-green-600/80 via-emerald-700/60 to-green-900/40',
    accentColor: 'text-emerald-400',
    avatarCls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    probBarColor: 'from-green-500 to-emerald-400',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamLogo
// ─────────────────────────────────────────────────────────────────────────────
function TeamLogo({
  name, sport, avatarCls, isLarge,
}: {
  name: string; sport?: string; avatarCls: string; isLarge?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoUrl = getTeamLogoUrl(name, sport);
  const sz = isLarge ? 'w-14 h-14' : 'w-11 h-11';
  const txtSz = isLarge ? 'text-sm' : 'text-[11px]';

  if (logoUrl && !imgFailed) {
    return (
      <div className={cn('rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-white/5', sz)}>
        <img src={logoUrl} alt={name} className="w-full h-full object-contain p-1 drop-shadow" onError={() => setImgFailed(true)} />
      </div>
    );
  }
  return (
    <div className={cn('rounded-xl border flex items-center justify-center shrink-0 font-black', sz, txtSz, avatarCls)}>
      {abbr(name)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SplitBar — two-sided bar for win probability or sharp money split
// ─────────────────────────────────────────────────────────────────────────────
function SplitBar({ leftPct, leftLabel, rightLabel, leftColor, rightColor }: {
  leftPct: number; leftLabel: string; rightLabel: string; leftColor: string; rightColor: string;
}) {
  return (
    <div className="space-y-1">
      <div className="relative h-2.5 rounded-full overflow-hidden bg-[oklch(0.14_0.01_280)] flex">
        <div className={cn('h-full transition-all duration-700', leftColor)} style={{ width: `${leftPct}%` }} />
        <div className={cn('h-full flex-1', rightColor)} />
      </div>
      <div className="flex justify-between text-[9px] font-semibold text-[oklch(0.40_0.01_280)]">
        <span>{leftLabel} {leftPct}%</span>
        <span>{100 - leftPct}% {rightLabel}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OddsCell
// ─────────────────────────────────────────────────────────────────────────────
function OddsCell({ label, value, sub, positive, highlight, isBest }: {
  label: string; value: string; sub?: string; positive?: boolean; highlight?: boolean; isBest?: boolean;
}) {
  return (
    <div className={cn(
      'flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl border',
      positive === true
        ? 'bg-emerald-500/8 border-emerald-500/25'
        : positive === false
        ? 'bg-red-500/8 border-red-500/20'
        : isBest
        ? 'bg-emerald-500/8 border-emerald-500/25'
        : highlight
        ? 'bg-blue-500/10 border-blue-500/20'
        : 'bg-[oklch(0.08_0.01_280)] border-[oklch(0.17_0.015_280)]',
    )}>
      <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">{label}</span>
      <span className={cn('text-lg font-black tabular-nums',
        positive === true ? 'text-emerald-400' :
        positive === false ? 'text-red-400' :
        'text-white'
      )}>{value}</span>
      {sub && <span className="text-[9px] text-[oklch(0.38_0.01_280)]">{sub}</span>}
      {isBest && <span className="text-[7px] font-black text-emerald-500 uppercase tracking-wider">BEST</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BookComparisonRow — side-by-side ML odds from top 3 bookmakers
// ─────────────────────────────────────────────────────────────────────────────
function BookComparisonRow({
  books,
  homeTeam,
  awayTeam,
  bestHomeOdds,
  bestAwayOdds,
}: {
  books: BookEntry[];
  homeTeam?: string;
  awayTeam?: string;
  bestHomeOdds?: string;
  bestAwayOdds?: string;
}) {
  if (!books || books.length < 2) return null;

  // Shorten book names for compact display
  const shortName = (name: string) =>
    name
      .replace(' Sportsbook', '')
      .replace(' BET', '')
      .replace('DraftKings', 'DK')
      .replace('FanDuel', 'FD')
      .replace('BetMGM', 'MGM')
      .replace('Caesars', 'CZR')
      .replace('PointsBet', 'PB')
      .replace('BetRivers', 'BR')
      .replace('ESPN BET', 'ESPN')
      .replace('bet365', '365');

  const cols = books.length;

  return (
    <div className="rounded-xl bg-[oklch(0.07_0.008_280)] border border-[oklch(0.15_0.012_280)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5">
        <BookOpen className="w-3 h-3 text-[oklch(0.40_0.01_280)]" />
        <span className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.40_0.01_280)]">Odds Comparison</span>
        <span className="ml-auto text-[8px] text-[oklch(0.32_0.01_280)]">ML</span>
      </div>

      {/* Column headers */}
      <div
        className="grid px-3 pb-1"
        style={{ gridTemplateColumns: `1fr repeat(${cols}, minmax(0, 1fr))` }}
      >
        <span />
        {books.map((b) => (
          <span
            key={b.name}
            className="text-[9px] font-bold text-[oklch(0.38_0.01_280)] text-center truncate"
          >
            {shortName(b.name)}
          </span>
        ))}
      </div>

      {/* Away team row */}
      {awayTeam && (
        <div
          className="grid px-3 py-1.5 border-t border-[oklch(0.12_0.01_280)]"
          style={{ gridTemplateColumns: `1fr repeat(${cols}, minmax(0, 1fr))` }}
        >
          <span className="text-[10px] font-semibold text-white/70 truncate self-center">
            {awayTeam.split(' ').slice(-1)[0]}
          </span>
          {books.map((b) => {
            const isBest = b.awayOdds !== null && b.awayOdds === bestAwayOdds;
            const n = b.awayOdds ? parseFloat(b.awayOdds) : NaN;
            return (
              <span
                key={b.name}
                className={cn(
                  'text-[11px] font-black tabular-nums text-center self-center',
                  !b.awayOdds ? 'text-[oklch(0.28_0.01_280)]'
                    : n > 0 ? 'text-emerald-400'
                    : 'text-white/80',
                  isBest && 'text-emerald-300',
                )}
              >
                {b.awayOdds ?? '—'}
                {isBest && <span className="text-[8px] ml-0.5 text-emerald-500">★</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* Home team row */}
      {homeTeam && (
        <div
          className="grid px-3 py-1.5 border-t border-[oklch(0.12_0.01_280)]"
          style={{ gridTemplateColumns: `1fr repeat(${cols}, minmax(0, 1fr))` }}
        >
          <span className="text-[10px] font-semibold text-white/70 truncate self-center">
            {homeTeam.split(' ').slice(-1)[0]}
          </span>
          {books.map((b) => {
            const isBest = b.homeOdds !== null && b.homeOdds === bestHomeOdds;
            const n = b.homeOdds ? parseFloat(b.homeOdds) : NaN;
            return (
              <span
                key={b.name}
                className={cn(
                  'text-[11px] font-black tabular-nums text-center self-center',
                  !b.homeOdds ? 'text-[oklch(0.28_0.01_280)]'
                    : n > 0 ? 'text-emerald-400'
                    : 'text-white/80',
                  isBest && 'text-emerald-300',
                )}
              >
                {b.homeOdds ?? '—'}
                {isBest && <span className="text-[8px] ml-0.5 text-emerald-500">★</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main BettingCard
// ─────────────────────────────────────────────────────────────────────────────
export const BettingCard = memo(function BettingCard({
  title,
  category,
  subcategory,
  data,
  onAnalyze,
  isHero = false,
}: BettingCardProps) {
  const teams = parseTeams(data.matchup || data.game);
  const homeML = fmtML(data.homeOdds);
  const awayML = fmtML(data.awayOdds);
  const spreadHome = parseSpread(data.homeSpread);
  const spreadAway = parseSpread(data.awaySpread);
  const ou = parseOU(data.overUnder);
  const hasOdds = !!(homeML || awayML || spreadHome || spreadAway || ou);
  const isFinal = data.status === 'FINAL' || !!data.finalScore;
  const isLiveGame = data.status === 'LIVE';
  const theme = sportTheme(data.sport);

  const isPlayerProp = !!(data.player) || subcategory.toLowerCase().includes('prop');
  const playerPhotoUrl = isPlayerProp && data.player
    ? (data.playerPhotoUrl ?? getPlayerHeadshotUrl(data.player))
    : null;

  const rawMove = data.lineMove ?? data.movement ?? data.lineChange ?? '';
  const moveNum = parseFloat(String(rawMove));
  const moveDir: 'up' | 'down' | 'flat' =
    !isNaN(moveNum) ? (moveNum > 0 ? 'up' : moveNum < 0 ? 'down' : 'flat')
    : String(rawMove).includes('+') ? 'up' : String(rawMove).includes('-') ? 'down' : 'flat';
  const hasLineMove = !!(rawMove && String(rawMove) !== '0');

  const sharpPct: number | null = typeof data.sharpPct === 'number' ? data.sharpPct
    : typeof data.sharpPct === 'string' ? parseFloat(data.sharpPct) || null
    : data.sharpMoney?.match?.(/(\d+)%/) ? parseFloat(data.sharpMoney.match(/(\d+)%/)![1])
    : null;

  const confPct: number | null = typeof data.confidence === 'number' ? data.confidence
    : typeof data.confidence === 'string' ? parseFloat(data.confidence) || null
    : null;

  const homeProb = impliedProb(data.homeOdds);
  const awayProb = impliedProb(data.awayOdds);

  // Best-odds flags for highlighting in the matchup block
  const isBestHome = !!(data.bestHomeOdds && data.homeOdds && data.homeOdds === data.bestHomeOdds);
  const isBestAway = !!(data.bestAwayOdds && data.awayOdds && data.awayOdds === data.bestAwayOdds);

  // Bookmaker vig (overround)
  const vigPct = calcVig(data.homeOdds, data.awayOdds);

  const books: BookEntry[] = Array.isArray(data.books) ? data.books : [];
  const hasBookComparison = books.length >= 2;

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.09_0.012_280)] border transition-all duration-300',
      isHero
        ? 'border-[oklch(0.28_0.025_260)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.12)]'
        : 'border-[oklch(0.18_0.016_280)] hover:border-[oklch(0.28_0.02_280)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.08)]',
    )}>

      {/* ── Full-bleed gradient header ───────────────────────────────── */}
      <div className={cn('relative px-4 pt-3.5 pb-3 bg-gradient-to-br', theme.headerGrad)}>
        {/* Status badges top-right */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {/* In-game LIVE badge (pulsing) */}
          {isLiveGame && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-[9px] font-black text-emerald-300 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          )}
          {/* Real API data indicator (non-in-game) */}
          {data.realData && !isLiveGame && !isFinal && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              LIVE DATA
            </span>
          )}
          {/* Final badge */}
          {isFinal && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-[9px] font-black text-emerald-300 uppercase tracking-wider">
              FINAL
            </span>
          )}
        </div>

        {/* Category breadcrumb */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{category}</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50 truncate">{subcategory}</span>
        </div>

        {/* Bottom row: game time + edge badge + line move pill */}
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {data.gameTime && (
            <div className="flex items-center gap-1 text-[10px] text-white/60">
              <Clock className="w-3 h-3" />
              {data.gameTime}
            </div>
          )}
          {data.edge && (() => {
            const edgeNum = parseFloat(String(data.edge).replace(/[^0-9.-]/g, ''));
            const edgeCls = !isNaN(edgeNum) && edgeNum >= 5
              ? 'bg-emerald-500/20 border-emerald-500/35 text-emerald-300'
              : !isNaN(edgeNum) && edgeNum >= 2
              ? 'bg-amber-500/20 border-amber-500/35 text-amber-300'
              : 'bg-white/10 border-white/20 text-white/70';
            return (
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider', edgeCls)}>
                EDGE {data.edge}
              </span>
            );
          })()}
          {hasLineMove && (
            <span className={cn(
              'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-[9px] font-bold',
              moveDir === 'up'   ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : moveDir === 'down' ? 'bg-red-500/15 border-red-500/30 text-red-300'
              : 'bg-white/10 border-white/20 text-white/60',
            )}>
              {moveDir === 'up' ? <TrendingUp className="w-2.5 h-2.5" /> : moveDir === 'down' ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
              {!isNaN(moveNum) && moveNum !== 0 ? (moveNum > 0 ? `+${moveNum}` : String(moveNum)) : String(rawMove)}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">

        {/* ── Player prop header ──────────────────────────────────────── */}
        {isPlayerProp && data.player && (
          <div className="flex items-center gap-3 mt-3 px-3 py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)]">
            <PlayerAvatar playerName={data.player} photoUrl={playerPhotoUrl} sport={data.sport} size={isHero ? 'lg' : 'md'} />
            <div className="min-w-0 flex-1">
              <p className={cn('font-black text-white truncate', isHero ? 'text-base' : 'text-sm')}>{data.player}</p>
              {data.stat && <p className="text-[11px] text-[oklch(0.45_0.01_280)] truncate">{data.stat}</p>}
            </div>
            {data.odds && (
              <span className={cn('font-black tabular-nums shrink-0 text-xl', Number(data.odds) > 0 ? 'text-emerald-400' : 'text-red-400')}>
                {Number(data.odds) > 0 ? `+${data.odds}` : data.odds}
              </span>
            )}
          </div>
        )}

        {/* ── Team matchup block ─────────────────────────────────────── */}
        {!isPlayerProp && teams ? (
          <div className="mt-3 rounded-xl border border-[oklch(0.17_0.015_280)] overflow-hidden bg-[oklch(0.08_0.01_280)]">
            <div className="flex items-center gap-2 px-4 py-3">
              {/* Away team */}
              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <TeamLogo name={teams.away} sport={data.sport} avatarCls={theme.avatarCls} isLarge={isHero} />
                <span className={cn('font-black text-white/90 text-center leading-tight truncate w-full', isHero ? 'text-sm' : 'text-xs')}>{teams.away}</span>
                {awayML && (
                  <span className={cn(
                    'font-black tabular-nums',
                    isHero ? 'text-xl' : 'text-lg',
                    awayML.positive ? 'text-emerald-400' : 'text-white/80',
                    isBestAway && 'ring-1 ring-emerald-400/40 rounded-md px-1 bg-emerald-500/8',
                  )}>
                    {awayML.display}
                    {isBestAway && <span className="text-[8px] ml-0.5 text-emerald-500 font-black">★</span>}
                  </span>
                )}
                {awayProb !== null && (
                  <span className={cn(
                    'text-[10px] font-black px-1.5 py-0.5 rounded-full tabular-nums',
                    awayProb > 55 ? 'text-emerald-400 bg-emerald-500/12' :
                    awayProb > 45 ? 'text-white/60 bg-white/5' :
                    'text-[oklch(0.38_0.01_280)] bg-white/5',
                  )}>{awayProb}%</span>
                )}
              </div>

              {/* Centre divider */}
              <div className="flex flex-col items-center gap-1 shrink-0 px-1">
                {isFinal && data.finalScore ? (
                  <span className="text-sm font-black text-white tabular-nums">{data.finalScore}</span>
                ) : (
                  <span className={cn('text-xs font-black uppercase tracking-wider opacity-60', theme.accentColor)}>VS</span>
                )}
                {!isFinal && data.gameTime && (
                  <span className="text-[9px] text-[oklch(0.28_0.01_280)]">{data.gameTime}</span>
                )}
              </div>

              {/* Home team */}
              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <TeamLogo name={teams.home} sport={data.sport} avatarCls={theme.avatarCls} isLarge={isHero} />
                <span className={cn('font-black text-white/90 text-center leading-tight truncate w-full', isHero ? 'text-sm' : 'text-xs')}>{teams.home}</span>
                {homeML && (
                  <span className={cn(
                    'font-black tabular-nums',
                    isHero ? 'text-xl' : 'text-lg',
                    homeML.positive ? 'text-emerald-400' : 'text-white/80',
                    isBestHome && 'ring-1 ring-emerald-400/40 rounded-md px-1 bg-emerald-500/8',
                  )}>
                    {homeML.display}
                    {isBestHome && <span className="text-[8px] ml-0.5 text-emerald-500 font-black">★</span>}
                  </span>
                )}
                {homeProb !== null && (
                  <span className={cn(
                    'text-[10px] font-black px-1.5 py-0.5 rounded-full tabular-nums',
                    homeProb > 55 ? 'text-emerald-400 bg-emerald-500/12' :
                    homeProb > 45 ? 'text-white/60 bg-white/5' :
                    'text-[oklch(0.38_0.01_280)] bg-white/5',
                  )}>{homeProb}%</span>
                )}
              </div>
            </div>

            {/* Win probability split bar */}
            {awayProb !== null && homeProb !== null && (
              <div className="px-4 pb-3">
                <SplitBar
                  leftPct={awayProb}
                  leftLabel={abbr(teams.away)}
                  rightLabel={abbr(teams.home)}
                  leftColor={cn('bg-gradient-to-r', theme.probBarColor, 'opacity-80')}
                  rightColor="bg-[oklch(0.22_0.015_280)]"
                />
              </div>
            )}
          </div>
        ) : !isPlayerProp && (
          <p className="text-sm font-semibold text-white/80 mt-3 truncate">{title}</p>
        )}

        {/* ── Multi-book odds comparison ─────────────────────────────── */}
        {!isFinal && hasBookComparison && teams && (
          <BookComparisonRow
            books={books}
            homeTeam={teams.home}
            awayTeam={teams.away}
            bestHomeOdds={data.bestHomeOdds}
            bestAwayOdds={data.bestAwayOdds}
          />
        )}

        {/* ── Value edge indicator ──────────────────────────────────── */}
        {data.edge && (() => {
          const edgeNum = parseFloat(String(data.edge).replace(/[^0-9.-]/g, ''));
          if (isNaN(edgeNum) || edgeNum < 2) return null;
          return (
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold',
              edgeNum >= 5
                ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300'
                : 'bg-amber-500/10 border border-amber-500/25 text-amber-300',
            )}>
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">{edgeNum >= 5 ? 'Strong edge detected' : 'Potential value'} — {data.edge} edge vs market</span>
            </div>
          );
        })()}

        {/* ── Odds grid ─────────────────────────────────────────────── */}
        {hasOdds && !isFinal && (
          <div className={cn(
            'grid gap-1.5',
            spreadHome && spreadAway && ou
              ? 'grid-cols-3'
              : spreadHome && spreadAway
              ? 'grid-cols-2'
              : 'grid-cols-2 sm:grid-cols-3',
          )}>
            {spreadAway && (
              <OddsCell
                label={teams ? `${abbr(teams.away)} SPREAD` : 'Away Spread'}
                value={spreadAway.pts}
                sub={spreadAway.juice ? `juice ${spreadAway.juice}` : undefined}
                positive={spreadAway.pts?.startsWith('+') ? true : spreadAway.pts?.startsWith('-') ? false : undefined}
              />
            )}
            {spreadHome && (
              <OddsCell
                label={teams ? `${abbr(teams.home)} SPREAD` : 'Home Spread'}
                value={spreadHome.pts}
                sub={spreadHome.juice ? `juice ${spreadHome.juice}` : undefined}
                positive={spreadHome.pts?.startsWith('+') ? true : spreadHome.pts?.startsWith('-') ? false : undefined}
              />
            )}
            {ou && (
              <OddsCell
                label="TOTAL O/U"
                value={ou.total}
                sub={ou.overJ ? `O ${ou.overJ} · U ${ou.underJ ?? '—'}` : undefined}
                highlight
              />
            )}
            {!spreadAway && !spreadHome && !ou && awayML && (
              <OddsCell label={teams ? abbr(teams.away) : 'Away'} value={awayML.display} positive={awayML.positive} isBest={isBestAway} />
            )}
            {!spreadAway && !spreadHome && !ou && homeML && (
              <OddsCell label={teams ? abbr(teams.home) : 'Home'} value={homeML.display} positive={homeML.positive} isBest={isBestHome} />
            )}
          </div>
        )}

        {/* ── Analytics panel ───────────────────────────────────────── */}
        {(confPct !== null || sharpPct !== null || hasLineMove || vigPct !== null) && (
          <div className="rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] p-3 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.42_0.01_280)]">Market Intelligence</span>
            </div>

            {confPct !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-semibold text-[oklch(0.42_0.01_280)]">
                  <span>Model Confidence</span>
                  <span className={cn(
                    confPct >= 70 ? 'text-emerald-400' : confPct >= 50 ? 'text-blue-400' : 'text-amber-400'
                  )}>{Math.round(confPct)}%</span>
                </div>
                <div className="h-2 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700',
                      confPct >= 70 ? 'bg-emerald-400' : confPct >= 50 ? 'bg-blue-400' : 'bg-amber-400'
                    )}
                    style={{ width: `${Math.min(100, confPct)}%` }}
                  />
                </div>
              </div>
            )}

            {sharpPct !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-semibold text-[oklch(0.42_0.01_280)]">
                  <span>Sharp Money</span>
                  <span className={cn(sharpPct >= 60 ? 'text-purple-400' : 'text-[oklch(0.55_0.01_280)]')}>{Math.round(sharpPct)}%</span>
                </div>
                <div className="h-2 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, sharpPct)}%` }}
                  />
                </div>
              </div>
            )}

            {hasLineMove && (
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold text-[oklch(0.42_0.01_280)] uppercase tracking-wider">Line Movement</span>
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border',
                  moveDir === 'up' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : moveDir === 'down' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : 'bg-[oklch(0.14_0.01_280)] text-[oklch(0.48_0.01_280)] border-[oklch(0.20_0.015_280)]',
                )}>
                  {moveDir === 'up' ? <TrendingUp className="w-2.5 h-2.5" /> : moveDir === 'down' ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                  {!isNaN(moveNum) && moveNum !== 0 ? (moveNum > 0 ? `+${moveNum}` : String(moveNum)) : String(rawMove)}
                </span>
              </div>
            )}

            {/* Book vig (overround) */}
            {vigPct !== null && vigPct > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold text-[oklch(0.42_0.01_280)] uppercase tracking-wider">Book Vig</span>
                <span className={cn(
                  'text-[10px] font-bold',
                  vigPct > 5 ? 'text-red-400' : vigPct > 3 ? 'text-amber-400' : 'text-emerald-400',
                )}>
                  {vigPct}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Records ───────────────────────────────────────────────── */}
        {(data.atsRecord || data.h2hRecord || data.homeRecord || data.awayRecord) && (
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'ATS', val: data.atsRecord },
              { label: 'H2H', val: data.h2hRecord },
              { label: 'Home', val: data.homeRecord },
              { label: 'Away', val: data.awayRecord },
            ].filter(r => !!r.val).map(({ label, val }) => (
              <div key={label} className="rounded-lg bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-2.5 py-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">{label}</div>
                <div className="text-xs font-black text-white mt-0.5">{val}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Alerts ────────────────────────────────────────────────── */}
        {data.injuryAlert && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/6 border border-red-500/20">
            <Shield className="w-3 h-3 text-red-400 shrink-0" />
            <span className="text-[10px] text-red-300 leading-relaxed">{data.injuryAlert}</span>
          </div>
        )}
        {data.weatherNote && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/6 border border-sky-500/20">
            <Wind className="w-3 h-3 text-sky-400 shrink-0" />
            <span className="text-[10px] text-sky-300 leading-relaxed">{data.weatherNote}</span>
          </div>
        )}

        {/* ── Recommendation ────────────────────────────────────────── */}
        {data.recommendation && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)]">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-[oklch(0.62_0.005_85)] leading-relaxed">{data.recommendation}</p>
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="pt-2 border-t border-[oklch(0.15_0.015_280)] space-y-2">
          <div className="flex items-center gap-2">
            {data.bookmaker && (
              <span className="text-[10px] font-semibold text-[oklch(0.43_0.01_280)] bg-[oklch(0.13_0.012_280)] px-2 py-0.5 rounded-md border border-[oklch(0.19_0.015_280)]">
                {data.bookmaker}
              </span>
            )}
            {data.bookmakerCount && Number(data.bookmakerCount) > 1 && (
              <span className="flex items-center gap-1 text-[10px] text-[oklch(0.35_0.01_280)]">
                <BookOpen className="w-3 h-3" />
                {Number(data.bookmakerCount)} books
              </span>
            )}
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
      </div>
    </article>
  );
});
