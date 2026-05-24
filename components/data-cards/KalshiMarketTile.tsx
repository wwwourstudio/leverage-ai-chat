'use client';

import { memo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KalshiTileOutcome {
  label: string;
  yesPct: number;
  multiplier: number;
  isLeading: boolean;
  score?: string;
  avatarUrl?: string;
}

export interface KalshiTileData {
  ticker: string;
  title: string;
  categoryChip: string;
  outcomes: KalshiTileOutcome[];
  volume: string;
  marketCount: number;
  isLive: boolean;
  liveStatus?: string;
  eventTicker?: string;
  closeTimeIso?: string;
  subcategoryLabel?: string;
  iconCode?: string;
  iconType?: 'city' | 'avatar' | 'flag' | 'team' | 'brand';
  dateLabel?: string;
}

// Per-outcome bar/badge colors — match Kalshi.com (green, orange, blue, purple)
const OUTCOME_COLORS = [
  { bar: '#16a34a', badge: '#16a34a' },  // green
  { bar: '#ea580c', badge: '#1e3a4a' },  // orange bar, dark teal badge
  { bar: '#3b82f6', badge: '#1e3040' },  // blue
  { bar: '#a855f7', badge: '#2a1e40' },  // purple
];

// ── Icon Components ───────────────────────────────────────────────────────────

function CityIcon({ code }: { code: string }) {
  return (
    <div className="w-9 h-9 rounded-lg bg-orange-500 flex flex-col items-center justify-center flex-shrink-0 gap-0">
      <span className="text-white text-[9px] font-black uppercase tracking-tight leading-none">
        {code.slice(0, 3)}
      </span>
      <span className="text-white text-[11px] leading-none mt-0.5">☀️</span>
    </div>
  );
}

function SportIcon({ code }: { code: string }) {
  const upper = code.toUpperCase();
  const emoji =
    upper === 'MLB' || upper === 'BASEBALL' ? '⚾' :
    upper === 'NBA' || upper === 'BASKETBALL' ? '🏀' :
    upper === 'NFL' || upper === 'FOOTBALL' ? '🏈' :
    upper === 'NHL' || upper === 'HOCKEY' ? '🏒' :
    upper === 'GOLF' || upper === 'PGA' ? '⛳' :
    upper === 'SOCCER' ? '⚽' :
    upper === 'TENNIS' ? '🎾' :
    upper === 'MMA' || upper === 'UFC' ? '🥊' : '🏆';
  const bg =
    upper === 'MLB' || upper === 'BASEBALL' ? 'bg-red-700' :
    upper === 'NBA' || upper === 'BASKETBALL' ? 'bg-orange-600' :
    upper === 'NFL' || upper === 'FOOTBALL' ? 'bg-green-700' :
    upper === 'NHL' || upper === 'HOCKEY' ? 'bg-blue-700' :
    upper === 'GOLF' || upper === 'PGA' ? 'bg-emerald-700' : 'bg-violet-700';
  return (
    <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
      <span className="text-base leading-none">{emoji}</span>
    </div>
  );
}

function AvatarIcon({ url, label, size = 7 }: { url?: string; label: string; size?: number }) {
  const initials = label.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  const sizeClass = size === 7 ? 'w-7 h-7' : 'w-9 h-9';
  const textSize = size === 7 ? 'text-[9px]' : 'text-[11px]';
  if (url) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden bg-[#2a2d3e] flex-shrink-0 border border-[#3d4060]`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0`}>
      <span className={`${textSize} font-bold text-white`}>{initials}</span>
    </div>
  );
}

function CardIcon({ market }: { market: KalshiTileData }) {
  const { iconType, iconCode, categoryChip, subcategoryLabel } = market;
  if (iconType === 'city' && iconCode) return <CityIcon code={iconCode} />;
  if (iconType === 'team') {
    const code = iconCode || subcategoryLabel || categoryChip || '';
    return <SportIcon code={code} />;
  }
  if (iconType === 'avatar' || iconType === 'flag') {
    return <AvatarIcon label={categoryChip} />;
  }
  return null;
}

// ── Main Tile ─────────────────────────────────────────────────────────────────

interface Props {
  market: KalshiTileData;
  onClick: () => void;
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
    dateLabel,
    iconType,
  } = market;

  const hasIcon = !!market.iconType;
  const showAvatarsInOutcomes = iconType === 'avatar' || iconType === 'flag';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#141620] border border-[#2a2d3e] rounded-2xl p-4 cursor-pointer hover:border-[#3d4060] hover:bg-[#1a1c28] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-teal-500/20 group"
    >
      {/* ── Header row ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {hasIcon && <CardIcon market={market} />}
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 truncate">
            {categoryChip}
          </span>
        </div>
        {subcategoryLabel && (
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex-shrink-0 ml-2">
            {subcategoryLabel}
          </span>
        )}
      </div>

      {/* ── Title ── */}
      <p className="text-sm font-bold text-white leading-snug mb-1.5 line-clamp-2 group-hover:text-gray-100">
        {title}
      </p>

      {/* ── Live / Date label ── */}
      {(isLive || dateLabel) && (
        <div className="flex items-center gap-1.5 mb-2.5">
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
          {liveStatus && (
            <span className="text-[10px] text-gray-500 font-medium">{liveStatus}</span>
          )}
          {dateLabel && !isLive && (
            <span className="text-[10px] text-gray-600">{dateLabel}</span>
          )}
        </div>
      )}

      {/* ── Outcome rows ── */}
      <div className="space-y-2 mt-2.5">
        {outcomes.slice(0, 4).map((outcome, i) => {
          const color = OUTCOME_COLORS[i] ?? OUTCOME_COLORS[0];
          const badgeBg = outcome.isLeading ? '#0e9f6e' : '#1a1c24';
          const badgeText = outcome.isLeading ? '#ffffff' : '#6b7280';
          const badgeBorder = outcome.isLeading ? 'transparent' : '#2a2d3e';

          return (
            <div key={i}>
              {/* Outcome row: avatar? | label | score? | multiplier | badge */}
              <div className="flex items-center gap-2">
                {showAvatarsInOutcomes && (
                  <AvatarIcon url={outcome.avatarUrl} label={outcome.label} size={7} />
                )}
                <span className="text-sm text-gray-200 truncate flex-1 min-w-0 font-medium">
                  {outcome.label}
                </span>
                {outcome.score !== undefined && (
                  <span className="text-xs font-mono bg-[#2a2d3e] border border-[#3d4060] text-gray-100 rounded px-1.5 py-0.5 flex-shrink-0 tabular-nums">
                    {outcome.score}
                  </span>
                )}
                {/* Multiplier — left of badge, Kalshi.com style */}
                <span className="text-[11px] text-gray-500 flex-shrink-0 tabular-nums font-medium">
                  {outcome.multiplier.toFixed(2)}x
                </span>
                {/* Probability badge */}
                <span
                  className="flex-shrink-0 text-sm font-bold px-3 py-0.5 rounded-full min-w-[52px] text-center border transition-colors"
                  style={{
                    backgroundColor: badgeBg,
                    color: outcome.isLeading ? '#ffffff' : badgeText,
                    borderColor: badgeBorder,
                  }}
                >
                  {outcome.yesPct}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-1 h-px rounded-full overflow-hidden bg-[#2a2d3e]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(1, outcome.yesPct)}%`,
                    backgroundColor: color.bar,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div className="mt-3 pt-2.5 border-t border-[#2a2d3e] flex items-center justify-between">
        <span className="text-[11px] text-gray-500 tabular-nums font-medium">{volume} vol</span>
        <span className="text-[11px] text-gray-500">
          {marketCount > 1 ? `${marketCount} markets` : '1 market'}
        </span>
      </div>
    </button>
  );
});
