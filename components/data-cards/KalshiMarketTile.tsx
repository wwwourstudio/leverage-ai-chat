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
    avatarUrl?: string;
  }>;
  volume: string;
  marketCount: number;
  isLive: boolean;
  liveStatus?: string;
  eventTicker?: string;
  closeTimeIso?: string;
  subcategoryLabel?: string;
  iconCode?: string;
  iconType?: 'city' | 'avatar' | 'flag' | 'team';
}

interface Props {
  market: KalshiTileData;
  onClick: () => void;
}

// Climate/weather city abbreviation box
function CityIcon({ code }: { code: string }) {
  return (
    <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
      <span className="text-[9px] font-black text-white uppercase tracking-tight leading-none text-center">
        {code.slice(0, 3)}
      </span>
    </div>
  );
}

// Round avatar for elections/culture
function AvatarIcon({ url, label }: { url?: string; label: string }) {
  if (url) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden bg-[#2a2d3e] flex-shrink-0 border border-[#3d4060]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }
  const initials = label.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-600 to-cyan-700 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-bold text-white">{initials}</span>
    </div>
  );
}

export const KalshiMarketTile = memo(function KalshiMarketTile({ market, onClick }: Props) {
  const {
    title,
    categoryChip,
    outcomes,
    volume,
    marketCount,
    isLive,
    liveStatus,
    subcategoryLabel,
    iconCode,
    iconType,
  } = market;

  const showIcon = !!iconCode && (iconType === 'city' || iconType === 'avatar' || iconType === 'flag');

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#1a1c24] border border-[#2a2d3e] rounded-xl p-4 cursor-pointer hover:border-[#3d4060] hover:bg-[#1e2030] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 group"
    >
      {/* Top row: category chip + right label + live badge */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {showIcon && iconType === 'city' && <CityIcon code={iconCode!} />}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 truncate">
            {categoryChip}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {subcategoryLabel && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-600">
              {subcategoryLabel}
            </span>
          )}
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE{liveStatus ? ` ${liveStatus}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-white leading-snug mb-3 line-clamp-2 group-hover:text-gray-100">
        {title}
      </p>

      {/* Outcome rows */}
      <div className="space-y-2.5">
        {outcomes.slice(0, 4).map((outcome, i) => (
          <div key={i}>
            <div className="flex items-center justify-between gap-2">
              {/* Avatar or flag icon per-outcome (elections/culture) */}
              {(iconType === 'avatar' || iconType === 'flag') && (
                <AvatarIcon url={outcome.avatarUrl} label={outcome.label} />
              )}
              <span className="text-sm text-gray-300 truncate flex-1 min-w-0">{outcome.label}</span>
              {/* Sports live score box */}
              {outcome.score !== undefined && (
                <span className="text-xs font-mono bg-[#2a2d3e] border border-[#3d4060] text-gray-200 rounded-md px-2 py-0.5 flex-shrink-0 tabular-nums">
                  {outcome.score}
                </span>
              )}
              {/* Probability badge */}
              <span
                className={`flex-shrink-0 text-white text-xs font-bold px-3 py-1 rounded-full min-w-[46px] text-center transition-colors ${
                  outcome.isLeading
                    ? 'bg-[#0e9f6e]'
                    : 'bg-[#1e3a4a] text-[#4db8a4]'
                }`}
              >
                {outcome.yesPct}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-1.5 h-0.5 rounded-full overflow-hidden bg-[#2a2d3e]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(2, outcome.yesPct)}%`,
                  background: outcome.isLeading ? '#0e9f6e' : '#3d4060',
                }}
              />
            </div>
            <p className="text-[10px] text-gray-600 mt-0.5 tabular-nums">{outcome.multiplier.toFixed(2)}x</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-[#2a2d3e] flex items-center justify-between">
        <span className="text-[11px] text-gray-500 tabular-nums">{volume} vol</span>
        <span className="text-[11px] text-gray-500">
          {marketCount > 1 ? `${marketCount} markets` : '1 market'}
        </span>
      </div>
    </button>
  );
});
