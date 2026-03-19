'use client';

/**
 * /picks — Daily MLB HR Picks
 *
 * Displays today's ranked picks from the automated picks engine.
 * Filters by tier (ELITE / STRONG / LEAN), sortable by edge or score.
 */

import { useEffect, useState } from 'react';
import type { PickResult } from '@/lib/picks-engine';
import type { BetTier } from '@/lib/card-pipeline';

// ── Tier config ────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<BetTier, { label: string; color: string; bg: string }> = {
  ELITE:  { label: 'ELITE',  color: 'text-yellow-300', bg: 'bg-yellow-900/40 border-yellow-500/40' },
  STRONG: { label: 'STRONG', color: 'text-green-300',  bg: 'bg-green-900/40  border-green-500/40'  },
  LEAN:   { label: 'LEAN',   color: 'text-blue-300',   bg: 'bg-blue-900/40   border-blue-500/40'   },
  PASS:   { label: 'PASS',   color: 'text-zinc-400',   bg: 'bg-zinc-800/40   border-zinc-600/40'   },
};

const TIERS: BetTier[] = ['ELITE', 'STRONG', 'LEAN'];

// ── Factor badge ───────────────────────────────────────────────────────────────

function FactorBadge({
  label, value, kind,
}: { label: string; value: number; kind: 'mult' }) {
  const delta  = kind === 'mult' ? value - 1 : value;
  const isUp   = delta >  0.005;
  const isDown = delta < -0.005;
  const color  = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-zinc-400';
  const display = kind === 'mult'
    ? (value === 1.0 ? '—' : `${value.toFixed(2)}×`)
    : (value === 0   ? '—' : `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}pp`);
  return (
    <span>
      {label}: <span className={color}>{display}</span>
    </span>
  );
}

// ── American odds formatter ────────────────────────────────────────────────────

function fmtOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : String(odds);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ── Tier badge ─────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: BetTier }) {
  const cfg = TIER_CONFIG[tier];
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded border ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ── Pick card ──────────────────────────────────────────────────────────────────

function PickCard({ pick }: { pick: PickResult }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TIER_CONFIG[pick.tier];

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <TierBadge tier={pick.tier} />
          {pick.sharpBoosted && (
            <span className="text-orange-400 text-sm" title="Sharp money detected">🔥</span>
          )}
          <span className="font-semibold text-white text-base">{pick.canonicalName}</span>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-xl font-bold ${cfg.color}`}>{fmtOdds(pick.bestOdds)}</div>
          <div className="text-xs text-zinc-400">{pick.bestBook}</div>
        </div>
      </div>

      {/* Game context */}
      <div className="text-sm text-zinc-300">
        {pick.awayTeam} @ {pick.homeTeam}
        {pick.opposingPitcher && (
          <span className="text-zinc-400">
            {' '}vs {pick.opposingPitcher}{pick.pitcherHand ? ` (${pick.pitcherHand}HP)` : ''}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded bg-black/30 p-2">
          <div className="text-zinc-400 mb-0.5">Model</div>
          <div className="text-white font-medium">{fmtPct(pick.modelProbability)}</div>
        </div>
        <div className="rounded bg-black/30 p-2">
          <div className="text-zinc-400 mb-0.5">Market</div>
          <div className="text-white font-medium">{fmtPct(pick.impliedProbability)}</div>
        </div>
        <div className="rounded bg-black/30 p-2">
          <div className="text-zinc-400 mb-0.5">Edge</div>
          <div className={`font-medium ${pick.adjustedEdge > 0 ? 'text-green-400' : 'text-red-400'}`}>
            +{pick.adjustedEdge.toFixed(1)}pp
          </div>
        </div>
        <div className="rounded bg-black/30 p-2">
          <div className="text-zinc-400 mb-0.5">Score</div>
          <div className="text-white font-medium">{pick.score.toFixed(1)}</div>
        </div>
      </div>

      {/* Adjustment factors — 5-factor stack */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-zinc-400">
        <FactorBadge label="Weather"  value={pick.weatherFactor}             kind="mult" />
        <FactorBadge label="Matchup"  value={pick.matchupFactor}             kind="mult" />
        <FactorBadge label="Park"     value={pick.parkFactor}                kind="mult" />
        <FactorBadge label="Umpire"   value={1 + pick.umpireBoost}           kind="mult" />
        <FactorBadge label="Bullpen"  value={pick.bullpenFactor}             kind="mult" />
        <span className="text-zinc-600 text-right col-span-1 self-center truncate">
          {pick.dataSource}
        </span>
      </div>
      {pick.homeUmpire && (
        <div className="text-xs text-zinc-500">
          HP Ump: <span className="text-zinc-300">{pick.homeUmpire}</span>
          {pick.umpireBoost !== 0 && (
            <span className={pick.umpireBoost > 0 ? 'text-green-400 ml-1' : 'text-red-400 ml-1'}>
              ({pick.umpireBoost > 0 ? '+' : ''}{(pick.umpireBoost * 100).toFixed(0)}pp)
            </span>
          )}
        </div>
      )}

      {/* Multi-book lines (expandable) */}
      {pick.allLines.length > 1 && (
        <div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? '▲ Hide' : '▼ Show'} {pick.allLines.length} books
          </button>
          {expanded && (
            <div className="mt-2 space-y-1">
              {pick.allLines.map((l, i) => (
                <div key={i} className="flex justify-between text-xs text-zinc-300">
                  <span>{l.bookmaker}</span>
                  <span>{fmtOdds(l.overOdds)}</span>
                  <span className="text-zinc-500">{fmtPct(l.impliedProbability)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PicksPage() {
  const [picks, setPicks]         = useState<PickResult[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<BetTier | 'ALL'>('ALL');
  const [generating, setGenerating] = useState(false);
  const [date, setDate]           = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
  );

  const loadPicks = async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/daily-picks?date=${d}&minTier=LEAN`);
      const json = await res.json() as { success: boolean; data?: PickResult[]; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Unknown error');
      setPicks(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load picks');
    } finally {
      setLoading(false);
    }
  };

  const triggerGeneration = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/daily-picks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date, minTier: 'LEAN', save: true }),
      });
      const json = await res.json() as { success: boolean; data?: PickResult[]; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Generation failed');
      setPicks(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => { loadPicks(date); }, [date]);

  const visiblePicks = activeTier === 'ALL'
    ? picks
    : picks.filter(p => p.tier === activeTier);

  const tierCounts = Object.fromEntries(
    TIERS.map(t => [t, picks.filter(p => p.tier === t).length]),
  ) as Record<BetTier, number>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">⚾ Daily HR Picks</h1>
            <p className="text-sm text-zinc-400 mt-0.5">Statcast-powered model vs market edge</p>
          </div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-1.5 text-sm"
          />
        </div>

        {/* Tier filter tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTier('ALL')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeTier === 'ALL' ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            All ({picks.length})
          </button>
          {TIERS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTier(t)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                activeTier === t
                  ? `${TIER_CONFIG[t].bg} ${TIER_CONFIG[t].color}`
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {t} ({tierCounts[t] ?? 0})
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-500/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Picks list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 rounded-xl bg-zinc-800/50 animate-pulse" />
            ))}
          </div>
        ) : visiblePicks.length > 0 ? (
          <div className="space-y-3">
            {visiblePicks.map((pick, i) => (
              <PickCard key={`${pick.canonicalName}-${i}`} pick={pick} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 space-y-4">
            <p className="text-zinc-400">
              {picks.length === 0 ? 'No picks generated yet for this date.' : 'No picks match the selected filter.'}
            </p>
            {picks.length === 0 && (
              <button
                onClick={triggerGeneration}
                disabled={generating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                {generating ? 'Generating…' : 'Generate Picks Now'}
              </button>
            )}
          </div>
        )}

        {/* Generate button when picks exist */}
        {picks.length > 0 && (
          <div className="flex justify-center pt-2">
            <button
              onClick={triggerGeneration}
              disabled={generating}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-sm text-zinc-300 transition-colors"
            >
              {generating ? 'Refreshing…' : '↻ Refresh picks'}
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600 pt-4">
          Picks auto-generated daily at 7 AM UTC (≈2–3 AM ET) via Vercel cron.
          Model = Bayesian logistic regression on Statcast EV + barrel%.
          Not financial advice.
        </p>
      </div>
    </div>
  );
}
