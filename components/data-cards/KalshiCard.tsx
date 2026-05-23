'use client';

import { memo, useState, useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { KalshiMarketTile, type KalshiTileData } from './KalshiMarketTile';
import { KalshiDetailModal, type KalshiDetailData } from './KalshiDetailModal';

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
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function deriveChip(d: Record<string, any>): string {
  const s = d.seriesTicker || d.categoryChip || d.subcategory || d.iconLabel || d.category || '';
  if (!s || s === 'Prediction Market' || s === 'KALSHI') {
    const cat = (d.category || d.subcategory || 'KALSHI');
    return cat.toUpperCase().slice(0, 12);
  }
  return s.toUpperCase().slice(0, 12);
}

/**
 * Normalize old single-market card data shape (from kalshiMarketToCard) → KalshiTileData.
 */
function normalizeSingleMarket(d: Record<string, any>): KalshiTileData {
  const yesPct = Math.round(d.yesPct ?? d.yesPrice ?? 50);
  const noPct = Math.round(d.noPct ?? d.noPrice ?? (100 - yesPct));
  const vol = typeof d.volume === 'string' && d.volume !== '—'
    ? d.volume
    : fmtVol(d.volumeRaw ?? d.volume);
  return {
    ticker: d.ticker ?? '',
    title: d.subtitle ?? d.title ?? 'Market',
    categoryChip: deriveChip(d),
    outcomes: [
      {
        label: 'Yes',
        yesPct,
        multiplier: yesPct > 0 ? parseFloat((100 / yesPct).toFixed(2)) : 2,
        isLeading: yesPct >= 50,
      },
      {
        label: 'No',
        yesPct: noPct,
        multiplier: noPct > 0 ? parseFloat((100 / noPct).toFixed(2)) : 2,
        isLeading: noPct > yesPct,
      },
    ],
    volume: vol,
    marketCount: 1,
    isLive: d.status === 'active' || d.expiryUrgency === 'critical',
    liveStatus: d.expiresLabel,
    eventTicker: d.eventTicker,
    closeTimeIso: d.closeTimeIso,
  };
}

function enrichForDetail(tile: KalshiTileData, rawData?: Record<string, any>): KalshiDetailData {
  return {
    ...tile,
    outcomes: tile.outcomes.map(o => ({
      ...o,
      yesPrice: o.yesPct,
      noPrice: 100 - o.yesPct,
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
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">KALSHI</p>
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

  // Legacy unavailable/no-markets placeholder cards
  if (data?.status === 'API_UNAVAILABLE' || data?.status === 'NO_MARKETS') {
    return <KalshiUnavailableCard title={title} />;
  }

  // Resolve tile array: new grouped shape OR old single-market shape
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

  return (
    <>
      <article className="bg-[#141620] border border-[#2a2d3e] rounded-2xl overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2d3e]">
          <div>
            <span className="block text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-0.5">
              Kalshi · Prediction Markets
            </span>
            <h3 className="text-white font-bold text-sm leading-tight">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {subcategory && (
              <span className="text-[11px] text-teal-400 font-medium bg-teal-400/10 px-2 py-0.5 rounded-full">
                {subcategory}
              </span>
            )}
            <a
              href={seriesHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-300 transition-colors"
              onClick={e => e.stopPropagation()}
              title="Open on Kalshi"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* 2-column tile grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
          {tiles.map((tile, i) => (
            <KalshiMarketTile
              key={tile.ticker || i}
              market={tile}
              onClick={() => setSelectedMarket(enrichForDetail(tile, data))}
            />
          ))}
        </div>

        {/* AI footer */}
        {onAsk && (
          <div className="px-4 pb-3 pt-0">
            <button
              onClick={() => onAsk(
                `Analyze these ${subcategory || 'Kalshi'} prediction markets and identify the best trading edge`
              )}
              className="w-full text-xs text-teal-400 hover:text-teal-300 py-2 border border-teal-400/20 hover:border-teal-400/40 rounded-xl transition-colors"
            >
              Ask AI to analyze these markets →
            </button>
          </div>
        )}
      </article>

      {/* Detail modal — portal-level overlay */}
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
