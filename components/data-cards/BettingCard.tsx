'use client';

import { memo } from 'react';
import {
  Zap,
  TrendingUp,
  Target,
  Activity,
  Clock,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BettingCardData {
  matchup?: string;
  game?: string;
  team?: string;
  finalScore?: string;
  homeOdds?: string;
  awayOdds?: string;
  homeSpread?: string;
  overUnder?: string;
  bestLine?: string;
  line?: string;
  over?: string;
  under?: string;
  odds?: string;
  book?: string;
  bookmaker?: string;
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
}

const statusConfig: Record<string, { label: string; dotClass: string; textClass: string }> = {
  hot:     { label: 'HOT',     dotClass: 'bg-red-400',     textClass: 'text-red-400' },
  value:   { label: 'VALUE',   dotClass: 'bg-emerald-400', textClass: 'text-emerald-400' },
  optimal: { label: 'OPTIMAL', dotClass: 'bg-sky-400',     textClass: 'text-sky-400' },
  edge:    { label: 'EDGE',    dotClass: 'bg-amber-400',   textClass: 'text-amber-400' },
  live:    { label: 'LIVE',    dotClass: 'bg-emerald-400', textClass: 'text-emerald-400' },
  active:  { label: 'LIVE',    dotClass: 'bg-emerald-400', textClass: 'text-emerald-400' },
};

/** Format moneyline with +/- prefix */
function fmtOdds(val?: string): string | null {
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n)) return val;
  return n > 0 ? `+${n}` : String(n);
}

/**
 * Parse the overUnder field which may be:
 *   "238.5"
 *   "O/U 238.5"
 *   "O/U 238.5: Over -118 / Under -112"
 * Returns just the numeric total and optional over/under juice.
 */
function parseOU(raw?: string): { total: string; overJuice?: string; underJuice?: string } | null {
  if (!raw || raw === 'N/A') return null;
  // Try "O/U 238.5: Over -118 / Under -112"
  const full = raw.match(/O\/U\s*([\d.]+)(?::\s*Over\s*([+-]?\d+)\s*\/\s*Under\s*([+-]?\d+))?/i);
  if (full) {
    return { total: full[1], overJuice: full[2] || undefined, underJuice: full[3] || undefined };
  }
  // Try plain number
  const num = raw.match(/([\d.]+)/);
  if (num) return { total: num[1] };
  return { total: raw };
}

/**
 * Parse "spread (juice)" e.g. "+10.5 (-136)" or just "+10.5"
 */
function parseSpread(raw?: string): { spread: string; juice?: string } | null {
  if (!raw || raw === 'N/A') return null;
  const m = raw.match(/([+-]?[\d.]+)\s*(?:\(([^)]+)\))?/);
  if (m) return { spread: m[1], juice: m[2] || undefined };
  return { spread: raw };
}

/** Parse "Away @ Home" or "Away vs Home" */
function parseTeams(matchup?: string): { away: string; home: string } | null {
  if (!matchup) return null;
  const parts = matchup.split(/\s*[@vs.]+\s*/i);
  if (parts.length < 2) return null;
  return { away: parts[0].trim(), home: parts[1].trim() };
}

export const BettingCard = memo(function BettingCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
}: BettingCardProps) {
  const badge = statusConfig[status] || statusConfig.value;
  const teams = parseTeams(data.matchup || data.game);
  const sportsbook = data.bookmaker || data.book || null;
  const spreadInfo = parseSpread(data.homeSpread);
  const ouInfo = parseOU(data.overUnder);
  const homeML = fmtOdds(data.homeOdds);
  const awayML = fmtOdds(data.awayOdds);
  const hasOddsData = homeML || awayML || spreadInfo || ouInfo;

  return (
    <article className="group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)] transition-all duration-200">
      {/* Top accent bar */}
      <div className={cn('absolute left-0 top-0 right-0 h-0.5 bg-gradient-to-r', gradient)} aria-hidden="true" />

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        {/* Header: category / subcategory + status badge */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-3.5 h-3.5 text-[oklch(0.55_0.01_280)] shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">
              {category}
            </span>
            <span className="text-[oklch(0.3_0.01_280)]" aria-hidden="true">/</span>
            <span className="text-[11px] font-medium text-[oklch(0.45_0.01_280)] truncate">
              {subcategory}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" role="status">
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', badge.dotClass)} />
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', badge.textClass)}>
              {badge.label}
            </span>
          </div>
        </div>

        {/* Matchup title */}
        <h3 className="text-base sm:text-lg font-bold text-[oklch(0.95_0.005_85)] leading-snug text-balance mb-1">
          {title}
        </h3>

        {data.description && (
          <p className="text-sm text-[oklch(0.55_0.01_280)] leading-relaxed mb-3">{data.description}</p>
        )}

        {/* Odds strip */}
        {hasOddsData && (
          <div className="mt-3 rounded-xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.015_280)] overflow-hidden">
            <div className={cn(
              'grid divide-x divide-[oklch(0.20_0.015_280)]',
              // Responsive: 2 cols on small, up to 4 on larger
              [homeML, awayML, spreadInfo, ouInfo].filter(Boolean).length <= 2
                ? 'grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-4'
            )}>
              {awayML && (
                <OddsCell
                  label={teams?.away ?? 'Away'}
                  value={awayML}
                  sublabel="ML"
                  isPositive={Number(data.awayOdds) > 0}
                />
              )}
              {homeML && (
                <OddsCell
                  label={teams?.home ?? 'Home'}
                  value={homeML}
                  sublabel="ML"
                  isPositive={Number(data.homeOdds) > 0}
                />
              )}
              {spreadInfo && (
                <OddsCell
                  label="Spread"
                  value={spreadInfo.spread}
                  sublabel={spreadInfo.juice ? `(${spreadInfo.juice})` : 'HM'}
                />
              )}
              {ouInfo && (
                <OddsCell
                  label="O/U"
                  value={ouInfo.total}
                  sublabel={
                    ouInfo.overJuice && ouInfo.underJuice
                      ? `O ${ouInfo.overJuice} / U ${ouInfo.underJuice}`
                      : 'Total'
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* Meta row */}
        {(sportsbook || data.gameTime || data.edge || data.player || data.confidence !== undefined) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-xs">
            {data.player && <Chip>{data.player}</Chip>}
            {data.stat && <Chip>{data.stat}</Chip>}
            {sportsbook && <Chip>{sportsbook}</Chip>}
            {data.edge && (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                {data.edge}
              </span>
            )}
            {data.confidence !== undefined && data.confidence !== '' && (
              <span className="font-medium text-[oklch(0.55_0.01_280)]">
                {typeof data.confidence === 'number' ? `${data.confidence}%` : data.confidence} conf.
              </span>
            )}
            {data.recommendation && (
              <span className="font-semibold text-[oklch(0.90_0.005_85)]">{data.recommendation}</span>
            )}
            {data.gameTime && (
              <span className="inline-flex items-center gap-1 text-[oklch(0.45_0.01_280)] ml-auto">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {data.gameTime}
              </span>
            )}
          </div>
        )}

        {/* Line movement */}
        {(data.lineChange || data.sharpMoney || data.kellyFraction) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {data.lineChange && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[oklch(0.16_0.02_280)] text-xs font-semibold text-[oklch(0.90_0.005_85)]">
                {data.direction === 'up' ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                )}
                {data.lineChange}
                {data.oldLine && data.newLine && (
                  <span className="text-[oklch(0.50_0.01_280)] font-normal ml-1">
                    {data.oldLine} {'-->'} {data.newLine}
                  </span>
                )}
              </span>
            )}
            {data.sharpMoney && (
              <span className="px-2.5 py-1 rounded-lg bg-[oklch(0.16_0.02_280)] text-xs">
                <span className="text-[oklch(0.50_0.01_280)]">Sharp </span>
                <span className="font-semibold text-[oklch(0.90_0.005_85)]">{data.sharpMoney}</span>
              </span>
            )}
            {data.kellyFraction && (
              <span className="px-2.5 py-1 rounded-lg bg-[oklch(0.16_0.02_280)] text-xs">
                <span className="text-[oklch(0.50_0.01_280)]">Kelly </span>
                <span className="font-semibold text-[oklch(0.90_0.005_85)]">{data.kellyFraction}</span>
              </span>
            )}
          </div>
        )}

        {/* Portfolio stats */}
        {(data.totalBankroll || data.expectedValue) && (
          <div className="mt-3 rounded-xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.015_280)] overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[oklch(0.20_0.015_280)]">
              {data.expectedValue && <OddsCell label="EV" value={data.expectedValue} sublabel="Expected" />}
              {data.recommendedStake && <OddsCell label="Stake" value={data.recommendedStake} sublabel="Rec." />}
              {data.totalBankroll && <OddsCell label="Bankroll" value={data.totalBankroll} sublabel="Total" />}
              {data.available && <OddsCell label="Available" value={data.available} sublabel="Balance" />}
            </div>
          </div>
        )}

        {data.note && (
          <p className="mt-3 text-xs text-[oklch(0.45_0.01_280)] italic leading-relaxed">{data.note}</p>
        )}

        {/* CTA */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 py-2.5 rounded-xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-[oklch(0.85_0.005_85)] hover:bg-[oklch(0.14_0.01_280)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Analyze ${title}`}
          >
            View Full Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
});

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function OddsCell({
  label,
  value,
  sublabel,
  isPositive,
}: {
  label: string;
  value: string;
  sublabel?: string;
  isPositive?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-3 py-3 text-center min-w-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[oklch(0.45_0.01_280)]">
        {sublabel ?? label}
      </span>
      <span
        className={cn(
          'text-base sm:text-lg font-bold tabular-nums leading-none',
          isPositive === true ? 'text-emerald-400' : isPositive === false ? 'text-red-400' : 'text-[oklch(0.92_0.005_85)]'
        )}
      >
        {value}
      </span>
      <span className="text-[11px] font-medium text-[oklch(0.50_0.01_280)] max-w-full mt-0.5 break-words leading-tight">
        {label}
      </span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-md bg-[oklch(0.16_0.02_280)] text-[11px] font-medium text-[oklch(0.60_0.01_280)]">
      {children}
    </span>
  );
}
