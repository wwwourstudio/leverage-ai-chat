'use client';

import { memo } from 'react';

export interface KalshiTileData {
  ticker: string;
  title: string;
  categoryChip: string;
  outcomes: Array<{
    label: string;
    yesPct: number;
    multiplier: number;
    isLeading: boolean;
    score?: string;
  }>;
  volume: string;
  marketCount: number;
  isLive: boolean;
  liveStatus?: string;
  eventTicker?: string;
  closeTimeIso?: string;
}

interface Props {
  market: KalshiTileData;
  onClick: () => void;
}

export const KalshiMarketTile = memo(function KalshiMarketTile({ market, onClick }: Props) {
  const { title, categoryChip, outcomes, volume, marketCount, isLive, liveStatus } = market;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#1a1c24] border border-[#2a2d3e] rounded-xl p-4 cursor-pointer hover:border-[#3d4060] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
    >
      {/* Top row: category chip + live badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {categoryChip}
        </span>
        {isLive && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE{liveStatus ? ` ${liveStatus}` : ''}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-white leading-snug mb-3 line-clamp-2">
        {title}
      </p>

      {/* Outcome rows */}
      <div className="space-y-2">
        {outcomes.slice(0, 4).map((outcome, i) => (
          <div key={i}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300 truncate mr-2 flex-1">{outcome.label}</span>
              {outcome.score !== undefined && (
                <span className="text-xs font-mono bg-[#2a2d3e] text-gray-200 rounded px-1.5 py-0.5 mr-2 flex-shrink-0">
                  {outcome.score}
                </span>
              )}
              <span className="flex-shrink-0 bg-[#0e9f6e] text-white text-xs font-bold px-3 py-1 rounded-full min-w-[46px] text-center">
                {outcome.yesPct}%
              </span>
            </div>
            {/* Probability bar */}
            <div className="mt-1 h-0.5 rounded-full overflow-hidden bg-gray-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  outcome.isLeading ? 'bg-[#0e9f6e]' : 'bg-gray-600'
                }`}
                style={{ width: `${Math.max(2, outcome.yesPct)}%` }}
              />
            </div>
            {/* Multiplier */}
            <p className="text-[10px] text-gray-600 mt-0.5">{outcome.multiplier.toFixed(2)}x</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-[#2a2d3e] flex items-center justify-between">
        <span className="text-[11px] text-gray-500">{volume} vol</span>
        <span className="text-[11px] text-gray-500">
          {marketCount > 1 ? `${marketCount} markets` : '1 market'}
        </span>
      </div>
    </button>
  );
});
