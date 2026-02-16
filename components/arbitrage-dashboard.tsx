'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, RefreshCw, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { useRealtimeSubscription } from '@/lib/hooks/use-realtime';
import type { ArbitrageOpportunity } from '@/lib/arbitrage-detector';

export function ArbitrageDashboard() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'h2h' | 'spreads' | 'totals'>('all');
  const [sortBy, setSortBy] = useState<'profit' | 'time'>('profit');

  // Fetch initial arbitrage opportunities
  useEffect(() => {
    fetchOpportunities();
  }, []);

  // Subscribe to real-time updates from Supabase
  useRealtimeSubscription('arbitrage_opportunities', (payload: any) => {
    console.log('[ArbitrageDashboard] Real-time update:', payload);
    if (payload.eventType === 'INSERT') {
      setOpportunities(prev => [payload.new as ArbitrageOpportunity, ...prev]);
    } else if (payload.eventType === 'UPDATE') {
      setOpportunities(prev => 
        prev.map((opp: ArbitrageOpportunity) => opp.event === (payload.new as ArbitrageOpportunity).event ? payload.new as ArbitrageOpportunity : opp)
      );
    } else if (payload.eventType === 'DELETE') {
      setOpportunities(prev => prev.filter((opp: ArbitrageOpportunity) => opp.event !== (payload.old as ArbitrageOpportunity).event));
    }
  });

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/arbitrage');
      const data = await response.json();
      setOpportunities(data.opportunities || []);
    } catch (error) {
      console.error('[ArbitrageDashboard] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOpportunities = opportunities
    .filter((opp: ArbitrageOpportunity) => filter === 'all' || opp.marketType === filter)
    .sort((a, b) => {
      if (sortBy === 'profit') {
        return b.profitPercentage - a.profitPercentage;
      }
      return new Date(a.gameTime).getTime() - new Date(b.gameTime).getTime();
    });

  const totalProfit = filteredOpportunities.reduce((sum, opp) => sum + (opp.profitPercentage * opp.stake / 100), 0);
  const avgProfit = filteredOpportunities.length > 0 ? totalProfit / filteredOpportunities.length : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Arbitrage Opportunities</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Real-time cross-bookmaker profit detection
              </p>
            </div>
            <button
              onClick={fetchOpportunities}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Live Opportunities</p>
                  <p className="text-2xl font-bold">{filteredOpportunities.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Profit Potential</p>
                  <p className="text-2xl font-bold">${totalProfit.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-500/10 p-2">
                  <CheckCircle className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Profit Margin</p>
                  <p className="text-2xl font-bold">{avgProfit.toFixed(2)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Market:</span>
              <div className="flex rounded-lg border border-border bg-background">
                {(['all', 'h2h', 'spreads', 'totals'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                      filter === type
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {type === 'all' ? 'All' : type === 'h2h' ? 'Moneyline' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort:</span>
              <div className="flex rounded-lg border border-border bg-background">
                {(['profit', 'time'] as const).map((sort) => (
                  <button
                    key={sort}
                    onClick={() => setSortBy(sort)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                      sortBy === sort
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sort === 'profit' ? 'Highest Profit' : 'Game Time'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities Table */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">No arbitrage opportunities found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check back soon for new cross-bookmaker profit opportunities
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOpportunities.map((opp, idx) => (
              <div
                key={`${opp.event}-${idx}`}
                className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  {/* Game Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-500">
                        {opp.profitPercentage.toFixed(2)}% Profit
                      </span>
                      <span className="text-xs text-muted-foreground">{opp.sport}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {opp.marketType === 'h2h' ? 'Moneyline' : opp.marketType.charAt(0).toUpperCase() + opp.marketType.slice(1)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold">
                      {opp.awayTeam} @ {opp.homeTeam}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {new Date(opp.gameTime).toLocaleString()}
                    </div>
                  </div>

                  {/* Bet Recommendations */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-96">
                    {opp.bets.map((bet, betIdx) => (
                      <div
                        key={betIdx}
                        className="rounded-lg border border-border bg-background p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            {bet.team}
                          </span>
                          <span className="text-xs font-medium text-green-500">
                            {bet.odds > 0 ? `+${bet.odds}` : bet.odds}
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-semibold">{bet.book}</div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Stake:</span>
                          <span className="font-medium">${bet.stake.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">To Win:</span>
                          <span className="font-medium text-green-500">
                            ${bet.toWin.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <div className="flex flex-col gap-2 lg:w-32">
                    <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                      Execute
                    </button>
                    <div className="text-center text-xs text-muted-foreground">
                      Total: ${opp.stake.toFixed(0)}
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
