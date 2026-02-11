'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, DollarSign, Target, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface OddsData {
  bookmaker: string;
  spread: number;
  spreadOdds: number;
  moneyline: number;
}

interface BettingAnalysis {
  game: string;
  sport: string;
  expectedValue: number;
  confidence: number;
  recommendation: 'strong_bet' | 'value_bet' | 'pass' | 'fade';
  marketInefficiency: number;
  sharpMoney: 'heavy' | 'moderate' | 'none';
  bestOdds: OddsData;
  trustMetrics: {
    benfordScore: number;
    oddsAlignment: number;
    historicalAccuracy: number;
  };
}

export function BettingAnalysisPanel({ analysis }: { analysis: BettingAnalysis }) {
  const [expanded, setExpanded] = useState(false);

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'strong_bet': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'value_bet': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'pass': return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
      case 'fade': return 'text-red-400 bg-red-500/10 border-red-500/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  const getRecommendationLabel = (rec: string) => {
    switch (rec) {
      case 'strong_bet': return 'Strong Bet';
      case 'value_bet': return 'Value Opportunity';
      case 'pass': return 'Pass';
      case 'fade': return 'Fade (Bet Against)';
      default: return 'Unknown';
    }
  };

  const getSharpMoneyIndicator = (sharp: string) => {
    switch (sharp) {
      case 'heavy': return { label: 'Heavy Sharp Action', color: 'text-emerald-400', icon: TrendingUp };
      case 'moderate': return { label: 'Moderate Sharp Interest', color: 'text-blue-400', icon: TrendingUp };
      case 'none': return { label: 'No Sharp Movement', color: 'text-slate-400', icon: TrendingDown };
      default: return { label: 'Unknown', color: 'text-slate-400', icon: AlertCircle };
    }
  };

  const sharpIndicator = getSharpMoneyIndicator(analysis.sharpMoney);
  const SharpIcon = sharpIndicator.icon;

  return (
    <Card className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">{analysis.game}</h3>
          <p className="text-xs text-slate-400 uppercase tracking-wide">{analysis.sport}</p>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border font-semibold text-sm ${getRecommendationColor(analysis.recommendation)}`}>
          {getRecommendationLabel(analysis.recommendation)}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Expected Value */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Expected Value</span>
          </div>
          <p className={`text-2xl font-black ${analysis.expectedValue > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {analysis.expectedValue > 0 ? '+' : ''}{analysis.expectedValue.toFixed(1)}%
          </p>
        </div>

        {/* Confidence */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Confidence</span>
          </div>
          <p className="text-2xl font-black text-blue-400">
            {analysis.confidence.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Market Intelligence */}
      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <SharpIcon className={`w-4 h-4 ${sharpIndicator.color}`} />
            <span className="text-sm font-semibold text-white">{sharpIndicator.label}</span>
          </div>
          <div className="text-xs text-slate-300">
            Market Inefficiency: <span className="font-bold text-amber-400">{analysis.marketInefficiency.toFixed(1)}%</span>
          </div>
        </div>

        {/* Best Odds */}
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
          <p className="text-xs text-slate-400 mb-2">Best Available Odds</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{analysis.bestOdds.bookmaker}</span>
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-xs text-slate-400">Spread</p>
                <p className="text-sm font-bold text-white">{analysis.bestOdds.spread > 0 ? '+' : ''}{analysis.bestOdds.spread} ({analysis.bestOdds.spreadOdds > 0 ? '+' : ''}{analysis.bestOdds.spreadOdds})</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">ML</p>
                <p className="text-sm font-bold text-emerald-400">{analysis.bestOdds.moneyline > 0 ? '+' : ''}{analysis.bestOdds.moneyline}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Metrics */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">AI Trust Validation</span>
        </div>
        
        <div className="space-y-2">
          {/* Benford Score */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">Benford Integrity</span>
              <span className="font-semibold text-white">{(analysis.trustMetrics.benfordScore * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-700/30 rounded-full h-1.5">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${analysis.trustMetrics.benfordScore * 100}%` }}
              />
            </div>
          </div>

          {/* Odds Alignment */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">Odds Alignment</span>
              <span className="font-semibold text-white">{(analysis.trustMetrics.oddsAlignment * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-700/30 rounded-full h-1.5">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-400 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${analysis.trustMetrics.oddsAlignment * 100}%` }}
              />
            </div>
          </div>

          {/* Historical Accuracy */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">Historical Accuracy</span>
              <span className="font-semibold text-white">{(analysis.trustMetrics.historicalAccuracy * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-700/30 rounded-full h-1.5">
              <div 
                className="bg-gradient-to-r from-violet-500 to-violet-400 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${analysis.trustMetrics.historicalAccuracy * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Expand Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-4 w-full text-center text-xs text-slate-400 hover:text-white transition-colors py-2 border-t border-slate-700/30"
      >
        {expanded ? 'Show Less' : 'Show Detailed Analysis'}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-700/30 space-y-3">
          <div className="text-sm text-slate-300 leading-relaxed">
            <p className="font-semibold text-white mb-2">Analysis Summary:</p>
            <ul className="space-y-1 list-disc list-inside text-slate-400">
              {analysis.expectedValue > 5 && (
                <li>Strong positive expected value detected ({analysis.expectedValue.toFixed(1)}%)</li>
              )}
              {analysis.marketInefficiency > 3 && (
                <li>Significant market inefficiency identified ({analysis.marketInefficiency.toFixed(1)}%)</li>
              )}
              {analysis.sharpMoney !== 'none' && (
                <li>Sharp money movement detected - {sharpIndicator.label.toLowerCase()}</li>
              )}
              {analysis.trustMetrics.benfordScore > 0.85 && (
                <li>High statistical integrity (Benford score: {(analysis.trustMetrics.benfordScore * 100).toFixed(0)}%)</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

export function BettingAnalysisGrid({ analyses }: { analyses: BettingAnalysis[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {analyses.map((analysis, idx) => (
        <BettingAnalysisPanel key={idx} analysis={analysis} />
      ))}
    </div>
  );
}
