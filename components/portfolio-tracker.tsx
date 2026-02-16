'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Target, Activity, PieChart, BarChart3 } from 'lucide-react';
import { useRealtimeSubscription } from '@/lib/hooks/use-realtime';

interface Position {
  id: string;
  market_id: string;
  sport: string;
  matchup: string;
  edge: number;
  kelly_fraction: number;
  allocated_capital: number;
  confidence_score: number;
  status: 'pending' | 'placed' | 'won' | 'lost' | 'void';
  actual_return?: number;
  created_at: string;
}

interface PortfolioStats {
  totalCapital: number;
  allocatedCapital: number;
  availableCapital: number;
  totalPositions: number;
  activePositions: number;
  totalReturn: number;
  roi: number;
  sharpeRatio: number;
  winRate: number;
}

export function PortfolioTracker() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'settled'>('active');

  useEffect(() => {
    fetchPortfolio();
  }, []);

  // Real-time updates for bet allocations
  const { data: realtimePositions } = useRealtimeSubscription('bet_allocations');
  
  // Update positions when realtime data changes
  useEffect(() => {
    if (realtimePositions && realtimePositions.length > 0) {
      console.log('[PortfolioTracker] Real-time update received:', realtimePositions.length, 'positions');
      setPositions(realtimePositions as Position[]);
      fetchPortfolio(); // Refresh stats
    }
  }, [realtimePositions]);

  const fetchPortfolio = async () => {
    try {
      const response = await fetch('/api/portfolio');
      const data = await response.json();
      setPositions(data.positions || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('[PortfolioTracker] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPositions = positions.filter(pos => {
    if (filter === 'active') return pos.status === 'pending' || pos.status === 'placed';
    if (filter === 'settled') return pos.status === 'won' || pos.status === 'lost' || pos.status === 'void';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Portfolio Stats */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-3">
                <DollarSign className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Capital</p>
                <p className="text-2xl font-bold">${stats.totalCapital.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Allocated</span>
              <span className="font-medium">${stats.allocatedCapital.toLocaleString()}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-background">
              <div 
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${(stats.allocatedCapital / stats.totalCapital) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-3">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Return</p>
                <p className={`text-2xl font-bold ${stats.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.totalReturn >= 0 ? '+' : ''}${stats.totalReturn.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ROI</span>
              <span className={`font-medium ${stats.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-3">
                <Target className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Positions</span>
              <span className="font-medium">{stats.totalPositions}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/10 p-3">
                <Activity className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                <p className="text-2xl font-bold">{stats.sharpeRatio.toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Risk-Adjusted</span>
              <span className="font-medium text-green-500">Good</span>
            </div>
          </div>
        </div>
      )}

      {/* Positions Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Positions</h2>
            <div className="flex gap-2">
              {(['all', 'active', 'settled'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-background">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Sport</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Matchup</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Edge</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Kelly %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Stake</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Confidence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPositions.map((position) => (
                <tr key={position.id} className="transition-colors hover:bg-background/50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">{position.sport}</td>
                  <td className="px-6 py-4 text-sm">{position.matchup}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className="font-medium text-green-500">{(position.edge * 100).toFixed(2)}%</span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {(position.kelly_fraction * 100).toFixed(2)}%
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                    ${position.allocated_capital.toFixed(2)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-background">
                        <div 
                          className="h-full bg-blue-500"
                          style={{ width: `${position.confidence_score * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {(position.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      position.status === 'won' ? 'bg-green-500/10 text-green-500' :
                      position.status === 'lost' ? 'bg-red-500/10 text-red-500' :
                      position.status === 'placed' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-gray-500/10 text-gray-500'
                    }`}>
                      {position.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                    {position.actual_return !== undefined ? (
                      <span className={position.actual_return >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {position.actual_return >= 0 ? '+' : ''}${position.actual_return.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPositions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <PieChart className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">No positions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
