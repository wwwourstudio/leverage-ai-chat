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
        <div className="flex gap-1.5 p-0.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          {(['ml', 'spread', 'total'] as const)
            .filter(v => v === 'ml' || (v === 'spread' && hasSpread) || (v === 'total' && hasTotal))
            .map(v => (
              <button
                key={v}
                onClick={() => setMarketView(v)}
                className={cn(
                  'flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150',
                  marketView === v
                    ? cn(accentCls, 'shadow-sm')
                    : 'text-[var(--text-faint)] hover:text-[var(--text-muted)]',
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
            'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[11px] font-bold border-l-2',
            edgeNum >= 5
              ? 'bg-blue-500/10 border border-blue-500/25 border-l-blue-400 text-blue-300'
              : 'bg-amber-500/10 border border-amber-500/25 border-l-amber-400 text-amber-300',
          )}>
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">
              {edgeNum >= 5 ? 'Strong edge detected' : 'Potential value'}
              <span className="opacity-70"> — {data.edge} edge vs market</span>
            </span>
          </div>
        );
      })()}

      {/* In-game odds warning */}
      {isExtremeOdds && !isFinal && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 border-l-2 border-l-amber-400 text-[10px] text-amber-300">
          <Zap className="w-3.5 h-3.5 shrink-0" />
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
        <div className="rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Market Intelligence</span>
          </div>

          <div className="p-3.5 space-y-3">
            {confPct !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Model Confidence</span>
                  <span className={cn(
                    'text-[11px] font-black tabular-nums px-2 py-0.5 rounded-lg border',
                    confPct >= 70
                      ? 'text-blue-300 bg-blue-500/10 border-blue-500/20'
                      : confPct >= 50
                      ? 'text-blue-300 bg-blue-500/10 border-blue-500/20'
                      : 'text-amber-300 bg-amber-500/10 border-amber-500/20',
                  )}>
                    {Math.round(confPct)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700',
                      confPct >= 70 ? 'bg-blue-400' : confPct >= 50 ? 'bg-blue-400' : 'bg-amber-400'
                    )}
                    style={{ width: `${Math.min(100, confPct)}%` }}
                  />
                </div>
              </div>
            )}

            {sharpPct !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Sharp Money</span>
                  <span className={cn(
                    'text-[11px] font-black tabular-nums px-2 py-0.5 rounded-lg border',
                    sharpPct >= 60
                      ? 'text-purple-300 bg-purple-500/10 border-purple-500/20'
                      : 'text-[var(--text-faint)] bg-transparent border-transparent',
                  )}>
                    {Math.round(sharpPct)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, sharpPct)}%` }}
                  />
                </div>
              </div>
            )}

            {hasLineMove && (
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Line Movement</span>
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black border',
                  moveDir === 'up'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/25'
                    : moveDir === 'down'
                    ? 'bg-red-500/10 text-red-400 border-red-500/25'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-faint)] border-[var(--border-subtle)]',
                )}>
                  {moveDir === 'up' ? <TrendingUp className="w-3 h-3" /> : moveDir === 'down' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {!isNaN(moveNum) && moveNum !== 0 ? (moveNum > 0 ? `+${moveNum}` : String(moveNum)) : String(rawMove)}
                </span>
              </div>
            )}

            {sharpPct !== null && sharpPct >= 60 && hasLineMove && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/20 border-l-2 border-l-amber-400">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-black text-amber-300">Reverse Line Movement</span>
                  <span className="text-[10px] text-amber-400/60 ml-1.5">— sharp action against public</span>
                </div>
              </div>
            )}

            {vigPct !== null && vigPct > 0 && (
              <div className="flex items-center justify-between py-0.5 border-t border-[var(--border-subtle)] pt-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Book Vig</span>
                <span className={cn(
                  'text-[11px] font-black tabular-nums px-2 py-0.5 rounded-lg border',
                  vigPct > 5
                    ? 'text-red-300 bg-red-500/10 border-red-500/20'
                    : vigPct > 3
                    ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                    : 'text-blue-300 bg-blue-500/10 border-blue-500/20',
                )}>
                  {vigPct}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weather note */}
      {data.weatherNote && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-sky-500/6 border border-sky-500/20 border-l-2 border-l-sky-400">
          <Wind className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="text-[10px] text-sky-300 leading-relaxed font-medium">{data.weatherNote}</span>
        </div>
      )}

      {/* Recommendation */}
      {data.recommendation && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] border-l-2 border-l-amber-500/50">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{data.recommendation}</p>
        </div>
      )}

      {data.description && (
        <p className="text-[11px] text-[var(--text-faint)] leading-relaxed px-1">{data.description}</p>
      )}
    </div>
  );
}
