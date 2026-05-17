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
  const noPct = yesPct !== null ? 100 - yesPct : null;
  const ttl = countdown(market.closeTime);

  return (
    <div className="group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow,0_0_40px_rgb(0_0_0/0.3))] transition-all duration-300 flex flex-col">
      {/* Ambient fuchsia gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/25 dark:via-pink-800/10 to-transparent opacity-60 pointer-events-none"
        aria-hidden="true"
      />

      {/* Header band */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)] bg-fuchsia-900/20">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black tracking-widest uppercase text-fuchsia-400">
            Kalshi
          </span>
          {market.category && (
            <>
              <span className="text-fuchsia-700/60">·</span>
              <span className="text-[9px] text-fuchsia-400/60 font-semibold uppercase tracking-wide truncate max-w-[80px]">
                {market.category}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!market.priceIsReal && (
            <span className="text-[9px] bg-fuchsia-900/40 text-fuchsia-400/60 rounded-md px-1.5 py-0.5 border border-fuchsia-700/30">
              TBD
            </span>
          )}
          <span className="text-[9px] font-bold text-[var(--text-faint)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-lg">
            ⏱ {ttl}
          </span>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-3 px-4 py-4 flex-1">
        {/* Market title */}
        <p className="text-[13px] font-bold text-white/90 line-clamp-2 leading-snug">
          {market.title}
        </p>
        {market.subtitle && (
          <p className="text-[11px] text-[var(--text-muted)] -mt-2">{market.subtitle}</p>
        )}

        {/* YES / NO hero prices */}
        <div className="grid grid-cols-2 gap-2">
          {/* YES */}
          <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/30 p-4 text-center">
            <div className="text-[9px] font-black text-emerald-400/80 uppercase tracking-widest mb-1.5">YES</div>
            <div className="text-3xl font-black text-emerald-300 tabular-nums leading-none">
              {yesDisplay}
            </div>
            {market.priceIsReal && market.yesBid > 0 && (
              <div className="text-[8px] text-emerald-400/50 mt-2 space-x-1">
                <span>Bid {market.yesBid}¢</span>
                <span>·</span>
                <span>Ask {market.yesAsk}¢</span>
              </div>
            )}
          </div>

          {/* NO */}
          <div className="rounded-2xl bg-red-500/15 border border-red-500/30 p-4 text-center">
            <div className="text-[9px] font-black text-red-400/80 uppercase tracking-widest mb-1.5">NO</div>
            <div className="text-3xl font-black text-red-300 tabular-nums leading-none">
              {noDisplay}
            </div>
            {market.priceIsReal && market.noBid > 0 && (
              <div className="text-[8px] text-red-400/50 mt-2 space-x-1">
                <span>Bid {market.noBid}¢</span>
                <span>·</span>
                <span>Ask {market.noAsk}¢</span>
              </div>
            )}
          </div>
        </div>

        {/* Probability bar */}
        {yesPct !== null && noPct !== null && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[9px] font-bold">
              <span className="text-emerald-400">{yesPct}% YES</span>
              <span className="text-red-400">{noPct}% NO</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-l-full transition-all duration-500"
                style={{ width: `${yesPct}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-r-full transition-all duration-500"
                style={{ width: `${noPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats row: volume + OI + spread */}
        <div className="grid grid-cols-3 gap-1.5">
          {market.volume24h > 0 && (
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2 text-center">
              <div className="text-[11px] font-black text-foreground tabular-nums">
                ${market.volume24h >= 1000
                  ? `${(market.volume24h / 1000).toFixed(0)}k`
                  : market.volume24h.toLocaleString()}
              </div>
              <div className="text-[8px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">Vol 24h</div>
            </div>
          )}
          {market.openInterest > 0 && (
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2 text-center">
              <div className="text-[11px] font-black text-foreground tabular-nums">
                ${market.openInterest >= 1000
                  ? `${(market.openInterest / 1000).toFixed(0)}k`
                  : market.openInterest.toLocaleString()}
              </div>
              <div className="text-[8px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">Open Int</div>
            </div>
          )}
          {market.spread > 0 && (
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2 text-center">
              <div className="text-[11px] font-black text-foreground tabular-nums">{market.spread}¢</div>
              <div className="text-[8px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">Spread</div>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="flex gap-2 mt-auto pt-1">
          <a
            href={`https://kalshi.com/markets/${market.ticker}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-[11px] font-black text-white bg-fuchsia-600/80 hover:bg-fuchsia-600 border border-fuchsia-500/40 hover:border-fuchsia-400/60 rounded-xl py-2 transition-all duration-150"
          >
            TRADE ↗
          </a>
          {onAsk && (
            <button
              onClick={() =>
                onAsk(
                  `Analyze this Kalshi prediction market: "${market.title}". Is the YES price at ${yesDisplay} good value? What's the implied probability vs. your estimate?`,
                )
              }
              className="flex-1 text-[11px] font-semibold text-fuchsia-400 border border-fuchsia-500/20 hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5 rounded-xl py-2 transition-all duration-150"
            >
              Ask AI →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
