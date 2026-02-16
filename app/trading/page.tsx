'use client';

import { useState, useEffect } from 'react';
import { runTradingEngine } from '@/lib/engine/runTradingEngine';
import type { TradingInput, TradingEngineResult } from '@/lib/engine/runTradingEngine';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Activity, 
  Target, 
  Zap,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Clock,
  RefreshCw
} from 'lucide-react';

export default function TradingEngineDashboard() {
  const [results, setResults] = useState<TradingEngineResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Demo inputs - replace with real API data
  const demoInputs: TradingInput = {
    odds: [
      {
        bookmaker: 'DraftKings',
        market: 'h2h',
        outcomes: [
          { name: 'Lakers', price: -110, points: null },
          { name: 'Warriors', price: -110, points: null }
        ]
      },
      {
        bookmaker: 'FanDuel',
        market: 'h2h',
        outcomes: [
          { name: 'Lakers', price: 105, points: null },
          { name: 'Warriors', price: -125, points: null }
        ]
      },
      {
        bookmaker: 'BetMGM',
        market: 'h2h',
        outcomes: [
          { name: 'Lakers', price: -105, points: null },
          { name: 'Warriors', price: -115, points: null }
        ]
      }
    ],
    tickets: [
      { side: 'Lakers', count: 3500, handle: 125000 },
      { side: 'Warriors', count: 4200, handle: 98000 }
    ],
    lines: [
      { time: new Date(Date.now() - 3600000), price: -108, bookmaker: 'consensus' },
      { time: new Date(Date.now() - 1800000), price: -110, bookmaker: 'consensus' },
      { time: new Date(), price: -110, bookmaker: 'consensus' }
    ],
    kalshiMarket: {
      event: 'NBA-Lakers-Win',
      currentPrice: 0.52,
      historicalPrices: [0.48, 0.50, 0.51, 0.52, 0.52],
      volume24h: 45000,
      openInterest: 125000
    },
    modelProbability: 0.58,
    bankroll: 10000
  };

  const runEngine = async () => {
    setIsRunning(true);
    try {
      const engineResults = runTradingEngine(demoInputs);
      setResults(engineResults);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[v0] Trading engine error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runEngine();
  }, []);

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatOdds = (decimal: number) => {
    const american = decimal >= 2.0 
      ? `+${Math.round((decimal - 1) * 100)}`
      : `-${Math.round(100 / (decimal - 1))}`;
    return american;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Trading Engine</h1>
            <p className="text-muted-foreground mt-1">
              Real-time arbitrage, sharp money, and Kelly sizing analysis
            </p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
              </div>
            )}
            <button
              onClick={runEngine}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Running...' : 'Run Analysis'}
            </button>
          </div>
        </div>

        {results && (
          <>
            {/* Arbitrage Opportunities */}
            {results.arbitrage && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-[var(--success)]/10 rounded-xl">
                    <Zap className="w-6 h-6 text-[var(--success)]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Arbitrage Opportunity</h2>
                    <p className="text-sm text-muted-foreground">Risk-free profit detected</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Total Implied Prob</div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatPercent(results.arbitrage.totalImpliedProbability)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Profit Margin</div>
                    <div className="text-2xl font-bold text-[var(--success)]">
                      {formatPercent(results.arbitrage.profitMargin)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Expected Return</div>
                    <div className="text-2xl font-bold text-[var(--success)]">
                      {formatCurrency(results.arbitrage.expectedReturn)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-foreground mb-2">Optimal Bet Allocation</div>
                  {results.arbitrage.bets.map((bet, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-background/50 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{bet.outcome}</div>
                          <div className="text-sm text-muted-foreground">{bet.bookmaker}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground">{formatCurrency(bet.stake)}</div>
                        <div className="text-sm text-muted-foreground">@ {formatOdds(bet.odds)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sharp Money Detection */}
            {results.sharp && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-[var(--warning)]/10 rounded-xl">
                    <Activity className="w-6 h-6 text-[var(--warning)]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Sharp Money Analysis</h2>
                    <p className="text-sm text-muted-foreground">Reverse line movement detected</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Public Side</div>
                    <div className="text-xl font-bold text-foreground">{results.sharp.publicSide}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatPercent(results.sharp.publicPercentage)} tickets
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Sharp Side</div>
                    <div className="text-xl font-bold text-[var(--warning)]">{results.sharp.sharpSide}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Reverse movement
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Money % (Sharp)</div>
                    <div className="text-xl font-bold text-foreground">
                      {formatPercent(results.sharp.moneyPercentage)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Confidence</div>
                    <div className="text-xl font-bold text-[var(--success)]">
                      {results.sharp.isReverseLineMovement ? 'High' : 'Medium'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Kelly Criterion */}
            {results.kelly && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-[var(--info)]/10 rounded-xl">
                    <Target className="w-6 h-6 text-[var(--info)]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Kelly Criterion Sizing</h2>
                    <p className="text-sm text-muted-foreground">Optimal bankroll allocation</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Your Edge</div>
                    <div className="text-2xl font-bold text-[var(--success)]">
                      {formatPercent(results.kelly.edge)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Full Kelly</div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatCurrency(results.kelly.fullKellyStake)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatPercent(results.kelly.fullKellyPercent)} of bankroll
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Half Kelly</div>
                    <div className="text-2xl font-bold text-[var(--info)]">
                      {formatCurrency(results.kelly.halfKellyStake)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatPercent(results.kelly.halfKellyPercent)} of bankroll
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Expected Value</div>
                    <div className="text-2xl font-bold text-[var(--success)]">
                      {formatCurrency(results.kelly.expectedValue)}
                    </div>
                  </div>
                </div>

                <div className="bg-[var(--info)]/5 border border-[var(--info)]/20 rounded-xl p-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-[var(--info)] mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-foreground">
                    <span className="font-semibold">Recommendation:</span> Use half-Kelly for conservative bankroll growth. 
                    Full Kelly maximizes long-term growth but increases variance significantly.
                  </div>
                </div>
              </div>
            )}

            {/* Line Movement */}
            {results.lineMovement && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    {results.lineMovement.direction === 'up' ? (
                      <TrendingUp className="w-6 h-6 text-primary" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-destructive" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Line Movement Analysis</h2>
                    <p className="text-sm text-muted-foreground">Opening to current price tracking</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Opening Line</div>
                    <div className="text-xl font-bold text-foreground">
                      {formatOdds(results.lineMovement.openingPrice)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Current Line</div>
                    <div className="text-xl font-bold text-foreground">
                      {formatOdds(results.lineMovement.currentPrice)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Movement</div>
                    <div className={`text-xl font-bold flex items-center gap-1 ${
                      results.lineMovement.direction === 'up' ? 'text-[var(--success)]' : 'text-destructive'
                    }`}>
                      {results.lineMovement.direction === 'up' ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5" />
                      )}
                      {formatPercent(Math.abs(results.lineMovement.percentChange))}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Strength</div>
                    <div className="text-xl font-bold text-foreground capitalize">
                      {results.lineMovement.strength}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Kalshi Analysis */}
            {results.kalshi && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Kalshi Market Analysis</h2>
                    <p className="text-sm text-muted-foreground">Prediction market volatility & edge</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Current Price</div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatPercent(results.kalshi.currentPrice)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Volatility</div>
                    <div className="text-2xl font-bold text-[var(--warning)]">
                      {results.kalshi.volatility.toFixed(3)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {results.kalshi.isVolatile ? 'High' : 'Low'}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">Model Edge</div>
                    <div className={`text-2xl font-bold ${
                      results.kalshi.edgeVsModel > 0 ? 'text-[var(--success)]' : 'text-destructive'
                    }`}>
                      {results.kalshi.edgeVsModel > 0 ? '+' : ''}{formatPercent(results.kalshi.edgeVsModel)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-1">24h Volume</div>
                    <div className="text-2xl font-bold text-foreground">
                      {results.kalshi.volume24h.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Engine Metadata */}
            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                <span>
                  Analysis complete • {results.metadata.modulesRun.length} modules executed • 
                  Timestamp: {new Date(results.metadata.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          </>
        )}

        {!results && !isRunning && (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No Analysis Yet</h3>
              <p className="text-muted-foreground mb-6">
                Click "Run Analysis" to start the trading engine and detect opportunities
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
