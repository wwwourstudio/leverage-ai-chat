'use client';

import { cn, formatAmericanOdds, formatGameDateTime } from '@/lib/utils';

export interface EnrichedOddsEvent {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  sport_key: string;
  bestHomeOdds?: { price: number; book: string } | null;
  bestAwayOdds?: { price: number; book: string } | null;
  spread?: { home: number; away: number; book: string } | null;
  total?: { line: number; book: string } | null;
  impliedWinPct?: { home: number; away: number };
  bookmakerCount?: number;
}

interface OddsCardProps {
  event: EnrichedOddsEvent;
  onAsk?: (query: string) => void;
}

export function OddsCard({ event, onAsk }: OddsCardProps) {
  const homeImpl = event.impliedWinPct?.home ?? 50;
  const awayImpl = event.impliedWinPct?.away ?? 50;

  const homeIsFav =
    event.bestHomeOdds?.price !== undefined &&
    event.bestAwayOdds?.price !== undefined
      ? event.bestHomeOdds.price < event.bestAwayOdds.price
      : false;

  return (
    <div className="group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow)] transition-all duration-300">
      {/* Header gradient band */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-600/25 dark:via-cyan-800/10 to-transparent pointer-events-none" />

      <div className="relative px-4 pt-4 pb-4 flex flex-col gap-3">
        {/* Top row: sport tag + game time */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest uppercase text-blue-400/80 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
            {event.sport_key?.replace(/_/g, ' ')}
          </span>
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] font-medium"
            suppressHydrationWarning
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            {formatGameDateTime(event.commence_time)}
          </span>
        </div>

        {/* Matchup: AWAY @ HOME */}
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 text-center rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
            <div className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Away</div>
            <div className="text-sm font-black text-[var(--foreground)] leading-snug truncate">{event.away_team}</div>
            <div
              className={cn(
                'text-2xl font-black tabular-nums mt-1.5',
                homeIsFav ? 'text-cyan-300' : 'text-blue-300',
              )}
            >
              {event.bestAwayOdds ? formatAmericanOdds(event.bestAwayOdds.price) : '—'}
            </div>
            {event.bestAwayOdds?.book && (
              <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mt-1">
                {event.bestAwayOdds.book}
              </div>
            )}
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{awayImpl.toFixed(0)}% implied</div>
          </div>

          <div className="flex flex-col items-center gap-1 px-1">
            <span className="text-base font-black text-[var(--text-faint)]">@</span>
          </div>

          <div className="flex-1 text-center rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
            <div className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Home</div>
            <div className="text-sm font-black text-[var(--foreground)] leading-snug truncate">{event.home_team}</div>
            <div
              className={cn(
                'text-2xl font-black tabular-nums mt-1.5',
                homeIsFav ? 'text-blue-300' : 'text-cyan-300',
              )}
            >
              {event.bestHomeOdds ? formatAmericanOdds(event.bestHomeOdds.price) : '—'}
            </div>
            {event.bestHomeOdds?.book && (
              <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mt-1">
                {event.bestHomeOdds.book}
              </div>
            )}
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{homeImpl.toFixed(0)}% implied</div>
          </div>
        </div>

        {/* Win probability bar */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[var(--text-faint)] w-8 text-right tabular-nums">{awayImpl.toFixed(0)}%</span>
          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden flex">
            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${awayImpl}%` }} />
            <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${homeImpl}%` }} />
          </div>
          <span className="text-[9px] text-[var(--text-faint)] w-8 tabular-nums">{homeImpl.toFixed(0)}%</span>
        </div>

        {/* Spread / Total / Books chips */}
        {(event.spread || event.total || event.bookmakerCount != null) && (
          <div className="flex gap-2 flex-wrap">
            {event.spread && (
              <span className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full px-3 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                Spread{' '}
                <span className="text-[var(--foreground)]">
                  {event.spread.home > 0 ? '+' : ''}{event.spread.home} / {event.spread.away > 0 ? '+' : ''}{event.spread.away}
                </span>
              </span>
            )}
            {event.total && (
              <span className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full px-3 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                O/U <span className="text-[var(--foreground)]">{event.total.line}</span>
              </span>
            )}
            {event.bookmakerCount != null && (
              <span className="bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 text-[10px] font-semibold text-blue-400 ml-auto">
                {event.bookmakerCount} books
              </span>
            )}
          </div>
        )}

        {/* ASK AI CTA */}
        {onAsk && (
          <button
            onClick={() =>
              onAsk(
                `Analyze ${event.away_team} vs ${event.home_team} — best moneyline odds, line movement, and sharp action. Sport: ${event.sport_key}`,
              )
            }
            className="w-full mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 hover:bg-blue-500/20 hover:border-blue-500/50 text-[12px] font-bold text-blue-300 hover:text-blue-200 transition-all duration-200"
          >
            <span className="text-base leading-none">⚡</span>
            ASK AI — Analyze this game
          </button>
        )}
      </div>
    </div>
  );
}
