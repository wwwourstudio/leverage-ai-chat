'use client';

import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, Users, Zap, BarChart2 } from 'lucide-react';
import type { EnrichedOddsEvent } from '@/components/cards/OddsCard';
import type { KalshiMarket } from '@/components/cards/KalshiMarketCard';

interface Props {
  welcomeText?: string;
  onPromptSelect?: (prompt: string) => void;
}

const PROMPT_CHIPS = [
  'Best MLB value bets today',
  'Top DK DFS plays tonight',
  'Kalshi MLB markets',
  'xwOBA leaders this season',
  'Arbitrage opportunities now',
  'Shohei Ohtani props',
];

const FEATURE_TILES = [
  {
    key: 'betting',
    label: 'Betting',
    desc: 'Live odds & arbitrage',
    Icon: TrendingUp,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    prompt: "Show today's MLB betting edges, sharp money signals, and best moneyline value",
    countKey: 'games',
  },
  {
    key: 'fantasy',
    label: 'Fantasy',
    desc: 'Draft & waiver tools',
    Icon: Users,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    prompt: 'Show fantasy baseball waiver wire pickups and streaming options for this week',
    countKey: null,
  },
  {
    key: 'dfs',
    label: 'DFS',
    desc: 'Optimal lineups',
    Icon: Zap,
    color: 'text-blue-300',
    bg: 'bg-blue-400/10 border-blue-400/20',
    prompt: "Build me an optimal DraftKings MLB lineup for tonight's slate",
    countKey: null,
  },
  {
    key: 'predictions',
    label: 'Predictions',
    desc: 'Kalshi markets',
    Icon: BarChart2,
    color: 'text-violet-300',
    bg: 'bg-violet-400/10 border-violet-400/20',
    prompt: 'Show me the most active Kalshi prediction markets for baseball',
    countKey: 'markets',
  },
] as const;

interface LiveData {
  games: EnrichedOddsEvent[];
  markets: KalshiMarket[];
  loading: boolean;
}

function LiveStrip({ data, onAsk }: { data: LiveData; onAsk?: (q: string) => void }) {
  if (data.loading) {
    return (
      <div className="w-full flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="shrink-0 w-48 h-14 rounded-lg bg-[var(--bg-overlay)] border border-[var(--border-subtle)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const items: React.ReactNode[] = [];

  // Odds mini tiles
  data.games.slice(0, 3).forEach(event => {
    const home = event.bestHomeOdds;
    const away = event.bestAwayOdds;
    items.push(
      <button
        key={`game-${event.id}`}
        onClick={() =>
          onAsk?.(
            `Analyze ${event.away_team} vs ${event.home_team} — best odds, sharp action, and value bets`,
          )
        }
        className="shrink-0 w-52 bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-left hover:border-blue-500/40 transition-colors"
      >
        <div className="text-[9px] text-[var(--text-faint)] mb-1 uppercase tracking-wide truncate">
          {event.sport_key?.replace(/_/g, ' ')}
        </div>
        <div className="text-[11px] font-semibold text-white/80 truncate leading-tight">
          {event.away_team} @ {event.home_team}
        </div>
        {home && away && (
          <div className="flex gap-2 mt-1 text-[10px] tabular-nums">
            <span className="text-blue-400">{away.price >= 0 ? '+' : ''}{away.price}</span>
            <span className="text-[var(--text-faint)]">/</span>
            <span className="text-violet-400">{home.price >= 0 ? '+' : ''}{home.price}</span>
          </div>
        )}
      </button>,
    );
  });

  // Kalshi mini tiles
  data.markets.slice(0, 3).forEach(market => {
    items.push(
      <button
        key={`market-${market.ticker}`}
        onClick={() =>
          onAsk?.(
            `Analyze this Kalshi market: "${market.title}". Is ${market.yesPrice}¢ YES good value?`,
          )
        }
        className="shrink-0 w-52 bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-left hover:border-violet-500/40 transition-colors"
      >
        <div className="text-[9px] text-violet-400/60 mb-1 uppercase tracking-wide">Kalshi</div>
        <div className="text-[11px] font-semibold text-white/80 line-clamp-1 leading-tight">
          {market.title}
        </div>
        {market.priceIsReal && (
          <div className="flex gap-2 mt-1 text-[10px] tabular-nums">
            <span className="text-blue-400">YES {market.yesPrice}¢</span>
            <span className="text-[var(--text-faint)]">/</span>
            <span className="text-white/40">NO {market.noPrice}¢</span>
          </div>
        )}
      </button>,
    );
  });

  if (items.length === 0) return null;

  return (
    <div className="w-full max-w-2xl">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-faint)] mb-2">
        Live Markets
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">{items}</div>
    </div>
  );
}

/**
 * Empty-state display shown when a chat has no messages yet.
 */
export function WelcomeScreen({ onPromptSelect }: Props) {
  const [liveData, setLiveData] = useState<LiveData>({
    games: [],
    markets: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchLive() {
      try {
        const [oddsRes, kalshiRes] = await Promise.allSettled([
          fetch('/api/odds?sport=baseball_mlb&markets=h2h&limit=3'),
          fetch('/api/kalshi?limit=3'),
        ]);

        if (cancelled) return;

        const games: EnrichedOddsEvent[] =
          oddsRes.status === 'fulfilled' && oddsRes.value.ok
            ? ((await oddsRes.value.json().catch(() => ({}))) as any)?.events?.slice(0, 3) ?? []
            : [];

        const markets: KalshiMarket[] =
          kalshiRes.status === 'fulfilled' && kalshiRes.value.ok
            ? ((await kalshiRes.value.json().catch(() => ({}))) as any)?.markets?.slice(0, 3) ?? []
            : [];

        if (!cancelled) {
          setLiveData({ games, markets, loading: false });
        }
      } catch {
        if (!cancelled) setLiveData(d => ({ ...d, loading: false }));
      }
    }

    fetchLive();
    return () => {
      cancelled = true;
    };
  }, []);

  const gamesCount = liveData.games.length;
  const marketsCount = liveData.markets.length;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-10 px-4 text-center gap-8">
      {/* Logo mark */}
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 blur-xl opacity-30" />
        <div className="relative w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
      </div>

      {/* Headline */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-black text-white tracking-tight">
          Your AI sports betting edge
        </h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm">
          Real-time odds, sharp money signals, EV calculations, and prop analytics — all in one
          conversation.
        </p>
      </div>

      {/* Live data strip */}
      {(liveData.loading || gamesCount > 0 || marketsCount > 0) && (
        <LiveStrip data={liveData} onAsk={onPromptSelect} />
      )}

      {/* Feature tiles */}
      {onPromptSelect && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
          {FEATURE_TILES.map(tile => {
            const Icon = tile.Icon;
            const count =
              tile.countKey === 'games' && gamesCount > 0
                ? `${gamesCount} live game${gamesCount !== 1 ? 's' : ''}`
                : tile.countKey === 'markets' && marketsCount > 0
                  ? `${marketsCount} market${marketsCount !== 1 ? 's' : ''}`
                  : null;
            return (
              <button
                key={tile.key}
                onClick={() => onPromptSelect(tile.prompt)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border ${tile.bg} hover:scale-105 active:scale-95 transition-all duration-150`}
              >
                <Icon className={`w-5 h-5 ${tile.color}`} />
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  {tile.label}
                </span>
                <span className="text-[9px] text-[var(--text-faint)]">{tile.desc}</span>
                {count && (
                  <span className={`text-[9px] font-semibold ${tile.color} opacity-80`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Prompt chips */}
      {onPromptSelect && (
        <div className="flex flex-wrap gap-2 justify-center max-w-xl">
          {PROMPT_CHIPS.map(prompt => (
            <button
              key={prompt}
              onClick={() => onPromptSelect(prompt)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-overlay)] text-[var(--text-muted)] hover:border-blue-500/50 hover:text-blue-300 hover:bg-blue-500/10 transition-all duration-150"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
