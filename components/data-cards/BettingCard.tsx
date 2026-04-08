'use client';

import { memo, useState, useCallback } from 'react';
import {
  Clock, TrendingUp, TrendingDown, Minus,
  ChevronRight, Zap, Shield, AlertTriangle, Wind, BookOpen,
  Users, Eye, Bookmark,
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
      <div className={cn('rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-[var(--bg-elevated)]', sz)}>
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
      <div className="relative h-2.5 rounded-full overflow-hidden bg-[var(--bg-elevated)] flex">
        <div className={cn('h-full transition-all duration-700', leftColor)} style={{ width: `${leftPct}%` }} />
        <div className={cn('h-full flex-1', rightColor)} />
      </div>
      <div className="flex justify-between text-[9px] font-semibold text-[var(--text-faint)]">
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
        : 'bg-[var(--bg-overlay)] border-[var(--border-subtle)]',
    )}>
      <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      <span className={cn('text-lg font-black tabular-nums',
        positive === true ? 'text-emerald-400' :
        positive === false ? 'text-red-400' :
        'text-foreground'
      )}>{value}</span>
      {sub && <span className="text-[9px] text-[var(--text-muted)]">{sub}</span>}
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
    <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5">
        <BookOpen className="w-3 h-3 text-[var(--text-muted)]" />
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Odds Comparison</span>
        <span className="ml-auto text-[8px] text-[var(--text-faint)]">ML</span>
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
            className="text-[9px] font-bold text-[var(--text-muted)] text-center truncate"
          >
            {shortName(b.name)}
          </span>
        ))}
      </div>

      {/* Away team row */}
      {awayTeam && (
        <div
          className="grid px-3 py-1.5 border-t border-[var(--border-subtle)]"
          style={{ gridTemplateColumns: `1fr repeat(${cols}, minmax(0, 1fr))` }}
        >
          <span className="text-[10px] font-semibold text-[var(--text-muted)] truncate self-center">
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
                  !b.awayOdds ? 'text-[var(--text-faint)]'
                    : n > 0 ? 'text-emerald-400'
                    : 'text-foreground',
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
          className="grid px-3 py-1.5 border-t border-[var(--border-subtle)]"
          style={{ gridTemplateColumns: `1fr repeat(${cols}, minmax(0, 1fr))` }}
        >
          <span className="text-[10px] font-semibold text-[var(--text-muted)] truncate self-center">
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
                  !b.homeOdds ? 'text-[var(--text-faint)]'
                    : n > 0 ? 'text-emerald-400'
                    : 'text-foreground',
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
// TabBar
// ─────────────────────────────────────────────────────────────────────────────
function TabBar({ activeTab, onSelect, accentCls }: {
  activeTab: number; onSelect: (i: number) => void; accentCls: string;
}) {
  const tabs = ['Odds', 'Props', 'Teams', 'History', 'Injuries', 'Watch'];
  return (
    <div className="flex overflow-x-auto gap-1 py-1" style={{ scrollbarWidth: 'none' }}>
      {tabs.map((tab, i) => (
        <button
          key={tab}
          onClick={() => onSelect(i)}
          className={cn(
            'px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 border transition-all duration-150',
            activeTab === i
              ? accentCls
              : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-muted)]',
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabOdds — existing market data (Tab 1)
// ─────────────────────────────────────────────────────────────────────────────
function TabOdds({
  data, teams, isFinal, hasBookComparison, books,
  spreadHome, spreadAway, ou, hasOdds,
  isBestHome, isBestAway, awayML, homeML,
  confPct, sharpPct, hasLineMove, moveDir, moveNum, rawMove, vigPct,
  marketView, setMarketView, accentCls,
}: {
  data: BettingCardData;
  teams: { away: string; home: string } | null;
  isFinal: boolean;
  hasBookComparison: boolean;
  books: BookEntry[];
  spreadHome: { pts: string; juice?: string } | null;
  spreadAway: { pts: string; juice?: string } | null;
  ou: { total: string; overJ?: string; underJ?: string } | null;
  hasOdds: boolean;
  isBestHome: boolean;
  isBestAway: boolean;
  awayML: { display: string; positive: boolean } | null;
  homeML: { display: string; positive: boolean } | null;
  confPct: number | null;
  sharpPct: number | null;
  hasLineMove: boolean;
  moveDir: 'up' | 'down' | 'flat';
  moveNum: number;
  rawMove: string;
  vigPct: number | null;
  marketView: 'ml' | 'spread' | 'total';
  setMarketView: (v: 'ml' | 'spread' | 'total') => void;
  accentCls: string;
}) {
  const hasSpread = !!(spreadHome || spreadAway);
  const hasTotal  = !!ou;

  // Market view pills: show only when we have spread or total data to switch to
  const showPills = !isFinal && (hasSpread || hasTotal);

  return (
    <div className="space-y-3">
      {/* ── Market view pills: [Moneyline] [Spread] [Total] ─── */}
      {showPills && (
        <div className="flex gap-1">
          {(['ml', 'spread', 'total'] as const)
            .filter(v => v === 'ml' || (v === 'spread' && hasSpread) || (v === 'total' && hasTotal))
            .map(v => (
              <button
                key={v}
                onClick={() => setMarketView(v)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all duration-150',
                  marketView === v
                    ? accentCls
                    : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-muted)]',
                )}
              >
                {v === 'ml' ? 'Moneyline' : v === 'spread' ? 'Spread' : 'Total'}
              </button>
            ))}
        </div>
      )}

      {/* Book comparison — only in Moneyline view */}
      {marketView === 'ml' && !isFinal && hasBookComparison && teams && (
        <BookComparisonRow
          books={books}
          homeTeam={teams.home}
          awayTeam={teams.away}
          bestHomeOdds={data.bestHomeOdds}
          bestAwayOdds={data.bestAwayOdds}
        />
      )}

      {/* Value edge indicator — only in Moneyline view */}
      {marketView === 'ml' && data.edge && (() => {
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

      {/* Odds grid — filtered by market view */}
      {hasOdds && !isFinal && (
        <div className="grid grid-cols-2 gap-1.5">
          {/* Moneyline view */}
          {marketView === 'ml' && awayML && (
            <OddsCell label={teams ? abbr(teams.away) : 'Away'} value={awayML.display} positive={awayML.positive} isBest={isBestAway} />
          )}
          {marketView === 'ml' && homeML && (
            <OddsCell label={teams ? abbr(teams.home) : 'Home'} value={homeML.display} positive={homeML.positive} isBest={isBestHome} />
          )}

          {/* Spread view */}
          {marketView === 'spread' && spreadAway && (
            <OddsCell
              label={teams ? `${abbr(teams.away)} SPREAD` : 'Away Spread'}
              value={spreadAway.pts}
              sub={spreadAway.juice ? `juice ${spreadAway.juice}` : undefined}
              positive={spreadAway.pts?.startsWith('+') ? true : spreadAway.pts?.startsWith('-') ? false : undefined}
            />
          )}
          {marketView === 'spread' && spreadHome && (
            <OddsCell
              label={teams ? `${abbr(teams.home)} SPREAD` : 'Home Spread'}
              value={spreadHome.pts}
              sub={spreadHome.juice ? `juice ${spreadHome.juice}` : undefined}
              positive={spreadHome.pts?.startsWith('+') ? true : spreadHome.pts?.startsWith('-') ? false : undefined}
            />
          )}

          {/* Total view — spans both columns */}
          {marketView === 'total' && ou && (
            <div className="col-span-2">
              <OddsCell
                label="TOTAL O/U"
                value={ou.total}
                sub={ou.overJ ? `O ${ou.overJ} · U ${ou.underJ ?? '—'}` : undefined}
                highlight
              />
            </div>
          )}
        </div>
      )}

      {/* Market Intelligence panel — only in Moneyline view */}
      {marketView === 'ml' && (confPct !== null || sharpPct !== null || hasLineMove || vigPct !== null) && (
        <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] p-3 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Market Intelligence</span>
          </div>

          {confPct !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-semibold text-[var(--text-muted)]">
                <span>Model Confidence</span>
                <span className={cn(
                  confPct >= 70 ? 'text-emerald-400' : confPct >= 50 ? 'text-blue-400' : 'text-amber-400'
                )}>{Math.round(confPct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
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
              <div className="flex justify-between text-[9px] font-semibold text-[var(--text-muted)]">
                <span>Sharp Money</span>
                <span className={cn(sharpPct >= 60 ? 'text-purple-400' : 'text-[var(--text-faint)]')}>{Math.round(sharpPct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-700"
                  style={{ width: `${Math.min(100, sharpPct)}%` }}
                />
              </div>
            </div>
          )}

          {hasLineMove && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Line Movement</span>
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border',
                moveDir === 'up' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : moveDir === 'down' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-[var(--bg-elevated)] text-[var(--text-faint)] border-[var(--border-subtle)]',
              )}>
                {moveDir === 'up' ? <TrendingUp className="w-2.5 h-2.5" /> : moveDir === 'down' ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                {!isNaN(moveNum) && moveNum !== 0 ? (moveNum > 0 ? `+${moveNum}` : String(moveNum)) : String(rawMove)}
              </span>
            </div>
          )}

          {sharpPct !== null && sharpPct >= 60 && hasLineMove && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
              <Zap className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[10px] font-bold text-amber-300">Reverse Line Movement</span>
              <span className="text-[9px] text-amber-400/70 ml-0.5">— sharp action against public</span>
            </div>
          )}

          {vigPct !== null && vigPct > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Book Vig</span>
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

      {/* Weather note */}
      {data.weatherNote && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/6 border border-sky-500/20">
          <Wind className="w-3 h-3 text-sky-400 shrink-0" />
          <span className="text-[10px] text-sky-300 leading-relaxed">{data.weatherNote}</span>
        </div>
      )}

      {/* Recommendation */}
      {data.recommendation && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{data.recommendation}</p>
        </div>
      )}

      {/* Description / AI analysis */}
      {data.description && (
        <p className="text-[11px] text-[var(--text-faint)] leading-relaxed px-1">{data.description}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabProps — player props (Tab 2)
// ─────────────────────────────────────────────────────────────────────────────
function TabProps({ data, onAnalyze }: { data: BettingCardData; onAnalyze?: () => void }) {
  const props = Array.isArray(data.playerProps) ? data.playerProps : [];
  if (props.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Users className="w-8 h-8 text-[var(--text-faint)]" />
        <p className="text-[11px] text-[var(--text-muted)]">No prop data available</p>
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] hover:text-foreground hover:border-[var(--border-hover)] transition-all"
          >
            Ask AI about player props for this game →
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {props.map((p: any, i: number) => {
        const oddsNum = parseFloat(p.odds);
        const hitRate = parseFloat(p.hitRate);
        return (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-foreground truncate">{p.player}</p>
              <p className="text-[9px] text-[var(--text-muted)] truncate">{p.team} · {p.stat}</p>
            </div>
            <span className="text-[11px] font-bold text-[var(--text-faint)] tabular-nums shrink-0">{p.line}</span>
            {p.odds && (
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[9px] font-black border shrink-0',
                !isNaN(oddsNum) && oddsNum > 0
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                  : 'bg-red-500/10 text-red-300 border-red-500/25',
              )}>
                {!isNaN(oddsNum) && oddsNum > 0 ? `+${p.odds}` : p.odds}
              </span>
            )}
            {p.hitRate != null && (
              <span className={cn(
                'text-[10px] font-black tabular-nums shrink-0',
                !isNaN(hitRate) && hitRate >= 65 ? 'text-emerald-400'
                : !isNaN(hitRate) && hitRate <= 35 ? 'text-red-400'
                : 'text-white/70',
              )}>
                {p.hitRate}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabTeams — team comparison (Tab 3)
// ─────────────────────────────────────────────────────────────────────────────
function TabTeams({ data, teams, theme }: {
  data: BettingCardData;
  teams: { away: string; home: string } | null;
  theme: { accentColor: string };
}) {
  const tc = data.teamComparison as any;
  const awayAbbr = teams ? abbr(teams.away) : 'AWY';
  const homeAbbr = teams ? abbr(teams.home) : 'HME';

  const rows = [
    { label: 'Home Record', away: null as string | null, home: data.homeRecord ?? null },
    { label: 'Away Record', away: data.awayRecord ?? null, home: null as string | null },
    { label: 'ATS', away: data.atsRecord ?? null, home: data.atsRecord ?? null },
    { label: 'H2H', away: data.h2hRecord ?? null, home: data.h2hRecord ?? null },
    ...(tc ? [
      { label: 'Off. Rank', away: tc.away?.offenseRank != null ? `#${tc.away.offenseRank}` : null, home: tc.home?.offenseRank != null ? `#${tc.home.offenseRank}` : null },
      { label: 'Def. Rank', away: tc.away?.defenseRank != null ? `#${tc.away.defenseRank}` : null, home: tc.home?.defenseRank != null ? `#${tc.home.defenseRank}` : null },
      { label: 'Pts/G', away: tc.away?.pointsPerGame ?? null, home: tc.home?.pointsPerGame ?? null },
      { label: 'Last 10', away: tc.away?.last10 ?? null, home: tc.home?.last10 ?? null },
    ] : []),
  ].filter(r => r.away != null || r.home != null);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Users className="w-8 h-8 text-[var(--text-faint)]" />
        <p className="text-[11px] text-[var(--text-muted)]">No team comparison data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="grid grid-cols-3 px-3 py-2 border-b border-[var(--border-subtle)]">
        <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">Stat</span>
        <span className={cn('text-[10px] font-black uppercase text-center', theme.accentColor)}>{awayAbbr}</span>
        <span className={cn('text-[10px] font-black uppercase text-center', theme.accentColor)}>{homeAbbr}</span>
      </div>
      {rows.map(({ label, away, home }) => (
        <div key={label} className="grid grid-cols-3 px-3 py-2 border-b border-[var(--border-subtle)] last:border-0">
          <span className="text-[9px] text-[var(--text-muted)] self-center">{label}</span>
          <span className="text-[10px] font-bold text-foreground text-center self-center">{away ?? '—'}</span>
          <span className="text-[10px] font-bold text-foreground text-center self-center">{home ?? '—'}</span>
        </div>
      ))}
      {!tc && (
        <p className="text-[9px] text-[var(--text-faint)] px-3 py-2">Full statistical comparison not available</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabHistory — head-to-head history (Tab 4)
// ─────────────────────────────────────────────────────────────────────────────
function TabHistory({ data }: { data: BettingCardData }) {
  const history = Array.isArray(data.h2hHistory) ? data.h2hHistory : [];
  return (
    <div className="space-y-3">
      {(data.atsRecord || data.h2hRecord) && (
        <div className="flex gap-2 flex-wrap">
          {data.atsRecord && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[9px] font-black text-[var(--text-muted)]">
              ATS <span className="text-foreground">{data.atsRecord}</span>
            </span>
          )}
          {data.h2hRecord && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[9px] font-black text-[var(--text-muted)]">
              H2H <span className="text-foreground">{data.h2hRecord}</span>
            </span>
          )}
        </div>
      )}
      {history.length > 0 ? (
        <div className="space-y-1.5">
          {history.map((h: any, i: number) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
              <span className="text-[9px] text-[var(--text-muted)]">{h.date}</span>
              <span className="text-[10px] font-bold text-foreground tabular-nums">{h.score ?? h.result}</span>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[8px] font-black border',
                h.betResult === 'hit'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-red-500/15 text-red-300 border-red-500/30',
              )}>
                {h.betResult === 'hit' ? 'HIT' : 'MISS'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--text-muted)] text-center py-4">No detailed history available</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// InjuryRow — single injury row with bookmark toggle
// ─────────────────────────────────────────────────────────────────────────────
function InjuryRow({ inj, statusCls }: { inj: any; statusCls: (s: string) => string }) {
  const key = `bookmark:player:${(inj.player ?? '').toLowerCase().replace(/\s+/g, '_')}`;
  const [saved, setSaved] = useState(() => {
    try { return !!localStorage.getItem(key); } catch { return false; }
  });

  const toggle = useCallback(() => {
    setSaved(prev => {
      const next = !prev;
      try {
        const WATCHLIST_KEY = 'leverage_watchlist';
        if (next) {
          localStorage.setItem(key, '1');
          const list = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]');
          if (!list.find((e: any) => e.name === inj.player)) {
            list.unshift({ name: inj.player, position: inj.position ?? '', team: inj.team ?? '', addedAt: new Date().toISOString() });
            localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
          }
          window.dispatchEvent(new CustomEvent('watchlist-update', { detail: { count: JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]').length } }));
        } else {
          localStorage.removeItem(key);
          const list = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]').filter((e: any) => e.name !== inj.player);
          localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
          window.dispatchEvent(new CustomEvent('watchlist-update', { detail: { count: list.length } }));
        }
      } catch {}
      return next;
    });
  }, [key, inj.player, inj.position, inj.team]);

  return (
    <div className="px-3 py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black text-foreground truncate">{inj.player}</p>
          <p className="text-[9px] text-[var(--text-muted)]">{inj.team}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-black border', statusCls(inj.status))}>
            {inj.status?.toUpperCase()}
          </span>
          <button
            onClick={toggle}
            title={saved ? 'Remove from bookmarks' : 'Bookmark player'}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              saved
                ? 'text-blue-500 bg-blue-500/10 border border-blue-500/20'
                : 'text-[var(--text-faint)] hover:text-blue-400 hover:bg-blue-500/10',
            )}
          >
            <Bookmark className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
      {inj.impact && (
        <p className="text-[9px] text-[var(--text-muted)] mt-1.5 leading-relaxed">{inj.impact}</p>
      )}
    </div>
  );
}

// TabInjuries — injury reports (Tab 5)
// ─────────────────────────────────────────────────────────────────────────────
function TabInjuries({ data }: { data: BettingCardData }) {
  const injuries = Array.isArray(data.injuries) ? data.injuries : [];

  if (injuries.length > 0) {
    const statusCls = (status: string) => {
      const s = status?.toUpperCase();
      if (s === 'OUT') return 'bg-red-500/15 text-red-300 border-red-500/30';
      if (s === 'DOUBTFUL') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      if (s === 'QUESTIONABLE') return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
      if (s === 'GTD') return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      return 'bg-white/10 text-white/60 border-white/20';
    };
    return (
      <div className="space-y-1.5">
        {injuries.map((inj: any, i: number) => (
          <InjuryRow key={i} inj={inj} statusCls={statusCls} />
        ))}
      </div>
    );
  }

  if (data.injuryAlert) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/6 border border-red-500/20">
        <Shield className="w-3 h-3 text-red-400 shrink-0" />
        <span className="text-[10px] text-red-300 leading-relaxed">{data.injuryAlert}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Shield className="w-8 h-8 text-[var(--text-faint)]" />
      <p className="text-[11px] text-[var(--text-muted)]">No injury reports for this game</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WatchPlayerRow — single player row with bookmark toggle
// ─────────────────────────────────────────────────────────────────────────────
function WatchPlayerRow({ p, sport }: { p: any; sport?: string }) {
  const key = `bookmark:player:${(p.player ?? '').toLowerCase().replace(/\s+/g, '_')}`;
  const [saved, setSaved] = useState(() => {
    try { return !!localStorage.getItem(key); } catch { return false; }
  });

  const toggle = useCallback(() => {
    setSaved(prev => {
      const next = !prev;
      try {
        const WATCHLIST_KEY = 'leverage_watchlist';
        if (next) {
          localStorage.setItem(key, '1');
          const list = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]');
          if (!list.find((e: any) => e.name === p.player)) {
            list.unshift({ name: p.player, position: p.position ?? '', team: p.team ?? '', addedAt: new Date().toISOString() });
            localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
          }
          window.dispatchEvent(new CustomEvent('watchlist-update', { detail: { count: JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]').length } }));
        } else {
          localStorage.removeItem(key);
          const list = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]').filter((e: any) => e.name !== p.player);
          localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
          window.dispatchEvent(new CustomEvent('watchlist-update', { detail: { count: list.length } }));
        }
      } catch {}
      return next;
    });
  }, [key, p.player, p.position, p.team]);

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
      <PlayerAvatar playerName={p.player} photoUrl={p.photoUrl} sport={sport} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black text-foreground truncate">{p.player}</p>
        <p className="text-[9px] text-[var(--text-muted)] mb-1">{p.team}</p>
        <p className="text-[10px] text-[var(--text-faint)] leading-relaxed">{p.reason}</p>
      </div>
      <button
        onClick={toggle}
        title={saved ? 'Remove from bookmarks' : 'Bookmark player'}
        className={cn(
          'flex-shrink-0 p-1.5 rounded-lg transition-all',
          saved
            ? 'text-blue-500 bg-blue-500/10 border border-blue-500/20'
            : 'text-[var(--text-faint)] hover:text-blue-400 hover:bg-blue-500/10',
        )}
      >
        <Bookmark className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

// TabWatch — players to watch (Tab 6)
// ─────────────────────────────────────────────────────────────────────────────
function TabWatch({ data, onAnalyze }: { data: BettingCardData; onAnalyze?: () => void }) {
  const players = Array.isArray(data.playersToWatch) ? data.playersToWatch : [];

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Eye className="w-8 h-8 text-[var(--text-faint)]" />
        <p className="text-[11px] text-[var(--text-muted)]">No watch list available</p>
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] hover:text-foreground hover:border-[var(--border-hover)] transition-all"
          >
            Ask AI who to watch in this game →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {players.map((p: any, i: number) => (
        <WatchPlayerRow key={i} p={p} sport={data.sport} />
      ))}
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

  const [activeTab, setActiveTab] = useState(0);
  const [marketView, setMarketView] = useState<'ml' | 'spread' | 'total'>('ml');

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-background border transition-all duration-300',
      isHero
        ? 'border-[var(--border-subtle)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.12)]'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.08)]',
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
              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]',
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
          <div className="flex items-center gap-3 mt-3 px-3 py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
            <PlayerAvatar playerName={data.player} photoUrl={playerPhotoUrl} sport={data.sport} size={isHero ? 'lg' : 'md'} />
            <div className="min-w-0 flex-1">
              <p className={cn('font-black text-foreground truncate', isHero ? 'text-base' : 'text-sm')}>{data.player}</p>
              {data.stat && <p className="text-[11px] text-[var(--text-faint)] truncate">{data.stat}</p>}
            </div>
            {data.odds && (
              <span className={cn('font-black tabular-nums shrink-0 text-xl', Number(data.odds) > 0 ? 'text-emerald-400' : 'text-red-400')}>
                {Number(data.odds) > 0 ? `+${data.odds}` : data.odds}
              </span>
            )}
          </div>
        )}

        {/* ── Player prop data strip ────────────────────────────────── */}
        {isPlayerProp && data.player && (data.line != null || data.hitRate != null || confPct !== null) && (
          <div className={cn('grid gap-1.5', [data.line != null, data.hitRate != null, confPct !== null].filter(Boolean).length === 3 ? 'grid-cols-3' : [data.line != null, data.hitRate != null, confPct !== null].filter(Boolean).length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
            {data.line != null && (
              <div className="flex flex-col items-center rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-2 py-2">
                <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Line</span>
                <span className="text-base font-black text-foreground tabular-nums">{data.line}</span>
              </div>
            )}
            {data.hitRate != null && (
              <div className="flex flex-col items-center rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-2 py-2">
                <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Hit Rate</span>
                <span className={cn('text-base font-black tabular-nums',
                  Number(data.hitRate) >= 65 ? 'text-emerald-400' : Number(data.hitRate) <= 35 ? 'text-red-400' : 'text-foreground'
                )}>{data.hitRate}%</span>
              </div>
            )}
            {confPct !== null && (
              <div className="flex flex-col items-center rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-2 py-2">
                <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Confidence</span>
                <span className={cn('text-base font-black tabular-nums',
                  confPct >= 70 ? 'text-emerald-400' : confPct >= 50 ? 'text-amber-400' : 'text-red-400'
                )}>{confPct}%</span>
              </div>
            )}
          </div>
        )}

        {/* ── Team matchup block ─────────────────────────────────────── */}
        {!isPlayerProp && teams ? (
          <div className="mt-3 rounded-xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-overlay)]">
            <div className="flex items-center gap-2 px-4 py-3">
              {/* Away team */}
              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <TeamLogo name={teams.away} sport={data.sport} avatarCls={theme.avatarCls} isLarge={isHero} />
                <span className={cn('font-black text-foreground text-center leading-tight truncate w-full', isHero ? 'text-sm' : 'text-xs')}>{teams.away}</span>
                {awayML && (
                  <span className={cn(
                    'font-black tabular-nums',
                    isHero ? 'text-xl' : 'text-lg',
                    awayML.positive ? 'text-emerald-400' : 'text-foreground',
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
                    awayProb > 45 ? 'text-[var(--text-muted)] bg-[var(--bg-elevated)]' :
                    'text-[var(--text-muted)] bg-[var(--bg-elevated)]',
                  )}>{awayProb}%</span>
                )}
              </div>

              {/* Centre divider */}
              <div className="flex flex-col items-center gap-1 shrink-0 px-1">
                {isFinal && data.finalScore ? (
                  <span className="text-sm font-black text-foreground tabular-nums">{data.finalScore}</span>
                ) : (
                  <span className={cn('text-xs font-black uppercase tracking-wider opacity-60', theme.accentColor)}>VS</span>
                )}
                {!isFinal && data.gameTime && (
                  <span className="text-[9px] text-[var(--text-faint)]">{data.gameTime}</span>
                )}
              </div>

              {/* Home team */}
              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <TeamLogo name={teams.home} sport={data.sport} avatarCls={theme.avatarCls} isLarge={isHero} />
                <span className={cn('font-black text-foreground text-center leading-tight truncate w-full', isHero ? 'text-sm' : 'text-xs')}>{teams.home}</span>
                {homeML && (
                  <span className={cn(
                    'font-black tabular-nums',
                    isHero ? 'text-xl' : 'text-lg',
                    homeML.positive ? 'text-emerald-400' : 'text-foreground',
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
                    homeProb > 45 ? 'text-[var(--text-muted)] bg-[var(--bg-elevated)]' :
                    'text-[var(--text-muted)] bg-[var(--bg-elevated)]',
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
                  rightColor="bg-[var(--bg-elevated)]"
                />
              </div>
            )}
          </div>
        ) : !isPlayerProp && (
          <p className="text-sm font-semibold text-foreground mt-3 truncate">{title}</p>
        )}

        {/* ── Tab bar ───────────────────────────────────────────────── */}
        <TabBar activeTab={activeTab} onSelect={setActiveTab} accentCls={theme.avatarCls} />

        {/* ── Tab content ───────────────────────────────────────────── */}
        {activeTab === 0 && (
          <TabOdds
            data={data}
            teams={teams}
            isFinal={isFinal}
            hasBookComparison={hasBookComparison}
            books={books}
            spreadHome={spreadHome}
            spreadAway={spreadAway}
            ou={ou}
            hasOdds={hasOdds}
            isBestHome={isBestHome}
            isBestAway={isBestAway}
            awayML={awayML}
            homeML={homeML}
            confPct={confPct}
            sharpPct={sharpPct}
            hasLineMove={hasLineMove}
            moveDir={moveDir}
            moveNum={moveNum}
            rawMove={String(rawMove)}
            vigPct={vigPct}
            marketView={marketView}
            setMarketView={setMarketView}
            accentCls={theme.avatarCls}
          />
        )}
        {activeTab === 1 && <TabProps data={data} onAnalyze={onAnalyze} />}
        {activeTab === 2 && <TabTeams data={data} teams={teams} theme={theme} />}
        {activeTab === 3 && <TabHistory data={data} />}
        {activeTab === 4 && <TabInjuries data={data} />}
        {activeTab === 5 && <TabWatch data={data} onAnalyze={onAnalyze} />}

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center gap-2">
            {data.bookmaker && (
              <span className="text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--bg-surface)] px-2 py-0.5 rounded-md border border-[var(--border-subtle)]">
                {data.bookmaker}
              </span>
            )}
            {data.bookmakerCount && Number(data.bookmakerCount) > 1 && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
                <BookOpen className="w-3 h-3" />
                {Number(data.bookmakerCount)} books
              </span>
            )}
          </div>
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-faint)] hover:text-foreground hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] transition-all duration-150"
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
