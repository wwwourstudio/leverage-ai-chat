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

const statusConfig: Record<string, { icon: typeof Zap; label: string; class: string }> = {
  hot: { icon: Zap, label: 'HOT', class: 'bg-red-500/15 text-red-400 ring-red-500/20' },
  value: { icon: TrendingUp, label: 'VALUE', class: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20' },
  optimal: { icon: Target, label: 'OPTIMAL', class: 'bg-sky-500/15 text-sky-400 ring-sky-500/20' },
  edge: { icon: Activity, label: 'EDGE', class: 'bg-amber-500/15 text-amber-400 ring-amber-500/20' },
};

/** Formats a moneyline string to include a + prefix for positive values */
function formatOdds(val?: string) {
  if (!val) return null;
  const num = Number(val);
  if (isNaN(num)) return val;
  return num > 0 ? `+${num}` : String(num);
}

/** Parses team names from "Away @ Home" matchup format */
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
  const BadgeIcon = badge.icon;
  const teams = parseTeams(data.matchup || data.game);
  const sportsbook = data.bookmaker || data.book || null;
  const hasSpread = data.homeSpread && data.homeSpread !== 'N/A';
  const hasTotal = data.overUnder && data.overUnder !== 'N/A';
  const homeOdds = formatOdds(data.homeOdds);
  const awayOdds = formatOdds(data.awayOdds);

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden',
        'bg-card border border-border/60',
        'hover:border-border transition-all duration-300',
        'shadow-sm hover:shadow-md'
      )}
    >
      {/* Top accent bar */}
      <div
        className={cn('h-1 w-full bg-gradient-to-r', gradient)}
        aria-hidden="true"
      />

      <div className="px-5 pt-4 pb-5 space-y-4">
        {/* -- HEADER ROW -- */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {category}
            </span>
            <span className="text-muted-foreground/40" aria-hidden="true">
              /
            </span>
            <span className="text-[11px] font-medium text-muted-foreground/70 truncate">
              {subcategory}
            </span>
          </div>

          <div
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 ring-inset text-[10px] font-bold uppercase tracking-wider shrink-0',
              badge.class
            )}
            role="status"
          >
            <BadgeIcon className="w-3 h-3" aria-hidden="true" />
            {badge.label}
          </div>
        </div>

        {/* -- MATCHUP / TITLE -- */}
        <h3 className="text-lg font-bold text-card-foreground leading-snug text-balance">
          {title}
        </h3>

        {/* Description block */}
        {data.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.description}
          </p>
        )}

        {/* -- ODDS GRID -- */}
        {(homeOdds || awayOdds || hasSpread || hasTotal) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Away ML */}
            {awayOdds && (
              <OddsPill
                label={teams?.away || 'Away'}
                value={awayOdds}
                sublabel="Moneyline"
              />
            )}

            {/* Home ML */}
            {homeOdds && (
              <OddsPill
                label={teams?.home || 'Home'}
                value={homeOdds}
                sublabel="Moneyline"
              />
            )}

            {/* Spread */}
            {hasSpread && (
              <OddsPill
                label="Spread"
                value={data.homeSpread!}
                sublabel="Home"
              />
            )}

            {/* Over/Under */}
            {hasTotal && (
              <OddsPill
                label="Total"
                value={data.overUnder!}
                sublabel="O/U"
              />
            )}
          </div>
        )}

        {/* -- SUPPLEMENTAL DATA -- */}
        {(sportsbook || data.gameTime || data.edge || data.movement || data.confidence !== undefined || data.recommendation || data.player) && (
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground pt-1">
            {data.player && (
              <MetaItem label="Player" value={data.player} />
            )}
            {data.stat && (
              <MetaItem label="Stat" value={data.stat} />
            )}
            {sportsbook && (
              <MetaItem label="Book" value={sportsbook} />
            )}
            {data.edge && (
              <MetaItem label="Edge" value={data.edge} trend="up" />
            )}
            {data.movement && (
              <MetaItem label="Movement" value={data.movement} />
            )}
            {data.impliedProb && (
              <MetaItem label="Implied" value={data.impliedProb} />
            )}
            {data.confidence !== undefined && data.confidence !== '' && (
              <MetaItem
                label="Confidence"
                value={typeof data.confidence === 'number' ? `${data.confidence}%` : String(data.confidence)}
              />
            )}
            {data.recommendation && (
              <MetaItem label="Rec" value={data.recommendation} />
            )}
            {data.gameTime && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground/60">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {data.gameTime}
              </span>
            )}
          </div>
        )}

        {/* -- LINE MOVEMENT ROW -- */}
        {(data.lineChange || data.sharpMoney || data.kellyFraction) && (
          <div className="flex flex-wrap gap-3">
            {data.lineChange && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-xs font-semibold text-card-foreground">
                {data.direction === 'up' ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                )}
                {data.lineChange}
                {data.oldLine && data.newLine && (
                  <span className="text-muted-foreground font-normal ml-1">
                    {data.oldLine} &rarr; {data.newLine}
                  </span>
                )}
              </div>
            )}
            {data.sharpMoney && (
              <div className="px-3 py-1.5 rounded-lg bg-muted/50 text-xs">
                <span className="text-muted-foreground">Sharp: </span>
                <span className="font-semibold text-card-foreground">{data.sharpMoney}</span>
              </div>
            )}
            {data.kellyFraction && (
              <div className="px-3 py-1.5 rounded-lg bg-muted/50 text-xs">
                <span className="text-muted-foreground">Kelly: </span>
                <span className="font-semibold text-card-foreground">{data.kellyFraction}</span>
              </div>
            )}
          </div>
        )}

        {/* -- PORTFOLIO ROW -- */}
        {(data.totalBankroll || data.expectedValue) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data.expectedValue && (
              <OddsPill label="EV" value={data.expectedValue} sublabel="Expected" />
            )}
            {data.recommendedStake && (
              <OddsPill label="Stake" value={data.recommendedStake} sublabel="Rec." />
            )}
            {data.totalBankroll && (
              <OddsPill label="Bankroll" value={data.totalBankroll} sublabel="Total" />
            )}
            {data.available && (
              <OddsPill label="Available" value={data.available} sublabel="Balance" />
            )}
          </div>
        )}

        {/* Note */}
        {data.note && (
          <p className="text-xs text-muted-foreground/70 italic">
            {data.note}
          </p>
        )}

        {/* -- ANALYZE CTA -- */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className={cn(
              'flex items-center justify-center gap-2 w-full pt-3 mt-1',
              'border-t border-border/40',
              'text-xs font-semibold text-muted-foreground hover:text-card-foreground',
              'transition-colors duration-200',
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

function OddsPill({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/50 px-4 py-3 text-center">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {sublabel || label}
      </span>
      <span className="text-base font-bold tabular-nums text-card-foreground leading-none mt-0.5">
        {value}
      </span>
      <span className="text-[11px] font-medium text-muted-foreground mt-0.5 truncate max-w-full">
        {label}
      </span>
    </div>
  );
}

function MetaItem({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: 'up' | 'down';
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted-foreground/50">{label}:</span>
      {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-emerald-400" />}
      {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-red-400" />}
      <span className="font-semibold text-card-foreground">{value}</span>
    </span>
  );
}
