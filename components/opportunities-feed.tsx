'use client';

import { useState, useEffect } from 'react';
import { Zap, Target, Clock, Filter, RefreshCw } from 'lucide-react';
import { useRealtimeSubscription } from '@/lib/hooks/use-realtime';
import { LineMovementChart } from './line-movement-chart';

interface Opportunity {
  id: string;
  type: 'arbitrage' | 'value_bet' | 'sharp_move' | 'player_prop';
  sport: string;
  event: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  edge?: number;
  profitPercentage?: number;
  description: string;
  bookmaker?: string;
  odds?: number;
  confidence: 'high' | 'medium' | 'low';
  created_at: string;
}

export function OpportunitiesFeed() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'arbitrage' | 'value_bet' | 'sharp_move' | 'player_prop'>('all');
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  useEffect(() => {
    fetchOpportunities();
  }, []);

  // Subscribe to edge/value-bet updates from bet_allocations
  useRealtimeSubscription('bet_allocations', (payload: any) => {
    console.log('[OpportunitiesFeed] Edge update:', payload);
    if (payload.eventType === 'INSERT' && payload.new.edge > 0) {
      const parts = (payload.new.matchup ?? ' @ ').split(' @ ');
      const newOpp: Opportunity = {
        id: payload.new.id,
        type: 'value_bet',
        sport: payload.new.sport,
        event: payload.new.matchup,
        homeTeam: parts[1] ?? '',
        awayTeam: parts[0] ?? '',
        gameTime: payload.new.created_at,
        edge: payload.new.edge,
        description: `${(payload.new.edge * 100).toFixed(2)}% edge detected`,
        bookmaker: payload.new.bookmaker,
        odds: payload.new.market_odds,
        confidence: payload.new.confidence_score > 0.7 ? 'high' : payload.new.confidence_score > 0.5 ? 'medium' : 'low',
        created_at: payload.new.created_at
      };
      setOpportunities(prev => [newOpp, ...prev]);
    }
  });

  // Subscribe to arbitrage opportunities
  useRealtimeSubscription('arbitrage_opportunities', (payload: any) => {
    console.log('[OpportunitiesFeed] Arbitrage update:', payload);
    if (payload.eventType === 'INSERT') {
      const profitPct = payload.new.profit_percentage ?? payload.new.roi_percentage ?? 0;
      const newOpp: Opportunity = {
        id: payload.new.id,
        type: 'arbitrage',
        sport: payload.new.sport,
        event: `${payload.new.away_team ?? ''} @ ${payload.new.home_team ?? ''}`,
        homeTeam: payload.new.home_team ?? '',
        awayTeam: payload.new.away_team ?? '',
        gameTime: payload.new.game_time ?? payload.new.detected_at,
        profitPercentage: profitPct,
        description: `${profitPct.toFixed(2)}% potential profit`,
        confidence: 'high',
        created_at: payload.new.detected_at ?? new Date().toISOString()
      };
      setOpportunities(prev => [newOpp, ...prev]);
    }
  });

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const [edgeRes, arbRes, propsRes] = await Promise.all([
        fetch('/api/opportunities?type=edge'),
        fetch('/api/opportunities?type=arbitrage'),
        fetch('/api/props')
      ]);

      const [edgeData, arbData, propsData] = await Promise.all([
        edgeRes.json(),
        arbRes.json(),
        propsRes.json()
      ]);

      const allOpps: Opportunity[] = [];

      // Add edge opportunities
      if (edgeData.opportunities) {
        edgeData.opportunities.forEach((opp: { id: string; sport: string; event: string; home_team: string; away_team: string; game_time: string; edge: number; bookmaker: string; market_odds: number; confidence_score: number; created_at: string }) => {
          allOpps.push({
            id: opp.id,
            type: 'value_bet',
            sport: opp.sport,
            event: opp.event,
            homeTeam: opp.home_team,
            awayTeam: opp.away_team,
            gameTime: opp.game_time,
            edge: opp.edge,
            description: `${(opp.edge * 100).toFixed(2)}% edge`,
            bookmaker: opp.bookmaker,
            odds: opp.market_odds,
            confidence: opp.confidence_score > 0.7 ? 'high' : opp.confidence_score > 0.5 ? 'medium' : 'low',
            created_at: opp.created_at
          });
        });
      }

      // Add arbitrage opportunities
      if (arbData.opportunities) {
        arbData.opportunities.forEach((opp: { event: string; sport: string; homeTeam: string; awayTeam: string; gameTime: string; profitPercentage: number; totalStake: number }) => {
          allOpps.push({
            id: opp.event + '-arb',
            type: 'arbitrage',
            sport: opp.sport,
            event: opp.event,
            homeTeam: opp.homeTeam,
            awayTeam: opp.awayTeam,
            gameTime: opp.gameTime,
            profitPercentage: opp.profitPercentage,
            description: `${opp.profitPercentage.toFixed(2)}% potential profit`,
            confidence: 'high',
            created_at: new Date().toISOString()
          });
        });
      }

      // Add player prop opportunities
      if (propsData.props && Array.isArray(propsData.props)) {
        propsData.props.forEach((prop: any) => {
          allOpps.push({
            id: `${prop.player_name}-${prop.stat_type}-prop`,
            type: 'player_prop',
            sport: prop.sport ?? 'Unknown',
            event: prop.game ?? '',
            homeTeam: '',
            awayTeam: prop.player_name ?? '',
            gameTime: prop.game_time ?? new Date().toISOString(),
            description: `${prop.player_name}: ${prop.stat_type} ${prop.line} (${prop.bookmaker})`,
            bookmaker: prop.bookmaker,
            odds: prop.over_price,
            confidence: 'medium',
            created_at: prop.updated_at ?? new Date().toISOString(),
          });
        });
      }

      // Sort by created_at
      allOpps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setOpportunities(allOpps);
    } catch (error) {
      console.error('[OpportunitiesFeed] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOpportunities = opportunities.filter((opp: any) => 
    filter === 'all' || opp.type === filter
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Live Opportunities</h1>
              <p className="mt-1 text-sm text-[var(--text-faint)]">
                Real-time betting intelligence across all markets
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

          {/* Filters */}
          <div className="mt-6 flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'all', label: 'All' },
                { key: 'arbitrage', label: 'Arbitrage' },
                { key: 'value_bet', label: 'Value Bets' },
                { key: 'sharp_move', label: 'Sharp Moves' },
                { key: 'player_prop', label: 'Player Props' },
              ] as const).map(({ key, label }) => {
                const count = key === 'all'
                  ? opportunities.length
                  : opportunities.filter(o => o.type === key).length;
                const isActive = filter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-foreground'
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold w-4 h-4 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                      }`}>
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities Feed */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Feed Column */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredOpportunities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">No opportunities found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Check back soon for new betting opportunities
                </p>
              </div>
            ) : (
              filteredOpportunities.map((opp: any, i: number) => (
                <div
                  key={opp.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 transition-all hover:border-blue-500/40 cursor-pointer animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                  onClick={() => setSelectedGame(opp.event)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          opp.type === 'arbitrage' ? 'bg-green-500/10 text-green-500' :
                          opp.type === 'value_bet' ? 'bg-blue-500/10 text-blue-500' :
                          opp.type === 'sharp_move' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-purple-500/10 text-purple-500'
                        }`}>
                          {opp.type === 'value_bet' ? 'Value Bet' :
                           opp.type === 'sharp_move' ? 'Sharp Move' :
                           opp.type === 'player_prop' ? 'Player Prop' :
                           'Arbitrage'}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs ${
                          opp.confidence === 'high' ? 'text-green-500' :
                          opp.confidence === 'medium' ? 'text-yellow-500' :
                          'text-[var(--text-faint)]'
                        }`}>
                          <Target className="h-3 w-3" />
                          {opp.confidence.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">{opp.sport}</span>
                      </div>
                      
                      <h3 className="mt-3 text-lg font-semibold">
                        {opp.awayTeam} @ {opp.homeTeam}
                      </h3>
                      
                      <p className="mt-2 text-sm text-[var(--text-faint)]">
                        {opp.description}
                      </p>

                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-[var(--text-faint)]">
                          <Clock className="h-4 w-4" />
                          {new Date(opp.gameTime).toLocaleString()}
                        </div>
                        {opp.bookmaker && (
                          <div className="rounded bg-[var(--bg-elevated)] px-2 py-1 text-xs font-medium text-[var(--text-muted)]">
                            {opp.bookmaker}
                          </div>
                        )}
                      </div>
                    </div>

                    {(opp.edge !== undefined || opp.profitPercentage !== undefined) && (
                      <div className="ml-4 rounded-lg bg-green-500/10 p-4 text-center">
                        <p className="text-2xl font-bold text-green-500">
                          {opp.type === 'arbitrage' 
                            ? `${opp.profitPercentage?.toFixed(2)}%`
                            : `${((opp.edge || 0) * 100).toFixed(2)}%`
                          }
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-faint)]">
                          {opp.type === 'arbitrage' ? 'Profit' : 'Edge'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats Card */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
              <h3 className="text-lg font-semibold text-foreground">Today's Summary</h3>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-faint)]">Total Opportunities</span>
                  <span className="text-lg font-bold">{filteredOpportunities.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-faint)]">Arbitrage</span>
                  <span className="text-lg font-bold text-green-500">
                    {opportunities.filter(o => o.type === 'arbitrage').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-faint)]">Value Bets</span>
                  <span className="text-lg font-bold text-blue-500">
                    {opportunities.filter(o => o.type === 'value_bet').length}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Movement Chart */}
            {selectedGame && (
              <LineMovementChart
                gameId={selectedGame}
                homeTeam={filteredOpportunities.find(o => o.event === selectedGame)?.homeTeam || ''}
                awayTeam={filteredOpportunities.find(o => o.event === selectedGame)?.awayTeam || ''}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
