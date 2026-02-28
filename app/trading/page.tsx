'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Activity,
  Clock,
  ChevronRight,
  BarChart2,
  Zap,
  Target,
  ShieldAlert,
  Cpu,
  PlusCircle,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  americanToDecimal,
  americanToImplied,
  kellyFraction,
} from '@/lib/quant/quantEngine';
import type { QuantAnalysis, BetLeg } from '@/lib/quant/quantEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORTS = [
  { key: 'basketball_nba', label: 'NBA', color: 'text-orange-400' },
  { key: 'baseball_mlb', label: 'MLB', color: 'text-blue-400' },
  { key: 'icehockey_nhl', label: 'NHL', color: 'text-sky-400' },
  { key: 'americanfootball_nfl', label: 'NFL', color: 'text-emerald-400' },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface TrackedPosition extends BetLeg {
  status: 'pending' | 'open' | 'won' | 'lost';
  addedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : `${price}`;
}

function formatPct(val: number, decimals = 1): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(decimals)}%`;
}

function edgeColor(edge: number): string {
  if (edge > 0.05) return 'text-emerald-400';
  if (edge > 0.02) return 'text-yellow-400';
  if (edge > 0) return 'text-gray-300';
  return 'text-red-400';
}

function roiColor(roi: number): string {
  if (roi > 10) return 'text-emerald-400';
  if (roi > 0) return 'text-yellow-400';
  if (roi > -5) return 'text-gray-300';
  return 'text-red-400';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  sub,
  valueCls = 'text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  valueCls?: string;
}) {
  return (
    <div className="rounded-xl bg-[oklch(0.09_0.012_280)] border border-[oklch(0.17_0.015_280)] px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.38_0.01_280)]">{label}</span>
      <span className={cn('text-sm font-black tabular-nums', valueCls)}>{value}</span>
      {sub && <span className="text-[9px] text-[oklch(0.40_0.01_280)]">{sub}</span>}
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-1.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
      <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SectionHeader({ icon: Icon, title, badge }: { icon: React.ElementType; title: string; badge?: string | number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 text-blue-400" />
      <span className="text-[10px] font-black uppercase tracking-widest text-[oklch(0.55_0.01_280)]">{title}</span>
      {badge !== undefined && (
        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-[oklch(0.16_0.02_260)] text-[9px] font-black text-blue-400">
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Panel: Live Odds Scanner ─────────────────────────────────────────────────

function OddsScanner({
  events,
  loading,
  selectedSport,
  onSportChange,
  onAddLeg,
}: {
  events: OddsEvent[];
  loading: boolean;
  selectedSport: string;
  onSportChange: (s: string) => void;
  onAddLeg: (leg: BetLeg) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={Activity} title="Live Odds" badge={events.length} />

      {/* Sport tabs */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {SPORTS.map(s => (
          <button
            key={s.key}
            onClick={() => onSportChange(s.key)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all',
              selectedSport === s.key
                ? 'bg-blue-600 text-white'
                : 'bg-[oklch(0.14_0.012_280)] text-[oklch(0.46_0.01_280)] hover:text-white',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-0.5">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-[oklch(0.40_0.01_280)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Scanning odds…</span>
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="w-6 h-6 text-[oklch(0.28_0.01_280)] mb-2" />
            <p className="text-xs text-[oklch(0.38_0.01_280)]">No games scheduled</p>
          </div>
        )}

        {!loading && events.map(event => {
          const book = event.bookmakers?.[0];
          const h2h = book?.markets?.find(m => m.key === 'h2h');
          const home = h2h?.outcomes?.find(o => o.name === event.home_team);
          const away = h2h?.outcomes?.find(o => o.name === event.away_team);
          const gameTime = new Date(event.commence_time);
          const live = gameTime <= new Date();

          return (
            <div
              key={event.id}
              className="rounded-xl bg-[oklch(0.09_0.012_280)] border border-[oklch(0.17_0.015_280)] hover:border-blue-500/30 transition-all p-2.5 group"
            >
              {/* Time */}
              <div className="flex items-center gap-1.5 mb-1.5">
                {live ? (
                  <span className="flex items-center gap-1 text-[9px] font-black text-red-400 uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="text-[9px] text-[oklch(0.38_0.01_280)]">
                    {gameTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {gameTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
                {book && <span className="ml-auto text-[8px] text-[oklch(0.32_0.01_280)]">{book.title}</span>}
              </div>

              {/* Teams */}
              <div className="space-y-1">
                {[
                  { team: event.away_team, outcome: away },
                  { team: event.home_team, outcome: home },
                ].map(({ team, outcome }) => {
                  if (!outcome) return null;
                  const implied = americanToImplied(outcome.price);
                  const edge = 0.54 - implied; // placeholder model edge (54% model base)

                  return (
                    <div key={team} className="flex items-center gap-2">
                      <span className="flex-1 text-[11px] text-white truncate">{team}</span>
                      <span className={cn('text-[11px] font-black tabular-nums', outcome.price < 0 ? 'text-emerald-400' : 'text-amber-400')}>
                        {formatOdds(outcome.price)}
                      </span>
                      <span className={cn('text-[9px] font-semibold tabular-nums w-10 text-right', edgeColor(edge))}>
                        {edge > 0 ? `+${(edge * 100).toFixed(1)}%` : `${(edge * 100).toFixed(1)}%`}
                      </span>
                      <button
                        onClick={() => onAddLeg({
                          id: `${event.id}-${team}`,
                          label: `${team} ${formatOdds(outcome.price)}`,
                          americanOdds: outcome.price,
                          modelProb: Math.max(0.05, Math.min(0.95, implied + edge)),
                        })}
                        className="p-1 rounded-md bg-blue-900/30 hover:bg-blue-700/50 text-blue-400 hover:text-blue-200 transition-all opacity-0 group-hover:opacity-100"
                        title="Add to Kelly calculator"
                      >
                        <PlusCircle className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel: Kelly Calculator ──────────────────────────────────────────────────

function KellyCalculator({
  bankroll,
  onBankrollChange,
  legs,
  onAddLeg,
  onRemoveLeg,
  analysis,
  loading,
  onRunAnalysis,
}: {
  bankroll: number;
  onBankrollChange: (v: number) => void;
  legs: BetLeg[];
  onAddLeg: (leg: BetLeg) => void;
  onRemoveLeg: (id: string) => void;
  analysis: QuantAnalysis | null;
  loading: boolean;
  onRunAnalysis: () => void;
}) {
  const [newOdds, setNewOdds] = useState('');
  const [newProb, setNewProb] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const handleAddManual = () => {
    const odds = parseFloat(newOdds);
    const prob = parseFloat(newProb) / 100;
    if (isNaN(odds) || isNaN(prob) || prob <= 0 || prob >= 1) return;
    onAddLeg({
      id: `manual-${Date.now()}`,
      label: newLabel || `Bet ${legs.length + 1}`,
      americanOdds: odds,
      modelProb: prob,
    });
    setNewOdds(''); setNewProb(''); setNewLabel('');
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <SectionHeader icon={Target} title="Kelly Optimizer" />

      {/* Bankroll input */}
      <div className="rounded-xl bg-[oklch(0.09_0.012_280)] border border-[oklch(0.17_0.015_280)] px-3 py-2.5">
        <label className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.38_0.01_280)] mb-1 block">
          Bankroll ($)
        </label>
        <input
          type="number"
          value={bankroll}
          onChange={e => onBankrollChange(parseFloat(e.target.value) || 1000)}
          className="w-full bg-transparent text-white text-sm font-black tabular-nums focus:outline-none"
          min={1}
        />
      </div>

      {/* Manual leg entry */}
      <div className="rounded-xl bg-[oklch(0.09_0.012_280)] border border-[oklch(0.17_0.015_280)] px-3 py-2.5 space-y-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.38_0.01_280)]">Add Bet Leg</span>
        <input
          placeholder="Label (e.g. Lakers ML)"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          className="w-full bg-[oklch(0.07_0.01_280)] border border-[oklch(0.16_0.015_280)] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[oklch(0.35_0.01_280)] focus:outline-none focus:border-blue-500/50"
        />
        <div className="flex gap-2">
          <input
            placeholder="Odds (e.g. -180)"
            value={newOdds}
            onChange={e => setNewOdds(e.target.value)}
            className="flex-1 bg-[oklch(0.07_0.01_280)] border border-[oklch(0.16_0.015_280)] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[oklch(0.35_0.01_280)] focus:outline-none focus:border-blue-500/50"
          />
          <input
            placeholder="Win % (e.g. 58)"
            value={newProb}
            onChange={e => setNewProb(e.target.value)}
            className="flex-1 bg-[oklch(0.07_0.01_280)] border border-[oklch(0.16_0.015_280)] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[oklch(0.35_0.01_280)] focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <button
          onClick={handleAddManual}
          disabled={!newOdds || !newProb}
          className="w-full py-1.5 rounded-lg bg-blue-700/40 hover:bg-blue-600/60 border border-blue-600/40 text-xs font-bold text-blue-300 hover:text-blue-100 transition-all disabled:opacity-40"
        >
          + Add Leg
        </button>
      </div>

      {/* Legs list */}
      {legs.length > 0 && (
        <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
          {legs.map(leg => {
            const decimal = americanToDecimal(leg.americanOdds);
            const implied = americanToImplied(leg.americanOdds);
            const edge = leg.modelProb - implied;
            const fk = Math.max(0, kellyFraction(leg.modelProb, decimal));
            const stake = bankroll * Math.min(fk * 0.25, 0.05);

            return (
              <div
                key={leg.id}
                className="rounded-xl bg-[oklch(0.09_0.012_280)] border border-[oklch(0.17_0.015_280)] px-3 py-2 flex items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-white truncate">{leg.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-[oklch(0.40_0.01_280)]">{formatOdds(leg.americanOdds)}</span>
                    <span className="text-[9px] text-[oklch(0.40_0.01_280)]">·</span>
                    <span className={cn('text-[9px] font-bold', edgeColor(edge))}>
                      {edge > 0 ? '+' : ''}{(edge * 100).toFixed(1)}% edge
                    </span>
                    <span className="text-[9px] text-[oklch(0.40_0.01_280)]">·</span>
                    <span className="text-[9px] text-white font-bold">${stake.toFixed(2)}</span>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveLeg(leg.id)}
                  className="p-1 rounded text-[oklch(0.38_0.01_280)] hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Run analysis */}
      <button
        onClick={onRunAnalysis}
        disabled={legs.length === 0 || loading}
        className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-[oklch(0.14_0.012_280)] disabled:text-[oklch(0.35_0.01_280)] text-white text-xs font-black transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</>
        ) : (
          <><Cpu className="w-3.5 h-3.5" /> Run Quant Analysis</>
        )}
      </button>

      {analysis && <QuantSummary analysis={analysis} bankroll={bankroll} />}
    </div>
  );
}

// ─── Panel: Quant Analysis Summary ───────────────────────────────────────────

function QuantSummary({ analysis, bankroll }: { analysis: QuantAnalysis; bankroll: number }) {
  const { portfolio, monteCarlo, regime } = analysis;
  const pos = portfolio.positions.filter(p => p.edge > 0);

  return (
    <div className="space-y-2 rounded-xl bg-[oklch(0.07_0.01_280)] border border-[oklch(0.16_0.015_280)] p-3">
      <div className="flex items-center gap-2 mb-2">
        <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-[oklch(0.55_0.01_280)]">Quant Analysis</span>
      </div>

      {/* Kelly positions */}
      {pos.length > 0 && (
        <div className="space-y-1">
          {pos.map(p => (
            <div key={p.legId} className="flex items-center gap-2 py-1.5 border-b border-[oklch(0.14_0.01_280)] last:border-0">
              <span className="flex-1 text-[10px] text-white truncate">{p.label}</span>
              <span className={cn('text-[10px] font-bold', edgeColor(p.edge))}>
                {p.edge > 0 ? '+' : ''}{(p.edge * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] font-black text-white tabular-nums">${p.stake.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Monte Carlo results */}
      <div className="grid grid-cols-2 gap-1.5 mt-2">
        <StatBox
          label="Median ROI"
          value={formatPct(monteCarlo.medianROI)}
          valueCls={roiColor(monteCarlo.medianROI)}
          sub={`${analysis.monteCarlo.sharpeRatio.toFixed(2)} Sharpe`}
        />
        <StatBox
          label="VAR 95%"
          value={`-${monteCarlo.varPct95.toFixed(1)}%`}
          valueCls="text-red-400"
          sub="worst-case tail"
        />
        <StatBox
          label="P5 → P95"
          value={`${formatPct(monteCarlo.p5ROI)} / ${formatPct(monteCarlo.p95ROI)}`}
          valueCls="text-gray-300"
        />
        <StatBox
          label="Ruin Risk"
          value={`${monteCarlo.ruinProbability.toFixed(1)}%`}
          valueCls={monteCarlo.ruinProbability > 10 ? 'text-red-400' : monteCarlo.ruinProbability > 3 ? 'text-yellow-400' : 'text-emerald-400'}
          sub="P(lose >50%)"
        />
      </div>

      {/* P5 → P95 bar */}
      <div className="mt-1.5">
        <div className="flex justify-between text-[8px] text-[oklch(0.38_0.01_280)] mb-1">
          <span>P5: {formatPct(monteCarlo.p5ROI)}</span>
          <span>Median: {formatPct(monteCarlo.medianROI)}</span>
          <span>P95: {formatPct(monteCarlo.p95ROI)}</span>
        </div>
        <div className="h-2 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden relative">
          {/* Red zone: P5 to 0 */}
          {monteCarlo.p5ROI < 0 && (
            <div
              className="absolute h-full bg-red-500/50"
              style={{
                left: 0,
                width: `${Math.min(50, Math.abs(monteCarlo.p5ROI) / 2)}%`,
              }}
            />
          )}
          {/* Green zone: 0 to P95 */}
          <div
            className="absolute h-full bg-emerald-500/50"
            style={{
              left: '50%',
              width: `${Math.min(50, monteCarlo.p95ROI / 2)}%`,
            }}
          />
          {/* Median marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80"
            style={{ left: `${50 + monteCarlo.medianROI / 2}%` }}
          />
        </div>
      </div>

      {/* Regime */}
      {regime && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-[oklch(0.10_0.012_260)] border border-[oklch(0.18_0.02_260)]">
          <Zap className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-[9px] font-black text-purple-300 uppercase">{regime.regime} regime</span>
            <p className="text-[9px] text-[oklch(0.45_0.01_280)] mt-0.5">{regime.description}</p>
          </div>
        </div>
      )}

      {/* Warnings */}
      {portfolio.warnings.length > 0 && (
        <div className="space-y-1">
          {portfolio.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-900/20 border border-amber-700/30">
              <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[9px] text-amber-300">{w}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Panel: Risk Dashboard ────────────────────────────────────────────────────

function RiskPanel({
  positions,
  bankroll,
  analysis,
}: {
  positions: TrackedPosition[];
  bankroll: number;
  analysis: QuantAnalysis | null;
}) {
  const openPositions = positions.filter(p => p.status === 'open' || p.status === 'pending');
  const wonPositions = positions.filter(p => p.status === 'won');
  const lostPositions = positions.filter(p => p.status === 'lost');
  const totalStake = openPositions.reduce((s, p) => {
    const decimal = americanToDecimal(p.americanOdds);
    const implied = americanToImplied(p.americanOdds);
    const edge = p.modelProb - implied;
    const fk = Math.max(0, kellyFraction(p.modelProb, decimal));
    return s + bankroll * Math.min(fk * 0.25, 0.05);
  }, 0);
  const exposurePct = (totalStake / bankroll) * 100;
  const winRate = (wonPositions.length + lostPositions.length) > 0
    ? (wonPositions.length / (wonPositions.length + lostPositions.length)) * 100
    : null;

  return (
    <div className="flex flex-col h-full gap-3">
      <SectionHeader icon={ShieldAlert} title="Risk Monitor" />

      {/* Portfolio metrics */}
      <div className="grid grid-cols-2 gap-1.5">
        <StatBox
          label="Bankroll"
          value={`$${bankroll.toLocaleString()}`}
          valueCls="text-white"
        />
        <StatBox
          label="Exposure"
          value={`${exposurePct.toFixed(1)}%`}
          valueCls={exposurePct > 20 ? 'text-red-400' : exposurePct > 10 ? 'text-yellow-400' : 'text-emerald-400'}
          sub={`$${totalStake.toFixed(2)} deployed`}
        />
        <StatBox
          label="Open Bets"
          value={String(openPositions.length)}
          valueCls="text-white"
        />
        {winRate !== null ? (
          <StatBox
            label="Win Rate"
            value={`${winRate.toFixed(1)}%`}
            valueCls={winRate > 53 ? 'text-emerald-400' : winRate > 48 ? 'text-yellow-400' : 'text-red-400'}
            sub={`${wonPositions.length}W / ${lostPositions.length}L`}
          />
        ) : (
          <StatBox label="Win Rate" value="—" sub="No settled bets" />
        )}
      </div>

      {/* Exposure bar */}
      <div>
        <div className="flex justify-between text-[9px] text-[oklch(0.38_0.01_280)] mb-1">
          <span>Portfolio Exposure</span>
          <span className={exposurePct > 20 ? 'text-red-400' : 'text-[oklch(0.42_0.01_280)]'}>{exposurePct.toFixed(1)}%</span>
        </div>
        <MiniBar
          value={exposurePct}
          max={30}
          color={exposurePct > 20 ? 'from-red-500 to-rose-400' : exposurePct > 10 ? 'from-amber-500 to-yellow-400' : 'from-emerald-500 to-green-400'}
        />
      </div>

      {/* Quant metrics from last analysis */}
      {analysis && (
        <div className="grid grid-cols-2 gap-1.5">
          <StatBox
            label="Sharpe Ratio"
            value={analysis.monteCarlo.sharpeRatio.toFixed(2)}
            valueCls={analysis.monteCarlo.sharpeRatio > 1 ? 'text-emerald-400' : analysis.monteCarlo.sharpeRatio > 0.5 ? 'text-yellow-400' : 'text-red-400'}
          />
          <StatBox
            label="Portfolio Edge"
            value={formatPct(analysis.portfolio.portfolioEdge * 100)}
            valueCls={edgeColor(analysis.portfolio.portfolioEdge)}
          />
          <StatBox
            label="VAR 95%"
            value={`-${analysis.monteCarlo.varPct95.toFixed(1)}%`}
            valueCls="text-red-400"
          />
          <StatBox
            label="Ruin Prob"
            value={`${analysis.monteCarlo.ruinProbability.toFixed(1)}%`}
            valueCls={analysis.monteCarlo.ruinProbability > 10 ? 'text-red-400' : 'text-emerald-400'}
          />
        </div>
      )}

      {/* Open positions */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.38_0.01_280)] block mb-1.5">Position Tracker</span>
        {positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Target className="w-6 h-6 text-[oklch(0.28_0.01_280)] mb-2" />
            <p className="text-xs text-[oklch(0.38_0.01_280)]">No positions tracked</p>
            <p className="text-[9px] text-[oklch(0.32_0.01_280)] mt-1">Run quant analysis to auto-add positions</p>
          </div>
        ) : (
          <div className="space-y-1">
            {positions.map(p => {
              const decimal = americanToDecimal(p.americanOdds);
              const implied = americanToImplied(p.americanOdds);
              const edge = p.modelProb - implied;
              const fk = Math.max(0, kellyFraction(p.modelProb, decimal));
              const stake = bankroll * Math.min(fk * 0.25, 0.05);

              const statusDot = {
                pending: 'bg-yellow-400',
                open: 'bg-blue-400 animate-pulse',
                won: 'bg-emerald-400',
                lost: 'bg-red-400',
              }[p.status];

              return (
                <div
                  key={p.id}
                  className="rounded-xl bg-[oklch(0.09_0.012_280)] border border-[oklch(0.17_0.015_280)] px-2.5 py-2 flex items-center gap-2"
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusDot)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-white truncate">{p.label}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[8px] text-[oklch(0.40_0.01_280)]">{formatOdds(p.americanOdds)}</span>
                      <span className={cn('text-[8px] font-bold', edgeColor(edge))}>{edge >= 0 ? '+' : ''}{(edge * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-white tabular-nums">${stake.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Arbitrage Alert Banner ───────────────────────────────────────────────────

function ArbitrageAlert({ count, onScan, loading }: { count: number; onScan: () => void; loading: boolean }) {
  return (
    <button
      onClick={onScan}
      disabled={loading}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all',
        count > 0
          ? 'bg-emerald-900/30 border-emerald-600/40 text-emerald-300 hover:bg-emerald-800/40'
          : 'bg-[oklch(0.12_0.012_280)] border-[oklch(0.20_0.015_280)] text-[oklch(0.46_0.01_280)] hover:text-white',
      )}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : count > 0 ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <Zap className="w-3 h-3" />
      )}
      {loading ? 'Scanning arb…' : count > 0 ? `${count} Arb Opp${count > 1 ? 's' : ''}` : 'Scan Arbitrage'}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TradingPage() {
  const [selectedSport, setSelectedSport] = useState(SPORTS[0].key);
  const [events, setEvents] = useState<OddsEvent[]>([]);
  const [oddsLoading, setOddsLoading] = useState(true);
  const [oddsError, setOddsError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [bankroll, setBankroll] = useState(1000);
  const [legs, setLegs] = useState<BetLeg[]>([]);
  const [positions, setPositions] = useState<TrackedPosition[]>([]);
  const [analysis, setAnalysis] = useState<QuantAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const [arbCount, setArbCount] = useState(0);
  const [arbLoading, setArbLoading] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch odds ──────────────────────────────────────────────────────────────
  const fetchOdds = useCallback(async (sport: string) => {
    setOddsLoading(true);
    setOddsError(null);
    try {
      const res = await fetch('/api/odds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, marketType: 'h2h' }),
      });
      const data = await res.json();
      if (!data.success) {
        setOddsError(data.error || 'Failed to load odds');
        setEvents([]);
      } else {
        setEvents(Array.isArray(data.events) ? data.events : []);
        setLastUpdated(new Date());
      }
    } catch (err) {
      setOddsError(err instanceof Error ? err.message : 'Network error');
      setEvents([]);
    } finally {
      setOddsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOdds(selectedSport);
    // Auto-refresh every 5 minutes
    intervalRef.current = setInterval(() => fetchOdds(selectedSport), 5 * 60 * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [selectedSport, fetchOdds]);

  // ── Kelly / Quant analysis ───────────────────────────────────────────────────
  const handleRunAnalysis = async () => {
    if (legs.length === 0) return;
    setAnalysisLoading(true);
    try {
      const res = await fetch('/api/trading/quant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankroll, legs, simulations: 5000, horizon: 50 }),
      });
      const data = await res.json();
      if (data.success) {
        setAnalysis(data.data);
        // Auto-add positive-edge positions to tracker
        const newPositions: TrackedPosition[] = (data.data.portfolio.positions as any[])
          .filter((p: any) => p.edge > 0)
          .map((p: any) => {
            const leg = legs.find(l => l.id === p.legId);
            return {
              id: p.legId,
              label: p.label,
              americanOdds: leg?.americanOdds ?? 0,
              modelProb: leg?.modelProb ?? 0.5,
              status: 'pending' as const,
              addedAt: new Date().toISOString(),
            };
          });
        setPositions(prev => {
          const ids = new Set(prev.map(p => p.id));
          return [...prev, ...newPositions.filter(p => !ids.has(p.id))];
        });
      }
    } catch { /* non-critical */ }
    finally { setAnalysisLoading(false); }
  };

  // ── Arbitrage scan ──────────────────────────────────────────────────────────
  const handleArbScan = async () => {
    setArbLoading(true);
    try {
      const res = await fetch(`/api/trading/arbitrage?sport=${selectedSport}`);
      const data = await res.json();
      if (data.success) setArbCount(data.data.arbitrageCount ?? 0);
    } catch { /* non-critical */ }
    finally { setArbLoading(false); }
  };

  const handleAddLeg = (leg: BetLeg) => {
    setLegs(prev => prev.some(l => l.id === leg.id) ? prev : [...prev, leg]);
  };
  const handleRemoveLeg = (id: string) => {
    setLegs(prev => prev.filter(l => l.id !== id));
  };

  return (
    <div className="min-h-screen bg-[oklch(0.07_0.01_280)] text-white">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-[oklch(0.16_0.015_280)] bg-[oklch(0.08_0.012_280)]">
        <div className="mx-auto max-w-[1600px] flex items-center gap-4 px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[oklch(0.46_0.01_280)] hover:text-white transition-colors text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-black text-white tracking-tight">PRO TERMINAL</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 text-[9px] font-black">BETA</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {lastUpdated && (
              <div className="hidden md:flex items-center gap-1.5 text-[9px] text-[oklch(0.38_0.01_280)]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live · {lastUpdated.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            )}

            <ArbitrageAlert count={arbCount} onScan={handleArbScan} loading={arbLoading} />

            <button
              onClick={() => fetchOdds(selectedSport)}
              disabled={oddsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[oklch(0.20_0.015_280)] bg-[oklch(0.12_0.012_280)] text-[oklch(0.46_0.01_280)] hover:text-white text-xs font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', oddsLoading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Three-column layout ─────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[1600px] px-4 py-4">
        {oddsError && (
          <div className="mb-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-900/20 border border-red-700/30 text-xs text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {oddsError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr_1fr] gap-4 h-[calc(100vh-110px)] min-h-[600px]">

          {/* Column 1: Live Odds Scanner */}
          <div className="rounded-2xl bg-[oklch(0.08_0.012_280)] border border-[oklch(0.16_0.015_280)] p-4 overflow-hidden flex flex-col">
            <OddsScanner
              events={events}
              loading={oddsLoading}
              selectedSport={selectedSport}
              onSportChange={s => setSelectedSport(s)}
              onAddLeg={handleAddLeg}
            />
          </div>

          {/* Column 2: Kelly Optimizer + Monte Carlo */}
          <div className="rounded-2xl bg-[oklch(0.08_0.012_280)] border border-[oklch(0.16_0.015_280)] p-4 overflow-hidden flex flex-col">
            <KellyCalculator
              bankroll={bankroll}
              onBankrollChange={setBankroll}
              legs={legs}
              onAddLeg={handleAddLeg}
              onRemoveLeg={handleRemoveLeg}
              analysis={analysis}
              loading={analysisLoading}
              onRunAnalysis={handleRunAnalysis}
            />
          </div>

          {/* Column 3: Risk Monitor + Positions */}
          <div className="rounded-2xl bg-[oklch(0.08_0.012_280)] border border-[oklch(0.16_0.015_280)] p-4 overflow-hidden flex flex-col">
            <RiskPanel
              positions={positions}
              bankroll={bankroll}
              analysis={analysis}
            />
          </div>
        </div>

        {/* Info footer */}
        <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-xl bg-[oklch(0.09_0.012_280)] border border-[oklch(0.15_0.012_280)]">
          <Info className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-[9px] text-[oklch(0.38_0.01_280)] leading-relaxed">
            <span className="font-bold text-[oklch(0.50_0.01_280)]">Pro Terminal</span> — Kelly sizing uses ¼-Kelly (25%) by default with a 5% max position cap. Monte Carlo runs 5 000 simulations over 50 bets. Edge estimates in the odds scanner use a 54% baseline model — hover and add legs to the Kelly calculator for precise analysis with your own probability estimates. This is for informational purposes only; verify all odds before placing wagers.
          </p>
        </div>
      </main>
    </div>
  );
}
