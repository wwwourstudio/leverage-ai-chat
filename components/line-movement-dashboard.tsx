'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, RefreshCw, AlertTriangle } from 'lucide-react';
import { useRealtimeSubscription } from '@/lib/hooks/use-realtime';

interface LineMovement {
  id: string;
  sport: string;
  event: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  marketType: 'h2h' | 'spreads' | 'totals';
  outcome: string;
  openingLine: number;
  currentLine: number;
  movement: number;
  movementPercent: number;
  direction: 'up' | 'down' | 'stable';
  bookmaker: string;
  updatedAt: string;
  significance: 'steam' | 'reverse' | 'normal';
}

export function LineMovementDashboard() {
  const [movements, setMovements] = useState<LineMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'steam' | 'reverse'>('all');
  const [sportFilter, setSportFilter] = useState<'all' | 'NFL' | 'NBA' | 'NHL' | 'MLB'>('all');

  useEffect(() => {
    fetchLineMovements();
  }, []);

  // Subscribe to real-time line movement updates
  useRealtimeSubscription('line_movement', (payload) => {
    console.log('[LineMovement] Real-time update:', payload);
    if (payload.eventType === 'INSERT') {
      setMovements(prev => [transformRecord(payload.new), ...prev]);
    }
  });

  const fetchLineMovements = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/line-movement');
      const data = await response.json();
      setMovements(data.movements || []);
    } catch (error) {
      console.error('[LineMovement] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const transformRecord = (record: any): LineMovement => ({
    id: record.id,
    sport: record.sport,
    event: record.event_id,
    homeTeam: record.home_team,
    awayTeam: record.away_team,
    gameTime: record.game_time,
    marketType: record.market_type,
    outcome: record.outcome,
    openingLine: record.opening_line,
    currentLine: record.current_line,
    movement: record.movement_amount,
    movementPercent: record.movement_percent,
    direction: record.direction,
    bookmaker: record.bookmaker,
    updatedAt: record.updated_at,
    significance: record.movement_type
  });

  const filteredMovements = movements
    .filter(move => filter === 'all' || move.significance === filter)
    .filter(move => sportFilter === 'all' || move.sport === sportFilter)
    .sort((a, b) => Math.abs(b.movementPercent) - Math.abs(a.movementPercent));

  const steamMoves = movements.filter(m => m.significance === 'steam').length;
  const reverseMoves = movements.filter(m => m.significance === 'reverse').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Line Movement Tracker</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Track odds changes and detect sharp money
              </p>
            </div>
            <button
              onClick={fetchLineMovements}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Movements</p>
                  <p className="text-2xl font-bold">{filteredMovements.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-500/10 p-2">
                  <TrendingUp className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Steam Moves</p>
                  <p className="text-2xl font-bold">{steamMoves}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-yellow-500/10 p-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reverse Line Moves</p>
                  <p className="text-2xl font-bold">{reverseMoves}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Type:</span>
              <div className="flex rounded-lg border border-border bg-background">
                {(['all', 'steam', 'reverse'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                      filter === type
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {type === 'all' ? 'All' : type === 'steam' ? 'Steam' : 'Reverse'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sport:</span>
              <div className="flex rounded-lg border border-border bg-background">
                {(['all', 'NFL', 'NBA', 'NHL', 'MLB'] as const).map((sport) => (
                  <button
                    key={sport}
                    onClick={() => setSportFilter(sport)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                      sportFilter === sport
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sport}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Line Movements */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">No line movements detected</p>
            <p className="text-sm text-muted-foreground">Check back soon</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMovements.map((move: LineMovement) => (
              <div
                key={move.id}
                className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  {/* Game Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {move.significance === 'steam' && (
                        <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
                          STEAM MOVE
                        </span>
                      )}
                      {move.significance === 'reverse' && (
                        <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
                          REVERSE
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{move.sport}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{move.bookmaker}</span>
                    </div>
                    <h3 className="mt-2 font-semibold">
                      {move.awayTeam} @ {move.homeTeam}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(move.gameTime).toLocaleString()}
                    </p>
                  </div>

                  {/* Line Movement */}
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Opening</p>
                      <p className="text-lg font-bold">
                        {move.openingLine > 0 ? `+${move.openingLine}` : move.openingLine}
                      </p>
                    </div>

                    <div className="flex items-center">
                      {move.direction === 'up' ? (
                        <TrendingUp className="h-6 w-6 text-green-500" />
                      ) : move.direction === 'down' ? (
                        <TrendingDown className="h-6 w-6 text-red-500" />
                      ) : (
                        <Activity className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Current</p>
                      <p className="text-lg font-bold">
                        {move.currentLine > 0 ? `+${move.currentLine}` : move.currentLine}
                      </p>
                    </div>

                    <div className="rounded-lg bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">Movement</p>
                      <p className={`text-lg font-bold ${
                        Math.abs(move.movementPercent) > 5 ? 'text-red-500' : 
                        Math.abs(move.movementPercent) > 2 ? 'text-yellow-500' : 
                        'text-green-500'
                      }`}>
                        {move.movementPercent > 0 ? '+' : ''}{move.movementPercent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
