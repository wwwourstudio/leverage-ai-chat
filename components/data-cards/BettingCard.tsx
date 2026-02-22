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

const statusConfig: Record<string, { icon: typeof Zap; label: string; dotClass: string; textClass: string }> = {
  hot:     { icon: Zap,        label: 'HOT',     dotClass: 'bg-red-400',     textClass: 'text-red-400' },
  value:   { icon: TrendingUp, label: 'VALUE',   dotClass: 'bg-emerald-400', textClass: 'text-emerald-400' },
  optimal: { icon: Target,     label: 'OPTIMAL', dotClass: 'bg-sky-400',     textClass: 'text-sky-400' },
  edge:    { icon: Activity,   label: 'EDGE',    dotClass: 'bg-amber-400',   textClass: 'text-amber-400' },
  live:    { icon: Activity,   label: 'LIVE',    dotClass: 'bg-emerald-400', textClass: 'text-emerald-400' },
};

function formatOdds(val?: string) {
  if (!val) return null;
  const num = Number(val);
  if (isNaN(num)) return val;
  return num > 0 ? `+${num}` : String(num);
}

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
  const hasSpread = data.homeSpread && data.homeSpread !== 'N/A';
  const hasTotal = data.overUnder && data.overUnder !== 'N/A';
  const homeOdds = formatOdds(data.homeOdds);
  const awayOdds = formatOdds(data.awayOdds);
  const hasOddsData = homeOdds || awayOdds || hasSpread || hasTotal;

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden',
        'bg-card border border-border/60',
        'hover:border-border/90 transition-all duration-200'
      )}
    >
      {/* Gradient accent -- left edge */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} aria-hidden="true" />

      <div className="pl-5 pr-5 py-4 sm:pl-6 sm:pr-6 sm:py-5">
        {/* -- TOP BAR: category + badge -- */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {category}
            </span>
            <span className="text-border" aria-hidden="true">{'/'}</span>
            <span className="text-[11px] font-medium text-muted-foreground/60 truncate">
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

        {/* -- MATCHUP TITLE -- */}
        <h3 className="text-base sm:text-lg font-bold text-card-foreground leading-snug text-balance mb-1">
          {title}
        </h3>

        {/* Description */}
        {data.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {data.description}
          </p>
        )}

        {/* -- ODDS STRIP: horizontal full-width row -- */}
        {hasOddsData && (
          <div className="mt-3 rounded-xl bg-muted/40 border border-border/30 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/30">
              {awayOdds && (
                <OddsCell
                  label={teams?.away ?? 'Away'}
                  value={awayOdds}
                  sublabel="ML"
                  isPositive={Number(data.awayOdds) > 0}
                />
              )}
              {homeOdds && (
                <OddsCell
                  label={teams?.home ?? 'Home'}
                  value={homeOdds}
                  sublabel="ML"
                  isPositive={Number(data.homeOdds) > 0}
                />
              )}
              {hasSpread && (
                <OddsCell label="Spread" value={data.homeSpread!} sublabel="HM" />
              )}
              {hasTotal && (
                <OddsCell label="O/U" value={data.overUnder!} sublabel="Total" />
              )}
            </div>
          </div>
        )}

        {/* -- META ROW: book, time, edge -- */}
        {(sportsbook || data.gameTime || data.edge || data.movement || data.player || data.confidence !== undefined) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-muted-foreground">
            {data.player && <MetaChip label={data.player} />}
            {data.stat && <MetaChip label={data.stat} />}
            {sportsbook && <MetaChip label={sportsbook} />}
            {data.edge && (
              <span className="inline-flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                <span className="font-semibold text-emerald-400">{data.edge}</span>
              </span>
            )}
            {data.confidence !== undefined && data.confidence !== '' && (
              <span className="font-medium text-muted-foreground/80">
                {typeof data.confidence === 'number' ? `${data.confidence}%` : data.confidence} conf.
              </span>
            )}
            {data.recommendation && (
              <span className="font-semibold text-card-foreground">{data.recommendation}</span>
            )}
            {data.gameTime && (
              <span className="inline-flex items-center gap-1 text-muted-foreground/50 ml-auto">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {data.gameTime}
              </span>
            )}
          </div>
        )}

        {/* -- LINE MOVEMENT -- */}
        {(data.lineChange || data.sharpMoney || data.kellyFraction) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {data.lineChange && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/50 text-xs font-semibold text-card-foreground">
                {data.direction === 'up' ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                )}
                {data.lineChange}
                {data.oldLine && data.newLine && (
                  <span className="text-muted-foreground font-normal ml-1">
                    {data.oldLine} {'->'} {data.newLine}
                  </span>
                )}
              </span>
            )}
            {data.sharpMoney && (
              <span className="px-2.5 py-1 rounded-lg bg-muted/50 text-xs">
                <span className="text-muted-foreground">Sharp </span>
                <span className="font-semibold text-card-foreground">{data.sharpMoney}</span>
              </span>
            )}
            {data.kellyFraction && (
              <span className="px-2.5 py-1 rounded-lg bg-muted/50 text-xs">
                <span className="text-muted-foreground">Kelly </span>
                <span className="font-semibold text-card-foreground">{data.kellyFraction}</span>
              </span>
            )}
          </div>
        )}

        {/* -- PORTFOLIO -- */}
        {(data.totalBankroll || data.expectedValue) && (
          <div className="mt-3 rounded-xl bg-muted/40 border border-border/30 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/30">
              {data.expectedValue && <OddsCell label="EV" value={data.expectedValue} sublabel="Expected" />}
              {data.recommendedStake && <OddsCell label="Stake" value={data.recommendedStake} sublabel="Rec." />}
              {data.totalBankroll && <OddsCell label="Bankroll" value={data.totalBankroll} sublabel="Total" />}
              {data.available && <OddsCell label="Available" value={data.available} sublabel="Balance" />}
            </div>
          </div>
        )}

        {/* Note */}
        {data.note && (
          <p className="mt-3 text-xs text-muted-foreground/60 italic leading-relaxed">{data.note}</p>
        )}

        {/* -- CTA -- */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className={cn(
              'flex items-center justify-center gap-1.5 w-full mt-4 pt-3',
              'border-t border-border/30',
              'text-xs font-semibold text-muted-foreground hover:text-card-foreground',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2'
            )}
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
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

/** Full-width cell used inside the odds strip grid */
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
    <div className="flex flex-col items-center justify-center gap-0.5 px-3 py-3 text-center">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
        {sublabel ?? label}
      </span>
      <span
        className={cn(
          'text-base sm:text-lg font-bold tabular-nums leading-none',
          isPositive === true
            ? 'text-emerald-400'
            : isPositive === false
              ? 'text-red-400'
              : 'text-card-foreground'
        )}
      >
        {value}
      </span>
      <span className="text-[11px] font-medium text-muted-foreground/70 truncate max-w-full mt-0.5">
        {label}
      </span>
    </div>
  );
}

/** Compact metadata chip */
function MetaChip({ label }: { label: string }) {
  return (
    <span className="px-2 py-0.5 rounded-md bg-muted/50 text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}
