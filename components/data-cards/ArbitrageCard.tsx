'use client';

import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface ArbitrageCardProps {
  data: {
    event: string;
    gameTime: string;
    profit: string;
    profitAmount: string;
    totalStake: string;
    bet1: {
      team: string;
      book: string;
      odds: string;
      stake: string;
      toWin: string;
    };
    bet2: {
      team: string;
      book: string;
      odds: string;
      stake: string;
      toWin: string;
    };
    confidence: string;
    efficiency: string;
    books: string;
  };
  gradient?: string;
}

export function ArbitrageCard({ data, gradient = 'from-green-600 to-emerald-700' }: ArbitrageCardProps) {
  const profitValue = parseFloat(data.profit);
  const confidenceColor = 
    data.confidence === 'HIGH' ? 'bg-green-500' :
    data.confidence === 'MEDIUM' ? 'bg-blue-500' :
    'bg-gray-500';

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-lg`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          <span className="font-semibold text-sm uppercase tracking-wide">Arbitrage Opportunity</span>
        </div>
        <div className={`${confidenceColor} px-2 py-1 rounded-full text-xs font-bold`}>
          {data.confidence}
        </div>
      </div>

      {/* Profit Display */}
      <div className="mb-4">
        <div className="text-3xl font-bold mb-1">{data.profit}</div>
        <div className="text-lg opacity-90">Guaranteed Profit: {data.profitAmount}</div>
        <div className="text-sm opacity-75">Total Stake: {data.totalStake}</div>
      </div>

      {/* Event Info */}
      <div className="mb-4 pb-4 border-b border-white/20">
        <div className="font-semibold mb-1">{data.event}</div>
        <div className="text-sm opacity-75">{data.gameTime}</div>
      </div>

      {/* Bet Instructions */}
      <div className="space-y-3 mb-4">
        {/* Bet 1 */}
        <div className="bg-white/10 rounded-lg p-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span className="font-semibold">{data.bet1.team}</span>
            </div>
            <span className="font-mono font-bold">{data.bet1.odds}</span>
          </div>
          <div className="text-sm space-y-1 pl-6">
            <div className="flex justify-between">
              <span className="opacity-75">Sportsbook:</span>
              <span className="font-semibold">{data.bet1.book}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">Stake:</span>
              <span className="font-semibold">{data.bet1.stake}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">To Win:</span>
              <span className="font-semibold text-green-300">{data.bet1.toWin}</span>
            </div>
          </div>
        </div>

        {/* Bet 2 */}
        <div className="bg-white/10 rounded-lg p-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span className="font-semibold">{data.bet2.team}</span>
            </div>
            <span className="font-mono font-bold">{data.bet2.odds}</span>
          </div>
          <div className="text-sm space-y-1 pl-6">
            <div className="flex justify-between">
              <span className="opacity-75">Sportsbook:</span>
              <span className="font-semibold">{data.bet2.book}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">Stake:</span>
              <span className="font-semibold">{data.bet2.stake}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">To Win:</span>
              <span className="font-semibold text-green-300">{data.bet2.toWin}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Market Info */}
      <div className="flex items-center gap-2 text-sm bg-white/10 rounded-lg p-2">
        <AlertCircle className="w-4 h-4" />
        <div className="flex-1">
          <div className="flex justify-between">
            <span className="opacity-75">Market Efficiency:</span>
            <span className="font-semibold">{data.efficiency}</span>
          </div>
          <div className="text-xs opacity-75 mt-1">Books: {data.books}</div>
        </div>
      </div>

      {/* Warning */}
      <div className="mt-4 text-xs opacity-75 text-center">
        Execute both bets quickly. Odds may change.
      </div>
    </div>
  );
}
