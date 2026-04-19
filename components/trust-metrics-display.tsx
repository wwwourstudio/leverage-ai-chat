'use client';

import React from 'react';
import { Shield, AlertTriangle, CheckCircle2, TrendingUp, Activity, BarChart3, Cpu, Database, Zap, Globe } from 'lucide-react';

export interface TrustMetrics {
  benfordIntegrity: number;
  oddsAlignment: number;
  marketConsensus: number;
  historicalAccuracy: number;
  finalConfidence: number;
  trustLevel: 'high' | 'medium' | 'low';
  riskLevel: 'low' | 'medium' | 'high';
  flags?: Array<{
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }>;
  adjustedTone?: string;
  // Optional enriched metadata forwarded from the message
  modelUsed?: string;
  sources?: Array<{ name: string; type: string; reliability: number }>;
  processingTime?: number;
  hasLiveOdds?: boolean;
  hasKalshi?: boolean;
}

interface TrustMetricsDisplayProps {
  metrics: TrustMetrics;
  compact?: boolean;
  showDetails?: boolean;
}

// ── Flag metadata: human-readable titles + explanations ──────────────────────

const FLAG_META: Record<string, { title: string; explanation: string; showOddsChart?: boolean }> = {
  odds_impossible: {
    title: 'Invalid Odds Detected',
    explanation:
      'The AI cited moneyline odds that cannot exist at any real sportsbook. Valid US moneylines range from -100 to -3000 (favorites) or +100 to +3000 (underdogs). Values between -99 and +99 are mathematically undefined in this format.',
    showOddsChart: true,
  },
  odds_range: {
    title: 'Implausible Odds',
    explanation:
      'One or more odds values cited are outside the realistic range used by sportsbooks. This suggests the AI may have confused percentage probabilities (e.g. 32%) with moneyline odds (e.g. +320). Treat these specific numbers with caution.',
    showOddsChart: true,
  },
  odds_mismatch: {
    title: 'Odds Not Verified by Live Data',
    explanation:
      'The AI cited specific odds that don\'t match today\'s live bookmaker lines. The odds may be outdated, from a different game, or fabricated. Always confirm odds directly with your sportsbook before placing a bet.',
  },
  extreme_probability: {
    title: 'Unrealistic Win Probability',
    explanation:
      'A win probability above 97% is essentially never valid in sports betting — even the heaviest favorites carry meaningful upset risk. This kind of claim is a strong signal of AI overconfidence or hallucination.',
  },
  high_probability: {
    title: 'High Confidence Claim',
    explanation:
      'Win probabilities above 90% are rare even for heavy favorites. Verify this against the implied probability in the actual moneyline odds before acting on it.',
  },
  guaranty_language: {
    title: '"Guaranteed" Language Used',
    explanation:
      'No sports bet is ever guaranteed. Phrases like "sure thing" or "can\'t lose" are hallucination signals — no legitimate analyst or model makes such claims.',
  },
};

function getFlagMeta(type: string) {
  return (
    FLAG_META[type] ?? {
      title: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      explanation: '',
    }
  );
}

/** Mini visual showing the valid moneyline range vs an invalid zone */
function OddsRangeChart({ badValues }: { badValues: number[] }) {
  return (
    <div className="mt-2 rounded-md bg-[var(--bg-overlay)] border border-[var(--border-subtle)] p-2.5">
      <p className="text-[9px] font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wide">How moneyline odds work</p>

      {/* Range bar */}
      <div className="relative flex items-center gap-0.5 h-5 text-[8px]">
        {/* Favorite side (negative) */}
        <div className="flex-1 h-3 rounded-l bg-blue-600/50 border border-blue-500/40 flex items-center justify-center text-blue-300 font-mono">
          -3000 → -100
        </div>
        {/* Dead zone */}
        <div className="w-16 h-3 bg-red-600/60 border border-red-500/50 flex items-center justify-center text-red-300 font-mono text-[7px]">
          -99…+99 ✗
        </div>
        {/* Underdog side (positive) */}
        <div className="flex-1 h-3 rounded-r bg-blue-600/50 border border-blue-500/40 flex items-center justify-center text-blue-300 font-mono">
          +100 → +3000
        </div>
      </div>

      <div className="flex justify-between mt-1 text-[8px] text-[var(--text-faint)]">
        <span className="text-blue-500">Heavy favorite</span>
        <span className="text-red-400 font-semibold">Invalid zone</span>
        <span className="text-blue-500">Heavy underdog</span>
      </div>

      {/* The flagged values */}
      {badValues.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {badValues.map((v) => (
            <span key={v} className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 font-mono text-[9px]">
              {v > 0 ? '+' : ''}{v} ✗
            </span>
          ))}
        </div>
      )}

      <p className="text-[8px] text-[var(--text-faint)] mt-1.5">
        Favorites are listed as negative (e.g. <span className="text-foreground/80 font-mono">-150</span>), underdogs as positive (e.g. <span className="text-foreground/80 font-mono">+130</span>). A value like <span className="text-red-400 font-mono">-49</span> has no meaning in this format.
      </p>
    </div>
  );
}

/** Extract the bad odds values from a flag message, e.g. "-49, -32, -29" → [-49, -32, -29] */
function extractBadOddsFromMessage(message: string): number[] {
  const matches = message.match(/[+-]?\d+/g);
  return matches ? matches.map(Number).filter((n) => Math.abs(n) < 100) : [];
}

/** Groups odds_impossible flags into one block, renders all other flags individually */
function FlagsList({ flags }: { flags: Array<{ type: string; message: string; severity: 'info' | 'warning' | 'error' }> }) {
  // Collect all impossible/implausible odds values into one chart
  const oddsFlags = flags.filter((f) => f.type === 'odds_impossible' || f.type === 'odds_range');
  const otherFlags = flags.filter((f) => f.type !== 'odds_impossible' && f.type !== 'odds_range');

  const allBadOdds: number[] = [];
  for (const f of oddsFlags) {
    allBadOdds.push(...extractBadOddsFromMessage(f.message));
  }

  const renderFlag = (flag: { type: string; message: string; severity: 'info' | 'warning' | 'error' }, i: number) => {
    const meta = getFlagMeta(flag.type);
    const fc =
      flag.severity === 'error'
        ? 'bg-red-500/10 border-red-500/30 text-red-400'
        : flag.severity === 'warning'
          ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
          : 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    return (
      <div key={i} className={`rounded-lg border px-2.5 py-2 text-[10px] ${fc}`}>
        <div className="flex items-center gap-1.5 font-semibold mb-0.5">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {meta.title}
        </div>
        {meta.explanation && (
          <p className="text-[9px] opacity-80 leading-relaxed">{meta.explanation}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1.5">
      {/* Grouped odds flags */}
      {oddsFlags.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[10px] text-red-400">
          <div className="flex items-center gap-1.5 font-semibold mb-0.5">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            AI Cited Invalid Odds
          </div>
          <p className="text-[9px] opacity-80 leading-relaxed">
            The AI mentioned specific odds that don't exist in any real sportsbook. Valid US moneylines are always{' '}
            <span className="font-mono text-red-300">-100</span> or lower (favorites) or{' '}
            <span className="font-mono text-red-300">+100</span> or higher (underdogs).
            Values between -99 and +99 are not valid odds — the AI likely confused odds with percentages or made them up.
          </p>
          <OddsRangeChart badValues={[...new Set(allBadOdds)]} />
        </div>
      )}

      {/* All other flags */}
      {otherFlags.map((flag, i) => renderFlag(flag, i))}
    </div>
  );
}

const METRIC_DEFS = [
  {
    key: 'benfordIntegrity' as const,
    label: 'Benford Integrity',
    icon: BarChart3,
    description: "Benford's Law digit-distribution test — flags manipulated or hallucinated odds",
  },
  {
    key: 'oddsAlignment' as const,
    label: 'Odds Alignment',
    icon: TrendingUp,
    description: 'Cross-book odds consistency across multiple sportsbooks',
  },
  {
    key: 'marketConsensus' as const,
    label: 'Market Consensus',
    icon: Activity,
    description: 'Agreement level between bookmakers on the current line',
  },
  {
    key: 'historicalAccuracy' as const,
    label: 'Historical Accuracy',
    icon: CheckCircle2,
    description: 'Grok 4 track record on prior similar predictions',
  },
];

function scoreColor(v: number) {
  if (v >= 85) return 'text-blue-400';
  if (v >= 70) return 'text-blue-400';
  if (v >= 55) return 'text-yellow-400';
  return 'text-red-400';
}

function barFill(v: number) {
  if (v >= 85) return 'bg-blue-500';
  if (v >= 70) return 'bg-blue-500';
  if (v >= 55) return 'bg-yellow-500';
  return 'bg-red-500';
}

function scoreLabel(v: number) {
  if (v >= 92) return 'Excellent';
  if (v >= 82) return 'Strong';
  if (v >= 68) return 'Fair';
  if (v >= 50) return 'Weak';
  return 'Low';
}

function trustBadgeStyle(level: 'high' | 'medium' | 'low') {
  if (level === 'high') return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
  if (level === 'medium') return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
  return 'bg-red-500/10 border-red-500/30 text-red-400';
}

function riskBadgeStyle(level: 'low' | 'medium' | 'high') {
  if (level === 'low') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (level === 'medium') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  return 'bg-red-500/10 text-red-400 border-red-500/20';
}

function sourceIcon(type: string) {
  switch (type) {
    case 'model': return Cpu;
    case 'database': return Database;
    case 'api': return Globe;
    default: return Zap;
  }
}

// ─── Compact badge ────────────────────────────────────────────────────────────

export function TrustMetricsBadge({ metrics }: { metrics: TrustMetrics }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${trustBadgeStyle(metrics.trustLevel)}`}>
      <Shield className="w-3 h-3" />
      <span>{metrics.trustLevel.toUpperCase()}</span>
      <span className="opacity-40">·</span>
      <span className="tabular-nums">{metrics.finalConfidence}%</span>
    </div>
  );
}

// ─── Full display ─────────────────────────────────────────────────────────────

export function TrustMetricsDisplay({ metrics, compact = false, showDetails = true }: TrustMetricsDisplayProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <div className={`flex items-center gap-1.5 ${scoreColor(metrics.finalConfidence)}`}>
          <Shield className="w-3.5 h-3.5" />
          <span className="font-semibold">{metrics.trustLevel.toUpperCase()} TRUST</span>
        </div>
        <span className="text-[var(--text-faint)]">·</span>
        <span className="tabular-nums text-[var(--text-muted)]">{metrics.finalConfidence}%</span>
        {metrics.adjustedTone && (
          <>
            <span className="text-[var(--text-faint)]">·</span>
            <span className="text-[var(--text-faint)]">{metrics.adjustedTone}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Headline row: confidence + risk ─────────────────── */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 bg-background border border-[var(--border-subtle)] rounded-xl px-3.5 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Shield className={`w-3.5 h-3.5 ${scoreColor(metrics.finalConfidence)}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Integrity Score</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black tabular-nums leading-none ${scoreColor(metrics.finalConfidence)}`}>
                {metrics.finalConfidence}%
              </span>
              <span className={`text-[10px] font-semibold ${scoreColor(metrics.finalConfidence)}`}>
                {scoreLabel(metrics.finalConfidence)}
              </span>
            </div>
          </div>
          <div className="h-1 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
            <div
              className={`h-full ${barFill(metrics.finalConfidence)} transition-all duration-500`}
              style={{ width: `${metrics.finalConfidence}%` }}
            />
          </div>
          {metrics.adjustedTone && (
            <p className="mt-1.5 text-[10px] text-[var(--text-faint)] font-medium">{metrics.adjustedTone}</p>
          )}
        </div>

        <div className={`flex-shrink-0 flex flex-col items-center justify-center px-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider min-w-[56px] ${riskBadgeStyle(metrics.riskLevel)}`}>
          <span className="text-[8px] opacity-60 mb-0.5">RISK</span>
          <span>{metrics.riskLevel}</span>
        </div>
      </div>

      {/* ── 4 metric grid ────────────────────────────────────── */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-1.5">
          {METRIC_DEFS.map(({ key, label, icon: Icon, description }) => {
            const val = metrics[key] as number;
            return (
              <div
                key={key}
                title={description}
                className="bg-background border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 hover:border-[var(--border-subtle)] transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className={`w-3 h-3 ${scoreColor(val)}`} />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)]">{label}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1.5">
                  <span className={`text-lg font-black tabular-nums leading-none ${scoreColor(val)}`}>{val}%</span>
                  <span className={`text-[9px] font-semibold ${scoreColor(val)}`}>{scoreLabel(val)}</span>
                </div>
                <div className="h-[2px] bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barFill(val)} transition-all duration-500`}
                    style={{ width: `${val}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Caution: overall high but a sub-score is critically low ─ */}
      {showDetails && metrics.finalConfidence >= 75 && (() => {
        const criticalLow = METRIC_DEFS.find(d => (metrics[d.key] as number) < 55);
        if (!criticalLow) return null;
        return (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-400">
            <div className="flex items-center gap-1.5 font-semibold mb-0.5">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {criticalLow.label} is flagging concerns
            </div>
            <p className="text-[9px] opacity-80 leading-relaxed">
              This sub-score is below 55%. The composite score weights multiple signals — treat this metric as a caution, not a full disqualifier.
            </p>
          </div>
        );
      })()}

      {/* ── Sources ──────────────────────────────────────────── */}
      {metrics.sources && metrics.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {metrics.sources.map((src, i) => {
            const Icon = sourceIcon(src.type);
            const reliColor = src.reliability >= 95
              ? 'text-blue-400 border-blue-500/20 bg-blue-500/5'
              : src.reliability >= 88
                ? 'text-blue-400 border-blue-500/20 bg-blue-500/5'
                : 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5';
            return (
              <div key={i} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium ${reliColor}`}>
                <Icon className="w-2.5 h-2.5" />
                <span>{src.name}</span>
                <span className="font-bold tabular-nums opacity-70">{src.reliability}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Verification tags ────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {metrics.hasLiveOdds && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400">
            <CheckCircle2 className="w-2.5 h-2.5" /> LIVE ODDS VERIFIED
          </span>
        )}
        {metrics.hasKalshi && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-bold text-cyan-400">
            <Globe className="w-2.5 h-2.5" /> KALSHI DATA
          </span>
        )}
        {metrics.processingTime && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[9px] text-[var(--text-faint)] font-mono">
            <Zap className="w-2.5 h-2.5" /> {metrics.processingTime}ms
          </span>
        )}
        {metrics.modelUsed && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[9px] font-bold text-purple-400">
            <Cpu className="w-2.5 h-2.5" /> {metrics.modelUsed.replace(/grok-[34](-fast)?/i, 'Grok 4').replace('Grok 3', 'Grok 4')}
          </span>
        )}
      </div>

      {/* ── Flags ────────────────────────────────────────────── */}
      {metrics.flags && metrics.flags.length > 0 && (
        <FlagsList flags={metrics.flags} />
      )}

      {/* ── Attribution ──────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
        <Shield className="w-2.5 h-2.5 text-[var(--text-faint)]" />
        <span className="text-[9px] text-[var(--text-faint)] font-medium">
          Validated by Grok 4 · Benford's Law · {metrics.hasLiveOdds ? 'Live odds data verified' : 'Knowledge-based analysis'}
        </span>
      </div>
    </div>
  );
}
