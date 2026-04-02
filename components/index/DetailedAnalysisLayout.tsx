'use client';

import {
  Zap, Target, Award, DollarSign, TrendingUp, Medal, ShoppingCart,
  BarChart3, Activity, Sparkles, Info, BarChart, Shield, Loader2,
  CheckCircle2, ChevronRight,
} from 'lucide-react';

interface Metric {
  label: string;
  value: string;
}

interface Recommendation {
  label: string;
  value: string;
}

interface RiskAssessment {
  convictionLevel?: string;
  riskCategory?: string;
  positionSize?: string;
}

interface CardMeta {
  title?: string;
  category?: string;
  subcategory?: string;
  status?: string;
  type?: string;
}

export interface DetailedAnalysisData {
  card: CardMeta;
  metrics: Metric[];
  overview: string;
  marketContext: string;
  riskAssessment: RiskAssessment;
  recommendations: Recommendation[];
}

interface Props {
  data: DetailedAnalysisData;
  isTyping: boolean;
  onFollowUp: (type: 'correlated' | 'metrics', card: CardMeta) => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'live-odds': Zap,
  'player-prop': Target,
  'dfs-lineup': Award,
  'dfs-value': DollarSign,
  'adp-analysis': TrendingUp,
  'bestball-stack': Medal,
  'auction-value': ShoppingCart,
  'kalshi-market': BarChart3,
  'kalshi-weather': Activity,
  'cross-platform': Sparkles,
  'ai-prediction': Sparkles,
};

function getCardIcon(type?: string) {
  return (type && ICON_MAP[type]) || Sparkles;
}

/**
 * Renders the structured `__DETAILED_ANALYSIS__` JSON response from the AI.
 * Extracted from the inline IIFE in page-client.tsx messages.map().
 */
export function DetailedAnalysisLayout({ data, isTyping, onFollowUp }: Props) {
  const { card, metrics, overview, marketContext, riskAssessment, recommendations } = data;
  const CardIcon = getCardIcon(card.type);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] flex-shrink-0">
          <CardIcon className="w-5 h-5 text-foreground/70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-black text-foreground truncate">{card.title}</h2>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-[var(--bg-surface)] text-foreground/70 border border-[var(--border-subtle)]">
              {card.status}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wide">
            {card.category} / {card.subcategory}
          </p>
        </div>
      </div>

      {/* Overview */}
      <div className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-4">
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2">
          <Info className="w-3 h-3" />
          Overview
        </h3>
        <p className="text-sm text-foreground/80 leading-relaxed">{overview}</p>
      </div>

      {/* Key Metrics Grid */}
      <div>
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-3 flex items-center gap-2">
          <BarChart className="w-3 h-3" />
          Key Metrics
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((metric, idx) => (
            <div
              key={`metric-${idx}-${metric.label}`}
              className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-3 hover:border-[var(--border-hover)] transition-colors"
            >
              <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">{metric.label}</div>
              <div className="text-base font-black text-foreground">{metric.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Context */}
      <div className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-4">
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2">
          <TrendingUp className="w-3 h-3" />
          Market Context & Edge
        </h3>
        <p className="text-sm text-foreground/80 leading-relaxed">{marketContext}</p>
      </div>

      {/* Risk Assessment */}
      <div>
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-3 flex items-center gap-2">
          <Shield className="w-3 h-3" />
          Risk Assessment
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-3">
            <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Conviction</div>
            <div className="text-lg font-black text-foreground">{riskAssessment.convictionLevel}</div>
          </div>
          <div className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-3">
            <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Risk</div>
            <div className="text-sm font-black text-foreground">{riskAssessment.riskCategory}</div>
          </div>
          <div className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-3">
            <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Position</div>
            <div className="text-lg font-black text-foreground">{riskAssessment.positionSize}</div>
            <div className="text-[9px] text-[var(--text-faint)] mt-0.5">of bankroll</div>
          </div>
        </div>
      </div>

      {/* Strategic Recommendations */}
      <div>
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-3 flex items-center gap-2">
          <Target className="w-3 h-3" />
          Strategic Recommendations
        </h3>
        <div className="space-y-2">
          {recommendations.map((rec, idx) => (
            <div
              key={`rec-${idx}-${rec.label}`}
              className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-3.5 hover:border-[var(--border-hover)] transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-md bg-[var(--bg-surface)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-foreground/70 text-[10px] font-black">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-foreground/80 mb-0.5">{rec.label}</div>
                  <div className="text-sm text-[var(--text-muted)] leading-relaxed">{rec.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps CTA */}
      <div className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            <span className="font-bold text-foreground">Next Steps:</span> Show correlated opportunities or dive deeper into any metric?
          </p>
          <button
            onClick={() => onFollowUp('correlated', card)}
            disabled={isTyping}
            className="group relative flex items-center justify-center gap-2 px-6 py-3 bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] disabled:bg-[var(--bg-elevated)] disabled:cursor-not-allowed text-foreground font-bold text-sm rounded-xl border border-[var(--border-hover)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] min-w-[120px] flex-shrink-0"
          >
            {isTyping ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="tracking-wide">YES</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>

        {/* Secondary Options */}
        <div className="mt-4 pt-4 border-t border-indigo-600/20">
          <p className="text-xs text-[var(--text-muted)] mb-3 font-semibold">Or choose a specific action:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onFollowUp('correlated', card)}
              disabled={isTyping}
              className="flex items-center gap-2 px-3.5 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] disabled:bg-[var(--bg-elevated)] disabled:cursor-not-allowed border border-[var(--border-subtle)] hover:border-blue-500/50 text-foreground/80 hover:text-white font-semibold text-xs rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Correlated Plays
            </button>
            <button
              onClick={() => onFollowUp('metrics', card)}
              disabled={isTyping}
              className="flex items-center gap-2 px-3.5 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] disabled:bg-[var(--bg-elevated)] disabled:cursor-not-allowed border border-[var(--border-subtle)] hover:border-purple-500/50 text-foreground/80 hover:text-white font-semibold text-xs rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <BarChart className="w-3.5 h-3.5" />
              Deep Metrics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
