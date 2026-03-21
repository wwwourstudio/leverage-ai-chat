'use client';

/**
 * KalshiTab — lazy-loaded Kalshi prediction markets browser.
 *
 * Features:
 *  - Category pills (All · Elections · Sports · Finance · Weather · Trending)
 *  - Search box with debounce
 *  - Loading skeleton while fetching
 *  - Graceful error + retry state
 *  - "Demo mode" banner when KALSHI_ENV=demo (surfaced via /api/kalshi/markets configured flag)
 *  - "Trade on Kalshi" deep-link button on each market card
 *  - Auto-refreshes every 60 s (matches server cache TTL)
 */

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { TrendingUp, RefreshCw, ExternalLink, Search, AlertCircle, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KalshiMarket {
  ticker:      string;
  title:       string;
  category:    string;
  yesPrice:    number; // cents 0–99
  noPrice:     number;
  yesBid:      number;
  yesAsk:      number;
  volume24h:   number;
  volume:      number;
  openInterest: number;
  closeTime:   string;
  priceChange: number;
  status:      string;
  eventTicker: string;
}

interface MarketsResponse {
  success:    boolean;
  markets:    KalshiMarket[];
  count:      number;
  timestamp:  string;
  configured: boolean;
  error?:     string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function timeLeft(closeTime: string): string {
  if (!closeTime) return '—';
  const diff = new Date(closeTime).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  if (d > 0)  return `${d}d ${h}h left`;
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0)  return `${h}h ${m}m left`;
  return `${m}m left`;
}

function kalshiUrl(market: KalshiMarket): string {
  const event  = market.eventTicker || market.ticker;
  return `https://kalshi.com/markets/${event}/${market.ticker}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MarketSkeleton() {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-800/40 p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-2 flex-1 mr-3">
          <div className="h-3 w-16 bg-slate-700/60 rounded" />
          <div className="h-4 w-3/4 bg-slate-700/60 rounded" />
        </div>
        <div className="h-8 w-12 bg-slate-700/60 rounded-lg" />
      </div>
      <div className="flex gap-2 mt-4">
        <div className="h-9 flex-1 bg-slate-700/40 rounded-lg" />
        <div className="h-9 flex-1 bg-slate-700/40 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Single Market Card ────────────────────────────────────────────────────────

const MarketCard = memo(function MarketCard({ market, onAnalyze }: {
  market:    KalshiMarket;
  onAnalyze: (title: string) => void;
}) {
  const yesProb   = market.yesPrice;          // already in cents = % implied prob
  const noProb    = 100 - yesProb;
  const isUp      = market.priceChange > 0;
  const isDown    = market.priceChange < 0;
  const vol       = fmtVol(market.volume24h || market.volume);
  const left      = timeLeft(market.closeTime);

  // Urgency color for time remaining
  const leftColor = left.includes('m left') ? 'text-rose-400' :
                    left.includes('h left') ? 'text-amber-400' :
                    'text-slate-400';

  const catColor: Record<string, string> = {
    Politics:    'text-blue-400  bg-blue-500/10  border-blue-500/20',
    Sports:      'text-green-400 bg-green-500/10 border-green-500/20',
    Finance:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Crypto:      'text-violet-400 bg-violet-500/10 border-violet-500/20',
    Weather:     'text-cyan-400  bg-cyan-500/10  border-cyan-500/20',
    Entertainment: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  };
  const catCls = catColor[market.category] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';

  return (
    <div className="group rounded-2xl border border-white/5 bg-gradient-to-br from-slate-800/60 to-slate-900/40 hover:border-white/10 transition-all duration-200 overflow-hidden shadow-md hover:shadow-lg">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${catCls} flex-shrink-0`}>
            {market.category}
          </span>
          <span className={`text-[10px] font-mono ${leftColor} flex-shrink-0`}>{left}</span>
        </div>
        <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{market.title}</p>
      </div>

      {/* Probability bar */}
      <div className="px-4 pb-3">
        <div className="relative h-1.5 w-full rounded-full bg-slate-700/60 overflow-hidden mt-2">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${yesProb}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] mt-1">
          <span className="text-emerald-400 font-bold">YES {yesProb}¢</span>
          <span className="text-rose-400 font-bold">NO {noProb}¢</span>
        </div>
      </div>

      {/* Price change + volume */}
      <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-slate-500">
        {market.priceChange !== 0 ? (
          <span className={isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-slate-500'}>
            {isUp ? '▲' : '▼'} {Math.abs(market.priceChange)}¢
          </span>
        ) : <span />}
        <span>Vol {vol}</span>
      </div>

      {/* Actions */}
      <div className="border-t border-white/5 grid grid-cols-2 divide-x divide-white/5">
        <button
          onClick={() => onAnalyze(`Show me analysis and edge on this Kalshi market: "${market.title}" (YES: ${yesProb}¢, NO: ${noProb}¢, Ticker: ${market.ticker})`)}
          className="py-2.5 text-[10px] font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          Analyze Edge →
        </button>
        <a
          href={kalshiUrl(market)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 py-2.5 text-[10px] font-semibold text-purple-400 hover:text-purple-300 hover:bg-purple-500/5 transition-colors"
        >
          Trade on Kalshi
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
});

// ─── Category Pills ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',      label: 'All Markets' },
  { id: 'election', label: 'Elections' },
  { id: 'sports',   label: 'Sports' },
  { id: 'finance',  label: 'Finance' },
  { id: 'weather',  label: 'Weather' },
  { id: 'trending', label: 'Trending' },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

// ─── Main Tab Component ────────────────────────────────────────────────────────

interface KalshiTabProps {
  /** Called when user clicks "Analyze Edge" — sends message to the chat */
  onChatMessage?: (text: string) => void;
}

export function KalshiTab({ onChatMessage }: KalshiTabProps) {
  const [category, setCategory]   = useState<CategoryId>('all');
  const [search,   setSearch]     = useState('');
  const [markets,  setMarkets]    = useState<KalshiMarket[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [configured, setConfigured] = useState(false);

  // Debounce search input
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ category, limit: '24' });
      if (debouncedSearch) qs.set('search', debouncedSearch);
      const res  = await fetch(`/api/kalshi/markets?${qs}`);
      const data: MarketsResponse = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load markets');
      setMarkets(data.markets ?? []);
      setConfigured(data.configured ?? false);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Kalshi markets');
    } finally {
      setLoading(false);
    }
  }, [category, debouncedSearch]);

  // Fetch on mount and when category/search changes
  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  // Auto-refresh every 60 s (matches server cache TTL)
  useEffect(() => {
    const id = setInterval(fetchMarkets, 60_000);
    return () => clearInterval(id);
  }, [fetchMarkets]);

  const handleAnalyze = useCallback((msg: string) => {
    onChatMessage?.(msg);
  }, [onChatMessage]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Kalshi Prediction Markets</p>
              {lastFetch && (
                <p className="text-[9px] text-slate-600">
                  Updated {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={fetchMarkets}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
            title="Refresh markets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search markets…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-800/60 border border-white/5 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20"
          />
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                category === cat.id
                  ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                  : 'bg-slate-800/60 text-slate-500 border border-white/5 hover:text-slate-300 hover:border-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-3">
        {/* Demo mode notice */}
        {!configured && !loading && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400/80 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Public mode — no API credentials</p>
              <p className="text-[10px] mt-0.5 text-amber-400/60">
                Add KALSHI_ACCESS_KEY + KALSHI_PRIVATE_KEY to Vercel env for authenticated features (portfolio, trading).
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 p-4 text-center">
            <AlertCircle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
            <p className="text-xs text-rose-300 font-semibold">Failed to load markets</p>
            <p className="text-[10px] text-rose-400/70 mt-1 mb-3">{error}</p>
            <button
              onClick={fetchMarkets}
              className="text-[10px] font-bold text-rose-300 border border-rose-500/30 rounded-lg px-3 py-1.5 hover:bg-rose-500/10 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          Array.from({ length: 6 }).map((_, i) => <MarketSkeleton key={i} />)
        )}

        {/* Markets grid */}
        {!loading && !error && markets.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No markets found</p>
            <p className="text-xs mt-1">
              {debouncedSearch ? `No results for "${debouncedSearch}"` : `No ${category} markets available`}
            </p>
          </div>
        )}

        {!loading && !error && markets.map(m => (
          <MarketCard key={m.ticker} market={m} onAnalyze={handleAnalyze} />
        ))}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-white/5 px-4 py-2 flex items-center justify-between">
        <span className="text-[9px] text-slate-600">
          {markets.length > 0 ? `${markets.length} markets · 60s cache` : 'Kalshi Prediction Markets'}
        </span>
        <a
          href="https://kalshi.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[9px] text-purple-500/60 hover:text-purple-400 transition-colors"
        >
          kalshi.com <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}
