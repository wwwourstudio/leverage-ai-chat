'use client';

import { cn } from '@/lib/utils';

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

function formatOdds(price: number): string {
  return price >= 0 ? `+${price}` : `${price}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  if (isToday) return `Today • ${time}`;
  return (
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ` • ${time}`
  );
}

export function OddsCard({ event, onAsk }: OddsCardProps) {
  const homeImpl = event.impliedWinPct?.home ?? 50;
  const awayImpl = event.impliedWinPct?.away ?? 50;

  return (
    <div className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-4 flex flex-col gap-3 hover:border-[var(--border-hover)] transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)]">
          {event.sport_key?.replace(/_/g, ' ').toUpperCase()}
        </span>
        <span className="text-[10px] text-[var(--text-faint)]">
          {formatTime(event.commence_time)}
        </span>
      </div>

      {/* Teams + Moneyline */}
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { team: event.away_team, odds: event.bestAwayOdds, impl: awayImpl },
            { team: event.home_team, odds: event.bestHomeOdds, impl: homeImpl },
          ] as const
        ).map(({ team, odds, impl }) => (
          <div
            key={team}
            className="bg-[var(--bg-overlay)] rounded-lg p-3 flex flex-col gap-1"
          >
            <span className="text-[11px] font-medium text-white/70 truncate">{team}</span>
            <span
              className={cn(
                'text-lg font-bold tabular-nums',
                odds?.price !== undefined && odds.price >= 0
                  ? 'text-blue-400'
                  : 'text-violet-400',
              )}
            >
              {odds ? formatOdds(odds.price) : '—'}
            </span>
            {odds?.book && (
              <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide">
                {odds.book}
              </span>
            )}
            <span className="text-[10px] text-[var(--text-muted)]">
              {impl.toFixed(0)}% implied
            </span>
          </div>
        ))}
      </div>

      {/* Win probability bar */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-[var(--text-faint)] w-8 text-right">
          {awayImpl.toFixed(0)}%
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden flex">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${awayImpl}%` }}
          />
          <div
            className="h-full bg-violet-500 transition-all"
            style={{ width: `${homeImpl}%` }}
          />
        </div>
        <span className="text-[9px] text-[var(--text-faint)] w-8">
          {homeImpl.toFixed(0)}%
        </span>
      </div>

      {/* Spread / Total row */}
      {(event.spread || event.total) && (
        <div className="flex gap-2 flex-wrap text-[10px] text-[var(--text-muted)]">
          {event.spread && (
            <span className="bg-[var(--bg-elevated)] rounded px-2 py-1">
              Spread: {event.spread.home > 0 ? '+' : ''}
              {event.spread.home} / {event.spread.away > 0 ? '+' : ''}
              {event.spread.away}
            </span>
          )}
          {event.total && (
            <span className="bg-[var(--bg-elevated)] rounded px-2 py-1">
              O/U {event.total.line}
            </span>
          )}
          {event.bookmakerCount != null && (
            <span className="bg-[var(--bg-elevated)] rounded px-2 py-1 ml-auto">
              {event.bookmakerCount} books
            </span>
          )}
        </div>
      )}

      {/* CTA */}
      {onAsk && (
        <button
          onClick={() =>
            onAsk(
              `Analyze ${event.away_team} vs ${event.home_team} — best moneyline odds, line movement, and sharp action. Sport: ${event.sport_key}`,
            )
          }
          className="w-full text-[11px] font-semibold text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/40 rounded-lg py-1.5 transition-colors"
        >
          Analyze this game →
        </button>
      )}
    </div>
  );
}
