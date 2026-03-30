'use client';

export interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle?: string;
  yesPrice: number;
  noPrice: number;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  spread: number;
  volume24h: number;
  volume: number;
  openInterest: number;
  closeTime: string;
  status: string;
  priceIsReal: boolean;
  category?: string;
}

interface KalshiMarketCardProps {
  market: KalshiMarket;
  onAsk?: (query: string) => void;
}

function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function KalshiMarketCard({ market, onAsk }: KalshiMarketCardProps) {
  const yesDisplay = market.priceIsReal ? `${market.yesPrice}¢` : '—';
  const noDisplay = market.priceIsReal ? `${market.noPrice}¢` : '—';
  const yesPct = market.priceIsReal ? market.yesPrice : null;

  return (
    <div className="bg-[oklch(0.11_0.01_280)] border border-[oklch(0.18_0.02_280)] rounded-xl p-4 flex flex-col gap-3 hover:border-[oklch(0.28_0.05_270)] transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold tracking-widest uppercase text-violet-400/70">
          Kalshi Market
        </span>
        <div className="flex items-center gap-2">
          {!market.priceIsReal && (
            <span className="text-[9px] bg-[oklch(0.18_0.02_290)] text-violet-400/60 rounded px-1.5 py-0.5">
              Price TBD
            </span>
          )}
          <span className="text-[9px] text-[oklch(0.38_0.01_280)]">
            Closes {countdown(market.closeTime)}
          </span>
        </div>
      </div>

      {/* Title */}
      <p className="text-[13px] font-medium text-white/85 line-clamp-2 leading-snug">
        {market.title}
      </p>
      {market.subtitle && (
        <p className="text-[11px] text-[oklch(0.45_0.01_280)] -mt-1">{market.subtitle}</p>
      )}

      {/* YES / NO prices */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
          <div className="text-[10px] font-bold text-blue-400/70 uppercase tracking-widest mb-0.5">
            YES
          </div>
          <div className="text-2xl font-bold text-blue-400">{yesDisplay}</div>
          {market.priceIsReal && market.yesBid > 0 && (
            <div className="text-[9px] text-blue-400/50 mt-1">
              Bid {market.yesBid}¢ · Ask {market.yesAsk}¢
            </div>
          )}
        </div>
        <div className="bg-[oklch(0.14_0.01_280)] border border-[oklch(0.20_0.01_280)] rounded-lg p-3 text-center">
          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-0.5">
            NO
          </div>
          <div className="text-2xl font-bold text-white/60">{noDisplay}</div>
          {market.priceIsReal && market.noBid > 0 && (
            <div className="text-[9px] text-white/30 mt-1">
              Bid {market.noBid}¢ · Ask {market.noAsk}¢
            </div>
          )}
        </div>
      </div>

      {/* Implied probability bar */}
      {yesPct !== null && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-blue-400/60 w-8 text-right">{yesPct}%</span>
          <div className="flex-1 h-1.5 rounded-full bg-[oklch(0.16_0.01_280)] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all"
              style={{ width: `${yesPct}%` }}
            />
          </div>
          <span className="text-[9px] text-white/30 w-8">{100 - yesPct}%</span>
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-2 flex-wrap text-[10px] text-[oklch(0.40_0.01_280)]">
        {market.volume24h > 0 && (
          <span className="bg-[oklch(0.14_0.01_280)] rounded px-2 py-1">
            Vol 24h: ${market.volume24h.toLocaleString()}
          </span>
        )}
        {market.openInterest > 0 && (
          <span className="bg-[oklch(0.14_0.01_280)] rounded px-2 py-1">
            OI: ${market.openInterest.toLocaleString()}
          </span>
        )}
        {market.spread > 0 && (
          <span className="bg-[oklch(0.14_0.01_280)] rounded px-2 py-1">
            Spread: {market.spread}¢
          </span>
        )}
      </div>

      {/* CTAs */}
      <div className="flex gap-2">
        <a
          href={`https://kalshi.com/markets/${market.ticker}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-[11px] font-semibold text-violet-400 border border-violet-500/20 hover:border-violet-500/40 rounded-lg py-1.5 transition-colors"
        >
          Trade on Kalshi ↗
        </a>
        {onAsk && (
          <button
            onClick={() =>
              onAsk(
                `Analyze this Kalshi prediction market: "${market.title}". Is the YES price at ${yesDisplay} good value? What's the implied probability vs. your estimate?`,
              )
            }
            className="flex-1 text-[11px] font-semibold text-blue-400 border border-blue-500/20 hover:border-blue-500/40 rounded-lg py-1.5 transition-colors"
          >
            Ask AI →
          </button>
        )}
      </div>
    </div>
  );
}
