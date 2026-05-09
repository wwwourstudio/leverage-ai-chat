'use client';

import { Zap, TrendingUp, TrendingDown, Minus, Wind, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BettingCardData, BookEntry } from './betting-utils';
import { abbr } from './betting-utils';
import { OddsCell, SplitBar, BookComparisonRow } from './betting-shared';

interface TabOddsProps {
  data: BettingCardData;
  teams: { away: string; home: string } | null;
  isFinal: boolean;
  isExtremeOdds: boolean;
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
}

export function TabOdds({
  data, teams, isFinal, isExtremeOdds, hasBookComparison, books,
  spreadHome, spreadAway, ou, hasOdds,
  isBestHome, isBestAway, awayML, homeML,
  confPct, sharpPct, hasLineMove, moveDir, moveNum, rawMove, vigPct,
  marketView, setMarketView, accentCls,
}: TabOddsProps) {
  const hasSpread = !!(spreadHome || spreadAway);
  const hasTotal  = !!ou;
  const showPills = !isFinal && (hasSpread || hasTotal);

  return (
    <div className="space-y-3">
      {/* Market view pills */}
      {showPills && (
        <div className="flex gap-1">
          {(['ml', 'spread', 'total'] as const)
            .filter(v => v === 'ml' || (v === 'spread' && hasSpread) || (v === 'total' && hasTotal))
            .map(v => (
              <button
                key={v}
                onClick={() => setMarketView(v)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all duration-150',
                  marketView === v ? accentCls : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-muted)]',
                )}
              >
                {v === 'ml' ? 'Moneyline' : v === 'spread' ? 'Spread' : 'Total'}
              </button>
            ))}
        </div>
      )}

      {/* Book comparison */}
      {marketView === 'ml' && !isFinal && hasBookComparison && teams && (
        <BookComparisonRow books={books} homeTeam={teams.home} awayTeam={teams.away} bestHomeOdds={data.bestHomeOdds} bestAwayOdds={data.bestAwayOdds} />
      )}

      {/* Value edge indicator */}
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

      {/* In-game odds warning */}
      {isExtremeOdds && !isFinal && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/20 text-[10px] text-amber-300">
          <Zap className="w-3 h-3 shrink-0" />
          In-game odds — prices reflect live game state
        </div>
      )}

      {/* Odds cells */}
      {hasOdds && !isFinal && !isExtremeOdds && (
        <div className="grid grid-cols-2 gap-2">
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

          {/* Total view */}
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

      {/* Market Intelligence panel */}
      {marketView === 'ml' && (confPct !== null || sharpPct !== null || hasLineMove || vigPct !== null) && (
        <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] p-3 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Market Intelligence</span>
          </div>

          {confPct !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold text-[var(--text-muted)]">
                <span>Model Confidence</span>
                <span className={cn(confPct >= 70 ? 'text-emerald-400' : confPct >= 50 ? 'text-blue-400' : 'text-amber-400')}>{Math.round(confPct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-700', confPct >= 70 ? 'bg-emerald-400' : confPct >= 50 ? 'bg-blue-400' : 'bg-amber-400')} style={{ width: `${Math.min(100, confPct)}%` }} />
              </div>
            </div>
          )}

          {sharpPct !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold text-[var(--text-muted)]">
                <span>Sharp Money</span>
                <span className={cn(sharpPct >= 60 ? 'text-purple-400' : 'text-[var(--text-faint)]')}>{Math.round(sharpPct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-700" style={{ width: `${Math.min(100, sharpPct)}%` }} />
              </div>
            </div>
          )}

          {hasLineMove && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Line Movement</span>
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
              <span className="text-[10px] text-amber-400/70 ml-0.5">— sharp action against public</span>
            </div>
          )}

          {vigPct !== null && vigPct > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Book Vig</span>
              <span className={cn('text-[10px] font-bold', vigPct > 5 ? 'text-red-400' : vigPct > 3 ? 'text-amber-400' : 'text-emerald-400')}>{vigPct}%</span>
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

      {data.description && (
        <p className="text-[11px] text-[var(--text-faint)] leading-relaxed px-1">{data.description}</p>
      )}
    </div>
  );
}
