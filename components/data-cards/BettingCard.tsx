'use client';

import { memo } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlayerAvatar } from './PlayerAvatar';
import { getPlayerHeadshotUrl } from '@/lib/constants';

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
  // Only split on " @ " or " vs " — NOT on individual letters s/v/.
  const atIdx = matchup.indexOf(' @ ');
  if (atIdx >= 0) return { away: matchup.slice(0, atIdx).trim(), home: matchup.slice(atIdx + 3).trim() };
  const vsIdx = matchup.search(/\s+vs\.?\s+/i);
  if (vsIdx >= 0) {
    const vsMatch = matchup.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
    if (vsMatch) return { away: vsMatch[1].trim(), home: vsMatch[2].trim() };
  }
  return null;
}

/** Team abbreviation — use last word for "City Name" patterns, first 3 chars */
function abbr(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  // Standard abbreviation: last word up to 3 chars (Lakers→LAK, Warriors→WAR, Cubs→CUB)
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

/** Sport-specific team avatar colour */
function sportColor(sport?: string): string {
  if (!sport) return 'bg-slate-700';
  if (sport.includes('basketball')) return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
  if (sport.includes('hockey')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  if (sport.includes('football')) return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (sport.includes('baseball')) return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  if (sport.includes('soccer')) return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
  return 'bg-slate-700/40 text-slate-300 border-slate-600/30';
}

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
  const avatarCls = sportColor(data.sport);

  // Player prop: show player photo if available
  const isPlayerProp = !!(data.player) || subcategory.toLowerCase().includes('prop');
  const playerPhotoUrl = isPlayerProp && data.player
    ? (data.playerPhotoUrl ?? getPlayerHeadshotUrl(data.player))
    : null;

  return (
    <article className={cn(
      'group relative w-full rounded-xl overflow-hidden bg-[oklch(0.13_0.015_280)] border transition-all duration-300 backdrop-blur-sm animate-fade-in-up',
      isHero
        ? 'border-[oklch(0.26_0.025_260)] shadow-[0_0_20px_oklch(0.3_0.08_260/0.12)]'
        : 'border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)]',
    )}>
      {/* Left accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 bg-gradient-to-b from-blue-500/60 via-purple-500/40 to-transparent', isHero ? 'w-[2px]' : 'w-[1px]')} />

      <div className={cn('p-4', isHero && 'p-5')}>
        {/* Row 1: sport label + game time */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {category}
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-[10px] text-gray-600 truncate max-w-[120px]">{subcategory}</span>
          </div>
          {data.gameTime && (
            <span className="flex items-center gap-1 text-[10px] text-gray-600">
              <Clock className="w-3 h-3" />
              {data.gameTime}
            </span>
          )}
        </div>

        {/* Player prop header with photo */}
        {isPlayerProp && data.player && (
          <div className="flex items-center gap-3 mb-3 px-2.5 py-2 rounded-lg bg-[oklch(0.10_0.01_280)]">
            <PlayerAvatar
              playerName={data.player}
              photoUrl={playerPhotoUrl}
              sport={data.sport}
              size={isHero ? 'lg' : 'md'}
            />
            <div className="min-w-0">
              <p className={cn('font-black text-white truncate', isHero ? 'text-base' : 'text-sm')}>{data.player}</p>
              {data.stat && (
                <p className="text-[11px] text-gray-400 truncate">{data.stat}</p>
              )}
            </div>
            {data.odds && (
              <span className={cn('ml-auto font-black tabular-nums shrink-0', Number(data.odds) > 0 ? 'text-emerald-400' : 'text-red-400', isHero ? 'text-lg' : 'text-sm')}>
                {Number(data.odds) > 0 ? `+${data.odds}` : data.odds}
              </span>
            )}
          </div>
        )}

        {/* Row 2: Team matchup */}
        {!isPlayerProp && teams ? (
          <div className="flex items-center gap-3 mb-3">
            {/* Away team */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={cn('rounded-lg border text-[11px] font-black flex items-center justify-center shrink-0', isHero ? 'w-10 h-10' : 'w-8 h-8', avatarCls)}>
                {abbr(teams.away)}
              </div>
              <span className={cn('font-semibold text-gray-200 truncate', isHero ? 'text-sm' : 'text-xs')}>{teams.away}</span>
            </div>

            {/* VS divider */}
            <span className="text-[10px] text-gray-700 font-bold shrink-0">@</span>

            {/* Home team */}
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <span className={cn('font-semibold text-gray-200 truncate text-right', isHero ? 'text-sm' : 'text-xs')}>{teams.home}</span>
              <div className={cn('rounded-lg border text-[11px] font-black flex items-center justify-center shrink-0', isHero ? 'w-10 h-10' : 'w-8 h-8', avatarCls)}>
                {abbr(teams.home)}
              </div>
            </div>
          </div>
        ) : !isPlayerProp && (
          <p className="text-sm font-semibold text-gray-200 mb-3 truncate">{title}</p>
        )}

        {/* Final score */}
        {isFinal && data.finalScore && (
          <div className="mb-2.5 px-3 py-1.5 rounded-lg bg-[oklch(0.10_0.01_280)] text-center">
            <span className="text-xs font-bold text-emerald-400">FINAL</span>
            <p className="text-sm font-bold text-white mt-0.5">{data.finalScore}</p>
          </div>
        )}

        {/* Odds grid */}
        {hasOdds && !isFinal && (
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            {/* Moneylines */}
            <div className="col-span-3 grid grid-cols-2 gap-1.5">
              <OddsBox
                label={teams ? abbr(teams.away) : 'Away'}
                value={awayML?.display ?? '—'}
                positive={awayML?.positive}
                sub="ML"
              />
              <OddsBox
                label={teams ? abbr(teams.home) : 'Home'}
                value={homeML?.display ?? '—'}
                positive={homeML?.positive}
                sub="ML"
              />
            </div>

            {/* Spread + O/U */}
            {(spreadHome || ou) && (
              <>
                {spreadHome && (
                  <OddsBox
                    label="HM SPD"
                    value={spreadHome.pts}
                    sub={spreadHome.juice ? `(${spreadHome.juice})` : undefined}
                  />
                )}
                {spreadAway && !spreadHome && (
                  <OddsBox
                    label="AW SPD"
                    value={spreadAway.pts}
                    sub={spreadAway.juice ? `(${spreadAway.juice})` : undefined}
                  />
                )}
                {ou && (
                  <OddsBox
                    label="O/U"
                    value={ou.total}
                    sub={ou.overJ ? `O${ou.overJ} / U${ou.underJ ?? ''}` : 'Total'}
                    span={spreadHome ? 2 : 3}
                  />
                )}
                {!spreadHome && !ou && <div />}
              </>
            )}
          </div>
        )}

        {/* Description (no-odds fallback) */}
        {data.description && !hasOdds && (
          <p className="text-xs text-gray-500 mb-2.5 leading-relaxed">{data.description}</p>
        )}

        {/* Line movement indicator */}
        {(data.lineMove !== undefined || data.movement || data.lineChange) && (
          <div className="mb-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)]">
            {(() => {
              const raw = data.lineMove ?? data.movement ?? data.lineChange ?? '';
              const num = parseFloat(String(raw));
              const up = !isNaN(num) ? num > 0 : String(raw).includes('+') || String(raw).toLowerCase().includes('up');
              const down = !isNaN(num) ? num < 0 : String(raw).includes('-') || String(raw).toLowerCase().includes('down');
              return (
                <>
                  {up && <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />}
                  {down && <TrendingDown className="w-3 h-3 text-red-400 shrink-0" />}
                  {!up && !down && <Minus className="w-3 h-3 text-gray-600 shrink-0" />}
                  <span className="text-[10px] font-semibold text-gray-400">Line move:</span>
                  <span className={cn('text-[10px] font-bold tabular-nums', up ? 'text-emerald-400' : down ? 'text-red-400' : 'text-gray-500')}>
                    {!isNaN(num) && num > 0 ? `+${num}` : String(raw) || '—'}
                  </span>
                  {data.openLine && (
                    <span className="text-[9px] text-gray-600 ml-auto">Open: {data.openLine}</span>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Footer row: bookmaker + book count + analyze */}
        <div className="flex items-center justify-between pt-2 border-t border-[oklch(0.22_0.02_280)]">
          <div className="flex items-center gap-2">
            {data.bookmaker && (
              <span className="text-[10px] font-semibold text-gray-500 bg-[oklch(0.16_0.015_280)] px-2 py-0.5 rounded-md">
                {data.bookmaker}
              </span>
            )}
            {data.bookmakerCount && Number(data.bookmakerCount) > 1 && (
              <span className="text-[10px] text-gray-700">+{Number(data.bookmakerCount) - 1} books</span>
            )}
          </div>

          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="flex items-center gap-1 text-[10px] font-semibold text-gray-600 hover:text-blue-400 transition-colors"
            >
              Analyze <ExternalLink className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

/* ------------------------------------------------------------------ */
/*  OddsBox sub-component                                               */
/* ------------------------------------------------------------------ */
function OddsBox({
  label,
  value,
  sub,
  positive,
  span = 1,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  span?: number;
}) {
  const valueColor =
    positive === true
      ? 'text-emerald-400'
      : positive === false
      ? 'text-red-400'
      : 'text-gray-200';

  return (
    <div
      className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.015_280)]"
      style={span > 1 ? { gridColumn: `span ${span}` } : undefined}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600">{label}</span>
      <span className={cn('text-sm font-bold tabular-nums', valueColor)}>{value}</span>
      {sub && <span className="text-[9px] text-gray-600 leading-none">{sub}</span>}
    </div>
  );
}
