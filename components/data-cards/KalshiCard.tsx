'use client';

import { memo, useState, useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { KalshiMarketTile, type KalshiTileData, type KalshiTileOutcome } from './KalshiMarketTile';
import { KalshiDetailModal, type KalshiDetailData } from './KalshiDetailModal';

// ── Category config ───────────────────────────────────────────────────────────

interface CategoryConfig {
  emoji: string;
  label: string;
  accent: string;        // Tailwind text color
  accentBg: string;      // Tailwind bg color
  borderColor: string;   // Tailwind border color
  aiPrompt: string;
  context: string;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  politics: {
    emoji: '🗳️',
    label: 'Politics & Elections',
    accent: 'text-blue-400',
    accentBg: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    aiPrompt: 'Analyze these political prediction markets. Which outcomes are mispriced vs. polling data and fundamentals?',
    context: 'Based on polling aggregates, historical election data, and market sentiment.',
  },
  weather: {
    emoji: '🌦️',
    label: 'Weather & Climate',
    accent: 'text-cyan-400',
    accentBg: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    aiPrompt: 'Analyze these weather prediction markets. Where do forecasting models diverge from market pricing?',
    context: 'Calibrated against NOAA and European weather model ensembles.',
  },
  climate: {
    emoji: '🌡️',
    label: 'Climate Markets',
    accent: 'text-cyan-400',
    accentBg: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    aiPrompt: 'Analyze these climate prediction markets and find pricing inefficiencies vs. meteorological data.',
    context: 'Climate and environmental event probability markets.',
  },
  culture: {
    emoji: '🎬',
    label: 'Culture & Entertainment',
    accent: 'text-pink-400',
    accentBg: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    aiPrompt: 'Analyze these entertainment prediction markets. Which awards or pop culture outcomes are mispriced?',
    context: 'Awards season, box office, streaming, and pop culture event markets.',
  },
  entertainment: {
    emoji: '🎭',
    label: 'Entertainment',
    accent: 'text-pink-400',
    accentBg: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    aiPrompt: 'Analyze these entertainment prediction markets for pricing edges.',
    context: 'Movies, TV, music, and entertainment event prediction markets.',
  },
  sports: {
    emoji: '🏆',
    label: 'Sports Markets',
    accent: 'text-orange-400',
    accentBg: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    aiPrompt: 'Analyze these sports prediction markets. Which outcomes have the best edge vs. current sportsbook lines?',
    context: 'Championship, season award, and milestone markets across major leagues.',
  },
  crypto: {
    emoji: '₿',
    label: 'Crypto & Finance',
    accent: 'text-yellow-400',
    accentBg: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    aiPrompt: 'Analyze these crypto and financial prediction markets. Where is market pricing diverging from on-chain data or macro signals?',
    context: 'Cryptocurrency price, Fed rate, and macro economic event markets.',
  },
  financials: {
    emoji: '📈',
    label: 'Finance & Economics',
    accent: 'text-green-400',
    accentBg: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    aiPrompt: 'Analyze these financial prediction markets for pricing edges vs. futures and Fed guidance.',
    context: 'Interest rates, inflation, economic indicator, and financial event markets.',
  },
  trending: {
    emoji: '🔥',
    label: 'Trending Markets',
    accent: 'text-red-400',
    accentBg: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    aiPrompt: 'Analyze these trending prediction markets for momentum plays and contrarian opportunities.',
    context: 'Highest volume markets across all categories right now.',
  },
};

function getCategoryConfig(subcategory?: string): CategoryConfig | null {
  if (!subcategory) return null;
  const key = subcategory.toLowerCase().trim();

  // Direct match first
  if (CATEGORY_CONFIG[key]) return CATEGORY_CONFIG[key];

  // Fuzzy-match common Kalshi API category values → user-facing categories
  if (['election', 'electoral', 'presidential', 'congress', 'senate', 'vote', 'democrat', 'republican', 'governor'].some(k => key.includes(k))) {
    return CATEGORY_CONFIG.politics;
  }
  if (['nfl', 'nba', 'mlb', 'nhl', 'nfl', 'soccer', 'tennis', 'golf', 'mma', 'ufc', 'ncaa', 'championship', 'playoff', 'super bowl'].some(k => key.includes(k))) {
    return CATEGORY_CONFIG.sports;
  }
  if (['weather', 'temp', 'hurricane', 'tornado', 'snow', 'rain', 'flood', 'storm', 'precipitation'].some(k => key.includes(k))) {
    return CATEGORY_CONFIG.weather;
  }
  if (['oscar', 'grammy', 'emmy', 'award', 'box office', 'movie', 'film', 'music', 'celebrity', 'culture', 'entertainment', 'tv', 'showtime'].some(k => key.includes(k))) {
    return CATEGORY_CONFIG.culture;
  }
  if (['bitcoin', 'crypto', 'eth', 'sol', 'doge', 'blockchain', 'defi', 'nft', 'coin'].some(k => key.includes(k))) {
    return CATEGORY_CONFIG.crypto;
  }
  if (['fed', 'rate', 'inflation', 'gdp', 'stock', 'nasdaq', 'sp500', 'bond', 'treasury', 'finance', 'econom', 'company', 'compan'].some(k => key.includes(k))) {
    return CATEGORY_CONFIG.financials;
  }

  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface KalshiCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, any>;
  status?: string;
  onAnalyze?: () => void;
  onAsk?: (query: string) => void;
  isLoading?: boolean;
  error?: string;
  isHero?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtVol(raw: number | string | undefined): string {
  const n = typeof raw === 'string' ? parseFloat(raw.replace(/[MK$,]/g, '')) : (raw ?? 0);
  if (!n || isNaN(n)) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${n}`;
}

function deriveChip(d: Record<string, any>): string {
  const s = d.seriesTicker || d.categoryChip || d.subcategory || d.category || '';
  if (!s || s === 'Prediction Market' || s === 'KALSHI') {
    return (d.category || d.subcategory || 'KALSHI').toUpperCase().slice(0, 14);
  }
  return s.toUpperCase().slice(0, 14);
}

/** Normalize old single-market card data shape → KalshiTileData (backward compat). */
function normalizeSingleMarket(d: Record<string, any>): KalshiTileData {
  const yesPct = Math.round(d.yesPct ?? d.yesPrice ?? 50);
  const noPct  = Math.round(d.noPct  ?? d.noPrice  ?? (100 - yesPct));
  const vol = typeof d.volume === 'string' && d.volume !== '—'
    ? d.volume
    : fmtVol(d.volumeRaw ?? d.volume);

  // Smart label extraction from old card shape
  const sub: string = d.subtitle || '';
  const yesLabel = sub.startsWith('Yes: ') ? sub.slice(5).trim() : 'Yes';

  const outcomes: KalshiTileOutcome[] = [
    {
      label: yesLabel,
      yesPct,
      multiplier: yesPct > 0 ? parseFloat((100 / yesPct).toFixed(2)) : 2,
      isLeading: yesPct >= noPct,
    },
    {
      label: 'No',
      yesPct: noPct,
      multiplier: noPct > 0 ? parseFloat((100 / noPct).toFixed(2)) : 2,
      isLeading: noPct > yesPct,
    },
  ];

  return {
    ticker: d.ticker ?? '',
    title: d.subtitle ?? d.title ?? 'Market',
    categoryChip: deriveChip(d),
    outcomes,
    volume: vol,
    marketCount: 1,
    isLive: d.status === 'active' || d.expiryUrgency === 'critical',
    liveStatus: d.expiresLabel,
    eventTicker: d.eventTicker,
    closeTimeIso: d.closeTimeIso,
    subcategoryLabel: d.subcategoryLabel,
    iconCode: d.iconCode,
    iconType: d.iconType,
  };
}

function enrichForDetail(tile: KalshiTileData, rawData?: Record<string, any>): KalshiDetailData {
  return {
    ...tile,
    outcomes: tile.outcomes.map(o => ({
      ...o,
      yesPrice: o.yesPct,
      noPrice: Math.max(1, 100 - o.yesPct),
      priceHistory: [],
    })),
    eventTicker: tile.eventTicker ?? rawData?.eventTicker,
    closeTimeIso: tile.closeTimeIso ?? rawData?.closeTimeIso,
    subtitle: rawData?.subtitle,
  };
}

// ── Unavailable fallback ──────────────────────────────────────────────────────

function KalshiUnavailableCard({ title }: { title: string }) {
  return (
    <div className="bg-[#141620] border border-[#2a2d3e] rounded-2xl p-6 text-center">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-bold">KALSHI</p>
      <p className="text-white font-semibold mb-1">{title}</p>
      <p className="text-sm text-gray-500 mb-4">
        Prediction market data is temporarily unavailable.
      </p>
      <a
        href="https://kalshi.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300"
      >
        Open Kalshi <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export const KalshiCard = memo(function KalshiCard({
  title,
  subcategory,
  data,
  onAsk,
}: KalshiCardProps) {
  const [selectedMarket, setSelectedMarket] = useState<KalshiDetailData | null>(null);

  if (data?.status === 'API_UNAVAILABLE' || data?.status === 'NO_MARKETS') {
    return <KalshiUnavailableCard title={title} />;
  }

  const tiles = useMemo<KalshiTileData[]>(() => {
    if (Array.isArray(data?.markets) && data.markets.length > 0) {
      return data.markets as KalshiTileData[];
    }
    if (data?.ticker || data?.yesPct !== undefined) {
      return [normalizeSingleMarket(data)];
    }
    return [];
  }, [data]);

  if (tiles.length === 0) {
    return <KalshiUnavailableCard title={title} />;
  }

  const seriesHref = data?.seriesTicker
    ? `https://kalshi.com/markets/${(data.seriesTicker as string).toLowerCase()}`
    : 'https://kalshi.com';

  const catCfg = getCategoryConfig(subcategory);

  return (
    <>
      <article className="bg-[#0d0f18] border border-[#2a2d3e] rounded-2xl overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2d3e]">
          <div>
            <span className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">
              Kalshi · Prediction Markets
            </span>
            <h3 className="text-white font-bold text-sm leading-tight">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {catCfg ? (
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${catCfg.accent} ${catCfg.accentBg}`}>
                {catCfg.emoji} {catCfg.label}
              </span>
            ) : subcategory ? (
              <span className="text-[11px] text-teal-400 font-semibold bg-teal-400/10 px-2.5 py-1 rounded-full">
                {subcategory}
              </span>
            ) : null}
            <a
              href={seriesHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded hover:bg-[#1a1c24]"
              onClick={e => e.stopPropagation()}
              title="Open on Kalshi"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Category context banner */}
        {catCfg && (
          <div className={`px-4 py-2.5 border-b ${catCfg.borderColor} ${catCfg.accentBg} flex items-center gap-2`}>
            <span className="text-base leading-none">{catCfg.emoji}</span>
            <p className={`text-[11px] ${catCfg.accent} leading-snug`}>
              {catCfg.context}
            </p>
          </div>
        )}

        {/* 2-column tile grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
          {tiles.map((tile, i) => (
            <KalshiMarketTile
              key={tile.ticker || i}
              market={tile}
              onClick={() => setSelectedMarket(enrichForDetail(tile, data))}
            />
          ))}
        </div>

        {/* AI analysis footer */}
        {onAsk && (
          <div className="px-3 pb-3 pt-0">
            <button
              onClick={() => onAsk(catCfg?.aiPrompt ?? `Analyze these ${subcategory || 'Kalshi'} prediction markets and identify the best trading edge`)}
              className={`w-full text-xs py-2 border rounded-xl transition-colors ${
                catCfg
                  ? `${catCfg.accent} hover:opacity-80 ${catCfg.borderColor} hover:${catCfg.accentBg}`
                  : 'text-teal-400 hover:text-teal-300 border-teal-400/20 hover:border-teal-400/40'
              }`}
            >
              {catCfg ? `Ask AI about ${catCfg.label} →` : 'Ask AI to analyze these markets →'}
            </button>
          </div>
        )}
      </article>

      {selectedMarket && (
        <KalshiDetailModal
          market={selectedMarket}
          onClose={() => setSelectedMarket(null)}
        />
      )}
    </>
  );
});

export default KalshiCard;
