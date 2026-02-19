'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Activity,
  Clock,
  ChevronRight,
} from 'lucide-react';

interface OddsEvent {
  id: string;
  sport_title: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number; point?: number }>;
    }>;
  }>;
}

const SPORTS = [
  { key: 'basketball_nba', label: 'NBA' },
  { key: 'americanfootball_nfl', label: 'NFL' },
  { key: 'baseball_mlb', label: 'MLB' },
  { key: 'icehockey_nhl', label: 'NHL' },
] as const;

function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : `${price}`;
}

function OddsCell({ price }: { price: number }) {
  const isFavorite = price < 0;
  return (
    <span
      className={`font-mono text-sm font-medium ${
        isFavorite ? 'text-emerald-400' : 'text-amber-400'
      }`}
    >
      {formatOdds(price)}
    </span>
  );
}

export default function TradingPage() {
  const [selectedSport, setSelectedSport] = useState(SPORTS[0].key);
  const [events, setEvents] = useState<OddsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchOdds = useCallback(async (sport: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/odds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, marketType: 'h2h' }),
      });

      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error(`Unexpected response (${res.status})`);
      }

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to load odds');
        setEvents([]);
      } else {
        setEvents(Array.isArray(data.events) ? data.events : []);
        setLastUpdated(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOdds(selectedSport);
  }, [selectedSport, fetchOdds]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to home</span>
          </Link>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Live Odds</h1>
          </div>
          <button
            onClick={() => fetchOdds(selectedSport)}
            disabled={loading}
            className="ml-auto flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6 space-y-6">
        {/* Sport selector */}
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Sport selector">
          {SPORTS.map((sport) => (
            <button
              key={sport.key}
              onClick={() => setSelectedSport(sport.key)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedSport === sport.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {sport.label}
            </button>
          ))}
        </nav>

        {/* Status bar */}
        {lastUpdated && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Updated {lastUpdated.toLocaleTimeString()}</span>
            <span className="mx-1">-</span>
            <span>{events.length} games</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-border bg-card p-5 space-y-3"
              >
                <div className="h-4 w-48 rounded bg-secondary" />
                <div className="flex gap-4">
                  <div className="h-3 w-24 rounded bg-secondary" />
                  <div className="h-3 w-16 rounded bg-secondary" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Events list */}
        {!loading && events.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No live games scheduled for{' '}
              {SPORTS.find((s) => s.key === selectedSport)?.label || 'this sport'}.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Games typically appear 24-48 hours before start time.
            </p>
          </div>
        )}

        {!loading && events.length > 0 && (
          <div className="space-y-3">
            {events.map((event) => {
              const firstBook = event.bookmakers?.[0];
              const h2h = firstBook?.markets?.find((m) => m.key === 'h2h');
              const homeOutcome = h2h?.outcomes?.find((o) => o.name === event.home_team);
              const awayOutcome = h2h?.outcomes?.find((o) => o.name === event.away_team);
              const gameTime = new Date(event.commence_time);
              const isUpcoming = gameTime > new Date();

              return (
                <div
                  key={event.id}
                  className="group rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <time dateTime={event.commence_time}>
                          {isUpcoming
                            ? gameTime.toLocaleString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            : 'Live'}
                        </time>
                        {firstBook && (
                          <>
                            <span className="mx-1">-</span>
                            <span>{firstBook.title}</span>
                          </>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-foreground">
                            {event.away_team}
                          </span>
                          {awayOutcome && <OddsCell price={awayOutcome.price} />}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-foreground">
                            {event.home_team}
                          </span>
                          {homeOutcome && <OddsCell price={homeOutcome.price} />}
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
