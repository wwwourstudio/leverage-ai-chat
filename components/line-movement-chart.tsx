'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface LineMovement {
  timestamp: string;
  homeOdds: number;
  awayOdds: number;
  bookmaker: string;
}

interface LineMovementChartProps {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
}

export function LineMovementChart({ gameId, homeTeam, awayTeam }: LineMovementChartProps) {
  const [movements, setMovements] = useState<LineMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSide, setSelectedSide] = useState<'home' | 'away'>('home');

  useEffect(() => {
    fetchLineMovement();
  }, [gameId]);

  const fetchLineMovement = async () => {
    try {
      const response = await fetch(`/api/line-movement?gameId=${gameId}`);
      const data = await response.json();
      setMovements(data.movements || []);
    } catch (error) {
      console.error('[LineMovementChart] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
        <Activity className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
        <p className="text-sm text-muted-foreground">No line movement data available</p>
      </div>
    );
  }

  const odds = selectedSide === 'home' 
    ? movements.map(m => m.homeOdds)
    : movements.map(m => m.awayOdds);
    
  const minOdds = Math.min(...odds);
  const maxOdds = Math.max(...odds);
  const range = maxOdds - minOdds;
  const padding = range * 0.1;

  const latestOdds = odds[odds.length - 1];
  const openingOdds = odds[0];
  const movement = latestOdds - openingOdds;
  const movementPercent = ((movement / Math.abs(openingOdds)) * 100).toFixed(1);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Line Movement</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedSide === 'home' ? homeTeam : awayTeam}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSelectedSide('home')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedSide === 'home'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            {homeTeam}
          </button>
          <button
            onClick={() => setSelectedSide('away')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedSide === 'away'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            {awayTeam}
          </button>
        </div>
      </div>

      {/* Movement Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-background p-3">
          <p className="text-xs text-muted-foreground">Opening</p>
          <p className="mt-1 text-lg font-semibold">
            {openingOdds > 0 ? '+' : ''}{openingOdds}
          </p>
        </div>
        <div className="rounded-lg bg-background p-3">
          <p className="text-xs text-muted-foreground">Current</p>
          <p className="mt-1 text-lg font-semibold">
            {latestOdds > 0 ? '+' : ''}{latestOdds}
          </p>
        </div>
        <div className="rounded-lg bg-background p-3">
          <p className="text-xs text-muted-foreground">Movement</p>
          <div className="mt-1 flex items-center gap-1">
            {movement > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : movement < 0 ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : null}
            <p className={`text-lg font-semibold ${
              movement > 0 ? 'text-green-500' : movement < 0 ? 'text-red-500' : ''
            }`}>
              {movement > 0 ? '+' : ''}{movement}
            </p>
            <span className="text-xs text-muted-foreground">({movementPercent}%)</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-48">
        <svg className="h-full w-full" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent) => (
            <line
              key={percent}
              x1="0%"
              y1={`${percent}%`}
              x2="100%"
              y2={`${percent}%`}
              stroke="currentColor"
              strokeWidth="1"
              className="text-border opacity-20"
            />
          ))}

          {/* Line path */}
          <polyline
            points={odds
              .map((odd, idx) => {
                const x = (idx / (odds.length - 1)) * 100;
                const y = 100 - ((odd - (minOdds - padding)) / (maxOdds - minOdds + padding * 2)) * 100;
                return `${x},${y}`;
              })
              .join(' ')}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />

          {/* Data points */}
          {odds.map((odd, idx) => {
            const x = (idx / (odds.length - 1)) * 100;
            const y = 100 - ((odd - (minOdds - padding)) / (maxOdds - minOdds + padding * 2)) * 100;
            return (
              <circle
                key={idx}
                cx={`${x}%`}
                cy={`${y}%`}
                r="3"
                fill="hsl(var(--primary))"
                className="transition-all hover:r-5"
              />
            );
          })}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute inset-y-0 right-0 flex flex-col justify-between text-xs text-muted-foreground">
          <span>{maxOdds > 0 ? '+' : ''}{Math.round(maxOdds)}</span>
          <span>{Math.round((maxOdds + minOdds) / 2)}</span>
          <span>{minOdds > 0 ? '+' : ''}{Math.round(minOdds)}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-4 flex justify-between text-xs text-muted-foreground">
        <span>{new Date(movements[0].timestamp).toLocaleTimeString()}</span>
        <span>Time</span>
        <span>{new Date(movements[movements.length - 1].timestamp).toLocaleTimeString()}</span>
      </div>

      {/* Sharp Money Indicator */}
      {Math.abs(movement) > 20 && (
        <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-yellow-500" />
            <p className="text-sm font-medium text-yellow-500">
              Sharp Money Alert: {Math.abs(movement)} point move
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
